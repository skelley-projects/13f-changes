# Granular Theme-Shifts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deeper-granularity theme classification layer to 13f-changes — hierarchical taxonomy with `parent` field, new `granular_breakdown` in each diff, full-width "Granular theme shifts" panel on the fund detail page, and Themes + Granular columns on the movement and holdings tables.

**Architecture:** One taxonomy file per fund (`data/funds/<slug>/tags.json`) gains an optional `parent` field on each tag, defining a 2-level hierarchy (top-level themes + sub-tags). `compute-diff.ts` aggregates positions twice — once at the broad layer (rolling sub-tags up to their parents, de-duplicated) and once at the granular layer (sub-tags only, partial coverage). Both breakdowns + a coverage % land in the precomputed diff JSON. The Astro page reads them and renders panels + table columns.

**Tech Stack:** Astro 6, TypeScript, Zod (validation), Vitest (tests). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-04-granular-theme-shifts-design.md`

---

## File Structure

### Modified

| File | Reason |
|---|---|
| `scripts/types.ts` | Add `parent?: TagId` to `TaxonomyEntry`; add `granular_breakdown` and `granular_coverage_pct` to `DiffFile` |
| `scripts/validate-data.ts` | Validate parent reference, depth, and self-reference rules |
| `scripts/compute-diff.ts` | Add parent roll-up logic to broad theme breakdown; add granular breakdown computation; add coverage stat |
| `tests/compute-diff.test.ts` | Add 4+ test cases for the new logic |
| `data/funds/situational-awareness/tags.json` | Add 8 sub-tag taxonomy entries; append granular assignments for matching positions |
| `data/funds/situational-awareness/diff/2025-Q4.json` | Regenerated automatically via `tsx scripts/run-compute-diff.ts` |
| `data/funds/duquesne/diff/2025-Q4.json` | Regenerated automatically (still has `null` granular fields — no sub-tags) |
| `src/pages/funds/[slug].astro` | Load taxonomy via `loadFundTags`, pass to table components, render granular panel below 2-col grid |
| `src/components/MovementTable.astro` | Accept `taxonomy` prop, change "Themes" column to broad-only, add "Granular" column |
| `src/components/HoldingsTable.astro` | Accept `taxonomy` prop, add "Themes" + "Granular" columns |

### Not touched

- `data/securities.json`, `data/_pending.json`
- `src/lib/data.ts` (already exposes `loadFundTags`)
- `src/components/Layout.astro`, `ManagerAvatar.astro`, `ChangeHero.astro`, `SectorDeltaBars.astro`, `ContactCTA.astro`, `FundHeader.astro`
- `src/pages/index.astro`, `src/pages/about.astro`
- `wrangler.toml`, `astro.config.mjs`, `package.json`

---

## Task 1: Extend taxonomy schema with `parent` field

**Files:**
- Modify: `scripts/types.ts` (the `TaxonomyEntry` interface, lines ~70-74)
- Modify: `scripts/validate-data.ts` (the `tagsFileSchema`, find via grep)

- [ ] **Step 1: Update the TaxonomyEntry interface**

In `scripts/types.ts`, replace the `TaxonomyEntry` interface with:

```typescript
export interface TaxonomyEntry {
  id: TagId;
  label: string;
  description: string;
  /** Points to another tag's id in the same fund's taxonomy. Absent = top-level tag. */
  parent?: TagId;
}
```

- [ ] **Step 2: Find the existing Zod schema for tags.json**

Run: `grep -n "tagsFileSchema\|taxonomy:" scripts/validate-data.ts`
Expected: locate the schema block (likely uses `z.object({ id, label, description })` for taxonomy entries).

- [ ] **Step 3: Update the Zod schema**

Replace the taxonomy entry schema with one that includes `parent` and add a `.superRefine` block for the per-fund validation rules. The exact location depends on how the file is structured — find the existing `taxonomy: z.array(...)` and replace its inner shape:

```typescript
const taxonomyEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  parent: z.string().optional(),
});

