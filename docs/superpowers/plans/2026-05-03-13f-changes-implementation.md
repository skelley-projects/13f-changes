# 13f-changes — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public website at `13f.<domain>` that surfaces quarter-over-quarter changes in two hedge funds' 13F filings (Situational Awareness LP, Duquesne Family Office) with a changes-first IA, sector + thematic-tag breakdowns, and a semi-automated quarterly review workflow.

**Architecture:** Static Astro site on Cloudflare Workers. JSON files in the repo are the source of truth — no database. GitHub Actions polls SEC EDGAR daily during the four 45-day filing windows; when a new filing lands it queues a review and (optionally) emails. The user runs a `/update-quarter` Claude Code session once per quarter to fetch, classify, tag, and ship. All inheritances follow the nvidia-tracker pattern.

**Tech stack:** Astro 4+, TypeScript (strict), Node 20+, Vitest for tests, Wrangler for Cloudflare deploy, Resend for email, OpenFIGI + Yahoo Finance (`yahoo-finance2`) for security enrichment, GitHub Actions for automation.

**Spec:** `docs/superpowers/specs/2026-05-03-13f-changes-design.md` — read this first for the full design context.

---

## File structure

This plan creates the following files. Group A is foundational (scaffold), Group B is the data layer (scripts that touch JSON), Group C is the UI layer (Astro components and pages), Group D is automation (GitHub Actions + slash command).

**A · Scaffold:**
- `package.json`, `tsconfig.json`, `astro.config.mjs`, `wrangler.toml`, `vitest.config.ts`
- `.gitignore`, `README.md`
- `data/funds.json` (with the two fund entries)
- `data/securities.json` (empty `{}`)
- `data/_pending.json` (empty `{"pending": []}`)
- `data/funds/situational-awareness/` and `data/funds/duquesne/` directories with empty `quarters.json` and `tags.json`
- `tests/fixtures/` with sample 13F XML files (one X02, one X01)

**B · Data layer (TypeScript scripts under `scripts/`):**
- `scripts/types.ts` — shared types for positions, filings, securities, tags, diffs
- `scripts/parse-13f.ts` — XML → position list (handles X01/X02, options, foreign CUSIPs)
- `scripts/fetch-filing.ts` — discover holdings filename via `index.json`, download both XMLs
- `scripts/openfigi.ts` — CUSIP → ticker via OpenFIGI
- `scripts/yahoo.ts` — ticker → sector/industry via `yahoo-finance2`, with GICS mapping
- `scripts/classify-securities.ts` — orchestrate: cache hit → openfigi → yahoo → manual fallback
- `scripts/compute-diff.ts` — two quarter files → diff JSON
- `scripts/poll-edgar.ts` — find latest filings per fund, update `_pending.json`
- `scripts/remind.ts` — send Resend email if pending non-empty
- `scripts/validate-data.ts` — schema + integrity checks
- `scripts/lookups/yahoo-to-gics.json` — Yahoo sector strings → canonical GICS labels

**C · UI layer (Astro under `src/`):**
- `src/lib/data.ts` — JSON loaders for funds, quarters, diffs
- `src/lib/format.ts` — number/currency/percentage formatters
- `src/components/FundHeader.astro`
- `src/components/ChangeHero.astro`
- `src/components/SectorDeltaBars.astro`
- `src/components/ThemeDeltaBars.astro`
- `src/components/MovementTable.astro`
- `src/components/HoldingsTable.astro`
- `src/components/ContactCTA.astro`
- `src/pages/index.astro` — multi-fund homepage
- `src/pages/about.astro` — methodology page
- `src/pages/funds/[slug].astro` — per-fund detail page
- `src/styles/global.css` — minimal default-clean styles

**D · Automation:**
- `.github/workflows/poll-edgar.yml` — daily during filing windows
- `.github/workflows/reminder.yml` — weekly during filing windows
- `.github/workflows/deploy.yml` — on push to main
- `.claude/commands/update-quarter.md` — the quarterly review slash command

---

## Phase 0 — Scaffold

### Task 0.1: Initialize the Astro project with TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `.gitignore`, `src/pages/index.astro` (placeholder)

**Why:** Astro is the static site generator. We deploy to Cloudflare Workers using the **Workers Static Assets** feature, which serves a `dist/` directory directly — no SSR adapter needed for our static-only use case. TypeScript strict gives us type safety for the data scripts and component props.

> **Note (post Task 0.1 review):** An earlier draft of this task used `@astrojs/cloudflare` adapter. That adapter generates SSR Worker code that doesn't match the Workers Static Assets deploy model and produces a `dist/server/` + `dist/client/` layout that fights the wrangler.toml in Task 0.2. For pure static SSG, no adapter is needed — Cloudflare's Workers Static Assets feature serves the `dist/` directory directly.

- [ ] **Step 1: Run `npm create astro` non-interactively in the project root**

```bash
cd "C:/Users/skelley1/Claude Projects/13f-changes"
npm create astro@latest . -- --template minimal --typescript strict --install --no-git --skip-houston --yes
```

Expected: an Astro `minimal` template installs with TypeScript strict mode. Existing files (the spec under `docs/`) are preserved; the install asks before overwriting if present, but the prompt is suppressed by `--yes`.

If the command errors because the directory isn't empty: pass `--force` instead of relying on the empty-dir check.

- [ ] **Step 2: Update `astro.config.mjs` for static-only output (no adapter)**

```js
// astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://13f.example.com', // overwrite when domain is decided
});
```

No `@astrojs/cloudflare` import — we deploy via Workers Static Assets, which serves `dist/` directly without an adapter.

- [ ] **Step 3: Verify `astro build` runs**

```bash
npm run build
```

Expected: build succeeds, produces a flat `dist/` (NOT `dist/client/` + `dist/server/`) with the placeholder `index.html` at `dist/index.html`. If you see a `dist/server/` directory, the adapter is still configured — re-check `astro.config.mjs`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json astro.config.mjs .gitignore src/ public/ .vscode/ README.md
git commit -m "scaffold: initialize Astro project (static SSG, no adapter)"
```

Add `public/`, `.vscode/`, `README.md` from the Astro init alongside the originally-listed files — `npm create astro` produces those by default and they're harmless.

### Task 0.2: Add Wrangler config for Cloudflare Workers Static Assets deploy

**Files:**
- Create: `wrangler.toml`

**Why:** Wrangler is Cloudflare's deploy CLI. We use the Workers Static Assets feature — Cloudflare serves the `dist/` directory directly without any Worker code. No `main` field needed; the `[assets]` block tells Wrangler which directory to publish.

- [ ] **Step 1: Create `wrangler.toml`**

```toml
name = "13f-changes"
compatibility_date = "2025-01-01"

[assets]
directory = "./dist"
```

The `name` becomes part of the default `*.workers.dev` URL. `compatibility_date` pins the Workers runtime version. Adjust both when domain decisions are made. (Unlike a Worker with code, no `main` field is needed — Cloudflare auto-serves the assets.)

- [ ] **Step 2: Add deploy script to `package.json`**

Edit `package.json`'s `scripts`:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "astro build && wrangler deploy"
  }
}
```

- [ ] **Step 3: Install wrangler as a dev dependency**

```bash
npm install --save-dev wrangler
```

- [ ] **Step 4: Verify wrangler config parses**

```bash
npx wrangler deploy --dry-run --outdir=/tmp/wrangler-check
```

Expected: prints what *would* be deployed, no actual deploy. Does not require Cloudflare auth at this stage.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml package.json package-lock.json
git commit -m "scaffold: add Wrangler config and deploy script"
```

### Task 0.3: Set up Vitest for testing

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add test script + vitest dep)

**Why:** Vitest is the modern Node test runner with TypeScript and ESM support out of the box. Used for parser, diff, and classification unit tests.

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest @types/node
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Add a sanity test to verify wiring**

Create `tests/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests/sanity.test.ts
git commit -m "scaffold: add Vitest"
```

### Task 0.4: Create the data directory structure with seeded fund entries

**Files:**
- Create: `data/funds.json`, `data/securities.json`, `data/_pending.json`
- Create: `data/funds/situational-awareness/quarters.json`, `data/funds/situational-awareness/tags.json`
- Create: `data/funds/duquesne/quarters.json`, `data/funds/duquesne/tags.json`

**Why:** The data layer's source of truth. Every script and component reads from here. Seeding the two launch funds means the rest of the codebase can be developed against real CIKs from the start.

- [ ] **Step 1: Create `data/funds.json` with both fund entries**

```json
[
  {
    "slug": "situational-awareness",
    "name": "Situational Awareness LP",
    "manager_name": "Leopold Aschenbrenner",
    "cik": "0002045724",
    "location": "San Francisco, CA",
    "description": "AI/AGI-thesis fund. Concentrated bets on AI compute and infrastructure.",
    "added": "2026-05-03",
    "active": true
  },
  {
    "slug": "duquesne",
    "name": "Duquesne Family Office LLC",
    "manager_name": "Stanley Druckenmiller",
    "cik": "0001536411",
    "location": "New York, NY",
    "description": "Macro/generalist family office. Druckenmiller's vehicle since 2010.",
    "added": "2026-05-03",
    "active": true
  }
]
```

- [ ] **Step 2: Create `data/securities.json` as `{}`**
- [ ] **Step 3: Create `data/_pending.json` as `{"pending": []}`**
- [ ] **Step 4: Create `data/funds/situational-awareness/quarters.json` as `{"slug": "situational-awareness", "quarters": []}`**
- [ ] **Step 5: Create `data/funds/situational-awareness/tags.json` as `{"slug": "situational-awareness", "taxonomy": [], "assignments": {}}`**
- [ ] **Step 6: Create the matching files for `duquesne`**
- [ ] **Step 7: Commit**

```bash
git add data/
git commit -m "scaffold: seed data directory with two fund entries"
```

### Task 0.5: Add sample EDGAR fixtures for testing

**Files:**
- Create: `tests/fixtures/sa-2025-q4-primary_doc.xml`
- Create: `tests/fixtures/sa-2025-q4-informationtable.xml`
- Create: `tests/fixtures/duquesne-2019-q2-primary_doc.xml` (X01 schema)
- Create: `tests/fixtures/duquesne-2019-q2-informationtable.xml` (X01 schema)

**Why:** The parser must handle both X01 (legacy, values in thousands) and X02 (modern, values in dollars). Real fixtures from production filings prove the parser works on actual data, not just synthetic XML.

- [ ] **Step 1: Download SA Q4 2025 primary_doc.xml**

```bash
curl -H "User-Agent: Sean Kelley seanfkelley1@gmail.com" \
  "https://www.sec.gov/Archives/edgar/data/2045724/000204572426000002/primary_doc.xml" \
  -o tests/fixtures/sa-2025-q4-primary_doc.xml
```

- [ ] **Step 2: Download SA Q4 2025 information table**

```bash
curl -H "User-Agent: Sean Kelley seanfkelley1@gmail.com" \
  "https://www.sec.gov/Archives/edgar/data/2045724/000204572426000002/SALP_13FQ425.xml" \
  -o tests/fixtures/sa-2025-q4-informationtable.xml
```

- [ ] **Step 3: Find a Duquesne X01 filing**

Query EDGAR for an old Duquesne filing (pre-2022, when X01 schema was standard):

```bash
curl -H "User-Agent: Sean Kelley seanfkelley1@gmail.com" \
  "https://www.sec.gov/Archives/edgar/data/1536411/000153641119000007/index.json"
```

Inspect the output to find the holdings XML filename, then:

```bash
curl -H "User-Agent: Sean Kelley seanfkelley1@gmail.com" \
  "https://www.sec.gov/Archives/edgar/data/1536411/000153641119000007/primary_doc.xml" \
  -o tests/fixtures/duquesne-2019-q2-primary_doc.xml
curl -H "User-Agent: Sean Kelley seanfkelley1@gmail.com" \
  "https://www.sec.gov/Archives/edgar/data/1536411/000153641119000007/<holdings-filename>" \
  -o tests/fixtures/duquesne-2019-q2-informationtable.xml
```

(Replace `<holdings-filename>` with the actual filename from the index.json response.)

- [ ] **Step 4: Verify both fixtures exist and have non-trivial content**

```bash
ls -la tests/fixtures/
```

Expected: 4 XML files, each at least a few KB.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/
git commit -m "test: add SA Q4 2025 (X02) and Duquesne 2019-Q2 (X01) EDGAR fixtures"
```

---

## Phase 1 — Data parsing

### Task 1.1: Define shared TypeScript types

**Files:**
- Create: `scripts/types.ts`

**Why:** A single types module imported everywhere keeps interfaces consistent. Future tasks reference these types.

- [ ] **Step 1: Create `scripts/types.ts`**

```ts
export type Slug = string;
export type CUSIP = string;       // 9 alphanumeric chars
export type CIK = string;         // 10-digit, leading zeros
export type Period = string;      // e.g. "2025-Q4"
export type SectorName = string;  // canonical GICS top-level
export type IndustryName = string;
export type TagId = string;

export type SchemaVersion = 'X01' | 'X02';
export type ValueUnits = 'USD' | 'USD_THOUSANDS';

export interface Position {
  cusip: CUSIP;
  name_of_issuer: string;
  title_of_class: string;
  shares: number;
  shares_type: 'SH' | 'PRN';
  /** Always in USD dollars after parsing — the parser normalizes. */
  value: number;
  put_call: 'Put' | 'Call' | null;
  investment_discretion: string;
  voting_sole: number;
  voting_shared: number;
  voting_none: number;
}

export interface FilingMeta {
  slug: Slug;
  period: Period;
  period_ending: string;        // YYYY-MM-DD
  filing_date: string;          // YYYY-MM-DD
  accession: string;
  edgar_url: string;
  /** Source filing's units, for traceability. Stored values are always USD. */
  value_units: ValueUnits;
  schema_version: SchemaVersion;
  total_value: number;          // USD
  position_count: number;
}

export interface FilingFile extends FilingMeta {
  positions: Position[];
}

export interface QuarterEntry extends FilingMeta {
  /** Editorial summary, written during /update-quarter. */
  summary: string;
  fetched_at: string;           // ISO timestamp
}

export interface QuartersFile {
  slug: Slug;
  quarters: QuarterEntry[];     // sorted newest first
}

export interface SecurityRecord {
  cusip: CUSIP;
  ticker: string | null;
  name: string;
  sector: SectorName;
  industry: IndustryName;
  ticker_source: 'openfigi' | 'edgar-tickers' | 'manual-override';
  sector_source: 'yahoo-finance' | 'finnhub' | 'manual-override';
  manual_override_reason?: string;
  classified_at: string;
}

export type SecuritiesFile = Record<CUSIP, SecurityRecord>;

export interface TaxonomyEntry {
  id: TagId;
  label: string;
  description: string;
}

export interface TagsFile {
  slug: Slug;
  taxonomy: TaxonomyEntry[];
  assignments: Record<CUSIP, TagId[]>;
}

export interface FundsFile {
  slug: Slug;
  name: string;
  manager_name: string;
  cik: CIK;
  location: string;
  description: string;
  added: string;
  active: boolean;
}

export interface PendingEntry {
  slug: Slug;
  cik: CIK;
  accession: string;
  period_ending: string;
  filing_date: string;
  edgar_url: string;
  discovered_at: string;
}

export interface PendingFile {
  pending: PendingEntry[];
}

/* Diff-related types live below */

export type MovementStatus = 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED' | 'UNCHANGED';

export interface MovementRow {
  cusip: CUSIP;
  ticker: string | null;
  name: string;
  sector: SectorName;
  industry: IndustryName;
  tags: TagId[];
  /** Differs by status — see compute-diff.ts. */
  current_value: number | null;
  prior_value: number | null;
  current_shares: number | null;
  prior_shares: number | null;
  delta_value: number;
  delta_shares: number;
  delta_pct: number | null;     // null for NEW/CLOSED
  current_pct_of_portfolio: number | null;
}

export interface BreakdownEntry {
  label: string;
  value: number;
  pct: number;
}

export interface BreakdownDelta {
  label: string;
  delta_pct_pts: number;
}

export interface Breakdown {
  current: BreakdownEntry[];
  prior: BreakdownEntry[];
  deltas: BreakdownDelta[];     // sorted by absolute delta desc
}

export interface DiffFile {
  slug: Slug;
  current_period: Period;
  prior_period: Period | null;  // null for first-filing edge case
  totals: {
    current_value: number;
    prior_value: number;
    net_flow: number;
  };
  movements: {
    new: MovementRow[];
    closed: MovementRow[];
    increased: MovementRow[];
    decreased: MovementRow[];
    unchanged_count: number;
    unchanged_value: number;
  };
  sector_breakdown: Breakdown;
  theme_breakdown: Breakdown | null;  // null when fund has no tags
}
```

