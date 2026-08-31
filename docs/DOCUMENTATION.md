---
title: "Documentation System — LLM Maintenance Rules"
type: concept
status: accepted
phase: N/A
updated: 2026-08-31
summary: "本仓库 LLM 文档维护规则；结构见 DOCS-SPEC.md"
---

# 文档系统维护规则

> **受众**：参与本仓库的 LLM / AI 助手。  
> **结构规范**：[`DOCS-SPEC.md`](DOCS-SPEC.md) — 本文件只写 **维护行为**。

---

## 1. 目录架构（摘要）

| 区域 | 路径 | 职责 |
|:-----|:-----|:-----|
| 知识库 | `docs/` | 相对稳定的设计 spec 与导航 |
| 产品需求 | `docs/product/` | Agent IDE 产品愿景、`PRD-NNN`、追踪；知识库的产品层 |
| 就近 SSOT | `src/vs/sessions/*.md` 等既有规格 | 不迁走、不复制正文 |
| 行动层 | `dev/` | status、plan、ADR、iteration |
| 归档 | `dev/archive/` | 过时文档只移入、不删除 |
| 根指令 | `AGENTS.md`、`.github/copilot-instructions.md` | 项目向导（豁免 docs frontmatter） |

**五类职责**：`docs/product/` 产品需求 · `docs/modules/` 分层导航 · `docs/systems/` 跨层协作 · `docs/architecture/` 全景横切 · `dev/` 行动层。

**LLM 新会话必读顺序**：`AGENTS.md` → 本文件 → `dev/progress/status.md`

### 核心原则

| 原则 | 说明 |
|------|------|
| **稳定与动态分离** | `docs/` = 知识；`dev/` = 行动 |
| **单一事实来源** | 每个概念只在一份文件定义；用链接引用 |
| **决策可追溯** | 架构决策走 ADR，与阶段日志隔离 |
| **只归档，不删除** | 过时文档移入 `dev/archive/` |
| **不污染上游** | 不在 `src/vs/` 新建文档树；不给上游 `.md` 加 frontmatter |
| **AGENTS.md 优先于本文件结构描述** | 编码规范以 `.github/copilot-instructions.md` 为准 |

---

## 2. Frontmatter

`docs/` 与 `dev/` 下每个新建 `.md` 必须以 YAML frontmatter 开头：

```yaml
---
title: "人类可读的标题"
type: architecture | concept | decision | reference | roadmap | plan | progress | demand | index | guide | spec | overview
status: draft | review | accepted | implemented | completed | archived | active | proposed | in_progress | deprecated
phase: N/A
updated: YYYY-MM-DD
summary: "一行描述"
---
```

豁免：`AGENTS.md`、根 `README.md`、`SKILL.md`。存量上游文档不补 frontmatter。

每次编辑必须更新 `updated`。

---

## 3. LLM 维护规则

### 规则 1：新会话三步走

1. `AGENTS.md`
2. 本文件
3. `dev/progress/status.md`

### 规则 2：编码前查阅相关文档

- `docs/modules/<layer>/INDEX.md` 与 `docs/systems/<system>/`
- `dev/decisions/` 是否已有 ADR
- 就近 SSOT（如 `src/vs/sessions/`）

### 规则 3：编码后更新进度

更新 `dev/progress/status.md` 的 Current Session / Completed。有 roadmap 则勾选 checkbox。

### 规则 3a：提交前文档门禁

**禁止**「代码先 merge、文档下次再补」。

| 层级 | 位置 | 何时更新 |
|------|------|----------|
| 行动层 | `dev/` | 实施 commit 前必做（trivial bugfix 除外） |
| 知识层 | `docs/` | 用户可见行为 / 对外契约 / 分层规则变更时 |

决策树：

```
本次 commit 含代码？
├── 否 → 更新改过的 .md 的 updated；结构变更则更新索引并跑健康检查
└── 是
    ├── trivial bugfix？ → 可仅提交代码
    └── 否 → 行动层必更新；再判断知识层
        ├── 行为 / API / 分层契约变了？ → 更新对应 spec
        ├── 仅内部 refactor / 测试？ → 行动层通常足够
        └── 文档目录增删移？ → 更新 INDEX + check-docs-health.py
```

实施 commit 最小清单：

- [ ] `dev/progress/status.md` 已写本次摘要
- [ ] `status.md` 总行数 ≤ **200**
- [ ] 活跃 roadmap checkbox 已更新（如有）
- [ ] 改过的 spec / plan 的 `updated` / `status` 已对齐
- [ ] 结构变更后已运行 `python3 scripts/check-docs-health.py`

### 规则 3b：提交时保留其他未提交改动

