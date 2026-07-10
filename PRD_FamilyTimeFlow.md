# Product Requirement Document (PRD) - FamilyTimeFlow

## 1. Executive Summary & Core Vision

FamilyTimeFlow is a self-hosted, multi-user dynamic time visualization dashboard deployed on home NAS environments. It transforms abstract time management into a **"Family Digital Time Machine"**. By intertwining family lifelines and anchoring focus value, it helps students visualize time slippage for academic planning, while awakening collective family memories through deep integration with the local NAS storage ecosystem.

### Core Principles:
- **No Isolation**: Open and transparent access for all family members without complex JWT role segregation
- **Visually Anchored**: Utilizing multi-scale viewports (Macro, Meso, Micro) to counter procrastination
- **Emotion-Driven**: Combining programmatic time tracking with dynamic biographical photography via Immich

---

## 2. Technical Stack & Architecture

To ensure lightweight, easy-to-maintain, and performant 24/7 operation on NAS hardware, the system must follow this standardized architectural blueprint:

| Layer | Component / Tech Stack | Specifications & Framework Guidelines |
| :--- | :--- | :--- |
| **Deployment** | Docker & Docker Compose | Containerized single-click deployment for Synology/QNAP |
| **Backend** | Node.js (Express) or Python (FastAPI) | Lightweight API serving, directly exposed to the frontend |
| **Database** | SQLite | Single-file embedded database. No heavy MySQL/Redis instances |
| **Frontend Base** | Vanilla JS + TailwindCSS + daisyUI | Zero-build environment (CDN preferred) to allow direct browser refresh |
| **Animation Engine** | GSAP (GreenSock Animation Platform) | Performance-optimized DOM/SVG manipulations for timeline rendering |
| **Polling/Clock** | `requestAnimationFrame` API | Smooth 60Hz+ countdowns, abandoning CPU-heavy `setInterval` loops |
| **Photo Interactivity** | Floating UI & PhotoSwipe | Floating micro-glassmorphism tooltips and immersive photo lightbox |
| **Forms/Inputs** | Flatpickr (Dark Mode) | Ultra-lightweight, dependency-free date-time selection |

---

## 3. System Data Model (Schema)

### 3.1 User Profile

```json
{
  "id": "string (uuid)",
  "name": "string",
  "birth_date": "string (YYYY-MM-DD)",
  "expected_age": "integer (default: 80)",
  "identity_tag": "string (student | worker | family)",
  "immich_person_id": "string (optional)"
}
```

### 3.2 Timeline Events

```json
{
  "id": "string (uuid)",
  "title": "string",
  "target_date": "string (YYYY-MM-DD HH:mm:ss)",
  "event_scale": "string (macro | meso | micro)",
  "is_shared": "boolean (true = visible globally, false = user specific)",
  "owner_id": "string (user_id reference)",
  "immich_sync_photos": "boolean (default: false)"
}
```

---

## 4. UI/UX & Functional Specifications

### 4.1 Role-Based Adaptive Theme System (千人千面)

The dashboard interface adapts its aesthetic persona on-the-fly when toggling users via the top-bar navigation. Style changes must animate seamlessly via Tailwind transition parameters over 700ms:

- **Student Mode (student)**: Slate/Deep Blue background (#060B18) with Neon Mint Green (#10B981) accents. Evokes morning twilight, academic vigor, and infinite future paths.
- **Worker Mode (worker)**: Obsidian/Dark Onyx background (#090D16) with Premium Amber Gold (#F59E0B) indicators. Denotes maturity, precision clockwork, and life progress anchors.
- **Family Shared Mode (family)**: Muted Dark Amethyst (#0F0A15) with Twilight Purple and Sunset Orange radial gradients. Displays combined timelines as multi-colored visual ribbons.

### 4.2 Multi-Scale Time Viewports (The Three Dimensions)

**Macro Scale (Life In Weeks Matrix)**: 
- Renders an 80×52 grid
- Spent weeks desaturate (bg-slate-800/40)
- The active week pulses with the active theme color
- Upcoming weeks remain empty
- Hovering on week blocks fetches corresponding contextual historical events

**Meso Scale (Strategic Countdown)**:
- Term/Academic progress meters rendered as charging battery slots (e.g., Grade 10 Autumn Term: 68% Completed)
- High-precision countdown clock calculating days down to 6 decimal places
- Font typography MUST be monospace (font-mono tabular-nums) to completely eliminate layout jitter

**Micro Scale (Tactical Budget)**:
- "Today's Time Account" displays current day elapsed vs. remaining hours for study/hobbies
- Uses custom animated SVGs for visualization

### 4.3 Advanced Immich API Photo Integration

**Smart Onboarding (AI Initialization)**:
- When creating a profile, the backend calls Immich's `/api/people` to retrieve facial groupings
- Upon selection, the backend polls `/api/assets` in ascending chronological order to find the earliest infant picture
- Auto-extracts metadata timestamp as the recommended date of birth

**Memory Hover Tooltips**:
- Hovering over a historical landmark grid node queries Immich's `/api/assets` endpoint with takenDate
- Pulls the Top 3 compressed thumbnails (`/api/assets/{id}/thumbnail?size=thumbnail`)
- Presents them within a glassmorphic popover card
- Clicking fires PhotoSwipe for immersive full-screen browsing

**"On This Day" Time Capsule**:
- Persistent bottom ticker component that runs at midnight
- Polls Immich's time-bucket engine
- Cycles through nostalgic photos taken on the exact matching calendar day from previous years

### 4.4 Admin Control Configuration Center

- A subtle, fixed cog icon (⚙️) toggles a non-disruptive, right-sliding translucent backdrop drawer
- Form items include:
  - Member setups
  - Countdown schedules (with embedded academic templates for student profiles)
  - Historical log input fields
- Includes an option toggle for [√] Sync Immich Metadata to map assets directly against timestamps

---

## 5. Development Roadmap & Implementation Steps

### Phase 1: Interactive Frontend Prototype (MVP 1.0)
- Develop a single self-contained `index.html` referencing Tailwind CSS, daisyUI, and GSAP via CDN
- Build the full page layout containing:
  - The 80×52 life grid
  - The 6-decimal precision clock
  - Theme-switching JS triggers
  - The right configuration panel utilizing localStorage mock data
- Ensure zero font-shaking on ticking digits

### Phase 2: Lightweight Containerized Backend (MVP 2.0)
- Migrate storage architectures from localStorage to an embedded SQLite single-file system
- Construct the Node.js/Python server routing
- Implement API endpoints for user/event management
- Wrap the workspace via Docker Compose
- Launch on the NAS server to evaluate responsive multi-device scaling (iPad, TV, monitors)

### Phase 3: Immich Token Integration (SaaS 3.0)
- Inject Immich bearer authentication keys
- Wire up dynamic asset pipelines for popover nodes
- Activate the face-matching birth date deduction wizard to complete the autonomous family time archive

---

## Appendix: Key Technical Decisions

### Why SQLite Over MySQL/Redis?
- Single-file database eliminates the need for separate database server processes
- Perfect for NAS environments with limited resources
- ACID compliant and supports full SQL
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