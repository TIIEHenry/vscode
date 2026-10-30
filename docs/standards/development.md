# 开发

本页是文档系统接入之后的开工、改需求、计划和提交顺序。目录角色见 [文档系统](../design/document-system.md)。取舍见 [接入 Wiki 文档检查](../decisions/wiki-adoption.md)。

## 开工阅读

先读 [AGENTS.md](../../AGENTS.md) 里的硬规则和阅读表，再按任务打开 [docs/INDEX.md](../INDEX.md) 或 [dev/INDEX.md](../../dev/INDEX.md) 里的相关页。改维护行为时读 [DOCUMENTATION.md](../DOCUMENTATION.md)。接续已有任务时读 [status.md](../../dev/progress/status.md) 的当前段。启动规则以 [AGENTS.md](../../AGENTS.md) 为准。

开始任务时运行：

```bash
python3 scripts/wiki/wiki.py remind --root .
```

用它查看代码与对应文档的累计欠账，以及需要向用户确认的知识页。计划状态行扫描已开。frontmatter 为 `implemented` 或 `completed` 的计划写 `状态：已完成。`。按 [规则 7](../DOCUMENTATION.md#规则-7过时--归档)，已实施的方案仍留在 `dev/plans/`，不批量归档。`remind` 报 `plan-finished-not-archived` 是提醒，方案留在原地。

多项计划并行时，`status.md` 仍是当前迭代的汇总，不重写某一份计划的步骤。该文件行数上限 200，由 `scripts/check-docs-health.py` 检查。

## 改需求的顺序

用户可见的产品行为要改时，按 [规则 10a](../DOCUMENTATION.md#规则-10a产品需求变更顺序) 更新需求、追踪矩阵和相关说明，再写计划。需求编号继续用 `PRD-NNN`。追踪矩阵仍是 [traceability.md](../product/traceability.md)。需求追踪已开。状态行用英文值 `accepted`、`implemented`、`proposed`、`blocked`。`blocked` 是本仓工具副本额外认的需求状态。测试引用扫描只覆盖对话测试和导航测试，见 [文档系统](../design/document-system.md)。

## 计划与审查

一项工作有多个步骤、需要交接，或会跨多次会话时，在 [`dev/plans/`](../../dev/plans/INDEX.md) 写一份计划。新建计划在一级标题下第一行写状态，例如 `状态：执行中。`，下一行写 `覆盖需求：`。编号用正文里已经出现的 `PRD-NNN`；没有编号时写 `覆盖需求：无（正文未引用需求编号）。`。多人或多个 Agent 同时做时，同一行写 `负责：agent:<名字>。` 写法见 [状态行](../../scripts/wiki/formats.md#计划决策记录和待处理项的状态行)。

方案写完后，按 [规则 16](../DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿) 做只读审查，再改稿。一次审查放在 `dev/reviews/<开始日期>-<主题>/`。问题怎样编号、怎样写核对，见 [审查问题](../../scripts/wiki/formats.md#审查问题)。

## 验证

编译、lint、文档健康和单测按影响面选取。命令清单以 [health-gates](../../dev/progress/health-gates.md) 和 [编码约定](../../.github/copilot-instructions.md) 为准。

`python3 scripts/wiki/wiki.py verify --root .` 只运行 `docs/wiki.json` 里 `verify` 登记的文档检查，并写出可贴进计划的记录。编译和单测按 health-gates 与编码约定执行。

提交前运行：

```bash
python3 scripts/wiki/wiki.py check --root .
python3 scripts/check-docs-health.py
```

合入用的本地命令以 health-gates 为正文。

## 提交时的 remind

本机钩子放在 `.git/hooks/`，不改 `git config core.hooksPath`。新 clone 运行 `scripts/wiki/install-hooks.sh`。`pre-commit` 运行 `check --staged`，`commit-msg` 运行 `remind --staged`。提交时不加 `--no-verify`。上面的 `check --root .` 与 `scripts/check-docs-health.py` 仍是工作区检查；钩子读的是暂存快照。若在提交信息写好后要看暂存提醒，运行：

```bash
python3 scripts/wiki/wiki.py remind --root . --staged --message-file <提交信息文件>
```

提醒的含义和 `Docs-Reviewed: <名称> <理由>` 的写法见 [提交时的文档提醒](../../scripts/wiki/reference.md#提交时的文档提醒)。以 `[agent]` 开头的事项，在同一次改动里处理；文档已经对照过、不需要改时，用带理由的 `Docs-Reviewed` 说明。以 `[user]` 开头的事项交给用户确认。

只暂存本次相关文件。别人的未提交改动留在工作区。范围见 [规则 3b](../DOCUMENTATION.md#规则-3b提交时保留其他未提交改动)。
