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
- 默认关闭诊断、Immich 和 Immich 管理能力；取消任意来源 CORS。
- 桌面与 390px 移动布局验收。

## 验证基线

- 前端静态契约：11 项。
- 后端隔离集成测试：14 项。
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
- Immich 尚未验证新版 API，也未写入新 Key。
- NAS 容器、卷、健康检查和反向代理尚未在本项目中实际修改或部署。
- 当前前端仍是单文件 Vanilla JS；可维护性重构应作为后续独立阶段，不应阻塞本次稳定基线。

## 下一道人工确认点

在创建提交前确认：

- 是否保留两个实验 HTML 文件进入 Git 历史；
- 是否允许在当前分支创建一组本地提交；
- NAS 项目准备好后，是否进入容器配置对照与试部署阶段。
