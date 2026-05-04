# Dark theme redesign — design spec

**Date:** 2026-05-04
**Scope:** Whole site (homepage, fund detail, about)

## Goal

Redesign the 13f-changes site with a Bloomberg-terminal-inspired dark theme, elevate the lead investor as a first-class entity on each fund page (with a "LEAD INVESTOR" label and headshot), and apply targeted UI improvements that fall out of the new direction.

## Aesthetic direction

Terminal style: near-black background, amber accent for labels and links, semantic green/red for gains/losses, monospaced numbers in tables, sans-serif body. Dense and professional, evoking a trader's tool.

## Theme tokens (CSS custom properties)

Defined once in `public/global.css` under `:root`. Every component references these — no hardcoded colors in component scoped styles.

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0a0a0a` | Page background |
| `--bg-elev` | `#111111` | Elevated surfaces (cards, hero, CTA) |
| `--bg-tinted` | `#1a1a1a` | Table headers, chips |
| `--border` | `#262626` | Hairline borders |
| `--border-strong` | `#383838` | Stronger dividers, chip outlines |
| `--fg` | `#e5e5e5` | Primary text |
| `--fg-muted` | `#888888` | Muted/meta text |
| `--fg-dim` | `#555555` | De-emphasized text |
| `--accent` | `#f59e0b` | Labels, links, focal accents (amber) |
| `--accent-hover` | `#fbbf24` | Hover state |
| `--pos` | `#22c55e` | Gains, increases, new positions |
| `--neg` | `#ef4444` | Losses, decreases, closed positions |
| `--font-sans` | `ui-sans-serif, system-ui, -apple-system, sans-serif` | Body |
| `--font-mono` | `ui-monospace, "SF Mono", Consolas, "Liberation Mono", monospace` | Numbers, wordmark, uppercase labels |

Body defaults: `background: var(--bg)`, `color: var(--fg)`, `font-family: var(--font-sans)`, `font-variant-numeric: tabular-nums`.

## Headshot / Lead Investor system

### Data model change

Add an optional `manager_photo` field to each fund object in `data/funds.json`:

```json
{
  "slug": "situational-awareness",
  "name": "Situational Awareness LP",
  "manager_name": "Leopold Aschenbrenner",
  "manager_photo": "/managers/leopold-aschenbrenner.jpg",
  ...
}
```

The field is optional. If absent, the avatar component falls back to a gradient + initials.

### Image sourcing

Public press / Wikipedia photos for the two existing managers. Saved to `public/managers/` as `<slug-of-manager-name>.jpg`. Square crops, head-and-shoulders, ~400×400 px, optimized to <50 KB.

- `leopold-aschenbrenner.jpg`
- `stanley-druckenmiller.jpg`

### `ManagerAvatar.astro` (new component)

Props:
- `photo: string | null | undefined` — path under `/managers/`
- `name: string` — used for `alt` and initials fallback
- `size: 'sm' | 'md' | 'lg'` — 22px / 38px / 56px

Renders:
- If `photo` present: `<img>` in a circular wrapper with a 1px amber ring
- Else: gradient circle (amber → dark amber) with the manager's initials (first letter of first + last name) in mono

### Lead Investor presentation

**Fund detail page header (`FundHeader.astro`)** — primary content change:

Current structure:
```
[h1: Fund Name]                                       [meta: period · filing · SEC link]
$X reported · N positions · Manager Name
```

New structure:
```
[avatar 56px] LEAD INVESTOR
              [h1: Manager Name]
              [subtitle: Fund Name]
                                                      [meta: period · filing · SEC link]

[stats row: $X reported · N positions · vs. prior period]
```

The manager becomes the page's primary heading. Fund name moves to a subtitle directly under it. The `<h1>` change is intentional — the page is "about" this manager's bets.

**Homepage table (`index.astro`)** — small thumbnail:

Manager column shows a 22px avatar inline with the name:
```
[avatar] Leopold Aschenbrenner
```

## Component-by-component changes

### Files modified

