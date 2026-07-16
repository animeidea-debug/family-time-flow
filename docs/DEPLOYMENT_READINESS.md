# 部署前检查清单

## 当前安全边界

FamilyTimeFlow 的成员、事件和家庭设置接口暂时没有登录鉴权。这符合家庭局域网内快速使用的产品选择，但意味着：

- 只能部署在受信任的家庭网络、VPN 或带访问控制的反向代理之后。
- 在增加身份认证前，不得把 `/family-time-flow/api/` 直接暴露到公共互联网。
- nginx 与后端应保持同源访问；后端不再向任意网页提供 CORS 授权。
- 实验诊断接口默认关闭。只有临时排障时才设置 `ENABLE_DIAGNOSTICS=1`，完成后立即关闭。
- Immich 全部能力默认关闭。只有取得确认并完成只读 Key 配置后才设置 `ENABLE_IMMICH=1`。
- `ENABLE_IMMICH_ADMIN` 默认必须保持 `0`；它允许修改服务端 Immich 凭据，不能在无鉴权的公网环境开启。

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
ENABLE_IMMICH=0
ENABLE_IMMICH_ADMIN=0
```

- 健康检查使用 `GET /api/health`，必须返回 `storage.ready: true`。
- 容器停止超时至少 5 秒，让后端能处理 `SIGTERM` 并干净关闭。

## 发布内容

- 正式前端只有 `index.html`。
- `admin.html` 与 `grid-canvas.html` 是早期实验文件，部署脚本已明确排除。
- 部署前运行根目录 `npm test`，所有测试通过后再同步文件。
- 部署后依次验证家庭首页、成员切换、设置保存、事件创建与服务重启恢复。

## 尚未授权的工作

- 不启用或探测真实 Immich。
- 不写入新的 Immich Key。
- 不修改 NAS 项目的容器或反向代理配置。
- 不对公网开放尚未鉴权的家庭 API。
