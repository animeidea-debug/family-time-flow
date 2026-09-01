# Family Time Flow — current progress

> Current handoff snapshot. Durable rules live in `AGENTS.md`; stable product
> information lives in `README.md` and the linked design and deployment docs.
>
> Last verified: 2026-09-01 Asia/Shanghai

## Current state

- Production runs commit `2088447afdc0d3117f7e55ac30a3b11b51d3fcbf`
  through the NAS-owned `nas-deploy` release system on Node 22.
- `nas-deploy status` and `nas-deploy doctor` pass. The FTF container is
  running and healthy, `/api/health` reports storage ready with backups
  enabled, and the persistent SQLite database opens successfully.
- Immich onboarding is enabled through a NAS mode-0600 service secret. The
  read-only FTF adapter returns 10 named people and 10 working face thumbnails
  in production. The approved key now has only `person.read`, `asset.read`, and
  `asset.view`; credentials are not stored in this repository, SQLite, or the
  browser.
- A read-only production asset audit covered all four linked members. All four
  returned assets; 12 sampled images had person and date metadata, and all 12
  thumbnail responses were valid images. No originals were downloaded
  and no Immich data was changed.
- The server-gated “On This Day” card is enabled in production. Post-deployment
  verification returned six current-date memories, 3/3 sampled thumbnails and
  2/2 sampled previews; the household UI loaded all six thumbnails, opened a
  1440×1920 read-only preview, restored keyboard focus on close, and reported
  no browser console warnings or errors.
- “On This Day” and week-grid photo lookup now have independent server
  capabilities. Production reports `memoriesEnabled: true` and
  `weekHoverEnabled: false`, so the reviewed household card remains available
  without enabling per-week photo searches.
- Browser verification from the home LAN confirms four persisted household
  members, the Immich-aware welcome hint, deferred-photo-memory ticker, in-app
  brand navigation, and the multi-select person picker. The picker loads all 10
  person thumbnails, with six selectable and four already created people,
  prioritizes selectable people, and reports no business console errors.
- Student, worker, and family themes now use explicit high-contrast primary,
  secondary, and muted text tokens. Primary actions, active theme controls,
  input placeholders, and keyboard focus states remain legible on their light
  backgrounds. Desktop and 390px mobile layouts were visually verified.
- The fixed-row week-grid release is deployed. Production verification
  confirmed 4,160 week cells for the active member, 52-column year rows,
  week 52/53 crossing into separate rows, the family-event legend, current-week
  focus/recentering, and a clean browser console. The active member had no local
  events, so the production event underline remains a user batch-check item;
  its marker, accessible count, and detail display passed isolated browser
  verification. Color remains reserved for elapsed/current/future time, a white
  diamond marks milestones, and a dark underline marks local family events.
- Personal and household navigation now resets the page to the top. Members
  without a target still receive no fabricated countdown, and identity tags
  remain manually editable after Immich import.
- The production household now contains one user-approved real upcoming event.
  Its household-card display and edit-form values were verified, the backend
  container was restarted, and the event remained present afterward. The first
  immediate post-restart API probe hit the startup window; the repeated
  `nas-deploy doctor` check passed all FTF API and database checks.
- Tailwind CSS, daisyUI, GSAP, and Flatpickr are now served from a
  version-locked local bundle. Production clean-load verification found five
  NAS-hosted assets, no external script or stylesheet elements, and no browser
  warnings or errors. The committed bundle is protected by a rebuild-and-hash
  comparison in `npm test`.
- PR #4 (documentation and live-status UX), PR #5 (duplicate ticker
  regression), PR #7 (first-member polish), PR #9 (additional-member picker),
  PR #11 (readability and picker clarity), PR #14 (offline frontend assets),
  PR #16 (read-only “On This Day” memories), and PR #17 (independent memory
  capability hardening), and PR #18 (accessible week detail and unified grid
  semantics) are merged into `main`. The existing two experimental HTML files
  remain untracked and excluded from release.

## Active work

- Branch `codex/current-week-event-markers` contains and has deployed commit
  `2088447afdc0d3117f7e55ac30a3b11b51d3fcbf`. It fixes every row at 52 weeks
  while zooming only the physical grid size, adds an explicit “locate current
  week” control, and marks weeks containing local family events with a dark
  underline rather than another competing color. Async event loading rebuilds
  the markers and preserves an open week-detail dialog's focus target.
- The branch's validated fit-width follow-up replaces the 75%/100%/150% in-card
  zoom controls with an always-fit-width overview. Desktop can expand the life
  grid across the full dashboard row; 390px mobile retains the complete 52-week
  row without horizontal scrolling and continues to use the week-detail dialog
  for precise reading. Isolated browser verification covered default,
  expanded, collapsed, event-detail, and mobile states with an empty error
  console. The follow-up passes all 23 frontend contracts, all 24 backend
  integration tests, backend syntax validation, frontend asset rebuild/hash
  verification, and `git diff --check`.
- The release passed 23 frontend contracts and 24 backend integration tests
  locally and in the NAS release gate, plus backend syntax, frontend asset
  rebuild/hash verification, and `git diff --check`. Isolated browser checks at
  desktop and 390×844 covered the deployed zoom behavior, unchanged 52-week
  rows, the event marker and event detail, current-week focus/recentering,
  mobile navigation, and an empty warning/error console. No production or
  Immich data was used.
- `nas-deploy status` and `nas-deploy doctor` passed after release. The NAS
  created the required pre-release SQLite backup before the atomic switch;
  rollback remains `nas-deploy rollback family-time-flow`.
- `main` is merged through PR #18. Production is intentionally one reviewed
  feature commit ahead on `codex/current-week-event-markers` until the user
  completes the batch interaction check and the branch is merged.
- No code or infrastructure blocker remains for current household use.
- The production household has four user-created members and one real event;
  the agent did not create synthetic production records.

## Known issues

- Additional household members remain a human decision: select the intended
  people and supply any missing birth dates.
- Photo timeline and week-hover memories remain outside the reviewed production
  scope; “On This Day” is the only enabled photo-memory experience.
- The family API has no login and must remain restricted to the trusted LAN or
  an access-controlled private network.

## Next steps

1. Deploy the validated fit-width/focus-mode follow-up only after explicit
   approval through the NAS-owned immutable-SHA release command.
2. Batch-verify all members in desktop default/expanded and 390px mobile views,
   including current-week location, event-marked details, and keyboard focus.
3. Review and merge `codex/current-week-event-markers` after the batch check;
   production can remain on the immutable reviewed SHA meanwhile.
4. Observe “On This Day” during normal family use before proposing any broader
   photo timeline or week-hover scope.
5. Verify an event edit when a real change is needed; exercise deletion only
   with explicit approval for a disposable or obsolete event.
6. Let the user add any remaining household members and complete missing birth
   dates in the home LAN.
7. Keep the unauthenticated API on the trusted LAN; review authentication before
   any broader network exposure.

## Operation entry points

```sh
npm test
node --check web/backend/family-time-flow/server.js
git diff --check

# On the NAS, after an approved full SHA is pushed:
nas-deploy family-time-flow --ref <full-40-char-commit-sha>
nas-deploy status
nas-deploy doctor
```

Production Compose, nginx, secret files, persistent mounts, and rollback remain
owned by the sibling NAS repository.
