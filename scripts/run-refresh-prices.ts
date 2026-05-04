import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { lookupTickerPriceRanges, lookupTickerPrices, type PriceRangeRequest } from './yahoo.js';
import type { DiffFile, FilingFile, FundsFile, MovementRow, QuartersFile, SecuritiesFile } from './types.js';

const ROOT = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function isPriceEligibleName(name: string, titleOfClass: string): boolean {
  return !/\b(CONV|NOTE|NOTES|DEBENTURE)\b/i.test(`${name} ${titleOfClass}`);
}

function isPriceEligibleMovement(row: MovementRow): boolean {
  return row.put_call === null
    && row.shares_type === 'SH'
    && Boolean(row.ticker)
    && isPriceEligibleName(row.name, row.title_of_class);
}

function periodWindow(period: string): { start: string; end: string } {
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) throw new Error(`Unsupported period ${period}`);
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const starts = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
  const ends = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`];
  return { start: starts[quarter - 1], end: ends[quarter - 1] };
}

function collectLatestPriceInputs(): { tickers: string[]; rangeRequests: PriceRangeRequest[] } {
  const funds = readJson<FundsFile[]>(join(ROOT, 'data/funds.json'));
  const securities = readJson<SecuritiesFile>(join(ROOT, 'data/securities.json'));
  const tickers = new Set<string>();
  const rangeRequests = new Map<string, PriceRangeRequest>();

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
      if (!ticker || !isPriceEligibleName(security.name, position.title_of_class)) continue;
      tickers.add(ticker);
    }

    const diff = readJson<DiffFile>(join(ROOT, `data/funds/${fund.slug}/diff/${latest.period}.json`));
    const period = diff.current_period;
    const window = periodWindow(period);
    const soldRows = [
      ...diff.movements.closed,
      ...diff.movements.activity.flatMap(row => row.sold),
    ];
    for (const row of soldRows) {
      if (!isPriceEligibleMovement(row)) continue;
      const ticker = row.ticker!.toUpperCase();
      const key = `${ticker}:${period}`;
      rangeRequests.set(key, { ticker, period, start: window.start, end: window.end });
    }
  }

  return {
    tickers: Array.from(tickers).sort((a, b) => a.localeCompare(b)),
    rangeRequests: Array.from(rangeRequests.values()).sort((a, b) =>
      `${a.ticker}:${a.period}`.localeCompare(`${b.ticker}:${b.period}`),
    ),
  };
}

const { tickers, rangeRequests } = collectLatestPriceInputs();
const snapshot = await lookupTickerPrices(tickers);
const rangeSnapshot = await lookupTickerPriceRanges(rangeRequests);
snapshot.ranges = rangeSnapshot.ranges;
snapshot.failures = { ...snapshot.failures, ...rangeSnapshot.failures };
const outPath = join(ROOT, 'data/prices/latest.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`wrote ${outPath} (${Object.keys(snapshot.records).length}/${tickers.length} tickers, ${Object.keys(snapshot.ranges).length}/${rangeRequests.length} ranges)`);
if (Object.keys(snapshot.failures).length > 0) {
  console.warn(`price lookup failures: ${Object.keys(snapshot.failures).join(', ')}`);
}