- [ ] **Step 2: Verify the file type-checks**

```bash
npx tsc --noEmit scripts/types.ts
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add scripts/types.ts
git commit -m "feat(types): define shared types for filings, securities, tags, diffs"
```

### Task 1.2: Implement `parse-13f.ts` — X02 happy path

**Files:**
- Create: `scripts/parse-13f.ts`
- Create: `tests/parse-13f.test.ts`

**Why:** Parsing the EDGAR 13F XML is the foundation. Start with the modern X02 schema (values in dollars, no normalization needed for the basic case). Use `fast-xml-parser` — small, fast, no DOM dependency.

- [ ] **Step 1: Install the XML parser**

```bash
npm install fast-xml-parser
```

- [ ] **Step 2: Write the failing test**

Create `tests/parse-13f.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFiling } from '../scripts/parse-13f';

const fixtures = join(__dirname, 'fixtures');

describe('parseFiling — X02', () => {
  it('parses Situational Awareness Q4 2025', () => {
    const primary = readFileSync(join(fixtures, 'sa-2025-q4-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'sa-2025-q4-informationtable.xml'), 'utf8');

    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    expect(result.schema_version).toBe('X02');
    expect(result.value_units).toBe('USD');
    expect(result.period_ending).toBe('2025-12-31');
    expect(result.position_count).toBe(29);
    // Sum-of-positions equals the cover page total
    const sum = result.positions.reduce((s, p) => s + p.value, 0);
    expect(sum).toBe(result.total_value);
    // Bloom Energy common stock position (the largest)
    const bloomCommon = result.positions.find(
      p => p.cusip === '093712107' && p.put_call === null,
    );
    expect(bloomCommon).toBeDefined();
    expect(bloomCommon!.shares).toBe(10076022);
    expect(bloomCommon!.value).toBe(875505552); // already in dollars
  });
});
```

- [ ] **Step 3: Run the test (expect failure)**

```bash
npm test -- parse-13f
```

Expected: FAIL — `parseFiling` is not exported.

- [ ] **Step 4: Implement `scripts/parse-13f.ts`**

```ts
import { XMLParser } from 'fast-xml-parser';
import type {
  FilingFile, Position, SchemaVersion, ValueUnits,
} from './types.js';

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseTagValue: false,   // keep strings, we cast ourselves
  isArray: (name) => name === 'infoTable',
});

export interface ParseInput {
  primaryDocXml: string;
  holdingsXml: string;
  /** Caller passes these — they're not in the XML files themselves. */
  meta?: Partial<Pick<FilingFile, 'slug' | 'accession' | 'edgar_url' | 'filing_date'>>;
}

export function parseFiling(input: ParseInput): FilingFile {
  const primary = xml.parse(input.primaryDocXml);
  const holdings = xml.parse(input.holdingsXml);

  const submission = primary.edgarSubmission;
  const schemaVersionStr: string = submission.headerData?.filerInfo?.schemaVersion
    ?? submission.schemaVersion
    ?? 'X02'; // some filings put it at the top level

  const schemaVersion: SchemaVersion = schemaVersionStr.startsWith('X01') ? 'X01' : 'X02';
  const valueUnits: ValueUnits = schemaVersion === 'X01' ? 'USD_THOUSANDS' : 'USD';

  // periodOfReport like "12-31-2025" → 2025-12-31
  const reportRaw: string = submission.headerData.filerInfo.periodOfReport;
  const period_ending = normalizeMmDdYyyy(reportRaw);
  const period = toPeriodCode(period_ending);

  const tableEntries = holdings.informationTable.infoTable as any[];
  const positions: Position[] = tableEntries.map((row) => {
    const rawValue = parseInt(row.value, 10);
    const value = valueUnits === 'USD_THOUSANDS' ? rawValue * 1000 : rawValue;

    return {
      cusip: row.cusip,
      name_of_issuer: row.nameOfIssuer,
      title_of_class: row.titleOfClass,
      shares: parseInt(row.shrsOrPrnAmt.sshPrnamt, 10),
      shares_type: row.shrsOrPrnAmt.sshPrnamtType,
      value,
      put_call: row.putCall ?? null,
      investment_discretion: row.investmentDiscretion ?? 'SOLE',
      voting_sole: parseInt(row.votingAuthority?.Sole ?? '0', 10),
      voting_shared: parseInt(row.votingAuthority?.Shared ?? '0', 10),
      voting_none: parseInt(row.votingAuthority?.None ?? '0', 10),
    };
  });

  const total_value = positions.reduce((s, p) => s + p.value, 0);

  return {
    slug: input.meta?.slug ?? '',
    period,
    period_ending,
    filing_date: input.meta?.filing_date ?? '',
    accession: input.meta?.accession ?? '',
    edgar_url: input.meta?.edgar_url ?? '',
    value_units: valueUnits,
    schema_version: schemaVersion,
    total_value,
    position_count: positions.length,
    positions,
  };
}

function normalizeMmDdYyyy(s: string): string {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  // already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error(`Unrecognized date format: ${s}`);
}

function toPeriodCode(periodEnding: string): string {
  const [y, m] = periodEnding.split('-');
  const q = ({ '03': 'Q1', '06': 'Q2', '09': 'Q3', '12': 'Q4' } as const)[m];
  if (!q) throw new Error(`Period ending ${periodEnding} is not a quarter end`);
  return `${y}-${q}`;
}
```

- [ ] **Step 5: Run the test (expect pass)**

```bash
npm test -- parse-13f
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/parse-13f.ts tests/parse-13f.test.ts package.json package-lock.json
git commit -m "feat(parse-13f): parse X02 13F filings (happy path)"
```

### Task 1.3: Extend `parse-13f.ts` — X01 schema with thousands→dollars normalization

**Files:**
- Modify: `tests/parse-13f.test.ts` (add X01 case)
- Verify: `scripts/parse-13f.ts` already handles via `valueUnits` branch

**Why:** Older filings (pre-2022, e.g. Duquesne 2019) report values in thousands. Stored values must always be in full dollars. The parser already has the branch — this task adds the test that proves it.

- [ ] **Step 1: Add the X01 test**

Append to `tests/parse-13f.test.ts`:

```ts
describe('parseFiling — X01', () => {
  it('parses a Duquesne X01 filing and normalizes values to dollars', () => {
    const primary = readFileSync(join(fixtures, 'duquesne-2019-q2-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'duquesne-2019-q2-informationtable.xml'), 'utf8');

    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    expect(result.schema_version).toBe('X01');
    expect(result.value_units).toBe('USD_THOUSANDS');
    // Sanity: any non-trivial position is now in dollars (>$1k)
    const largest = [...result.positions].sort((a, b) => b.value - a.value)[0];
    expect(largest.value).toBeGreaterThan(1_000_000);
    // Per-share price plausibility ($1–$10,000)
    const perShare = largest.value / largest.shares;
    expect(perShare).toBeGreaterThan(0.5);
    expect(perShare).toBeLessThan(20_000);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- parse-13f
```

Expected: both X02 and X01 tests pass. If X01 fails because `schemaVersion` is at a different XML location, inspect `tests/fixtures/duquesne-2019-q2-primary_doc.xml` and adjust the lookup chain in `parse-13f.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/parse-13f.test.ts scripts/parse-13f.ts
git commit -m "feat(parse-13f): handle X01 schema with thousands→dollars normalization"
```

### Task 1.4: Test options and foreign-CUSIP handling

**Files:**
- Modify: `tests/parse-13f.test.ts`

**Why:** SA's Q4 2025 filing includes Bloom Energy as both common stock AND call options (same CUSIP, different `put_call`). Bitdeer/Bitfarms have foreign-listed CUSIPs starting with letters. Both must round-trip.

- [ ] **Step 1: Add tests**

Append to `tests/parse-13f.test.ts`:

```ts
describe('parseFiling — edge cases', () => {
  it('keeps options positions distinct from the underlying common', () => {
    const primary = readFileSync(join(fixtures, 'sa-2025-q4-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'sa-2025-q4-informationtable.xml'), 'utf8');
    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    const bloomRows = result.positions.filter(p => p.cusip === '093712107');
    expect(bloomRows.length).toBe(2);
    expect(bloomRows.find(p => p.put_call === null)).toBeDefined();
    expect(bloomRows.find(p => p.put_call === 'Call')).toBeDefined();
  });

  it('preserves letter-prefix (foreign-listed) CUSIPs', () => {
    const primary = readFileSync(join(fixtures, 'sa-2025-q4-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'sa-2025-q4-informationtable.xml'), 'utf8');
    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    // Bitdeer's Cayman class A ordinary shares
    const bitdeer = result.positions.find(p => p.cusip === 'G11448100');
    expect(bitdeer).toBeDefined();
    expect(bitdeer!.name_of_issuer).toMatch(/BITDEER/i);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- parse-13f
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/parse-13f.test.ts
git commit -m "test(parse-13f): cover options and foreign-CUSIP edge cases"
```

### Task 1.5: Implement `fetch-filing.ts` — discover filename + download

**Files:**
- Create: `scripts/fetch-filing.ts`
- Create: `tests/fetch-filing.test.ts` (with HTTP mocks)

**Why:** The information-table XML filename is filer-specific (`SALP_13FQ425.xml` vs. `form13f_20251231.xml`). We must discover via the EDGAR `index.json` rather than guess. This module is what the poller and `/update-quarter` flow call.

- [ ] **Step 1: Write the failing test using a mock fetch**

Create `tests/fetch-filing.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { discoverHoldingsFilename, fetchFiling } from '../scripts/fetch-filing';

describe('discoverHoldingsFilename', () => {
  it('finds the holdings XML by elimination (any .xml that is not primary_doc)', () => {
    const indexJson = {
      directory: {
        item: [
          { name: '0001536411-26-000002-index.html', size: '' },
          { name: 'primary_doc.xml', size: '2027' },
          { name: 'form13f_20251231.xml', size: '24295' },
        ],
      },
    };
    expect(discoverHoldingsFilename(indexJson)).toBe('form13f_20251231.xml');
  });

  it('throws if no holdings XML candidate is found', () => {
    const indexJson = { directory: { item: [{ name: 'primary_doc.xml' }] } };
    expect(() => discoverHoldingsFilename(indexJson)).toThrow(/holdings xml/i);
  });
});

describe('fetchFiling', () => {
  it('downloads index.json, primary_doc, and the discovered holdings file', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/index.json')) {
        return new Response(JSON.stringify({
          directory: {
            item: [
              { name: 'primary_doc.xml', size: '2039' },
              { name: 'SALP_13FQ425.xml', size: '15809' },
            ],
          },
        }));
      }
      if (url.endsWith('/primary_doc.xml')) return new Response('<primary/>');
      if (url.endsWith('/SALP_13FQ425.xml')) return new Response('<holdings/>');
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await fetchFiling({
      cik: '0002045724',
      accession: '0002045724-26-000002',
      fetch: fetchMock,
      userAgent: 'test',
    });
    expect(result.primaryDocXml).toBe('<primary/>');
    expect(result.holdingsXml).toBe('<holdings/>');
    expect(result.holdingsFilename).toBe('SALP_13FQ425.xml');
  });
});
```

- [ ] **Step 2: Run (expect failure)**

```bash
npm test -- fetch-filing
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/fetch-filing.ts`**

```ts
export interface FetchFilingInput {
  cik: string;            // 10-digit, leading zeros
  accession: string;      // e.g. "0002045724-26-000002"
  fetch?: typeof fetch;
  userAgent: string;      // SEC requires a contact identifier
}

export interface FetchFilingResult {
  primaryDocXml: string;
  holdingsXml: string;
  holdingsFilename: string;
  edgarUrl: string;
}

export interface IndexJson {
  directory: { item: Array<{ name: string; size?: string }> };
}

export function discoverHoldingsFilename(idx: IndexJson): string {
  const xmlFiles = idx.directory.item
    .map(i => i.name)
    .filter(n => n.endsWith('.xml') && n !== 'primary_doc.xml');
  if (xmlFiles.length === 0) throw new Error('No holdings xml in filing index');
  // In practice there's exactly one non-primary XML in a 13F-HR filing.
  // If a filing ever has multiple, the first one wins; revisit if this fires in production.
  return xmlFiles[0];
}

export async function fetchFiling(input: FetchFilingInput): Promise<FetchFilingResult> {
  const f = input.fetch ?? globalThis.fetch;
  const cikNoZeros = String(parseInt(input.cik, 10));
  const accNoDashes = input.accession.replace(/-/g, '');
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}`;
  const headers = { 'User-Agent': input.userAgent };

  const idxRes = await f(`${base}/index.json`, { headers });
  if (!idxRes.ok) throw new Error(`index.json HTTP ${idxRes.status}`);
  const idx = (await idxRes.json()) as IndexJson;

  const holdingsFilename = discoverHoldingsFilename(idx);

  const [primaryRes, holdingsRes] = await Promise.all([
    f(`${base}/primary_doc.xml`, { headers }),
    f(`${base}/${holdingsFilename}`, { headers }),
  ]);
  if (!primaryRes.ok) throw new Error(`primary_doc HTTP ${primaryRes.status}`);
  if (!holdingsRes.ok) throw new Error(`holdings HTTP ${holdingsRes.status}`);

  return {
    primaryDocXml: await primaryRes.text(),
    holdingsXml: await holdingsRes.text(),
    holdingsFilename,
    edgarUrl: `${base}/`,
  };
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- fetch-filing
```

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-filing.ts tests/fetch-filing.test.ts
git commit -m "feat(fetch-filing): discover holdings filename and download via EDGAR"
```

---

## Phase 2 — Classification

### Task 2.1: Implement `openfigi.ts` — CUSIP → ticker

**Files:**
- Create: `scripts/openfigi.ts`
- Create: `tests/openfigi.test.ts`

**Why:** OpenFIGI is a free, batch-friendly mapper. Free tier is 25 jobs/min unauthenticated; we batch up to 25 CUSIPs per request.

- [ ] **Step 1: Write failing test (mocked fetch)**

