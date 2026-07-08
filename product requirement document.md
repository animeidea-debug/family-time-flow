# Product Requirement Document (PRD) - FamilyTimeFlow

## 1. Executive Summary & Core Vision
[cite_start]FamilyTimeFlow is a self-hosted, multi-user dynamic time visualization dashboard deployed on home NAS environments[cite: 11, 23]. [cite_start]It transforms abstract time management into a "Family Digital Time Machine"[cite: 23, 47]. [cite_start]By intertwining family lifelines and anchoring focus value, it helps students visualize time slippage for academic planning, while awakening collective family memories through deep integration with the local NAS storage ecosystem[cite: 1, 17, 52].

### Core Principles:
* [cite_start]**No Isolation**: Open and transparent access for all family members without complex JWT role segregation[cite: 11, 21].
* [cite_start]**Visually Anchored**: Utilizing multi-scale viewports (Macro, Meso, Micro) to counter procrastination[cite: 2, 24].
* [cite_start]**Emotion-Driven**: Combining programmatic time tracking with dynamic biographical photography via Immich[cite: 47, 68].

---

## 2. Technical Stack & Architecture
[cite_start]To ensure lightweight, easy-to-maintain, and performant 24/7 operation on NAS hardware, the system must follow this standardized architectural blueprint[cite: 11, 12]:

| Layer | Component / Tech Stack | Specifications & Framework Guidelines |
| :--- | :--- | :--- |
| **Deployment** | Docker & Docker Compose | [cite_start]Containerized single-click deployment for Synology/QNAP[cite: 12]. |
| **Backend** | Node.js (Express) or Python (FastAPI) | [cite_start]Lightweight API serving, directly exposed to the frontend[cite: 12, 21]. |
| **Database** | SQLite | Single-file embedded database. [cite_start]No heavy MySQL/Redis instances[cite: 12]. |
| **Frontend Base** | Vanilla JS + TailwindCSS + daisyUI | [cite_start]Zero-build environment (CDN preferred) to allow direct browser refresh[cite: 12, 62]. |
| **Animation Engine**| GSAP (GreenSock Animation Platform) | [cite_start]Performance-optimized DOM/SVG manipulations for timeline rendering[cite: 58]. |
| **Polling/Clock** | `requestAnimationFrame` API | [cite_start]Smooth 60Hz+ countdowns, abandoning CPU-heavy `setInterval` loops[cite: 60]. |
| **Photo Interactivity**| Floating UI & PhotoSwipe | [cite_start]Floating micro-glassmorphism tooltips and immersive photo lightbox. |
| **Forms/Inputs** | Flatpickr (Dark Mode) | [cite_start]Ultra-lightweight, dependency-free date-time selection[cite: 64]. |

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

4. UI/UX & Functional Specifications

4.1 Role-Based Adaptive Theme System (千人千面)The dashboard interface adapts its aesthetic persona on-the-fly when toggling users via the top-bar navigation. Style changes must animate seamlessly via Tailwind transition parameters over 700ms:Student Mode (student): Slate/Deep Blue background (#060B18) with Neon Mint Green (#10B981) accents. Evokes morning twilight, academic vigor, and infinite future paths.Worker Mode (worker): Obsidian/Dark Onyx background (#090D16) with Premium Amber Gold (#F59E0B) indicators. Denotes maturity, precision clockwork, and life progress anchors.Family Shared Mode (family): Muted Dark Amethyst (#0F0A15) with Twilight Purple and Sunset Orange radial gradients. Displays combined timelines as multi-colored visual ribbons.

4.2 Multi-Scale Time Viewports (The Three Dimensions)Macro Scale (Life In Weeks Matrix): Renders an $80 \times 52$ grid. Spent weeks desaturate (bg-slate-800/40) , the active week pulses with the active theme color, and upcoming weeks remain empty. Hovering on week blocks fetches corresponding contextual historical events.Meso Scale (Strategic Countdown): Term/Academic progress meters rendered as charging battery slots (e.g., Grade 10 Autumn Term: 68% Completed). Alongside a high-precision countdown clock calculating days down to 6 decimal places. Font typography MUST be monospace (font-mono tabular-nums) to completely eliminate layout jitter.Micro Scale (Tactical Budget): "Today's Time Account" displays current day elapsed vs. remaining hours for study/hobbies using custom animated SVGs.4.3 Advanced Immich API Photo IntegrationSmart Onboarding (AI Initialization): When creating a profile, the backend calls Immich's /api/people to retrieve facial groupings. Upon selection, the backend polls /api/assets in ascending chronological order to find the earliest infant picture of the person, auto-extracting its metadata timestamp as the recommended date of birth.Memory Hover Tooltips: Hovering over a historical landmark grid node queries Immich’s /api/assets endpoint with takenDate to pull the Top 3 compressed thumbnails (/api/assets/{id}/thumbnail?size=thumbnail) , presenting them within a glassmorphic popover card. Clicking fires PhotoSwipe for immersive full-screen browsing."On This Day" Time Capsule: A persistent bottom ticker component that runs at midnight, polling Immich's time-bucket engine to cycle-fade nostalgic photos taken on the exact matching calendar day from previous years.4.4 Admin Control Configuration CenterA subtle, fixed cog icon (⚙️) toggles a non-disruptive, right-sliding translucent backdrop drawer:Form items include member setups, countdown schedules (with embedded academic templates for student profiles), and historical log input fields.Includes an option toggle for [√] Sync Immich Metadata to map assets directly against timestamps.5. Development Roadmap & Implementation StepsPhase 1: Interactive Frontend Prototype (MVP 1.0)Develop a single self-contained index.html referencing Tailwind CSS, daisyUI, and GSAP via CDN. Build the full page layout containing the $80 \times 52$ life grid , the 6-decimal precision clock , theme-switching JS triggers , and the right configuration panel utilizing localStorage mock data. Ensure zero font-shaking on ticking digits.Phase 2: Lightweight Containerized Backend (MVP 2.0)Migrate storage architectures from localStorage to an embedded SQLite single-file system. Construct the Node.js/Python server routing, implement API endpoints for user/event management , wrap the workspace via Docker Compose, and launch on the NAS server to evaluate responsive multi-device scaling (iPad, TV, monitors).Phase 3: Immich Token Integration (SaaS 3.0)Inject Immich bearer authentication keys , wire up dynamic asset pipelines for popover nodes, and activate the face-matching birth date deduction wizard to complete the autonomous family time archive.