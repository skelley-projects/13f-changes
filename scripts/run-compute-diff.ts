// scripts/run-compute-diff.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { computeDiff } from './compute-diff.js';
import type { FilingFile, QuartersFile, SecuritiesFile, TagsFile } from './types.js';

const slug = process.argv[2];
const period = process.argv[3];
if (!slug || !period) {
  console.error('usage: tsx scripts/run-compute-diff.ts <slug> <period>');
  process.exit(2);
}

const ROOT = process.cwd();
const current: FilingFile = JSON.parse(readFileSync(join(ROOT, `data/funds/${slug}/${period}.json`), 'utf8'));
const quarters: QuartersFile = JSON.parse(readFileSync(join(ROOT, `data/funds/${slug}/quarters.json`), 'utf8'));
const priorEntry = quarters.quarters.find(q => q.period !== period);  // any non-current
const prior: FilingFile | null = priorEntry
  ? JSON.parse(readFileSync(join(ROOT, `data/funds/${slug}/${priorEntry.period}.json`), 'utf8'))
  : null;

const securities: SecuritiesFile = JSON.parse(readFileSync(join(ROOT, 'data/securities.json'), 'utf8'));
const tags: TagsFile = JSON.parse(readFileSync(join(ROOT, `data/funds/${slug}/tags.json`), 'utf8'));

const diff = computeDiff({ current, prior, securities, tags });

const outPath = join(ROOT, `data/funds/${slug}/diff/${period}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(diff, null, 2) + '\n');
console.log(`wrote ${outPath}`);
