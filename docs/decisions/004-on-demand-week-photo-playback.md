# Decision 004: Load personal week photos inside the week detail

- Status: accepted
- Date: 2026-09-01

## Context

The life grid contains thousands of small week cells. Hover-driven photo lookup
would create accidental requests, does not work consistently on touch devices,
and cannot present enough context to judge a photo. The existing click, touch,
and keyboard week-detail dialog already provides the week's dates, life stage,
milestones, and family events.

## Decision

- Keep `ENABLE_IMMICH_WEEK_HOVER` disabled. Clicking or keyboard-opening a week
  is the only trigger for its photo lookup.
- Address a week with a Family Time Flow member ID and zero-based life-week
  index. The backend resolves the member's birth date, date range, and Immich
  person ID; the browser never supplies an Immich person ID.
- Reuse the enabled read-only memory capability and existing thumbnail/preview
  proxy. Do not add Immich permissions, original downloads, or write behavior.
- Query only images for the resolved person and seven-day range. Follow
  Immich's `assets.nextPage` cursor for at most three 100-item pages (300
  metadata candidates). Reject pre-birth or unusable capture dates, exact
  duplicates, and overlapping three-minute bursts.
- Select at most nine photos in rounds across represented calendar days, then
  show the result chronologically. Do not fill missing positions with unrelated
  photos.
- Render a three-column gallery on larger screens and two columns on phones.
  Loading, disabled, unlinked, empty, error, and retry states remain inside the
  week detail and do not block local family-time data.
- Ignore stale responses after member changes, adjacent-week navigation, dialog
  close, or a newer retry.

## Consequences

- Opening a week performs one bounded read-only Immich search of up to three
  requests; merely moving across the life grid performs none.
- A photo-rich week may show fewer than all available photos by design. Nine is
  a playback summary, not a photo browser.
- The feature inherits the trusted-LAN boundary and the existing
  `ENABLE_IMMICH_MEMORIES` release gate.
- Closing a photo preview returns focus to its week-gallery button; closing the
  week detail returns focus to the originating week cell.
