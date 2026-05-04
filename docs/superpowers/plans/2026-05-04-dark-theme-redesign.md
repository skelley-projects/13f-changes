# Dark Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the 13f-changes site with a Bloomberg-terminal-inspired dark theme, elevate the lead investor (manager) as a first-class entity with headshot and label on each fund page, and apply consistent UI improvements across the homepage, fund detail page, and About page.

**Architecture:** CSS custom properties define the theme tokens once in `public/global.css`. Each Astro component's scoped `<style>` block references those tokens — no hardcoded colors. Two new components: `Layout.astro` (shared page wrapper with consistent site header) and `ManagerAvatar.astro` (circular avatar with image-or-initials fallback). The fund detail page header is restructured so the manager's name (not the fund name) is the primary `<h1>`.

**Tech Stack:** Astro 6, plain CSS (scoped per-component + global tokens), TypeScript, Zod (data validation), Vitest (tests), Wrangler (deploy to Cloudflare Workers).

**Testing approach:** Most tasks are visual/CSS — verified by running the Astro dev server (`npm run dev`) and previewing in the browser. Logic-bearing changes (Zod schema for `manager_photo`, `ManagerAvatar` initials fallback) get unit-test verification via `npm test`. The existing test suite covers the data pipeline, not rendered components, so component tests are out of scope.

**Spec:** `docs/superpowers/specs/2026-05-04-dark-theme-redesign-design.md`

---

## File Structure

### Created
| File | Responsibility |
|---|---|
| `src/components/Layout.astro` | Shared `<html>/<head>` wrapper + site header strip + `.container` widths |
| `src/components/ManagerAvatar.astro` | Circular avatar with photo or initials fallback |
| `public/managers/leopold-aschenbrenner.jpg` | Headshot for Situational Awareness LP |
| `public/managers/stanley-druckenmiller.jpg` | Headshot for Duquesne Family Office LLC |

### Modified
| File | Reason |
|---|---|
| `public/global.css` | Add CSS theme tokens, base body styles |
| `scripts/types.ts` | Add optional `manager_photo` field to `FundsFile` |
| `scripts/validate-data.ts` | Add `manager_photo` to Zod fund schema |
| `data/funds.json` | Populate `manager_photo` paths for both funds |
| `src/pages/index.astro` | Migrate to `Layout`, dark restyle, avatars in manager column |
| `src/pages/funds/[slug].astro` | Migrate to `Layout` |
| `src/pages/about.astro` | Migrate to `Layout`, dark restyle |
| `src/components/FundHeader.astro` | Restructure for Lead Investor presentation; dark restyle |
| `src/components/ChangeHero.astro` | Dark restyle (amber border, semantic colors) |
| `src/components/SectorDeltaBars.astro` | Dark restyle (brighter bars, amber label) |
| `src/components/MovementTable.astro` | Dark restyle (semantic header tints, mono numerics) |
| `src/components/HoldingsTable.astro` | Dark restyle, replace dashed border with hairline |
| `src/components/ContactCTA.astro` | Dark restyle, amber link |

### Not touched
- `data/funds/**` (theme/quarter/diff data)
- `data/securities.json`, `data/_pending.json`
- `src/lib/**`
- `scripts/` (data pipeline, except `types.ts` + `validate-data.ts`)
- `tests/` (existing tests must continue to pass; no new tests required for UI)
- `wrangler.toml`, `astro.config.mjs`, `package.json`

---

## Task 1: Add CSS theme tokens to global.css

**Files:**
- Modify: `public/global.css`

- [ ] **Step 1: Replace the existing global.css content**

Current file is ~5 lines of minimal resets. Replace its entire content with:

