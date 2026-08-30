# 部署前检查清单

## 正式发布命令

生产发布由 NAS 基础设施仓库统一管理：

```sh
nas-deploy family-time-flow --ref <完整的40位提交SHA>
nas-deploy status
nas-deploy doctor
```

发布脚本会先运行本文件要求的测试，备份 `ftf.db`，再切换 release 并重建
`ftf_backend` 与共享前端。数据库、启动备份和运行配置保持在 release 外部。
本仓库的 WebDAV 脚本仅作为迁移期应急路径保留。

## 当前安全边界

FamilyTimeFlow 的成员、事件和家庭设置接口暂时没有登录鉴权。这符合家庭局域网内快速使用的产品选择，但意味着：

- 只能部署在受信任的家庭网络、VPN 或带访问控制的反向代理之后。
- 在增加身份认证前，不得把 `/family-time-flow/api/` 直接暴露到公共互联网。
- 当前 nginx 基线只允许 `192.168.0.0/16` 家庭局域网及 NAS 本机访问；Tailscale、Funnel 和 zConnect 默认拒绝。
- nginx 与后端应保持同源访问；后端不再向任意网页提供 CORS 授权。
- 实验诊断接口默认关闭。只有临时排障时才设置 `ENABLE_DIAGNOSTICS=1`，完成后立即关闭。
- Immich 人物 onboarding 已在生产启用。`IMMICH_URL`、`IMMICH_API_KEY` 与
  `ENABLE_IMMICH=1` 仅存在于 NAS 的 mode-0600 服务 secret 中；当前只授予
  `person.read`、`asset.read` 和 `asset.view`，用于人物资料、照片元数据搜索与
  缩略图显示，不授予原图下载或任何写权限。
- 浏览器配置 Immich 凭据的旧接口已退役；凭据只能在服务启动前由 NAS 安全注入。

## 数据与卷

- 将后端 `data/` 映射到 NAS 持久卷，确认容器重建不会删除 `ftf.db`。
- 将 `backups/` 保留在持久存储，并额外纳入 NAS 快照或异机备份。
- 确认容器用户对数据库目录可读写，数据库和临时文件权限不向其他用户开放。
- 部署前人工复制一份现有数据库；首次升级后检查家庭成员、事件和排序。

## 运行配置

- 后端默认端口为 `3000`，须与 nginx `proxy_pass` 及 NAS 容器映射一致。
- 建议初始值：

```env
PORT=3000
BACKUP_LIMIT=7
ENABLE_DIAGNOSTICS=0
ENABLE_IMMICH=1
ENABLE_IMMICH_MEMORIES=0
```

`ENABLE_IMMICH_MEMORIES` 默认保持 `0`。只有在 Immich 人物、资产搜索和
缩略图权限均通过只读验证后才设置为 `1`；关闭它不会影响人物 onboarding 或
家庭核心功能。

- 健康检查使用 `GET /api/health`，必须返回 `storage.ready: true`。
- 容器停止超时至少 5 秒，让后端能处理 `SIGTERM` 并干净关闭。

## 发布内容

- 正式前端由 `index.html` 和其 `assets/` 目录组成。CSS、GSAP 与
  Flatpickr 均为版本锁定的本地静态资源；`manifest.json` 记录版本与 SHA-256。
- 修改 Tailwind 类名或前端依赖后须执行 `npm run build:frontend`；`npm test`
  会通过 `npm run check:frontend-assets` 拒绝缺失或过期的生成资源。
- `admin.html` 与 `grid-canvas.html` 是早期实验文件，部署脚本已明确排除。
- 部署前运行根目录 `npm test`，所有测试通过后再同步文件。
- 部署后依次验证家庭首页、成员切换、设置保存、事件创建与服务重启恢复。

## 仍不在本阶段范围内的工作

- 不把新的 Immich Key 写入 Git、SQLite、浏览器或普通文档。
- 不启用 Immich 写权限，也不修改 Immich 人物或照片。
- 后续 Compose 或反向代理变化仍由 NAS 项目单独审阅和发布。
- 不对公网开放尚未鉴权的家庭 API。
