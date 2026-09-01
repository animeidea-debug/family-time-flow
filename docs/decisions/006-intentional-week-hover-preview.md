# Decision 006: Use an intentional one-photo week hover preview

- Status: accepted
- Date: 2026-09-01

## Context

The life grid has 4,160 cells. Immediate multi-photo loading on every pointer
crossing would create noisy Immich traffic, favor desktop mouse interaction over
touch and keyboard users, and compete with the richer click-opened week detail.
At the same time, a restrained visual hint can make the grid feel like a memory
surface instead of a purely numeric chart.

## Decision

- Keep `ENABLE_IMMICH_WEEK_HOVER` as an independent, default-off server
  capability. Shipping the UI does not enable production requests.
- Only fine-pointer devices are eligible. Wait 600 ms on the same cell before
  requesting anything; leaving the cell cancels the pending timer and makes any
  late response ineligible to render.
- Reuse the member/week read-only selector with a Family Time Flow member ID.
  It already enforces person focus, birth date, bounded pagination, exact
  duplicate removal and burst reduction.
- From its at-most-nine chronological results, use the midpoint as the single
  representative image so the preview does not always favor the first day.
- Cache at most 64 member/week results in page memory. Do not persist asset or
  person identifiers in browser storage.
- Touch and keyboard users continue to open the accessible week detail, which
  remains the full nine-photo experience and the only larger-preview entry.

## Consequences

- A deliberate desktop pause can reveal one meaningful photo without turning
  ordinary pointer movement into a stream of requests.
- Empty results are cached for the page session, avoiding repeated searches of
  weeks without eligible photos.
- Enabling the production runtime flag remains a separate NAS configuration
  decision and must be verified against real Immich latency and request volume.
