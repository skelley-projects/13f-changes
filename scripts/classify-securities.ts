import type { CUSIP, SecuritiesFile, SecurityRecord } from './types.js';
import type { OpenFigiResult } from './openfigi.js';
import type { SectorIndustry } from './yahoo.js';
import { mapWithConcurrency } from './concurrency.js';

/** Yahoo sector lookups per new CUSIP; same modest cap as the other Yahoo calls. */
const CLASSIFY_CONCURRENCY = 6;

export interface ClassifyDeps {
  lookupCusips: (cusips: CUSIP[]) => Promise<Record<CUSIP, OpenFigiResult | null>>;
  lookupTickerSector: (ticker: string) => Promise<SectorIndustry | null>;
  /** Issuer names from the filing — used in manual-fallback prompts. */
  issuerNames?: Record<CUSIP, string>;
}

export interface ManualNeeded {
  cusip: CUSIP;
  issuer: string;
  reason: 'no-ticker' | 'no-sector';
  ticker?: string;          // present if ticker resolved but sector didn't
}

export interface ClassifyResult {
  classified: SecuritiesFile;
  needsManual: ManualNeeded[];
}

export async function classifyNewCusips(
  cusips: CUSIP[],
  cache: SecuritiesFile,
  deps: ClassifyDeps,
  opts: { concurrency?: number } = {},
): Promise<ClassifyResult> {
  const out: ClassifyResult = { classified: {}, needsManual: [] };

  // Cache hits return immediately.
  const newCusips: CUSIP[] = [];
  for (const c of cusips) {
    if (cache[c]) {
      out.classified[c] = cache[c];
    } else {
      newCusips.push(c);
    }
  }
  if (newCusips.length === 0) return out;

  const figiResults = await deps.lookupCusips(newCusips);
  const issuerNames = deps.issuerNames ?? {};

  // One Yahoo sector lookup per new CUSIP, run with bounded concurrency. Collect
  // results first, then assemble in input order so `needsManual` ordering stays
  // identical to the old serial loop.
  const resolved = await mapWithConcurrency(
    newCusips,
    opts.concurrency ?? CLASSIFY_CONCURRENCY,
    async (cusip): Promise<{ cusip: CUSIP; record?: SecurityRecord; manual?: ManualNeeded }> => {
      const figi = figiResults[cusip];
      if (!figi) {
        return { cusip, manual: { cusip, issuer: issuerNames[cusip] ?? cusip, reason: 'no-ticker' } };
      }
      // A single unresolvable ticker must not abort the whole fund. Warrant and
      // unit tickers are the usual culprits: OpenFIGI returns e.g. "FLYX/WS",
      // and the slash breaks Yahoo's URL path so the request 502s. Degrade to
      // manual classification, which is where such a security was headed anyway.
      let sector: SectorIndustry | null = null;
      try {
        sector = await deps.lookupTickerSector(figi.ticker);
      } catch (error) {
        console.warn(
          `  sector lookup failed for ${figi.ticker} (${cusip}): ` +
          `${error instanceof Error ? error.message.split('\n')[0] : error}`,
        );
      }
      if (!sector) {
        return {
          cusip,
          manual: { cusip, issuer: issuerNames[cusip] ?? figi.name, reason: 'no-sector', ticker: figi.ticker },
        };
      }
      const record: SecurityRecord = {
        cusip,
        ticker: figi.ticker,
        name: figi.name,
        sector: sector.sector,
        industry: sector.industry,
        ticker_source: 'openfigi',
        sector_source: 'yahoo-finance',
        classified_at: new Date().toISOString(),
      };
      return { cusip, record };
    },
  );

  for (const r of resolved) {
    if (r.record) out.classified[r.cusip] = r.record;
    if (r.manual) out.needsManual.push(r.manual);
  }
  return out;
}
