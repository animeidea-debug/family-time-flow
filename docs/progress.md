# Family Time Flow — current progress

> Current handoff snapshot. Durable rules live in `AGENTS.md`; stable product
> information lives in `README.md` and the linked design and deployment docs.
>
> Last verified: 2026-08-29 Asia/Shanghai

## Current state

- Production runs commit `7acd33888c8a1da8e9f20fa6ae852681894b91bc`
  through the NAS-owned `nas-deploy` release system on Node 22.
- `nas-deploy status` and `nas-deploy doctor` pass. The FTF container is
  running and healthy, `/api/health` reports storage ready with backups
  enabled, and the persistent SQLite database opens successfully.
- Immich onboarding is enabled through a NAS mode-0600 service secret. The
  read-only FTF adapter returns 10 named people and 10 working thumbnails in
  production. Credentials are not stored in this repository, SQLite, or the
  browser.
- Browser verification from the home LAN reaches the welcome screen and the
  multi-select person picker. The picker shows known birth dates, flags missing
  dates for completion, loads all person thumbnails, and reports no business
  console errors.
- The production household database is still intentionally empty. No family
  member has been selected or imported on the user's behalf.
- The current work branch is `codex/unified-project-docs`, four commits ahead
  of `origin/main`. The existing two experimental HTML files remain untracked
  and excluded from release.

## Active work

- Correct the onboarding and household copy so it reflects the server-reported
  Immich configuration instead of claiming the integration is unavailable.
- Keep the brand link inside the deployed `/family-time-flow/` application.
- Add frontend contract coverage for both behaviors and refresh release docs.
- Validate the candidate locally and in the NAS Node 22 release path before
  deployment.

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

1. Commit and push the reviewed UX/documentation candidate without adding the
   experimental HTML files.
2. Merge the documentation branch into `main` so the default branch matches
   the production release lineage.
3. Deploy the approved full commit SHA with
   `nas-deploy family-time-flow --ref <sha>` and repeat health, person-list,
   thumbnail, and browser checks.
4. Let the user complete the first household import in the home LAN, then
   verify member switching, one event save/edit/delete round trip, and restart
   persistence with real data.
5. Plan a separate offline-asset release before adding any photo-memory APIs.

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