const tagsFileSchema = z.object({
  slug: z.string().min(1),
  taxonomy: z.array(taxonomyEntrySchema),
  assignments: z.record(z.string(), z.array(z.string())),
}).superRefine((data, ctx) => {
  const ids = new Set(data.taxonomy.map(t => t.id));
  const parentMap = new Map(data.taxonomy.map(t => [t.id, t.parent]));
  for (const tag of data.taxonomy) {
    if (tag.parent === undefined) continue;
    // Self-reference
    if (tag.parent === tag.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxonomy'],
        message: `tag "${tag.id}" cannot be its own parent`,
      });
      continue;
    }
    // Parent exists
    if (!ids.has(tag.parent)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxonomy'],
        message: `tag "${tag.id}" parent "${tag.parent}" does not exist in taxonomy`,
      });
      continue;
    }
    // Max depth = 2 (parent must itself be top-level)
    if (parentMap.get(tag.parent) !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxonomy'],
        message: `tag "${tag.id}" parent "${tag.parent}" must be a top-level tag (no grandchildren)`,
      });
    }
  }
});
```

If `tagsFileSchema` already exists, replace it entirely. If only the inner schema exists inline (e.g., directly inside another structure), refactor it into the named `tagsFileSchema` shown above and update its consumers.

- [ ] **Step 4: Run validation against existing data**

Run: `npm run validate`
Expected: validation passes. Existing taxonomies have no `parent` fields, which is allowed (optional).

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all 43 tests still pass. The schema change is backward-compatible.

- [ ] **Step 6: Commit**

```bash
git add scripts/types.ts scripts/validate-data.ts
git commit -m "feat: add parent field to TaxonomyEntry with 2-level depth validation"
```

---

## Task 2: Add parent roll-up and granular breakdown to compute-diff

**Files:**
- Modify: `scripts/types.ts` (the `DiffFile` interface)
- Modify: `scripts/compute-diff.ts`
- Modify: `tests/compute-diff.test.ts`

- [ ] **Step 1: Extend DiffFile interface**

In `scripts/types.ts`, find the `DiffFile` interface and add two new fields. Locate the existing `theme_breakdown: Breakdown | null;` line and add immediately after it:

```typescript
  granular_breakdown: Breakdown | null;     // null when fund has zero sub-tags or zero granularly-tagged positions
  granular_coverage_pct: number | null;     // 0-100, null when granular_breakdown is null
```

- [ ] **Step 2: Write failing tests for the new logic**

Edit `tests/compute-diff.test.ts`. The existing file likely already imports `describe`, `it`, `expect` from vitest and `computeDiff` from compute-diff. Skip the duplicate imports if so — only add ones that aren't already present at the top. Then append this `describe` block to the end of the file:

```typescript
// (Imports below should only be added if not already present at the top of the file.)
import { describe, it, expect } from 'vitest';
import { computeDiff } from '../scripts/compute-diff.js';
import type { FilingFile, SecuritiesFile, TagsFile, Position } from '../scripts/types.js';

function pos(cusip: string, value: number, shares = 100): Position {
  return {
    cusip,
    name_of_issuer: cusip,
    title_of_class: 'COM',
    shares,
    shares_type: 'SH',
    value,
    put_call: null,
    investment_discretion: 'SOLE',
    voting_sole: shares,
    voting_shared: 0,
    voting_none: 0,
  };
}

function filing(period: string, positions: Position[]): FilingFile {
  return {
    slug: 'test',
    period,
    period_ending: '2025-12-31',
    filing_date: '2026-02-15',
    accession: '0000000000-00-000000',
    edgar_url: 'https://example.com',
    value_units: 'USD',
    schema_version: 'X02',
    total_value: positions.reduce((s, p) => s + p.value, 0),
    position_count: positions.length,
    positions,
  };
}

const emptySecurities: SecuritiesFile = {};

