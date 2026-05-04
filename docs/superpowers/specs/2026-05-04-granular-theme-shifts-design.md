# Granular theme-shifts — design spec

**Date:** 2026-05-04
**Scope:** Add a deeper-granularity theme classification layer alongside the existing top-level "Theme shifts", expressed via a hierarchical taxonomy (`parent` field on each tag), aggregated as a new `granular_breakdown` in each diff, and rendered as both a new full-width panel on the fund detail page and a new column in the movement / holdings tables.

## Goal

The existing top-level themes (e.g., `ai-compute`, `ai-infra-power`) are useful at the fund-thesis level but blur the signal for funds whose conviction lives in specific bottlenecks — for Situational Awareness, photonics is one example, distinct from generic "AI compute". Adding an optional sub-tag layer lets readers see those specific bets without losing the existing broad view.

Both layers must coexist. The broad view is preserved (rolling sub-tags up to their parents); the granular view is a new, optional analysis layer covering the subset of fund AUM that has been granularly tagged.

## Data model

### TaxonomyEntry — extend with optional `parent`

In `scripts/types.ts`:

```ts
export interface TaxonomyEntry {
  id: TagId;
  label: string;
  description: string;
  /** Points to another tag's id in the same fund's taxonomy. Absent = top-level tag. */
  parent?: TagId;
}
```

### Validation rules (in `scripts/validate-data.ts`)

For each fund's `tags.json`:

1. If `parent` is set, the referenced id MUST exist in the same fund's `taxonomy`.
2. A tag's `parent` MUST itself be top-level (have no `parent`). Maximum depth = 2 (top-level + one sub-tag layer; no grandchildren).
3. A tag MUST NOT reference itself as `parent`.

These get encoded as Zod refinements on `tagsFileSchema`.

### Assignments — unchanged

`assignments: Record<CUSIP, TagId[]>` keeps its current shape. A position can carry top-level tags, sub-tags, or both. A photonics company tagged `["photonics"]` alone is enough — the broad layer infers `ai-compute` from photonics's `parent`.

## Diff computation & roll-up semantics

### `compute-diff.ts` changes

For each fund-quarter diff, compute two breakdowns from the same set of position assignments:

**Broad layer (`theme_breakdown`)** — for each position, the set of broad themes it counts toward is:

```
broad_tags(position) = (top-level tags of position) ∪ {parent(t) | t ∈ sub-tags of position}
```

De-duplicated. A position tagged `["ai-compute", "photonics"]` counts toward `ai-compute` exactly once, not twice. The aggregation iterates over each unique `broad_tag` in this set and adds the position's value to that bucket.

**Granular layer (`granular_breakdown`)** — only positions with at least one sub-tag are included. Aggregation is over the sub-tags themselves. A position tagged only with top-level tags (e.g., `["ai-applications"]`) is excluded from this breakdown.

**Coverage stat** — sum the value of all positions with at least one sub-tag, divide by `current_value`, multiply by 100. Stored alongside the breakdown so the rendered annotation doesn't need recomputation.

### `DiffFile` — new fields

```ts
export interface DiffFile {
  // ... existing fields
  granular_breakdown: Breakdown | null;     // null when fund has zero sub-tags or zero granularly-tagged positions
  granular_coverage_pct: number | null;     // 0-100, null when granular_breakdown is null
}
```

Both fields are computed once at diff-build time and persisted in `data/funds/<slug>/diff/<period>.json`. Same pattern as `sector_breakdown` and `theme_breakdown`. No runtime recomputation.

### Tests

In `tests/compute-diff.test.ts`, add a new fixture and assertions:

- A fund with mixed tagging: positions tagged top-level only, sub-tag only, both, and untagged.
- Verify `theme_breakdown` correctly de-duplicates roll-ups (no double-counting for positions tagged with both `ai-compute` and `photonics`).
- Verify `granular_breakdown` excludes positions with only top-level tags.
- Verify `granular_coverage_pct` matches the expected ratio.
- Verify `granular_breakdown` is `null` for a fund with zero sub-tags defined.

