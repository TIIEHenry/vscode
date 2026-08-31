---
title: "Development Progress"
type: progress
status: active
phase: M4
updated: 2026-08-31
summary: "M4 D4 启动冒烟阻塞于 compile；D3 待工位 merge"
---

# Development Progress

## Current Session

- **M4 方案** [m4-validation-wave.md](../plans/m4-validation-wave.md) **`in_progress`**：切片 1 D3 compile/分层/域单测（工位 merge）；切片 2 **D4 启动冒烟（工位 A）— 阻塞**：`launch.sh --skip-prelaunch` 失败，缺 `.build/electron/code-oss` / `out/` / `node_modules`；T1–T3 与 M3 目视未做。详见 [deferred-gaps.md](deferred-gaps.md) D4 记录。基线 `agent-ide` `b6d1b265`。
- **M3 方案** [m3-shell-closeout.md](../plans/m3-shell-closeout.md) **`implemented`**（关仓 `b6d1b265`）。
- **M2 方案** [m2-product-shell.md](../plans/m2-product-shell.md) **`implemented`**（无引擎产品壳完成线；M3 不阻塞）。
- **M1 切片 3 Sources Files**（`156f0fe5`）：只读列表投影，点击开 End Preview。
- **D7 四钮 chrome**（`2dcd5a0a`）：默认窗 `LayoutControlMenu` 只留 Nav / Conversation / Preview / Sources；Panel/Aux 仍在 submenu。
- **文档**（`c386d6bd`）：agent-ui / layout-state 去掉「slot A 未合入」。
- **M1 方案** [m1-shell-followon.md](../plans/m1-shell-followon.md) **`implemented`**（三切片代码已合入）。UA 引擎不进。Diff 深查看落点仍 **FORK**（未选，未叫 fable）。
- M0 [m0-topology-surgery.md](../plans/m0-topology-surgery.md) **`implemented`**。compile/启动/EH → D3–D5。D7 **closed**。
- 工位 merge → M4 切片 1 D3；工位 A → M4 切片 2 D4；B–D **idle**。

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
- M3 ChatEditor 默认路径 `8ca89e3a`；Navigator stub roster `80b3f76c`；合入 `98522c4b`。
- Diff footprint @ `b283fe19`。

## Blockers

- **D4**：工位 A 无编译产物，无法隔离 profile 启动 Code OSS；待 D3 compile 后重试 T1–T3 + M3 目视。
