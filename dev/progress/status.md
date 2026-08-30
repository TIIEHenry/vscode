---
title: "Development Progress"
type: progress
status: active
phase: M0
updated: 2026-08-31
summary: "M0 A+B 于 b5631393 合入（Conversation + End Editor/Sources + 四钮）；compile/演示/EH deferred"
---

# Development Progress

## Current Session

- **M0 拓扑手术**（2026-08-31，`loop/C` @ `b5631393`）
  - 外仓 ADR-061 `accepted`；方案 [m0-topology-surgery.md](../plans/m0-topology-surgery.md) 仍 `in_progress`。
  - **A+B 已合入**（merge @ `b5631393`）：`ConversationPart` 中心；End 列 `EditorPart`（上）+ `SourcesPart`（下）；`Conversation∨(Editor∨Sources)` 互斥；titlebar `LayoutControlMenu` 四钮（Nav / Conversation / Preview / Sources）。
  - **本 pass（slot C 文档）**：刷新 footprint、映射、parts-and-grid、进度；**未**改 `src/`；**未** compile。
  - **deferred** → [deferred-gaps.md](deferred-gaps.md) D3–D5：compile、`valid-layers-check`、启动 T1–T3 演示、EH 探针。
  - **工位池**：A–D **idle**（本 docs commit 后）；见 [worktree-pool.md](worktree-pool.md)。

## Loop 基础设施（2026-08-30）

- **套件**：`dev/loop/` = AgenticLoopDev submodule；启动 `/loop @dev/loop/loop-prompt.txt`。
- **工位池**：`/home/clarence/Projects/Agents/vscode-WorkTrees/`（`merge` + `A`–`D`）；槽表 → [worktree-pool.md](worktree-pool.md)。
- **集成分支**：**`agent-ide`**；merge 槽对齐此分支。
- **集成门禁**：`npm run compile` + `npm run valid-layers-check` → [health-gates.md](health-gates.md)。
- **队列**：[deferred-gaps.md](deferred-gaps.md) · [research-queue.md](research-queue.md)。

## Completed

- 文档系统骨架 + 首波分层导航。
- B2 分析簇：`docs/reference/code-oss-b2/` · Parts/Grid · Agent UI。
- M0 T1–T3 拓扑 commit `fc6089a3`（Conversation 中心 + Editor End）。
- M0 Sources + 四钮合入 `b5631393`（A+B merge）。
- 第三波：IPC / DI / 贡献 / 启动 / 窗口 / 内置扩展；sessions / chat / workbench-api overview。
- Diff footprint 刷新 @ `b5631393`（本 pass）。

## Blockers

- 无。
