# 首个审阅版本说明

## 版本目标

本版本把项目从不稳定的浏览器多用户原型收口为一个以后端数据库为准、Immich 可完全缺席的家庭时间应用基线。

## 已完成范围

- 单一 `/api/bootstrap` 启动决策，修复多用户初始化和设备切换竞速。
- 家庭首页、个人页面、成员创建、颜色、排序和带影响预览的删除。
- 家庭事件创建、编辑和二次确认删除。
- 家庭、成员和系统设置分区。
- 浏览器只保存当前成员 ID 与无害显示偏好，成员资料由后端管理。
- 数据库原子写入、启动备份、损坏保护与干净关停。
- 服务断线提示和页面内重试。
- 默认关闭诊断和 Immich；Immich 浏览器配置接口已退役，取消任意来源 CORS。
- Immich 3.x 只读人物 onboarding 已在 PR #3 合并，通过 Node 22 容器验证，
  并由 NAS mode-0600 secret 在生产启用。
- Immich 3.0.2 的照片元数据与缩略图读取已在生产做只读抽样验证；当前 Key
  仅有 `person.read`、`asset.read` 和 `asset.view`，不具备下载原图或写权限。
- 首个“往年今日”家庭回忆卡片已在独立服务端开关后实现，查询过去五年的
  同月同日照片，仅显示缩略图和只读预览；关闭时不发起回忆查询，也不影响
  人物 onboarding 或家庭核心功能。
- 首次页面会根据实际集成状态说明可从 Immich 选择家人，品牌链接保持在
  Family Time Flow 路径内，不再显示已过期的“尚未接入”文案。
- Tailwind CSS、daisyUI、GSAP 与 Flatpickr 已改为版本锁定的本地静态资源；
  测试会重建并比较产物，生产运行时不需要公网 CDN 或前端构建。
- 桌面与 390px 移动布局验收。

## 验证基线

- 前端静态契约：18 项。
- 后端隔离集成测试：23 项。
- Node.js 与部署 shell 脚本语法检查通过。
- `git diff --check` 通过。

运行命令：

```sh
npm test
```

## 建议提交分组

为了方便 GitHub 审阅，建议按以下顺序提交，而不是把所有内容压成一个难以回退的提交：

1. `docs: define product and migration baselines`
2. `feat: stabilize household bootstrap and member lifecycle`
3. `feat: add household UI and event management`
4. `fix: harden database persistence and recovery`
5. `security: disable diagnostics and Immich by default`
6. `test: add frontend contracts and backend integration coverage`

提交前应单独确认早期未跟踪实验文件 `admin.html` 与 `grid-canvas.html` 是否进入版本库。当前部署脚本不会发布它们。

## 已知边界

- 家庭 CRUD 暂无身份认证，只能位于可信家庭网络、VPN 或受保护反向代理后。
- 生产人物 onboarding 已启用，首位 Immich 关联成员已经由用户创建；其余
  家庭成员仍由用户在局域网页面中逐一确认。
- 照片时间线和按周悬停回忆仍不在本版本范围。“往年今日”需要生产显式设置
  `ENABLE_IMMICH_MEMORIES=1`，且仍不支持视频或原图下载。
- 前端资源已经随 release 提供；修改 Tailwind 类名或升级依赖时必须重新运行
  `npm run build:frontend`，否则静态资源一致性测试会失败。
- 当前前端仍是单文件 Vanilla JS；可维护性重构应作为后续独立阶段，不应阻塞本次稳定基线。

## 下一道人工确认点

上线后的人工步骤：

- 按需继续选择家庭成员，并补齐缺失出生日期；
- 验证多成员切换、家庭设置、事件保存和服务重启后的持久化；
- 两个实验 HTML 文件继续保持未跟踪且不进入 release。
