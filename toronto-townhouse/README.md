# Toronto 2-Bed House Search 🏠

Helping Rachel + friend find a **2-bedroom house / townhouse** (NOT an apartment
building) in downtown Toronto, on a tight list of streets, under **$3,500/mo**.

## The core strategy (in Rachel's words)

> "the tricky thing w looking for a house to rent is that it's not through the
> mega sites so it's been a bit harder to find them. I think strat is to reach
> out to individual landlords who own a lot of rental properties, like my old
> landlord Tim."

That single insight drives everything here. The good houses on these streets
rarely sit on Zillow/realtor.ca with a tidy filter — they move through small,
often-unlisted **portfolio landlords** and tiny Annex property managers. So the
job splits into two tracks:

1. **Discovery** — find the houses *and* find the "Tims" (landlords/managers who
   own many houses on these streets). See `landlord-leads.md`.
2. **Outreach** — contact those landlords directly, warmly, with specifics. See
   `outreach-templates.md`.

## Who does what

| | Claude (me) | You / Rachel / friend |
|---|---|---|
| Run recurring search sweeps across every source | ✅ | |
| Maintain the master tracker + dedupe + score | ✅ | |
| Build the portfolio-landlord database ("the Tims") | ✅ | |
| Generate precise pre-filtered deep links per source | ✅ | |
| Draft personalized outreach messages | ✅ | |
| Click the deep links / browse Facebook & Kijiji (login-walled) | | ✅ |
| Book & attend viewings, vibe-check, negotiate, sign | | ✅ |

**Why the split:** most listing sites (Kijiji, Facebook Marketplace, Trovit,
ARentals, etc.) block automated access (HTTP 403) and/or require login, so I
can't reliably scrape them live. What I *can* do reliably is run web-search
sweeps that surface new listings + landlord fingerprints, keep the accumulated
state, and hand you ready-to-click filtered links. You spend 5 minutes clicking
instead of an hour building searches.

## Files

- **`criteria.md`** — exact requirements, the 9 streets w/ map context, scoring rubric, and an important reframing of what "house, no apartment building" realistically means on these streets.
- **`listings.csv`** — the master tracker. Every candidate, deduped, scored, with status.
- **`landlord-leads.md`** — the portfolio-landlord database: who to contact, who to avoid, and the fingerprinting method.
- **`search-links.md`** — pre-built, pre-filtered deep links into every source. The humans' click-list.
- **`outreach-templates.md`** — copy-paste messages for landlords, PMs, and listing posters.

## How a sweep works (repeatable)

Each time we run a sweep, I:
1. Search every source for new 2-bed houses on the 9 streets (+ Trinity Bellwoods).
2. Add new finds to `listings.csv`, dedupe against what's already there, score each.
3. Update `landlord-leads.md` with any recurring landlord/agent/PM fingerprints.
4. Flag the top new candidates and draft outreach for any worth contacting now.

Ask me to "run a sweep" anytime, or have me schedule recurring sweeps.

## Status

- **Set up:** 2026-06-10 — scaffold + first discovery pass complete.
- **Reality check:** see the budget note in `criteria.md`. A true 2-bed *house*
  on these exact streets under $3,500 is rare; the realistic target is a 2-bed
  *floor/unit in a converted Victorian/Edwardian* (which is what 77 Robert and
  202 Brunswick are). That's still "a house, not an apartment building."
