# Immich Integration Design — FamilyTimeFlow

> **当前状态（2026-07-20）**：Immich 3.0.2 已完成只读联调验证。新版 Key 仅用于服务端读取人物；旧 Key 曾进入 Git 历史，必须保持撤销，禁止复用。

## 0. 新 API Key 安全基线

正式恢复联调前创建专用 Key，名称建议为 `FamilyTimeFlow Read Only`。

### 人物初始化所需权限

- `person.read`：人物列表、人物资料和人物缩略图。
- `person.statistics`：可选；读取人物照片统计，本阶段验证可用但不作为导入依赖。

照片时间线阶段才需要另行增加 `asset.read` 和缩略图读取权限；人物初始化不需要这些权限。

仅当后续决定直接读取 Immich 原生 Memories 时，再单独增加 `memory.read`。

### 明确禁止

- `all` 和所有 `admin.*` 权限。
- `asset.update`、`asset.delete`、`asset.upload`、`asset.download`。
- `person.update`、`person.delete`、`person.merge`、`person.reassign`。
- `apiKey.*`、`systemConfig.*`。
- `memory.create`、`memory.update`、`memory.delete`。

### 账户与交付方式

- Key 所属账户必须能看到所需家庭照片；优先使用专门的只读集成账户，通过 Immich 分享关系获得可见范围。
- Key 不得粘贴到聊天、前端、Git、Markdown 或普通配置文件。
- Key 只能通过 NAS 容器 Secret 或服务端环境变量 `IMMICH_API_KEY` 注入。
- FamilyTimeFlow 后端不得通过诊断、同步或 bootstrap API 返回 Key。
- 接入前必须按升级后的 Immich 实际版本重新验证权限与 API 路径。

> **Live validation (2026-07-20): Immich 3.0.2**
> 当前 Key 可见 10 位已命名人物：10 位有头像，7 位有出生日期；人物详情、头像和统计接口均返回 200。

---

## 1. Authentication

### API Key Pattern

Immich uses `x-api-key` header for server-to-server authentication. Create an API key from the Immich web UI:

```
Settings → API Keys → Create New
Header: x-api-key: <your-api-key>
```

**FamilyTimeFlow key status**: 已创建并验证人物只读权限；不使用管理员权限。

```sh
curl -H "x-api-key: <key>" http://192.168.6.108:22283/api/server/version
# → {"major":3,"minor":0,"patch":2}
```

### Where to store

- **Backend env/secret**: 通过 NAS 端受保护的环境或容器 Secret 注入
- **Backend code**: Only referenced via environment variable `IMMICH_API_KEY`

---

## 2. Core API Endpoints

### 2.1 People (Facial Recognition)

Base URL: `GET /api/people`

```json
// Response shape (Immich 3.0.2, paginated):
{
  "total": 15643,
  "hidden": 0,
  "people": [
    {
      "id": "a34eb045-...",
      "name": "陈婧文",
      "birthDate": null,          // ← Can be set manually via UI/API
      "thumbnailPath": "/upload/thumbs/...",
      "isHidden": false,
      "isFavorite": false,
      "updatedAt": "2026-07-08T..."
    }
  ]
}
```

**当前用例**：Smart Onboarding 获取已命名、未隐藏人物，显示头像并支持批量选择。`birthDate` 为空时由用户在确认页补充；本阶段不根据最早照片猜测生日。

FamilyTimeFlow 对浏览器返回稳定 DTO，不暴露 `thumbnailPath`：

```json
{
  "id": "person-id",
  "name": "家庭成员",
  "birthDate": "2012-03-04",
  "hasThumbnail": true,
  "thumbnailUrl": "/api/immich/person-thumb?id=person-id",
  "linked": false,
  "updatedAt": "2026-07-20T..."
}
```

### 2.2 Assets (Photos & Videos)

Base URL: `GET /api/assets`

Key query parameters for our use cases:

| Parameter | Type | Purpose |
|-----------|------|---------|
| `userId` | UUID | Filter by user (optional, admin can query all) |
| `personId` | UUID | Filter by recognized person |
| `takenDate` | string (ISO) | Exact date match for "On This Day" |
| `takenDateAfter` | string | Date range start |
| `takenDateBefore` | string | Date range end |
| `type` | enum | `IMAGE` or `VIDEO` |
| `withPeople` | boolean | Include face metadata |

**Response fields relevant to FamilyTimeFlow**:

```json
{
  "id": "uuid",
  "originalPath": "/upload/library/...",
  "originalFileName": "IMG_1234.JPG",
  "fileCreatedAt": "2024-03-15T10:30:00.000Z",  // ← Camera timestamp
  "fileModifiedAt": "2024-03-15T10:30:00.000Z",
  "isFavorite": false,
  "type": "IMAGE",
  "people": [
    {
      "id": "uuid",
      "name": "Person Name"
    }
  ],
  "exifInfo": {
    "dateTimeOriginal": "2024-03-15T10:30:00.000Z",
    "latitude": 31.2304,
    "longitude": 121.4737
  }
}
```

### 2.3 Asset Thumbnails

```
GET /api/assets/{id}/thumbnail?size=thumbnail|preview
```

- `thumbnail`: Small compressed (120px) — for grid hover tooltips
- `preview`: Medium quality — for lightbox preview

**PRD Use Case**: Memory Hover Tooltips — fetch top 3 compressed thumbnails for a given date node.

### 2.4 Time Buckets (Memories)

