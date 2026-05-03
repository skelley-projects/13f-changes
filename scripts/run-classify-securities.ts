// scripts/run-classify-securities.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lookupCusips } from './openfigi.js';
import { lookupTickerSector } from './yahoo.js';
import { classifyNewCusips } from './classify-securities.js';
import type { FilingFile, SecuritiesFile } from './types.js';

const slug = process.argv[2];
const period = process.argv[3];
if (!slug || !period) {
  console.error('usage: tsx scripts/run-classify-securities.ts <slug> <period>');
  process.exit(2);
}

const ROOT = process.cwd();
const filingPath = join(ROOT, `data/funds/${slug}/${period}.json`);
const securitiesPath = join(ROOT, 'data/securities.json');

const filing: FilingFile = JSON.parse(readFileSync(filingPath, 'utf8'));
const cache: SecuritiesFile = JSON.parse(readFileSync(securitiesPath, 'utf8'));

const cusips = [...new Set(filing.positions.map(p => p.cusip))];
const issuerNames: Record<string, string> = {};
for (const p of filing.positions) issuerNames[p.cusip] = p.name_of_issuer;

const result = await classifyNewCusips(cusips, cache, {
  lookupCusips,
  lookupTickerSector,
  issuerNames,
});

const merged: SecuritiesFile = { ...cache, ...result.classified };
writeFileSync(securitiesPath, JSON.stringify(merged, null, 2) + '\n');

const newlyClassified = Object.keys(result.classified).filter(c => !cache[c]);
console.log(`Classified ${newlyClassified.length} new CUSIPs.`);

if (result.needsManual.length > 0) {
  console.log('\nThe following CUSIPs need MANUAL classification:');
  for (const m of result.needsManual) {
    console.log(`  ${m.cusip}  ${m.issuer}  reason=${m.reason}${m.ticker ? ` ticker=${m.ticker}` : ''}`);
  }
  console.log('\nFor each, edit data/securities.json by hand or use the /update-quarter slash command which prompts interactively.');
  process.exitCode = 1;
}
