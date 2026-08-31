# Immich Integration Design — FamilyTimeFlow

> **当前状态（2026-08-30）**：Immich 3.0.2 已完成只读人物、照片元数据与
> 缩略图联调验证。旧 Key 曾进入 Git 历史，必须保持撤销，禁止复用。

## 0. 新 API Key 安全基线

正式恢复联调前创建专用 Key，名称建议为 `FamilyTimeFlow Read Only`。

### 当前最小权限

- `person.read`：人物列表、人物资料和人物缩略图。
- `asset.read`：按人物和日期搜索照片元数据。
- `asset.view`：读取 `thumbnail` 或 `preview` 缩略图。

人物初始化本身只依赖 `person.read`。照片回忆功能需要后两项权限，但不需要
`asset.download`；Family Time Flow 不读取原图。

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

> **Live validation (2026-08-30): Immich 3.0.2**
> 当前 Key 可见 10 位已命名人物：10 位有头像，7 位有出生日期。三个已关联
> 成员均返回照片；九张抽样图片均有人物和日期元数据，九个缩略图均读取成功。

---

## 1. Authentication

### API Key Pattern

Immich uses `x-api-key` header for server-to-server authentication. Create an API key from the Immich web UI:

```
Settings → API Keys → Create New
Header: x-api-key: <your-api-key>
```

**FamilyTimeFlow key status**: 已验证人物、照片元数据与缩略图只读权限；不使用
管理员、原图下载或写权限。

```sh
curl -H "x-api-key: <key>" "$IMMICH_URL/api/server/version"
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
      "name": "家庭成员",
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

Base URL: `POST /api/search/metadata`

Key JSON fields for our use cases:

| Parameter | Type | Purpose |
|-----------|------|---------|
| `personIds` | UUID[] | Filter by recognized people; must be an array |
| `takenAfter` | string | Date range start |
| `takenBefore` | string | Date range end |
| `type` | enum | `IMAGE` or `VIDEO` |
| `withPeople` | boolean | Include face metadata |
| `withExif` | boolean | Include capture date metadata |

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
GET /api/server/version → {"major":3,"minor":0,"patch":2}
```

---

## 3. Integration Flows (Per PRD Feature)

### 3.1 Smart Onboarding

**Flow**:

```
User creates profile → selects person from Immich faces
  → Backend queries the paginated GET /api/people endpoint
    → If birthDate already exists, prefill it
    → If birthDate is null, require the family to enter and confirm it
    → Create the member idempotently by Immich person ID
```

Family Time Flow does not access the Immich database and does not infer a birth
date from the oldest photo.

### 3.2 Memory Hover Tooltips

**Flow**:

```
User hovers on a historical grid node (date = YYYY-MM-DD)
  → Backend sends POST /api/search/metadata with:
    personIds=[linked person], takenAfter, takenBefore, size=3
  → Returns top 3 assets with thumbnails
  → Frontend renders glassmorphism popover with:
    - Thumbnail URLs: /api/assets/{id}/thumbnail?size=thumbnail
    - Photo titles/dates
    - A later reviewed design may open a larger preview; original download is
      outside the current permission scope
```

该交互要求独立设置 `ENABLE_IMMICH_WEEK_HOVER=1`。它不继承
`ENABLE_IMMICH_MEMORIES`，当前生产范围保持关闭。

**Optimization**: Cache thumbnails on date nodes that the user has already hovered over. Immich thumbnail URLs are stable (keyed by asset ID).

### 3.3 "On This Day" Time Capsule

该功能还要求服务端显式设置 `ENABLE_IMMICH_MEMORIES=1`。未设置时，前端不会
发起照片回忆请求，后端 `/api/immich/on-this-day` 返回 `disabled`。
这个开关只控制“往年今日”，不控制人生周格悬停照片。

**Flow**:

```
Runs on household page load and checks the date every 30 minutes:
  → Backend concurrently calls POST /api/search/metadata for the same month/day
    across the previous five years, excluding the current year
  → Backend returns at most six minimal image records
  → Frontend renders the card and updates the bottom ticker with result status
```

The first version shows at most six image thumbnails in a two-column card. It
offers an Immich `preview` modal, but does not request videos or original files.
If no matching photos exist, it shows a normal empty state rather than treating
the result as an integration failure.

### 3.4 Timeline Photo Nodes

**Flow**:

```
User clicks on a specific event on the timeline:
  → Backend: POST /api/search/metadata with the event date range and size=20
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
    const res = await fetch(`${IMMICH_URL}/api/server/version`, {
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
IMMICH_URL=http://immich-server:2283
IMMICH_API_KEY=<injected-secret>
```

---

## 7. Testing Commands

```sh
# Quick health check
curl -s -H "x-api-key: $IMMICH_API_KEY" "$IMMICH_URL/api/server/version"

# List people
curl -s -H "x-api-key: $IMMICH_API_KEY" "$IMMICH_URL/api/people?page=1&size=100&withHidden=false" | jq '.people | length'

# Assets by person (replace PERSON_ID; output only a count during operations)
curl -s -X POST -H "x-api-key: $IMMICH_API_KEY" -H "content-type: application/json" \
  -d '{"personIds":["PERSON_ID"],"size":3}' "$IMMICH_URL/api/search/metadata" | jq '.assets.items | length'

# Thumbnail permission probe (replace ASSET_ID; discard image bytes)
curl -s -o /dev/null -w '%{http_code}\n' -H "x-api-key: $IMMICH_API_KEY" \
  "$IMMICH_URL/api/assets/ASSET_ID/thumbnail?size=thumbnail"