仅 `git add <path…>` 暂存本次主题。禁止为「干净工作区」restore / stash / reset 其他 WIP。存在无关 WIP 时禁止 `git add -A`。

### 规则 4：ADR vs 阶段日志

**ADR**（`dev/decisions/`）：新架构概念、两方案择一、跨层契约、推翻已有 ADR。  
**阶段日志**（`dev/iterations/`）：实现过程、踩坑、测试策略、局部 UI/构建变更。

### 规则 5：创建 ADR

命名：`dev/decisions/NNN-short-name.md`。accepted 后不改正文；推翻则写新 ADR 并引用旧文。

### 规则 7：过时 → 归档

移入 `dev/archive/`，更新索引，`status: archived`。

### 规则 9：始终使用 Frontmatter

新建 `docs/` / `dev/` 文件必须完整 frontmatter。存量上游文件不强制。

### 规则 10：不重复

先搜已有文档与就近 SSOT，用链接引用。

### 规则 10a：产品需求变更顺序

用户可见产品行为变化按此顺序，禁止倒过来：

1. 更新 `docs/product/requirements.md` 对应 `PRD-NNN`（必要时先改 `vision.md`）
2. 更新 `docs/product/traceability.md`
3. 更新相关 `docs/systems/` / `docs/architecture/` / B2 实现真相
4. 更新或新增 `dev/plans/` 实施方案

需求 ID 格式为 `PRD-NNN`（三位数字，首批 `PRD-001` 起）。状态为 `proposed` | `accepted` | `implemented` | `blocked`。没有验证证据不得标 `implemented`。

权威边界：本仓 `docs/product/` 是 Agent IDE 产品需求 SSOT。UniverseAgentDesktop 相关文档只能作为 `source` 或历史链接。不得通过整篇外仓链接隐式继承规范。外仓冲突在 `traceability.md` 留出处，不静默覆盖。

产品层 frontmatter type：`INDEX.md` 用 `index`，`vision.md` 用 `concept`，`requirements.md` 用 `demand`，`traceability.md` 用 `reference`。

### 规则 11：索引随结构变更

更新 `docs/INDEX.md`、相关模块/系统 INDEX、`dev/*/INDEX.md`，然后跑健康检查。

### 规则 12：不要额外创建 README

除非用户明确要求。已有的 `docs/README.md`、`dev/README.md` 保留。

### 规则 13：方案与实施分离

方案 commit 与实施 commit 分开；各自提交前满足规则 3a，提交时满足 3b。禁止跳过方案直接编码（trivial bugfix 除外）。方案正文写完后须先满足 **规则 16**，再进入实施。

### 规则 16：方案写完必须经 Opus 5.0 审查再改稿

对 `dev/plans/` 新方案或实质改写、以及 `docs/reference/code-oss-b2/` 页面接入 / 映射方案：

1. **写完即审**：同一会话内派只读 reviewer（Cursor Task：`generalPurpose` + **`claude-opus-5-thinking-high`** = Opus 5.0）。一篇方案一个 reviewer；多篇并行。
2. Reviewer **不改文件**。产出 Strengths / Critical / Important / Minor / Assessment。
3. 父 agent **核验后改稿**：Critical 与 Important 当轮改入方案；与 HEAD 或已拍板合同冲突的意见写明不采纳原因。Minor 可记父方案，不阻塞。
4. 未走本门禁不得把方案标成可签收完成，也不得开实施切片。

Cursor 侧提醒见 `.cursor/rules/scheme-opus-review.mdc`。流程见 [multi-agent-design-workflow](guides/multi-agent-design-workflow.md)。

### 规则 14：会话结束自检

对照规则 3a 清单。

### 规则 15：并行看板

10+ 文件、多 Agent、可并行子任务、或跨 2+ 会话时，维护 `dev/parallel/active/<topic>.md`。

---

## 4. 检索提示

```
了解产品目标 → docs/product/INDEX.md
了解分层     → docs/modules/<layer>/INDEX.md
了解跨层协作 → docs/systems/<system>/INDEX.md
了解决策     → dev/decisions/
开始任务     → dev/progress/status.md → 相关 plan / spec
检查健康     → python3 scripts/check-docs-health.py
```

---

## 5. 速查

| 我想... | 去哪里 |
|:--------|:-------|
| 项目全貌 | `AGENTS.md` |
| 产品需求 | docs/product/INDEX.md |
| 文档规则 | 本文件 |
| 当前状态 | `dev/progress/status.md` |
| 分层设计 | `docs/modules/<layer>/INDEX.md` |
| 架构决策 | `dev/decisions/` |
| 开发计划 | `dev/plans/` |
| 健康检查 | `scripts/check-docs-health.py` |
