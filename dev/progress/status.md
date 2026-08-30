---
title: "Development Progress"
type: progress
status: active
phase: M0
updated: 2026-08-31
summary: "M1 壳后续方案 proposed；M0 壳已落；compile/演示/EH 仍 deferred"
---

# Development Progress

## Current Session

- **M1 壳后续方案**（2026-08-31）[m1-shell-followon.md](../plans/m1-shell-followon.md) **`proposed`**。M0 之后至多三切片：四钮 chrome（D7）→ Conversation 透镜（无引擎）→ Sources Files 列表投影。UA 引擎/gRPC/adapter 不进；D3–D5 仍 deferred。Diff 落点标 **FORK**。
- **M0 拓扑手术**（2026-08-31）fable **PASS-with-docs-refresh**。
  - 方案 [m0-topology-surgery.md](../plans/m0-topology-surgery.md) **`implemented`**（代码事实）；compile/启动/EH 仍 deferred。
  - 合入：`fc6089a3` Conversation 中心 → `d6b45573` Sources+四钮 → `b5631393` A+B merge → `b283fe19` footprint/映射刷新。
  - 布局：中心 `ConversationPart`；End 列 Editor（Preview）+ `SourcesPart`；互斥 `Conversation∨(Editor∨Sources)`；titlebar 四钮 Nav/Conversation/Preview/Sources。
  - **未** compile（调度约定）。剩余 → [deferred-gaps.md](deferred-gaps.md) D3–D5；D6 footprint 已闭。
  - 工位池 A–D **idle**。

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
