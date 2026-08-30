# Decision 001: Commit version-locked offline frontend assets

- Status: accepted
- Date: 2026-08-30

## Context

Family Time Flow runs on a home NAS, but its page originally loaded Tailwind's
Play CDN, daisyUI, GSAP, and Flatpickr from public CDNs. A WAN or CDN outage
could therefore remove styling or interaction even while the NAS and database
were healthy.

The normal NAS release path already checks out an immutable Git commit and
serves static application files. Requiring a frontend build during container
startup would add another failure mode and make rollback less deterministic.

## Decision

- Pin Tailwind CSS, daisyUI, GSAP, and Flatpickr to exact npm versions.
- Compile the used Tailwind and daisyUI classes during development.
- Copy the versioned GSAP and Flatpickr distributions into the application
  asset directory.
- Commit the generated assets and a SHA-256 manifest with the release.
- Run a clean rebuild-and-compare check as part of `npm test`.
- Keep the production runtime build-free; nginx serves only the committed
  HTML, CSS, and JavaScript.

## Consequences

- The application remains fully styled and interactive without WAN access.
- Dependency upgrades are explicit and reviewable in `package-lock.json` and
  the asset manifest.
- Any Tailwind class or dependency change requires `npm run build:frontend`.
- Generated assets add roughly 220 KB to the repository, which is acceptable
  for deterministic offline releases.