```css
/* === Theme tokens === */
:root {
  --bg: #0a0a0a;
  --bg-elev: #111111;
  --bg-tinted: #1a1a1a;
  --border: #262626;
  --border-strong: #383838;

  --fg: #e5e5e5;
  --fg-muted: #888888;
  --fg-dim: #555555;

  --accent: #f59e0b;
  --accent-hover: #fbbf24;

  --pos: #22c55e;
  --neg: #ef4444;

  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
}

/* === Reset === */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
}

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); text-decoration: underline; }

/* Numbers default to monospaced for column alignment */
.num, .mono { font-family: var(--font-mono); }

/* Uppercase mono label, used widely */
.label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--accent);
}

::selection { background: var(--accent); color: var(--bg); }
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`
Open: `http://localhost:4321/`
Expected: Page background is now near-black. Existing components will still have light-mode hardcoded colors (that's expected — those get fixed in later tasks). The body should be dark, link color amber.

- [ ] **Step 3: Run tests to confirm nothing data-pipeline broke**

Run: `npm test`
Expected: All existing tests pass (this CSS change doesn't touch any TS).

- [ ] **Step 4: Commit (after user previews)**

```bash
git add public/global.css
git commit -m "feat: add dark theme tokens to global.css"
```

---

## Task 2: Add `manager_photo` to fund data schema

**Files:**
- Modify: `scripts/types.ts:82-91`
- Modify: `scripts/validate-data.ts:4-13`
- Test: `tests/validate-data.test.ts` (existing — verify still passes)

- [ ] **Step 1: Add the field to the TypeScript interface**

In `scripts/types.ts`, replace the `FundsFile` interface (lines 82-91) with:

```typescript
export interface FundsFile {
  slug: Slug;
  name: string;
  manager_name: string;
  /** Optional path under public/, e.g. "/managers/leopold-aschenbrenner.jpg". Renders an avatar when present. */
  manager_photo?: string;
  cik: CIK;
  location: string;
  description: string;
  added: string;
  active: boolean;
}
```

- [ ] **Step 2: Add the field to the Zod schema**

In `scripts/validate-data.ts`, replace the `fundSchema` block (lines 4-13) with:

```typescript
const fundSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  manager_name: z.string(),
  manager_photo: z.string().regex(/^\/managers\/.+\.(jpg|jpeg|png|webp)$/).optional(),
  cik: z.string().regex(/^\d{10}$/),
  location: z.string(),
  description: z.string(),
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean(),
});
```

- [ ] **Step 3: Run validation tests**

Run: `npm test -- validate-data`
Expected: All tests pass. The existing fund records have no `manager_photo` field; since it's optional, validation still succeeds.

- [ ] **Step 4: Commit**

```bash
git add scripts/types.ts scripts/validate-data.ts
git commit -m "feat: add optional manager_photo field to fund schema"
```

---

## Task 3: Source and add headshot images

**Files:**
- Create: `public/managers/leopold-aschenbrenner.jpg`
- Create: `public/managers/stanley-druckenmiller.jpg`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "public/managers"
```

- [ ] **Step 2: Source images**

Find appropriate public photos:
- **Leopold Aschenbrenner:** Wikipedia (en.wikipedia.org/wiki/Leopold_Aschenbrenner) or his essay site (situational-awareness.ai). Look for a head-and-shoulders image with a clear face.
- **Stanley Druckenmiller:** Wikipedia (en.wikipedia.org/wiki/Stanley_Druckenmiller) or Wikimedia Commons.

Requirements:
- Square crop (1:1), head-and-shoulders, ~400×400 px
- JPEG, target <50 KB
- Editorial / press / Wikimedia Commons sources only — no scraped social media

Use whatever tooling is convenient (browser → save → crop in Preview/Photoshop, or `curl` + `magick` / `sharp`). Save to:
- `public/managers/leopold-aschenbrenner.jpg`
- `public/managers/stanley-druckenmiller.jpg`

- [ ] **Step 3: Verify the files exist and are valid images**

```bash
ls -la public/managers/
file public/managers/leopold-aschenbrenner.jpg
file public/managers/stanley-druckenmiller.jpg
```

Expected: Both files present, ~10–50 KB each, identified as JPEG by `file`.

- [ ] **Step 4: Update funds.json with the photo paths**

Replace the entire content of `data/funds.json` with:

```json
[
  {
    "slug": "situational-awareness",
    "name": "Situational Awareness LP",
    "manager_name": "Leopold Aschenbrenner",
    "manager_photo": "/managers/leopold-aschenbrenner.jpg",
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
    "manager_photo": "/managers/stanley-druckenmiller.jpg",
    "cik": "0001536411",
    "location": "New York, NY",
    "description": "Macro/generalist family office. Druckenmiller's vehicle since 2010.",
    "added": "2026-05-03",
    "active": true
  }
]
```

- [ ] **Step 5: Run validation**

Run: `npm run validate`
Expected: No errors. The new `manager_photo` paths match the regex `^/managers/.+\.(jpg|jpeg|png|webp)$`.

- [ ] **Step 6: Commit**

```bash
git add public/managers/ data/funds.json
git commit -m "feat: add manager headshots and photo paths in funds.json"
```

---

## Task 4: Create ManagerAvatar component

**Files:**
- Create: `src/components/ManagerAvatar.astro`

- [ ] **Step 1: Create the component**

Write to `src/components/ManagerAvatar.astro`:

```astro
---
// Renders a circular manager avatar. Uses the photo if provided,
// otherwise falls back to a gradient circle with the manager's initials.
interface Props {
  photo?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}
const { photo, name, size = 'md' } = Astro.props;

const initials = name
  .split(/\s+/)
  .filter(Boolean)
  .map(part => part[0]?.toUpperCase() ?? '')
  .filter(Boolean)
  .slice(0, 2)
  .join('');

const sizes = { sm: 22, md: 38, lg: 56 };
const px = sizes[size];
---
{photo ? (
  <span class={`avatar avatar-${size}`} style={`width:${px}px;height:${px}px;`}>
    <img src={photo} alt={name} loading="lazy" width={px} height={px} />
  </span>
) : (
  <span class={`avatar avatar-${size} avatar-fallback`} style={`width:${px}px;height:${px}px;`}>
    <span class="initials">{initials}</span>
  </span>
)}

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid var(--accent);
    background: var(--bg-elev);
    vertical-align: middle;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .avatar-fallback {
    background: linear-gradient(135deg, var(--accent-hover), #78350f);
    color: var(--bg);
  }
  .initials {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.45em;
    letter-spacing: 0.5px;
  }
  .avatar-sm .initials { font-size: 9px; }
  .avatar-md .initials { font-size: 14px; }
  .avatar-lg .initials { font-size: 20px; }
</style>
```

- [ ] **Step 2: Sanity-check by importing in dev**

Edit `src/pages/index.astro` temporarily to add a quick sanity test at the top of `<main>`:

```astro
<ManagerAvatar photo="/managers/leopold-aschenbrenner.jpg" name="Leopold Aschenbrenner" size="lg" />
<ManagerAvatar name="Test User" size="md" />
<ManagerAvatar photo={null} name="Another One" size="sm" />
```

(Add the import at the top frontmatter: `import ManagerAvatar from '../components/ManagerAvatar.astro';`)

Run: `npm run dev`
Open: `http://localhost:4321/`
Expected: Three circles — one with Leopold's photo, two with initials fallback ("TU" and "AO"). All have amber rings.

- [ ] **Step 3: Remove the sanity test**

Revert the temporary additions to `src/pages/index.astro`. Do NOT remove the `import` if it'll be used in Task 6 — but at this point it's safer to revert fully and re-add in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/components/ManagerAvatar.astro
git commit -m "feat: add ManagerAvatar component with photo/initials fallback"
```

---

## Task 5: Create Layout component

**Files:**
- Create: `src/components/Layout.astro`

- [ ] **Step 1: Create the component**

Write to `src/components/Layout.astro`:

```astro
---
interface Props {
  title: string;
  width?: 'narrow' | 'default' | 'wide';
}
const { title, width = 'default' } = Astro.props;
---
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <link rel="stylesheet" href="/global.css" />
  </head>
  <body>
    <header class="site-strip">
      <a href="/" class="wordmark">13f-changes</a>
      <nav class="site-nav"><a href="/about">About</a></nav>
    </header>
    <main class={`container container-${width}`}>
      <slot />
    </main>
  </body>
</html>

<style>
  .site-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .wordmark {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--accent);
    letter-spacing: 0.5px;
    text-decoration: none;
  }
  .wordmark:hover { color: var(--accent-hover); text-decoration: none; }
  .site-nav a {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-muted);
  }
  .site-nav a:hover { color: var(--accent); text-decoration: none; }
  .container {
    margin: 0 auto;
    padding: 32px 24px 64px;
  }
  .container-narrow { max-width: 720px; }
  .container-default { max-width: 960px; }
  .container-wide { max-width: 1100px; }

  @media (max-width: 600px) {
    .site-strip { padding: 10px 16px; }
    .container { padding: 24px 16px 48px; }
  }
</style>
```

- [ ] **Step 2: Sanity-check via dev server**

Layout will be exercised in Tasks 6/8/14. Skip standalone preview.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.astro
git commit -m "feat: add shared Layout component with site header"
```

---

## Task 6: Migrate index.astro to Layout + dark restyle + avatars

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace the entire file content**

Replace `src/pages/index.astro` with:

```astro
---
import Layout from '../components/Layout.astro';
import ManagerAvatar from '../components/ManagerAvatar.astro';
import ContactCTA from '../components/ContactCTA.astro';
import { loadFunds, loadFundQuarters, loadDiff } from '../lib/data';
import { formatUSD, formatPeriod } from '../lib/format';

const funds = loadFunds();

interface FundRow {
  slug: string;
  name: string;
  manager: string;
  managerPhoto: string | null;
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
    return {
      slug: fund.slug, name: fund.name, manager: fund.manager_name,
      managerPhoto: fund.manager_photo ?? null,
      aum: null, positions: null, period: null, filingDate: null, topChanges: [],
    };
  }
  const diff = loadDiff(fund.slug, latest.period);
  const top: { ticker: string; status: string }[] = [];
  if (diff && diff.prior_period) {
    const allMoves = [
      ...diff.movements.new.map(r => ({ ticker: r.ticker ?? r.cusip, status: 'NEW', dv: r.delta_value })),
      ...diff.movements.increased.map(r => ({ ticker: r.ticker ?? r.cusip, status: '↑', dv: r.delta_value })),
      ...diff.movements.decreased.map(r => ({ ticker: r.ticker ?? r.cusip, status: '↓', dv: r.delta_value })),
      ...diff.movements.closed.map(r => ({ ticker: r.ticker ?? r.cusip, status: 'X', dv: r.delta_value })),
    ];
    allMoves.sort((a, b) => Math.abs(b.dv) - Math.abs(a.dv));
    top.push(...allMoves.slice(0, 3).map(({ ticker, status }) => ({ ticker, status })));
  }
  return {
    slug: fund.slug,
    name: fund.name,
    manager: fund.manager_name,
    managerPhoto: fund.manager_photo ?? null,
    aum: formatUSD(latest.total_value),
    positions: latest.position_count,
    period: formatPeriod(latest.period),
    filingDate: latest.filing_date,
    topChanges: top,
  };
});
---
<Layout title="13f-changes — quarter-over-quarter changes in hedge fund 13F filings" width="wide">
  <header class="page-header">
    <h1>13f-changes</h1>
    <p class="tagline">Tracking quarter-over-quarter changes in hedge fund 13F filings.</p>
  </header>

  <table class="funds-table">
    <thead>
      <tr>
        <th>Fund</th><th>Lead Investor</th>
        <th class="num">AUM</th><th class="num">Positions</th>
        <th>Latest filing</th><th>Top changes</th><th></th>
      </tr>
    </thead>
    <tbody>
      {rows.map(row => (
        <tr>
          <td><a href={`/funds/${row.slug}`} class="fundname">{row.name}</a></td>
          <td>
            <span class="manager-cell">
              <ManagerAvatar photo={row.managerPhoto} name={row.manager} size="sm" />
              <span>{row.manager}</span>
            </span>
          </td>
          <td class="num">{row.aum ?? '—'}</td>
          <td class="num">{row.positions ?? '—'}</td>
          <td>
            {row.period ? <>{row.period} <span class="muted">({row.filingDate})</span></> : 'No filings yet'}
          </td>
          <td>
            {row.topChanges.length === 0 ? '—' :
              row.topChanges.map(c => (
                <span class={`chip chip-${c.status === '↓' || c.status === 'X' ? 'neg' : 'pos'}`}>
                  {c.status} {c.ticker}
                </span>
              ))}
          </td>
          <td><a href={`/funds/${row.slug}`} class="row-link">→</a></td>
        </tr>
      ))}
    </tbody>
  </table>

  <ContactCTA />
</Layout>

<style>
  .page-header { margin-bottom: 32px; }
  .page-header h1 {
    font-family: var(--font-mono);
    font-size: 1.4rem;
    color: var(--accent);
    margin: 0;
    letter-spacing: 0.5px;
  }
  .tagline { color: var(--fg-muted); margin: 6px 0 0; font-size: 0.9rem; }

  .funds-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  .funds-table th {
    text-align: left;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent);
    border-bottom: 1px solid var(--border-strong);
    background: transparent;
  }
  .funds-table td {
    padding: 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  .funds-table td.num, .funds-table th.num { text-align: right; font-family: var(--font-mono); }
  .funds-table tr:hover td { background: var(--bg-elev); }
  .fundname { color: var(--fg); font-weight: 600; }
  .fundname:hover { color: var(--accent); text-decoration: none; }
  .manager-cell { display: inline-flex; align-items: center; gap: 8px; }
  .muted { color: var(--fg-muted); font-size: 0.85rem; }
  .chip {
    display: inline-block;
    background: var(--bg-tinted);
    border: 1px solid var(--border-strong);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    margin-right: 4px;
  }
  .chip-pos { color: var(--pos); border-color: rgba(34, 197, 94, 0.3); }
  .chip-neg { color: var(--neg); border-color: rgba(239, 68, 68, 0.3); }
  .row-link { color: var(--accent); font-size: 1.2rem; font-family: var(--font-mono); }
</style>
```

- [ ] **Step 2: Run dev server and preview**

Run: `npm run dev`
Open: `http://localhost:4321/`
Expected:
- Site header strip at top with "13f-changes" wordmark on left, "About" on right
- Page heading "13f-changes" in amber mono
- Table with both funds; Manager column shows tiny avatar + name (Leopold's photo for Situational Awareness, Stanley's for Duquesne)
- Numbers (AUM, Positions) right-aligned and monospaced
- Top changes as colored chips (green for ↑/NEW, red for ↓/X)
- Row hover slightly lightens the row background

- [ ] **Step 3: Run build to confirm no Astro errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: dark theme + avatars on homepage"
```

---

## Task 7: Restyle FundHeader.astro with Lead Investor presentation

**Files:**
- Modify: `src/components/FundHeader.astro`

- [ ] **Step 1: Replace the entire file**

Replace `src/components/FundHeader.astro` with:

```astro
---
import ManagerAvatar from './ManagerAvatar.astro';
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
  <div class="lead">
    <ManagerAvatar photo={fund.manager_photo ?? null} name={fund.manager_name} size="lg" />
    <div class="lead-text">
      <div class="lead-label">Lead Investor</div>
      <h1>{fund.manager_name}</h1>
      <div class="fund-name">{fund.name}</div>
    </div>
    <div class="meta">
      <div class="period">{formatPeriod(quarter.period)}</div>
      <div class="filed">filed {quarter.filing_date}</div>
      <a href={quarter.edgar_url} target="_blank" rel="noopener" class="edgar-link">
        SEC 13F-HR ↗
      </a>
    </div>
  </div>
  <div class="stats">
    <div class="stat">
      <div class="stat-label">AUM Reported</div>
      <div class="stat-value num">{formatUSD(quarter.total_value)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Positions</div>
      <div class="stat-value num">{quarter.position_count}</div>
    </div>
    {priorPeriod && (
      <div class="stat">
        <div class="stat-label">Versus</div>
        <div class="stat-value">{formatPeriod(priorPeriod)}</div>
      </div>
    )}
  </div>
</header>

<style>
  .fund-header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
    margin-bottom: 24px;
  }
  .lead {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }
  .lead-text { flex: 1; min-width: 200px; }
  .lead-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent);
    margin-bottom: 4px;
  }
  .fund-header h1 {
    margin: 0 0 4px;
    font-size: 1.5rem;
    color: var(--fg);
    font-weight: 600;
  }
  .fund-name {
    color: var(--fg-muted);
    font-size: 0.95rem;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--fg-muted);
  }
  .period { color: var(--fg); }
  .edgar-link { font-size: 0.75rem; }
  .stats {
    display: flex;
    gap: 32px;
    margin-top: 20px;
    flex-wrap: wrap;
  }
  .stat-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--fg-muted);
    margin-bottom: 2px;
  }
  .stat-value {
    font-size: 1.1rem;
    color: var(--fg);
    font-weight: 600;
  }
  .num { font-family: var(--font-mono); }

  @media (max-width: 600px) {
    .meta { text-align: left; width: 100%; }
    .stats { gap: 20px; }
  }
