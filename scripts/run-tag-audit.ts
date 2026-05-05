import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DiffFile, FilingFile, FundsFile, SecuritiesFile, TagsFile } from './types.js';

const ROOT = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function fmtMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  return `$${Math.round(value).toLocaleString()}`;
}

function fmtPct(value: number | null | undefined): string {
  return value == null ? 'n/a' : `${value.toFixed(1)}%`;
}

function printTopDeltas(label: string, diff: DiffFile, key: 'theme_breakdown' | 'granular_breakdown'): void {
  const breakdown = diff[key];
  if (!breakdown) {
    console.log(`  ${label}: none`);
    return;
  }
  const rows = breakdown.deltas.slice(0, 6);
  console.log(`  ${label}: ${rows.map(r => `${r.label} ${r.delta_pct_pts >= 0 ? '+' : ''}${r.delta_pct_pts.toFixed(1)}pp`).join(' | ')}`);
}

function printGapList(
  label: string,
  filing: FilingFile,
  securities: SecuritiesFile,
  rows: FilingFile['positions'],
): void {
  if (rows.length === 0) {
    console.log(`  ${label}: none`);
    return;
  }
  console.log(`  ${label}:`);
  for (const p of rows.slice(0, 8)) {
    const sec = securities[p.cusip];
    const ticker = sec?.ticker ?? p.cusip;
    const pct = filing.total_value > 0 ? (p.value / filing.total_value) * 100 : 0;
    console.log(`    ${ticker.padEnd(6)} ${fmtMoney(p.value).padStart(7)} ${pct.toFixed(1).padStart(4)}%  ${sec?.name ?? p.name_of_issuer}`);
  }
}

function auditFund(fund: FundsFile, securities: SecuritiesFile): void {
  const fundDir = join(ROOT, 'data', 'funds', fund.slug);
  const quartersPath = join(fundDir, 'quarters.json');
  if (!existsSync(quartersPath)) return;

  const quarters = readJson<{ quarters: Array<{ period: string }> }>(quartersPath);
  const currentPeriod = quarters.quarters[0]?.period;
  if (!currentPeriod) return;

  const filing = readJson<FilingFile>(join(fundDir, `${currentPeriod}.json`));
  const tags = readJson<TagsFile>(join(fundDir, 'tags.json'));
  const diffPath = join(fundDir, 'diff', `${currentPeriod}.json`);
  const diff = existsSync(diffPath) ? readJson<DiffFile>(diffPath) : null;

  const subTagIds = new Set(tags.taxonomy.filter(t => t.parent !== undefined).map(t => t.id));
  let taggedValue = 0;
  let granularValue = 0;
  const untagged = [];
  const topOnly = [];

  for (const p of filing.positions) {
    const ids = tags.assignments[p.cusip] ?? [];
    const hasTag = ids.length > 0;
    const hasGranular = ids.some(id => subTagIds.has(id));
    if (hasTag) taggedValue += p.value;
    if (hasGranular) granularValue += p.value;
    if (!hasTag) untagged.push(p);
    else if (!hasGranular) topOnly.push(p);
  }

  untagged.sort((a, b) => b.value - a.value);
  topOnly.sort((a, b) => b.value - a.value);

  console.log(`\n${fund.name} (${fund.slug})`);
  console.log(`  current: ${currentPeriod} | AUM: ${fmtMoney(filing.total_value)}`);
  console.log(`  theme coverage: ${fmtPct(filing.total_value > 0 ? (taggedValue / filing.total_value) * 100 : 0)}`);
  console.log(`  granular coverage: ${fmtPct(filing.total_value > 0 ? (granularValue / filing.total_value) * 100 : 0)}`);
  if (diff) {
    printTopDeltas('theme shifts', diff, 'theme_breakdown');
    printTopDeltas('granular shifts', diff, 'granular_breakdown');
  }
  printGapList('top untagged current positions', filing, securities, untagged);
  printGapList('top top-level-only current positions', filing, securities, topOnly);
}

const funds = readJson<FundsFile[]>(join(ROOT, 'data', 'funds.json')).filter(f => f.active);
const securities = readJson<SecuritiesFile>(join(ROOT, 'data', 'securities.json'));

for (const fund of funds) auditFund(fund, securities);
