---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 C 关 D19(3)：§5/§9 改口 Connection 窄宽单栏滚动（无 nav/Back）"
---

# Development Progress

## Current Session

- **槽 C / `loop/C`：** `git merge --ff-only loop/merge` 已快进。
- **本 commit：** **D19(3)** — Connection 产品本无 Engine 式左导航；改 [accessibility-responsive-ui](../plans/accessibility-responsive-ui.md) §5/§9 合同为单栏滚动，不造假 Back；L1 / deferred-gaps D19 closed。未跑 `npm run compile`。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 以 merge 槽 `git` 为准 |
| C | `vscode-WorkTrees/C` | `loop/C` | 本会话：D19(3) |
| A/B/D | `vscode-WorkTrees/{A,B,D}` | `loop/{A,B,D}` | 以各槽 `git` 为准 |
| edit | `Projects/Agents/vscode` | `agent-ide` | 请自行对齐 |

## Blockers

- 无代码硬阻塞。远端是否 parked 以 merge 槽 push 结果为准。
- 非阻塞账：[D8](deferred-gaps.md)–[D22](deferred-gaps.md)（D8/D9/D12/D15–D18/D20/D22；**D19 / D21 closed**）。

## Next

| 项 | 说明 |
|----|------|
| W1 / D15 | Web 冒烟 |
| I6 | 发行标识等发布方 |
| H4a | 真 Hub 冒烟后才升 PRD-024 `implemented` |
| V | D16/D17 与产品验证 |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
