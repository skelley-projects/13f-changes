// scripts/poll-edgar.ts
import type { PendingEntry } from './types.js';
import { mapWithConcurrency } from './concurrency.js';

/** SEC EDGAR fair-access is ~10 requests/second; a low cap keeps bursts polite. */
const SEC_CONCURRENCY = 4;

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
  opts: { concurrency?: number } = {},
): Promise<PendingEntry[]> {
  // One SEC EDGAR fetch per fund, run with bounded concurrency. Keep the cap low:
  // SEC's fair-access policy is ~10 req/s, and we'd rather stay comfortably under.
  // Each task returns its entry (or null); we filter afterwards so output order
  // still follows the input fund order.
  const results = await mapWithConcurrency(
    funds,
    opts.concurrency ?? SEC_CONCURRENCY,
    async (fund): Promise<PendingEntry | null> => {
      const filings = await input.fetchEdgar(fund.cik);
      if (filings.length === 0) return null;
      const latest = filings[0];
      const knownLatest = known[fund.slug]?.latestAccession;
      if (knownLatest && knownLatest === latest.accession) return null;
      const cikNoZeros = String(parseInt(fund.cik, 10));
      const accNoDashes = latest.accession.replace(/-/g, '');
      return {
        slug: fund.slug,
        cik: fund.cik,
        accession: latest.accession,
        period_ending: latest.period_ending,
        filing_date: latest.filing_date,
        edgar_url: `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}/`,
        discovered_at: new Date().toISOString(),
      };
    },
  );
  return results.filter((entry): entry is PendingEntry => entry !== null);
}
