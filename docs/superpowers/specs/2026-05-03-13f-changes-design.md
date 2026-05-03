# 13f-changes — design

**Date:** 2026-05-03
**Working name:** `13f-changes`
**Tagline:** Tracking quarter-over-quarter changes in hedge fund 13F filings

---

## Overview

A public website that surfaces the most recent quarter-over-quarter changes in selected hedge funds' 13F holdings. Unlike existing 13F tools (HedgeFollow, WhaleWisdom, Fintel) which are primarily holdings-browsers with changes as a side feature, this site is built **changes-first**: the page IA, the visual hierarchy, and the homepage all foreground what shifted in the latest quarter, with the static portfolio as supporting context.

Two funds at launch:
1. **Situational Awareness LP** (Leopold Aschenbrenner) — AI/AGI thesis, ~29 holdings, ~$5.5B reported, San Francisco
2. **Duquesne Family Office LLC** (Stan Druckenmiller) — generalist macro/value, 50+ holdings, NYC

The design generalizes to any fund that files Form 13F-HR with the SEC. Adding a new fund is a config-only operation — drop in a CIK and a slug, run the quarterly script.

## Goals

- **Changes-first IA.** Every page foregrounds the diff between the current quarter and the prior quarter. Held-steady positions are collapsed by default.
- **Two-fund proof.** Launch with two funds whose styles differ (thematic AI fund vs. generalist macro family office), proving the data layer is fund-agnostic.
- **Sector + theme breakdown.** Every fund has a canonical 2-level GICS sector/industry breakdown. Optionally, per-fund thematic tags for editorial framing (Situational Awareness gets tags; Duquesne can launch without).
- **Semi-automated quarterly cadence.** GitHub Actions polls EDGAR for new filings during the four 45-day filing windows. When a new filing appears, the user runs a `/update-quarter` Claude Code session to review, classify new positions, and ship.
- **Inherits nvidia-tracker pattern.** Astro on Cloudflare Workers, JSON files as source of truth, GitHub Actions, manual `/update-quarter` review session, Resend for any email reminders.
- **Public site.** Deployable to a `13f.<domain>` subdomain (or its own domain). Read-only — no auth, no databases.

## Non-goals (v1)

- **Multi-quarter history.** v1 shows only the latest two quarters. The data model permits historical extension later but no UI exposes it.
- **Performance / returns calculation.** We don't compute or display fund returns, IRR, or risk metrics.
- **Stock detail pages.** Tickers in tables link to the SEC filing; v1 has no per-ticker page.
- **Live prices.** Position values are the 13F filing-snapshot values (as-of quarter end). No real-time pricing.
- **Search / filter complexity.** v1 has no filters or search. The four movement tables are the primary navigation; the held-steady-expanded view is a simple sorted list.
- **Shorts / bonds / foreign holdings outside U.S.** 13Fs only cover U.S.-listed long equity by definition. We surface this limitation in the methodology footer.
- **User accounts.** Anyone can request a fund be added via an email CTA. Adding a fund is a maintainer action.

## User experience

### Routes

| Route | Purpose |
|---|---|
| `/` | Multi-fund index — comparison table of all tracked funds |
| `/funds/[slug]` | Per-fund changes-first detail page |
| `/about` | Methodology, what 13Fs cover, what they don't, taxonomy notes |

### `/` — Homepage (multi-fund index)

A HedgeFollow-style comparison table with one row per fund. Designed for a single quick scan: who's tracked, what they hold, what changed last quarter.

**Columns:**
- Fund name + manager (with optional photo/icon)
- AUM (latest reported value)
- Holdings count
- Latest filing period (e.g. "Q4 2025") with filing date
- Top 3 changes this quarter (3 ticker chips with ↑/↓/NEW/CLOSED indicator)
- Link to per-fund detail page

**Above the table:** site title, one-sentence tagline, latest-filing-date badge.

**Below the table:** the contact CTA — *"Want a fund added? Email seanfkelley1@gmail.com"* — and a link to the about page.

### `/funds/[slug]` — Per-fund detail (changes-first / "P4")

The core surface. Top-to-bottom layout:

1. **Compact header.** Fund name, manager, filing period, filing date, total reported value, position count, link to the SEC filing.
2. **Hero / "what changed" sentence.** A one- or two-sentence editorial summary of the most significant shifts. Generated during the quarterly review, stored alongside filing metadata. Example: *"Doubled down on AI-power infrastructure (Bloom Energy +35%, new positions in Cipher Mining and Applied Digital). Trimmed bitcoin-miner exposure as Bitfarms and Bitdeer were cut by half. Net +$420M deployed."* Plus four small numbers underneath: NEW count, CLOSED count, INCREASED count, DECREASED count.
3. **Sector & theme delta bars.** Two side-by-side panels showing **only deltas in percentage points** (not totals). Positive bars right (green), negative bars left (red), with a center "no change" line. Sector panel always present (canonical GICS); theme panel renders only if the fund has any tags.
4. **Movement tables.** Four sections — `NEW`, `↑ INCREASED`, `↓ DECREASED`, `CLOSED` — each as a compact mini-table with ticker, name, sector/industry, theme tags, and the relevant change metrics. Each section header shows the count and net $ change.
5. **Held-steady fold.** A single line, click to expand: *"32 positions held steady · $1.6B (66% of AUM)"*. Expanded view shows a subset of the full holdings table.
6. **Methodology footer.** Brief data-source note and link to `/about`.

**No big sortable holdings table at the top.** That's HedgeFollow's pattern. The full table is hidden behind the "held steady" expander, accessible but secondary. The whole page is organized around what shifted.

### `/about` — Methodology page

- What 13Fs are and what they cover (only U.S.-listed long equity, only managers >$100M AUM in qualifying securities)
- What they don't cover (shorts, bonds, foreign holdings, derivatives positions outside the report, anything held outside the reporting entity)
- Filing cadence (quarterly, 45 days after quarter-end)
- The taxonomy: GICS sectors/industries via OpenFIGI + Yahoo Finance + manual override file; per-fund themes assigned editorially
- Data refresh cadence: GitHub Actions polls EDGAR daily during the four filing windows (mid-Feb, mid-May, mid-Aug, mid-Nov)
- Limitations: filing-snapshot values, no live prices, options positions shown separately
- Contact CTA repeated at bottom

### Aesthetic direction (deferred)

P4 is the directional layout. Actual visual treatment — typography choice, color palette, spacing scale, chart styling — is **deferred** to a later design pass once the data pipeline is working. v1 uses default-clean Astro styling; a polish pass comes after.

## Data model

The site is statically generated from JSON files committed to the repo. No database. All data files live under `data/`.

### `data/funds.json`

Index of all tracked funds. Drives the homepage.