</style>
```

- [ ] **Step 2: Preview**

Run dev server if not running: `npm run dev`
Open: `http://localhost:4321/funds/situational-awareness/`
Expected:
- Top of fund detail page now shows: large circular headshot of Leopold + "LEAD INVESTOR" amber label + "Leopold Aschenbrenner" as the page heading + "Situational Awareness LP" as a subtitle
- Filing meta (period, filed date, SEC link) appears top-right
- Stats row below shows AUM Reported, Positions, Versus (prior period), each with mono uppercase label and large value

- [ ] **Step 3: Commit**

```bash
git add src/components/FundHeader.astro
git commit -m "feat: restructure FundHeader with Lead Investor presentation"
```

---

## Task 8: Migrate [slug].astro to Layout

**Files:**
- Modify: `src/pages/funds/[slug].astro`

- [ ] **Step 1: Replace the file**

Replace `src/pages/funds/[slug].astro` with:

```astro
---
import Layout from '../../components/Layout.astro';
import FundHeader from '../../components/FundHeader.astro';
import ChangeHero from '../../components/ChangeHero.astro';
import SectorDeltaBars from '../../components/SectorDeltaBars.astro';
import MovementTable from '../../components/MovementTable.astro';
import HoldingsTable from '../../components/HoldingsTable.astro';
import ContactCTA from '../../components/ContactCTA.astro';
import {
  loadFunds, loadFundQuarters, loadFiling, loadDiff, loadSecurities,
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
<Layout title={`${fund.name} — 13f-changes`} width="default">
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
    unchangedOnly={diff.prior_period !== null}
    unchangedCusips={unchangedCusips}
  />

  <footer class="methodology">
    <strong>Methodology:</strong> Data from SEC 13F-HR filings. GICS sector/industry via OpenFIGI + Yahoo Finance. Themes assigned editorially per-fund. <a href="/about">More →</a>
  </footer>

  <ContactCTA />
</Layout>

<style>
  .topnav {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    margin-bottom: 16px;
  }
  .topnav a { color: var(--fg-muted); }
  .topnav a:hover { color: var(--accent); text-decoration: none; }
  .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .section-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 24px 0 12px;
  }
  .movements { margin-bottom: 24px; }
  .methodology {
    font-size: 0.75rem;
    color: var(--fg-muted);
    line-height: 1.5;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    margin-top: 32px;
  }
  @media (max-width: 700px) {
    .breakdown-grid { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Preview**

Open: `http://localhost:4321/funds/situational-awareness/` and `http://localhost:4321/funds/duquesne/`
Expected: Pages render with site header strip, the new FundHeader from Task 7, then the ChangeHero / breakdown grid / movement tables / holdings table — note these are still light-themed (next tasks).

