import YahooFinance from 'yahoo-finance2';
import sectorMap from './lookups/yahoo-to-gics.json' with { type: 'json' };

export interface YahooClient {
  quoteSummary: (
    ticker: string,
    opts: { modules: string[] },
  ) => Promise<{ assetProfile?: { sector?: string; industry?: string } | null }>;
}

export interface SectorIndustry { sector: string; industry: string }

let _defaultClient: YahooClient | null = null;
function getDefaultClient(): YahooClient {
  if (_defaultClient) return _defaultClient;
  // yahoo-finance2 v3+ requires `new YahooFinance()` to instantiate.
  _defaultClient = new (YahooFinance as unknown as new () => YahooClient)();
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
