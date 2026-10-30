# 文档系统

本页说明本仓文档放在哪里、各页写什么、怎样新建和归档，以及哪些检查已经接上。这些做法的取舍见 [接入 Wiki 文档检查](../decisions/wiki-adoption.md)。执行时遵守的原则见 [文档系统设计原则](../principles/document-system.md)。

命令、正文写法和配置字段分别见 [Wiki 检查工具](../../scripts/wiki/README.md)、[工具读取的写法](../../scripts/wiki/formats.md)、[配置与规则](../../scripts/wiki/reference.md)。`docs/wiki.json` 登记范围、入口和启用了哪些检查，按字段名在配置说明里检索。

## 目录角色

`docs/` 是当前知识，在原路径维护。`dev/` 是过程。新的归档写入 `archive/`，并保持被移动文件原来的相对路径。已经在 `dev/archive/` 的历史留在原地。

| 路径 | 职责 |
|---|---|
| [`docs/`](../INDEX.md) | 当前知识 |
| [`docs/product/`](../product/INDEX.md) | 产品需求。编号继续用 `PRD-NNN`。追踪矩阵是 [`traceability.md`](../product/traceability.md) |
| [`docs/architecture/`](../architecture/overview.md) | 全景与横切 |
| `docs/systems/` | 跨层协作。各系统从 [`docs/INDEX.md`](../INDEX.md) 进入 |
| `docs/modules/` | 分层导航。各层从 [`docs/INDEX.md`](../INDEX.md) 进入 |
| [`docs/guides/`](../guides/INDEX.md) | 操作指南 |
| `docs/reference/` | 对照材料。各目录从 [`docs/INDEX.md`](../INDEX.md) 进入 |
| [`docs/glossary.md`](../glossary.md) | 术语 |
| [`docs/decisions/`](../decisions/wiki-adoption.md) | 仍约束当前行为的新决策。文件名写主题，不用全局顺序号 |
| [`dev/`](../../dev/INDEX.md) | 过程：计划、进度、路线图、存量决策、并行记录、报告、自动化 |
| [`dev/plans/`](../../dev/plans/INDEX.md) | 一项工作的步骤、进度、验收和验证 |
| [`dev/progress/status.md`](../../dev/progress/status.md) | 当前迭代汇总。多项计划并行时，这里不重写某一份计划的步骤。行数上限 200 |
| [`dev/roadmap/`](../../dev/roadmap/INDEX.md) | 方向、顺序和里程碑入口 |
| [`dev/decisions/`](../../dev/decisions/INDEX.md) | 存量决策。不批量搬到 `docs/decisions/` |
| [`dev/parallel/`](../../dev/parallel/INDEX.md) | 并行看板 |
| `dev/reports/` | 报告 |
| [`dev/loop/`](../../dev/loop/INDEX.md) | 开发自动化 |
| `archive/` | 新归档根 |
| [`dev/archive/`](../../dev/archive/INDEX.md) | 历史归档 |

两处决策位置都有效。某份旧决策被替代，或整篇不再适用时，再处理那一份。

模块文档放在 `docs/modules/` 与 `docs/systems/`。`docs/wiki.json` 的 `modules` 与 [文档索引](../INDEX.md) 的分层表是同一批：`path` 是源码目录，`entry` 是 `docs/modules/<名称>/INDEX.md`。`src/vs/` 下不新建 `docs/` 树，以免和上游合并冲突。已经在源码旁的规格留在原地，例如 [`LAYERS.md`](../../src/vs/sessions/LAYERS.md)。模块索引链接过去。目录树的结构说明仍以 [DOCS-SPEC.md](../DOCS-SPEC.md) 为准。缺了登记过的模块入口时，`check` 报 `missing-entry`。

AI 工具生成的计划、报告和调研写入 `dev/`。

## 页面职责

| 页面 | 写什么 | 何时更新 |
|---|---|---|
| 入口 | 硬规则、阅读条件和目标链接。Agent 入口是 [`AGENTS.md`](../../AGENTS.md) | 硬规则或阅读路径变化时 |
| 当前知识 | 需求、原则、结构、契约和规范 | 结论变化时改原文件 |
| 决策 | 背景、替代方案、决定和后果 | 保留当时的决定。被替代时改状态行，并链接新决策 |
| 计划 | 目标、步骤、验收和验证 | 随这项工作更新。步骤只维护在这一份计划里 |
| 迭代汇总 | 当前迭代在做什么 | 更新 `status.md`，不把计划步骤再抄一遍 |
| 路线图 | 方向和顺序 | 方向或依赖变化时改入口；步骤留在计划里 |
| 审查 | 一次审查的范围、分路和问题 | 写在 `dev/reviews/<开始日期>-<主题>/`。方案写完后的只读审查以 [规则 16](../DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿) 为正文 |
| 归档 | 已结束的过程，或整篇不再承担当前职责的文档 | 用归档命令移动，保持原相对路径 |

