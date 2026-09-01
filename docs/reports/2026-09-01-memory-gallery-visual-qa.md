# On This Day gallery visual QA — 2026-09-01

## Scope

Read-only visual verification of the deployed six-item household memory gallery
on the home LAN. The check opened no original files, changed no Family Time Flow
or Immich data, and records no names, face images, or asset identifiers.

## Result

- All six rendered thumbnails were valid images containing people.
- The gallery alternated between two represented years, confirming that the
  year-round selection was active.
- The person-focused explanation and deduplicated-memory ticker were visible.
- The browser reported no warning or error messages.
- Two group-photo thumbnails from one year showed nearly the same composition.
  Their recognized linked-person sets were not identical, so the first burst
  rule treated them as separate despite their visual similarity.

## Follow-up

Short-window burst matching should tolerate small face-recognition differences.
Comparing linked-person overlap, rather than requiring an identical set, keeps
the selector metadata-only and read-only while addressing the observed repeat.
