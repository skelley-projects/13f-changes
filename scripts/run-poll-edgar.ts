// scripts/run-poll-edgar.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverNewFilings, type EdgarFiling, type KnownState } from './poll-edgar.js';
import type { FundsFile, PendingFile, QuartersFile } from './types.js';

const USER_AGENT = 'Sean Kelley seanfkelley1@gmail.com';
const ROOT = process.cwd();

async function fetchLatest13F(cik: string): Promise<EdgarFiling[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=10&output=atom`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`EDGAR HTTP ${res.status}`);
  const text = await res.text();
  // crude parse — Atom has <entry> blocks; pluck accession-number, filing-date, file-type
  const out: EdgarFiling[] = [];
  const entryRe = /<entry>[\s\S]*?<\/entry>/g;
  for (const block of text.match(entryRe) ?? []) {
    if (!block.includes('<filing-type>13F-HR</filing-type>')) continue;
    const acc = block.match(/<accession-number>([^<]+)<\/accession-number>/)?.[1];
    const date = block.match(/<filing-date>([^<]+)<\/filing-date>/)?.[1];
    if (!acc || !date) continue;
    // period_ending is not in the atom feed; defer to /update-quarter.
    // Use a placeholder; the manual review fills it in correctly.
    out.push({ accession: acc, filing_date: date, period_ending: '' });
  }
  return out;
}

async function main() {
  const funds: FundsFile[] = JSON.parse(readFileSync(join(ROOT, 'data/funds.json'), 'utf8'));
  const known: KnownState = {};
  for (const fund of funds) {
    const q: QuartersFile = JSON.parse(readFileSync(join(ROOT, `data/funds/${fund.slug}/quarters.json`), 'utf8'));
    known[fund.slug] = { latestAccession: q.quarters[0]?.accession ?? '' };
  }

  const newFilings = await discoverNewFilings(
    funds.map(f => ({ slug: f.slug, cik: f.cik })),
    known,
    { fetchEdgar: fetchLatest13F },
  );

  if (newFilings.length === 0) {
    console.log('No new filings.');
    return;
  }

  const pendingPath = join(ROOT, 'data/_pending.json');
  const pending: PendingFile = JSON.parse(readFileSync(pendingPath, 'utf8'));
  // Merge — don't double-add accessions already pending
  const known_pending = new Set(pending.pending.map(p => p.accession));
  for (const f of newFilings) {
    if (!known_pending.has(f.accession)) pending.pending.push(f);
  }
  writeFileSync(pendingPath, JSON.stringify(pending, null, 2) + '\n');
  console.log(`Queued ${newFilings.length} new filing(s) for review.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
