---
title: "Development Progress"
type: progress
status: active
phase: M2
updated: 2026-08-31
summary: "M2 方案已合；透镜/Aux/文档首波已落，对照方案仍有缺口（Inbox 诚实、confirmation 状态、setting 默认、其余 docs）"
---

# Development Progress

## Current Session

- **M2 方案** [m2-product-shell.md](../plans/m2-product-shell.md) **`in_progress`**：三切片与首波代码并行；对照方案仍缺：Inbox 须为 Dock 顶诚实空行（现 overlay 假列表）、Allow/Skip 本地状态、`secondarySideBar.defaultVisibility`+splash、切片 3 其余文档。
- **M2 首波已合**：透镜产品化 `0f5d4c00`；映射诚实 `4f9975a5`；Chat 非 Aux default + layout 默认藏右栏 `e9507ba0`。
- **M1 切片 3 Sources Files**（`156f0fe5`）：只读列表投影，点击开 End Preview。
- **D7 四钮 chrome**（`2dcd5a0a`）：默认窗 `LayoutControlMenu` 只留 Nav / Conversation / Preview / Sources；Panel/Aux 仍在 submenu。
- **文档**（`c386d6bd`）：agent-ui / layout-state 去掉「slot A 未合入」。
- **M1 方案** [m1-shell-followon.md](../plans/m1-shell-followon.md) **`implemented`**（三切片代码已合入）。UA 引擎不进。Diff 深查看落点仍 **FORK**（未选，未叫 fable）。
- M0 [m0-topology-surgery.md](../plans/m0-topology-surgery.md) **`implemented`**。compile/启动/EH → D3–D5。D7 **closed**。
- 工位 A–D **idle**。

## Loop 基础设施（2026-08-30）

- **套件**：`dev/loop/` = AgenticLoopDev submodule。
- **工位池**：`vscode-WorkTrees/` → [worktree-pool.md](worktree-pool.md)。
- **集成分支**：**`agent-ide`**。
- **门禁**：[health-gates.md](health-gates.md)（本轮未跑 compile）。
- **队列**：[deferred-gaps.md](deferred-gaps.md) · [research-queue.md](research-queue.md)。

## Completed

- 文档系统骨架 + B2 分析簇。
- M0 Conversation 中心 `fc6089a3`；Sources+四钮 `b5631393`；D7 chrome `2dcd5a0a`。
- M1 Conversation 透镜 `4f3fef65`；Sources Files 列表 `156f0fe5`。
- Diff footprint @ `b283fe19`。

## Blockers

- 无。
