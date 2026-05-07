import type { DryPowderFile, DryPowderHistoryEntry } from './types.js';

export const BERKSHIRE_CIK = '0001067983';
export const BERKSHIRE_SLUG = 'berkshire-hathaway';

interface RecentFilings {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
}

export interface SecSubmissions {
  filings: {
    recent: RecentFilings;
  };
}

export interface BerkshirePeriodicFiling {
  form: '10-Q' | '10-K';
  accession: string;
  filingDate: string;
  periodEnding: string;
  primaryDocument: string;
  htmlUrl: string;
  xbrlUrl: string;
}

export interface FetchBerkshireDryPowderInput {
  submissions: SecSubmissions;
  xbrl: string;
  filing?: BerkshirePeriodicFiling;
  rows?: [BalanceRow, BalanceRow];
  now?: Date;
}

interface XbrlContext {
  id: string;
  instant: string;
  members: string[];
}

export interface BalanceRow {
  period_ending: string;
  cash_and_equivalents: number;
  short_term_treasury_bills: number;
  total_dry_powder: number;
}

function cikForArchive(cik: string): string {
  return String(parseInt(cik, 10));
}

function accessionForArchive(accession: string): string {
  return accession.replace(/-/g, '');
}

export function buildFilingUrls(
  cik: string,
  accession: string,
  primaryDocument: string,
): { htmlUrl: string; xbrlUrl: string } {
  const base = `https://www.sec.gov/Archives/edgar/data/${cikForArchive(cik)}/${accessionForArchive(accession)}`;
  const xmlDocument = primaryDocument.replace(/\.html?$/i, '_htm.xml');
  return {
    htmlUrl: `${base}/${primaryDocument}`,
    xbrlUrl: `${base}/${xmlDocument}`,
  };
}

export function findLatestBerkshirePeriodicFiling(
  submissions: SecSubmissions,
): BerkshirePeriodicFiling {
  const filings = findBerkshirePeriodicFilings(submissions, 1);
  if (!filings[0]) throw new Error('No Berkshire 10-Q or 10-K found in SEC submissions feed');
  return filings[0];
}

export function findBerkshirePeriodicFilings(
  submissions: SecSubmissions,
  limit = 24,
): BerkshirePeriodicFiling[] {
  const recent = submissions.filings.recent;
  const filings: BerkshirePeriodicFiling[] = [];
  for (let i = 0; i < recent.form.length; i += 1) {
    const form = recent.form[i];
    if (form !== '10-Q' && form !== '10-K') continue;
    const accession = recent.accessionNumber[i];
    const filingDate = recent.filingDate[i];
    const periodEnding = recent.reportDate[i];
    const primaryDocument = recent.primaryDocument[i];
    if (!accession || !filingDate || !periodEnding || !primaryDocument) {
      throw new Error(`Berkshire ${form} entry is missing required SEC metadata`);
    }
    const urls = buildFilingUrls(BERKSHIRE_CIK, accession, primaryDocument);
    filings.push({
      form,
      accession,
      filingDate,
      periodEnding,
      primaryDocument,
      ...urls,
    });
    if (filings.length >= limit) break;
  }
  return filings;
}

function attrValue(attrs: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]+)"`).exec(attrs)?.[1] ?? null;
}

function parseContexts(xbrl: string): Map<string, XbrlContext> {
  const contexts = new Map<string, XbrlContext>();
  const re = /<context\s+id="([^"]+)"[\s\S]*?<\/context>/g;
  for (const match of xbrl.matchAll(re)) {
    const block = match[0];
    const instant = /<instant>([^<]+)<\/instant>/.exec(block)?.[1];
    if (!instant) continue;
    const members = Array.from(block.matchAll(/<xbrldi:explicitMember\b[^>]*>([^<]+)<\/xbrldi:explicitMember>/g))
      .map(member => member[1]);
    contexts.set(match[1], { id: match[1], instant, members });
  }
  return contexts;
}

