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
}

export interface SectorIndustry { sector: string; industry: string }

let _defaultClient: YahooClient | null = null;
function getDefaultClient(): YahooClient {
  if (_defaultClient) return _defaultClient;
  // yahoo-finance2 v3+ requires `new YahooFinance()` to instantiate.
  _defaultClient = new (YahooFinance as unknown as new (opts?: unknown) => YahooClient)({
    suppressNotices: ['yahooSurvey'],
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
