# 家庭人生时光机 - Product Requirement Document

## 1. Product Vision

**"每周都很重要" (Every week matters.)**

一个以家庭为首的时间与记忆仪表板，让时间的流逝变得具体可感，而非抽象概念。默认界面为中文，所有 UI 文案以中文呈现。

---

## 2. Problem Statement

Modern families struggle to maintain awareness of time at multiple scales simultaneously:

- **Macro**: Life is finite, but we rarely feel this viscerally
- **Meso**: Milestones and goals get lost in daily noise
- **Micro**: Each day is precious, yet often wasted unconsciously

Existing tools focus on single scales (calendars for days, bucket lists for years), creating fragmented awareness. FamilyTimeFlow unifies these perspectives into one interface.

---

## 3. Target Personas

### Primary Users

| Persona | Age | Scenario | Core Need |
|---------|-----|----------|-----------|
| Student（学生） | 14-22 | 管理学习截止日期和个人成长 | 将周视为具体单位；为考试/目标倒计时 |
| Worker（职场人） | 25-45 | 平衡职业里程碑与生活规划 | 保持时间预算意识；保持战略专注 |
| Family（家庭） | 30-60 | 保存回忆，追踪家庭里程碑 | 将"那年今日"回忆与当前生活视图连接 |

### Multi-Mode Design（多模式设计）
每种角色激活**预设主题**（颜色、强调色、色调），共享同一底层数据模型。通过顶部导航按钮即时切换模式。

---

## 4. Feature Scope

### 4.1 Macro 层 — "人生周格" (Life in Weeks)

**目标**：将生命和人生进度具体化，带来情感共鸣。

**设计**：
- 80 年寿命可视化为网格：**80 行 × 52 列 = 4,160 个格子**
- 每个格子 = **1 周**
- 颜色编码：
  - 已度过周：填充强调色
  - 当前周：脉冲发光
  - 未来周：柔和背景

**交互方式**：
- 悬停任意格子 → 提示框显示：
  - 周数和日期范围
  - 该周的照片（Immich 集成，Phase 3）
  - 个人笔记/回忆
- 点击格子 → 未来扩展：日记条目

**可配置项**：
- 出生日期输入
- 预期寿命（默认 80，范围 1-120）

---

### 4.2 Meso 层 — "战略倒计时" (Strategic Countdown)

**目标**：为即将到来的里程碑创造紧迫感和专注力。

**设计**：
- 大号倒计时显示，指向用户自定义目标日期
- 格式：`DD:HH:MM:SS`（天:小时:分钟:秒）
- 通过 `requestAnimationFrame` 实现流畅动画（60Hz）
- 通过日期选择器设置（含时间）

**使用场景**：
- Student（学生）：考试日期、申请截止
- Worker（职场人）：项目启动、职业转型
- Family（家庭）：纪念日、孩子里程碑

---

### 4.3 Micro 层 — "今日时间账户" (Today's Time Account)

**目标**：让用户意识到今天的时间分配情况。

**设计**：
- 环形进度条显示当日已过百分比
- 通过 `requestAnimationFrame` 实时更新
- 拆分视图：
  - 学习时间（模拟数据，未来：实际追踪）
  - 爱好时间（模拟数据）
- 视觉隐喻："时间银行账户"，每日预算

**未来增强**：
- 实际时间追踪集成
- 自定义分类预算

---

### 4.4 "那年今日" (On This Day) 跑马灯

**目标**：呈现往年同一天的回忆。

**设计**：
- 底部跑马灯条
- 从照片库加载照片元数据
- Phase 1：静态占位符
- Phase 3：Immich API 集成

**显示**：
- "📸 那年今日 (7月10日)：2022年3张照片，2019年1张"

---

### 4.5 配置抽屉 (Configuration Drawer)

**目标**：将所有用户偏好集中在一个可访问的面板中。

**入口**：顶部导航中的齿轮图标 (⚙️)

**字段**：
- 显示名称
- 出生日期
- 预期寿命
- 倒计时目标日期
- 身份标签（学生/职场人/家庭）
- Immich 同步开关

**持久化**：`localStorage`，带版本号键（`familyTimeFlow_state_v1`）

**操作**：
- 保存：持久化并刷新界面
- 重置：清除存储，恢复默认

---

## 5. 主题系统 (Theme System)

### 三种预设模式

| 模式 | 背景 | 强调色 | 使用场景 |
|------|-----------|--------|----------|
| **Student（学生）** | `#F0F9FF` → `#E0F2FE` 渐变 | `#3B82F6` 蓝色 | 学业专注 |
| **Worker（职场人）** | `#FFFBEB` → `#FEF3C7` 渐变 | `#F59E0B` 琥珀色 | 职场清晰 |
| **Family（家庭）** | `#FFF7ED` → `#FFEDD5` 渐变 | `#F97316` 橙色 | 温暖与回忆 |