```jsonc
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

### `data/funds/[slug]/quarters.json`

Per-fund index of all known filings, sorted newest first. Drives the per-fund page (the page renders the latest two entries).

```jsonc
{
  "slug": "situational-awareness",
  "quarters": [
    {
      "period": "2025-Q4",
      "period_ending": "2025-12-31",
      "filing_date": "2026-02-11",
      "accession": "0002045724-26-000002",
      "edgar_url": "https://www.sec.gov/Archives/edgar/data/2045724/000204572426000002/",
      "value_units": "USD",
      "schema_version": "X0202",
      "total_value": 5516758344,
      "position_count": 29,
      "summary": "Doubled down on AI-power infra. Trimmed bitcoin miners by half. Net +$420M deployed.",
      "fetched_at": "2026-02-14T10:00:00Z"
    },
    { /* prior quarter */ }
  ]
}
```

### `data/funds/[slug]/[period].json`

The full holdings list for one filing. One file per filing.

```jsonc
{
  "slug": "situational-awareness",
  "period": "2025-Q4",
  "period_ending": "2025-12-31",
  "filing_date": "2026-02-11",
  "accession": "0002045724-26-000002",
  "value_units": "USD",
  "total_value": 5516758344,
  "positions": [
    {
      "cusip": "093712107",
      "name_of_issuer": "BLOOM ENERGY CORP",
      "title_of_class": "COM CL A",
      "shares": 10076022,
      "shares_type": "SH",
      "value": 875505552,
      "put_call": null,
      "investment_discretion": "SOLE",
      "voting_sole": 10076022,
      "voting_shared": 0,
      "voting_none": 0
    },
    {
      "cusip": "093712107",
      "name_of_issuer": "BLOOM ENERGY CORP",
      "title_of_class": "COM CL A",
      "shares": 408500,
      "shares_type": "SH",
      "value": 35494565,
      "put_call": "Call",
      "investment_discretion": "SOLE",
      "voting_sole": 0,
      "voting_shared": 0,
      "voting_none": 0
    }
    /* ...27 more */
  ]
}
```

Notes on the schema:
- The same CUSIP can appear multiple times within a filing (e.g., common stock + call options). The unique key for a position is `(cusip, title_of_class, put_call)`.
- **All `value` numbers in the JSON are in USD dollars (full dollars, not thousands), regardless of what the source filing used.** The parser normalizes during ingest. `value_units` is metadata documenting the original filing's units (`"USD"` or `"USD_THOUSANDS"`) for traceability but is not used by downstream code — the diff and renderer treat all values as plain USD.
- `total_value` (in this file and in `quarters.json`) is the sum of all position values, also in USD.
- Options positions (`put_call != null`) are kept distinct from the underlying common stock, both in storage and display.
- Foreign-listed shares with letter-prefix CUSIPs (`G11448100` Bitdeer, `G02386103` Bitfarms) are valid CUSIPs for our purposes.

### `data/securities.json`

Cross-filing CUSIP enrichment cache. One row per CUSIP. Populated incrementally during the quarterly review — we never re-fetch a CUSIP we've already classified.

```jsonc
{
  "093712107": {
    "cusip": "093712107",
    "ticker": "BE",
    "name": "Bloom Energy Corp",
    "sector": "Industrials",
    "industry": "Electrical Equipment",
    "ticker_source": "openfigi",
    "sector_source": "yahoo-finance",
    "classified_at": "2026-02-14T10:05:00Z"
  },
  "G11448100": {
    "cusip": "G11448100",
    "ticker": "BTDR",
    "name": "Bitdeer Technologies Group",
    "sector": "Information Technology",
    "industry": "IT Services",
    "ticker_source": "openfigi",
    "sector_source": "manual-override",
    "manual_override_reason": "Yahoo Finance returned no sector data; classified as IT Services per Bitdeer 10-K segment reporting",
    "classified_at": "2026-02-14T10:08:00Z"
  }
}
```

If a CUSIP can't be auto-classified (Yahoo returns nothing, OpenFIGI doesn't resolve, etc.), the `/update-quarter` session prompts the user to classify manually with an explanation, and the entry is written with `sector_source: "manual-override"`.

### `data/funds/[slug]/tags.json`

Per-fund thematic tags. Holds both the fund's tag taxonomy and the CUSIP → tag-IDs assignments in a single file.

```jsonc
{
  "slug": "situational-awareness",
  "taxonomy": [
    {
      "id": "ai-compute",
      "label": "AI compute",
      "description": "GPU and AI accelerator chips, AI server hardware"
    },
    {
      "id": "ai-infra-power",
      "label": "AI infrastructure — power",
      "description": "Power generation, fuel cells, and grid infrastructure for AI data centers"
    }
    /* ... */
  ],
  "assignments": {
    "093712107": ["ai-infra-power"],
    "17253J106": ["ai-infra-power", "bitcoin-mining"]
    /* CUSIP → tag IDs */
  }
}
```

The `taxonomy` and `assignments` are split so taxonomy edits don't require touching every assignment. New positions get tags assigned during `/update-quarter`.

### `data/_pending.json`

The review queue. Written by the EDGAR poller, drained by `/update-quarter`.

```jsonc
{
  "pending": [
    {
      "slug": "situational-awareness",
      "cik": "0002045724",
      "accession": "0002045724-26-000002",
      "period_ending": "2025-12-31",
      "filing_date": "2026-02-11",
      "edgar_url": "https://www.sec.gov/Archives/edgar/data/2045724/000204572426000002/",
      "discovered_at": "2026-02-11T18:30:00Z"
    }
  ]
}
```

Empty form: `{"pending": []}`. Always present in the repo even when empty so the path is stable.

### `data/funds/[slug]/diff/[period].json` (derived)

Generated from the two latest quarter files. Cached so the renderer doesn't recompute on every request.

The hero summary text lives canonically in `quarters.json` (per-quarter editorial metadata) and is pulled by the renderer separately. The diff file holds only derived numerical data.

```jsonc
{
  "slug": "situational-awareness",
  "current_period": "2025-Q4",
  "prior_period": "2025-Q3",
  "totals": {
    "current_value": 5516758344,
    "prior_value": 5096000000,
    "net_flow": 420758344
  },
  "movements": {
    "new": [
      {
        "cusip": "17253J106", "ticker": "CIFR", "name": "Cipher Mining Inc",
        "sector": "Information Technology", "industry": "IT Services",
        "tags": ["ai-infra-power", "bitcoin-mining"],
        "current_value": 154523813,
        "current_shares": 10469093,
        "pct_of_portfolio": 2.8
      }
    ],
    "closed": [/* ... */],
    "increased": [/* with prior+current shares, pct change, $ change */],
    "decreased": [/* ... */],
    "unchanged_count": 12,
    "unchanged_value": 1820000000
  },
  "sector_breakdown": {
    "current": [
      { "sector": "Information Technology", "value": 1500000000, "pct": 27.2 }
      /* ... */
    ],
    "prior": [/* ... */],
    "deltas": [
      { "sector": "Industrials", "delta_pct_pts": 7.3 }
      /* sorted by absolute delta */
    ]
  },
  "theme_breakdown": {
    /* same shape as sector_breakdown but for tags; null if fund has no tags */
  }
}
```

## Architecture

### Stack (inherited from nvidia-tracker)

- **Astro** for static-site generation.
- **Cloudflare Workers** for hosting (free tier; no server compute needed since data is built-in at deploy time).
- **JSON files** committed to the repo as the source of truth — no DB.
- **GitHub Actions** for automated polling of new filings during filing windows.
- **Resend** for email reminders when a new filing lands and is awaiting review (free tier: 100 emails/day, 3K/month — well within scope).
- **Wrangler** for deploys.
- **Node 20+** for build and scripts.

### File layout

```
13f-changes/
├── README.md
├── package.json
├── astro.config.mjs
├── wrangler.toml
├── tsconfig.json
├── .github/workflows/
│   ├── poll-edgar.yml          # daily during filing windows
│   └── reminder.yml            # weekly during filing windows, sends email if new filing waiting
├── .claude/commands/
│   └── update-quarter.md       # the manual quarterly review slash command
├── data/
│   ├── funds.json
│   ├── securities.json
│   ├── _pending.json           # review queue, drained by /update-quarter
│   └── funds/
│       ├── situational-awareness/
│       │   ├── quarters.json
│       │   ├── tags.json
│       │   ├── 2025-Q3.json
│       │   ├── 2025-Q4.json
│       │   └── diff/
│       │       └── 2025-Q4.json
│       └── duquesne/
│           ├── quarters.json
│           ├── tags.json
│           ├── 2025-Q3.json
│           ├── 2025-Q4.json
│           └── diff/
│               └── 2025-Q4.json
├── scripts/
│   ├── poll-edgar.ts           # CI script — polls for new filings, writes pending review entries
│   ├── fetch-filing.ts         # downloads a single filing's XML and writes raw + parsed JSON
│   ├── parse-13f.ts            # parses 13F XML to position list (handles X01/X02 schema diff)
│   ├── compute-diff.ts         # generates derived diff/[period].json from two quarter files
│   ├── classify-securities.ts  # OpenFIGI + Yahoo Finance enrichment with manual fallback
│   └── validate-data.ts        # schema validation for all JSON files
├── src/
│   ├── pages/
│   │   ├── index.astro          # / homepage
│   │   ├── about.astro          # /about
│   │   └── funds/
│   │       └── [slug].astro     # /funds/[slug] dynamic route
│   ├── components/
│   │   ├── FundHeader.astro
│   │   ├── ChangeHero.astro
│   │   ├── SectorDeltaBars.astro
│   │   ├── ThemeDeltaBars.astro
│   │   ├── MovementTable.astro
│   │   ├── HoldingsTable.astro      # collapsed by default
│   │   ├── ContactCTA.astro
│   │   └── ...
│   └── lib/
│       ├── data.ts              # JSON loaders
│       ├── diff.ts              # diff helpers
│       └── format.ts            # value/percent formatters
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-03-13f-changes-design.md   # this file
```

### Quarterly workflow — three modes

**Mode 1: Daily polling (automated, GitHub Actions, during filing windows).** A workflow runs daily on each of the 14 days starting 1 day before the typical filing-window opens (Feb 1, May 1, Aug 1, Nov 1) and ending after the filing-window closes (Feb 18, May 18, Aug 18, Nov 18). For each fund in `funds.json`, it queries EDGAR for the fund's latest 13F-HR. If the latest accession differs from `quarters.json`'s newest entry, it appends a "pending" record to a queue file (`data/_pending.json`) and exits. The queue is the signal that there's something to review.

**Mode 2: Weekly reminder email (automated, GitHub Actions, during filing windows).** A workflow runs once a week during each ~3-week filing window (the polling window described in Mode 1). If `data/_pending.json` is non-empty, it sends an email via Resend listing the fund(s) and filing(s) awaiting review. Email is **in v1**, mirroring nvidia-tracker's Sunday reminder.

**Mode 3: Manual quarterly review (`/update-quarter` slash command).** When the user opens the project in Claude Code and invokes `/update-quarter`, it:
1. Reads `data/_pending.json` to see what's queued
2. For each pending filing:
   - Fetches the filing XML from EDGAR (information table + primary doc)
   - Parses and writes the new `[period].json` file
   - For any new CUSIPs, calls `classify-securities.ts` which tries OpenFIGI for ticker, Yahoo Finance for sector/industry; surfaces failures to the user for manual classification with an LLM proposal
   - Computes the diff against the prior quarter via `compute-diff.ts`
   - For any new positions in the diff, prompts the user to assign theme tags (Claude proposes based on the security's sector/industry/business; user approves or edits)
   - Asks the user to write a one-sentence summary for the hero (Claude proposes; user edits)
   - Updates `quarters.json` to add the new period
3. Removes the entry from `_pending.json`
4. Validates all data files via `validate-data.ts`
5. Stages changes for a single commit

The user reviews the staged data changes in git, commits, pushes. Deploy is either manual (`npm run deploy`) or via a GitHub Actions deploy workflow that runs on push to `main` (recommend the workflow). Deployment uses Wrangler against Cloudflare Workers, same shape as nvidia-tracker.

### Data flow (filing → site render)

```
SEC EDGAR (13F XML)
    │
    │ poll-edgar.ts (GitHub Actions, daily during filing windows)
    │
    ▼