- [ ] **Step 3: Commit**

```bash
git add src/pages/funds/[slug].astro
git commit -m "feat: migrate fund detail page to Layout"
```

---

## Task 9: Restyle ChangeHero.astro

**Files:**
- Modify: `src/components/ChangeHero.astro`

- [ ] **Step 1: Replace scoped styles + minor markup**

Replace the entire file with:

```astro
---
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
      <span class="net">net <span class={netFlow >= 0 ? 'up' : 'down'}>{flowSign}{formatUSD(Math.abs(netFlow))}</span></span>
    </div>
  </section>
)}

<style>
  .hero {
    background: var(--bg-elev);
    border-left: 3px solid var(--accent);
    padding: 16px 18px;
    margin-bottom: 24px;
    border-radius: 0 4px 4px 0;
  }
  .first-filing {
    background: var(--bg-elev);
    border-left-color: var(--fg-dim);
  }
  .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  .summary {
    font-size: 1rem;
    line-height: 1.5;
    margin: 0 0 12px;
    color: var(--fg);
  }
  .banner { color: var(--fg-muted); margin: 0; }
  .counts {
    display: flex;
    gap: 20px;
    font-size: 0.875rem;
    color: var(--fg);
    flex-wrap: wrap;
  }
  .counts strong { font-family: var(--font-mono); }
  .up { color: var(--pos); }
  .down { color: var(--neg); }
  .muted { color: var(--fg-muted); }
  .net { font-weight: 600; font-family: var(--font-mono); }
</style>
```

