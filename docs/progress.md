# Family Time Flow — current progress

> Current handoff snapshot. Durable rules live in `AGENTS.md`; stable product
> information lives in `README.md` and the linked design and deployment docs.
>
> Last verified: 2026-08-30 Asia/Shanghai

## Current state

- Production runs commit `e60b19fbdec779d6bc1e152fe7cceff537572a7b`
  through the NAS-owned `nas-deploy` release system on Node 22.
- `nas-deploy status` and `nas-deploy doctor` pass. The FTF container is
  running and healthy, `/api/health` reports storage ready with backups
  enabled, and the persistent SQLite database opens successfully.
- Immich onboarding is enabled through a NAS mode-0600 service secret. The
  read-only FTF adapter returns 10 named people and 10 working thumbnails in
  production. Credentials are not stored in this repository, SQLite, or the
  browser.
- Browser verification from the home LAN confirms three persisted household
  members, the Immich-aware welcome hint, deferred-photo-memory ticker, in-app
  brand navigation, and the multi-select person picker. The picker loads all 10
  person thumbnails, reports seven selectable and three already created people,
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
- PR #4 (documentation and live-status UX), PR #5 (duplicate ticker
  regression), PR #7 (first-member polish), PR #9 (additional-member picker),
  and PR #11 (readability and picker clarity) are merged into `main`. The
  existing two experimental HTML files remain untracked and excluded from
  release.

## Active work

- No code or infrastructure blocker remains for household use.
- The production household has three user-created members and one real event;
  the agent did not create synthetic production records.

## Known issues

- Additional household members remain a human decision: select the intended
  people and supply any missing birth dates.
- Photo timeline, hover memories, and “On This Day” are not implemented. The
  current Immich scope is named-person onboarding and thumbnails only.
- The frontend still loads Tailwind, daisyUI, GSAP, and Flatpickr from public
  CDNs. It works on the current home network, but full offline styling and
  interaction require a separately reviewed asset-bundling change.
- The family API has no login and must remain restricted to the trusted LAN or
  an access-controlled private network.

## Next steps

1. Plan and implement a separate offline-asset release before adding any
   photo-memory APIs.
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