```ts
// tests/openfigi.test.ts
import { describe, it, expect, vi } from 'vitest';
import { lookupCusips } from '../scripts/openfigi';

describe('lookupCusips', () => {
  it('maps CUSIPs to tickers via OpenFIGI batch API', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { data: [{ ticker: 'NVDA', name: 'NVIDIA CORP' }] },
      { data: [{ ticker: 'BE', name: 'BLOOM ENERGY CORP' }] },
      { warning: 'No identifier found' },
    ])));

    const result = await lookupCusips(['67066G104', '093712107', 'INVALID00'], { fetch: fetchMock });

    expect(result['67066G104']).toEqual({ ticker: 'NVDA', name: 'NVIDIA CORP' });
    expect(result['093712107']).toEqual({ ticker: 'BE', name: 'BLOOM ENERGY CORP' });
    expect(result['INVALID00']).toBeNull();
  });

  it('chunks requests when more than 25 CUSIPs are passed', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(
      Array.from({ length: 25 }, (_, i) => ({ data: [{ ticker: `T${i}`, name: 'X' }] }))
    )));
    const cusips = Array.from({ length: 30 }, (_, i) => String(i).padStart(9, '0'));
    await lookupCusips(cusips, { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npm test -- openfigi
```

- [ ] **Step 3: Implement `scripts/openfigi.ts`**

```ts
export interface OpenFigiResult {
  ticker: string;
  name: string;
}

export interface LookupOptions {
  fetch?: typeof fetch;
  apiKey?: string;
}

const BATCH_SIZE = 25;
const ENDPOINT = 'https://api.openfigi.com/v3/mapping';

export async function lookupCusips(
  cusips: string[],
  opts: LookupOptions = {},
): Promise<Record<string, OpenFigiResult | null>> {
  const f = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['X-OPENFIGI-APIKEY'] = opts.apiKey;

  const out: Record<string, OpenFigiResult | null> = {};

  for (let i = 0; i < cusips.length; i += BATCH_SIZE) {
    const chunk = cusips.slice(i, i + BATCH_SIZE);
    const body = chunk.map((c) => ({ idType: 'ID_CUSIP', idValue: c, exchCode: 'US' }));
    const res = await f(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`OpenFIGI HTTP ${res.status}`);
    const json = (await res.json()) as Array<
      { data?: Array<{ ticker: string; name: string }> } | { warning?: string }
    >;
    chunk.forEach((cusip, idx) => {
      const entry = json[idx];
      if ('data' in entry && entry.data && entry.data.length > 0) {
        out[cusip] = { ticker: entry.data[0].ticker, name: entry.data[0].name };
      } else {
        out[cusip] = null;
      }
    });
  }

  return out;
}
```

- [ ] **Step 4: Run tests (expect PASS)**
- [ ] **Step 5: Commit**

```bash
git add scripts/openfigi.ts tests/openfigi.test.ts
git commit -m "feat(openfigi): batch CUSIP→ticker lookup with chunking"
```

### Task 2.2: Implement `yahoo.ts` — ticker → sector/industry with GICS mapping

**Files:**
- Create: `scripts/yahoo.ts`
- Create: `scripts/lookups/yahoo-to-gics.json`
- Create: `tests/yahoo.test.ts`

**Why:** Yahoo's sector strings are close to but not identical to canonical GICS labels. The lookup table normalizes (e.g., Yahoo's "Technology" → GICS "Information Technology"; Yahoo's "Communication Services" → GICS "Communication Services" unchanged).

- [ ] **Step 1: Install yahoo-finance2**

```bash
npm install yahoo-finance2
```

- [ ] **Step 2: Create `scripts/lookups/yahoo-to-gics.json`**

```json
{
  "sectors": {
    "Technology": "Information Technology",
    "Communication Services": "Communication Services",
    "Consumer Cyclical": "Consumer Discretionary",
    "Consumer Defensive": "Consumer Staples",
    "Energy": "Energy",
    "Financial Services": "Financials",
    "Healthcare": "Health Care",
    "Industrials": "Industrials",
    "Basic Materials": "Materials",
    "Real Estate": "Real Estate",
    "Utilities": "Utilities"
  }
}
```

- [ ] **Step 3: Write failing test**

```ts
// tests/yahoo.test.ts
import { describe, it, expect, vi } from 'vitest';
import { lookupTickerSector } from '../scripts/yahoo';

describe('lookupTickerSector', () => {
  it('returns Yahoo sector mapped to GICS, plus industry', async () => {
    const yahoo = { quoteSummary: vi.fn(async () => ({
      assetProfile: { sector: 'Technology', industry: 'Semiconductors' },
    })) } as any;

    const result = await lookupTickerSector('NVDA', { yahoo });
    expect(result).toEqual({ sector: 'Information Technology', industry: 'Semiconductors' });
  });

  it('returns null when Yahoo has no asset profile', async () => {
    const yahoo = { quoteSummary: vi.fn(async () => ({ assetProfile: null })) } as any;
    const result = await lookupTickerSector('XXXX', { yahoo });
    expect(result).toBeNull();
  });

  it('passes through unmapped sectors with a warning', async () => {
    const yahoo = { quoteSummary: vi.fn(async () => ({
      assetProfile: { sector: 'WeirdSector', industry: 'Stuff' },
    })) } as any;
    const result = await lookupTickerSector('XYZ', { yahoo });
    expect(result).toEqual({ sector: 'WeirdSector', industry: 'Stuff' });
  });
});
```

- [ ] **Step 4: Run (expect FAIL)**

- [ ] **Step 5: Implement `scripts/yahoo.ts`**

```ts
import yahooFinance from 'yahoo-finance2';
import sectorMap from './lookups/yahoo-to-gics.json' with { type: 'json' };

export interface YahooClient {
  quoteSummary: (
    ticker: string,
    opts: { modules: string[] },
  ) => Promise<{ assetProfile?: { sector?: string; industry?: string } | null }>;
}

export interface SectorIndustry { sector: string; industry: string }

export async function lookupTickerSector(
  ticker: string,
  opts: { yahoo?: YahooClient } = {},
): Promise<SectorIndustry | null> {
  const client = opts.yahoo ?? (yahooFinance as unknown as YahooClient);
  const summary = await client.quoteSummary(ticker, { modules: ['assetProfile'] });
  const ap = summary?.assetProfile;
  if (!ap?.sector || !ap.industry) return null;
  const mapped = (sectorMap.sectors as Record<string, string>)[ap.sector];
  return {
    sector: mapped ?? ap.sector,
    industry: ap.industry,
  };
}
```

- [ ] **Step 6: Run tests (expect PASS)**
- [ ] **Step 7: Commit**

```bash
git add scripts/yahoo.ts scripts/lookups/yahoo-to-gics.json tests/yahoo.test.ts package.json package-lock.json
git commit -m "feat(yahoo): ticker→GICS sector/industry with mapping table"
```

### Task 2.3: Implement `classify-securities.ts` — orchestration

**Files:**
- Create: `scripts/classify-securities.ts`
- Create: `tests/classify-securities.test.ts`

**Why:** This is the orchestrator. For each new CUSIP it tries cache → OpenFIGI → Yahoo → manual fallback (which returns a "needs human" sentinel). The `/update-quarter` slash command consumes the sentinel to prompt the user.

- [ ] **Step 1: Write failing test**

```ts
// tests/classify-securities.test.ts
import { describe, it, expect, vi } from 'vitest';
import { classifyNewCusips } from '../scripts/classify-securities';

describe('classifyNewCusips', () => {
  it('returns cache hits unchanged and only resolves new CUSIPs', async () => {
    const cache = {
      '67066G104': {
        cusip: '67066G104', ticker: 'NVDA', name: 'NVIDIA',
        sector: 'Information Technology', industry: 'Semiconductors',
        ticker_source: 'openfigi', sector_source: 'yahoo-finance',
        classified_at: '2026-01-01T00:00:00Z',
      },
    };
    const lookupCusips = vi.fn();   // should not be called
    const lookupTicker = vi.fn();
    const result = await classifyNewCusips(['67066G104'], cache, {
      lookupCusips, lookupTickerSector: lookupTicker,
    });
    expect(lookupCusips).not.toHaveBeenCalled();
    expect(result.classified['67066G104']).toEqual(cache['67066G104']);
    expect(result.needsManual).toEqual([]);
  });

  it('resolves a new CUSIP via OpenFIGI + Yahoo and writes to cache', async () => {
    const cache = {};
    const lookupCusips = vi.fn(async () => ({
      '093712107': { ticker: 'BE', name: 'Bloom Energy Corp' },
    }));
    const lookupTickerSector = vi.fn(async () => ({
      sector: 'Industrials', industry: 'Electrical Equipment',
    }));

    const result = await classifyNewCusips(['093712107'], cache, {
      lookupCusips, lookupTickerSector,
    });

    expect(result.classified['093712107'].ticker).toBe('BE');
    expect(result.classified['093712107'].sector).toBe('Industrials');
    expect(result.classified['093712107'].industry).toBe('Electrical Equipment');
    expect(result.needsManual).toEqual([]);
  });

  it('flags CUSIPs that OpenFIGI cannot resolve as needsManual', async () => {
    const cache = {};
    const lookupCusips = vi.fn(async () => ({ 'BAD000000': null }));
    const lookupTickerSector = vi.fn();
    const result = await classifyNewCusips(['BAD000000'], cache, {
      lookupCusips, lookupTickerSector,
      issuerNames: { 'BAD000000': 'Mystery Corp' },
    });
    expect(result.needsManual).toEqual([{ cusip: 'BAD000000', issuer: 'Mystery Corp', reason: 'no-ticker' }]);
    expect(result.classified['BAD000000']).toBeUndefined();
  });

  it('flags CUSIPs where Yahoo returns no sector as needsManual', async () => {
    const cache = {};
    const lookupCusips = vi.fn(async () => ({ '093712107': { ticker: 'BE', name: 'Bloom' } }));
    const lookupTickerSector = vi.fn(async () => null);
    const result = await classifyNewCusips(['093712107'], cache, {
      lookupCusips, lookupTickerSector,
      issuerNames: { '093712107': 'BLOOM ENERGY CORP' },
    });
    expect(result.needsManual[0]).toMatchObject({ cusip: '093712107', reason: 'no-sector' });
    expect(result.classified['093712107']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

- [ ] **Step 3: Implement `scripts/classify-securities.ts`**

```ts
import type { CUSIP, SecuritiesFile, SecurityRecord } from './types.js';
import type { OpenFigiResult } from './openfigi.js';
import type { SectorIndustry } from './yahoo.js';

export interface ClassifyDeps {
  lookupCusips: (cusips: CUSIP[]) => Promise<Record<CUSIP, OpenFigiResult | null>>;
  lookupTickerSector: (ticker: string) => Promise<SectorIndustry | null>;
  /** Issuer names from the filing — used in manual-fallback prompts. */
  issuerNames?: Record<CUSIP, string>;
}

export interface ManualNeeded {
  cusip: CUSIP;
  issuer: string;
  reason: 'no-ticker' | 'no-sector';
  ticker?: string;          // present if ticker resolved but sector didn't
}

export interface ClassifyResult {
  classified: SecuritiesFile;
  needsManual: ManualNeeded[];
}

export async function classifyNewCusips(
  cusips: CUSIP[],
  cache: SecuritiesFile,
  deps: ClassifyDeps,
): Promise<ClassifyResult> {
  const out: ClassifyResult = { classified: {}, needsManual: [] };

  // Cache hits return immediately.
  const newCusips: CUSIP[] = [];
  for (const c of cusips) {
    if (cache[c]) {
      out.classified[c] = cache[c];
    } else {
      newCusips.push(c);
    }
  }
  if (newCusips.length === 0) return out;

  const figiResults = await deps.lookupCusips(newCusips);
  const issuerNames = deps.issuerNames ?? {};

  for (const cusip of newCusips) {
    const figi = figiResults[cusip];
    if (!figi) {
      out.needsManual.push({
        cusip, issuer: issuerNames[cusip] ?? cusip, reason: 'no-ticker',
      });
      continue;
    }
    const sector = await deps.lookupTickerSector(figi.ticker);
    if (!sector) {
      out.needsManual.push({
        cusip, issuer: issuerNames[cusip] ?? figi.name, reason: 'no-sector',
        ticker: figi.ticker,
      });
      continue;
    }
    const record: SecurityRecord = {
      cusip,
      ticker: figi.ticker,
      name: figi.name,
      sector: sector.sector,
      industry: sector.industry,
      ticker_source: 'openfigi',
      sector_source: 'yahoo-finance',
      classified_at: new Date().toISOString(),
    };
    out.classified[cusip] = record;
  }
  return out;
}
```

- [ ] **Step 4: Run tests (expect PASS)**
- [ ] **Step 5: Commit**

```bash
git add scripts/classify-securities.ts tests/classify-securities.test.ts
git commit -m "feat(classify): orchestrate cache→OpenFIGI→Yahoo→manual fallback"
```

### Task 2.4: CLI runner `run-classify-securities.ts`

**Files:**
- Create: `scripts/run-classify-securities.ts`
- Modify: `package.json`

**Why:** The `/update-quarter` slash command and the initial-data-load step both need to run classification across many CUSIPs at once. This wrapper loads `securities.json` and a target filing, runs `classifyNewCusips`, prints a report, and writes back the cache. CUSIPs needing manual review are printed for the user to address interactively.

- [ ] **Step 1: Implement**

```ts
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
```

- [ ] **Step 2: Add npm script**

In `package.json`:

```json
"scripts": { "classify": "tsx scripts/run-classify-securities.ts" }
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit scripts/run-classify-securities.ts
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-classify-securities.ts package.json
git commit -m "feat(classify): CLI runner for batch classification"
```

---

## Phase 3 — Diff computation

### Task 3.1: Implement `compute-diff.ts` — categorize movements

**Files:**
- Create: `scripts/compute-diff.ts`
- Create: `tests/compute-diff.test.ts`

**Why:** This computes the per-quarter diff that drives the page. Categorization rules:
- **NEW:** in current, not in prior
- **CLOSED:** in prior, not in current
- **INCREASED:** in both, current shares > prior shares
- **DECREASED:** in both, current shares < prior shares
- **UNCHANGED:** in both, shares equal (collapse to count + total value, not individual rows)

Position identity is `(cusip, title_of_class, put_call)` — same security with different classes/options is different positions.

- [ ] **Step 1: Write failing test**

```ts
// tests/compute-diff.test.ts
import { describe, it, expect } from 'vitest';
import { computeDiff } from '../scripts/compute-diff';
import type { FilingFile, SecuritiesFile, TagsFile } from '../scripts/types';

function pos(p: Partial<any>): any {
  return {
    cusip: 'X', name_of_issuer: 'X', title_of_class: 'COM',
    shares: 100, shares_type: 'SH', value: 1000, put_call: null,
    investment_discretion: 'SOLE', voting_sole: 0, voting_shared: 0, voting_none: 0,
    ...p,
  };
}
function filing(period: string, positions: any[], total?: number): FilingFile {
  return {
    slug: 'test', period, period_ending: '2025-12-31', filing_date: '2026-02-11',
    accession: '', edgar_url: '', value_units: 'USD', schema_version: 'X02',
    total_value: total ?? positions.reduce((s, p) => s + p.value, 0),
    position_count: positions.length, positions,
  };
}
const NO_SECURITIES: SecuritiesFile = {};
const NO_TAGS: TagsFile = { slug: 'test', taxonomy: [], assignments: {} };

