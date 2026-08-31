---
title: "软件架构文档系统设计规范"
type: concept
status: accepted
phase: N/A
updated: 2026-08-31
summary: "基于 Git + Markdown 的文档系统规范：结构、模块归属、人工索引与健康检查；适配 VS Code 分层而非 Gradle 多模块"
---

# 软件架构文档系统设计规范

> **版本**：1.1  
> **更新日期**：2026-08-31  
> **适用范围**：本仓库（Code - OSS / VS Code）的本地架构与 Agent 协作文档  
> **原则**：文档即代码、单一事实源、与仓库同生命周期  
> **LLM 维护规则**（commit 门禁、frontmatter、ADR vs iteration）：[`DOCUMENTATION.md`](DOCUMENTATION.md) — 本文件只写 **结构与模板**，不重复行为规则。

---

## 1. 引言

### 1.1 背景

本规范从 UniverseAgent 的文档系统移植而来，按 VS Code 的分层单体做了适配：没有 Gradle 模块一对一映射，而是以 `src/vs/` 分层 + 跨层系统为文档单元。上游 VS Code 用户手册仍在 wiki / vscode-docs；本仓 Agent IDE 产品需求在 `docs/product/`；`docs/architecture|systems|modules` 仍是**实现真相**与本地开发过程。

### 1.2 核心理念

- **单一事实源**：每个设计元素只有一个权威文件。已有就近规格（例如 `src/vs/sessions/*.md`）保持 SSOT，`docs/` 只做导航，不复制正文。
- **文档即代码**：Markdown + Mermaid，与代码一起评审。
- **内容就近，索引集中**：跨层协作写在 `docs/systems/`；分层导航写在 `docs/modules/`。**不在 `src/vs/` 下新建文档树**，避免与上游合并冲突。
- **不污染上游 Markdown**：`src/`、`extensions/`、`test/` 里既有 `.md` 豁免 frontmatter 与健康检查扫描。
- **轻量自动化**：只读健康检查，不覆写人工索引。

---

## 2. 文档分类

| 分类 | 说明 | 典型文档 |
|------|------|----------|
| **顶层设计** | 仓库根指令与概览 | `README.md`、`AGENTS.md`、`.github/copilot-instructions.md` |
| **产品需求** | 为什么做、给谁用、怎样算成功 | `docs/product/` |
| **系统级文档** | 跨层协作与运行时 | `docs/systems/`、`docs/architecture/` |
| **分层/模块文档** | 单层职责与入口 | `docs/modules/<layer>/` |
| **辅助指南** | 写作与上手 | `docs/guides/`、`docs/glossary.md` |
| **行动层** | 开发过程，不属于知识库 | `dev/` |

---

## 3. 目录结构

```
README.md                          # 上游产品介绍（豁免 frontmatter）
AGENTS.md                          # Agent 开发向导（豁免 frontmatter）
.github/copilot-instructions.md    # 编码/校验约定（上游）

docs/
├── README.md                      # 文档系统介绍
├── product/                       # 产品需求 SSOT
│   ├── INDEX.md
│   ├── vision.md
│   ├── requirements.md
│   └── traceability.md
├── INDEX.md                       # 全局索引（人工维护）
├── DOCS-SPEC.md                   # 本文件
├── DOCUMENTATION.md               # LLM 维护规则
├── glossary.md                    # 术语表
├── architecture/
│   ├── overview.md                # 系统全景、分层图
│   └── cross-cutting/             # 横切：分层规则、测试、校验
├── modules/                       # 分层导航（不写大段设计正文）
│   ├── base/INDEX.md
│   ├── platform/INDEX.md
│   ├── editor/INDEX.md
│   ├── workbench/INDEX.md
│   ├── sessions/INDEX.md
│   ├── code/INDEX.md
│   ├── server/INDEX.md
│   ├── chat/INDEX.md              # workbench/contrib/chat（虚拟模块）
│   └── workbench-api/INDEX.md     # workbench/api（虚拟模块）
├── systems/                       # 跨层系统文档
│   ├── editor/
│   ├── workbench/
│   ├── sessions/
│   ├── chat/
│   ├── extension-api/
│   └── processes/
└── guides/

dev/
├── README.md
├── progress/                      # status.md ≤ 200 行
├── decisions/                     # ADR
├── plans/
├── iterations/
├── roadmap/active|archive
├── parallel/active|archive
└── archive/                       # 只移入，不删除
```

### 3.1 VS Code 分层 ↔ 文档模块

| 文档模块 | 源码根 | 说明 |
|----------|--------|------|
| base | `src/vs/base/` | 无服务依赖的工具与 UI 积木 |
| platform | `src/vs/platform/` | DI 与跨层基础服务 |
| editor | `src/vs/editor/` | Monaco 核心 |
| workbench | `src/vs/workbench/` | 工作台框架、services、contrib |
| sessions | `src/vs/sessions/` | Agents Window，可依赖 workbench；反向禁止 |
| code | `src/vs/code/` | Electron 桌面入口 |
| server | `src/vs/server/` | 远程开发服务端入口 |
| chat | `src/vs/workbench/contrib/chat/` | 虚拟模块（contrib，不是独立层） |
| workbench-api | `src/vs/workbench/api/` | Extension Host / `vscode.d.ts` 实现 |

