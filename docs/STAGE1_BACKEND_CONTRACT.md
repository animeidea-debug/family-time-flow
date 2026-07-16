# Stage 1 后端启动契约

> 日期：2026-07-17  
> 状态：后端基线已实现；现有前端已切换启动入口，视觉层仍为过渡版本。

## 目标

用一个无副作用请求决定应用启动状态，替代前端并行调用 health、sync 和 Immich 后再猜测当前用户的流程。

## `GET /api/bootstrap`

可选查询参数：

- `activeMemberId`：本设备上次查看的 Member ID。

返回示例：

```json
{
  "apiVersion": "1",
  "schemaVersion": "0.2.0",
  "state": "ready",
  "household": {
    "id": "default",
    "name": "家庭时光",
    "defaultView": "household"
  },
  "members": [
    {
      "id": "1",
      "name": "示例成员",
      "birthDate": "2014-01-17",
      "expectedAge": 80,
      "profileTemplate": "student",
      "schoolSystem": "shanghai",
      "targetDate": null,
      "color": null,
      "immich": {
        "linked": true,
        "personId": "person-uuid",
        "syncEnabled": true
      }
    }
  ],
  "selectedMemberId": "1",
  "integrations": {
    "immich": {
      "configured": true,
      "url": "http://immich-host",
      "status": "unchecked"
    }
  }
}
```

## 状态规则

- 无 Member：`state = "empty"`。
- 有 Member：`state = "ready"`。
- `activeMemberId` 存在且有效：原样返回到 `selectedMemberId`。
- `activeMemberId` 缺失或已经失效：`selectedMemberId = null`，由前端进入家庭首页。
- 服务端绝不根据名字、Profile 模板或 Immich Person 猜测当前成员。
- bootstrap 不连接 Immich，只报告配置能力，因此不会因 Immich 离线拖慢或阻断应用启动。
- 返回数据不包含 Immich API Key。

## Member DTO 边界

当前数据库仍保留旧 `users` 表，以降低接管初期的数据迁移风险。`toMemberDto()` 是新业务模型与旧存储结构之间的兼容层：

- 新前端只使用 camelCase Member DTO。
- `identity_tag` 对外改名为 `profileTemplate`，明确它不是身份主键。
- Immich 关联被包装为独立对象，不再与 Member 身份混为一体。
- ID 对外统一为字符串，避免浏览器和未来 UUID 迁移时发生类型漂移。

## 重复初始化保护

旧 `POST /api/users` 暂时保留，但增加：

- `Idempotency-Key` 请求头。同一个 key 重试时返回原记录，不重复创建。
- 同一个 `immich_person_id` 已关联时返回 HTTP 409。
- 新增 `creation_key` 唯一索引，保护服务重启后的重复请求。

前端接入时，每次初始化创建操作必须生成一次 key，并在该操作的所有重试中复用。

## 已覆盖测试

1. 空数据库 bootstrap。
2. 有效 Member ID 恢复。
3. 失效 Member ID 回到家庭首页。
4. Member DTO 字段和 Immich 未关联状态。
5. 幂等创建不产生重复 Member。
6. Immich Person 重复关联返回冲突。
7. bootstrap、sync、debug 不泄露 API Key。

## 已完成的前端启动迁移

- 页面启动只调用 `/bootstrap` 决定空家庭、成员选择或成员恢复。
- 移除了启动阶段独立 health、sync 和 Immich 检查造成的竞速。
- 当前 Member ID 使用独立的 `ACTIVE_MEMBER_KEY` 保存。
- 切换 Member 时不再把完整 Profile 写入 localStorage。
- 新建 Member 使用 `Idempotency-Key`。
- 首次初始化和添加成员不再自动访问 Immich。
- 移除了前端硬编码的 Immich API Key 和自动写入 Immich 配置的路径。

旧 `syncFromApi()` 和部分 localStorage Profile 代码仍暂时存在，供尚未迁移的设置交互使用，但不再参与应用启动决策。Stage 2 将随新页面状态层一起移除。

## 安全后续

旧前端中的 Immich API Key 曾在提交 `2fd9053` 进入 Git 历史。即使当前工作区已删除，该 Key 仍应视为已经泄露。进入 Immich 联调前必须在 Immich 中撤销旧 Key、创建权限最小化的新 Key，并且只存储在服务端配置中。
