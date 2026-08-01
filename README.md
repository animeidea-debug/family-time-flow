# FamilyTimeFlow

> A self-hosted, multi-user dynamic time visualization dashboard — transforming abstract time management into a **"Family Digital Time Machine"**.

> 新的维护会话应先阅读 [`AGENTS.md`](AGENTS.md) 的长期边界和安全规则，再阅读
> [`docs/progress.md`](docs/progress.md) 的当前交接状态。

> 当前接管后的产品与交付状态请先阅读 [`docs/PRODUCT_REDESIGN.md`](docs/PRODUCT_REDESIGN.md)、[`docs/DEPLOYMENT_READINESS.md`](docs/DEPLOYMENT_READINESS.md) 和 [`docs/RELEASE_CANDIDATE.md`](docs/RELEASE_CANDIDATE.md)。下方原始愿景保留为设计背景。

## Production deployment

The NAS infrastructure repository owns the production release command, Docker
Compose, persistent data mount, health check, and rollback:

```sh
nas-deploy family-time-flow --ref <full-commit-sha>
# After the main branch has been reviewed:
nas-deploy family-time-flow --latest
```

The command fetches the immutable commit on the NAS, runs all frontend and
backend tests, creates a readable `ftf.db` backup, switches the frontend/backend
release, and verifies `/api/health`. The historical
`deploy/legacy-webdav-push.sh` WebDAV script remains an emergency
migration fallback, not the normal production path.

---

## 📋 Table of Contents

