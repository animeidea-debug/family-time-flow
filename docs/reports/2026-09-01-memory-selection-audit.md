# On This Day memory-selection audit — 2026-09-01

## Scope

Read-only metadata comparison for the same calendar day across the previous
five years. The audit used the existing Family Time Flow API, downloaded no
images or originals, changed no Immich data, and records no names or asset IDs.

## Observed candidate quality

| Year | Sampled | Linked household person present | No linked household person |
|---:|---:|---:|---:|
| 2025 | 16 | 8 | 8 |
| 2024 | 6 | 0 | 6 |
| 2023 | 0 | 0 | 0 |
| 2022 | 10 | 6 | 4 |
| 2021 | 2 | 1 | 1 |
| **Total** | **34** | **15** | **19** |

Among the 15 person-focused candidates, seven were in same-linked-person
capture bursts within 90 seconds. Eight candidates remained after applying the
visible person and burst rules. This is enough to fill the six-item gallery
without personless fallback and with representation from multiple years.

The current public API does not expose Immich duplicate-group or checksum
metadata, so this production audit could not measure the additional exact-
duplicate removal implemented inside the new backend selector.

## Conclusion

The unfiltered strategy explains the reported experience: more than half of
the sampled candidates were not linked-family photos, and nearly half of the
person-focused candidates belonged to short bursts. Strict linked-person
filtering, exact duplicate removal, burst collapsing, and year-balanced
selection directly address the observed failure modes.