- [ ] **Step 2: Preview**

Open: `http://localhost:4321/funds/situational-awareness/`
Expected: The hero block (right under the fund header) now has dark elevated background, amber left border, amber uppercase mono label "WHAT CHANGED THIS QUARTER", green/red counts.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChangeHero.astro
git commit -m "feat: dark theme for ChangeHero"
```

---

## Task 10: Restyle SectorDeltaBars.astro

**Files:**
- Modify: `src/components/SectorDeltaBars.astro`

- [ ] **Step 1: Replace the file**

```astro
---
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
            <div class={`row-value num ${isPositive ? 'pos' : 'neg'}`}>
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
  .delta-panel {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 14px;
  }
  .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }
  .bars { font-size: 0.8rem; }
  .bar-row {
    display: grid;
    grid-template-columns: 130px 1fr 60px;
    align-items: center;
    margin-bottom: 6px;
  }
  .row-label {
    text-align: right;
    padding-right: 10px;
    color: var(--fg);
    font-size: 0.8rem;
  }
  .bar-track { position: relative; height: 14px; }
  .bar-track::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--border-strong);
  }
  .bar { position: absolute; height: 14px; top: 0; }
  .bar.pos { background: var(--pos); }
  .bar.neg { background: var(--neg); }
  .row-value { font-family: var(--font-mono); }
  .row-value.pos { color: var(--pos); font-weight: 600; }
  .row-value.neg { color: var(--neg); font-weight: 600; }
  .centerline-note {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--fg-dim);
    text-align: center;
    margin-top: 8px;
  }
  .empty {
    color: var(--fg-dim);
    font-size: 0.8rem;
    font-style: italic;
  }