function extractFacts(xbrl: string, localName: string): Map<string, number> {
  const facts = new Map<string, number>();
  const re = new RegExp(`<[\\w-]+:${localName}\\b([^>]*)>([\\s\\S]*?)<\\/[\\w-]+:${localName}>`, 'g');
  for (const match of xbrl.matchAll(re)) {
    const contextRef = attrValue(match[1], 'contextRef');
    if (!contextRef) continue;
    const raw = match[2].replace(/,/g, '').trim();
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    facts.set(contextRef, value);
  }
  return facts;
}

export function extractBerkshireDryPowderRows(xbrl: string): [BalanceRow, BalanceRow] {
  const contexts = parseContexts(xbrl);
  const cashFacts = extractFacts(xbrl, 'CashAndCashEquivalentsAtCarryingValue');
  const treasuryFacts = extractFacts(xbrl, 'USTreasuryBills');
  const rows: BalanceRow[] = [];

  for (const [contextRef, cash] of cashFacts.entries()) {
    const context = contexts.get(contextRef);
    if (!context?.members.includes('brka:InsuranceAndOtherMember')) continue;
    const treasury = treasuryFacts.get(contextRef);
    if (treasury === undefined) continue;
    rows.push({
      period_ending: context.instant,
      cash_and_equivalents: cash,
      short_term_treasury_bills: treasury,
      total_dry_powder: cash + treasury,
    });
  }

  const deduped = Array.from(
    new Map(rows.map(row => [row.period_ending, row])).values(),
  ).sort((a, b) => b.period_ending.localeCompare(a.period_ending));

  if (deduped.length < 2) {
    throw new Error('Could not extract current and prior Berkshire Insurance and Other cash/T-bill rows');
  }

  return [deduped[0], deduped[1]];
}

export function buildBerkshireDryPowderHistory(
  filingsWithRows: Array<{ filing: BerkshirePeriodicFiling; rows: [BalanceRow, BalanceRow] }>,
): DryPowderHistoryEntry[] {
  const byPeriod = new Map<string, DryPowderHistoryEntry>();
  for (const { filing, rows } of filingsWithRows) {
    const current = rows[0];
    byPeriod.set(current.period_ending, {
      period_ending: current.period_ending,
      filing_date: filing.filingDate,
      accession: filing.accession,
      form: filing.form,
      url: filing.htmlUrl,
      cash_and_equivalents: current.cash_and_equivalents,
      short_term_treasury_bills: current.short_term_treasury_bills,
      total_dry_powder: current.total_dry_powder,
    });
  }
  return Array.from(byPeriod.values()).sort((a, b) => a.period_ending.localeCompare(b.period_ending));
}

export function buildBerkshireDryPowderFile(
  input: FetchBerkshireDryPowderInput & { history?: DryPowderHistoryEntry[] },
): DryPowderFile {
  const filing = input.filing ?? findLatestBerkshirePeriodicFiling(input.submissions);
  const [current, prior] = input.rows ?? extractBerkshireDryPowderRows(input.xbrl);

  return {
    slug: BERKSHIRE_SLUG,
    source: `SEC Form ${filing.form}`,
    source_filing: {
      form: filing.form,
      period_ending: filing.periodEnding,
      filing_date: filing.filingDate,
      accession: filing.accession,
      url: filing.htmlUrl,
    },
    context: 'Berkshire Insurance and Other balance sheet. This is not sourced from the 13F.',
    currency: 'USD',
    values: { current, prior },
    update_policy: {
      disclosure_frequency: 'Quarterly, when Berkshire files its 10-Q or 10-K.',
      automation: 'SEC submissions are checked daily, and every 30 minutes during Berkshire reporting windows.',
      granularity: 'This is the most granular reliable cash/T-bill view available from public filings; 13Fs do not disclose cash.',
    },
    history: input.history ?? buildBerkshireDryPowderHistory([{ filing, rows: [current, prior] }]),
    notes: [
      '13F filings do not include cash or Treasury bills.',
      'Berkshire is a public company, so cash and short-term Treasury bill balances are available from its 10-Q/10-K balance sheet.',
      'The figures used here are the Insurance and Other rows for cash and cash equivalents and short-term investments in U.S. Treasury Bills.',
      'The site checks for newly filed Berkshire 10-Q/10-K disclosures automatically and redeploys when this file changes.',
    ],
    fetched_at: (input.now ?? new Date()).toISOString(),
  };
}
