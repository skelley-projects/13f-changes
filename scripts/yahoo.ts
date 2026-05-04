import YahooFinance from 'yahoo-finance2';
import sectorMap from './lookups/yahoo-to-gics.json' with { type: 'json' };

export interface YahooClient {
  quoteSummary: (
    ticker: string,
    opts: { modules: string[] },
  ) => Promise<{ assetProfile?: { sector?: string; industry?: string } | null }>;
  quote?: (
    tickers: string[],
    opts: { fields: string[]; return: 'object' },
  ) => Promise<Record<string, {
    symbol?: string;
    regularMarketPrice?: number;
    regularMarketTime?: Date | string;
    currency?: string;
    marketState?: string;
      quoteSourceName?: string;
    }>>;
  historical?: (
    ticker: string,
    opts: { period1: string; period2: string; interval: '1d' },
  ) => Promise<Array<{
    date: Date;
    low?: number;
    high?: number;
  }>>;
}

export interface SectorIndustry { sector: string; industry: string }

let _defaultClient: YahooClient | null = null;
function getDefaultClient(): YahooClient {
  if (_defaultClient) return _defaultClient;
  // yahoo-finance2 v3+ requires `new YahooFinance()` to instantiate.
  _defaultClient = new (YahooFinance as unknown as new (opts?: unknown) => YahooClient)({
    suppressNotices: ['yahooSurvey', 'ripHistorical'],
  });
  return _defaultClient;
}

export async function lookupTickerSector(
  ticker: string,
  opts: { yahoo?: YahooClient } = {},
): Promise<SectorIndustry | null> {
  const client = opts.yahoo ?? getDefaultClient();
  const summary = await client.quoteSummary(ticker, { modules: ['assetProfile'] });
  const ap = summary?.assetProfile;
  if (!ap?.sector || !ap.industry) return null;
  const mapped = (sectorMap.sectors as Record<string, string>)[ap.sector];
  return {
    sector: mapped ?? ap.sector,
    industry: ap.industry,
  };
}

export async function lookupTickerPrices(
  tickers: string[],
  opts: { yahoo?: YahooClient; now?: Date } = {},
) {
  const unique = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean)));
  const records: Record<string, import('./types.js').PriceRecord> = {};
  const failures: Record<string, string> = {};
  if (unique.length === 0) {
    return {
      fetched_at: (opts.now ?? new Date()).toISOString(),
      source: 'yahoo-finance' as const,
      records,
      failures,
    };
  }

  const client = opts.yahoo ?? getDefaultClient();
  if (!client.quote) {
    throw new Error('Yahoo client does not implement quote()');
  }
  const quotes = await client.quote(unique, {
    fields: ['symbol', 'regularMarketPrice', 'regularMarketTime', 'currency', 'marketState', 'quoteSourceName'],
    return: 'object',
  });

  for (const ticker of unique) {
    const quote = quotes[ticker];
    if (!quote || typeof quote.regularMarketPrice !== 'number') {
      failures[ticker] = 'missing regularMarketPrice';
      continue;
    }
    const asOf = quote.regularMarketTime instanceof Date
      ? quote.regularMarketTime.toISOString()
      : typeof quote.regularMarketTime === 'string'
        ? new Date(quote.regularMarketTime).toISOString()
        : (opts.now ?? new Date()).toISOString();
    records[ticker] = {
      ticker,
      price: quote.regularMarketPrice,
      currency: quote.currency ?? null,
      as_of: asOf,
      market_state: quote.marketState ?? null,
      quote_source: quote.quoteSourceName ?? null,
      source: 'yahoo-finance',
    };
  }

  return {
    fetched_at: (opts.now ?? new Date()).toISOString(),
    source: 'yahoo-finance' as const,
    records,
    failures,
  };
}

export interface PriceRangeRequest {
  ticker: string;
  period: string;
  start: string;
  end: string;
}

function nextUtcDate(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function lookupTickerPriceRanges(
  requests: PriceRangeRequest[],
  opts: { yahoo?: YahooClient } = {},
) {
  const client = opts.yahoo ?? getDefaultClient();
  if (!client.historical) {
    throw new Error('Yahoo client does not implement historical()');
  }

  const ranges: Record<string, import('./types.js').PriceRangeRecord> = {};
  const failures: Record<string, string> = {};
  const unique = new Map<string, PriceRangeRequest>();
  for (const request of requests) {
    const ticker = request.ticker.trim().toUpperCase();
    if (!ticker) continue;
    const normalized = { ...request, ticker };
    unique.set(priceRangeKey(ticker, request.period), normalized);
  }

  for (const [key, request] of unique.entries()) {
    try {
      const history = await client.historical(request.ticker, {
        period1: request.start,
        // Yahoo treats period2 as an exclusive-ish bound in common usage; add one day to include quarter end.
        period2: nextUtcDate(request.end),
        interval: '1d',
      });
      const lows = history.map(row => row.low).filter((v): v is number => typeof v === 'number' && v > 0);
      const highs = history.map(row => row.high).filter((v): v is number => typeof v === 'number' && v > 0);
      if (lows.length === 0 || highs.length === 0) {
        failures[key] = 'missing historical low/high';
        continue;
      }
      ranges[key] = {
        ticker: request.ticker,
        period: request.period,
        start: request.start,
        end: request.end,
        low: Math.min(...lows),
        high: Math.max(...highs),
        currency: 'USD',
        source: 'yahoo-finance',
      };
    } catch (error) {
      failures[key] = error instanceof Error ? error.message : String(error);
    }
  }

  return { ranges, failures };
}

export function priceRangeKey(ticker: string, period: string): string {
  return `${ticker.trim().toUpperCase()}:${period}`;
}
