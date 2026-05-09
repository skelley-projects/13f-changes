# 13f-changes

A public site that tracks quarter-over-quarter changes in selected hedge funds' 13F holdings, organized **changes-first**: every page foregrounds what shifted in the latest quarter, with the static portfolio as supporting context.

Currently tracks:
- **Situational Awareness LP** (Leopold Aschenbrenner) — AI/AGI-thesis fund
- **Duquesne Family Office LLC** (Stan Druckenmiller) — generalist macro/value family office

## Architecture

- **Astro 6** static site generator, deployed to **Cloudflare Workers Static Assets**
- **JSON files** under `data/` are the source of truth — no database
- **GitHub Actions** poll SEC EDGAR around each quarter's filing deadline (every 30 min the day before/after, every 15 min during business hours on the deadline day itself)
- **GitHub Actions** refresh latest Yahoo Finance price snapshots around 6pm EST on weekdays
- **Resend** emails you immediately when the EDGAR poll detects a new filing (per-detection notification, not a weekly digest)
- **Manual quarterly review** via the `/update-quarter` Claude Code slash command — fetches, classifies new positions, prompts for thematic tags, writes editorial summaries, commits

See `docs/superpowers/specs/2026-05-03-13f-changes-design.md` for the full design and `docs/superpowers/plans/2026-05-03-13f-changes-implementation.md` for the implementation plan.

## Setup

### Prerequisites

- **Node 22+** (Astro 6 requires this; see `package.json` `engines`)
- npm
- A **Cloudflare account** with Wrangler authenticated locally (`wrangler login`)
- A **Resend account** (free tier) for filing-detection email notifications

### Install

```bash
npm install
```

### Local development

```bash
npm run dev          # Astro dev server at http://localhost:4321
npm run build        # static build to dist/
npm run preview      # serve the built site
npm test             # run vitest unit tests
npm run validate     # zod-based validation of all JSON files
```

### Data-layer scripts

```bash
npm run poll-edgar   # check EDGAR for new 13F-HR filings, append to data/_pending.json
npm run classify <slug> <period>   # batch-classify CUSIPs via OpenFIGI + Yahoo Finance
npm run remind       # build the reminder email body (sends via Resend if RESEND_API_KEY is set)
npm run refresh-prices   # refresh data/prices/latest.json via Yahoo Finance quotes
npm run refresh-manager-photos   # download/update local manager headshots from curated sources
npm run check-manager-photos     # CI guard: every active fund has a local manager photo
```

### Quarterly review (semi-automated)

Open the project in Claude Code and run:

```
/update-quarter
```

Claude will fetch any pending filings, classify new CUSIPs, prompt for theme tags on new positions, draft editorial summaries, and stage everything for a single commit. Walk through, approve/edit, and commit when ready.

## Adding a new fund

1. Find the fund's CIK on SEC EDGAR full-text search.
2. Add an entry to `data/funds.json`.
3. Add the lead investor photo source to `scripts/lookups/manager-photo-sources.json`, then run `npm run refresh-manager-photos`. This downloads the image into `public/managers/` and writes `manager_photo` in `data/funds.json`.
4. Create empty `data/funds/<slug>/quarters.json` (`{"slug": "<slug>", "quarters": []}`) and `data/funds/<slug>/tags.json` (`{"slug": "<slug>", "taxonomy": [], "assignments": {}}`).
5. Run `/update-quarter` to backfill the latest two quarters from EDGAR.

`npm run check-manager-photos` runs in CI before deploy, so future active funds cannot ship with only initials unless a local photo path and file exist.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs the test suite, builds the Astro site, and deploys to Cloudflare Workers Static Assets via `wrangler deploy`. The site is live at [https://13f-changes.seankel.com](https://13f-changes.seankel.com); the worker name is `13f-changes` (see `wrangler.toml`).

To deploy manually from your machine:

```bash
npm run deploy
```

## GitHub Secrets

The CI workflows require these to be configured in **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN` — create in the Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template
- `CLOUDFLARE_ACCOUNT_ID` — visible in the Cloudflare dashboard URL or "Account home"
- `RESEND_API_KEY` — from your Resend dashboard
- `EMAIL_TO` — the address that receives the reminder
- `EMAIL_FROM` — the sender address; must be a verified Resend sender domain (the default placeholder `reminders@13f-changes.example.com` will be rejected by Resend)

## Data files

- `data/funds.json` — list of tracked funds (slug, CIK, manager, etc.)
- `data/securities.json` — CUSIP → ticker/sector/industry cache; populated incrementally
- `data/_pending.json` — review queue; the EDGAR poller writes here, `/update-quarter` drains it
- `data/funds/<slug>/quarters.json` — index of all known filings for the fund (newest first)
- `data/funds/<slug>/tags.json` — per-fund thematic taxonomy + CUSIP → tag-IDs assignments
- `data/funds/<slug>/<period>.json` — full holdings for one filing
- `data/funds/<slug>/diff/<period>.json` — derived diff for one filing vs. its prior quarter

- `data/prices/latest.json` - latest Yahoo Finance quote snapshot for current, price-eligible holdings

## Methodology, limitations

See the `/about` page or `src/pages/about.astro`.

## License

Private project; no license file. Public 13F data is public-record information from SEC EDGAR; this site renders it editorially with attribution.
