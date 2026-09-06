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

## Verification tiers — extended (2026-06-10)

The local session that took the HANDOFF baton turned out to be **WebFetch-based,
not Chrome-extension-based** (the planned `Claude in Chrome` tools weren't
actually loaded). So the sweep that produced this update used a server-side
fetcher with no JS execution and no login — closer to "what an HTTP client
sees" than "what a logged-in human sees." We add a tier between `index-only`
and `human-verified` to be honest about that:

| Level | Meaning | Who produces it |
|---|---|---|
| `index-only` | Seen only in search-engine results. | Cloud Claude (sites 403-block direct fetches). |
| `webfetch-verified-*` | A local Claude session opened the URL server-side (`WebFetch`) and read the live page contents. **No JavaScript, no login** — so Kijiji listing pages, Zumper address pages, REALTOR.ca rental detail pages all worked; REW individual listing pages, Condos.ca, Strata.ca, Zolo, Sotheby's individual pages still 403'd; Facebook is login-walled. | Local Claude (this session). |
| `human-verified-*` | A human (or a real logged-in Chrome session) opened the page and saw an active listing / read the lister contact / messaged. | You / Rachel. |

Suffixes for both `webfetch-verified` and `human-verified`: `-active` (live and
matches), `-expired` (dead / no current avail), `-mismatch` (live but a key
detail differs from tracker — note what).

## Current verification state (2026-06-10, after webfetch sweep)

- ❌ **153 Robert St #2B — human-verified EXPIRED** (checked by Sean on Zumper, reconfirmed by webfetch: Zumper address page says 0 currently available across all 4 units)
- ✅ **81 Brunswick — webfetch-verified ACTIVE** at $2,675/mo via REALTOR.ca MLS C13158120 — **BUT availability is June 1, not Sept 1** → wrong timing; logged as `human-verified-mismatch`-equivalent. Andrew Johnston, Sotheby's Int'l Realty Canada.
- ✅ **310 Brunswick Ave — webfetch-verified ACTIVE** (NEW): multiplex unit-in-house with multiple 2BR units listed ($2,000 Unit 2, $2,520 Unit 5 + 6). Annex / target street.
- ✅ **120 Montrose Ave — webfetch-verified ACTIVE** (NEW): 2BR main-floor unit-in-house, $2,500, **Aug 1** (not Sept 1, but a one-month gap is more workable).
- ✅ **261 Markham St — webfetch-verified ACTIVE** (NEW): basement of detached house, 2BR $2,400, Trinity Bellwoods, date TBD.
- ❌ **327 Brunswick Ave #2nd floor — webfetch-verified EXPIRED**: Zumper address page shows 0 current; the 2BR units listed are 1,835–1,852 days old. **But** Liam Sharp (416-822-3316) is the lister on 5 of 7 historical units — strong portfolio-landlord fingerprint, log him as a contact channel for Sept 1.
- ⚠️ **202 Brunswick Ave — verify-availability-date** (no upgrade): Zumper address page shows 0 currently available, but Google search shows REW listing 6+ active units ($1,900–$3,948, including 2BR at $1,900 and $2,895). REW direct page still 403's WebFetch — needs Chrome or human. Royal York PM phone: 905-385-8150.
- ⚠️ **227 Beverley St — verify-still-available**: Condos.ca / Strata.ca / Sotheby's / Zolo all 403/404 to WebFetch. Search snippets confirm Unit 2 still at $2,950 and Unit 3 at $3,100-$3,200 (NEW listing MLS C12662420 via Jump Realty also surfaced). Apartments.com calls building a "Townhouse" (good — confirms unit-in-house type).
- ❌ **2F-150 Beverley (almost added) — EXCLUDED**: Zumper address page for 150 Beverley confirms it's a CONDO BUILDING (purpose-built, elevator, locker). Violates the "no apartment building" rule. Logged as `excluded:apartment-building`.
- ⚠️ **157 Beverley — verify-property-type**: Zumper search snippet calls it "Apartments in Grange Park" → suspicious. Listed price is $1,999 (lower than tracker). Could be a converted Victorian (per old REW copy) OR an apartment building. Needs Chrome/human eye.
- ⚠️ **344 Brunswick Ave / "Robert St & Bloor St W" (#10 & #11) — likely duplicates**: Zumper listing for the #11 URL describes "Brunswick Ave & Bloor St W, $2,950, 2bd, semi-raised basement unit in a house, lister 'JC' property mgmt, 5+ days on market." That's $2,950 (not $2,850), and it matches the cross-streets + rent from #10 exactly → almost certainly the same unit logged twice. Merge.

## What still needs Chrome / a human

- **Facebook Marketplace** (the high-value gap per HANDOFF) — WebFetch can't get past the login wall. The "2 Beds 1.5 Baths - House" share link Rachel saved returned only a truncated title.
- **REW individual rental detail pages** — 403 to WebFetch. Sean's screenshot of 202 Brunswick #2F dying on Point2Homes still applies; the $3,000 REW relist needs a human click.
- **Condos.ca, Strata.ca, Sotheby's, Zolo, REALTOR.ca individual MLS URLs that 404'd** — JS-heavy or geo-gated; need Chrome.
- **Kijiji full search browsing** — Kijiji *did* work for me at the list-page level and at the individual-listing level (no login required for browsing), but the broader sweep (FB groups, full filter use) needs a logged-in browser.
- **227 Beverley still-available check** — need to actually open one of the Condos.ca / Strata.ca / Sotheby's URLs to confirm the listings haven't moved to "leased". Search snippets are recent but not real-time.