</style>
```

- [ ] **Step 2: Preview**

Open: `http://localhost:4321/funds/situational-awareness/`
Expected: The Sector shifts and Theme shifts panels now have dark background, brighter green/red bars, amber section labels.

- [ ] **Step 3: Commit**

```bash
git add src/components/SectorDeltaBars.astro
git commit -m "feat: dark theme for SectorDeltaBars"
```

---

## Task 11: Restyle MovementTable.astro

**Files:**
- Modify: `src/components/MovementTable.astro`

- [ ] **Step 1: Replace the file**

```astro
---
import { formatUSD, formatPct } from '../lib/format';
import type { MovementRow } from '../../scripts/types';

interface Props {
  status: 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED';
  rows: MovementRow[];
}
const { status, rows } = Astro.props;

const styles = {
  NEW: { tone: 'pos', label: 'NEW POSITIONS' },
  INCREASED: { tone: 'pos', label: '↑ INCREASED' },
  DECREASED: { tone: 'neg', label: '↓ DECREASED' },
  CLOSED: { tone: 'neg', label: 'CLOSED' },
}[status];

const totalDelta = rows.reduce((s, r) => s + r.delta_value, 0);
const summaryText =
  status === 'NEW' ? `+${formatUSD(totalDelta)} deployed` :
  status === 'CLOSED' ? `${formatUSD(Math.abs(totalDelta))} exited` :
  status === 'INCREASED' ? `+${formatUSD(totalDelta)} added` :
  `${formatUSD(Math.abs(totalDelta))} trimmed`;
---
{rows.length === 0 ? null : (
  <section class={`movement movement-${styles.tone}`}>
    <header>
      <span class="status-label">{styles.label} ({rows.length})</span>
      <span class="net">{summaryText}</span>
    </header>
    <table>
      <tbody>
        {rows.map((r) => (
          <tr>
            <td class="ticker">{r.ticker ?? r.cusip}</td>
            <td>{r.name}</td>
            <td class="muted">{r.sector} / {r.industry}</td>
            <td class="muted">{r.tags.join(', ')}</td>
            <td class="num muted">
              {status === 'NEW' && r.current_value !== null && formatUSD(r.current_value)}
              {status === 'CLOSED' && r.prior_value !== null && `was ${formatUSD(r.prior_value)}`}
              {(status === 'INCREASED' || status === 'DECREASED') && r.delta_pct !== null &&
                `${r.delta_pct > 0 ? '+' : ''}${formatPct(r.delta_pct)}`}
            </td>
            <td class={`num delta delta-${styles.tone}`}>
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
  .movement {
    border: 1px solid var(--border);
    border-radius: 4px;
    margin-bottom: 12px;
    overflow: hidden;
    background: var(--bg-elev);
  }
  .movement-pos { border-left: 3px solid var(--pos); }
  .movement-neg { border-left: 3px solid var(--neg); }
  header {
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: var(--bg-tinted);
    border-bottom: 1px solid var(--border);
  }
  .movement-pos .status-label { color: var(--pos); }
  .movement-neg .status-label { color: var(--neg); }
  header .net {
    color: var(--fg-muted);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font-mono);
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.825rem; }
  tr { border-bottom: 1px solid var(--border); }
  tr:last-child { border-bottom: none; }
  tr:hover { background: var(--bg-tinted); }
  td { padding: 6px 12px; color: var(--fg); }
  td.num { text-align: right; font-family: var(--font-mono); }
  td.muted { color: var(--fg-muted); font-size: 0.8rem; }
  td.ticker { font-family: var(--font-mono); font-weight: 600; color: var(--fg); }
  td.delta { font-weight: 600; }
  td.delta-pos { color: var(--pos); }
  td.delta-neg { color: var(--neg); }
</style>
```

