import type { CUSIP, SecuritiesFile, SecurityRecord } from './types.js';
import type { OpenFigiResult } from './openfigi.js';
import type { SectorIndustry } from './yahoo.js';

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

  for (const cusip of newCusips) {
    const figi = figiResults[cusip];
    if (!figi) {
      out.needsManual.push({
        cusip, issuer: issuerNames[cusip] ?? cusip, reason: 'no-ticker',
      });
      continue;
    }
    const sector = await deps.lookupTickerSector(figi.ticker);
    if (!sector) {
      out.needsManual.push({
        cusip, issuer: issuerNames[cusip] ?? figi.name, reason: 'no-sector',
        ticker: figi.ticker,
      });
      continue;
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
    out.classified[cusip] = record;
  }
  return out;
}
