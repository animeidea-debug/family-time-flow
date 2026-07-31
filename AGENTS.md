# Family Time Flow collaboration guide

## Deployment interface (hard rule)

Production deployment MUST use the NAS-owned release command, run on
the NAS:

```sh
nas-deploy family-time-flow --ref <full-40-char-commit-sha>
# or, only after the default branch has been reviewed:
nas-deploy family-time-flow --latest
```

- `deploy/legacy-webdav-push.sh` in THIS repository is the legacy
  WebDAV file-push path. It is **NOT** the production deployment path.
  Do not invoke it for a normal release. It remains only for
  infrastructure bootstrap or explicit disaster recovery when the NAS
  cannot reach GitHub.
- `NAS/deploy/deploy.sh` (in the sibling NAS repository, not here)
  IS correct for its job — it deploys Docker Compose definitions.
  Do not confuse it with this repository's `deploy/` script.
- The authoritative matrix lives at
  `NAS/docs/deployment-interfaces.md`. Read it before any deploy.

If you are about to run `deploy/legacy-webdav-push.sh`, stop and use
`nas-deploy family-time-flow`.

## Product purpose and ownership

Family Time Flow is a private, self-hosted family time-visualization application
with a vanilla web frontend, Node/Express backend, SQLite persistence, and an
optional read-only Immich onboarding integration.

This repository owns application source, backend behavior, database migrations,
tests, and product documentation. The sibling NAS repository owns production
Compose, nginx, host mounts, secrets, release switching, and rollback.

Read `README.md`, `docs/progress.md`, `docs/DEPLOYMENT_READINESS.md`,
`docs/RELEASE_CANDIDATE.md`, and `git status` before changing the project.

## Data and security invariants

- SQLite on the NAS is the durable source of family members, events, and
  settings. Browser state is not authoritative.
- Production databases, backups, Immich credentials, `.env` files, tokens,
  personal exports, and photos must never be committed.
- Immich credentials are injected only by NAS runtime configuration. Do not
  store them in browser configuration, SQLite, logs, tests, or documentation.
- Immich integration remains optional and read-only unless a separately
  reviewed product decision explicitly expands its scope.
- The unauthenticated family API must stay behind the trusted LAN or an
  access-controlled private network. Do not expose it directly to the public
  internet.
- Preserve atomic database writes, startup backups, corruption protection, and
  clean shutdown behavior.
- `admin.html` and `grid-canvas.html` are experimental files excluded from
  production. Do not add or deploy them without an explicit decision.

## Workflow and validation

1. Preserve unrelated and untracked user work.
2. Keep product behavior, Immich integration, runtime migration,
   infrastructure requests, and documentation in separate changes.
3. Test Node runtime changes in the target NAS container before claiming
   production compatibility.
4. Update `docs/progress.md` after a verified handoff, merge, or deployment.
5. Deploy only an approved full commit SHA through the NAS repository.

Minimum validation:

```sh
npm test
node --check web/backend/family-time-flow/server.js
git diff --check
```

Do not deploy, commit, push, mutate production data, or change NAS
infrastructure without explicit approval.
