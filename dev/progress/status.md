---
title: "Development Progress"
type: progress
status: active
phase: M2
updated: 2026-08-31
summary: "M2 三切片已合：透镜 stub 产品面、Aux 出厂 hidden、文档诚实；Diff FORK 未选；D3–D5 仍开"
---

# Development Progress

## Current Session

- **M2 方案** [m2-product-shell.md](../plans/m2-product-shell.md) **`implemented`**：透镜 stub 产品面（`7822d430` Dock Inbox + confirmation 状态）；Chat 非 Aux default + 出厂 `'hidden'`（`e9507ba0` / `9b34c1b6`）；文档诚实（`4f9975a5` / `221e8823`）。UA 引擎不进。Diff 深查看落点仍 **FORK**。
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
- M2 透镜 stub 产品面 `7822d430`；Aux hidden `9b34c1b6`。
- Diff footprint @ `b283fe19`。

## Blockers

- 无。
