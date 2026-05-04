import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { lookupTickerPrices } from './yahoo.js';
import type { FilingFile, FundsFile, QuartersFile, SecuritiesFile } from './types.js';

const ROOT = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function latestFilingTickers(): string[] {
  const funds = readJson<FundsFile[]>(join(ROOT, 'data/funds.json'));
  const securities = readJson<SecuritiesFile>(join(ROOT, 'data/securities.json'));
  const tickers = new Set<string>();

  for (const fund of funds) {
    if (!fund.active) continue;
    const quarters = readJson<QuartersFile>(join(ROOT, `data/funds/${fund.slug}/quarters.json`));
    const latest = quarters.quarters[0];
    if (!latest) continue;
    const filing = readJson<FilingFile>(join(ROOT, `data/funds/${fund.slug}/${latest.period}.json`));
    for (const position of filing.positions) {
      if (position.put_call !== null || position.shares_type !== 'SH' || position.shares <= 0) continue;
      const security = securities[position.cusip];
      const ticker = security?.ticker;
      if (!ticker || security.name.toUpperCase().includes('CONV NOTES')) continue;
      tickers.add(ticker);
    }
  }

  return Array.from(tickers).sort((a, b) => a.localeCompare(b));
}

const tickers = latestFilingTickers();
const snapshot = await lookupTickerPrices(tickers);
const outPath = join(ROOT, 'data/prices/latest.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`wrote ${outPath} (${Object.keys(snapshot.records).length}/${tickers.length} tickers)`);
if (Object.keys(snapshot.failures).length > 0) {
  console.warn(`price lookup failures: ${Object.keys(snapshot.failures).join(', ')}`);
}
