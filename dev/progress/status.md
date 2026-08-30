---
title: "Development Progress"
type: progress
status: active
phase: M0
updated: 2026-08-31
summary: "M0 壳 implemented（eb3ab146）：Conversation + End Editor/Sources + 四钮；compile/演示/EH deferred"
---

# Development Progress

## Current Session

- **并行**：A（D7 代码）、B（文档 stale 措辞）、C（grok M1 plan）；D/merge **idle**；compile/启动/EH deferred（D3–D5）。

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