data/_pending.json  (queue of unreviewed filings)
    │
    │ /update-quarter (manual, in Claude Code)
    │   ├─ fetch-filing.ts   → downloads + parses XML to JSON
    │   ├─ classify-securities.ts → OpenFIGI + Yahoo + manual fallback → securities.json
    │   ├─ tag prompt        → tags.json
    │   ├─ summary prompt    → quarters.json hero summary
    │   └─ compute-diff.ts   → diff/[period].json
    │
    ▼
data/ (committed to git)
    │
    │ astro build (CI on push to main)
    │
    ▼
Cloudflare Workers (static deploy)
```

## Data acquisition

### SEC EDGAR

- **Base URL pattern:** `https://www.sec.gov/Archives/edgar/data/{cik_no_zeros}/{accession_no_dashes}/`
- **Required header:** `User-Agent: Sean Kelley seanfkelley1@gmail.com` (SEC requires identifying contact info; rate limit 10 req/sec).
- **Filing discovery:** `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=13F-HR&dateb=&owner=include&count=10&output=atom` returns an Atom feed of all 13F-HR filings for a CIK.
- **Filing contents:** `https://www.sec.gov/Archives/edgar/data/{cik_no_zeros}/{accession_no_dashes}/index.json` lists files. Two are relevant:
  - `primary_doc.xml` — cover page, period, schema version, summary totals
  - The information table XML — **filename is filer-specific** (e.g. `SALP_13FQ425.xml`, `form13f_20251231.xml`). Discover via `index.json` rather than guessing.