describe('computeDiff — movement categorization', () => {
  it('categorizes NEW, CLOSED, INCREASED, DECREASED, UNCHANGED correctly', () => {
    const prior = filing('2025-Q3', [
      pos({ cusip: 'A', shares: 100, value: 1000 }),  // increased
      pos({ cusip: 'B', shares: 200, value: 2000 }),  // closed
      pos({ cusip: 'C', shares: 300, value: 3000 }),  // unchanged
      pos({ cusip: 'D', shares: 400, value: 4000 }),  // decreased
    ]);
    const current = filing('2025-Q4', [
      pos({ cusip: 'A', shares: 150, value: 1500 }),  // increased (+50%)
      pos({ cusip: 'C', shares: 300, value: 3300 }),  // unchanged shares (value drift OK)
      pos({ cusip: 'D', shares: 200, value: 2000 }),  // decreased (-50%)
      pos({ cusip: 'E', shares: 500, value: 5000 }),  // new
    ]);

    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });

    expect(diff.movements.new.map(r => r.cusip)).toEqual(['E']);
    expect(diff.movements.closed.map(r => r.cusip)).toEqual(['B']);
    expect(diff.movements.increased.map(r => r.cusip)).toEqual(['A']);
    expect(diff.movements.decreased.map(r => r.cusip)).toEqual(['D']);
    expect(diff.movements.unchanged_count).toBe(1);
  });

  it('treats different put_call as different positions', () => {
    const prior = filing('Q3', [pos({ cusip: 'X', put_call: null, shares: 100 })]);
    const current = filing('Q4', [
      pos({ cusip: 'X', put_call: null, shares: 100 }),       // unchanged
      pos({ cusip: 'X', put_call: 'Call', shares: 50 }),       // new
    ]);
    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.movements.new).toHaveLength(1);
    expect(diff.movements.new[0].cusip).toBe('X');
  });

  it('totals are computed correctly', () => {
    const prior = filing('Q3', [pos({ cusip: 'A', value: 1000 })], 1000);
    const current = filing('Q4', [pos({ cusip: 'A', value: 1500 })], 1500);
    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.totals).toEqual({ current_value: 1500, prior_value: 1000, net_flow: 500 });
  });
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Implement movements categorization in `scripts/compute-diff.ts`**

```ts
import type {
  FilingFile, Position, SecuritiesFile, TagsFile, MovementRow, DiffFile, Breakdown,
} from './types.js';

export interface ComputeDiffInput {
  current: FilingFile;
  prior: FilingFile | null;     // null = first filing
  securities: SecuritiesFile;
  tags: TagsFile;
}

function positionKey(p: Position): string {
  return `${p.cusip}|${p.title_of_class}|${p.put_call ?? ''}`;
}

function decoratedRow(
  cusip: string,
  curr: Position | undefined,
  prior: Position | undefined,
  securities: SecuritiesFile,
  tags: TagsFile,
  totalCurrent: number,
): MovementRow {
  const sec = securities[cusip];
  const cName = curr?.name_of_issuer ?? prior?.name_of_issuer ?? cusip;
  return {
    cusip,
    ticker: sec?.ticker ?? null,
    name: sec?.name ?? cName,
    sector: sec?.sector ?? 'Unclassified',
    industry: sec?.industry ?? 'Unclassified',
    tags: tags.assignments[cusip] ?? [],
    current_value: curr?.value ?? null,
    prior_value: prior?.value ?? null,
    current_shares: curr?.shares ?? null,
    prior_shares: prior?.shares ?? null,
    delta_value: (curr?.value ?? 0) - (prior?.value ?? 0),
    delta_shares: (curr?.shares ?? 0) - (prior?.shares ?? 0),
    delta_pct: prior && curr && prior.shares > 0
      ? ((curr.shares - prior.shares) / prior.shares) * 100
      : null,
    current_pct_of_portfolio: curr ? (curr.value / totalCurrent) * 100 : null,
  };
}

export function computeDiff(input: ComputeDiffInput): DiffFile {
  const { current, prior, securities, tags } = input;

  const movements = {
    new: [] as MovementRow[],
    closed: [] as MovementRow[],
    increased: [] as MovementRow[],
    decreased: [] as MovementRow[],
    unchanged_count: 0,
    unchanged_value: 0,
  };

  const currentMap = new Map<string, Position>();
  for (const p of current.positions) currentMap.set(positionKey(p), p);
  const priorMap = new Map<string, Position>();
  if (prior) for (const p of prior.positions) priorMap.set(positionKey(p), p);

  const seenInCurrent = new Set<string>();
  for (const [k, currPos] of currentMap.entries()) {
    seenInCurrent.add(k);
    const priorPos = priorMap.get(k);
    const row = decoratedRow(currPos.cusip, currPos, priorPos, securities, tags, current.total_value);
    if (!priorPos) {
      movements.new.push(row);
    } else if (currPos.shares > priorPos.shares) {
      movements.increased.push(row);
    } else if (currPos.shares < priorPos.shares) {
      movements.decreased.push(row);
    } else {
      movements.unchanged_count += 1;
      movements.unchanged_value += currPos.value;
    }
  }
  for (const [k, priorPos] of priorMap.entries()) {
    if (seenInCurrent.has(k)) continue;
    const row = decoratedRow(priorPos.cusip, undefined, priorPos, securities, tags, current.total_value);
    movements.closed.push(row);
  }

  // sort each bucket by absolute |delta_value| desc
  for (const bucket of ['new', 'closed', 'increased', 'decreased'] as const) {
    movements[bucket].sort((a, b) => Math.abs(b.delta_value) - Math.abs(a.delta_value));
  }

  return {
    slug: current.slug,
    current_period: current.period,
    prior_period: prior?.period ?? null,
    totals: {
      current_value: current.total_value,
      prior_value: prior?.total_value ?? 0,
      net_flow: current.total_value - (prior?.total_value ?? 0),
    },
    movements,
    sector_breakdown: emptyBreakdown(),    // filled in next task
    theme_breakdown: null,                  // filled in next task
  };
}

function emptyBreakdown(): Breakdown {
  return { current: [], prior: [], deltas: [] };
}
```

- [ ] **Step 4: Run tests (PASS)**

- [ ] **Step 5: Commit**

```bash
git add scripts/compute-diff.ts tests/compute-diff.test.ts
git commit -m "feat(diff): categorize NEW/CLOSED/INCREASED/DECREASED/UNCHANGED movements"
```

### Task 3.2: Compute sector breakdown deltas in `compute-diff.ts`

**Files:**
- Modify: `scripts/compute-diff.ts`
- Modify: `tests/compute-diff.test.ts`

**Why:** The sector delta bars on the page need both quarters' sector mixes plus the per-sector delta in percentage points (sorted by absolute magnitude).

- [ ] **Step 1: Add the failing test**

Append to `tests/compute-diff.test.ts`:

```ts
describe('computeDiff — sector breakdown', () => {
  it('produces current/prior sector mixes and pp deltas', () => {
    const securities: SecuritiesFile = {
      A: { cusip: 'A', ticker: 'A', name: 'A', sector: 'Information Technology',
           industry: '', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
           classified_at: '' },
      B: { cusip: 'B', ticker: 'B', name: 'B', sector: 'Utilities',
           industry: '', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
           classified_at: '' },
    };
    const prior = filing('Q3', [
      pos({ cusip: 'A', shares: 100, value: 800 }),
      pos({ cusip: 'B', shares: 100, value: 200 }),
    ]);
    const current = filing('Q4', [
      pos({ cusip: 'A', shares: 100, value: 600 }),
      pos({ cusip: 'B', shares: 100, value: 400 }),
    ]);
    const diff = computeDiff({ current, prior, securities, tags: NO_TAGS });

    const utilitiesNow = diff.sector_breakdown.current.find(s => s.label === 'Utilities')!;
    expect(utilitiesNow.pct).toBeCloseTo(40);
    const utilitiesDelta = diff.sector_breakdown.deltas.find(d => d.label === 'Utilities')!;
    expect(utilitiesDelta.delta_pct_pts).toBeCloseTo(20);   // 40 − 20
  });
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Replace the empty breakdowns in `compute-diff.ts` with real computation**

Replace the `sector_breakdown: emptyBreakdown()` line with `sector_breakdown: buildBreakdown(...)`. Add helper functions at the bottom of the file:

```ts
function buildBreakdown(
  current: FilingFile,
  prior: FilingFile | null,
  groupKey: (p: Position) => string,
): Breakdown {
  const currentMix = aggregate(current, groupKey);
  const priorMix = prior ? aggregate(prior, groupKey) : new Map<string, number>();
  const labels = new Set([...currentMix.keys(), ...priorMix.keys()]);

  const currentTotal = current.total_value || 1;
  const priorTotal = prior?.total_value || 1;

  const currentEntries: BreakdownEntry[] = [];
  const priorEntries: BreakdownEntry[] = [];
  const deltas: BreakdownDelta[] = [];

  for (const label of labels) {
    const cv = currentMix.get(label) ?? 0;
    const pv = priorMix.get(label) ?? 0;
    const cPct = (cv / currentTotal) * 100;
    const pPct = (pv / priorTotal) * 100;
    if (cv > 0) currentEntries.push({ label, value: cv, pct: cPct });
    if (pv > 0) priorEntries.push({ label, value: pv, pct: pPct });
    deltas.push({ label, delta_pct_pts: cPct - pPct });
  }

  currentEntries.sort((a, b) => b.value - a.value);
  priorEntries.sort((a, b) => b.value - a.value);
  deltas.sort((a, b) => Math.abs(b.delta_pct_pts) - Math.abs(a.delta_pct_pts));

  return { current: currentEntries, prior: priorEntries, deltas };
}

function aggregate(filing: FilingFile, key: (p: Position) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of filing.positions) {
    const k = key(p);
    out.set(k, (out.get(k) ?? 0) + p.value);
  }
  return out;
}
```

Update the `return` block of `computeDiff` to call `buildBreakdown`:

```ts
const sectorKey = (p: Position): string =>
  securities[p.cusip]?.sector ?? 'Unclassified';

