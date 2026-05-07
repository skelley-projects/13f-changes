import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateAll, type DatasetForValidation } from './validate-data.js';

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadDataset(root: string): DatasetForValidation {
  const funds = loadJson<DatasetForValidation['funds']>(join(root, 'data/funds.json'));
  const securities = loadJson<DatasetForValidation['securities']>(join(root, 'data/securities.json'));
  const pending = loadJson<DatasetForValidation['pending']>(join(root, 'data/_pending.json'));

  const perFund: DatasetForValidation['perFund'] = {};
  const fundsDir = join(root, 'data/funds');
  if (existsSync(fundsDir)) {
    for (const slug of readdirSync(fundsDir)) {
      const dir = join(fundsDir, slug);
      const quarters = loadJson<any>(join(dir, 'quarters.json'));
      const tags = loadJson<any>(join(dir, 'tags.json'));
      const dryPowder = existsSync(join(dir, 'dry-powder.json'))
        ? loadJson<any>(join(dir, 'dry-powder.json'))
        : undefined;
      const quarterFiles: Record<string, any> = {};
      const diffFiles: Record<string, any> = {};
      for (const file of readdirSync(dir)) {
        if (file === 'quarters.json' || file === 'tags.json' || file === 'dry-powder.json') continue;
        if (!file.endsWith('.json')) continue;
        const period = file.replace(/\.json$/, '');
        quarterFiles[period] = loadJson(join(dir, file));
      }
      const diffDir = join(dir, 'diff');
      if (existsSync(diffDir)) {
        for (const file of readdirSync(diffDir)) {
          if (!file.endsWith('.json')) continue;
          diffFiles[file.replace(/\.json$/, '')] = loadJson(join(diffDir, file));
        }
      }
      perFund[slug] = { quarters, tags, quarterFiles, diffFiles, dryPowder };
    }
  }
  return { funds, securities, pending, perFund };
}

const root = process.cwd();
const dataset = loadDataset(root);
const { errors, warnings } = validateAll(dataset);

for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log(`ok — ${dataset.funds.length} funds, ${Object.keys(dataset.securities).length} securities`);