- **Schema versions:** `primary_doc.xml` may declare `<schemaVersion>X0202</schemaVersion>` (modern) or omit the element entirely (older filings). Schema version is captured for traceability but **does not reliably indicate value units** — see below.

- **Value units — heuristic detection (important).** The original assumption was "X01 schema = thousands, X02 = dollars" per SEC's 2022 rule change. In practice, this is wrong. Verified examples:
  - Situational Awareness LP, Q4 2025, X0202 schema → values in **dollars** (e.g., Bloom Energy `value=875505552` ÷ 10,076,022 shares = $86.89/share, plausible).
  - Duquesne Family Office, Q4 2025, **also** X0202 schema → values in **thousands** (e.g., ADMA Bio `value=4600` ÷ 252,200 shares = $0.018/share at face, $18.24/share when scaled by 1000 — only the latter is plausible).
  
  Filers continue to report in thousands even with the modern schema. The parser must detect units by examining the data, not the metadata.
  
  **Heuristic:** compute the median per-share price across all positions in the filing (`value / shares`). If median < $1, multiply all values by 1000 and tag `value_units = "USD_THOUSANDS"`; otherwise tag `value_units = "USD"`. This works because U.S.-listed common stock essentially never has a median price below $1 across a multi-position portfolio. Stored values in JSON are always normalized to USD dollars regardless of source units.
  
  **Sanity check:** if the median falls in an ambiguous zone (e.g., $0.50–$2.00), log a warning. The parser still picks a side (the < $1 threshold), but the warning surfaces edge cases for human review.
- **Filing windows:** 13F-HR is due 45 days after quarter end:
  - Q4 (period ending Dec 31): due Feb 14
  - Q1 (Mar 31): due May 15
  - Q2 (Jun 30): due Aug 14
  - Q3 (Sep 30): due Nov 14
  - Polling runs Feb 1–18, May 1–18, Aug 1–18, Nov 1–18.

### CUSIP → ticker resolution

