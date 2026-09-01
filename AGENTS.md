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
5. Deploy only a validated full commit SHA through the NAS repository.

## Standing delivery authorization

The project owner has granted standing authorization for routine application
changes in this repository. After a scoped change is complete and the required
validation passes, the agent should normally commit it, push the current branch,
and deploy that exact full commit SHA through `nas-deploy` without asking for a
second confirmation. Verify the release with `nas-deploy status` and
`nas-deploy doctor`, and report the deployed SHA and rollback command.

This standing authorization applies only when the release is reversible through
the NAS release system and does not broaden the task's product scope. Stop and
request explicit approval before:

- deleting or rewriting production data, running a destructive or irreversible
  database migration, or restoring a backup;
- rotating credentials, expanding Immich permissions, changing secret values,
  or exposing the service beyond the trusted private network;
- changing NAS infrastructure, shared networking, host mounts, or another
  project's production behavior;
- rewriting Git history, merging branches or pull requests, publishing a public
  release, or including unrelated work;
- deploying when required validation fails, the release/rollback mechanism is
  unhealthy, or the production impact cannot be bounded confidently.

The owner may override the standing authorization for any task by explicitly
saying not to commit, push, or deploy.

Minimum validation:

```sh
npm test
node --check web/backend/family-time-flow/server.js
git diff --check
```

Routine validated application changes are covered by the standing delivery
authorization above. Production-data mutation and NAS infrastructure changes
still require task-specific explicit approval.