- [ ] **Step 2: Preview**

Open: `http://localhost:4321/funds/situational-awareness/`
Expected: Each movement section (NEW / INCREASED / DECREASED / CLOSED) has a dark elevated background, a colored 3px left-border (green for positive, red for negative), uppercase mono header in green/red, ticker in mono bold.

- [ ] **Step 3: Commit**

```bash
git add src/components/MovementTable.astro
git commit -m "feat: dark theme for MovementTable"
```

---

## Task 12: Restyle HoldingsTable.astro

**Files:**
- Modify: `src/components/HoldingsTable.astro`

- [ ] **Step 1: Replace the file**

```astro
---
import { formatUSD, formatShares, formatPct } from '../lib/format';
import type { FilingFile, SecuritiesFile } from '../../scripts/types';

interface Props {
  filing: FilingFile;
  securities: SecuritiesFile;
  unchangedOnly: boolean;
  unchangedCusips?: Set<string>;
}
const { filing, securities, unchangedOnly, unchangedCusips } = Astro.props;
const positions = unchangedOnly && unchangedCusips
  ? filing.positions.filter(p => unchangedCusips.has(p.cusip))
  : filing.positions;
const total = filing.total_value || 1;
const totalUnchanged = positions.reduce((s, p) => s + p.value, 0);
---
<details>
  <summary>
    <strong>{positions.length} {positions.length === 1 ? 'position' : 'positions'} held steady</strong>
    · <span class="num">{formatUSD(totalUnchanged)}</span> ({formatPct((totalUnchanged / total) * 100)} of AUM)
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
            <td class="ticker">{sec?.ticker ?? p.cusip}</td>
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
  details {
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 12px 14px;
    margin-bottom: 16px;
    background: var(--bg-elev);
  }
  summary {
    cursor: pointer;
    font-size: 0.825rem;
    color: var(--fg);
    list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before {
    content: '▸ ';
    color: var(--accent);
    font-family: var(--font-mono);
  }
  details[open] summary::before { content: '▾ '; }
  .hint {
    color: var(--fg-dim);
    font-style: italic;
    margin-left: 6px;
    font-size: 0.75rem;
  }
  .num { font-family: var(--font-mono); }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-top: 12px;
  }
  th {
    text-align: left;
    padding: 6px 10px;
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent);
    border-bottom: 1px solid var(--border-strong);
  }
  td { padding: 5px 10px; border-bottom: 1px solid var(--border); }
  tr:last-child td { border-bottom: none; }
  td.num, th.num { text-align: right; font-family: var(--font-mono); }
  td.muted { color: var(--fg-muted); }
  td.ticker { font-family: var(--font-mono); font-weight: 600; }
</style>
```

- [ ] **Step 2: Preview**

Open: `http://localhost:4321/funds/situational-awareness/`
Expected: The "Held steady" section is now a dark elevated card with hairline border (no more dashed). Click to expand — the inner table is dark with mono numerics and amber column headers. The disclosure triangle is amber.

- [ ] **Step 3: Commit**

```bash
git add src/components/HoldingsTable.astro
git commit -m "feat: dark theme for HoldingsTable"
```

---

## Task 13: Restyle ContactCTA.astro

**Files:**
- Modify: `src/components/ContactCTA.astro`

- [ ] **Step 1: Replace the file**