**OpenFIGI** (https://www.openfigi.com/api). Free tier: 25 jobs/min unauthenticated, 100/min with API key. We expect <100 new CUSIPs per quarterly review across both funds, so unauthenticated is fine. POST a batch of `{idType: "ID_CUSIP", idValue: "..."}` and receive ticker mappings.

Fallback: SEC EDGAR's company-tickers JSON (`https://www.sec.gov/files/company_tickers.json`) maps CIK→ticker and ticker→CUSIP for U.S.-listed issuers. Useful when OpenFIGI returns ambiguous results.

For foreign-listed shares (CUSIPs starting with G/F), OpenFIGI usually resolves to the ADR or local listing's ticker.

### Sector / industry data

**Primary: Yahoo Finance via the free `yahoo-finance2` Node/TypeScript library.** Scripts are written in TypeScript (matching the Astro/Node ecosystem). Returns Yahoo's sector and industry strings, which we map to GICS-equivalent labels via a small lookup table maintained at `scripts/lookups/yahoo-to-gics.json`.

**Fallback: manual override.** When Yahoo returns nothing or returns something nonsensical, the `/update-quarter` flow surfaces the security to the user with Claude's best-guess sector/industry classification. User approves, the entry is written with `sector_source: "manual-override"` and a free-text reason.

**Caching:** classifications are written to `data/securities.json` and never re-fetched. A CUSIP→sector mapping is essentially permanent; companies rarely change sectors. If GICS reclassifies something (rare), we can manually edit `securities.json`.

### Position-value units (critical detail)

See "Value units — heuristic detection" above under SEC EDGAR. Briefly: detect units by computing the median per-share price across the filing's positions. If median < $1, scale up by 1000 and tag the source as `USD_THOUSANDS`; otherwise tag as `USD`. Stored values are always in normalized USD dollars. The render and diff logic operates exclusively on normalized values.

## Quarterly workflow — `/update-quarter` slash command

A Claude Code slash command (modeled on nvidia-tracker's `/extract`) that walks the user through quarterly review.

### Prompt outline

```markdown
You are conducting the quarterly review for the 13f-changes project. Run these steps in order.

1. **Read `data/_pending.json`** to see which fund(s) and filing(s) need review.
2. **For each pending filing:**
   a. Fetch the filing's primary_doc.xml and information table XML.
   b. Parse with `scripts/parse-13f.ts`. Write `data/funds/{slug}/{period}.json`.
   c. Identify new CUSIPs (not yet in `data/securities.json`). For each:
      - Run OpenFIGI to get ticker.
      - Run Yahoo Finance to get sector/industry.
      - If either lookup fails or returns ambiguous data, propose a classification to the user (with reasoning) and ask for approval.
      - Write the result to `data/securities.json`.
   d. Compute the diff against the prior quarter via `scripts/compute-diff.ts`. Write `data/funds/{slug}/diff/{period}.json`.
   e. For each NEW position in the diff, propose theme tag(s) based on the security's sector/industry and known business focus. Ask user to approve or edit. Update `data/funds/{slug}/tags.json`.
   f. Propose a one-sentence summary of the quarter's biggest shifts (looking at the largest moves in $ and the biggest sector/theme deltas). Ask user to approve or edit.
   g. Update `data/funds/{slug}/quarters.json` to add the new period and the summary.
3. **Run `npm run validate-data`** to check schemas and integrity.
4. **Remove entries from `data/_pending.json`** for processed filings.
5. **Stage all changes** and propose a commit message like: `Q4 2025 update: situational-awareness +5/-2/+12/-8, duquesne +3/-1/+8/-4`.

Stop at the commit. The user reviews and pushes.
```

### Estimated time per session

- 2 funds × 1 new filing each = ~10 minutes (most CUSIPs are already in `securities.json` from prior quarters; only a handful are new).
- First-ever review (when both funds are loaded for the first time) is longer — ~30 minutes — because the entire current portfolio needs classification.

### Adding a new fund (operational)

Adding a third fund (or replacing one) is a config-only operation:

1. Find the fund's CIK via EDGAR full-text search.
2. Append a new row to `data/funds.json` with `slug`, `name`, `manager_name`, `cik`, etc.
3. Create `data/funds/{slug}/` directory with empty `quarters.json` (`{"slug": "...", "quarters": []}`) and empty `tags.json` (`{"slug": "...", "taxonomy": [], "assignments": {}}`).
4. Run `/update-quarter` and let it backfill the latest two quarters from EDGAR. It will discover that the fund has no prior data and walk the user through classifying the entire current portfolio — that's the ~30 minute first-time cost.

If you want to load more than the latest two quarters initially (for richer context), the script accepts a `--quarters N` flag. v1 always renders the latest two regardless of how many are loaded.

### First-filing edge case

If a fund has only one 13F-HR on record (e.g., a brand-new fund), there is no prior quarter to diff against. v1 fallback:

- The fund's detail page renders with a "First filing on record — no prior-quarter comparison available" banner replacing the change hero.
- The four movement tables don't render.
- Sector/theme delta bars don't render (they need a prior).
- The holdings table renders the full current quarter, expanded by default (since there's nothing to "fold").

Both launch funds (Situational Awareness LP, Duquesne Family Office) have multi-quarter histories so this isn't a launch blocker, but the code path needs to handle it for future fund additions.

## Initial tag taxonomy proposals

These are starter taxonomies for both funds. **The user reviews and edits during the first `/update-quarter` session.** Tags can be added, removed, or renamed at any time without breaking the data layer (only the assignments map references tag IDs).

### Situational Awareness LP — proposed themes

Based on the AI-thesis framing and the actual Q4 2025 holdings (Bloom Energy, Cipher Mining, Bitdeer, Bitfarms, Applied Digital, etc.):

| Tag ID | Label | Description |
|---|---|---|
| `ai-compute` | AI compute | GPU/accelerator chips, AI servers, foundries |
| `ai-infra-power` | AI infrastructure — power | Power generation (fuel cells, nuclear, gas peaker), grid hardware for AI data centers |
| `ai-infra-cooling` | AI infrastructure — cooling | Cooling systems, datacenter HVAC, immersion cooling |
| `ai-infra-datacenter` | AI infrastructure — datacenter | Datacenter REITs, networking, hardware |
| `bitcoin-mining` | Bitcoin mining | Companies whose primary business is bitcoin/crypto mining (often dual-classified with `ai-infra-power` because of GPU pivot) |
| `hyperscalers` | Hyperscalers | Big-tech cloud platforms |
| `ai-applications` | AI applications | Software/services that consume AI |

A position can have multiple tags. Cipher Mining gets `["ai-infra-power", "bitcoin-mining"]` because its mining operations are increasingly being pivoted to AI compute.

### Duquesne Family Office — proposed themes

Druckenmiller is a generalist macro investor. Holdings span Alcoa, Adma Biologics, Aeva, Alphabet, etc. — too diffuse for a useful AI-style taxonomy. **Recommended: launch Duquesne with NO tags.** The fund will render with sector breakdown only (no theme panel). User can add tags later if there's an angle worth surfacing (e.g., a "Druckenmiller's macro bets" framing).

## Open questions / decisions deferred to user review

These I want explicit user input on after the spec is reviewed:

1. **Tag taxonomy for Situational Awareness.** Above is my proposal. User edits/approves during the first `/update-quarter` session.
2. **Duquesne tags or no tags?** I recommend launching without. User can overturn.
3. **Domain / subdomain.** TBD. `13f.<personal-domain>`? Its own domain? Subroute on the personal site?
4. **GitHub repo visibility.** Public (matching nvidia-tracker, low-cost portfolio piece) or private? Recommend public.
5. **Email reminder cadence.** nvidia-tracker uses Sunday weekly. Recommend same: weekly during filing windows only (Feb/May/Aug/Nov).
6. **Visual / aesthetic pass.** Deferred per user instruction. Will be its own design pass after data pipeline is working.
7. **What to show when a fund has no prior quarter on file** (e.g., a brand-new fund's first 13F). v1 fallback: render the fund page with a "first filing on record — no comparison available" banner and just show the holdings table. Not a v1 blocker since both launch funds have prior filings.
8. **Amendment filings (13F-HR/A).** When a fund amends a prior filing, do we ignore (since the diff is against prior period)? Or replace the original and recompute? Recommend: replace + recompute, log the amendment in `quarters.json` for transparency. v1 doesn't need to display this prominently.

## Testing & validation

### Tests (minimal v1)

- **`parse-13f.ts`** unit tests: parse one X02 fixture (Situational Awareness Q4 2025) and one X01 fixture (a Duquesne filing from 2019 or earlier). Verify value units are tagged correctly, options positions are kept distinct, foreign-listed CUSIPs round-trip.
- **`compute-diff.ts`** unit tests: synthetic before/after JSON pairs covering each movement category (NEW, INCREASED, DECREASED, CLOSED, UNCHANGED), plus a unit-mismatch case (one quarter in thousands, the next in dollars — must normalize).
- **`classify-securities.ts`** unit tests: mock OpenFIGI and Yahoo responses; verify cache-hit path, fallback path, manual-override path.
- No end-to-end browser tests in v1. The site is static and the surface is small; pages load or they don't.

### `validate-data.ts` checks

Run before every commit (locally and in CI). Exits nonzero on any failure.

- All JSON files parse cleanly.
- `data/funds.json`: every entry has `slug`, `name`, `cik` (10-digit, leading zeros). Slugs are unique. CIKs are unique.
- `data/funds/{slug}/quarters.json`: `slug` matches directory. `quarters` sorted newest-first. Each quarter's `accession` is unique within the fund. Each `period_ending` is a valid quarter end (Mar 31, Jun 30, Sep 30, Dec 31).
- `data/funds/{slug}/{period}.json`: `slug`, `period`, `accession` match the parent quarter entry. `value_units` is `USD` or `USD_THOUSANDS`. Each position has `cusip` (9 alphanumeric chars), `name_of_issuer`, `shares` ≥ 0, `value` ≥ 0.
- `data/securities.json`: every key is a 9-char CUSIP. Every entry has `ticker`, `name`, `sector`, `industry`. Sectors are one of the canonical 11 GICS top-level labels.
- `data/funds/{slug}/tags.json`: every tag ID in `assignments` exists in `taxonomy`. Every CUSIP in `assignments` exists in at least one of the fund's quarter files (no orphan tag assignments).
- `data/_pending.json`: parse-clean, has `pending` array.
- `data/funds/{slug}/diff/{period}.json`: `current_period` and `prior_period` both exist as files in the fund's directory.

## Risks

- **Yahoo Finance scraping is brittle.** The `yahoo-finance2` library wraps an unofficial endpoint; Yahoo can break it without notice. Mitigation: manual override file as fallback, plus add Finnhub free tier as a secondary auto source if Yahoo fails (60 req/min, requires free API key).
- **EDGAR rate limits.** SEC enforces 10 req/sec. Polling is far below; quarterly review fetches a few files per fund. No issue at expected scale.
- **OpenFIGI free tier limits.** 25 jobs/min unauthenticated. A fund with ~50 holdings can be processed in 2 minutes. Plenty for our scale.
- **Value-unit ambiguity (most subtle source of bugs).** Source filings may report values in either dollars or thousands of dollars regardless of schema version — verified empirically across SA (dollars) and Duquesne (thousands). The parser detects via per-share-price heuristic at ingest, normalizes to USD dollars in storage. Mitigation: explicit unit tests covering both fixtures (one of each), plausibility checks on per-share price after normalization, and a `validate-data`-time check that no stored position has a per-share price below $0.01 or above $10M. A penny stock could in theory trip the < $0.01 floor, but a fund-portfolio-level penny-stock concentration is rare enough to be worth a manual review when it happens.
- **Options positions confusing readers.** A fund holding Bloom Energy common stock AND Bloom Energy call options shows as two rows. Mitigation: explicit "options" badge in the table, methodology footer note.
- **Foreign-listed CUSIPs.** Some securities (Bitdeer, Bitfarms) have CUSIPs starting with letters and aren't in EDGAR's CIK→ticker mapping. OpenFIGI usually resolves these. If not, manual classification.
- **Aschenbrenner / Druckenmiller name attribution.** Both are public figures running publicly-filed funds. The site does not need their permission to display their public 13F data; this is the same legal basis as HedgeFollow, WhaleWisdom, etc.

## v1 scope

**In:**
- Two funds: Situational Awareness LP, Duquesne Family Office LLC
- Latest two quarters per fund (Q3 2025 + Q4 2025 at launch)
- `/`, `/funds/[slug]`, `/about`
- Sector breakdown (canonical GICS via Yahoo + override)
- Theme breakdown (Situational Awareness only at launch; Duquesne untagged)
- 4-bucket movement tables (NEW / INCREASED / DECREASED / CLOSED) + held-steady fold
- Editorial hero summary per fund per quarter
- "Want a fund added?" email CTA
- Cloudflare Workers deploy
- GitHub Actions polling + reminder
- `/update-quarter` slash command

**Out (deferred or non-goals):**
- Multi-quarter history beyond two
- Stock detail / per-CUSIP pages
- Live prices
- User accounts, auth, comments
- Advanced search / saved filters
- Performance metrics, IRR
- Mobile-specific responsive treatments (basic responsive only)
- Visual / aesthetic polish (separate pass)
- More than two funds
- Email subscriptions for end users (only the maintainer reminder)

## Success criteria

- The user can land on the homepage and within 5 seconds know which two funds are tracked, when their latest filings dropped, and the top changes.
- The user can land on `/funds/situational-awareness` and within 10 seconds understand what shifted last quarter, in both prose (the hero) and visualization (delta bars + movement tables).
- A new quarter can be reviewed and shipped in under 15 minutes via `/update-quarter`.
- Adding a third fund (when the time comes) takes <30 minutes of config-only work plus the first-time classification cost (~30 minutes).
- The site loads in <500ms on a cold cache via Cloudflare's edge.
