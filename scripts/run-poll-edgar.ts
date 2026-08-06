// scripts/run-poll-edgar.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

interface WatchOptions {
  watch: boolean;
  durationMinutes: number;
  intervalSeconds: number;
}

export function parseWatchArgs(argv: string[]): WatchOptions {
  const flag = (name: string): string | undefined =>
    argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
  const num = (name: string, fallback: number): number => {
    const raw = flag(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`--${name} must be a positive number, got "${raw}"`);
    }
    return value;
  };
  return {
    watch: argv.includes('--watch'),
    durationMinutes: num('duration-minutes', 50),
    intervalSeconds: num('interval-seconds', 300),
  };
}

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

/**
 * One EDGAR sweep. Returns the number of filings newly queued (0 if nothing new).
 * Reads state fresh each call so a watch loop sees its own writes.
 */
async function pollOnce(): Promise<number> {
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
    return 0;
  }

  const pendingPath = join(ROOT, 'data/_pending.json');
  const pending: PendingFile = JSON.parse(readFileSync(pendingPath, 'utf8'));
  // Merge — don't double-add accessions already pending
  const known_pending = new Set(pending.pending.map(p => p.accession));
  const added = newFilings.filter(f => !known_pending.has(f.accession));
  if (added.length === 0) {
    console.log(`${newFilings.length} new filing(s) already queued; nothing to add.`);
    return 0;
  }
  pending.pending.push(...added);
  writeFileSync(pendingPath, JSON.stringify(pending, null, 2) + '\n');
  console.log(`Queued ${added.length} new filing(s) for review.`);
  return added.length;
}

/**
 * Poll from inside a single job rather than asking the Actions scheduler for
 * more runs. GitHub silently drops high-frequency scheduled workflows: on the
 * 2026-05-15 13F deadline a quarter-hourly cron requested 48 runs and GitHub
 * delivered 8, so real detection lag was ~90 minutes, not the intended 15. An
 * hourly cron is honoured reliably, and this loop supplies the granularity
 * inside it.
 *
 * Exits as soon as something is queued so the workflow can commit and email
 * without waiting out the rest of the window.
 */
async function main() {
  const { watch, durationMinutes, intervalSeconds } = parseWatchArgs(process.argv.slice(2));
  if (!watch) {
    await pollOnce();
    return;
  }

  const deadline = Date.now() + durationMinutes * 60_000;
  const intervalMs = intervalSeconds * 1000;
  let sweeps = 0;
  let succeeded = 0;
  let lastError: unknown = null;

  for (;;) {
    sweeps += 1;
    try {
      const queued = await pollOnce();
      succeeded += 1;
      if (queued > 0) {
        console.log(`Found on sweep ${sweeps}; exiting early to commit.`);
        return;
      }
    } catch (error) {
      // A transient EDGAR blip should not fail a 50-minute watch. Record it and
      // keep sweeping; only a window where every sweep failed is a real failure.
      lastError = error;
      console.warn(`Sweep ${sweeps} failed: ${error instanceof Error ? error.message : error}`);
    }
    if (Date.now() + intervalMs >= deadline) break;
    await sleep(intervalMs);
  }

  if (succeeded === 0) {
    console.error(`All ${sweeps} EDGAR sweep(s) failed over ${durationMinutes}m.`);
    throw lastError ?? new Error('EDGAR polling failed');
  }
  console.log(`No new filings after ${sweeps} sweep(s) over ${durationMinutes}m.`);
}

// Only run when invoked as a script, so tests can import parseWatchArgs without
// firing real EDGAR requests on import.
const invokedDirectly =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