```astro
---
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
  .cta {
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 16px;
    text-align: center;
    margin: 40px 0;
    background: var(--bg-elev);
  }
  .cta p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-muted);
  }
  .cta a { color: var(--accent); }
  .cta a:hover { color: var(--accent-hover); text-decoration: underline; }
</style>
```

- [ ] **Step 2: Preview**

Open: `http://localhost:4321/` and `http://localhost:4321/funds/situational-awareness/`
Expected: The "Want a fund added?" callout is now a dark elevated card with amber link. No more blue.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContactCTA.astro
git commit -m "feat: dark theme for ContactCTA"
```

---

## Task 14: Migrate about.astro to Layout

**Files:**
- Modify: `src/pages/about.astro`

- [ ] **Step 1: Replace the file**

```astro
---
import Layout from '../components/Layout.astro';
import ContactCTA from '../components/ContactCTA.astro';
---
<Layout title="About — 13f-changes" width="narrow">
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
</Layout>

<style>
  .topnav {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    margin-bottom: 16px;
  }
  .topnav a { color: var(--fg-muted); }
  .topnav a:hover { color: var(--accent); text-decoration: none; }
  article { line-height: 1.6; }
  h1 {
    font-size: 1.5rem;
    color: var(--fg);
    margin: 0 0 16px;
  }
  h2 {
    font-size: 1.05rem;
    margin-top: 28px;
    color: var(--accent);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  p, li { color: var(--fg); }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
  code {
    font-family: var(--font-mono);
    background: var(--bg-elev);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
    color: var(--fg);
  }
  em { color: var(--fg-muted); font-style: italic; }
  strong { color: var(--fg); }
</style>
```

- [ ] **Step 2: Preview**

Open: `http://localhost:4321/about`
Expected: About page with site header strip, dark theme, h2 headings in amber mono uppercase, body text readable on dark background.

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat: dark theme for about page via Layout"
```

---

## Task 15: Final verification — full site walkthrough

**Files:** none modified

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: All existing tests pass.

- [ ] **Step 2: Run a full build**

Run: `npm run build`
Expected: Build succeeds, no warnings about missing imports or invalid HTML.

- [ ] **Step 3: Walk through every page on the dev server**

Run: `npm run dev` (if not already running)

For each URL below, verify the listed items:

**`http://localhost:4321/`** (homepage)
- [ ] Site header strip with "13f-changes" wordmark + About link
- [ ] Page heading "13f-changes" in amber mono
- [ ] Funds table with avatars next to manager names
- [ ] Numbers right-aligned and monospaced
- [ ] Top-changes chips colored green/red appropriately
- [ ] Hover row lightens
- [ ] No blue links anywhere
- [ ] No dashed borders

**`http://localhost:4321/funds/situational-awareness/`** (fund detail with prior-period diff)
- [ ] Site header strip
- [ ] FundHeader with large headshot, "LEAD INVESTOR" amber label, manager name as h1, fund name as subtitle
- [ ] Filing meta top-right
- [ ] Stats row: AUM Reported / Positions / Versus
- [ ] ChangeHero with amber left-border, green/red counts
- [ ] Sector and Theme shifts side-by-side, dark panels with bright bars
- [ ] Movement sections: NEW (green left-border), INCREASED (green), DECREASED (red), CLOSED (red)
- [ ] Holdings table: dark with hairline border, amber disclosure triangle, mono numerics

**`http://localhost:4321/funds/duquesne/`** (fund detail; check that initials fallback works if photo missing — but Duquesne has a photo too, so this also serves as second-fund visual check)
- [ ] All same as situational-awareness page, with Stanley's photo

**`http://localhost:4321/about`**
- [ ] Site header strip
- [ ] Narrow column (720px max)
- [ ] H2 headings in amber mono uppercase
- [ ] Code spans in dark elevated background

- [ ] **Step 4: Resize-test**

In the browser dev tools, resize to:
- 1200px (desktop): everything as designed
- 768px (tablet): two-column breakdown grid collapses to single column at <700px
- 375px (phone): site header strip remains usable; FundHeader avatar and meta wrap; stats row wraps

Verify there's no horizontal scroll on any page at 375px.

- [ ] **Step 5: Test the initials fallback manually**

Temporarily edit `data/funds.json` and remove the `manager_photo` line from one fund. Reload. Verify the initials fallback (gradient circle with initials) renders cleanly. Restore the file.

- [ ] **Step 6: Final commit (if anything was tweaked during walkthrough)**

If any small adjustments were needed, commit them:

```bash
git add -A
git commit -m "fix: minor visual adjustments from final walkthrough"
```

If nothing needed adjusting, skip this step.

- [ ] **Step 7: Verify clean working tree**

Run: `git status`
Expected: working tree clean.

---

## Done

The site is now fully on the dark Terminal theme with lead-investor headshots and consistent UI improvements across homepage, fund detail, and about pages.