### 过渡行为
- **700ms** 所有颜色属性的平滑过渡
- CSS 自定义属性（`--accent-color`、`--surface-color` 等）实现动态主题
- 主题切换时 GSAP 透明度脉冲动画

---

## 6. 技术架构 (Technical Architecture)

### 前端技术栈
- **Vanilla JavaScript**（无框架开销）
- **TailwindCSS Play CDN**（JIT 模式，零构建步骤）
- **daisyUI 4.12.14**（通过 CDN 引入的组件库）
- **GSAP 3.12.5**（动画引擎）
- **Flatpickr**（日期/时间选择器）

### 设计原则
1. **零构建环境**：单个 HTML 文件，浏览器打开即可使用
2. **本地优先**：所有状态存储在 `localStorage`，无需后端
3. **渐进增强**：核心功能离线可用，Immich 同步为可选
4. **60Hz 流畅度**：所有时钟/环形进度条使用 `requestAnimationFrame`

### 性能考量
- 人生网格：4,160 个 DOM 节点（现代浏览器可轻松处理）
- GSAP 交错动画：总入场延迟上限 1.5s
- 主题过渡：通过 CSS transforms 实现 GPU 加速

---

## 7. 阶段路线图 (Phase Roadmap)

### Phase 1：核心 MVP（当前）
- [x] "人生周格"网格，含出生日期配置
- [x] "战略倒计时"，含目标日期选择器
- [x] "今日时间账户"，带动画环形进度条
- [x] 主题切换器（学生/职场人/家庭）
- [x] 配置抽屉，localStorage 持久化
- [x] "那年今日"跑马灯（占位符）

### Phase 2：体验增强
- [ ] 点击人生网格 → 日记条目弹窗
- [ ] 实际时间追踪（开始/停止计时器）
- [ ] 自定义时间预算分类
- [ ] 导出/导入状态（JSON 备份）
- [ ] 响应式移动端优化
- [ ] 键盘快捷键

### Phase 3：Immich 集成
- [ ] Immich API 认证（x-api-key）
- [ ] 使用日期范围过滤器查询 `/api/assets`
- [ ] 悬停提示 → 显示该周真实照片
- [ ] 人脸识别 → 将人物关联到人生网格
- [ ] "那年今日"跑马灯显示真实照片元数据
- [ ] 批量回忆标记

### Phase 4：多用户与同步
- [ ] 后端 API（Node.js + SQLite）
- [ ] 用户账户与认证
- [ ] 家庭共享（一个账户下多个角色）
- [ ] 跨设备云同步
- [ ] Immich 相册嵌入

---

## 8. 成功指标 (Success Metrics)

### 定量指标
- **参与度**：每日活跃使用 > 3 次/周
- **留存率**：30 天留存 > 60%
- **性能**：所有动画 60fps，UI 响应 < 100ms

### 定性指标
- 用户反馈"时间意识增强"
- 家庭将"那年今日"作为话题引子
- 学生通过倒计时的紧迫感减少拖延

---

## 9. 待定问题 (Open Questions)

1. **Immich 认证**：是否应支持多个 Immich 实例（如个人 + 家庭）？
2. **数据可移植性**：导出格式？JSON、CSV 还是截图？
3. **协作**：多个家庭成员应共享一个人生网格，还是各自独立视图？
4. **离线模式**：使用 Service Worker 实现完整离线能力？
5. **隐私**：默认所有数据本地存储，但可选云同步——加密策略？

---

## 10. 附录 (Appendix)

### 文件结构
```
family-time-flow/
├── web/html/family-time-flow/
│   └── index.html              # 单页应用（所有代码内联）
├── docs/
│   └── PRD.md                  # 本文档
├── deploy/
│   └── deploy.sh               # NAS 部署脚本
└── README.md                   # 项目概述
```

### 关键设计决策

| 决策 | 理由 |
|----------|-----------|
| 单个 HTML 文件 | 零构建摩擦，部署便捷 |
| localStorage 存储 | MVP 阶段无需后端 |
| 4,160 格网格 | 80 年 × 52 周在心理上具有共鸣感 |
| requestAnimationFrame | 流畅 60Hz 更新，无电池耗损 |
| 主题预设（非自定义） | 精心策划的情感影响，更快上手 |
| 中文默认界面 | 目标用户为中文家庭，降低使用门槛 |
| 倒计时格式 DD:HH:MM:SS | 更直观的时间感知，适合天/小时级倒计时 |

---

*文档版本: 2.0*  
*最后更新: 2026-07-10*
