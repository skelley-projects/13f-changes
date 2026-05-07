import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  BERKSHIRE_CIK,
  BERKSHIRE_SLUG,
  buildBerkshireDryPowderFile,
  findLatestBerkshirePeriodicFiling,
  type SecSubmissions,
} from './berkshire-dry-powder.js';
import type { DryPowderFile } from './types.js';

const ROOT = process.cwd();
const USER_AGENT = 'Sean Kelley seanfkelley1@gmail.com';
const OUT_PATH = join(ROOT, 'data', 'funds', BERKSHIRE_SLUG, 'dry-powder.json');
const FORCE = process.argv.includes('--force');

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return await res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url);
  return JSON.parse(text) as T;
}

function readExisting(): DryPowderFile | null {
  try {
    return JSON.parse(readFileSync(OUT_PATH, 'utf8')) as DryPowderFile;
  } catch {
    return null;
  }
}

function materiallyChanged(a: DryPowderFile | null, b: DryPowderFile): boolean {
  if (!a) return true;
  const withoutFetchedAt = (value: DryPowderFile) => {
    const copy = structuredClone(value) as Partial<DryPowderFile>;
    delete copy.fetched_at;
    return copy;
  };
  return JSON.stringify(withoutFetchedAt(a)) !== JSON.stringify(withoutFetchedAt(b));
}

const submissionsUrl = `https://data.sec.gov/submissions/CIK${BERKSHIRE_CIK}.json`;
const submissions = await fetchJson<SecSubmissions>(submissionsUrl);
const filing = findLatestBerkshirePeriodicFiling(submissions);
const xbrl = await fetchText(filing.xbrlUrl);
const dryPowder = buildBerkshireDryPowderFile({ submissions, xbrl });
const existing = readExisting();

if (!FORCE && !materiallyChanged(existing, dryPowder)) {
  console.log(`Berkshire dry powder already current at ${dryPowder.source_filing.accession}`);
  process.exit(0);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(dryPowder, null, 2) + '\n');
console.log(
  `wrote ${OUT_PATH} from Berkshire ${dryPowder.source_filing.form} ${dryPowder.source_filing.accession}`,
);
