// src/lib/data.ts
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FundsFile, QuartersFile, FilingFile, TagsFile, SecuritiesFile, DiffFile, PendingFile,
} from '../../scripts/types.js';

const ROOT = process.cwd();

export function loadFunds(): FundsFile[] {
  return JSON.parse(readFileSync(join(ROOT, 'data/funds.json'), 'utf8'));
}
export function loadSecurities(): SecuritiesFile {
  return JSON.parse(readFileSync(join(ROOT, 'data/securities.json'), 'utf8'));
}
export function loadPending(): PendingFile {
  return JSON.parse(readFileSync(join(ROOT, 'data/_pending.json'), 'utf8'));
}
export function loadFundQuarters(slug: string): QuartersFile {
  return JSON.parse(readFileSync(join(ROOT, `data/funds/${slug}/quarters.json`), 'utf8'));
}
export function loadFundTags(slug: string): TagsFile {
  return JSON.parse(readFileSync(join(ROOT, `data/funds/${slug}/tags.json`), 'utf8'));
}
export function loadFiling(slug: string, period: string): FilingFile | null {
  const path = join(ROOT, `data/funds/${slug}/${period}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
export function loadDiff(slug: string, period: string): DiffFile | null {
  const path = join(ROOT, `data/funds/${slug}/diff/${period}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