提交时暂存哪些文件、产品需求按什么顺序改，以 [DOCUMENTATION.md](../DOCUMENTATION.md) 为正文。开工时的阅读顺序和验证命令见 [开发规范](../standards/development.md)。

## 新建

新建文档前运行：

```bash
python3 scripts/wiki/wiki.py check-new <路径> --root .
```

路径中不使用空格、`#`、`%` 或括号。文件名概括主题。状态写在正文里，约定见 [写作](../standards/writing.md)。

已有文件的 frontmatter 保留，不批量删除。计划、决策和收件箱条目在一级标题下第一行写 `状态：…。`，取值见 [状态行](../../scripts/wiki/formats.md#计划决策记录和待处理项的状态行)。frontmatter 为 `implemented` 或 `completed` 的计划写 `状态：已完成。`。按 [规则 7](../DOCUMENTATION.md#规则-7过时--归档)，已实施的方案仍留在 `dev/plans/`，不批量归档。

## 归档

先预览，确认计划哈希后再执行：

```bash
python3 scripts/wiki/wiki.py archive <路径> --root .
python3 scripts/wiki/wiki.py archive <路径> --root . --apply --expect <plan_sha256>
```

预览给出目的地 `archive/<原相对路径>`、内容哈希，以及要改写的链接。`--expect` 与预览里的 `plan_sha256` 一致时，命令才移动文件并改写这些链接。目的地已存在时命令拒绝执行，不会覆盖。命令的拒绝条件和预览字段见 [新建和归档](../../scripts/wiki/reference.md#新建和归档)。

`dev/archive/` 里已有的文件不迁入 `archive/`。

## 检查

已经接上的检查：

| 时机 | 命令 | 通过时所证明的事 |
|---|---|---|
| 开始任务 | `python3 scripts/wiki/wiki.py remind --root .` | 代码与对应文档的累计欠账，以及需要向用户确认的知识页 |
| 新建文档前 | `python3 scripts/wiki/wiki.py check-new <路径> --root .` | 路径能否安全新建，主归档里有没有同路径历史 |
| 提交前 | `python3 scripts/wiki/wiki.py check --root .` | 已登记的结构、链接和身份 |
| 提交前 | `python3 scripts/check-docs-health.py` | 必备入口、模块与系统索引、`status.md` 行数（上限 200）和生成列 |

根目录 `.ignore` 让日常 `rg` 排除 `/archive/` 与 `/dev/archive/`。需要历史时用 `rg --no-ignore`，并写明目录。

配置了 `verify` 时，`python3 scripts/wiki/wiki.py verify --root .` 只运行其中登记的文档检查。编译和单测的命令清单见 [开发规范](../standards/development.md)。

现行文档里已经存在的越界链接、断链和断锚记在 [`docs/wiki-baseline.json`](../wiki-baseline.json)。`check` 放过这份基线里的错误；基线以外的新错误仍然失败。

下面这些检查已经接上，各自有限制：

| 项目 | 现在的条件 |
|---|---|
| 文档提醒范围 | `remind.watch` 有 conversation、sources、document-system、chat、navigator、sessions。代码累计超过 10 次提交或 300 行就提醒。计数在这些文档进入一次提交后清零 |
| 规则名对账 | `check` 比较 `scripts/wiki/reference.md`、`scripts/wiki/README.md` 里反引号中的连字符名称，和 `wiki.py` 里 `Finding` 的规则名。`check-new`、`working-tree`、`export-okf`、`agent-checked`、`human-checked` 不参与 |
| 需求追踪 | 已开。编号仍是 `PRD-NNN`。状态行用英文值 `accepted`、`implemented`、`proposed`、`blocked`。`blocked` 是本仓工具副本额外认的需求状态 |
| 测试引用扫描 | 已开，只扫对话和导航的测试：`src/vs/workbench/contrib/conversation/test/*.ts`、`src/vs/workbench/contrib/navigator/test/*.ts`。这两处出现的 `PRD-NNN` 都能对上需求标题。其他测试目录没有这种引用，不扫 |
| 计划状态行与覆盖需求 | 已开。状态行见上。`覆盖需求：` 列出该文件里已经出现的 `PRD-NNN`；正文没有编号时写 `覆盖需求：无（正文未引用需求编号）。`。这一行只收集编号，不判断那句话是在交付还是在说明不升需求。已实施的方案仍留在 `dev/plans/`，见 [规则 7](../DOCUMENTATION.md#规则-7过时--归档)。`remind` 报 `plan-finished-not-archived` 是提醒，方案留在原地 |
| Git 钩子 | 本机 `.git/hooks/` 已装。别的 clone 在仓库根运行 `scripts/wiki/install-hooks.sh`。脚本不改 `core.hooksPath`。目标钩子已经调用 `wiki.py` 时不覆盖。提交时不加 `--no-verify` |

合入用的本地命令以 [health-gates](../../dev/progress/health-gates.md) 为正文。
