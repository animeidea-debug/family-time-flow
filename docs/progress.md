# Family Time Flow — current progress

> Current handoff snapshot. Durable rules live in `AGENTS.md`; stable product
> information lives in `README.md` and the linked design and deployment docs.
>
> Last verified: 2026-08-31 Asia/Shanghai

## Current state

- Production runs commit `8800c6ea92fceb676c48ba1b397219465e5b94d1`
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
  capability hardening) are merged into `main`. The existing two experimental
  HTML files remain untracked and excluded from release.

## Active work

- The Immich 3.x adapter hardening is deployed. It sends the required
  `personIds` array, validates asset inputs, and reports permission or upstream
  failures instead of returning false empty results.
- `main` contains the deployed first photo-memory experience. It is
  server-gated, searches only the previous five years, and offers
  thumbnail/preview access without original downloads.
- `main` contains the deployed stability fix that separates the default-off
  week-hover capability from “On This Day” and adds empty-result,
  Immich-offline, and cross-date refresh contracts.
- A read-only production compatibility audit on 2026-08-30 returned successful
  metadata responses for all five year windows; all six sampled thumbnails and
  all three sampled previews were readable. Only aggregate counts and HTTP
  status were retained in the audit output.
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

1. Observe “On This Day” during normal family use before proposing any broader
   photo timeline or week-hover scope.
2. Verify an event edit when a real change is needed; exercise deletion only
   with explicit approval for a disposable or obsolete event.
3. Let the user add any remaining household members and complete missing birth
   dates in the home LAN.
4. Keep the unauthenticated API on the trusted LAN; review authentication before
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
