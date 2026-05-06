import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { segmentPrimers } from '../src/lib/segment-primers.js';
import { lookupSegmentMetrics } from './yahoo.js';

const ROOT = process.cwd();

function collectSegmentTickers(): string[] {
  const tickers = new Set<string>();
  for (const primer of Object.values(segmentPrimers)) {
    for (const player of primer.majorPlayers) {
      if (player.ticker && player.kind !== 'Private') tickers.add(player.ticker.toUpperCase());
    }
  }
  return Array.from(tickers).sort((a, b) => a.localeCompare(b));
}

const tickers = collectSegmentTickers();
const snapshot = await lookupSegmentMetrics(tickers);
const outPath = join(ROOT, 'data/segments/metrics.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`wrote ${outPath} (${Object.keys(snapshot.records).length}/${tickers.length} tickers)`);
if (Object.keys(snapshot.failures).length > 0) {
  console.warn(`segment metric lookup failures: ${Object.keys(snapshot.failures).join(', ')}`);
}
