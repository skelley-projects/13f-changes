# Click-list: pre-filtered deep links per source

## 🔗 Link quality-control protocol (why links sometimes redirect)

Listing sites kill expired listing-ID URLs and silently redirect you to a generic
search page (this happened with a Zumper `...5523551p` link). Sites also block my
direct page-fetches (403), so I can't click-verify. The QC I run instead, for
every candidate before it ships:

1. **Cross-verify via fresh search** — the address must appear in current search
   results on 2+ sites with matching beds/rent, with a `verified <date>` note.
2. **Prefer durable URL forms**, most-stable first:
   - **REALTOR.ca MLS links** (`realtor.ca/real-estate/<id>/...`) — most stable
   - **Address pages** (`zumper.com/address/...`, HotPads address pages) — list
     all units at the address, survive individual listings expiring
   - **Listing-ID pages** (`...5523551p`, apartments.com hashes) — least stable;
     used only when nothing better exists
3. **Always a fallback** — each tracker row notes a Google query
   (`"<address>" Toronto rent`) that re-finds the listing wherever it lives now.
4. **If a link redirects you to a generic page → tell me.** That's a signal the
   listing expired; I'll re-verify and either fix the link or mark it dead.

### Verification levels (be honest about what each row means)

Hard lesson from 153 Robert St (06-10): a listing can appear in *fresh* search
results — details, price, even "available immediately" — and still be **dead**,
because Zumper/PadMapper keep expired pages up for SEO and search engines serve
the cached snippet. So every tracker row carries one of:

| Level | Meaning | Who can produce it |
|---|---|---|
| `index-only` | Seen in search-engine results. Existence of the unit is real; **availability is UNCONFIRMED.** | Me (remote Claude — listing sites 403-block my direct fetches) |
| `human-verified` | A human (or a local Claude-in-Chrome session) opened the live page and saw an active listing / contacted the lister. | You / Rachel / local Claude session |

**Default assumption: every row I add is `index-only` until one of you upgrades
or kills it.** Treat `index-only` rows as *leads to check*, never as "available."
The fastest upgrade path is the checklist in `verify-checklist.md`.


Since the big sites block automated access, here are ready-to-click searches
filtered as close to our criteria as each site allows. Rachel/friend: open these
(bookmark them), and paste anything promising back to me to log + score + dedupe.
Re-check the fast-moving ones (Kijiji, FB, Craigslist) **daily** — good houses go
in hours.

## The 9 target streets (for copy-paste)
`Robert St` · `McCaul St` · `Major St` · `Brunswick Ave` · `St. George St` ·
`Prince Arthur Ave` · `Lowther Ave` · `Beverley St` · `Elm St` · `Trinity Bellwoods`

---

## Fast-moving (check daily) — where private/portfolio landlords actually post

### Facebook Marketplace + Groups  *(login required — human only)*
- Marketplace → Property Rentals, set area to Toronto, **filter Home type = House/Townhouse**, beds = 2, max price $3,500.
- High-value **Groups** (private landlords post here, not mega-sites):
  - "Toronto Apartments / Rentals", "Annex / Harbord Village Rentals",
    "University of Toronto Housing / Off-Campus", "Trinity Bellwoods Rentals".
  - In each group, search the street names above.
- The FB post Rachel found ("2 Beds 1.5 Baths - House") lives here — paste me the
  address/details and I'll log it + draft outreach to the poster.

### Kijiji — Long-term Rentals, City of Toronto  *(per-street keyword searches)*
Pattern works for any street — swap the keyword:
- Brunswick: https://www.kijiji.ca/b-apartments-condos/city-of-toronto/brunswick-ave/k0c37l1700273
- Robert St: https://www.kijiji.ca/b-apartments-condos/city-of-toronto/robert-st/k0c37l1700273
- Major St: https://www.kijiji.ca/b-apartments-condos/city-of-toronto/major-st/k0c37l1700273
- St. George: https://www.kijiji.ca/b-apartments-condos/city-of-toronto/st-george/k0c37l1700273
- Harbord/Annex: https://www.kijiji.ca/b-apartments-condos/city-of-toronto/harbord/k0c37l1700273
- Trinity Bellwoods: https://www.kijiji.ca/b-apartments-condos/city-of-toronto/trinity-bellwoods/k0c37l1700273
- Then set: Unit Type = **House**, Bedrooms = 2, Max price = $3,500.

### Craigslist Toronto  *(query + filters in URL — usually loads fine)*
- Brunswick: https://toronto.craigslist.org/search/apa?query=brunswick&max_price=3500&min_bedrooms=2
- Robert St: https://toronto.craigslist.org/search/apa?query=robert%20st&max_price=3500&min_bedrooms=2
- Annex: https://toronto.craigslist.org/search/apa?query=annex&max_price=3500&min_bedrooms=2
- Trinity Bellwoods: https://toronto.craigslist.org/search/apa?query=trinity%20bellwoods&max_price=3500&min_bedrooms=2
- On the left, set **Housing type = house** and **In-unit/laundry** as desired.

---

## Map-based (good for "houses only" filtering)

- **PadMapper** (best map + house filter): https://www.padmapper.com/apartments/toronto-on — draw a box over the Annex/Harbord Village, set Beds 2, Max $3,500, Type = House/Townhouse.
- **Liv.rent**: https://liv.rent/long-term-rentals/on/toronto — verified-landlord focused, often smaller landlords.
- **rentals.ca — The Annex (houses)**: https://rentals.ca/toronto/the-annex
- **rentals.ca — Harbord Village**: https://rentals.ca/toronto/harbord-village

---

## Small Annex landlords / managers (the "Tim" channel)

- **ARentals** (Annex-born, house-focused): https://arentals.ca/  → check vacancies + grab contact (see landlord-leads.md)
- **Buttonwood PM — Annex**: https://buttonwood.ca/service-areas/annex/
- **Viewit.ca** (old-school, lots of private Toronto landlords): https://www.viewit.ca/
- **Realtor.ca — The Annex rentals** (houses listed by agents): https://www.realtor.ca/on/toronto/the-annex/rentals

---

## What to paste me for each find
Address (or nearest cross-streets) · beds · rent · house or apartment-building? ·
poster/landlord name + phone/email · link. I'll dedupe, score, update the tracker,
and tell you if that contact is a known portfolio landlord.