| File | Change |
|---|---|
| `public/global.css` | Add tokens, base body styles, base typography, link color |
| `src/pages/index.astro` | Re-style table to dark; mono numerics; avatar thumbnails in manager column; use new Layout |
| `src/pages/funds/[slug].astro` | Use new Layout; no other structural change |
| `src/pages/about.astro` | Use new Layout; inherit dark palette |
| `src/components/FundHeader.astro` | Re-architected per Lead Investor presentation above |
| `src/components/ChangeHero.astro` | Dark surface, amber left-border, brighter pos/neg counts |
| `src/components/SectorDeltaBars.astro` | Dark panel, brighter bars, amber label |
| `src/components/MovementTable.astro` | Dark headers, semantic color tint per status, mono ticker/value columns |
| `src/components/HoldingsTable.astro` | Replace dashed border with `1px solid var(--border)`; mono numerics |
| `src/components/ContactCTA.astro` | Dark surface, amber link |

### Files created

| File | Purpose |
|---|---|
| `src/components/Layout.astro` | Shared page wrapper: `<html>`, `<head>`, top header strip with mono "13f-changes" wordmark + nav |
| `src/components/ManagerAvatar.astro` | Circular avatar with image-or-initials fallback |
| `public/managers/leopold-aschenbrenner.jpg` | Headshot |
| `public/managers/stanley-druckenmiller.jpg` | Headshot |

### Files NOT touched

- Anything under `data/` (except adding optional `manager_photo` field to existing entries in `funds.json`)
- `src/lib/` (data loading, formatting)
- `scripts/` (build-time data pipeline)
- `tests/`
- `wrangler.toml`, `astro.config.mjs`, `package.json`

## Layout.astro contract

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
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
      <nav><a href="/about">About</a></nav>
    </header>
    <main class="container">
      <slot />
    </main>
  </body>
</html>
```

The `.container` class moves out of each page's scoped styles into `Layout`'s scoped styles (or `global.css`), preserving the existing per-page widths via a `width?: 'narrow' | 'default' | 'wide'` prop:
- `narrow` = 720px (About page)
- `default` = 960px (fund detail page)
- `wide` = 1100px (homepage)

Default value is `'default'` if the prop is omitted.

## General UI improvements (bundled)

Concrete fixes shipped as part of this redesign:

1. **Tabular numerics** — `font-variant-numeric: tabular-nums` site-wide so column-aligned numbers line up
2. **One link color** — amber accent everywhere; no more competing blue `#4a7ec7`
3. **Consistent hairlines** — single `1px solid var(--border)` style; no more dashed/dotted/double mix
4. **Site header on every page** — wordmark + About link in a consistent top strip via `Layout`
5. **Three-font hierarchy** — mono uppercase labels (amber), sans body, mono tabular numbers. Each font has one job.
6. **Removed legacy beige** — current `ChangeHero` uses `#f7f5f0` background with `#c47c4a` border; both replaced with token-based dark equivalents

## Out of scope (deliberate non-goals)

- No light-mode toggle (full dark only)
- No JS interactions added beyond what's already there (the `<details>` element on Holdings table stays as-is)
- No changes to data pipeline, build process, or deployment
- No changes to the underlying movement / sector / holdings logic — visual restyle only
- No new fund pages or navigation routes

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Headshot images blocked or removed by source over time | Keep local copies in `public/managers/`; never hotlink |
| Manager photo licensing | Use editorial / press / Wikipedia commons only; document source in a comment if non-obvious |
| Mobile layout breaks with avatar + Lead Investor header | Test at <700px; stack avatar above text if needed |
| Astro `details` element styling fights dark palette | Explicit `summary` selector with token colors |

## Success criteria

- All three pages render in dark theme with no leftover light-mode colors
- `LEAD INVESTOR` label + headshot is visible above the fold on the fund detail page
- Manager thumbnails appear in the homepage table for funds with `manager_photo` set
- Funds without `manager_photo` show the initials fallback (no broken image icons)
- `npm test` passes
- `npm run build` succeeds
- Site renders correctly at 1200px, 768px, and 375px widths