- [Core Vision](#core-vision)
- [Technical Stack](#technical-stack)
- [Data Model](#data-model)
- [UI/UX Specifications](#uiux-specifications)
- [Development Roadmap](#development-roadmap)
- [Key Technical Decisions](#key-technical-decisions)

---

## 🎯 Core Vision

FamilyTimeFlow helps students visualize time slippage for academic planning while awakening collective family memories through deep integration with the local NAS storage ecosystem.

### Core Principles

- **No Isolation**: Open and transparent access for all family members without complex JWT role segregation
- **Visually Anchored**: Multi-scale viewports (Macro, Meso, Micro) to counter procrastination
- **Emotion-Driven**: Programmatic time tracking with dynamic biographical photography via Immich

---

## 🛠️ Technical Stack

| Layer | Component | Specifications |
|-------|-----------|----------------|
| **Deployment** | NAS-managed Docker Compose | This project deploys application files; `~/Desktop/NAS` owns the container definition |
| **Backend** | Node.js (Express) or Python (FastAPI) | Lightweight API serving, directly exposed to frontend |
| **Database** | SQLite | Single-file embedded database (no MySQL/Redis) |
| **Frontend** | Vanilla JS + TailwindCSS + daisyUI | Zero-build environment (CDN preferred) |
| **Animation** | GSAP (GreenSock) | Performance-optimized DOM/SVG manipulations |
| **Polling/Clock** | `requestAnimationFrame` | Smooth 60Hz+ countdowns, CPU-efficient |
| **Photo Interactivity** | Floating UI & PhotoSwipe | Glassmorphic tooltips and immersive photo lightbox |
| **Forms/Inputs** | Flatpickr (Dark Mode) | Ultra-lightweight date-time selection |

---

## 🗄️ Data Model

### User Profile

```json
{
  "id": "string (uuid)",
  "name": "string",
  "birth_date": "string (YYYY-MM-DD)",
  "expected_age": "integer (default: 80)",
  "identity_tag": "string (student | worker | family)",
  "immich_person_id": "string, optional"
}
```

### Timeline Events

```json
{
  "id": "string (uuid)",
  "title": "string",
  "target_date": "string (YYYY-MM-DD HH:mm:ss)",
  "event_scale": "string (macro | meso | micro)",
  "is_shared": "boolean",
  "owner_id": "string (user_id reference)",
  "immich_sync_photos": "boolean (default: false)"
}
```

---

## 🎨 UI/UX Specifications

### Role-Based Adaptive Theme System (千人千面)

The dashboard interface adapts its aesthetic persona on-the-fly when toggling users via the top-bar navigation. Style changes animate seamlessly via Tailwind transitions over **700ms**:

| Mode | Background | Accent Color | Vibe |
|------|------------|--------------|------|
| **Student** | `#060B18` (Slate/Deep Blue) | `#10B981` (Neon Mint Green) | Morning twilight, academic vigor |
| **Worker** | `#090D16` (Obsidian/Dark Onyx) | `#F59E0B` (Amber Gold) | Maturity, precision clockwork |
| **Family** | `#0F0A15` (Muted Dark Amethyst) | Purple + Orange gradients | Combined timelines as multi-colored ribbons |

---

### Multi-Scale Time Viewports (The Three Dimensions)

#### 🏔️ Macro Scale: Life in Weeks Matrix
- **80 × 52 grid** (years × weeks)
- Spent weeks desaturate (bg-slate-800/40)
- Active week pulses with theme color
- Upcoming weeks remain empty
- Hovering on week blocks fetches contextual historical events

#### ⏱️ Meso Scale: Strategic Countdown
- Term/Academic progress meters (e.g., "Grade 10 Autumn Term: 68% Completed")
- High-precision countdown clock: **days down to 6 decimal places**
- Monospace font (`font-mono tabular-nums`) to eliminate layout jitter

#### 📊 Micro Scale: Tactical Budget
- "Today's Time Account" displays elapsed vs. remaining hours
- Study/hobbies breakdown
- Custom animated SVG ring visualization

---

### Advanced Immich API Photo Integration

#### Smart Onboarding (AI Initialization)
- Backend calls Immich's paginated `/api/people` endpoint for named, visible
  people
- Shows face thumbnails and supports multi-select import
- Lets the family correct names and fill missing birth dates before creation
- Uses a transactional, idempotent import keyed by Immich person ID
- Falls back to manual member creation when Immich is unavailable

The current onboarding flow does not infer a birth date from the earliest photo.
That is intentionally deferred until asset indexing and photo permissions are
separately validated.

#### Memory Hover Tooltips
- Hovering over historical grid nodes queries Immich's `/api/assets` endpoint
- Pulls Top 3 compressed thumbnails (`/api/assets/{id}/thumbnail?size=thumbnail`)
- Presents them in glassmorphic popover card
- Clicking fires PhotoSwipe for immersive full-screen browsing

#### "On This Day" Time Capsule
- Persistent bottom ticker component
- Polls Immich's time-bucket engine at midnight
- Cycles through nostalgic photos taken on matching calendar days from previous years

---

### Admin Control Configuration Center

- Subtle cog icon (⚙️) toggles a right-sliding translucent backdrop drawer
- Form items:
  - Member setups
  - Countdown schedules (with academic templates for students)
  - Historical log input fields
  - [√] Sync Immich Metadata toggle

---

## 🚀 Development Roadmap

### Phase 1: Interactive Frontend Prototype (MVP 1.0) ✅ COMPLETE
- [x] Single self-contained `index.html` with Tailwind CSS, daisyUI, GSAP via CDN
- [x] Full page layout:
  - 80×52 life grid
  - 6-decimal precision countdown clock
  - Theme-switching JS triggers
  - Right configuration panel with localStorage mock data
- [x] Zero font-shaking on ticking digits (`requestAnimationFrame`)

### Phase 2: Lightweight Containerized Backend (MVP 2.0)
- [x] Migrate from localStorage to SQLite single-file system
- [x] Construct Node.js/Express server routing
- [x] Implement API endpoints for user/event management
- [x] Runtime container transferred to the NAS infrastructure repository
- [x] Launch and validate the Node 22 runtime on the NAS server

### Phase 3: Immich Token Integration (SaaS 3.0)
- [x] Add server-side read-only Immich 3.x people adapter
- [x] Add multi-member face-avatar onboarding and idempotent import
- [ ] Inject the approved Immich read-only key into the NAS runtime
- [ ] Enable and deploy the onboarding flow in production
- [ ] Add photo timeline, hover memories, and “On This Day” features after
  asset health and face-vector indexing are validated

---

## 💡 Key Technical Decisions

### Why SQLite Over MySQL/Redis?
- Single-file database eliminates separate database server processes
- Perfect for NAS environments with limited resources
- ACID compliant with full SQL support
- Zero configuration required

### Why Vanilla JS + CDN?
- Eliminates build step complexity
- Direct browser refresh workflow for rapid prototyping
- Minimal memory footprint on NAS
- Easy maintenance for non-React/Vue developers

### Why `requestAnimationFrame` Over `setInterval`?
- Synchronizes with browser's native refresh rate (typically 60Hz)
- Automatically throttles when tab is inactive (saves CPU)
- Eliminates timer drift and jitter
- More efficient for smooth countdown animations

### Immich Integration Strategy
- Leverages existing family photo library
- No need to build custom photo management
- AI-powered face recognition reduces manual tagging
- Time-bucket engine enables powerful "On This Day" features

---

## 📊 Current Implementation Status

### ✅ Completed product baseline
- **Theme System**: Student/Worker/Family modes with 700ms smooth transitions
- **Life Grid**: 80×52 week visualization with GSAP animations
- **Countdown Clock**: 6-decimal precision with `requestAnimationFrame`
- **Time Budget Ring**: SVG-based daily progress visualization
- **Configuration Drawer**: Profile management with localStorage persistence
- **Flatpickr Integration**: Dark-mode date/time pickers
- **Responsive Layout**: Mobile-friendly with TailwindCSS grid system

### ✅ Completed backend baseline
- [x] Backend API development with Express.js
- [x] SQLite database schema and automatic migrations
- [x] Stable multi-member initialization and switching
- [x] Atomic database persistence and startup backups
- [x] Immich people onboarding implementation and Node 22 compatibility tests

### 🔄 Next steps

1. Publish the unified documentation commit separately from the merged feature.
2. Inject `IMMICH_URL` and `IMMICH_API_KEY` through NAS runtime configuration;
   never store them in this repository or SQLite.
3. Deploy the reviewed full SHA with `nas-deploy family-time-flow --ref <sha>`
   after explicit approval.
4. Validate real-person preview, thumbnails, manual fallback, import,
   restart persistence, and rollback in the home LAN.
5. Keep photo search and memory features separate until Immich asset health is
   confirmed.

---

## 🎯 Project Philosophy

FamilyTimeFlow is not just a time tracker — it's a **philosophical tool** that:

1. **Makes time tangible**: Visualizing life in weeks creates emotional impact
2. **Bridges generations**: Connects present moments with family history through photos
3. **Adapts to lifestyles**: Three distinct personas (Student/Worker/Family) with unique aesthetics
4. **Respects privacy**: Self-hosted on NAS, no cloud dependencies for core functionality
5. **Celebrates memories**: "On This Day" feature turns routine into nostalgia

---

*Built with ❤️ for families who value time together*