describe('computeDiff: granular theme breakdown', () => {
  const tags: TagsFile = {
    slug: 'test',
    taxonomy: [
      { id: 'ai-compute', label: 'AI compute', description: '' },
      { id: 'photonics', label: 'Photonics', description: '', parent: 'ai-compute' },
      { id: 'ai-applications', label: 'AI applications', description: '' },
    ],
    assignments: {
      'A111': ['photonics'],          // sub-tag only — rolls up to ai-compute
      'B222': ['ai-compute'],         // top-level only — appears in broad, not granular
      'C333': ['ai-compute', 'photonics'], // both — counts once in broad (de-duped)
      'D444': ['ai-applications'],    // top-level only, different theme
      'E555': [],                     // untagged — appears in neither
    },
  };

  it('rolls sub-tags up to parents in theme_breakdown without double-counting', () => {
    const current = filing('2025-Q4', [
      pos('A111', 100),
      pos('B222', 200),
      pos('C333', 400),
      pos('D444', 50),
    ]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags });
    const aiCompute = diff.theme_breakdown!.current.find(e => e.label === 'AI compute');
    const aiApps = diff.theme_breakdown!.current.find(e => e.label === 'AI applications');
    // A (photonics → ai-compute) + B (ai-compute) + C (both → ai-compute once) = 700
    expect(aiCompute?.value).toBe(700);
    expect(aiApps?.value).toBe(50);
    // Photonics SHOULD NOT appear in theme_breakdown — it's a sub-tag, rolled up only
    const photonics = diff.theme_breakdown!.current.find(e => e.label === 'Photonics');
    expect(photonics).toBeUndefined();
  });

  it('aggregates only sub-tagged positions into granular_breakdown', () => {
    const current = filing('2025-Q4', [
      pos('A111', 100),  // photonics
      pos('B222', 200),  // ai-compute (top-level only — excluded)
      pos('C333', 400),  // photonics (also top-level)
      pos('D444', 50),   // ai-applications (top-level only — excluded)
    ]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags });
    expect(diff.granular_breakdown).not.toBeNull();
    const photonics = diff.granular_breakdown!.current.find(e => e.label === 'Photonics');
    expect(photonics?.value).toBe(500);  // A + C
    // No top-level tags in granular_breakdown
    const aiCompute = diff.granular_breakdown!.current.find(e => e.label === 'AI compute');
    expect(aiCompute).toBeUndefined();
  });

  it('computes granular_coverage_pct as the share of AUM with at least one sub-tag', () => {
    const current = filing('2025-Q4', [
      pos('A111', 100),  // photonics — counts
      pos('B222', 200),  // top-level only — does not count
      pos('C333', 400),  // photonics — counts
      pos('D444', 50),   // top-level only — does not count
    ]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags });
    // (100 + 400) / 750 = 0.6667
    expect(diff.granular_coverage_pct).toBeCloseTo(66.67, 1);
  });

  it('returns null granular_breakdown when no sub-tags are defined', () => {
    const flatTags: TagsFile = {
      slug: 'test',
      taxonomy: [
        { id: 'ai-compute', label: 'AI compute', description: '' },
      ],
      assignments: { 'A111': ['ai-compute'] },
    };
    const current = filing('2025-Q4', [pos('A111', 100)]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags: flatTags });
    expect(diff.granular_breakdown).toBeNull();
    expect(diff.granular_coverage_pct).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npm test -- compute-diff`
Expected: 4 new tests fail. The existing tests still pass.

- [ ] **Step 4: Implement the new logic in compute-diff.ts**

In `scripts/compute-diff.ts`:

1. Locate the `buildThemeBreakdown` function and replace it entirely:

```typescript
function buildThemeBreakdown(
  current: FilingFile,
  prior: FilingFile | null,
  tags: TagsFile,
): Breakdown | null {
  if (tags.taxonomy.length === 0) return null;
  const labelById = new Map(tags.taxonomy.map(t => [t.id, t.label]));
  const parentById = new Map(tags.taxonomy.map(t => [t.id, t.parent]));

  // Resolve a position's tag ids to the SET of broad theme labels it counts toward.
  // Sub-tags are rolled up to their parent. Top-level tags map to themselves.
  // De-duplicated so a position tagged ["ai-compute", "photonics"] counts toward
  // "AI compute" exactly once.
  const broadLabelsForPosition = (cusip: string): Set<string> => {
    const labels = new Set<string>();
    const ids = tags.assignments[cusip] ?? [];
    for (const id of ids) {
      const parent = parentById.get(id);
      const broadId = parent ?? id;
      const label = labelById.get(broadId);
      if (label) labels.add(label);
    }
    return labels;
  };

  const aggregateBroad = (filing: FilingFile): Map<string, number> => {
    const out = new Map<string, number>();
    for (const p of filing.positions) {
      for (const label of broadLabelsForPosition(p.cusip)) {
        out.set(label, (out.get(label) ?? 0) + p.value);
      }
    }
    return out;
  };

  const currentMix = aggregateBroad(current);
  const priorMix = prior ? aggregateBroad(prior) : new Map<string, number>();
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

2. Add a new `buildGranularBreakdown` function below `buildThemeBreakdown`:

```typescript
function buildGranularBreakdown(
  current: FilingFile,
  prior: FilingFile | null,
  tags: TagsFile,
): { breakdown: Breakdown | null; coverage_pct: number | null } {
  const subTagIds = new Set(
    tags.taxonomy.filter(t => t.parent !== undefined).map(t => t.id),
  );
  if (subTagIds.size === 0) {
    return { breakdown: null, coverage_pct: null };
  }
  const labelById = new Map(tags.taxonomy.map(t => [t.id, t.label]));

  const aggregateGranular = (filing: FilingFile): Map<string, number> => {
    const out = new Map<string, number>();
    for (const p of filing.positions) {
      const ids = tags.assignments[p.cusip] ?? [];
      for (const id of ids) {
        if (!subTagIds.has(id)) continue;
        const label = labelById.get(id);
        if (!label) continue;
        out.set(label, (out.get(label) ?? 0) + p.value);
      }
    }
    return out;
  };

  // Coverage: % of current AUM held by positions that have at least one sub-tag.
  let coveredValue = 0;
  for (const p of current.positions) {
    const ids = tags.assignments[p.cusip] ?? [];
    if (ids.some(id => subTagIds.has(id))) coveredValue += p.value;
  }
  const coveragePct = current.total_value > 0
    ? (coveredValue / current.total_value) * 100
    : 0;

  const currentMix = aggregateGranular(current);
  if (currentMix.size === 0 && (!prior || aggregateGranular(prior).size === 0)) {
    return { breakdown: null, coverage_pct: null };
  }
  const priorMix = prior ? aggregateGranular(prior) : new Map<string, number>();
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
  return {
    breakdown: { current: currentEntries, prior: priorEntries, deltas },
    coverage_pct: coveragePct,
  };
}
```

3. Update the main `computeDiff` return value to include the new fields. Find the return object (currently returns through `theme_breakdown: buildThemeBreakdown(...)`) and add two more lines:

```typescript
  const granular = buildGranularBreakdown(current, prior, tags);

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
    sector_breakdown: buildBreakdown(current, prior, sectorKey),
    theme_breakdown: buildThemeBreakdown(current, prior, tags),
    granular_breakdown: granular.breakdown,
    granular_coverage_pct: granular.coverage_pct,
  };
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `npm test`
Expected: all tests pass — both the new 4 and any existing compute-diff tests.

- [ ] **Step 6: Regenerate diff JSON files for both funds**

The on-disk diff files need the new fields populated (even as null) so that the page renders don't fail at runtime due to missing fields.

```bash
tsx scripts/run-compute-diff.ts situational-awareness 2025-Q4
tsx scripts/run-compute-diff.ts duquesne 2025-Q4
```

Expected: each command prints `wrote data/funds/<slug>/diff/2025-Q4.json`.

- [ ] **Step 7: Verify the regenerated diffs**

Run: `grep -E "granular_breakdown|granular_coverage_pct" data/funds/situational-awareness/diff/2025-Q4.json`
Expected: both fields appear in the file. Both should be `null` at this point since no sub-tags exist yet in the taxonomy.

- [ ] **Step 8: Run build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add scripts/types.ts scripts/compute-diff.ts tests/compute-diff.test.ts data/funds/
git commit -m "feat: parent roll-up + granular_breakdown in compute-diff"
```

---

## Task 3: Add sub-tag taxonomy entries to Situational Awareness

**Files:**
- Modify: `data/funds/situational-awareness/tags.json`

- [ ] **Step 1: Read the current taxonomy**

Read `data/funds/situational-awareness/tags.json` to confirm its current structure.

- [ ] **Step 2: Append 8 sub-tag entries to the taxonomy array**

Replace the `taxonomy` array in `data/funds/situational-awareness/tags.json` with this expanded list (preserves all existing entries; appends 8 new sub-tags after them):

```json
"taxonomy": [
  {
    "id": "ai-compute",
    "label": "AI compute",
    "description": "GPU/accelerator chips, AI servers, foundries, HBM/storage media for AI workloads, optical interconnects."
  },
  {
    "id": "ai-infra-power",
    "label": "AI infrastructure - power",
    "description": "Power generation, fuel cells, nuclear, gas peakers, nat-gas E&P, generators, and grid hardware aimed at AI data centers."
  },
  {
    "id": "ai-infra-cooling",
    "label": "AI infrastructure - cooling",
    "description": "Cooling systems, datacenter HVAC, immersion cooling."
  },
  {
    "id": "ai-infra-datacenter",
    "label": "AI infrastructure - datacenter",
    "description": "Datacenter REITs, networking, hardware, colocation/hosting infrastructure aimed at AI tenants."
  },
  {
    "id": "bitcoin-mining",
    "label": "Bitcoin mining",
    "description": "Companies whose primary business is bitcoin/crypto mining (often dual-classified with ai-infra-power because of GPU/HPC pivot)."
  },
  {
    "id": "hyperscalers",
    "label": "Hyperscalers",
    "description": "Big-tech cloud platforms (AWS, Azure, GCP) and the public companies that operate them."
  },
  {
    "id": "ai-applications",
    "label": "AI applications",
    "description": "Software/services that consume AI."
  },
  {
    "id": "photonics",
    "label": "Photonics",
    "description": "Optical interconnects, transceivers, silicon photonics, lasers — components specific to high-bandwidth data center networking.",
    "parent": "ai-compute"
  },
  {
    "id": "hbm-memory",
    "label": "HBM memory",
    "description": "High-bandwidth memory (HBM) chips and the DRAM makers producing them — a known supply bottleneck for AI accelerators.",
    "parent": "ai-compute"
  },
  {
    "id": "ai-foundry",
    "label": "AI foundries",
    "description": "Pure-play foundries fabricating leading-edge AI chips (e.g., TSMC).",
    "parent": "ai-compute"
  },
  {
    "id": "gpu-accelerator",
    "label": "GPU / accelerator",
    "description": "The GPU and custom-accelerator vendors themselves (NVIDIA, AMD, etc.) as opposed to suppliers further up the stack.",
    "parent": "ai-compute"
  },
  {
    "id": "nuclear-power",
    "label": "Nuclear power",
    "description": "Existing fission generation and the next-gen nuclear plays specifically positioned for AI-load growth.",
    "parent": "ai-infra-power"
  },
  {
    "id": "gas-power",
    "label": "Gas peakers / nat-gas E&P",
    "description": "Gas-fired peaker plants and the natural gas exploration & production companies feeding them.",
    "parent": "ai-infra-power"
  },
  {
    "id": "grid-hardware",
    "label": "Grid hardware",
    "description": "Transformers, switchgear, transmission equipment that lets new AI loads connect to the grid.",
    "parent": "ai-infra-power"
  },
  {
    "id": "datacenter-reit",
    "label": "Datacenter REITs",
    "description": "Public datacenter REITs (Equinix, Digital Realty, etc.) as opposed to networking gear or colocation services.",
    "parent": "ai-infra-datacenter"
  }
]
```

The existing `assignments` block stays as-is for now — Task 4 will append granular tags to it.

- [ ] **Step 3: Run validation**

Run: `npm run validate`
Expected: `ok — 2 funds, 120 securities`. The 8 new entries each have a valid `parent` pointing to an existing top-level tag, so validation passes.

- [ ] **Step 4: Run tests for safety**

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add data/funds/situational-awareness/tags.json
git commit -m "feat: seed Situational Awareness sub-tag taxonomy"
```

---

## Task 4: Add granular assignments + regenerate diffs

**Files:**
- Modify: `data/funds/situational-awareness/tags.json` (the `assignments` map)
- Modify: `data/funds/situational-awareness/diff/2025-Q4.json` (regenerated)

- [ ] **Step 1: Read securities.json to identify CUSIPs by company name**

Read `data/securities.json`. For each CUSIP that already appears in `data/funds/situational-awareness/tags.json` `assignments`, look up the company name (in `securities.json`, each entry has `cusip`, `ticker`, `name`).

- [ ] **Step 2: Map CUSIPs to sub-tags using this keyword table**

For each CUSIP in the existing assignments, check whether the company `name` (case-insensitive) contains any of these keywords. If yes, append the corresponding sub-tag to that CUSIP's tag list.

| Company name keyword (case-insensitive substring) | Sub-tag id to append |
|---|---|
| `Coherent` | `photonics` |
| `Lumentum` | `photonics` |
| `IPG Photonics` | `photonics` |
| `Applied Optoelectronics` | `photonics` |
| `NVIDIA` | `gpu-accelerator` |
| `Advanced Micro Devices` | `gpu-accelerator` |
| `Taiwan Semiconductor` | `ai-foundry` |
| `Constellation Energy` | `nuclear-power` |
| `Cameco` | `nuclear-power` |
| `Vistra` | `nuclear-power` |
| `Talen Energy` | `nuclear-power` |
| `Public Service Enterprise` | `nuclear-power` |
| `Equinix` | `datacenter-reit` |
| `Digital Realty` | `datacenter-reit` |
| `Quanta Services` | `grid-hardware` |
| `Eaton` | `grid-hardware` |
| `GE Vernova` | `grid-hardware` |
| `Hubbell` | `grid-hardware` |
| `EQT Corp` | `gas-power` |
| `Antero` | `gas-power` |
| `Range Resources` | `gas-power` |

Rules:
- Only append; never remove existing tags.
- If a CUSIP doesn't match any keyword, leave its tag list unchanged.
- A single position can match multiple keywords (e.g., a company that's both `Vistra` and a `gas-power` operator would get both `nuclear-power` AND `gas-power` — that's intentional and reflects the dual-classification convention already in use).
- Don't dedupe — if a CUSIP already has a sub-tag (e.g., from a prior run), the second append would create duplicates. To prevent this, check whether the sub-tag is already present before appending.

- [ ] **Step 3: Update tags.json with the new assignments**

Apply the keyword mapping. The exact set of CUSIPs that change depends on the contents of `securities.json` — you'll know the right CUSIPs after reading securities.json. Use Edit calls to update the `assignments` map for each matching CUSIP, appending the sub-tag id to its array.

For example, if CUSIP `19247G107` corresponds to "Coherent Corp", change its assignment from:
```
"19247G107": ["ai-compute"]
```
to:
```
"19247G107": ["ai-compute", "photonics"]
```

Repeat for every CUSIP that matched.

- [ ] **Step 4: Validate**

Run: `npm run validate`
Expected: validation passes.

- [ ] **Step 5: Regenerate the SA diff**

```bash
tsx scripts/run-compute-diff.ts situational-awareness 2025-Q4
```

Expected: `wrote data/funds/situational-awareness/diff/2025-Q4.json`. The new file should now have a non-null `granular_breakdown` with entries like `Photonics`, `GPU / accelerator`, etc., and a non-null `granular_coverage_pct` somewhere between 1 and 100.

- [ ] **Step 6: Spot-check the regenerated diff**

Run: `grep -A 2 "granular_coverage_pct" data/funds/situational-awareness/diff/2025-Q4.json`
Expected: a non-null number (e.g., `"granular_coverage_pct": 47.3`).

Run: `grep -B 1 -A 5 "Photonics" data/funds/situational-awareness/diff/2025-Q4.json`
Expected: at least one match if Coherent/Lumentum/IPG were among the funds — confirms granular breakdown is non-empty.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all 47 tests pass.

- [ ] **Step 8: Commit**

```bash
git add data/funds/situational-awareness/tags.json data/funds/situational-awareness/diff/2025-Q4.json
git commit -m "feat: assign granular sub-tags to Situational Awareness positions"
```

---

## Task 5: Update [slug].astro for granular panel + taxonomy plumbing

**Files:**
- Modify: `src/pages/funds/[slug].astro`

- [ ] **Step 1: Update the imports and data loading**

Replace the existing import of data-loading functions and the data-loading section near the top of the frontmatter. Find the line `import { loadFunds, loadFundQuarters, loadFiling, loadDiff, loadSecurities } from '../../lib/data';` and replace with:

```typescript
import {
  loadFunds, loadFundQuarters, loadFiling, loadDiff, loadSecurities, loadFundTags,
} from '../../lib/data';
```

Then find the line `const securities = loadSecurities();` and add immediately after it:

```typescript
const tagsFile = loadFundTags(slug!);
```

- [ ] **Step 2: Pass taxonomy to MovementTable and HoldingsTable**

Find the four `<MovementTable status="..." rows={...} />` blocks in the template and add a `taxonomy` prop to each:

```astro
<MovementTable status="NEW" rows={diff.movements.new} taxonomy={tagsFile.taxonomy} />
<MovementTable status="INCREASED" rows={diff.movements.increased} taxonomy={tagsFile.taxonomy} />
<MovementTable status="DECREASED" rows={diff.movements.decreased} taxonomy={tagsFile.taxonomy} />
<MovementTable status="CLOSED" rows={diff.movements.closed} taxonomy={tagsFile.taxonomy} />
```

Find the `<HoldingsTable ... />` block and add `taxonomy={tagsFile.taxonomy}`:

```astro
<HoldingsTable
  filing={filing}
  securities={securities}
  unchangedOnly={diff.prior_period !== null}
  unchangedCusips={unchangedCusips}
  taxonomy={tagsFile.taxonomy}
/>
```

- [ ] **Step 3: Add the granular panel below the 2-col grid**

Find the existing `<div class="breakdown-grid">` block. Immediately after its closing `)}` (the conditional that wraps it), add this conditional block:

```astro
{diff.granular_breakdown && (
  <section class="granular-section">
    <div class="coverage-note">
      Granular coverage: {(diff.granular_coverage_pct ?? 0).toFixed(1)}% of AUM
    </div>
    <SectorDeltaBars title="Granular theme shifts" breakdown={diff.granular_breakdown} />
  </section>
)}
```

- [ ] **Step 4: Add scoped styles for the new elements**

In the `<style>` block at the bottom of `[slug].astro`, add the following rules (alongside the existing `.breakdown-grid`, `.section-label`, etc.):

```css
.granular-section {
  margin-top: 28px;
  margin-bottom: 24px;
}
.coverage-note {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent);
  margin-bottom: 10px;
}
```

- [ ] **Step 5: Build to confirm no Astro errors**

Run: `npm run build`
Expected: 4 pages built. No type or template errors.

- [ ] **Step 6: Smoke-check the page**

Open dev server: `npm run dev` (background; or use existing one).
Visit: `http://localhost:5180/funds/situational-awareness/`
Expected: The 2-col Sector + Theme grid is unchanged. Below it, a new "Granular coverage: X%" line appears in amber mono, followed by a full-width "Granular theme shifts" panel with bars for the sub-tags. Page for Duquesne shouldn't show the granular section at all.

