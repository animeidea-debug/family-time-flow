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

## Frontend assets

The browser receives only repository-owned, version-locked static assets. There
is no runtime CDN or frontend build requirement. When changing Tailwind classes
or upgrading a frontend dependency, regenerate and verify the committed bundle:

```sh
npm ci
npm run build:frontend
npm run check:frontend-assets
```

`npm test` also runs the asset check and fails if the committed bundle is stale.

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
| **Backend** | Node.js 22 + Express | Lightweight API behind the NAS-managed nginx proxy |
| **Database** | SQLite | Single-file embedded database (no MySQL/Redis) |
| **Frontend** | Vanilla JS + precompiled TailwindCSS + daisyUI | Version-locked static bundle committed with each release |
| **Animation** | GSAP (GreenSock) | Version-locked local runtime for DOM/SVG motion |
| **Polling/Clock** | `requestAnimationFrame` | Smooth 60Hz+ countdowns, CPU-efficient |
| **Photo Interactivity** | Native DOM preview | Feature-flagged thumbnails and read-only larger previews |
| **Forms/Inputs** | Flatpickr | Version-locked local date-time selection with Chinese locale |

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
  "immich_linked": "boolean"
}
```

Immich person identifiers remain server-private in ordinary member responses.
The browser receives only the linked state and uses Family Time Flow member IDs
for avatars and memories; the explicit onboarding picker is the sole UI flow
that receives selectable Immich person IDs.

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

| Mode | Background | Accessible accent | Vibe |
|------|------------|-------------------|------|
| **Student** | Light sky blue | `#1D4ED8` (deep blue) | Clear, focused, energetic |
| **Worker** | Warm ivory | `#B45309` (deep amber) | Calm, precise, mature |
| **Family** | Soft orange-white | `#C2410C` (deep orange) | Warm, shared, welcoming |

All three themes use explicit primary, secondary, and muted text tokens instead
of low-opacity text. Primary actions use a white-on-accent treatment, and
interactive controls retain a visible keyboard-focus outline.

---

### Multi-Scale Time Viewports (The Three Dimensions)

#### 🏔️ Macro Scale: Life in Weeks Matrix
- **80 × 52 grid** (years × weeks)
- Spent weeks desaturate (bg-slate-800/40)
- Active week pulses with theme color
- Upcoming weeks remain empty
- Click or press Enter on a week to open its date range, age, life stage,
  milestones, locally stored family events, and an on-demand personal photo
  playback of up to nine deduplicated images
- Keyboard users enter the grid once, then use arrow keys or Home/End to move;
  touch devices use the same detail view
- Every visual row always represents 52 weeks and always fits the available
  width without horizontal scrolling. Desktop users can expand the matrix
  across the full dashboard row for closer inspection; mobile keeps the compact
  overview and uses the week-detail dialog for precise reading. “Locate current
  week” recenters the active cell without changing the grid's time meaning.
- Color has one meaning across all profiles: muted member color is elapsed time,
  the full accent ring is the current week, neutral cells are future time, and
  a white diamond marks a milestone. A dark underline marks a locally stored
  family event; life stages remain textual context.

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

The current onboarding flow does not infer a birth date from the earliest
photo. Even with asset indexing validated, the family confirms this identity
data explicitly.

#### Memory Hover Tooltips
- Remains disabled unless the independent server capability
  `ENABLE_IMMICH_WEEK_HOVER=1` is explicitly reviewed and enabled
- On a fine-pointer desktop, waits 600 ms before loading so merely crossing the
  4,160-cell grid does not issue photo requests
- Requests the existing member/week memory selector, then shows one
  person-focused, deduplicated midpoint image as a representative preview
- Uses a larger responsive card and preserves each thumbnail's native aspect
  ratio, so portrait photos remain vertical and fully visible instead of being
  stretched or cropped into a landscape frame
- Caches at most 64 member/week results in page memory and ignores stale hover
  responses; touch devices continue to use the week-detail gallery
- Uses only the compressed thumbnail proxy; larger read-only preview stays in
  the click-opened week detail and original download remains out of scope

