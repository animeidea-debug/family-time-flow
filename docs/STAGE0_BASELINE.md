# Stage 0 接管基线

> 日期：2026-07-17  
> 范围：仅本地代码与隔离临时数据库；未部署 NAS，未改动真实数据。

## 已确认的工作区状态

接管前已有以下 Cline 遗留的未提交内容，继续保留：

- `web/backend/family-time-flow/server.js`：新增管理诊断接口。
- `web/html/family-time-flow/index.html`：人生周格缩放/重排实验。
- `web/html/family-time-flow/admin.html`：管理页面实验。
- `web/html/family-time-flow/grid-canvas.html`：Canvas 周格实验。

本阶段没有提交、stash、重置或覆盖这些内容。

## 本阶段发现并修复

### 1. 配置密钥泄露

原 `/api/sync` 和新 `/api/debug` 都会把 `app_config` 原样发送给浏览器，其中包括 `immich_api_key`。

处理：

- 新增统一的公开配置投影。
- API Key 永远不返回，只返回 `immich_api_key_configured: true|false`。
- `/sync` 与 `/debug` 共用相同脱敏逻辑。

### 2. 创建记录后无法可靠取得 ID

原 `run()` 在执行 INSERT 后先调用 `db.export()` 持久化，再通过 `last_insert_rowid()` 查询 ID。实际测试表明，`sql.js` 导出后该连接元数据不再可靠，创建成员接口可能返回 `null`。

处理：

- INSERT 后、数据库导出前捕获 ID。
- 用户和事件创建接口使用捕获的 ID 查询新记录。

这一问题会直接影响首次初始化和后续成员切换，是现有不稳定现象的重要来源之一。

## 新增本地测试基线

位置：`web/backend/family-time-flow/test/smoke.test.js`

运行：

```sh
cd web/backend/family-time-flow
npm test
```

测试始终使用系统临时目录中的独立数据库，不连接 NAS 数据库，也不要求 Immich 在线。

当前覆盖：

1. 干净数据库可以启动并返回空成员列表。
2. 成员可以创建、返回有效 ID 并从数据库读回。
3. Immich API Key 不会通过 `/sync` 或 `/debug` 返回。

验证结果：3 passed, 0 failed。

## 尚未处理的风险

- `/api/immich/config` 等管理写接口仍无访问控制。
- `/api/debug` 虽已脱敏，仍会返回全部成员资料；后续应移入受保护诊断能力。
- 现有远程 E2E 默认指向 NAS，并会创建测试用户，不应作为本地测试运行。
- 前端仍有 localStorage、后端 users 和 Immich people 三套身份混用。
- 应用启动仍存在 health、sync、Immich 请求竞速。
- `sql.js` 的多请求写入和异常断电语义尚未经过压力与恢复测试。
- Immich 目标升级版本及接口差异尚未在真实环境中确认。

## 下一阶段入口

Stage 1 从后端只读 `/bootstrap` 契约和 Household / Member 模型开始。先用测试定义启动状态，再逐步替换前端初始化逻辑，避免直接重写现有主页面。
