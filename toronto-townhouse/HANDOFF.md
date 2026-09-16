# HANDOFF — local Claude session with Chrome extension

You are a **local Claude Code session with the Claude-in-Chrome extension
connected**. You're taking over the browser-dependent half of an apartment hunt
that a remote (cloud) Claude session set up but cannot finish, because every
listing site (Zumper, PadMapper, Kijiji, Point2Homes, Apartments.com, REW,
Condos.ca) blocks its fetches with HTTP 403, and Kijiji/Facebook need a login.
**You have a real, logged-in Chrome. You don't have that problem.**

## Kickoff prompt (Sean: paste this into the local session)

> Read `toronto-townhouse/HANDOFF.md` on branch
> `claude/toronto-townhouse-search-029n3j` and do what it says. Start with
> Task 1 (verify the tracker), then Task 2 (harvest contacts), then as much of
> Task 3 (logged-in sweeps) as you can. Commit and push to the same branch.

## Mission (30 seconds of context)

Rachel + her friend need a **2-bedroom house or unit-in-a-house — NEVER a unit
in an apartment building/condo tower** — in downtown Toronto, **≤ $3,500/mo**,
**move-in Sept 1, 2026**. Target streets (the only ones that count): Robert ⭐,
Major, Brunswick, St. George ⭐, Prince Arthur, Lowther, Beverley, McCaul, Elm,
plus near Trinity Bellwoods Park. Strategy: the good houses move through small
**portfolio landlords** ("Tims"), not mega-sites — so harvesting lister contacts
matters as much as the listings themselves.

Read in this order: `criteria.md` (rules + scoring + timing), `listings.csv`
(the tracker), `landlord-leads.md` (the landlord database), `search-links.md`
(QC protocol + click-list), `outreach-templates.md`.

## Hard rules (inherited from the user — do not relax)

1. **No apartment buildings.** If Chrome shows a tower/midrise, set
   `excluded:apartment-building`, score 0.
2. **Drafts only — never send.** Do not submit contact forms, send messages, or
   email anyone. Write drafts into `outreach-drafts.md`; humans send them.
3. **Push only to `claude/toronto-townhouse-search-029n3j`** (PR #3 tracks it).
   Never force-push; the cloud session also writes here — `git pull` first.
4. **Never invent contacts.** A phone/email/name goes in the repo only if you
   read it off a live page (note URL + date).
5. **Verification honesty.** Only a page you actually loaded counts. Statuses
   you may set: `human-verified-active`, `human-verified-expired`,
   `human-verified-mismatch` (live but details differ — note what changed).
   Everything else stays `index-only`.

## Task 1 — Verify the tracker (highest priority)

For each row in `listings.csv` not already `excluded` or `EXPIRED-lead-only`:
open `source_url` in Chrome (fallbacks in notes). Determine: live listing for
that exact unit? Current rent? **Availability date — Sept 1 is the target;
"available now" = lead, not a match.** Update the row: status, rent, and a note
`verified <date> via <site>`. If dead, try the Google fallback query in the
notes before declaring `human-verified-expired`.

Known state going in: #6 (153 Robert #2B) already human-verified EXPIRED;
#1 (202 Brunswick) dead on Point2Homes, REW relist at $3,000 unconfirmed;
all others index-only.

## Task 2 — Harvest lister contacts (the "find the Tims" engine)

On every **live** listing: capture lister name, phone, email, company → append
to the leads table in `landlord-leads.md` with source URL + date. Flag any
contact appearing on **2+ houses** as `⭐ portfolio`. Specific follow-ups:
- **ARentals** (arentals.ca) — Annex-born, house-focused: get their contact info
  + current vacancies on target streets.
- **Royal York PM** — manages a unit at 202 Brunswick + many Toronto houses:
  find their listings page, search 2-bed houses in M5S/M5R for Sept 1.
- **227 Beverley** (units 2 & 3 listed together) — get the lister's contact.
- **Buttonwood PM** — confirm they manage houses (not just buildings).

## Task 3 — Logged-in sweeps (where the cloud session is blind)

Using `search-links.md` (Kijiji per-street links, FB Marketplace filters,
Craigslist URLs, PadMapper map box): hunt for 2-bed houses/units-in-houses on
the target streets, ≤$3,500, ideally Sept 1. **Facebook is the highest-value
gap** — Marketplace (Home type = House/Townhouse) and neighbourhood rental
groups; also find the post Rachel saved: a "2 Beds 1.5 Baths - House" share
(facebook.com/share/1RqXfo7hda) — get its address, price, poster, and
availability. Add every find as a new `listings.csv` row (next free id,
`human-verified-active`, score per the rubric in `criteria.md`) and harvest the
poster's contact per Task 2.

## Task 4 — Report back

Commit with message `browser verification <date>` (+ a summary line of what
changed) and push. Then tell Sean: counts (verified active / expired / new
finds / new landlord contacts), the single best Sept-1-compatible candidate,
and anything that needs a human decision. The cloud session reads the diff on
its next sweep and takes the baton back (search sweeps, dedupe, scoring,
outreach drafting).

## CSV conventions

Columns: `id,date_found,address,street,cluster,type,beds,rent,landlord_or_source,score,status,source_url,notes`.
- `cluster`: A = N. Annex/Yorkville, B = Harbord Village/U of T (her sweet
  spot), C = Grange/Elm, TB = Trinity Bellwoods.
- `type`: `whole-house` | `unit-in-house` | `excluded:apartment-building`.
- Keep dead rows (status changed) — history prevents re-adding duds.
- Durable links preferred: address pages (`zumper.com/address/...`) or
  REALTOR.ca MLS pages > listing-ID URLs. Always keep a Google-query fallback
  in notes.
