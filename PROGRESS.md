# FamilyTimeFlow — Project Progress

> **Last updated**: 2026-07-09 02:00 UTC+8

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

### Multi-Project nginx Isolation (NEW)

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

---

## 🔜 Next Up

### Phase 1: Frontend MVP (Single index.html)

| Task | Details |
|------|---------|
| **Life Grid** | 80×52 week matrix with GSAP animations |
| **Countdown Clock** | 6-decimal precision, `requestAnimationFrame` |
| **Theme Switching** | Student/Worker/Family color modes (700ms transition) |
| **Config Drawer** | Right-sliding panel with localStorage mock data |
| **Tech Stack** | Vanilla JS + TailwindCSS + daisyUI (CDN) + GSAP |

Ready to start when you are!

### Phase 2: Backend API

- SQLite database with user/event CRUD
- Express router structure
- Docker networking for nginx ↔ backend

### Phase 3: Immich Integration

- Smart onboarding (face matching → DOB deduction)
- Memory hover tooltips (photo thumbnails on grid hover)
- "On This Day" time capsule (bottom ticker)
- Timeline photo nodes (PhotoSwipe lightbox)

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