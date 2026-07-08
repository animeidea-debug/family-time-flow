# FamilyTimeFlow 🕰️👨‍👩‍👧‍👦

> **A self-hosted, multi-user dynamic time visualization dashboard for your NAS — your family's digital time machine.**

Transform abstract time management into a **"Family Digital Time Machine"**. By intertwining family lifelines and anchoring focus value, FamilyTimeFlow helps visualize time slippage for academic planning, while awakening collective family memories through deep integration with your local NAS photo ecosystem (Immich).

## Core Principles

- **🔓 No Isolation** — Open and transparent access for all family members without complex role management.
- **👁️ Visually Anchored** — Multi-scale viewports (Macro → Meso → Micro) to counter procrastination.
- **💖 Emotion-Driven** — Combining programmatic time tracking with dynamic biographical photography.

## Architecture

| Layer | Technology |
|-------|-----------|
| **Deployment** | Docker Compose (Synology/QNAP-ready) |
| **Backend** | Node.js (Express) or Python (FastAPI) |
| **Database** | SQLite (single-file, zero-config) |
| **Frontend** | Vanilla JS + TailwindCSS + daisyUI (CDN, no build step) |
| **Animation** | GSAP (GreenSock Animation Platform) |
| **Photos** | Immich API integration |

---

*Built from the [infra-template](https://github.com/animeidea-debug/infra-template) — NAS infrastructure starter.*