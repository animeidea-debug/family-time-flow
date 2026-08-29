# Cline compatibility

The repository root [`AGENTS.md`](../AGENTS.md) is the single source of truth
for project instructions. [`docs/progress.md`](../docs/progress.md) is the
current handoff snapshot.

The root `.clinerules` file is intentionally a thin adapter that directs Cline
to those documents. `global.template` is retained only for older Cline setups;
it must not contain duplicated project rules, credentials, or automatic
deployment behavior.

Shared personal Cline preferences belong in `~/.clinerules`. Project-specific
facts remain committed in `AGENTS.md` so Codex, Cline, humans, and other agents
review the same rules.
