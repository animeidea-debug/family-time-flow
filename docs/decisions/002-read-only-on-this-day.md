# Decision 002: Gate the first photo-memory experience behind a server flag

- Status: accepted
- Date: 2026-08-30

## Context

Immich 3.0.2 asset search and thumbnail access are healthy for every linked
household member, but photo memories introduce a new dependency into an
otherwise independent family-time application. A permission regression,
indexing delay, or Immich outage must not make the household dashboard appear
empty or unavailable.

The approved integration key can read people, asset metadata, and rendered
thumbnails. It cannot download originals or change Immich data.

## Decision

- Ship the first experience as a household-level “On This Day” card.
- Keep it disabled unless both `ENABLE_IMMICH=1` and
  `ENABLE_IMMICH_MEMORIES=1` are set on the server.
- Keep week-grid photo lookup behind a separate
  `ENABLE_IMMICH_WEEK_HOVER=1` capability; enabling this decision's feature
  must not expand into per-week searches.
- Expose only the resulting capability boolean through `/api/bootstrap`; never
  expose credentials or runtime URLs.
- Search the same month and day across the previous five years, excluding the
  current year, using concurrent read-only metadata requests.
- Request images only and return a minimal DTO: asset ID, capture time, year,
  and type. Do not return original paths, filenames, or person names.
- Render repository-local UI states for disabled, loading, empty, partial, and
  unavailable results.
- Proxy only Immich `thumbnail` and `preview` sizes. Original-file download is
  outside this feature and its permissions.

## Consequences

- The feature can be enabled, observed, or disabled without changing family
  records or Immich data.
- Core household use remains available when Immich is disabled or unhealthy.
- Five concurrent LAN requests occur once per household page/day, with a
  manual retry and a short private cache.
- Week-grid photo hover, event galleries, videos, and original downloads remain
  separate future decisions.
