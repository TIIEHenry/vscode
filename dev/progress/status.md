---
title: "Development Progress"
type: progress
status: active
phase: M0
updated: 2026-08-30
summary: "M0 T1–T3 Conversation/Editor 拓扑于 fc6089a3；Sources/四钮 slot A 待合；slot B 文档 pass"
---

# Development Progress

## Current Session

- **M0 拓扑手术**（2026-08-30，`loop/B` @ `fc6089a3`）
  - 外仓 ADR-061 `accepted`；方案 [m0-topology-surgery.md](../plans/m0-topology-surgery.md) 仍 `in_progress`。
  - **已落（T1–T3 代码）**：默认 `Layout` 中心叶 `ConversationPart`；`EditorPart` End 列；`Conversation∨Editor` 互斥；`toggleConversation`。
  - **slot A（代码）**：Sources 占位 Part + titlebar 四钮 — 并行实现中，**未**在 `fc6089a3`。
  - **slot B（本 pass）**：`eh-surface-matrix.md`、`diff-footprint.md`、映射/进度诚实化；**未**改 `src/`。
  - **deferred**：compile、启动 T1–T3 演示、EH 探针、footprint 刷新（A merge 后）→ [deferred-gaps.md](deferred-gaps.md) D3–D6。

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
- 第三波：IPC / DI / 贡献 / 启动 / 窗口 / 内置扩展；sessions / chat / workbench-api overview。

## Blockers

- 无。
