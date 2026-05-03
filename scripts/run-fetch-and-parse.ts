// scripts/run-fetch-and-parse.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fetchFiling } from './fetch-filing.js';
import { parseFiling } from './parse-13f.js';
import type { FundsFile, PendingFile } from './types.js';

const slug = process.argv[2];
const accession = process.argv[3];
if (!slug || !accession) {
  console.error('usage: tsx scripts/run-fetch-and-parse.ts <slug> <accession>');
  process.exit(2);
}

const ROOT = process.cwd();
const funds: FundsFile[] = JSON.parse(readFileSync(join(ROOT, 'data/funds.json'), 'utf8'));
const fund = funds.find(f => f.slug === slug);
if (!fund) { console.error(`unknown slug: ${slug}`); process.exit(2); }

const pending: PendingFile = JSON.parse(readFileSync(join(ROOT, 'data/_pending.json'), 'utf8'));
const entry = pending.pending.find(p => p.slug === slug && p.accession === accession);

const fetched = await fetchFiling({
  cik: fund.cik,
  accession,
  userAgent: 'Sean Kelley seanfkelley1@gmail.com',
});

const parsed = parseFiling({
  primaryDocXml: fetched.primaryDocXml,
  holdingsXml: fetched.holdingsXml,
  meta: {
    slug,
    accession,
    edgar_url: fetched.edgarUrl,
    filing_date: entry?.filing_date ?? '',
  },
});

const outPath = join(ROOT, `data/funds/${slug}/${parsed.period}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(parsed, null, 2) + '\n');
console.log(`wrote ${outPath} — ${parsed.position_count} positions, ${parsed.schema_version}, $${parsed.total_value.toLocaleString()}`);