return {
  // ...rest unchanged
  sector_breakdown: buildBreakdown(current, prior, sectorKey),
  theme_breakdown: null,
};
```

Add the import at the top: `import type { ..., BreakdownDelta, BreakdownEntry } from './types.js';`

- [ ] **Step 4: Run tests (PASS)**

- [ ] **Step 5: Commit**

```bash
git add scripts/compute-diff.ts tests/compute-diff.test.ts
git commit -m "feat(diff): compute sector breakdown current/prior/deltas"
```

### Task 3.3: Compute theme breakdown deltas

**Files:**
- Modify: `scripts/compute-diff.ts`
- Modify: `tests/compute-diff.test.ts`

**Why:** Theme breakdown uses the same `buildBreakdown` mechanic but groups by tag IDs (per-fund). One position can have multiple tags, so its value is replicated across each tag it carries (we surface this in the methodology footer — sum of theme percentages can exceed 100%).

- [ ] **Step 1: Add failing test**

```ts
describe('computeDiff — theme breakdown', () => {
  it('aggregates by tag IDs and replicates values across multi-tag positions', () => {
    const securities: SecuritiesFile = { /* not relevant for grouping */
      A: { cusip: 'A', ticker: 'A', name: 'A', sector: 'X', industry: '',
           ticker_source: 'openfigi', sector_source: 'yahoo-finance', classified_at: '' },
      B: { cusip: 'B', ticker: 'B', name: 'B', sector: 'Y', industry: '',
           ticker_source: 'openfigi', sector_source: 'yahoo-finance', classified_at: '' },
    };
    const tags: TagsFile = {
      slug: 'test',
      taxonomy: [
        { id: 'ai-compute', label: 'AI compute', description: '' },
        { id: 'ai-power', label: 'AI power', description: '' },
      ],
      assignments: { A: ['ai-compute', 'ai-power'], B: ['ai-power'] },
    };
    const current = filing('Q4', [
      pos({ cusip: 'A', value: 600 }), pos({ cusip: 'B', value: 400 }),
    ]);
    const prior = filing('Q3', [
      pos({ cusip: 'A', value: 200 }), pos({ cusip: 'B', value: 800 }),
    ]);
    const diff = computeDiff({ current, prior, securities, tags });
    expect(diff.theme_breakdown).not.toBeNull();
    const aiPower = diff.theme_breakdown!.current.find(e => e.label === 'AI power')!;
    expect(aiPower.value).toBe(1000); // both A and B count
  });

  it('returns null theme_breakdown when fund has no tags', () => {
    const current = filing('Q4', [pos({ cusip: 'A', value: 100 })]);
    const prior = filing('Q3', [pos({ cusip: 'A', value: 100 })]);
    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.theme_breakdown).toBeNull();
  });
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Modify `computeDiff` to compute theme_breakdown when tags exist**

Replace the `theme_breakdown: null` line with the computed value. Add helper:

```ts
function buildThemeBreakdown(
  current: FilingFile,
  prior: FilingFile | null,
  tags: TagsFile,
): Breakdown | null {
  if (tags.taxonomy.length === 0) return null;
  const labelById = new Map(tags.taxonomy.map(t => [t.id, t.label]));

  // For themes, expand each position into one entry per assigned tag.
  const expandedAggregate = (filing: FilingFile): Map<string, number> => {
    const out = new Map<string, number>();
    for (const p of filing.positions) {
      const ids = tags.assignments[p.cusip] ?? [];
      for (const id of ids) {
        const label = labelById.get(id);
        if (!label) continue;
        out.set(label, (out.get(label) ?? 0) + p.value);
      }
    }
    return out;
  };

  const currentMix = expandedAggregate(current);
  const priorMix = prior ? expandedAggregate(prior) : new Map();
  const labels = new Set([...currentMix.keys(), ...priorMix.keys()]);

  const currentTotal = current.total_value || 1;
  const priorTotal = prior?.total_value || 1;

  const currentEntries: BreakdownEntry[] = [];
  const priorEntries: BreakdownEntry[] = [];
  const deltas: BreakdownDelta[] = [];
  for (const label of labels) {
    const cv = currentMix.get(label) ?? 0;
    const pv = priorMix.get(label) ?? 0;
    const cPct = (cv / currentTotal) * 100;
    const pPct = (pv / priorTotal) * 100;
    if (cv > 0) currentEntries.push({ label, value: cv, pct: cPct });
    if (pv > 0) priorEntries.push({ label, value: pv, pct: pPct });
    deltas.push({ label, delta_pct_pts: cPct - pPct });
  }
  currentEntries.sort((a, b) => b.value - a.value);
  priorEntries.sort((a, b) => b.value - a.value);
  deltas.sort((a, b) => Math.abs(b.delta_pct_pts) - Math.abs(a.delta_pct_pts));
  return { current: currentEntries, prior: priorEntries, deltas };
}
```

Wire it in the return:

```ts
theme_breakdown: buildThemeBreakdown(current, prior, tags),
```

- [ ] **Step 4: Run (PASS)**

- [ ] **Step 5: Commit**

```bash
git add scripts/compute-diff.ts tests/compute-diff.test.ts
git commit -m "feat(diff): compute theme breakdown with multi-tag value replication"
```

### Task 3.4: Handle the first-filing edge case in `compute-diff.ts`

**Files:**
- Modify: `tests/compute-diff.test.ts`

**Why:** When a fund has no prior quarter, the diff should still produce a valid object: all current positions show as `NEW`, no closed/increased/decreased, no breakdowns of "deltas" (only `current` is populated; `prior` is empty).

- [ ] **Step 1: Add the test (the implementation already supports this via `prior: null`, but the test confirms)**

```ts
describe('computeDiff — first filing', () => {
  it('treats every position as NEW and produces no prior breakdowns', () => {
    const current = filing('Q4', [pos({ cusip: 'A', value: 100 })]);
    const diff = computeDiff({ current, prior: null, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.prior_period).toBeNull();
    expect(diff.movements.new).toHaveLength(1);
    expect(diff.movements.closed).toHaveLength(0);
    expect(diff.movements.increased).toHaveLength(0);
    expect(diff.movements.decreased).toHaveLength(0);
    expect(diff.sector_breakdown.prior).toEqual([]);
    expect(diff.totals.prior_value).toBe(0);
  });
});
```

- [ ] **Step 2: Run (PASS — implementation already handles)**

- [ ] **Step 3: Commit**

```bash
git add tests/compute-diff.test.ts
git commit -m "test(diff): cover first-filing (no prior) edge case"
```

---

## Phase 4 — Validation

### Task 4.1: Implement `validate-data.ts`

**Files:**
- Create: `scripts/validate-data.ts`
- Create: `tests/validate-data.test.ts`

**Why:** A pre-commit gate that catches data-shape problems early. Run before every commit and in CI.

- [ ] **Step 1: Add Zod for runtime schema validation**

```bash
npm install zod
```

- [ ] **Step 2: Write tests against synthetic data**

```ts
// tests/validate-data.test.ts
import { describe, it, expect } from 'vitest';
import { validateAll } from '../scripts/validate-data';

describe('validateAll', () => {
  it('passes on a minimal valid dataset', () => {
    const dataset = {
      funds: [{
        slug: 'x', name: 'X', manager_name: 'X', cik: '0000000001',
        location: 'X', description: 'X', added: '2026-01-01', active: true,
      }],
      securities: {},
      pending: { pending: [] },
      perFund: {
        x: {
          quarters: { slug: 'x', quarters: [] },
          tags: { slug: 'x', taxonomy: [], assignments: {} },
          quarterFiles: {},
          diffFiles: {},
        },
      },
    };
    const result = validateAll(dataset);
    expect(result.errors).toEqual([]);
  });

  it('reports a slug mismatch in quarters.json', () => {
    const dataset = {
      funds: [{ slug: 'x', name: 'X', manager_name: 'X', cik: '0000000001',
                location: 'X', description: 'X', added: '2026-01-01', active: true }],
      securities: {},
      pending: { pending: [] },
      perFund: {
        x: {
          quarters: { slug: 'WRONG', quarters: [] },
          tags: { slug: 'x', taxonomy: [], assignments: {} },
          quarterFiles: {},
          diffFiles: {},
        },
      },
    };
    expect(validateAll(dataset).errors[0]).toMatch(/slug mismatch/i);
  });

  it('rejects a CUSIP that is not 9 chars', () => {
    const dataset = {
      funds: [{ slug: 'x', name: 'X', manager_name: 'X', cik: '0000000001',
                location: 'X', description: 'X', added: '2026-01-01', active: true }],
      securities: { 'TOOLONG12345': {
        cusip: 'TOOLONG12345', ticker: 'X', name: 'X', sector: 'Information Technology',
        industry: 'X', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
        classified_at: '2026-01-01T00:00:00Z',
      }},
      pending: { pending: [] },
      perFund: {
        x: { quarters: { slug: 'x', quarters: [] }, tags: { slug: 'x', taxonomy: [], assignments: {} },
             quarterFiles: {}, diffFiles: {} },
      },
    };
    expect(validateAll(dataset).errors[0]).toMatch(/cusip/i);
  });
});
```

- [ ] **Step 3: Run (FAIL)**

- [ ] **Step 4: Implement `scripts/validate-data.ts`**

```ts
import { z } from 'zod';
import type { FundsFile, SecuritiesFile, PendingFile, QuartersFile, TagsFile, FilingFile, DiffFile } from './types.js';

const fundSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  manager_name: z.string(),
  cik: z.string().regex(/^\d{10}$/),
  location: z.string(),
  description: z.string(),
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean(),
});

const cusipRegex = /^[A-Z0-9]{9}$/;

const securityRecordSchema = z.object({
  cusip: z.string().regex(cusipRegex),
  ticker: z.string().nullable(),
  name: z.string(),
  sector: z.string(),
  industry: z.string(),
  ticker_source: z.enum(['openfigi', 'edgar-tickers', 'manual-override']),
  sector_source: z.enum(['yahoo-finance', 'finnhub', 'manual-override']),
  manual_override_reason: z.string().optional(),
  classified_at: z.string(),
});

export interface DatasetForValidation {
  funds: FundsFile[];
  securities: SecuritiesFile;
  pending: PendingFile;
  perFund: Record<string, {
    quarters: QuartersFile;
    tags: TagsFile;
    quarterFiles: Record<string, FilingFile>;
    diffFiles: Record<string, DiffFile>;
  }>;
}

export function validateAll(d: DatasetForValidation): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // funds.json
  const slugs = new Set<string>();
  const ciks = new Set<string>();
  for (const f of d.funds) {
    const r = fundSchema.safeParse(f);
    if (!r.success) errors.push(`funds.json: ${r.error.message}`);
    if (slugs.has(f.slug)) errors.push(`funds.json: duplicate slug ${f.slug}`);
    if (ciks.has(f.cik)) errors.push(`funds.json: duplicate cik ${f.cik}`);
    slugs.add(f.slug); ciks.add(f.cik);
  }

  // securities.json
  for (const [k, v] of Object.entries(d.securities)) {
    if (!cusipRegex.test(k)) errors.push(`securities.json: bad CUSIP key ${k}`);
    const r = securityRecordSchema.safeParse(v);
    if (!r.success) errors.push(`securities.json[${k}]: ${r.error.message}`);
  }

  // per-fund
  for (const [slug, pf] of Object.entries(d.perFund)) {
    if (pf.quarters.slug !== slug) errors.push(`${slug}/quarters.json: slug mismatch`);
    if (pf.tags.slug !== slug) errors.push(`${slug}/tags.json: slug mismatch`);

    // taxonomy ID coverage
    const taxonomyIds = new Set(pf.tags.taxonomy.map(t => t.id));
    for (const [cusip, ids] of Object.entries(pf.tags.assignments)) {
      for (const id of ids) {
        if (!taxonomyIds.has(id)) errors.push(`${slug}/tags.json: assignment ${cusip} references unknown tag ${id}`);
      }
    }

    // orphan tag assignments — every tagged CUSIP should appear in at least one quarter
    const allCusips = new Set<string>();
    for (const file of Object.values(pf.quarterFiles)) {
      for (const p of file.positions) allCusips.add(p.cusip);
    }
    for (const cusip of Object.keys(pf.tags.assignments)) {
      if (!allCusips.has(cusip)) {
        warnings.push(`${slug}/tags.json: ${cusip} has tags but no holdings`);
      }
    }
  }

  // pending.json
  if (!Array.isArray(d.pending.pending)) errors.push('_pending.json: pending must be an array');

  return { errors, warnings };
}
```

- [ ] **Step 5: Run tests (PASS)**

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-data.ts tests/validate-data.test.ts package.json package-lock.json
git commit -m "feat(validate): zod-based schema and integrity checks"
```

### Task 4.2: Add a CLI runner for `validate-data` and wire to npm

**Files:**
- Create: `scripts/run-validate.ts`
- Modify: `package.json`

**Why:** `validate-data.ts` exposes a pure function. The CLI runner reads files from disk and invokes it. Wired to `npm run validate` so devs and CI can run it.

- [ ] **Step 1: Create the CLI runner**

```ts
// scripts/run-validate.ts
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
      const quarterFiles: Record<string, any> = {};
      const diffFiles: Record<string, any> = {};
      for (const file of readdirSync(dir)) {
        if (file === 'quarters.json' || file === 'tags.json') continue;
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
      perFund[slug] = { quarters, tags, quarterFiles, diffFiles };
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
```

- [ ] **Step 2: Add npm script**

In `package.json`:

```json
{
  "scripts": {
    "validate": "tsx scripts/run-validate.ts"
  }
}
```

- [ ] **Step 3: Install `tsx` for running TypeScript directly**

```bash
npm install --save-dev tsx
```

- [ ] **Step 4: Run it on the seeded data**

```bash
npm run validate
```

Expected: `ok — 2 funds, 0 securities`.

- [ ] **Step 5: Commit**

```bash
git add scripts/run-validate.ts package.json package-lock.json
git commit -m "feat(validate): CLI runner wired to npm run validate"
```

---

## Phase 5 — UI: components

### Task 5.1: `lib/data.ts` — JSON loaders

**Files:**
- Create: `src/lib/data.ts`

**Why:** Astro pages and components need to load the data files at build time. Centralized loaders keep import paths consistent and types attached.

- [ ] **Step 1: Implement**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat(ui-lib): JSON data loaders for build-time SSG"
```

### Task 5.2: `lib/format.ts` — formatters

**Files:**
- Create: `src/lib/format.ts`
- Create: `tests/format.test.ts`

**Why:** Currency, share counts, and percent deltas appear all over the UI. Centralized formatters give consistency.

- [ ] **Step 1: Failing tests**

```ts
// tests/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatUSD, formatPct, formatPctDelta, formatShares, formatPeriod } from '../src/lib/format';

describe('formatters', () => {
  it('formatUSD renders compact ($420M, $1.2B, $5.5B)', () => {
    expect(formatUSD(420_000_000)).toBe('$420M');
    expect(formatUSD(1_200_000_000)).toBe('$1.2B');
    expect(formatUSD(5_516_758_344)).toBe('$5.5B');
    expect(formatUSD(800_000)).toBe('$800K');
  });
  it('formatPct rounds to 1 decimal', () => {
    expect(formatPct(17.456)).toBe('17.5%');
  });
  it('formatPctDelta shows sign and pp', () => {
    expect(formatPctDelta(8)).toBe('+8 pp');
    expect(formatPctDelta(-6)).toBe('−6 pp');   // U+2212
    expect(formatPctDelta(0)).toBe('0 pp');
  });
  it('formatShares uses thousands separators', () => {
    expect(formatShares(2_400_000)).toBe('2,400,000');
  });
  it('formatPeriod renders 2025-Q4 as "Q4 2025"', () => {
    expect(formatPeriod('2025-Q4')).toBe('Q4 2025');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/lib/format.ts
export function formatUSD(usd: number): string {
  const abs = Math.abs(usd);
  if (abs >= 1e9) return `$${(usd / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}
export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}
export function formatPctDelta(delta: number): string {
  if (delta === 0) return '0 pp';
  if (delta > 0) return `+${delta.toFixed(0)} pp`;
  return `−${Math.abs(delta).toFixed(0)} pp`;  // U+2212 minus
}
export function formatShares(n: number): string {
  return n.toLocaleString('en-US');
}
export function formatPeriod(period: string): string {
  // "2025-Q4" → "Q4 2025"
  const [year, q] = period.split('-');
  return `${q} ${year}`;
}
```

- [ ] **Step 3: Run tests (PASS), commit**

```bash
git add src/lib/format.ts tests/format.test.ts
git commit -m "feat(ui-lib): formatters for currency, pct, deltas, shares, periods"
```

### Task 5.3: `FundHeader.astro`

**Files:**
- Create: `src/components/FundHeader.astro`

**Why:** Shows fund identity and the current filing snapshot at the top of the per-fund page.

- [ ] **Step 1: Implement**

```astro
---
// src/components/FundHeader.astro
import { formatUSD, formatPeriod } from '../lib/format';
import type { FundsFile, QuarterEntry } from '../../scripts/types';

interface Props {
  fund: FundsFile;
  quarter: QuarterEntry;
  priorPeriod: string | null;
}

const { fund, quarter, priorPeriod } = Astro.props;
---
<header class="fund-header">
  <div class="row">
    <h1>{fund.name}</h1>
    <span class="meta">
      {formatPeriod(quarter.period)} · filed {quarter.filing_date} ·
      <a href={quarter.edgar_url} target="_blank" rel="noopener">SEC 13F-HR ↗</a>
    </span>
  </div>
  <div class="row stats">
    <span><strong>{formatUSD(quarter.total_value)}</strong> reported</span>
    <span><strong>{quarter.position_count}</strong> positions</span>
    <span class="manager">{fund.manager_name}</span>
    {priorPeriod && <span class="versus">vs. {formatPeriod(priorPeriod)}</span>}
  </div>
</header>

<style>
  .fund-header { border-bottom: 1px solid #ddd; padding-bottom: 12px; margin-bottom: 20px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  h1 { margin: 0; font-size: 1.4rem; }
  .meta { color: #666; font-size: 0.85rem; }
  .stats { margin-top: 8px; gap: 24px; color: #444; font-size: 0.9rem; }
  .manager, .versus { color: #888; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FundHeader.astro
git commit -m "feat(ui): FundHeader component"
```

### Task 5.4: `ChangeHero.astro`

**Files:**
- Create: `src/components/ChangeHero.astro`

**Why:** The single most important section of the per-fund page — the editorial summary plus the four diff counts.

- [ ] **Step 1: Implement**

```astro
---
// src/components/ChangeHero.astro
import { formatUSD } from '../lib/format';
import type { DiffFile } from '../../scripts/types';

interface Props {
  diff: DiffFile;
  summary: string;
}
const { diff, summary } = Astro.props;
const m = diff.movements;
const netFlow = diff.totals.net_flow;
const flowSign = netFlow >= 0 ? '+' : '−';
---
{diff.prior_period === null ? (
  <section class="hero first-filing">
    <p class="banner">First filing on record — no prior-quarter comparison available yet.</p>
  </section>
) : (
  <section class="hero">
    <div class="label">What changed this quarter</div>
    <p class="summary">{summary}</p>
    <div class="counts">
      <span><strong class="up">+{m.new.length}</strong> new</span>
      <span><strong class="down">−{m.closed.length}</strong> closed</span>
      <span><strong class="up">↑{m.increased.length}</strong> increased</span>
      <span><strong class="down">↓{m.decreased.length}</strong> decreased</span>
      <span class="muted">| {m.unchanged_count} unchanged</span>
      <span class="net">net {flowSign}{formatUSD(Math.abs(netFlow))}</span>
    </div>
  </section>
)}

<style>
  .hero { background: #f7f5f0; border-left: 4px solid #c47c4a; padding: 14px 16px; margin-bottom: 18px; border-radius: 0 4px 4px 0; }
  .first-filing { background: #fafafa; border-left-color: #aaa; }
  .label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .summary { font-size: 1rem; line-height: 1.4; margin: 0 0 10px; }
  .counts { display: flex; gap: 18px; font-size: 0.9rem; color: #444; flex-wrap: wrap; }
  .up { color: #2d8a3e; }
  .down { color: #b33; }
  .muted { color: #888; }
  .net { font-weight: 600; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChangeHero.astro
git commit -m "feat(ui): ChangeHero component with first-filing fallback"
```

### Task 5.5: `SectorDeltaBars.astro` (also reused for theme)

**Files:**
- Create: `src/components/SectorDeltaBars.astro`

**Why:** A diverging bar chart showing only the deltas in pp. Bar going right = sector grew; left = shrank. Used for both Sector and Theme breakdowns (one component, props differ).

- [ ] **Step 1: Implement**

```astro
---
// src/components/SectorDeltaBars.astro
import { formatPctDelta } from '../lib/format';
import type { Breakdown } from '../../scripts/types';

interface Props {
  title: string;
  breakdown: Breakdown;
  /** Optional: limit to top-N by absolute delta. Default 8. */
  limit?: number;
}
const { title, breakdown, limit = 8 } = Astro.props;
const rows = breakdown.deltas.slice(0, limit);
const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.delta_pct_pts)), 0) || 1;
---
<section class="delta-panel">
  <div class="label">{title}</div>
  {rows.length === 0 ? (
    <p class="empty">No changes between quarters.</p>
  ) : (
    <div class="bars">
      {rows.map((row) => {
        const widthPct = (Math.abs(row.delta_pct_pts) / max) * 50;
        const isPositive = row.delta_pct_pts >= 0;
        return (
          <div class="bar-row">
            <div class="row-label">{row.label}</div>
            <div class="bar-track">
              <div
                class={`bar ${isPositive ? 'pos' : 'neg'}`}
                style={`width:${widthPct}%; ${isPositive ? 'left' : 'right'}: 50%;`}
              />
            </div>
            <div class={`row-value ${isPositive ? 'pos' : 'neg'}`}>
              {formatPctDelta(row.delta_pct_pts)}
            </div>
          </div>
        );
      })}
      <div class="centerline-note">center line = no change</div>
    </div>
  )}
</section>

<style>
  .delta-panel { border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px; }
  .label { font-size: 0.7rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .bars { font-size: 0.8rem; }
  .bar-row { display: grid; grid-template-columns: 130px 1fr 50px; align-items: center; margin-bottom: 4px; }
  .row-label { text-align: right; padding-right: 8px; color: #444; }
  .bar-track { position: relative; height: 14px; }
  .bar-track::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1px solid #ccc; }
  .bar { position: absolute; height: 14px; top: 0; }
  .bar.pos { background: #2d8a3e; }
  .bar.neg { background: #b33; }
  .row-value.pos { color: #2d8a3e; font-weight: 600; }
  .row-value.neg { color: #b33; font-weight: 600; }
  .centerline-note { font-size: 0.65rem; color: #aaa; text-align: center; margin-top: 6px; }
  .empty { color: #aaa; font-size: 0.8rem; font-style: italic; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SectorDeltaBars.astro
git commit -m "feat(ui): diverging delta-bars component (used for sector and theme)"
```

### Task 5.6: `MovementTable.astro`

**Files:**
- Create: `src/components/MovementTable.astro`

**Why:** Renders one of the four movement buckets (NEW / INCREASED / DECREASED / CLOSED). Same component, different rows.

- [ ] **Step 1: Implement**

```astro
---
// src/components/MovementTable.astro
import { formatUSD, formatPct } from '../lib/format';
import type { MovementRow } from '../../scripts/types';

interface Props {
  status: 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED';
  rows: MovementRow[];
}
const { status, rows } = Astro.props;
const styles = {
  NEW: { color: '#2d8a3e', bg: '#e8f4ec', label: 'NEW POSITIONS' },
  INCREASED: { color: '#2d8a3e', bg: '#f0f8f3', label: '↑ INCREASED' },
  DECREASED: { color: '#b33', bg: '#fff5f5', label: '↓ DECREASED' },
  CLOSED: { color: '#b33', bg: '#fde8e8', label: 'CLOSED' },
}[status];

const totalDelta = rows.reduce((s, r) => s + r.delta_value, 0);
const summaryText =
  status === 'NEW' ? `+${formatUSD(totalDelta)} deployed` :
  status === 'CLOSED' ? `${formatUSD(Math.abs(totalDelta))} exited` :
  status === 'INCREASED' ? `+${formatUSD(totalDelta)} added` :
  `${formatUSD(Math.abs(totalDelta))} trimmed`;
---
{rows.length === 0 ? null : (
  <section class="movement">
    <header style={`background:${styles.bg};color:${styles.color};`}>
      <span>{styles.label} ({rows.length})</span>
      <span class="net">{summaryText}</span>
    </header>
    <table>
      <tbody>
        {rows.map((r) => (
          <tr>
            <td><strong>{r.ticker ?? r.cusip}</strong></td>
            <td>{r.name}</td>
            <td class="muted">{r.sector} / {r.industry}</td>
            <td class="muted">{r.tags.join(', ')}</td>
            <td class="num">
              {status === 'NEW' && r.current_value !== null && formatUSD(r.current_value)}
              {status === 'CLOSED' && r.prior_value !== null && `was ${formatUSD(r.prior_value)}`}
              {(status === 'INCREASED' || status === 'DECREASED') && r.delta_pct !== null &&
                `${r.delta_pct > 0 ? '+' : ''}${formatPct(r.delta_pct)}`}
            </td>
            <td class="num" style={`color:${styles.color}`}>
              {status === 'NEW' && 'NEW'}
              {status === 'CLOSED' && 'CLOSED'}
              {status === 'INCREASED' && `+${formatUSD(r.delta_value)}`}
              {status === 'DECREASED' && `−${formatUSD(Math.abs(r.delta_value))}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}

<style>
  .movement { border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px; overflow: hidden; }
  header { padding: 6px 10px; font-size: 0.7rem; font-weight: 600; display: flex; justify-content: space-between; }
  header .net { color: #555; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  tr { border-bottom: 1px solid #f5f5f5; }
  tr:last-child { border-bottom: none; }
  td { padding: 5px 10px; }
  td.num { text-align: right; }
  td.muted { color: #888; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MovementTable.astro
git commit -m "feat(ui): MovementTable for the four diff buckets"
```

### Task 5.7: `HoldingsTable.astro` (collapsed by default)

**Files:**
- Create: `src/components/HoldingsTable.astro`

**Why:** Shows the held-steady positions when expanded. Hidden behind a `<details>` element by default.

- [ ] **Step 1: Implement**

```astro
---
// src/components/HoldingsTable.astro
import { formatUSD, formatShares, formatPct } from '../lib/format';
import type { FilingFile, SecuritiesFile, TagsFile } from '../../scripts/types';

interface Props {
  filing: FilingFile;
  securities: SecuritiesFile;
  tags: TagsFile;
  unchangedOnly: boolean;
  unchangedCusips?: Set<string>;   // when unchangedOnly is true
}
const { filing, securities, tags, unchangedOnly, unchangedCusips } = Astro.props;
const positions = unchangedOnly && unchangedCusips
  ? filing.positions.filter(p => unchangedCusips.has(p.cusip))
  : filing.positions;
const total = filing.total_value || 1;
const totalUnchanged = positions.reduce((s, p) => s + p.value, 0);
---
<details>
  <summary>
    <strong>{positions.length} positions held steady</strong>
    · {formatUSD(totalUnchanged)} ({formatPct((totalUnchanged / total) * 100)} of AUM)
    <span class="hint">click to expand</span>
  </summary>
  <table>
    <thead>
      <tr>
        <th>Ticker</th><th>Name</th><th>Sector</th>
        <th class="num">Shares</th><th class="num">Value</th><th class="num">% port</th>
      </tr>
    </thead>
    <tbody>
      {positions.map((p) => {
        const sec = securities[p.cusip];
        return (
          <tr>
            <td><strong>{sec?.ticker ?? p.cusip}</strong></td>
            <td>{sec?.name ?? p.name_of_issuer}</td>
            <td class="muted">{sec?.sector ?? '—'}</td>
            <td class="num">{formatShares(p.shares)}</td>
            <td class="num">{formatUSD(p.value)}</td>
            <td class="num">{formatPct((p.value / total) * 100)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</details>

<style>
  details { border: 1px dashed #ccc; border-radius: 4px; padding: 10px; margin-bottom: 12px; }
  summary { cursor: pointer; font-size: 0.8rem; color: #555; }
  .hint { color: #aaa; font-style: italic; margin-left: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 10px; }
  th { text-align: left; padding: 6px 8px; font-weight: 500; color: #555; border-bottom: 1px solid #ccc; }
  td { padding: 5px 8px; border-bottom: 1px solid #f5f5f5; }
  td.num, th.num { text-align: right; }
  td.muted { color: #888; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HoldingsTable.astro
git commit -m "feat(ui): HoldingsTable behind details/summary fold"
```

### Task 5.8: `ContactCTA.astro`

**Files:**
- Create: `src/components/ContactCTA.astro`

**Why:** The "Want a fund added?" call-to-action. Reused on the homepage and the about page.

- [ ] **Step 1: Implement**

```astro
---
// src/components/ContactCTA.astro
---
<aside class="cta">
  <p>
    Want a fund added?
    <a href="mailto:seanfkelley1@gmail.com?subject=13f-changes%20fund%20request">
      Email seanfkelley1@gmail.com
    </a>
  </p>
</aside>

<style>
  .cta { border: 1px solid #e0e0e0; border-radius: 4px; padding: 14px; text-align: center; margin: 32px 0; background: #fafafa; }
  .cta p { margin: 0; font-size: 0.95rem; color: #555; }
  .cta a { color: #4a7ec7; text-decoration: none; }
  .cta a:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContactCTA.astro
git commit -m "feat(ui): ContactCTA — \"want a fund added?\" email link"
```

---

## Phase 6 — UI: pages

### Task 6.1: Per-fund detail page

**Files:**
- Create: `src/pages/funds/[slug].astro`

**Why:** The core route. Wires together all the components driven by the loaded data.

- [ ] **Step 1: Implement**

```astro
---
// src/pages/funds/[slug].astro
import FundHeader from '../../components/FundHeader.astro';
import ChangeHero from '../../components/ChangeHero.astro';
import SectorDeltaBars from '../../components/SectorDeltaBars.astro';
import MovementTable from '../../components/MovementTable.astro';
import HoldingsTable from '../../components/HoldingsTable.astro';
import ContactCTA from '../../components/ContactCTA.astro';
import {
  loadFunds, loadFundQuarters, loadFiling, loadDiff, loadSecurities, loadFundTags,
} from '../../lib/data';

export async function getStaticPaths() {
  const funds = loadFunds();
  return funds.map(fund => ({ params: { slug: fund.slug }, props: { fund } }));
}

const { slug } = Astro.params;
const { fund } = Astro.props;

const quartersFile = loadFundQuarters(slug!);
const currentQuarter = quartersFile.quarters[0];
const priorQuarter = quartersFile.quarters[1] ?? null;

if (!currentQuarter) {
  return Astro.redirect('/');
}

const filing = loadFiling(slug!, currentQuarter.period);
const diff = loadDiff(slug!, currentQuarter.period);
const securities = loadSecurities();
const tags = loadFundTags(slug!);

if (!filing || !diff) {
  throw new Error(`Missing filing or diff for ${slug} ${currentQuarter.period}`);
}

const unchangedCusips = new Set<string>();
const inDiff = new Set([
  ...diff.movements.new.map(r => r.cusip),
  ...diff.movements.closed.map(r => r.cusip),
  ...diff.movements.increased.map(r => r.cusip),
  ...diff.movements.decreased.map(r => r.cusip),
]);
for (const p of filing.positions) {
  if (!inDiff.has(p.cusip)) unchangedCusips.add(p.cusip);
}
---
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fund.name} — 13f-changes</title>
    <link rel="stylesheet" href="/global.css" />
  </head>
  <body>
    <main class="container">
      <nav class="topnav"><a href="/">← All funds</a></nav>
      <FundHeader fund={fund} quarter={currentQuarter} priorPeriod={priorQuarter?.period ?? null} />
      <ChangeHero diff={diff} summary={currentQuarter.summary} />

      {diff.prior_period && (
        <div class="breakdown-grid">
          <SectorDeltaBars title="Sector shifts" breakdown={diff.sector_breakdown} />
          {diff.theme_breakdown && (
            <SectorDeltaBars title="Theme shifts" breakdown={diff.theme_breakdown} />
          )}
        </div>
      )}

      {diff.prior_period && (
        <section class="movements">
          <div class="section-label">Position movements</div>
          <MovementTable status="NEW" rows={diff.movements.new} />
          <MovementTable status="INCREASED" rows={diff.movements.increased} />
          <MovementTable status="DECREASED" rows={diff.movements.decreased} />
          <MovementTable status="CLOSED" rows={diff.movements.closed} />
        </section>
      )}

      <HoldingsTable
        filing={filing}
        securities={securities}
        tags={tags}
        unchangedOnly={diff.prior_period !== null}
        unchangedCusips={unchangedCusips}
      />

      <footer class="methodology">
        <strong>Methodology:</strong> Data from SEC 13F-HR filings. GICS sector/industry via OpenFIGI + Yahoo Finance. Themes assigned editorially per-fund. <a href="/about">More →</a>
      </footer>

      <ContactCTA />
    </main>
  </body>
</html>

<style>
  .container { max-width: 960px; margin: 0 auto; padding: 24px 20px; font-family: system-ui, sans-serif; color: #222; }
  .topnav { font-size: 0.85rem; margin-bottom: 16px; }
  .topnav a { color: #4a7ec7; text-decoration: none; }
  .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .section-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .movements { margin-bottom: 20px; }
  .methodology { font-size: 0.75rem; color: #777; line-height: 1.5; padding-top: 12px; border-top: 1px solid #eee; margin-top: 24px; }
  @media (max-width: 700px) {
    .breakdown-grid { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: build succeeds. There won't be actual fund detail pages rendered yet because `quarters` is empty in the seeded data — Astro will warn that `getStaticPaths` returned paths for funds with no quarter data. That's OK; once the initial data load runs, the pages render.

- [ ] **Step 3: Commit**

```bash
git add src/pages/funds/[slug].astro
git commit -m "feat(ui): per-fund detail page wiring all components"
```

### Task 6.2: Homepage (multi-fund index)

**Files:**
- Create: `src/pages/index.astro`

**Why:** Lands at `/`. HedgeFollow-style table — one row per fund, top-3 changes inline.

- [ ] **Step 1: Implement**

```astro
---
// src/pages/index.astro
import { loadFunds, loadFundQuarters, loadDiff } from '../lib/data';
import { formatUSD, formatPeriod } from '../lib/format';
import ContactCTA from '../components/ContactCTA.astro';

const funds = loadFunds();

interface FundRow {
  slug: string;
  name: string;
  manager: string;
  aum: string | null;
  positions: number | null;
  period: string | null;
  filingDate: string | null;
  topChanges: { ticker: string; status: string }[];
}

const rows: FundRow[] = funds.map((fund) => {
  const q = loadFundQuarters(fund.slug);
  const latest = q.quarters[0];
  if (!latest) {
    return { slug: fund.slug, name: fund.name, manager: fund.manager_name,
             aum: null, positions: null, period: null, filingDate: null, topChanges: [] };
  }
  const diff = loadDiff(fund.slug, latest.period);
  const top: { ticker: string; status: string }[] = [];
  if (diff && diff.prior_period) {
    const buckets = [
      ...diff.movements.new.map(r => ({ ticker: r.ticker ?? r.cusip, status: 'NEW' })),
      ...diff.movements.increased.slice(0, 1).map(r => ({ ticker: r.ticker ?? r.cusip, status: '↑' })),
      ...diff.movements.closed.slice(0, 1).map(r => ({ ticker: r.ticker ?? r.cusip, status: 'X' })),
    ];
    top.push(...buckets.slice(0, 3));
  }
  return {
    slug: fund.slug,
    name: fund.name,
    manager: fund.manager_name,
    aum: formatUSD(latest.total_value),
    positions: latest.position_count,
    period: formatPeriod(latest.period),
    filingDate: latest.filing_date,
    topChanges: top,
  };
});
---
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>13f-changes — quarter-over-quarter changes in hedge fund 13F filings</title>
    <link rel="stylesheet" href="/global.css" />
  </head>
  <body>
    <main class="container">
      <header class="site-header">
        <h1>13f-changes</h1>
        <p class="tagline">Tracking quarter-over-quarter changes in hedge fund 13F filings.</p>
      </header>

      <table class="funds-table">
        <thead>
          <tr>
            <th>Fund</th><th>Manager</th>
            <th class="num">AUM</th><th class="num">Positions</th>
            <th>Latest filing</th><th>Top changes</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr>
              <td><a href={`/funds/${row.slug}`}><strong>{row.name}</strong></a></td>
              <td>{row.manager}</td>
              <td class="num">{row.aum ?? '—'}</td>
              <td class="num">{row.positions ?? '—'}</td>
              <td>
                {row.period ? <>{row.period} <span class="muted">({row.filingDate})</span></> : 'No filings yet'}
              </td>
              <td>
                {row.topChanges.length === 0 ? '—' :
                  row.topChanges.map(c => <span class="chip">{c.status} {c.ticker}</span>)}
              </td>
              <td><a href={`/funds/${row.slug}`} class="row-link">→</a></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ContactCTA />

      <footer class="site-footer">
        <a href="/about">About / methodology</a>
      </footer>
    </main>
  </body>
</html>

<style>
  .container { max-width: 1100px; margin: 0 auto; padding: 24px 20px; font-family: system-ui, sans-serif; color: #222; }
  .site-header { margin-bottom: 24px; }
  h1 { margin: 0; font-size: 1.6rem; }
  .tagline { color: #666; margin: 4px 0 0; font-size: 0.95rem; }
  .funds-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; padding: 8px 10px; font-weight: 500; color: #555; border-bottom: 1px solid #ccc; background: #fafafa; }
  td { padding: 10px; border-bottom: 1px solid #f0f0f0; }
  td.num, th.num { text-align: right; }
  .muted { color: #888; font-size: 0.85rem; }
  .chip { display: inline-block; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; margin-right: 4px; }
  .row-link { color: #4a7ec7; text-decoration: none; font-size: 1.2rem; }
  a { color: #4a7ec7; text-decoration: none; }
  .site-footer { margin-top: 32px; font-size: 0.85rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(ui): homepage multi-fund comparison table"
```

### Task 6.3: About page

**Files:**
- Create: `src/pages/about.astro`

**Why:** Methodology, what 13Fs cover/don't, and the contact CTA.

- [ ] **Step 1: Implement**

```astro
---
// src/pages/about.astro
import ContactCTA from '../components/ContactCTA.astro';
---
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>About — 13f-changes</title>
    <link rel="stylesheet" href="/global.css" />
  </head>
  <body>
    <main class="container">
      <nav class="topnav"><a href="/">← Home</a></nav>
      <article>
        <h1>About 13f-changes</h1>

        <p>13f-changes tracks quarter-over-quarter changes in selected hedge funds' Form 13F-HR filings with the SEC. Unlike most 13F tools, the site is organized around <em>what shifted</em> rather than the static list of holdings.</p>

        <h2>What's a 13F?</h2>
        <p>Form 13F-HR is a quarterly disclosure filed by institutional investment managers with at least $100 million in qualifying U.S. equity securities under management. It lists every long equity position held at quarter-end. Filings are due 45 days after the quarter ends.</p>

        <h2>What 13Fs cover</h2>
        <ul>
          <li>Long equity positions in U.S.-listed common stock, ADRs, and certain ETFs.</li>
          <li>Listed call and put options (reported separately from the underlying).</li>
          <li>Convertible debt, certain warrants.</li>
        </ul>

        <h2>What 13Fs don't cover</h2>
        <ul>
          <li>Short positions.</li>
          <li>Bonds and most fixed-income holdings.</li>
          <li>Foreign-listed shares not on U.S. exchanges.</li>
          <li>Derivatives positions held outside the reporting entity.</li>
          <li>Currency, commodity, or futures positions.</li>
          <li>Anything held in non-13F-reporting vehicles.</li>
        </ul>

        <h2>Data sources</h2>
        <ul>
          <li><strong>Filings:</strong> SEC EDGAR (<code>www.sec.gov</code>) — the primary source.</li>
          <li><strong>CUSIP → ticker:</strong> OpenFIGI free API.</li>
          <li><strong>Sector / industry:</strong> Yahoo Finance via the <code>yahoo-finance2</code> library, mapped to canonical GICS top-level sectors.</li>
          <li><strong>Themes:</strong> assigned editorially per-fund during a quarterly review session. Themes are an opinionated layer on top of the canonical sector data — Amazon's primary GICS classification stays "Consumer Discretionary," but it can also be tagged "AI infrastructure" if that frames the fund's thesis better.</li>
        </ul>

        <h2>Refresh cadence</h2>
        <p>A GitHub Action polls EDGAR daily during the four 45-day filing windows (mid-Feb, mid-May, mid-Aug, mid-Nov). When a new filing lands, a manual review session ingests it, classifies any new positions, computes the diff, and ships.</p>

        <h2>Limitations</h2>
        <ul>
          <li><strong>Filing-snapshot values.</strong> Position values are as of the filing's quarter-end date — not refreshed with current market prices.</li>
          <li><strong>Options vs. underlying.</strong> Listed options on the same security are shown as separate rows, with a "Call" or "Put" annotation.</li>
          <li><strong>Foreign-listed shares.</strong> Some foreign-listed CUSIPs (G-prefix) are present; resolution to local tickers is best-effort.</li>
          <li><strong>Theme tags are editorial.</strong> Different observers would categorize positions differently; tags are one perspective.</li>
        </ul>

        <ContactCTA />
      </article>
    </main>
  </body>
</html>

<style>
  .container { max-width: 720px; margin: 0 auto; padding: 24px 20px; font-family: system-ui, sans-serif; color: #222; line-height: 1.6; }
  .topnav { font-size: 0.85rem; margin-bottom: 16px; }
  .topnav a { color: #4a7ec7; text-decoration: none; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.1rem; margin-top: 24px; }
</style>
```

- [ ] **Step 2: Create `public/global.css` (referenced from pages)**

```css
/* Resets and minimal base styles. */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: system-ui, -apple-system, sans-serif; }
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: pages compile (`/`, `/about`, and one `/funds/[slug]` per seeded fund — but the `[slug]` pages may fail due to missing filing data; that's expected pre-initial-load).

- [ ] **Step 4: Commit**

```bash
git add src/pages/about.astro public/global.css
git commit -m "feat(ui): about page and base CSS"
```

---

## Phase 7 — Automation: EDGAR polling

### Task 7.1: Implement `poll-edgar.ts`

**Files:**
- Create: `scripts/poll-edgar.ts`
- Create: `tests/poll-edgar.test.ts`

**Why:** The CI script that runs daily during filing windows. For each fund, queries EDGAR for the latest 13F-HR. If the latest accession differs from `quarters.json`'s newest entry, appends to `_pending.json`.

- [ ] **Step 1: Failing test**

```ts
// tests/poll-edgar.test.ts
import { describe, it, expect, vi } from 'vitest';
import { discoverNewFilings } from '../scripts/poll-edgar';

describe('discoverNewFilings', () => {
  it('returns nothing when accession matches the newest known quarter', async () => {
    const fetchEdgar = vi.fn(async () => [{
      accession: 'A1', filing_date: '2026-02-11', period_ending: '2025-12-31',
    }]);
    const known = { 'fund-x': { latestAccession: 'A1' } };
    const result = await discoverNewFilings(
      [{ slug: 'fund-x', cik: '0000000001' }],
      known,
      { fetchEdgar },
    );
    expect(result).toEqual([]);
  });

  it('returns a pending entry when EDGAR has a newer accession', async () => {
    const fetchEdgar = vi.fn(async () => [{
      accession: 'A2', filing_date: '2026-02-11', period_ending: '2025-12-31',
    }]);
    const known = { 'fund-x': { latestAccession: 'A1' } };
    const result = await discoverNewFilings(
      [{ slug: 'fund-x', cik: '0000000001' }],
      known,
      { fetchEdgar },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ slug: 'fund-x', accession: 'A2' });
  });
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Implement**

```ts
// scripts/poll-edgar.ts
import type { PendingEntry } from './types.js';

export interface EdgarFiling {
  accession: string;
  filing_date: string;
  period_ending: string;
}
export interface DiscoverInput {
  fetchEdgar: (cik: string) => Promise<EdgarFiling[]>;
}
export interface FundForPolling { slug: string; cik: string }
export interface KnownState {
  [slug: string]: { latestAccession: string };
}

export async function discoverNewFilings(
  funds: FundForPolling[],
  known: KnownState,
  input: DiscoverInput,
): Promise<PendingEntry[]> {
  const out: PendingEntry[] = [];
  for (const fund of funds) {
    const filings = await input.fetchEdgar(fund.cik);
    if (filings.length === 0) continue;
    const latest = filings[0];
    const knownLatest = known[fund.slug]?.latestAccession;
    if (knownLatest && knownLatest === latest.accession) continue;
    const cikNoZeros = String(parseInt(fund.cik, 10));
    const accNoDashes = latest.accession.replace(/-/g, '');
    out.push({
      slug: fund.slug,
      cik: fund.cik,
      accession: latest.accession,
      period_ending: latest.period_ending,
      filing_date: latest.filing_date,
      edgar_url: `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}/`,
      discovered_at: new Date().toISOString(),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests (PASS), commit**

```bash
git add scripts/poll-edgar.ts tests/poll-edgar.test.ts
git commit -m "feat(poll-edgar): discover new filings vs. known state"
```

### Task 7.2: Implement the CLI runner that fetches EDGAR and updates `_pending.json`

**Files:**
- Create: `scripts/run-poll-edgar.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement**

```ts
// scripts/run-poll-edgar.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverNewFilings, type EdgarFiling, type KnownState } from './poll-edgar.js';
import type { FundsFile, PendingFile, QuartersFile } from './types.js';

const USER_AGENT = 'Sean Kelley seanfkelley1@gmail.com';
const ROOT = process.cwd();

async function fetchLatest13F(cik: string): Promise<EdgarFiling[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=10&output=atom`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`EDGAR HTTP ${res.status}`);
  const text = await res.text();
  // crude parse — Atom has <entry> blocks; pluck accession-number, filing-date, file-type
  const out: EdgarFiling[] = [];
  const entryRe = /<entry>[\s\S]*?<\/entry>/g;
  for (const block of text.match(entryRe) ?? []) {
    if (!block.includes('<filing-type>13F-HR</filing-type>')) continue;
    const acc = block.match(/<accession-number>([^<]+)<\/accession-number>/)?.[1];
    const date = block.match(/<filing-date>([^<]+)<\/filing-date>/)?.[1];
    if (!acc || !date) continue;
    // period_ending is not in the atom feed; defer to /update-quarter.
    // Use a placeholder; the manual review fills it in correctly.
    out.push({ accession: acc, filing_date: date, period_ending: '' });
  }
  return out;
}

async function main() {
  const funds: FundsFile[] = JSON.parse(readFileSync(join(ROOT, 'data/funds.json'), 'utf8'));
  const known: KnownState = {};
  for (const fund of funds) {
    const q: QuartersFile = JSON.parse(readFileSync(join(ROOT, `data/funds/${fund.slug}/quarters.json`), 'utf8'));
    known[fund.slug] = { latestAccession: q.quarters[0]?.accession ?? '' };
  }

  const newFilings = await discoverNewFilings(
    funds.map(f => ({ slug: f.slug, cik: f.cik })),
    known,
    { fetchEdgar: fetchLatest13F },
  );

  if (newFilings.length === 0) {
    console.log('No new filings.');
    return;
  }

  const pendingPath = join(ROOT, 'data/_pending.json');
  const pending: PendingFile = JSON.parse(readFileSync(pendingPath, 'utf8'));
  // Merge — don't double-add accessions already pending
  const known_pending = new Set(pending.pending.map(p => p.accession));
  for (const f of newFilings) {
    if (!known_pending.has(f.accession)) pending.pending.push(f);
  }
  writeFileSync(pendingPath, JSON.stringify(pending, null, 2) + '\n');
  console.log(`Queued ${newFilings.length} new filing(s) for review.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add npm script**

```json
"scripts": {
  "poll-edgar": "tsx scripts/run-poll-edgar.ts"
}
```

- [ ] **Step 3: Verify it runs (with two seeded funds, both with empty quarters → both discoveries qualify as new)**

```bash
npm run poll-edgar
```

Expected: prints `Queued 2 new filing(s) for review.` (or 0 if EDGAR is unreachable in the test env — that's also fine for a smoke check).

- [ ] **Step 4: Commit**

```bash
git add scripts/run-poll-edgar.ts package.json
git commit -m "feat(poll-edgar): CLI runner that updates _pending.json"
```

### Task 7.3: GitHub Actions workflow `poll-edgar.yml`

**Files:**
- Create: `.github/workflows/poll-edgar.yml`

**Why:** Schedules `npm run poll-edgar` daily during the four filing windows. Commits any updates to `_pending.json`.

- [ ] **Step 1: Implement**

```yaml
# .github/workflows/poll-edgar.yml
name: Poll EDGAR for new 13F filings

on:
  schedule:
    # Daily at 13:00 UTC (8am ET) during filing windows.
    # Cron doesn't natively support "first 18 days of these months", so we run
    # daily across all 4 months and the script no-ops when nothing changes.
    - cron: '0 13 1-18 2,5,8,11 *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run poll-edgar
      - name: Commit and push if changed
        run: |
          if [[ -n "$(git status --porcelain data/_pending.json)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add data/_pending.json
            git commit -m "chore: queue new 13F filing(s) for review"
            git push
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/poll-edgar.yml
git commit -m "feat(automation): GitHub Actions workflow for daily EDGAR polling"
```

---

## Phase 8 — Automation: reminder email

### Task 8.1: Implement `remind.ts`

**Files:**
- Create: `scripts/remind.ts`
- Create: `tests/remind.test.ts`

**Why:** Once a week during filing windows, if `_pending.json` is non-empty, send an email to remind the maintainer to run `/update-quarter`.

- [ ] **Step 1: Failing test**

```ts
// tests/remind.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildReminderBody } from '../scripts/remind';
import type { FundsFile, PendingFile } from '../scripts/types';

describe('buildReminderBody', () => {
  const funds: FundsFile[] = [
    { slug: 'a', name: 'Alpha LP', manager_name: 'A', cik: '0000000001', location: '',
      description: '', added: '2026-01-01', active: true },
  ];
  it('returns null when nothing pending', () => {
    const result = buildReminderBody(funds, { pending: [] });
    expect(result).toBeNull();
  });
  it('builds a body listing each pending filing', () => {
    const pending: PendingFile = { pending: [{
      slug: 'a', cik: '0000000001', accession: 'X', period_ending: '2025-12-31',
      filing_date: '2026-02-11',
      edgar_url: 'https://example.com', discovered_at: '2026-02-11T00:00:00Z',
    }]};
    const body = buildReminderBody(funds, pending)!;
    expect(body.subject).toMatch(/1 filing/);
    expect(body.text).toMatch(/Alpha LP/);
    expect(body.text).toMatch(/2025-12-31/);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// scripts/remind.ts
import type { FundsFile, PendingFile } from './types.js';

export interface ReminderBody {
  subject: string;
  text: string;
}

export function buildReminderBody(
  funds: FundsFile[],
  pending: PendingFile,
): ReminderBody | null {
  if (pending.pending.length === 0) return null;
  const fundBySlug = new Map(funds.map(f => [f.slug, f]));
  const lines = pending.pending.map(p => {
    const f = fundBySlug.get(p.slug);
    return `· ${f?.name ?? p.slug} — period ending ${p.period_ending} — filed ${p.filing_date}`;
  });
  const subject = `13f-changes: ${pending.pending.length} filing${pending.pending.length === 1 ? '' : 's'} awaiting review`;
  const text = [
    `${pending.pending.length} new 13F filing${pending.pending.length === 1 ? '' : 's'} are queued for review.\n`,
    ...lines,
    '',
    'Run `/update-quarter` in Claude Code to process them.',
  ].join('\n');
  return { subject, text };
}

export async function sendViaResend(
  body: ReminderBody,
  opts: { apiKey: string; to: string; from: string; fetch?: typeof fetch },
): Promise<void> {
  const f = opts.fetch ?? globalThis.fetch;
  const res = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: body.subject,
      text: body.text,
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
}
```

- [ ] **Step 3: Run tests (PASS), commit**

```bash
git add scripts/remind.ts tests/remind.test.ts
git commit -m "feat(remind): build reminder body, send via Resend"
```

### Task 8.2: CLI runner + workflow

**Files:**
- Create: `scripts/run-remind.ts`
- Create: `.github/workflows/reminder.yml`
- Modify: `package.json`

- [ ] **Step 1: Implement runner**

```ts
// scripts/run-remind.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReminderBody, sendViaResend } from './remind.js';
import type { FundsFile, PendingFile } from './types.js';

const ROOT = process.cwd();
const funds: FundsFile[] = JSON.parse(readFileSync(join(ROOT, 'data/funds.json'), 'utf8'));
const pending: PendingFile = JSON.parse(readFileSync(join(ROOT, 'data/_pending.json'), 'utf8'));

const body = buildReminderBody(funds, pending);
if (!body) {
  console.log('No pending filings, nothing to remind about.');
  process.exit(0);
}

const apiKey = process.env.RESEND_API_KEY;
const to = process.env.EMAIL_TO ?? 'seanfkelley1@gmail.com';
const from = process.env.EMAIL_FROM ?? 'reminders@13f-changes.example.com';

if (!apiKey) {
  console.log('No RESEND_API_KEY — would have sent:');
  console.log(`Subject: ${body.subject}`);
  console.log(body.text);
  process.exit(0);
}

await sendViaResend(body, { apiKey, to, from });
console.log('Reminder sent.');
```

- [ ] **Step 2: Add npm script**

```json
"scripts": { "remind": "tsx scripts/run-remind.ts" }
```

- [ ] **Step 3: Workflow**

```yaml
# .github/workflows/reminder.yml
name: Weekly reminder during filing windows
on:
  schedule:
    # Sundays at 14:00 UTC (9am ET) during filing windows
    - cron: '0 14 * 2,5,8,11 0'
  workflow_dispatch:

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run remind
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_TO: ${{ secrets.EMAIL_TO }}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/run-remind.ts .github/workflows/reminder.yml package.json
git commit -m "feat(remind): CLI runner and weekly workflow"
```

---

## Phase 9 — `/update-quarter` slash command

### Task 9.1: Author the slash command markdown

**Files:**
- Create: `.claude/commands/update-quarter.md`

**Why:** This is the operational core — the workflow Claude follows during the quarterly review session. It reads `_pending.json`, fetches and parses each filing, classifies new CUSIPs (asking the user when needed), proposes tags and a hero summary (asking for approval), and stages everything for commit.

- [ ] **Step 1: Implement**

````markdown
---
description: Process queued 13F filings — fetch, parse, classify, tag, summarize.
---

You are conducting the quarterly review for the 13f-changes project. Read `data/_pending.json` and process each pending filing in order.

For EACH pending filing:

## 1. Fetch and parse

Use `tsx scripts/fetch-and-parse.ts <slug> <accession>` to download the filing and write the parsed JSON to `data/funds/<slug>/<period>.json`. (If this script doesn't exist yet, create it as a thin wrapper around `fetch-filing.ts` + `parse-13f.ts` that also writes the output file. Look at `scripts/fetch-filing.ts` and `scripts/parse-13f.ts` for the building blocks.)

After parsing, briefly summarize the filing for the user: "Period ending {date}, {N} positions, total ${value} ({units}), schema {X01|X02}."

## 2. Classify new CUSIPs

Read `data/securities.json`. Find all CUSIPs in the new filing not yet in the cache.

Run `npm run classify <slug> <period>` (the CLI from Task 2.4) which writes auto-classifiable entries to `data/securities.json` and prints any CUSIPs needing manual classification with their issuer name and the reason (no-ticker or no-sector).

For each "needs manual" entry, present to the user:

```
The CUSIP {cusip} ({issuer name}) couldn't be auto-classified.
Reason: {no-ticker | no-sector}.

My best guess based on the issuer name and what I know about this company:
  Ticker: {your guess, or "unknown"}
  Sector: {your GICS guess from the 11 standard sectors}
  Industry: {your industry guess}
  Reasoning: {one sentence}

Approve, edit, or skip?
```

After user approves, write to `data/securities.json` with `ticker_source: "manual-override"` (if ticker was guessed) and/or `sector_source: "manual-override"` with `manual_override_reason` set.

## 3. Compute the diff

Run `tsx scripts/run-compute-diff.ts <slug> <period>` (create as a thin wrapper if it doesn't exist) which writes `data/funds/<slug>/diff/<period>.json`.

## 4. Propose theme tags for new positions

For each NEW position in the diff (i.e. positions in `diff.movements.new`), look at the security's sector, industry, name, and any descriptive context you recall about the issuer's business. Propose tags from the fund's existing taxonomy in `data/funds/<slug>/tags.json`. If a position needs a NEW tag (the existing taxonomy doesn't capture it), propose adding it.

Present to the user:

```
{ticker} ({name}) — {sector} / {industry}
  Existing taxonomy: {list current tag IDs}
  Proposed tags: {your suggestions}
  Reasoning: {one sentence per tag}

Approve, edit, or skip tagging this position?
```

If the user approves taxonomy additions, append to `data/funds/<slug>/tags.json` taxonomy.
Update `assignments` for each tagged CUSIP.

## 5. Propose a hero summary

Look at the diff's biggest moves (top 3 by `delta_value`), the largest sector deltas, and any newly-introduced themes. Draft a 1–2 sentence summary in editorial voice. Example: "Doubled down on AI-power infrastructure — Bloom Energy +35% and new positions in Cipher Mining and Constellation Energy. Trimmed bitcoin-miner exposure (Bitfarms cut by half, Bitdeer reduced)."

Present to user; await approval/edit. Write the approved summary to `data/funds/<slug>/quarters.json` as the `summary` field of the new quarter entry. While you're there, append the new quarter entry to `quarters.json` (newest first) using the parsed metadata.

## 6. Validate and stage

Run `npm run validate`. If errors, fix or surface to user. If clean:

Run `git status` to show what changed. Stage all changes with `git add data/`. Propose a commit message like:

```
Q4 2025 update: situational-awareness +5/-2/+12/-8, duquesne +3/-1/+8/-4
```

Stop. The user reviews and commits.

## 7. Drain the pending queue

After all pending filings are processed and committed, edit `data/_pending.json` to remove the entries you handled. Stage and commit that as a separate commit.
````

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/update-quarter.md
git commit -m "feat(slash): /update-quarter command for the quarterly review session"
```

### Task 9.2: Implement the thin wrapper scripts referenced by `/update-quarter`

**Files:**
- Create: `scripts/run-fetch-and-parse.ts`
- Create: `scripts/run-compute-diff.ts`

**Why:** The slash command calls these as one-liners. They're glue: load a few JSON files, call the function, write output.

- [ ] **Step 1: Implement `scripts/run-fetch-and-parse.ts`**

```ts
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
```

- [ ] **Step 2: Implement `scripts/run-compute-diff.ts`**

```ts
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
```

- [ ] **Step 3: Verify both compile**

```bash
npx tsc --noEmit scripts/run-fetch-and-parse.ts scripts/run-compute-diff.ts
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-fetch-and-parse.ts scripts/run-compute-diff.ts
git commit -m "feat(scripts): thin wrappers for /update-quarter to call"
```

---

## Phase 10 — Initial data load

### Task 10.1: Run `/update-quarter` for the first time

**Why:** Get real data into the system. This is a manual step performed in Claude Code, following the slash command's instructions. The subagent or executing engineer should perform this themselves OR flag it for the user if interactive prompts can't be handled.

- [ ] **Step 1: Run the EDGAR poll to seed `_pending.json`**

```bash
npm run poll-edgar
```

Expected: 2 filings queued (the latest 13F-HR for each seeded fund).

- [ ] **Step 2: For each pending filing, run the fetch+parse step**

```bash
# Read _pending.json, then for each entry:
tsx scripts/run-fetch-and-parse.ts <slug> <accession>
```

Expected: writes `data/funds/<slug>/<period>.json` for each.

- [ ] **Step 3: Repeat for the prior quarter**

Find the second-newest accession from each fund's EDGAR feed (you may need to fetch their full filings list and pick the second entry):

```bash
curl -H "User-Agent: Sean Kelley seanfkelley1@gmail.com" \
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=<cik>&type=13F-HR&dateb=&owner=include&count=10&output=atom" \
  | grep accession-number | head -2
```

Then run `run-fetch-and-parse.ts` for each prior accession.

- [ ] **Step 4: Classify all CUSIPs across both funds' current quarters**

Run the CLI wrapper from Task 2.4 for each fund × quarter combo:

```bash
npm run classify situational-awareness 2025-Q4
npm run classify situational-awareness 2025-Q3
npm run classify duquesne 2025-Q4
npm run classify duquesne 2025-Q3
```

Each invocation appends auto-classifiable entries to `data/securities.json` and prints a list of CUSIPs that need manual classification. For each manual entry, propose a reasonable sector/industry/ticker and edit `data/securities.json` by hand (or run the slash command flow which is interactive).

- [ ] **Step 5: For each fund, append the latest quarter to `quarters.json` and run compute-diff**

Edit `data/funds/<slug>/quarters.json` to add an entry per loaded period. Then:

```bash
tsx scripts/run-compute-diff.ts situational-awareness 2025-Q4
tsx scripts/run-compute-diff.ts duquesne 2025-Q4
```

- [ ] **Step 6: Propose tags for Situational Awareness positions**

Walk through each position; for AI-thesis stocks (Bloom Energy, Cipher Mining, Bitdeer, Bitfarms, Applied Digital, etc.) propose tags from the starter taxonomy in the spec. User approves. Update `tags.json`.

- [ ] **Step 7: Write hero summaries for both funds**

For each fund, look at the biggest moves and write a 1–2 sentence summary. Approve and write to `quarters.json`.

- [ ] **Step 8: Validate**

```bash
npm run validate
npm run build
```

Expected: validation passes, build produces `dist/` with all pages rendered.

- [ ] **Step 9: Drain `_pending.json`**

Edit `data/_pending.json` to remove processed entries.

- [ ] **Step 10: Commit**

```bash
git add data/
git commit -m "data: initial load — Q3+Q4 2025 for both funds, classified, tagged"
```

### Task 10.2: Local preview check

**Files:** none (just verify the build looks right).

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open `http://localhost:4321/` and click through**

Verify:
- Homepage shows both funds with stats and top changes
- Clicking a fund shows the per-fund detail page
- Hero summary, sector deltas, theme deltas (SA only), movement tables, held-steady fold all render
- About page has full methodology

If anything is broken, file an issue in `docs/superpowers/specs/` follow-ups (don't block deploy on minor issues; aesthetics polish comes later anyway).

---

## Phase 11 — Deploy

### Task 11.1: Cloudflare deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Why:** Auto-deploy on push to `main`.

- [ ] **Step 1: Implement**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run validate
      - run: npm test
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

- [ ] **Step 2: Document required GitHub secrets in the README**

Edit `README.md` to add a "GitHub Secrets" section:

```markdown
## GitHub Secrets

Required for the workflows to run:

- `CLOUDFLARE_API_TOKEN` — create in Cloudflare dashboard → API tokens → "Edit Cloudflare Workers" template
- `CLOUDFLARE_ACCOUNT_ID` — from your Cloudflare dashboard URL or "account home"
- `RESEND_API_KEY` — from your Resend account
- `EMAIL_TO` — the email address that receives the reminders
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "feat(deploy): GitHub Actions workflow for Cloudflare Workers"
```

### Task 11.2: First deploy

**Files:** none (operational).

- [ ] **Step 1: User configures Cloudflare**

User runs `wrangler login` locally, picks an account, sets the account ID. User decides on a domain (subdomain of personal site, or `13f-changes.workers.dev` for the first deploy).

- [ ] **Step 2: User pushes to main**

Once secrets are set, pushing to main triggers the deploy workflow.

- [ ] **Step 3: User verifies deployed site loads**

Visit the deployed URL. Verify the homepage and a fund detail page render correctly.

---

## Self-review checklist

After completing the plan, before handing off:

**Spec coverage:**
- [ ] Homepage layout — Task 6.2 ✓
- [ ] Per-fund changes-first page — Task 6.1 ✓
- [ ] About page — Task 6.3 ✓
- [ ] Sector breakdown deltas — Task 3.2 ✓
- [ ] Theme breakdown deltas — Task 3.3 ✓
- [ ] Movement tables (NEW/INC/DEC/CLOSED) — Tasks 3.1, 5.6 ✓
- [ ] Held-steady fold — Task 5.7 ✓
- [ ] Editorial hero summary — Task 5.4, captured in `/update-quarter` step 5 ✓
- [ ] Contact CTA — Task 5.8 ✓
- [ ] Cloudflare Workers deploy — Tasks 0.2, 11.1 ✓
- [ ] GitHub Actions polling — Task 7.3 ✓
- [ ] Reminder email — Task 8.2 ✓
- [ ] /update-quarter slash command — Task 9.1 ✓
- [ ] X01/X02 schema handling — Tasks 1.2, 1.3 ✓
- [ ] Options handling — Task 1.4 ✓
- [ ] Foreign-CUSIP handling — Task 1.4 ✓
- [ ] Validate-data — Task 4.1 ✓
- [ ] Adding a new fund (operational) — covered in spec, no specific code task needed (data file edit only) ✓
- [ ] First-filing edge case — Task 3.4 + page rendering in Task 6.1 ✓

**Placeholder scan:** No "TBD" or "implement later" in any task — verified.

**Type consistency:** All shared types live in `scripts/types.ts` and are imported by every module that uses them. Function signatures referenced across tasks (`parseFiling`, `computeDiff`, `classifyNewCusips`, `lookupCusips`, `lookupTickerSector`, `discoverNewFilings`, `validateAll`, `buildReminderBody`, `sendViaResend`) match between definition and call sites.

---

## Execution handoff

Plan complete. Two execution options when the user is ready:

1. **Subagent-driven (recommended)** — fresh subagent per task with two-stage review between tasks. Best for parallelizable phases (Phases 1–4 have largely independent tasks).
2. **Inline execution** — runs the plan in the current session with checkpoints. Simpler but slower.

Note: Phase 10 (initial data load) is the only phase that requires interactive human-in-the-loop input (manual classification when Yahoo fails, tag approval, summary approval). Plan accordingly — that phase isn't a clean "fire and forget" task.