### 3.2 关键约定

> **禁止在 `src/vs/<layer>/docs/` 新建文档树。** 分层设计写在 `docs/modules/<layer>/` 与 `docs/systems/`。  
> 既有就近规格（`src/vs/sessions/LAYERS.md` 等）继续当 SSOT，模块 INDEX 必须链过去。

> **README.md vs INDEX.md**  
> - 上游/模块介绍仍可能在源码旁或仓库根 `README.md`  
> - `docs/modules/<m>/INDEX.md` 是导航入口，不承载大段设计正文

> **五类职责**  
> - `docs/product/` — 产品需求（为什么、给谁、怎样算成功）  
> - `docs/modules/` — 分层导航  
> - `docs/systems/` — 跨层协作  
> - `docs/architecture/` — 全景与横切  
> - `dev/` — 行动层（plan / ADR / status）

---

## 4. 核心模板

### 4.1 模块索引：`docs/modules/<module>/INDEX.md`

```markdown
---
title: "<模块> 索引"
type: index
status: accepted
phase: N/A
updated: YYYY-MM-DD
summary: "一句话"
---

# <模块> 索引

## 模块信息
- **源码**: `src/vs/<path>/`
- **职责**: ...
- **依赖方向**: 只能依赖更低层

## 关键入口
| 入口 | 说明 |
|------|------|

## 所属系统
| 系统 | 链接 |
|------|------|

## 相关文档
```

### 4.2 系统文档：`docs/systems/<system>/INDEX.md`

```markdown
---
title: "<系统> 索引"
type: index
status: accepted
phase: N/A
updated: YYYY-MM-DD
summary: "一句话"
---

# <系统>

## 涉及分层
- ...

## 设计目标
...

## 模块协作
| 分层 | 职责 | 关键符号 |
|------|------|----------|

## 相关文档
```

### 4.3 ADR：`dev/decisions/NNN-<topic>.md`

所有架构决策统一放在 `dev/decisions/`。状态不接受「提议中」作为长期态；新 ADR 用 `proposed`，落地后改为 `accepted`。

### 4.4 产品需求：docs/product/

INDEX.md 只导航，frontmatter type 为 index。vision.md 只写用户、问题、价值、原则、范围，type 为 concept。requirements.md 用稳定 ID，type 为 demand。traceability.md 只做追踪，type 为 reference。每条需求包含：状态（proposed / accepted / implemented / blocked）、用户价值、用户可观察陈述、产品验收标准、依赖或未决。

traceability.md 只维护 PRD-ID → 产品状态 → 系统/架构规格 → 实施方案 → 测试或验证证据。没有证据写「待验证」，不把 implemented 当成验证结论。禁止在产品文件里写类名、文件切片、排期。

需求条目示例：

    ### PRD-NNN 短标题
    - 状态：proposed | accepted | implemented | blocked
    - 用户价值：……
    - 用户可观察陈述：……
    - 产品验收标准：……
    - 依赖或未决：……

---

## 5. 索引维护

- INDEX 是导航：链接、表格、一句话上下文
- 结构变更后手动更新相关 INDEX，再跑 `python3 scripts/check-docs-health.py`
- 扫描范围仅 `docs/`、`dev/` 与根指令文件；不扫描 `src/**/*.md`

### 5.1 索引更新触发条件

- 新增/删除/重命名分层或虚拟模块
- 系统文档目录变更
- `docs/architecture/` 或 `dev/decisions/` 入口变更
- `docs/product/` 增删或产品入口变更

---

## 6. 健康检查

```bash
python3 scripts/check-docs-health.py
python3 scripts/check-docs-health.py --format json
python3 scripts/check-docs-health.py --strict-frontmatter
python3 scripts/check-docs-health.py --strict-links
```

检查：必备入口、声明的模块 INDEX、`status.md` 行数、frontmatter、本地文档断链。链接检查只校验文档目标（`.md` / `.html` / 无扩展名路径），源码深链不计入。

豁免 frontmatter：`AGENTS.md`、根 `README.md`、以及名为 `SKILL.md` 的文件。

---

## 7. 生命周期

1. 方案 → `dev/plans/`；决策 → `dev/decisions/`
2. 实现时保持行动层同步（见 DOCUMENTATION 规则 3a）
3. 行为/契约变更后同步知识层 `docs/`
4. 过时文档移入 `dev/archive/`，不删除

---

## 8. 附录：分类到目录

| 分类 | 位置 |
|------|------|
| 项目介绍 | `README.md` |
| Agent 向导 | `AGENTS.md` |
| 编码约定 | `.github/copilot-instructions.md` |
| 产品需求 | `docs/product/` |
| 系统概览 | `docs/architecture/overview.md` |
| ADR | `dev/decisions/` |
| 分层索引 | `docs/modules/<layer>/INDEX.md` |
| 系统文档 | `docs/systems/<system>/` |
| 指南 | `docs/guides/` |
| 术语表 | `docs/glossary.md` |
