# Decision 007: Expand sparse “On This Day” results adaptively

- Status: accepted
- Date: 2026-09-03

## Context

An exact calendar-day query is emotionally precise but often sparse. A
production audit on September 3 found 26 images across the previous five years,
but 24 had no face metadata, one contained only a non-household person, and
only one eligible image contained a linked family member. A read-only coverage
check showed that a one-day margin would add useful memories for another
member, while a three-day margin would cover a third member without using
personless photos.

## Decision

- Keep the exact month and day as the first and highest-priority source.
- If the gallery is not full, query the immediately adjacent days, then the
  remaining dates within a maximum three-day margin. The date bands do not
  overlap, and each request remains bounded.
- Preserve the existing five-anniversary horizon, linked-person requirement,
  birth-date guard, exact duplicate removal, and three-minute burst reduction.
- For the household gallery, round-robin eligible results across linked family
  members before filling remaining positions. One photo containing several
  family members is still displayed only once.
- Return and display each asset's real capture date. When adjacent dates are
  used, the UI explicitly says that the exact day was sparse and reports the
  selected margin; it must not label an adjacent photo as the exact anniversary.
- If the full three-day margin still has no eligible image, retain the honest
  empty state. Never fill it with personless or pre-birth photos.

## Consequences

- Sparse dates can produce a useful, family-balanced gallery without weakening
  identity or age protections.
- A request may make up to three bounded search stages, but later stages run
  only while the requested gallery remains incomplete.
- The response includes `windowDays` and `searchedWindowDays` diagnostics so the
  UI and production checks can distinguish exact-day results from fallback.
