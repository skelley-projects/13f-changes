# Verification checklist — for a human or a local Claude-in-Chrome session

The remote (cloud) Claude session that maintains this tracker **cannot open
listing pages** — Zumper, PadMapper, Kijiji, Point2Homes, Apartments.com, REW,
Condos.ca all block its fetches (HTTP 403), and Facebook/Kijiji need a login.
So availability must be confirmed in a real browser.

**Best tool for this:** the **Claude in Chrome extension** with Claude Code
running locally on your machine. It drives your actual logged-in Chrome, so it
can open every link below (including Kijiji/Facebook), read the live page, and
update this repo. The cloud session and a local session can share work through
this git branch: local session verifies → commits status changes → cloud session
picks them up on the next sweep.

## Prompt to paste into a local Claude Code session (with Chrome connected)

> Open `toronto-townhouse/listings.csv` on branch
> `claude/toronto-townhouse-search-029n3j`. For every row whose status is not
> `excluded` or `EXPIRED-lead-only`: open `source_url` in Chrome. Record:
> (1) does a live, active listing exist for that exact unit? (2) current rent,
> (3) availability date (we need **Sept 1**), (4) lister name/phone/email,
> (5) house/unit-in-house vs apartment building. Update each row: set status to
> `human-verified-active`, `human-verified-expired`, or `human-verified-mismatch`
> (details changed — note what). Append lister contacts to
> `landlord-leads.md` (they feed the portfolio-landlord clustering). Commit and
> push to the same branch with message "browser verification <date>".

## Manual version (no extension)

Per row in `listings.csv`: click the link → if generic/search page appears, the
listing is dead → text/tell the cloud session "X is dead" or edit the status
yourself. If live: grab rent, availability date, and the lister's contact.

## Current verification state (2026-06-10)

- ❌ **153 Robert St #2B — human-verified EXPIRED** (checked by Sean on Zumper)
- ❌ **202 Brunswick on Point2Homes — dead link** (Sean's screenshot); REW
  relisting at $3,000 is **index-only, unconfirmed**
- ⚠️ Everything else: **index-only — treat as unconfirmed leads, not availabilities**
