# FamilyTimeFlow — Project Progress

> **Last updated**: 2026-07-10 23:00 UTC+8

> **Infrastructure ownership update (2026-07-16):** `ftf_backend` Docker Compose is now managed by the separate NAS infrastructure repository. This project retains application code, HTML, nginx fragments, and artifact deployment only.

---

## ✅ Completed

### Phase 0: Infrastructure Setup

- [x] **GitHub repo created**: `https://github.com/animeidea-debug/family-time-flow`
- [x] **Seeded from infra-template**: Docker Compose (nginx + Node.js), deploy scripts, docs
- [x] **README.md** — Customized for FamilyTimeFlow
- [x] **PRD reformatted** → `PRD_FamilyTimeFlow.md` (clean markdown)
- [x] **docs/SETUP.md** — Synced from infra-template
- [x] **docs/CONTRIBUTING.md** — Synced from infra-template

### NAS Credentials & Deploy Pipeline

- [x] **SSH access**: Passwordless via `~/.ssh/nas_ed25519` key (`ssh nas`)
- [x] **WebDAV access**: rclone + macOS Keychain (`emma-webdav` service)
- [x] **Shared NAS config**: `~/.nas-env` with IP, ports, users, Keychain service names
- [x] **First deploy successful**: `deploy/deploy.sh` — LAN connected, files synced in 1s
- [x] **Deployed to NAS**: `index.html`, `server.js`, `docker-compose.yml`, `nginx.conf`

### Multi-Project nginx Isolation

- [x] **Added PROJECT_PATH variable** to `env.template` for unique project routing
- [x] **Created nginx.conf.template** with `${PROJECT_PATH}` placeholders
- [x] **Updated deploy.sh** to:
  - Deploy HTML to `/docker/html/${PROJECT_PATH}/` (isolated per project)
  - Process nginx.conf template with sed substitution
  - Show project path in deployment output
- [x] **Updated clinerules** to document multi-project isolation pattern

### Immich Integration Design (Phase 3 Prep)

- [x] **Live NAS exploration**: SSH + Docker + PostgreSQL inspection
- [x] **Immich version**: v2.7.5 (confirmed via API + DB)
- [x] **Database schema mapped**: `person`, `api_key`, `user`, `asset`, `asset_face`, `memory` tables
- [x] **15,643 recognized people** in the library
- [x] **API key validated**: Full admin access confirmed
- [x] **Integration design documented** → `docs/IMMICH_INTEGRATION.md`
  - Authentication pattern (x-api-key header)
  - Core endpoints (people, assets, thumbnails, memories)
  - 4 integration flows (Smart Onboarding, Hover Tooltips, "On This Day", Timeline Nodes)
  - Fallback strategy for offline mode
  - Testing commands

### Phase 1: Frontend MVP (Single index.html) ✅ COMPLETE

- [x] **CDN stack**: TailwindCSS + daisyUI + GSAP + Flatpickr (zero-build)
- [x] **80×52 Life Grid**: DOM-rendered grid with GSAP stagger entrance animation
- [x] **DD:HH:MM:SS Countdown Clock**: `requestAnimationFrame`-driven, `font-mono tabular-nums`
- [x] **Theme System**: Student / Worker / Family — 700ms CSS transition + CSS variables
- [x] **SVG Time Budget Ring**: Daily elapsed % with study/hobby breakdown
- [x] **Config Drawer**: Right-sliding backdrop panel (localStorage persistence)
- [x] **Flatpickr Integration**: Dark-mode date/time pickers on countdown + config form
- [x] **"On This Day" Ticker**: Bottom bar with date-aware placeholder text
- [x] **Photo Hover Tooltip**: 3-image glassmorphic popover (placeholder for Phase 3)
- [x] **Responsive Layout**: 3-column desktop → single-column mobile
- [x] **Chinese UI Localization**: All UI labels in `index.html` translated to Chinese (labels, tooltips, ticker, config drawer, stat cards)
- [x] **PRD bilingual rewrite**: `docs/PRD.md` → Title "家庭人生时光机", all sections bilingual, version 2.0
- [x] **Countdown format changed**: From `DDDD.DDDDDD` (decimal days) to `DD:HH:MM:SS` (days:hours:minutes:seconds) in both PRD and `index.html`

---

## 🔜 Next Up

### Phase 2: Lightweight Containerized Backend ✅ COMPLETE

| # | Task | Status |
|---|------|--------|
| 1 | **SQLite Schema** — `users` + `events` + `app_config` tables (sql.js, pure JS) | ✅ |
| 2 | **Express API** — 14 REST endpoints: CRUD users, events, config, education, milestones | ✅ |
| 3 | **Education Helpers** — Shanghai 5+4 (预初) + National 6+3+3, grade/age/milestone computation | ✅ |
| 4 | **nginx API Proxy** — `/family-time-flow/api/` → `ftf_backend:3000` | ✅ |
| 5 | **NAS Deploy** — Docker container running on NAS (`node:20-alpine`), DB at `/app/data/ftf.db` | ✅ |