- [ ] **Step 7: Commit**

```bash
git add src/pages/funds/[slug].astro
git commit -m "feat: render granular theme-shifts panel on fund detail page"
```

---

## Task 6: Update MovementTable for Themes + Granular columns

**Files:**
- Modify: `src/components/MovementTable.astro`

- [ ] **Step 1: Replace the file**

Replace `src/components/MovementTable.astro` entirely with:

```astro
---
import { formatUSD, formatPct } from '../lib/format';
import type { MovementRow, TaxonomyEntry } from '../../scripts/types';

interface Props {
  status: 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED';
  rows: MovementRow[];
  taxonomy: TaxonomyEntry[];
}
const { status, rows, taxonomy } = Astro.props;

// Build a lookup map from tag id → entry. Used to (a) determine sub-tag vs broad,
// (b) resolve display labels, (c) roll sub-tags up to parents for the Themes col.
const tagById = new Map(taxonomy.map(t => [t.id, t]));

function broadLabelsFor(tagIds: string[]): string[] {
  const labels = new Set<string>();
  for (const id of tagIds) {
    const entry = tagById.get(id);
    if (!entry) continue;
    const broadId = entry.parent ?? entry.id;
    const broadEntry = tagById.get(broadId);
    if (broadEntry) labels.add(broadEntry.label);
  }
  return Array.from(labels);
}

function granularLabelsFor(tagIds: string[]): string[] {
  const labels: string[] = [];
  for (const id of tagIds) {
    const entry = tagById.get(id);
    if (entry?.parent !== undefined) labels.push(entry.label);
  }
  return labels;
}

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
        {rows.map((r) => {
          const broad = broadLabelsFor(r.tags);
          const granular = granularLabelsFor(r.tags);
          return (
            <tr>
              <td class="ticker">{r.ticker ?? r.cusip}</td>
              <td>{r.name}</td>
              <td class="muted">{r.sector} / {r.industry}</td>
              <td class="muted">{broad.length === 0 ? '—' : broad.join(', ')}</td>
              <td class="muted granular">{granular.length === 0 ? '—' : granular.join(', ')}</td>
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
          );
        })}
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

  @media (max-width: 700px) {
    td.granular { display: none; }
  }
</style>
```

