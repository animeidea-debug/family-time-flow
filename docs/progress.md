# Family Time Flow — current progress

> Current handoff snapshot. Durable rules live in `AGENTS.md`; stable product
> information lives in `README.md` and the linked design and deployment docs.
>
> Last verified: 2026-09-03 Asia/Shanghai

## Current state

- Production runs commit
  `1c22c8f4ab49f58d02c10d7cd052ff771bce502b` through the NAS-owned
  `nas-deploy` release system on Node 22. It includes household and personal
  person-focused memories, the personal pre-birth guard, and on-demand week
  photo playback inside the accessible week detail, bounded Immich pagination,
  server-private person links, and the intentional desktop hover preview.
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
- The server-gated “On This Day” card is enabled in production. It now searches
  the exact day first, then fills a sparse gallery from non-overlapping ±1-day
  and ±3-day bands while preserving linked-person, birth-date, duplicate, and
  burst guards. Household selection gives each linked member a fair first pass,
  and every adjacent result displays its real capture date.
- “On This Day” and week-grid photo lookup now have independent server
  capabilities. Production reports `memoriesEnabled: true` and
  `weekHoverEnabled: true`; the independent switches still allow hover lookup
  to be disabled without affecting the reviewed household card or click-opened
  weekly playback.
- Each member page requests a four-item personal “On This Day” gallery by
  Family Time Flow member ID. The backend resolves the Immich person link and
  never accepts that person ID from the browser. The September 3 adaptive-window
  production check found 4, 4, 3, and 0 eligible photos for the four members;
  responses completed in 244–471 ms. The member with no eligible result now
  receives an explicit “exact day and ±3 days checked” empty state rather than
  a personless or pre-birth fallback.
- Opening a week now performs a bounded personal-photo search by Family Time
  Flow member ID and life-week index. The backend computes the seven-day range,
  resolves the Immich person, follows at most three 100-item metadata pages,
  removes duplicates and overlapping bursts, balances at most nine results
  across represented days, and returns them in chronological order. An
  intentional desktop hover reuses this selector after a 600 ms dwell and
  presents one representative image.
- Production API sampling covered four members: representative weeks returned
  6, 9, 1, and 9 eligible photos with valid private selection diagnostics. A
  browser check loaded all nine thumbnails for a photo-rich historical week,
  preserved the correct week after a rapid next/previous sequence, opened the
  read-only preview above the week dialog, restored photo and week-cell focus on
  close, and reported no browser errors.
- A post-release photo-rich-week check returned 96 candidates instead of the
  former 72-item request cap, reduced them to 38 after duplicate/burst handling,
  and displayed nine loaded thumbnails. A second historical week also retained
  nine items.
- Ordinary `/users`, `/sync`, `/bootstrap`, and `/household/view` responses were
  checked in production and contain neither `immich_person_id` nor `personId`.
  They expose only linked state; member avatars use the private member-ID proxy.
  Browser QA confirmed a loaded avatar, no old person-thumbnail URL, and a
  visible “已关联照片人物” state in member settings.
- Browser verification from the home LAN confirms four persisted household
  members, the Immich-aware welcome hint, deferred-photo-memory ticker, in-app
  brand navigation, and the multi-select person picker. The picker loads all 10
  person thumbnails, with six selectable and four already created people,
  prioritizes selectable people, and reports no business console errors.
- The desktop hover implementation is enabled in production. It waits 600 ms
  on a historical cell, requests the existing member/week selector only for an
  Immich-linked member on fine-pointer devices, shows one deduplicated midpoint
  image, caches at most 64 page-session results, and ignores stale responses.
  Browser QA confirmed a loaded representative photo for week 450, immediate
  cached reuse in about 176 ms, clean dismissal on leave, and cancellation of a
  220 ms pass over the adjacent cell before any delayed image appeared.
- Student, worker, and family themes now use explicit high-contrast primary,
  secondary, and muted text tokens. Primary actions, active theme controls,
  input placeholders, and keyboard focus states remain legible on their light
  backgrounds. Desktop and 390px mobile layouts were visually verified.
- The fit-width week-grid release is deployed. Production verification
  confirmed 4,160 week cells for the active member, 52-column year rows, no
  horizontal overflow in desktop default, desktop full-row focus, or 390px
  mobile layouts, removal of the old percentage zoom controls, and a clean
  browser error console. Color remains reserved for elapsed/current/future
  time, a white diamond marks milestones, and a dark underline marks local
  family events.
- Production batch verification now covers all four household members. Each
  member retained 4,160 cells, one current week, keyboard current-week location,
  Arrow-key movement, Enter/Esc week detail, restored focus, and overflow-free
  desktop default/full-row and 390px mobile layouts. The one real event marker
  opened the “中考” detail for 陈婧文 on both desktop and mobile; the 390px
  dialog remained within the viewport and the browser error log stayed empty.
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
- The reviewed baseline and week-grid improvements are included in `main`.
  The existing two experimental HTML files remain untracked and excluded from
  release.

## Active work

- Branch `codex/person-focused-memories` contains the deployed “On This Day”
  selection-quality release. Household selection keeps only photos containing
  linked people, removes exact duplicates, collapses overlapping three-minute
  bursts, and balances results across years. Member pages apply the same
  read-only selector to one server-resolved person and reject candidates before
  that member's stored birth date. Personless photos are deliberately not used
  as filler. All 23 frontend contracts and 24 backend integration tests pass
  locally and in the NAS release gate.
