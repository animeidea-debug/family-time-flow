# Decision 003: Select person-focused and deduplicated photo memories

- Status: accepted
- Date: 2026-09-01

## Context

The first “On This Day” release selected the newest matching assets for each
calendar day. That allowed landscapes, screenshots, duplicate imports, and
short camera bursts to occupy the limited household gallery. The product goal
is to recall family members, not to mirror an unfiltered camera roll.

Immich already returns recognized people, duplicate grouping, favorite state,
capture time, and rendered thumbnails through the approved read-only API. The
Family Time Flow database also knows which Immich people are linked to created
household members.

## Decision

- Request a larger bounded metadata candidate pool for the same day across the
  previous five years, with people and EXIF metadata included.
- Keep only assets containing at least one Immich person linked to a current
  Family Time Flow member. Do not backfill empty slots with personless photos.
- Prefer favorites, photos containing more linked household members, and then
  photos containing more recognized people.
- Remove exact duplicates by Immich duplicate group or checksum, with asset ID
  as the final identity fallback.
- Treat photos captured within 90 seconds as one camera burst when their linked
  household-person sets overlap by at least half of the smaller set. This
  tolerates face-recognition variance between otherwise repetitive frames.
- Select from years in rounds so one recent year cannot occupy the whole
  gallery.
- Continue returning only the minimal public asset DTO. Selection diagnostics
  expose counts and the mode name, never person names, file paths, or secrets.

## Consequences

- The gallery may intentionally be empty when face recognition has no linked
  family match; this is preferable to unrelated filler.
- The same five concurrent read-only searches now request more metadata per
  year, bounded to at most 100 candidates each and cached privately for five
  minutes.
- Face-recognition misses or incorrect Immich person links affect selection
  quality but never block household data or mutate Immich.
- The existing thumbnail/preview-only permission and feature-flag boundaries
  remain unchanged.
