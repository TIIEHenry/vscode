---
title: "Development Progress"
type: progress
status: active
phase: M0
updated: 2026-08-30
summary: "M0 T1–T3 拓扑已落默认 Layout；Sources 占位与 titlebar 四钮待补"
---

# Development Progress

## Current Session

- **M0 拓扑手术**（2026-08-30）
  - 外仓 ADR-061 `accepted`；本仓 `agent-ide`；方案 [m0-topology-surgery.md](../plans/m0-topology-surgery.md) `in_progress`。
  - **已落**：默认 `Layout` 中心叶 `ConversationPart`；`EditorPart` 在 End 列；`Conversation∨Editor` 互斥（不再强制开 Panel）；`toggleConversation`。
  - **待补**：End 下格 Sources 占位 Part；titlebar layout controls 四钮；`eh-surface-matrix`；diff footprint。
  - 验证：本轮按调度跳过 compile；启动演示待四钮/Sources 合入后补。

## Loop 基础设施（2026-08-30）

- **套件**：`dev/loop/` = AgenticLoopDev submodule（`git@github.com:TIIEHenry/AgenticLoopDev.git`）；启动 `/loop @dev/loop/loop-prompt.txt`。
- **工位池**：仓外 `/home/clarence/Projects/Agents/vscode-WorkTrees/`（`merge` + `A`–`D`，基线 `7362571a`）；槽表 SSOT → [worktree-pool.md](worktree-pool.md)。
- **集成分支**：当前 **`agent-ide`**（非上游 `main`）；merge 槽须对齐此分支。
- **集成门禁**：`npm run compile` + `npm run valid-layers-check` → [health-gates.md](health-gates.md)。
- **队列**：延期缺口 [deferred-gaps.md](deferred-gaps.md) · 研究 [research-queue.md](research-queue.md)。
- **待办**：submodule 首次 commit 后各工位 `git submodule update --init`；首用槽前基线须编译验绿（建槽时未跑，耗时考虑）。

## Completed

- 文档系统骨架 + 首波分层导航。
- B2 分析簇：`docs/reference/code-oss-b2/` · Parts/Grid · Agent UI。
- 纠正「EditorPart 不可藏」：`setEditorHidden` 已存在，互斥绑的是 Panel 而非 Conversation。
- 第三波：IPC / DI / 贡献 / 启动 / 窗口 / 内置扩展；sessions / chat / workbench-api / code / server overview；workbench `services.md`。

## Blockers

- 无。