- [ ] **Step 2: Build to confirm**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Smoke-check**

Visit: `http://localhost:5180/funds/situational-awareness/`
Expected: each movement section now has a column showing only sub-tag labels (e.g., "Photonics", "GPU / accelerator") for tagged positions, dash for others. The previous tag column now shows broad themes only.

- [ ] **Step 4: Commit**

```bash
git add src/components/MovementTable.astro
git commit -m "feat: split MovementTable themes column into broad + granular"
```

---

## Task 7: Update HoldingsTable for Themes + Granular columns

**Files:**
- Modify: `src/components/HoldingsTable.astro`
- Modify: `src/pages/funds/[slug].astro` (add `assignments` prop on the HoldingsTable invocation, in addition to `taxonomy` from Task 5)

- [ ] **Step 1: Replace the file**

Replace `src/components/HoldingsTable.astro` entirely with:

```astro
---
import { formatUSD, formatShares, formatPct } from '../lib/format';
import type { FilingFile, SecuritiesFile, TaxonomyEntry } from '../../scripts/types';

interface Props {
  filing: FilingFile;
  securities: SecuritiesFile;
  unchangedOnly: boolean;
  unchangedCusips?: Set<string>;
  taxonomy: TaxonomyEntry[];
  /** assignments map from the same fund's tags.json. CUSIP -> tag ids. */
  assignments?: Record<string, string[]>;
}
const { filing, securities, unchangedOnly, unchangedCusips, taxonomy } = Astro.props;
const positions = unchangedOnly && unchangedCusips
  ? filing.positions.filter(p => unchangedCusips.has(p.cusip))
  : filing.positions;
const total = filing.total_value || 1;
const totalUnchanged = positions.reduce((s, p) => s + p.value, 0);

// Note: HoldingsTable does not receive the per-CUSIP tag assignments directly;
// the diff/MovementTable does. Holdings are positions held steady, so we can
// use the same lookup pattern: look up tag ids from the diff or pass them in.
// For now, render dashes — granular tags only appear in MovementTable.
// (The columns are added so the table layout matches MovementTable visually.)

const tagById = new Map(taxonomy.map(t => [t.id, t]));
const assignmentsMap = Astro.props.assignments ?? {};

function broadLabelsFor(cusip: string): string[] {
  const labels = new Set<string>();
  const ids = assignmentsMap[cusip] ?? [];
  for (const id of ids) {
    const entry = tagById.get(id);
    if (!entry) continue;
    const broadId = entry.parent ?? entry.id;
    const broadEntry = tagById.get(broadId);
    if (broadEntry) labels.add(broadEntry.label);
  }
  return Array.from(labels);
}

function granularLabelsFor(cusip: string): string[] {
  const labels: string[] = [];
  const ids = assignmentsMap[cusip] ?? [];
  for (const id of ids) {
    const entry = tagById.get(id);
    if (entry?.parent !== undefined) labels.push(entry.label);
  }
  return labels;
}
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
        <th>Themes</th><th class="granular-col">Granular</th>
        <th class="num">Shares</th><th class="num">Value</th><th class="num">% port</th>
      </tr>
    </thead>
    <tbody>
      {positions.map((p) => {
        const sec = securities[p.cusip];
        const broad = broadLabelsFor(p.cusip);
        const granular = granularLabelsFor(p.cusip);
        return (
          <tr>
            <td class="ticker">{sec?.ticker ?? p.cusip}</td>
            <td>{sec?.name ?? p.name_of_issuer}</td>
            <td class="muted">{sec?.sector ?? '—'}</td>
            <td class="muted">{broad.length === 0 ? '—' : broad.join(', ')}</td>
            <td class="muted granular-col">{granular.length === 0 ? '—' : granular.join(', ')}</td>
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

  @media (max-width: 700px) {
    th.granular-col, td.granular-col { display: none; }
  }
</style>
```

