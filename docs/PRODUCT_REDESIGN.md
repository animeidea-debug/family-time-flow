# FamilyTimeFlow 产品重设计与接管基线

> 状态：设计草案，实施前评审用  
> 日期：2026-07-17  
> 原则：先稳定身份和核心体验，再恢复 Immich 集成；本文件确认前不作为已实施功能说明。

## 1. 产品重新定位

FamilyTimeFlow 是一个运行在家庭 NAS 上的家庭时间与记忆仪表盘。它不试图成为完整日历、任务管理器或照片管理器，而是回答三个问题：

1. **我们正处在人生的哪一段？**
2. **眼下最值得期待或重视的事情是什么？**
3. **过去的这个时间，我们共同经历过什么？**

一句话定义：

> 把每位家庭成员的人生阶段、近期目标和 Immich 家庭记忆，放进同一条可浏览的时间脉络。

### 核心使用场景

- 客厅屏幕：默认显示“家庭首页”，让全家快速看到今日、近期事件和那年今日。
- 个人查看：点选头像进入某位成员的人生周格、成长阶段、目标和个人照片记忆。
- 家长维护：添加成员、校正生日、关联 Immich 人物、设置里程碑与倒计时。
- 回忆探索：从某一周或某一天进入照片集合；Immich 不可用时，时间视图仍然完整可用。

### 明确不做

- 不在首阶段实现账户注册、复杂权限或家庭外分享。
- 不复制 Immich 的照片管理、相册编辑和人脸管理能力。
- 不复制通用日历的完整日程管理。
- 不把“学生 / 职场 / 家庭”当成用户身份；它们只可作为展示模板。
- 不让首次启动强依赖 Immich 成功连接。

## 2. 参考产品带来的启发

