# Decision 005: Keep Immich person identifiers server-private

- Status: accepted
- Date: 2026-09-01

## Context

Family Time Flow members are the application's public identity boundary. Earlier
browser state and ordinary member responses exposed the linked Immich person
identifier, although household views, avatars, and memories only need to know
whether a link exists and which Family Time Flow member is active.

The onboarding picker is different: the user must explicitly choose one or more
named Immich people before creating linked members, so that dedicated flow needs
temporary access to the selectable identifiers.

## Decision

- Ordinary `/bootstrap`, `/users`, `/sync`, and `/household/view` member DTOs
  return only a boolean linked state and never return `immich_person_id` or
  `personId`.
- Avatar, personal memory, and weekly memory requests use a Family Time Flow
  member ID. The backend resolves the stored Immich link and proxies read-only
  thumbnails or metadata.
- `/immich/people` remains a dedicated, user-triggered onboarding endpoint and
  may return Immich person IDs so the selected people can be imported.
- Startup removes the legacy full-profile browser state key. Only the active
  Family Time Flow member ID and harmless display preferences remain local.
- The database keeps the Immich person ID as an internal link. This decision
  does not change Immich permissions or add write behavior.

## Consequences

- Routine page loads, household switching, settings, avatars, and memories no
  longer expose a stable external identity identifier to browser state or
  ordinary API consumers.
- The onboarding picker continues to work without inventing a second mapping
  protocol.
- The trusted-LAN boundary remains mandatory because the family API still has
  no login; this change reduces unnecessary exposure but is not authentication.