#### Week Photo Playback
- Opens inside the existing click, touch, and keyboard week-detail dialog;
  an intentional 600 ms fine-pointer hover can show one cached representative
  photo when the independent server capability is enabled
- Addresses the request by Family Time Flow member ID and life-week index so
  the backend computes the date range and resolves the Immich person privately
- Shows up to nine person-focused, deduplicated photos, balanced across days and
  ordered chronologically; unrelated photos never fill empty positions
- Follows at most three Immich metadata pages (300 candidates) so photo-rich
  weeks are not silently limited to the first page while every request remains
  bounded
- Uses a three-column desktop and two-column mobile gallery with read-only
  preview, retry, unlinked, empty, disabled, and unavailable states
- Excludes photos before the member's birth date and ignores stale responses
  after member or week changes

#### "On This Day" Time Capsule
- Feature-flagged household card and persistent bottom ticker
- Searches the exact calendar day across the previous five years first, then
  fills a sparse gallery from non-overlapping ±1-day and ±3-day bands
- Uses consistent square media tiles for household, personal, and week
  galleries. Images keep their native aspect ratio inside each tile, and the
  capture date sits in a separate footer so portrait and landscape content is
  never cropped or covered
- Keeps only photos containing an Immich person linked to a created household
  member; personless photos are not used as filler
- Removes exact duplicates and same-person camera bursts, balances the limited
  gallery across years, and gives linked household members a fair first pass
- Member pages request the same read-only selector by Family Time Flow member
  ID and show a compact personal gallery containing only that member; the
  backend resolves the Immich link without accepting a person ID from the UI
- Personal galleries exclude photos captured before the member's stored birth
  date, containing possible Immich face-merge mistakes without changing Immich
- Adjacent-day fallback always displays the real capture date and explains the
  expanded window instead of presenting the photo as an exact-day match
- Shows compressed thumbnails and a larger read-only preview without original download
- Keeps explicit disabled, loading, empty, partial, and unavailable states

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
- [x] Single-page `index.html` with a committed offline Tailwind, daisyUI, GSAP,
  and Flatpickr asset bundle
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
- [x] Inject the approved Immich read-only key through the NAS secret runtime
- [x] Enable and deploy the onboarding flow in production
- [x] Validate read-only asset search, person metadata, dates, and thumbnails
  against Immich 3.0.2
- [x] Implement the first “On This Day” experience behind a server feature flag
- [x] Review and enable “On This Day” in production before considering photo
  timeline or hover memories
- [x] Add on-demand personal week photo playback to the accessible week detail
  without enabling hover queries

---

## 💡 Key Technical Decisions

### Why SQLite Over MySQL/Redis?
- Single-file database eliminates separate database server processes
- Perfect for NAS environments with limited resources
- ACID compliant with full SQL support
- Zero configuration required

### Why Vanilla JS + committed static assets?
- Keeps the NAS runtime build-free and lightweight
- Preserves direct browser refresh and simple non-framework maintenance
- Makes the family UI independent of public CDN availability
- Uses a reproducible build check so generated assets cannot silently drift

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
- **Configuration Drawer**: Profile management persisted through the family backend
- **Flatpickr Integration**: Local date/time pickers with Chinese locale
- **Responsive Layout**: Mobile-friendly with TailwindCSS grid system

### ✅ Completed backend baseline
- [x] Backend API development with Express.js
- [x] SQLite database schema and automatic migrations
- [x] Stable multi-member initialization and switching
- [x] Atomic database persistence and startup backups
- [x] Immich people onboarding implementation and Node 22 compatibility tests

### 🔄 Next steps

1. Observe the deployed click/touch/keyboard week-detail experience, four-part
   legend, and corrected read-only Immich capability status during normal
   household use.
2. Observe “On This Day” during normal household use before considering photo
   timeline or week-hover expansion.
3. Add any remaining intended family members from the home LAN; these identity
   choices remain deliberately manual.
4. Keep the unauthenticated family API restricted to the trusted LAN.

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