- [ ] **Step 2: Pass `assignments` from [slug].astro**

`HoldingsTable` now expects an optional `assignments` prop (`Record<CUSIP, TagId[]>`). Update the consumer at `src/pages/funds/[slug].astro` to pass it:

```astro
<HoldingsTable
  filing={filing}
  securities={securities}
  unchangedOnly={diff.prior_period !== null}
  unchangedCusips={unchangedCusips}
  taxonomy={tagsFile.taxonomy}
  assignments={tagsFile.assignments}
/>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Smoke-check**

Visit: `http://localhost:5180/funds/situational-awareness/`
Click to expand the "positions held steady" section.
Expected: the table now has Themes and Granular columns. Tagged positions show their broad/granular labels; untagged positions show `—` in both.

- [ ] **Step 5: Commit**

```bash
git add src/components/HoldingsTable.astro src/pages/funds/[slug].astro
git commit -m "feat: HoldingsTable Themes + Granular columns"
```

---

## Task 8: Final verification

**Files:** none modified directly

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all 47 tests pass (43 existing + 4 new from Task 2).

- [ ] **Step 2: Run a clean build**

Run: `npm run build`
Expected: build succeeds with 4 pages.

- [ ] **Step 3: Walk through each page**

Run dev server if not running: `npm run dev` (use any free port).