Immich has built-in memory/time-bucket functionality via the `memory` table and dedicated endpoints:

```
GET /api/memories
```

Memory types include:
- `on_this_day` — auto-generated "On This Day" memories
- `trip` — trip-based memories
- `person` — person-specific memories

The `memory` table schema (confirmed via live DB):

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `ownerId` | UUID | User who owns this memory |
| `type` | varchar | `on_this_day`, `trip`, `person` |
| `data` | JSONB | Flexible payload with asset IDs, metadata |
| `isSaved` | boolean | User-saved vs auto-generated |
| `memoryAt` | timestamp | When the memory is relevant |
| `showAt` / `hideAt` | timestamp | Display window |

### 2.5 Server Info

```
GET  /api/server/version          → {"major":2,"minor":7,"patch":5}
GET  /api/server/ping             → {"status":"ok","serverVersion":"2.7.5"}
```

---

## 3. Integration Flows (Per PRD Feature)

### 3.1 Smart Onboarding — Birth Date Deduction

**Flow**:

```
User creates profile → selects person from Immich faces
  → Backend queries: GET /api/people/{id}
    → If birthDate already set → use it
    → If birthDate is null → Smart Deduction:
      1. GET /api/assets?personId={id}&sort=fileCreatedAt&order=asc&limit=1
      2. Extract fileCreatedAt from oldest asset
      3. Subtract ~1 year (infant buffer) → suggest as birth date
      4. Present to user for confirmation
```

**DB shortcut** (if API key has DB access): Query `person.birthDate` directly. If null, find the earliest `asset.file_created_at` associated with this person via `asset_face` join.

### 3.2 Memory Hover Tooltips

**Flow**:

```
User hovers on a historical grid node (date = YYYY-MM-DD)
  → Backend queries: GET /api/assets?takenDateAfter=YYYY-MM-DDT00:00:00&takenDateBefore=YYYY-MM-DDT23:59:59&limit=3
  → Returns top 3 assets with thumbnails
  → Frontend renders glassmorphism popover with:
    - Thumbnail URLs: /api/assets/{id}/thumbnail?size=thumbnail
    - Photo titles/dates
    - Click → PhotoSwipe lightbox with full image
```

**Optimization**: Cache thumbnails on date nodes that the user has already hovered over. Immich thumbnail URLs are stable (keyed by asset ID).

### 3.3 "On This Day" Time Capsule

**Flow**:

```
Runs at midnight (or on page load):
  → Backend calls: GET /api/assets?takenDate={month}-{day}&limit=5
    (Note: Immich API may use date range across years)
  → Alternative: GET /api/memories?type=on_this_day
  → Returns photo assets taken on this day in ANY year
  → Frontend bottom ticker cycles through them with fade transitions
```

**Cycle strategy**: If >5 photos, auto-cycle every 8 seconds with GSAP fade. If 0 photos, show a "no memories yet" placeholder.

### 3.4 Timeline Photo Nodes

**Flow**:

```
User clicks on a specific event on the timeline:
  → Backend: GET /api/assets?takenDate={event_date}&limit=20
  → If event has immich_sync_photos=true → merge with event metadata
  → Display in PhotoSwipe lightbox gallery
```

---

## 4. Data Model Alignment

| FamilyTimeFlow Schema | Immich Equivalent | Integration |
|----------------------|-------------------|-------------|
| `UserProfile.immich_person_id` | `person.id` | Direct 1:1 mapping |
| `TimelineEvent.target_date` | `asset.file_created_at` | Filter assets by date |
| `UserProfile.birth_date` | `person.birthDate` | Pull from Immich |
| `UserProfile.expected_age` | — | Not in Immich (FTF-specific) |

---

## 5. Fallback Strategy

If Immich is unavailable (NAS off, Immich down, API unreachable):

| Feature | Fallback |
|---------|----------|
| **Smart Onboarding** | Manual birth date input only |
| **Hover Tooltips** | Show placeholder "No photos synced" with a camera icon |
| **"On This Day"** | Hide ticker entirely or show text-only "Immich not connected" |
| **Timeline Nodes** | Render timeline without photo attachments |

Check connectivity at startup:

```js
async function checkImmichStatus() {
  try {
    const res = await fetch(`${IMMICH_URL}/api/server/ping`, {
      headers: { 'x-api-key': IMMICH_KEY }
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

---

## 6. Environment Variables

```bash
# .env (gitignored)
IMMICH_URL=http://192.168.6.108:22283
IMMICH_API_KEY=<injected-secret>
```

---

## 7. Testing Commands

```sh
# Quick health check
curl -s -H "x-api-key: $IMMICH_API_KEY" http://192.168.6.108:22283/api/server/version

# List people
curl -s -H "x-api-key: $IMMICH_API_KEY" http://192.168.6.108:22283/api/people | jq '.people[] | {name, birthDate, assetsCount}'

# Assets by person (replace PERSON_ID)
curl -s -H "x-api-key: $IMMICH_API_KEY" "http://192.168.6.108:22283/api/assets?personId=PERSON_ID&limit=3" | jq '.assets[] | {originalFileName, fileCreatedAt}'

# "On This Day" — assets from July 8 in any year
curl -s -H "x-api-key: $IMMICH_API_KEY" "http://192.168.6.108:22283/api/assets?takenDate=2024-07-08&limit=5" | jq '.assets[] | {originalFileName, fileCreatedAt}'