- The same branch now contains the deployed week-photo playback described in
  `docs/decisions/004-on-demand-week-photo-playback.md`. Desktop uses a
  three-column gallery and the responsive bundle uses two columns below the
  mobile breakpoint. Loading, disabled, unlinked, empty, error, and retry states
  do not block local milestones or family events.
- A four-date read-only coverage audit found person-focused, deduplicated
  candidates on every sampled date without downloading originals or recording
  person or asset identifiers. Evidence is in
  `docs/reports/2026-09-01-memory-date-coverage-audit.md`.
- A read-only production metadata audit sampled 34 matching assets across five
  years: 19 had no linked household person, and seven of the 15 person-focused
  candidates were short bursts. Eight remained after visible person/burst
  rules, enough for the six-item gallery without unrelated fallback. The
  anonymized evidence is in
  `docs/reports/2026-09-01-memory-selection-audit.md`.
- Post-release visual QA found one pair of similar group photos captured 114
  seconds apart. After the three-minute overlap rule shipped, production reduced
  14 person-focused candidates to six distinct gallery items, removed the
  repeated composition, retained two represented years, loaded every thumbnail,
  and reported no browser warnings or errors. The anonymized evidence is in
  `docs/reports/2026-09-01-memory-gallery-visual-qa.md`.
- The current production lineage also includes commit
  `255cf76a8bf8aad0d74116c7f3098eb98c5f010a`. It keeps every row at 52 weeks,
  replaces in-card percentage zoom with fit-width and desktop full-row focus
  modes, retains “locate current week”, and marks local family events with a
  dark underline. Async event loading rebuilds markers and preserves an open
  week-detail dialog's focus target.
- The privacy and pagination release passed 23 frontend contracts and 24 backend integration tests
  locally and in the NAS release gate, plus backend syntax, frontend asset
  rebuild/hash verification, and `git diff --check`.
- The intentional-hover release passed the same 23 frontend and 24 backend
  tests locally and in the NAS release gate. Its durable rationale is recorded
  in `docs/decisions/006-intentional-week-hover-preview.md`.
- The adaptive “On This Day” release passed the same 23 frontend and 24 backend
  tests locally and in both NAS release gates. Its exact-first, ±1/±3 fallback,
  real-date, household-balance, and honest-empty-state contract is recorded in
  `docs/decisions/007-adaptive-on-this-day-window.md`. Production returned six
  household images in 316 ms, used a one-day margin, loaded all six thumbnails,
  and showed the correct real-date badges and expansion explanation.
- `nas-deploy status` and `nas-deploy doctor` passed after the final release.
  The NAS created readable pre-release SQLite backup
  `/app/data/backups/ftf-pre-release-20260903-110207.db` before the atomic
  switch; rollback remains `nas-deploy rollback family-time-flow` and currently
  returns to `25ecac84be0ea32e2e0d9dec3d8e9e14ba8ea5d3`.
- Routine validated application changes now have standing project authorization
  to commit, push, and deploy by immutable SHA. Destructive data operations,
  credentials, network exposure, infrastructure, failed validation, and other
  non-routine risks still stop for task-specific approval.
- No code or infrastructure blocker remains for current household use.
- The production household has four user-created members and one real event;
  the agent did not create synthetic production records.

## Known issues

- The 2026-09-03 production install reports three moderate npm audit findings
  in one Express 4 → body-parser → `qs` query-parser chain; there are no high or
  critical findings. The fixed `qs` 6.16.0 release is outside Express 4.22.2's
  declared `~6.15.1` range, so an override or Express major migration requires
  a separate compatibility change instead of an automatic audit rewrite. LAN
  restriction limits exposure while that work is reviewed.
- Additional household members remain a human decision: select the intended
  people and supply any missing birth dates.
- A broad photo timeline remains outside the reviewed production scope. “On
  This Day”, personal “On This Day”, click-opened week playback, and intentional
  desktop week hover are the enabled photo-memory experiences.
- The family API has no login and must remain restricted to the trusted LAN or
  an access-controlled private network.

## Next steps

1. Let the family batch-observe exact and expanded “On This Day” results across
   additional dates. Confirm that household member balance feels natural and
   report repeated composition, weak nearby-date choices, or wrong-person
   matches without changing Immich from this application.
2. Resolve the moderate Express query-parser advisories in a separate dependency
   compatibility change, validating either a reviewed `qs` override or Express
   migration with the full backend and NAS release gates.
3. Verify an event edit when a real change is needed; exercise deletion only
   with explicit approval for a disposable or obsolete event.
4. Let the user add any remaining household members and complete missing birth
   dates in the home LAN.
5. Keep the unauthenticated API on the trusted LAN; review authentication before
   any broader network exposure.

## Operation entry points

```sh
npm test
node --check web/backend/family-time-flow/server.js
git diff --check

# On the NAS, after a validated full SHA is pushed:
nas-deploy family-time-flow --ref <full-40-char-commit-sha>
nas-deploy status
nas-deploy doctor
```

Production Compose, nginx, secret files, persistent mounts, and rollback remain
owned by the sibling NAS repository.