For each URL, verify the listed items:

**`http://localhost:<port>/`** (homepage)
- [ ] Existing layout unchanged (homepage doesn't have themes; only the table layout)

**`http://localhost:<port>/funds/situational-awareness/`** (granular fund)
- [ ] FundHeader, ChangeHero unchanged
- [ ] 2-col Sector | Theme grid unchanged in position
- [ ] Below the grid: amber mono "Granular coverage: X% of AUM" line
- [ ] Below the coverage line: full-width "Granular theme shifts" panel with sub-tag bars
- [ ] Movement tables now have a "Granular" column showing labels like "Photonics", "GPU / accelerator", "Nuclear power" for matched positions, `—` for others
- [ ] Movement tables' existing tag column shows ONLY broad themes (no sub-tags duplicated)
- [ ] Holdings table (expand it): has both Themes and Granular columns

**`http://localhost:<port>/funds/duquesne/`** (no granular tags)
- [ ] Granular section does NOT render
- [ ] Movement table Themes column shows broad themes; Granular column shows `—` everywhere
- [ ] Holdings table same: Themes populated, Granular all dashes

**`http://localhost:<port>/about`**
- [ ] Unchanged (no theme display on this page)

- [ ] **Step 4: Resize-test**

In dev tools, resize to 1200px → 768px → 375px.
At < 700px, verify:
- [ ] The Granular column is hidden in both MovementTable and HoldingsTable
- [ ] The Themes column remains visible
- [ ] The granular panel below the 2-col grid still renders (full-width works at narrow widths)
- [ ] No horizontal scroll

- [ ] **Step 5: Verify clean working tree**

Run: `git status`
Expected: working tree clean.

- [ ] **Step 6: Verify commit count on branch**

Run: `git log --oneline main..HEAD | wc -l`
Expected: 8 new commits since branching from main (1 spec + 7 feat). Or, if branched from `dark-theme-redesign`, count from there.

---

## Done

The site now has a granular theme-shifts analysis layer alongside the existing broad themes. Situational Awareness has 8 starter sub-tags applied to relevant positions; Duquesne carries no sub-tags but renders cleanly with dashes.
