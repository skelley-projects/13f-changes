// scripts/poll-edgar.ts
import type { PendingEntry } from './types.js';

export interface EdgarFiling {
  accession: string;
  filing_date: string;
  period_ending: string;
}
export interface DiscoverInput {
  fetchEdgar: (cik: string) => Promise<EdgarFiling[]>;
}
export interface FundForPolling { slug: string; cik: string }
export interface KnownState {
  [slug: string]: { latestAccession: string };
}

export async function discoverNewFilings(
  funds: FundForPolling[],
  known: KnownState,
  input: DiscoverInput,
): Promise<PendingEntry[]> {
  const out: PendingEntry[] = [];
  for (const fund of funds) {
    const filings = await input.fetchEdgar(fund.cik);
    if (filings.length === 0) continue;
    const latest = filings[0];
    const knownLatest = known[fund.slug]?.latestAccession;
    if (knownLatest && knownLatest === latest.accession) continue;
    const cikNoZeros = String(parseInt(fund.cik, 10));
    const accNoDashes = latest.accession.replace(/-/g, '');
    out.push({
      slug: fund.slug,
      cik: fund.cik,
      accession: latest.accession,
      period_ending: latest.period_ending,
      filing_date: latest.filing_date,
      edgar_url: `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}/`,
      discovered_at: new Date().toISOString(),
    });
  }
  return out;
}