## Rendering

### Fund detail page (`src/pages/funds/[slug].astro`)

Three additions:

1. The existing 2-col `breakdown-grid` (Sector | Theme) stays as-is.
2. Below the grid, conditionally render a full-width section if `diff.granular_breakdown !== null`:

```astro
{diff.granular_breakdown && (
  <section class="granular-section">
    <div class="coverage-note">
      Granular coverage: {formatPct(diff.granular_coverage_pct ?? 0)} of AUM
    </div>
    <SectorDeltaBars title="Granular theme shifts" breakdown={diff.granular_breakdown} />
  </section>
)}
```

3. Scoped style for `.coverage-note` matches the existing mono-uppercase amber-label pattern (`font-mono`, `0.7rem`, `text-transform: uppercase`, `var(--accent)`, with a subtle muted-italic prefix or framing). Spacing: 12px below, with 24px margin above the granular section to separate it visually from the 2-col grid.

### Movement table (`src/components/MovementTable.astro`)

- Insert a new "Granular" column AFTER the existing tags column.
- Existing tags column header renamed from "tags" (implicit) to **"Themes"** explicitly. (The `tags` field name in the data stays unchanged; only the visible label changes.)
- **Behavior change in the existing column:** today the cell renders `r.tags.join(", ")` — every tag, broad and sub mixed. After this change, the "Themes" column shows broad themes only, computed as (top-level tags ∪ parent-of-each-sub-tag), de-duplicated. Sub-tags move out of this column and into the new "Granular" column. This keeps the two columns non-overlapping and mirrors the panel breakdown semantics.
- The "Granular" column shows the labels of the position's sub-tags only. If the position has no sub-tags, render `—` (muted).
- Tag-id-to-label resolution: the component receives `taxonomy: TaxonomyEntry[]` as a new prop, builds a `Map<TagId, TaxonomyEntry>` once, and uses it to:
  - Determine which of `r.tags` are sub-tags (have `parent`) vs broad themes (don't).
  - Resolve sub-tag ids to display labels.

### Holdings table (`src/components/HoldingsTable.astro`)

- `HoldingsTable` currently has no tag-related columns at all (only `sector`). To stay consistent with `MovementTable`, add BOTH "Themes" (broad) and "Granular" (sub-tags) columns. Header order: `Ticker | Name | Sector | Themes | Granular | Shares | Value | % port`.
- Same `taxonomy` prop and lookup pattern as `MovementTable`.
- This is the one place the spec adds visible information beyond what was strictly requested. Override if you'd rather only add "Granular" (or skip both and keep granular info in the panel only).

### Component prop changes — summary

| Component | Existing props | New prop |
|---|---|---|
| `MovementTable` | `status`, `rows` | `taxonomy: TaxonomyEntry[]` |
| `HoldingsTable` | `filing`, `securities`, `unchangedOnly`, `unchangedCusips` | `taxonomy: TaxonomyEntry[]` |

`[slug].astro` already calls `loadFundTags(slug)` indirectly via the diff pipeline; the page just passes `tagsFile.taxonomy` down to both table components.

Wait — re-checking the data loading: `[slug].astro` currently does NOT call `loadFundTags`. It only loads `funds`, `quarters`, `filing`, `diff`, and `securities`. The taxonomy is consumed inside `compute-diff.ts` at build time but isn't loaded for rendering.

To pass `taxonomy` to the table components, `[slug].astro` will need to call `loadFundTags(slug)` and forward `tagsFile.taxonomy`. This is one additional `data/funds/<slug>/tags.json` file read per page render at build time — negligible cost.

## Initial taxonomy seed (Situational Awareness)

The schema work is generic, but `tags.json` for Situational Awareness needs at least one sub-tag for the new panel to be non-empty. Seed entries:

| id | label | parent | description |
|---|---|---|---|
| `photonics` | Photonics | `ai-compute` | Optical interconnects, transceivers, silicon photonics, lasers — components specific to high-bandwidth data center networking. |
| `hbm-memory` | HBM memory | `ai-compute` | High-bandwidth memory (HBM) chips and the DRAM makers producing them — a known supply bottleneck for AI accelerators. |
| `ai-foundry` | AI foundries | `ai-compute` | Pure-play foundries fabricating leading-edge AI chips (e.g., TSMC). |
| `gpu-accelerator` | GPU / accelerator | `ai-compute` | The GPU and custom-accelerator vendors themselves (NVIDIA, AMD, etc.) as opposed to suppliers further up the stack. |
| `nuclear-power` | Nuclear power | `ai-infra-power` | Existing fission generation and the next-gen nuclear plays specifically positioned for AI-load growth. |
| `gas-power` | Gas peakers / nat-gas E&P | `ai-infra-power` | Gas-fired peaker plants and the natural gas exploration & production companies feeding them. |
| `grid-hardware` | Grid hardware | `ai-infra-power` | Transformers, switchgear, transmission equipment that lets new AI loads connect to the grid. |
| `datacenter-reit` | Datacenter REITs | `ai-infra-datacenter` | Public datacenter REITs (Equinix, Digital Realty, etc.) as opposed to networking gear or colocation services. |

Editorial assignment of these sub-tags to specific positions is a separate, manual step done after the schema lands. Recommended starter assignments (to be reviewed by user before commit):

- Coherent (CUSIP 19247G107) → `photonics` (alongside existing `ai-compute`)
- Constellation Energy → `nuclear-power`
- Cameco → `nuclear-power`
- NVIDIA → `gpu-accelerator`
- TSMC ADR → `ai-foundry`
- Equinix / Digital Realty → `datacenter-reit`

The exact list will be derived from the existing `assignments` map by reading the position names and mapping them to the most specific sub-tag. The user reviews and approves before the data is committed.

For Duquesne (no granular tags initially): `granular_breakdown` will be `null` for all its diffs; the panel won't render; the new table columns show `—` for every row.

## Out of scope

- No UI for editing taxonomy or assignments — still hand-edited in JSON.
- No grandchildren / multi-level nesting beyond depth 2.
- No automatic LLM-driven granular-tag suggestion at build time.
- No backfill pass for Duquesne or future funds — granular tagging is opt-in per fund.
- The `tags` field name in JSON remains unchanged. Only display headers ("Themes" / "Granular") change.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| User adds a sub-tag whose `parent` doesn't exist | Zod validation in `validate-data.ts` catches it at validation time |
| Cyclic or self-referential parent | Validation rule explicitly forbids; depth check in validator handles this |
| Granular panel too sparse to be useful | Coverage % annotation makes partial coverage explicit rather than misleading |
| Confusion between "Themes" and "Granular" columns at narrow widths | At `< 700px`, hide the "Granular" column via `display: none` on mobile. The panel below still conveys the granular signal; the table stays scannable. |
| Existing tests reference DiffFile shape | Run full test suite after compute-diff changes; update fixtures if needed |

## Success criteria

- New `parent` field optional in `TaxonomyEntry`, validated, doesn't break any existing test
- `compute-diff.ts` produces correct `theme_breakdown` (with parent roll-up + de-duplication) and new `granular_breakdown` + `granular_coverage_pct`
- Fund detail page for Situational Awareness shows a third "Granular theme shifts" panel below the existing 2-col breakdown grid, with a coverage-percentage annotation above it
- Movement and Holdings tables show the new "Granular" column with proper labels for granularly-tagged positions and `—` otherwise
- For Duquesne (no sub-tags), the granular panel doesn't render and the table columns show only dashes — no errors
- `npm test` passes (existing 43 tests + at least 4 new tests covering the roll-up math)
- `npm run build` succeeds
