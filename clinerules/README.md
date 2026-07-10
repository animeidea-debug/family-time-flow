# Cline Rules — 共享行为规则模板

## 用途

此目录是所有项目的 Cline 行为规则的"单一真源"（Single Source of Truth）。

- `global.template` — 共享的 Cline 行为规则，适用于所有从 infra-template 生成的项目
- `env.template` — 环境配置模板（指向根目录的 `env.template`）

## 使用方式

### 项目首次设置

将共享规则复制到项目根目录的 `.clinerules`：

```sh
# 从本 repo 复制共享规则
cp clinerules/global.template ../your-project/.clinerules

# 或追加到已有 .clinerules 前部
cat clinerules/global.template > ../your-project/.clinerules.tmp
cat ../your-project/.clinerules >> ../your-project/.clinerules.tmp
mv ../your-project/.clinerules.tmp ../your-project/.clinerules
```

### 更新规则

当 `global.template` 变更后，在所有依赖项目中同步：

```sh
# 在 infra-template 中修改后
git commit -m "update clinerules: ..."

# 进入各项目，更新 .clinerules 的共享段
cd ../emma-focus
# 手动更新 .clinerules 中 ## [shared] 后面的内容
```

### 项目特定规则

各项目 `docs/progress.md` 记录使用 `## [project]` 标记，与 `## [shared]` 分开：

```
## [shared]
（来自 clinerules/global.template，通过 cp 同步）

## [project]
（本项目特有的行为规则，不在此文件中）