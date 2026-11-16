# Search criteria

## Must-haves
- **2 bedrooms** (for the two of them)
- **A house / townhouse — NOT an apartment building.** This is the hard rule.
  Acceptable: detached/semi/row house, or a self-contained floor/unit *within* a
  converted house (e.g. main-floor unit, upper duplex). Not acceptable: units in
  a mid/high-rise apartment building or condo tower.
- **Under $3,500/mo** total
- **On (or within ~1 block of) the target streets below**, or near Trinity Bellwoods

## ⏱️ Timing (Sept 1 move-in)

Today is **2026-06-10**, target move-in **Sept 1** → ~83 days out.

Toronto rentals post ~**60 days ahead** and leases cluster on the 1st, so:
- **Peak Sept-1 inventory lands ~early July.** Right now most live listings are
  for **July 1 / Aug 1** — too early for a Sept 1 move-in unless a landlord will
  hold it (rare) or you eat empty months.
- **Plan:** keep a light watch through June; **ramp to daily sweeps in early
  July**; lock something down **mid-July to mid-August**. Searching seriously in
  late August = slim pickings for Sept 1.
- When logging a candidate, record its **availability date** and match against
  Sept 1, not just rent/location.

## Nice-to-haves (fill in / confirm with Rachel)
- Move-in date: **September 1, 2026** (target)
- Laundry (in-unit vs in-building vs none): _TBD_
- Parking: _TBD_
- Pets: _TBD_
- Outdoor space (yard/deck/porch): _TBD_
- Lease length: _TBD_

## Target streets (her shortlist)

She lived at **77 Robert St and loved it**, and **visited 212 St. George St and
really liked it** — those two are the strongest signal for what she wants.

The 9 streets fall into 3 clusters:

**Cluster A — North Annex / Yorkville (quieter, leafier, pricier)**
- Prince Arthur Ave
- Lowther Ave
- St. George St ⭐ (liked 212)

**Cluster B — Harbord Village / U of T core (her sweet spot)**
- Robert St ⭐ (lived at 77, loved it)
- Major St
- Brunswick Ave
- (St. George also borders this)

**Cluster C — Downtown core / Grange / Chinatown (busier, more central)**
- McCaul St
- Beverley St
- Elm St

**Plus:** near **Trinity Bellwoods Park** (west of the others — Queen/Dundas West).

> Note: Clusters A and C are dominated by **apartment buildings** (Hollyburn at
> 50 Prince Arthur, Briarlane at 85 Lowther, Sterling Karamar's Elm Place at
> 200–222 Elm, etc.) — these violate the "no apartment building" rule and are
> filtered OUT in the tracker. The house stock is densest in **Cluster B
> (Harbord Village)** and around **Trinity Bellwoods**. Weight effort there.

## ⚠️ Budget reality check (important)

Market data from the first sweep: average **2-bed in the Annex ≈ $3,512/mo**, and
actual *houses* skew higher than that average (apartments drag it down). A whole
2-bed *house* on these streets under $3,500 will be rare.

What *does* hit $2,500–$3,200 on these exact streets is a **2-bed floor/unit in a
converted Victorian/Edwardian house** — e.g. a main-floor 2-bed, or the upper two
floors of a semi. That is exactly what 77 Robert and 202 Brunswick are. So:

- The realistic target = **"a unit in a house, not an apartment building."**
- If they truly need a *whole* house, expect to flex budget up or the radius out.

I'll surface both and label each: `whole-house` vs `unit-in-house` vs `excluded:apartment-building`.

## Scoring rubric (used in listings.csv → `score`)

Each candidate scored 0–10:
- +4 — is a house / unit-in-house (not apartment building) [hard gate; if fail, exclude]
- +2 — on a ⭐ street (Robert, St. George) or exact shortlist street
- +1 — in Cluster B or near Trinity Bellwoods
- +2 — rent ≤ $3,500 (+1 more if ≤ $3,000)
- +1 — 2 bed confirmed (vs "2 bed + den" ambiguity or 1+den)
- bonus — direct private landlord / portfolio landlord (vs big PM) → flag, not score
