# FamilyTimeFlow 🕰️👨‍👩‍👧‍👦

> **A self-hosted, multi-user dynamic time visualization dashboard for your NAS — your family's digital time machine.**

Transform abstract time management into a **"Family Digital Time Machine"**. By intertwining family lifelines and anchoring focus value, FamilyTimeFlow helps visualize time slippage for academic planning, while awakening collective family memories through deep integration with your local NAS photo ecosystem (Immich).

## Core Principles

- **🔓 No Isolation** — Open and transparent access for all family members without complex role management.
- **👁️ Visually Anchored** — Multi-scale viewports (Macro → Meso → Micro) to counter procrastination.
- **💖 Emotion-Driven** — Combining programmatic time tracking with dynamic biographical photography.

---

## Project Structure

```
family-time-flow/
├── PRD_FamilyTimeFlow.md        # Product Requirement Document (reformatted)
├── PROGRESS.md                  # Current project status & next steps
├── README.md                    # This file
├── docs/
│   ├── SETUP.md                 # Environment & credential setup guide
│   ├── CONTRIBUTING.md          # Contribution guidelines
│   └── IMMICH_INTEGRATION.md    # Immich API integration design (live-verified)
├── clinerules/
│   └── env.template             # Shared env config documentation
├── deploy/
│   ├── deploy.sh                # NAS deployment via rclone WebDAV
│   ├── deploy_gas.sh            # GAS deployment script
│   └── run_deploy.bat           # Windows deploy script
├── web/
│   ├── html/
│   │   └── index.html           # Frontend placeholder → Phase 1 MVP
│   ├── backend/
│   │   ├── package.json         # Express skeleton
│   │   └── server.js            # Backend placeholder → Phase 2 API
│   ├── docker-compose.yml       # nginx + Node.js (NAS-ready)
│   └── nginx.conf               # Reverse proxy config
├── env.template                 # Project env template (→ env.local)
├── .gitignore
└── env.local*                   # Local config (gitignored)
```

## Architecture

| Layer | Technology |
|-------|-----------|
| **Deployment** | Docker Compose (Synology/QNAP-ready) |
| **Backend** | Node.js (Express) |
| **Database** | SQLite (single-file, zero-config) |
| **Frontend** | Vanilla JS + TailwindCSS + daisyUI (CDN, no build step) |
| **Animation** | GSAP (GreenSock Animation Platform) |
| **Photos** | Immich v2.7.5 API integration (live-verified) |
| **NAS Config** | Shared `~/.nas-env` + macOS Keychain (WebDAV/SSH passwords) |

## Quick Start

### Prerequisites

- macOS + Homebrew (development)
- ZSpace NAS (or any Linux host with Docker)
- Tailscale or ZSpace remote access (for external deploy)

### 1. Configure Shared NAS Settings (one-time)

```sh
# Edit ~/.nas-env with your NAS details:
#   NAS_IP, NAS_USER, SSH_PORT, WEBDAV_PORT, etc.
#   KEYCHAIN_WEBDAV_SERVICE, SSH_HOST_ALIAS, WEBDAV_USER
```

### 2. Store Passwords in Keychain (one-time)

```sh
security add-generic-password -s "emma-webdav" -a "$USER" -w "your-webdav-password"
```

### 3. Deploy to NAS

```sh
sh deploy/deploy.sh
```

### 4. SSH into NAS

```sh
ssh nas   # Requires ~/.ssh/nas_ed25519 key
```

---

## Development Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| **Infra Setup** | GitHub repo, Docker Compose, deploy scripts, NAS credentials | ✅ Done |
| **Immich Design** | API integration design (live DB + API exploration) | ✅ Done |
| **Phase 1** | Frontend MVP — life grid, countdown, theme switching, config panel | 🔜 Next |
| **Phase 2** | Backend — SQLite, CRUD API, Docker deployment | ⏳ |
| **Phase 3** | Immich integration — photo hover, "On This Day", face matching | ⏳ |

---

*Built from the [infra-template](https://github.com/animeidea-debug/infra-template) — NAS infrastructure starter.*