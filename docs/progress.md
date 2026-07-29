# Family Time Flow — current progress

> Current handoff snapshot. Durable rules live in `AGENTS.md`; stable product
> information lives in `README.md` and the linked design and deployment docs.
>
> Last verified: 2026-07-30

## Repository state

- Current documentation branch: `codex/unified-project-docs`
- Branch base and `origin/main`:
  `3857bfa504edac46117d69e088d4d3f9da114e2b`
- Immich onboarding PR #3 is merged into `main`; its reviewed head was
  `5fd820db0a149ba00a2456e76ed1961017ec8137`.
- The unified documentation changes are intentionally separate from the
  already merged feature PR.
- Untracked experimental files are present:
  `web/html/family-time-flow/admin.html` and
  `web/html/family-time-flow/grid-canvas.html`.
- They remain excluded from staging and production deployment.
- GitHub SSH fetch and push are configured for this checkout.

## Current implementation

- Stable multi-member bootstrap, member switching, SQLite persistence, startup
  backups, corruption handling, and a NAS full-SHA release contract are present.
- Immich people onboarding is merged into `main`. It supports named-person
  previews, thumbnails, multi-select import, missing birth-date completion,
  transactional idempotent member creation, manual fallback, longer import
  timeouts, and path-safe person thumbnail identifiers.
- Immich remains optional, read-only, disabled by default, and dependent on
  NAS-side secret injection.
- Production is still on the pre-onboarding release. No Immich credential has
  been injected into the FTF runtime, and the merged feature has not been
  deployed.
- Production Compose, nginx, persistent mounts, health checks, and rollback are
  owned by the sibling NAS repository.
- Codex and Cline now share `AGENTS.md` as the project instruction source;
  `.clinerules` is a compatibility adapter and no longer auto-deploys edits.

## Verification boundary

- PR #3 was validated locally and in a disposable NAS `node:22-alpine`
  container (Node 22.23.1 / npm 10.9.8).
- The merged feature validation baseline is 13 frontend tests and 19 backend
  tests.
- This documentation change passed `npm test`,
  `node --check web/backend/family-time-flow/server.js`, and
  `git diff --check` on 2026-07-30.
- No production deployment, NAS infrastructure change, secret injection, or
  production data mutation is part of this documentation update.

## Next steps

1. Review and publish this unified documentation change separately from the
   merged Immich feature.
2. Keep the two experimental HTML files local and excluded unless a separate
   decision explicitly promotes or archives them.
3. Design NAS-side secret injection for `IMMICH_URL` and `IMMICH_API_KEY`
   without committing either value.
4. After explicit deployment approval, deploy the reviewed full SHA with
   `nas-deploy family-time-flow --ref <sha>` and verify `/api/health`.
5. Verify the real Immich status, named-person preview, thumbnail proxy, manual
   fallback, member import, restart persistence, and rollback path.
6. Keep authentication/public-exposure work separate from the read-only Immich
   onboarding feature.