**Phase 2b completed:**
- [x] Frontend API client with localStorage fallback
- [x] Multi-user management (switch/create users)
- [x] School system selector (Shanghai 5+4 / National 6+3+3)
- [x] API push/pull sync for all settings

### Phase 3: Immich Integration ✅ COMPLETE

| # | Task | Status |
|---|------|--------|
| 1 | **Immich API Proxy** — status, people, assets, thumbnail, on-this-day | ✅ |
| 2 | **Dynamic URL config** — `POST /api/immich/config` saves URL+key, read from DB | ✅ |
| 3 | **Onboarding wizard** — 4-step guided setup (welcome → connect → person → preview) | ✅ |
| 4 | **Preset connection picker** — 🏠内网 / 🌐外网 toggle with pre-filled API key | ✅ |
| 5 | **Person auto-fill** — selecting Immich person auto-fills name + birthDate | ✅ |
| 6 | **Real photo tooltips** — hover grid cell → fetch Immich thumbnails | ✅ |
| 7 | **On-This-Day ticker** — cross-year Immich photo query in bottom bar | ✅ |
| 8 | **NAS deploy via Tailscale** — SSH + docker exec deployment from external 5G | ✅ |

### Infrastructure

- [x] **deploy.sh updated** — added Tailscale IP (100.102.16.75) auto-detection, fallback chain
- [x] **Tailscale verified** — SSH (port 10000), WebDAV (port 8889), Backend API (port 3000) all reachable
- [x] **Immich connected** — v2.7.5, 8+ named persons with birth dates

## ✅ Bug Fixes & UX Improvements (2026-07-10)

### Critical Bugs Fixed
- [x] **Critical JS syntax error** — stray `ch ` character at line 1492 broke all JS execution after `updateEducationTimeline()` (milestones, education timeline, ticker, immich, onboarding)
- [x] **schoolSystem localStorage persistence** — added `schoolSystem` to initial state + `hydrateFormFromState()` so school system selection survives page reload
- [x] **resetConfig completeness** — added missing `schoolSystem` to `resetConfig()` default state

### Onboarding & User Management Flow
- [x] **Removed LAN/WAN preset picker** — simplified onboarding to one-click auto-connect via backend proxy
- [x] **Added user avatar dropdown in navbar** — name/avatar, switch user, settings, reset
- [x] **Fixed `showPersonSelection()`** — uses `immich_person_id` (not name) to match backend users
- [x] **Fixed `confirmOnboarding()`** — passes `immich_person_id` to backend POST/PUT
- [x] **Fixed `showUserSwitcher()` timing** — awaits `apiGet('/sync')` before showing person list
- [x] **Fixed `switchUser()`** — restores `immich_person_id` from backend user record
- [x] **Fixed Step 4 button logic** — 3 states: 保存更改 / 切换到此用户 / 保存并开始
- [x] **Fixed init phase** — added health check before full sync to set apiAvailable early
- [x] **Added `DELETE /api/users` backend endpoint** — for complete data reset
- [x] **Updated `resetOnboardingData()`** — calls backend DELETE + clears localStorage

### Backend Stability
- [x] **Pushover notification fix** — deploy.sh reads from macOS Keychain fallback
- [x] **Backend DB auto-restart** — container restart creates fresh DB on startup
- [x] **Immich config persisted** — written to `app_config` table on container start

---

## Key Credentials & Configs (NOT in git)

| Item | Location | Purpose |
|------|----------|---------|
| NAS shared config | `~/.nas-env` | IP, users, ports, Keychain references |
| WebDAV password | macOS Keychain (`emma-webdav`) | rclone deploy authentication |
| SSH key | `~/.ssh/nas_ed25519` | Passwordless NAS SSH access |
| SSH config | `~/.ssh/config` | Host aliases (`nas`, `nas-ts`) |
| Project config | `env.local` | Project name, ports, PROJECT_PATH |
| Immich API key | Not persisted yet (will go in `.env`) | Immich API access |

> **For Windows PC**: You'll need to set up the equivalents — `WEBDAV_PASS` env var instead of Keychain, and configure SSH with your key file.

---

## Multi-Project Isolation Summary

**Problem**: Multiple projects sharing the same NAS nginx server would overwrite each other's `index.html` and `nginx.conf`.

**Solution**: Path-based isolation using `PROJECT_PATH` variable.

**Access URL**: `http://localhost:8888/<PROJECT_PATH>/`

**Example**: With `PROJECT_PATH="family-time-flow"`, access at `http://localhost:8888/family-time-flow/`
