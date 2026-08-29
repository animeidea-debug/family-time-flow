# Family Time Flow — current progress

> Current handoff snapshot. Durable rules live in `AGENTS.md`; stable product
> information lives in `README.md` and the linked design and deployment docs.
>
> Last verified: 2026-08-29 Asia/Shanghai

## Current state

- Production runs commit `1c690f37bc1eb8f77dde3355c2d45a9e19fa3b0c`
  through the NAS-owned `nas-deploy` release system on Node 22.
- `nas-deploy status` and `nas-deploy doctor` pass. The FTF container is
  running and healthy, `/api/health` reports storage ready with backups
  enabled, and the persistent SQLite database opens successfully.
- Immich onboarding is enabled through a NAS mode-0600 service secret. The
  read-only FTF adapter returns 10 named people and 10 working thumbnails in
  production. Credentials are not stored in this repository, SQLite, or the
  browser.
- Browser verification from the home LAN confirms the live Immich-aware welcome
  hint, the deferred-photo-memory ticker, in-app brand navigation, and the
  multi-select person picker. The picker shows known birth dates, flags missing
  dates for completion, loads all 10 person thumbnails, and reports no business
  console errors.
- The production household database is still intentionally empty. No family
  member has been selected or imported on the user's behalf.
- PR #4 (documentation and live-status UX) and PR #5 (duplicate ticker
  regression) are merged into `main`. The existing two experimental HTML files
  remain untracked and excluded from release.

## Active work

- No code or infrastructure blocker remains for first household use.
- The production household is awaiting the user's member selection; the agent
  deliberately did not mutate the empty production database.

## Known issues

- First household initialization requires a human decision: select the intended
  people and supply any missing birth dates. This is the remaining step before
  normal family use, not an infrastructure failure.
- Photo timeline, hover memories, and “On This Day” are not implemented. The
  current Immich scope is named-person onboarding and thumbnails only.
- The frontend still loads Tailwind, daisyUI, GSAP, and Flatpickr from public
  CDNs. It works on the current home network, but full offline styling and
  interaction require a separately reviewed asset-bundling change.
- The family API has no login and must remain restricted to the trusted LAN or
  an access-controlled private network.

## Next steps

1. Let the user complete the first household import in the home LAN, then
   verify member switching, one event save/edit/delete round trip, and restart
   persistence with real data.
2. Plan a separate offline-asset release before adding any photo-memory APIs.
3. Keep the unauthenticated API on the trusted LAN; review authentication before
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
