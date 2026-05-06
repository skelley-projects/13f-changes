import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sources from './lookups/manager-photo-sources.json' with { type: 'json' };
import type { FundsFile } from './types.js';

interface PhotoSource {
  filename: string;
  url?: string;
  source_page?: string;
}

const ROOT = process.cwd();
const MANAGERS_DIR = join(ROOT, 'public', 'managers');
const FUNDS_PATH = join(ROOT, 'data', 'funds.json');
const checkOnly = process.argv.includes('--check');
const sourceByManager = sources as Record<string, PhotoSource>;

function readFunds(): FundsFile[] {
  return JSON.parse(readFileSync(FUNDS_PATH, 'utf8')) as FundsFile[];
}

function writeFunds(funds: FundsFile[]): void {
  writeFileSync(FUNDS_PATH, JSON.stringify(funds, null, 2) + '\n');
}

function localPathFor(publicPath: string): string {
  if (!publicPath.startsWith('/managers/')) {
    throw new Error(`manager_photo must live under /managers/: ${publicPath}`);
  }
  return join(ROOT, 'public', publicPath.replace(/^\//, ''));
}

async function download(source: PhotoSource, outPath: string): Promise<void> {
  if (!source.url) {
    throw new Error(`missing local file and no download URL configured for ${source.filename}`);
  }
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': '13f-changes manager photo refresh seanfkelley1@gmail.com',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} downloading ${source.url}`);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error(`downloaded image is unexpectedly small: ${source.url}`);
  }
  writeFileSync(outPath, bytes);
}

const funds = readFunds();
let changedFunds = false;
const missing: string[] = [];
const downloaded: string[] = [];

for (const fund of funds) {
  if (!fund.active) continue;
  const source = sourceByManager[fund.manager_name];
  if (!source) {
    missing.push(`${fund.slug}: no photo source configured for ${fund.manager_name}`);
    continue;
  }

  const publicPath = `/managers/${source.filename}`;
  if (fund.manager_photo !== publicPath) {
    fund.manager_photo = publicPath;
    changedFunds = true;
  }

  const outPath = localPathFor(publicPath);
  if (!existsSync(outPath)) {
    if (checkOnly) {
      missing.push(`${fund.slug}: missing ${publicPath}`);
    } else {
      await download(source, outPath);
      downloaded.push(publicPath);
    }
  }
}

if (missing.length > 0) {
  console.error('manager photo check failed:');
  for (const item of missing) console.error(`  - ${item}`);
  console.error('Add a source to scripts/lookups/manager-photo-sources.json, then run npm run refresh-manager-photos.');
  process.exit(1);
}

if (!checkOnly && changedFunds) writeFunds(funds);

if (downloaded.length > 0) {
  console.log(`downloaded ${downloaded.length} manager photos: ${downloaded.join(', ')}`);
} else {
  console.log('manager photos already present');
}

if (changedFunds && checkOnly) {
  console.error('manager photo paths need updating; run npm run refresh-manager-photos.');
  process.exit(1);
}
