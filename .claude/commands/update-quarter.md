---
description: Process queued 13F filings — fetch, parse, classify, tag, summarize.
---

You are conducting the quarterly review for the 13f-changes project. Read `data/_pending.json` and process each pending filing in order.

For EACH pending filing:

## 1. Fetch and parse

Use `tsx scripts/run-fetch-and-parse.ts <slug> <accession>` to download the filing and write the parsed JSON to `data/funds/<slug>/<period>.json`. The wrapper at `scripts/run-fetch-and-parse.ts` handles fetch + parse + write.

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

Run `tsx scripts/run-compute-diff.ts <slug> <period>` which writes `data/funds/<slug>/diff/<period>.json`.

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

`Q4 2025 update: situational-awareness +5/-2/+12/-8, duquesne +3/-1/+8/-4`

Stop. The user reviews and commits.

## 7. Drain the pending queue

After all pending filings are processed and committed, edit `data/_pending.json` to remove the entries you handled. Stage and commit that as a separate commit.
