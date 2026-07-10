# FamilyTimeFlow — Project Progress

> **Last updated**: 2026-07-10 10:43 UTC+8

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

### Phase 2: Lightweight Containerized Backend (MVP 2.0)

| # | Task | Details |
|---|------|---------|
| 1 | **SQLite Schema** | Users + Events tables, `better-sqlite3` |
| 2 | **Express API** | REST endpoints: CRUD users, events, config |
| 3 | **Frontend → API** | Replace `localStorage` with `fetch()` calls |
| 4 | **Docker Compose** | nginx reverse-proxy → Node.js backend |
| 5 | **Multi-user** | Simple identity switch (no JWT, family-mode) |
| 6 | **NAS Deploy** | Deploy and test on Synology/QNAP |

### Phase 3: Immich Integration (SaaS 3.0)

| # | Task | Details |
|---|------|---------|
| 1 | **Smart Onboarding** | Face matching → auto-deduce DOB from earliest photo |
| 2 | **Memory Hover** | Grid hover → Immich thumbnail popups |
| 3 | **"On This Day"** | Live ticker with Immich time-bucket queries |
| 4 | **PhotoSwipe** | Full-screen lightbox for timeline photo nodes |

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