| 产品 | 值得吸收 | 不直接照搬 |
|---|---|---|
| [Life in Weeks](https://lifeweeks.app/obama/) | 周格中穿插人生阶段和关键事件，格子是故事入口而不只是进度条 | 为每周塞入公共历史事件会稀释家庭主题 |
| [Timestripe](https://timestripe.com/about/) | Day / Week / Month / Year / Life 的层级让长期目标落到近期行动 | 完整目标管理系统超出项目边界 |
| [Skylight Calendar](https://shop.myskylight.com/) | 每位成员有独立头像、颜色和 Profile；共享屏幕优先呈现家庭共同信息 | 家务、奖励、菜谱暂不进入首阶段 |
| [Day One Today / On This Day](https://dayoneapp.com/guides/tips-and-tutorials/today-view/) | 把照片、事件和往年今日聚合到选定日期，记忆是上下文而非独立模块 | 本项目不建立完整日记编辑器 |
| Immich | 负责照片资产、人物识别、缩略图和记忆数据 | 不把 Immich Person 直接当作本项目用户 |

由此得到的产品结构是：**家庭首页负责共同感知，个人页负责人生成长，日期详情负责连接记忆。**

## 3. 新的信息架构

### 3.1 家庭首页（默认入口）

- 顶部：家庭名称、当前日期、服务状态（仅异常时出现）。
- 成员栏：固定顺序的成员头像、名字、个人颜色；当前选择清晰可见。
- 今日：今天剩余时间、家庭共同事件、每位成员最近一个重要节点。
- 近期：未来 30/90 天的重要事件和倒计时。
- 那年今日：Immich 返回的照片卡片；不可用时整块降级，不阻断首页。
- 人生缩影：每位成员一条小型人生进度带，点击进入个人页。

### 3.2 个人时间页

- 人生周格：固定 52 列，缩放用于查看密度，不改变“每行一年”的语义。
- 当前阶段：年龄、教育/职业/自定义人生阶段。
- 近期目标：一个主倒计时，加少量次级里程碑。
- 记忆密度：有照片或事件的周以轻量标记呈现。
- 点击周格：打开周详情，而不是在 hover 中进行重型网络请求。

### 3.3 周 / 日详情

- 日期范围和年龄。
- 本地事件或备注。
- Immich 照片集合。
- 相邻周导航。
- Immich 失败时显示可恢复的错误状态和重试入口。

### 3.4 设置中心

分为四块：

1. 家庭：家庭名称、默认首页、成员排序。
2. 成员：资料、颜色、出生日期、模板、Immich 关联。
3. 照片服务：Immich 地址、连接测试、版本与兼容状态。
4. 系统：备份、恢复、诊断、版本信息。

## 4. 身份模型：解决多用户不稳定的核心

当前实现混合了三种不同概念：

- FamilyTimeFlow Member：本项目中的家庭成员。
- Immich Person：照片库的人脸聚类对象。
- Browser Session：当前浏览器正在查看谁。

新模型必须明确分离：

```text
Household
  └─ Member (FamilyTimeFlow 的唯一业务身份)
       ├─ Profile / theme / milestones
       └─ optional ImmichPersonLink

DevicePreference
  ├─ activeMemberId (可为空，空表示家庭首页)
  └─ lastView
```

### 4.1 数据职责

| 数据 | 唯一权威来源 | 浏览器是否持久化 |
|---|---|---|
| 家庭成员资料 | 后端数据库 | 只缓存快照 |
| 当前查看成员 | 当前设备 | 是，仅保存 `activeMemberId` |
| Immich 人物关联 | 后端数据库 | 否 |
| Immich 连接配置 | 后端安全配置 | 否，永不返回 API Key |
| UI 临时状态 | 浏览器内存 | 必要时保存无敏感偏好 |

禁止再通过 `identity_tag`、名字或 localStorage 中的资料猜测当前用户。

### 4.2 成员与 Immich 的关系

- Member 可以不关联 Immich Person。
- 一个 Member 首阶段最多关联一个 Immich Person。
- 同一个 Immich Person 默认不能重复关联多个 Member。
- 删除 Member 不删除 Immich Person 或照片。
- Immich 人物改名不会自动覆盖 Member 名字，只提示可同步。

## 5. 启动与切换状态机

### 5.1 应用启动

```text
BOOT
  → 请求 /bootstrap
    ├─ 成功且无成员 → EMPTY_HOUSEHOLD
    ├─ 成功且有成员 → READY
    └─ 失败          → OFFLINE_ERROR
```

`/bootstrap` 应一次返回安全的应用配置、成员摘要、Immich 能力状态和 schema 版本。前端不得并行发起 health、sync、people 请求来共同决定页面去向。

### 5.2 首次初始化

```text
EMPTY_HOUSEHOLD
  → 创建家庭
  → 创建第一个 Member（姓名与生日即可）
  → 进入 READY
  → 可选：稍后连接 Immich
```

关键变化：Immich 连接和人物选择从“首次启动必经步骤”降为可跳过的后续增强。

### 5.3 成员切换

```text
用户点击 Member
  → 将界面置为 SWITCHING（保留旧内容，不清空）
  → GET /members/:id/view
    ├─ 成功：原子替换当前 ViewModel，保存 activeMemberId
    └─ 失败：保留旧成员，提示失败，不改变 activeMemberId
```

禁止在切换过程中逐字段修改全局 `state.profile`；只有完整请求成功后才能一次性提交新状态。

### 5.4 刷新恢复

- 后端有成员且本机 `activeMemberId` 有效：恢复该成员。
- ID 已失效：进入家庭首页，不猜测其他成员。
- 未保存 activeMemberId：进入家庭首页。
- 后端不可达：显示明确的离线/服务异常页，不把本地旧资料伪装成已同步状态。

## 6. 交互与视觉原则

- 默认浅色、温暖、适合家庭公共屏幕；深色作为可选模式。
- 一个页面只保留一个主视觉焦点，人生周格不与多个大型统计卡争抢注意力。
- 成员颜色是稳定标识，不随“学生/职场”切换。
- 状态可见：加载、空数据、Immich 未连接、版本不兼容、请求失败必须区分。
- hover 只给即时摘要；完整照片查询由点击触发，兼顾触屏设备。
- 先保证电视、桌面和平板；手机用于查看和简单维护，不强求展示完整周格。

## 7. 技术接管方向

### 7.1 保留

- Node.js + Express 的轻量服务形态。
- NAS 自托管和反向代理部署方式。
- SQLite 单文件数据思路。
- Vanilla 前端可继续使用，但拆成明确模块。
- Immich 只经后端代理访问。

### 7.2 调整

- 使用真正的 SQLite 驱动或明确验证 `sql.js` 的并发与持久化边界。
- 前端从单一 HTML 脚本拆为 `api`、`store`、`router/view`、`features` 模块。
- 引入 schema migration，而不是启动时只做 `CREATE TABLE IF NOT EXISTS`。
- 用统一错误结构、请求日志和兼容性探测替代静默 `catch { return null; }`。
- Immich 集成建立 adapter：UI 只依赖 FamilyTimeFlow 的稳定 DTO，不感知 Immich 原始响应。
- API Key 只存在服务端；诊断接口必须脱敏并受本地管理保护。

### 7.3 建议的新核心接口

```text
GET    /api/bootstrap
GET    /api/household
PATCH  /api/household
GET    /api/members
POST   /api/members
GET    /api/members/:id/view
PATCH  /api/members/:id
DELETE /api/members/:id
PUT    /api/members/:id/immich-link
DELETE /api/members/:id/immich-link
GET    /api/members/:id/weeks/:weekId
GET    /api/memories/on-this-day
GET    /api/integrations/immich/status
PUT    /api/integrations/immich/config
```

## 8. 分阶段实施路线

### Stage 0：冻结与基线

- 保护当前未提交实验，不直接覆盖。
- 建立可重复的本地启动、fixture 数据和冒烟测试。
- 删除或封闭会暴露密钥的诊断路径。
- 记录 NAS 与 Immich 的实际运行版本。

验收：在不连接 Immich 的环境中可重复启动并得到一致结果。

### Stage 1：身份与启动内核

- 新 Household / Member / DevicePreference 模型。
- `/bootstrap` 单入口。
- 首次初始化、家庭首页、成员切换状态机。
- 迁移旧 users 数据并保留备份。

验收：刷新、快速连点切换、后端延迟、后端短暂失败均不会串用户或生成重复用户。

### Stage 2：核心产品界面

- 家庭首页。
- 个人页和固定语义的人生周格。
- 周详情与主倒计时。
- 设置中心。

验收：无 Immich 时产品仍然完整成立。

### Stage 3：Immich 兼容层

- 对照目标 Immich 版本验证 OpenAPI/API。
- 实现版本探测、人物关联、照片搜索、缩略图和那年今日 adapter。
- 缓存和限流；明确错误与降级状态。

验收：Immich 升级或暂时离线不会影响成员切换和核心时间视图。

### Stage 4：记忆体验

- 周格记忆密度。
- 周/日照片详情。
- 家庭那年今日卡片。
- 可选的本地事件与一句话记录。

## 9. 第一阶段验收测试矩阵

至少覆盖：

- 空数据库首次启动。
- 已有一个或多个成员启动。
- localStorage 中保存了不存在的成员 ID。
- 快速连续切换三个成员，旧请求晚于新请求返回。
- 创建成员请求超时后重试，不产生重复记录。
- Immich 未配置、离线、未授权、API 不兼容四种状态。
- 两个浏览器设备查看不同成员，互不改变对方当前视图。
- 后端重启后资料一致，数据库文件可备份与恢复。

## 10. 设计评审前需要确认的产品选择

这些选择不会阻挡 Stage 0，但会影响 Stage 2：

1. 默认首页更偏“客厅家庭屏”，还是直接进入上次查看的个人？本方案推荐家庭首页。
2. 是否需要在第一版加入一句话日记？本方案推荐先只支持事件/备注，不做完整日记。
3. 学业阶段是否继续自动推算？本方案推荐保留为可编辑模板，避免把年龄直接等同年级。
4. 是否希望未来接入家庭日历？本方案预留事件来源，但不在重构首阶段接入。

