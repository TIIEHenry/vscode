---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 B：GC-2 revoke→disconnect Exit 测 + D21 失败态边沿测"
---

# Development Progress

## Current Session

- **槽 B / `loop/B`：** `git merge --ff-only loop/merge` 已快进。
- **本 commit：** D19/G-NAV 不可做；补 [m7-gap-closeout](../plans/m7-gap-closeout.md) **GC-2 Exit**（连接中 Hub 设备 revoke → `disconnect` 一次；异设备不拆）与 **D21** 边沿（`disconnect` 清 `isAgentTreeFetchFailed`；失败翻转入 `onDidChangeConnection`）。未跑 `npm run compile`；node 单测跑绿新增项。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 以 merge 槽 `git` 为准 |
| B | `vscode-WorkTrees/B` | `loop/B` | 本会话：GC-2/D21 测 |
| A/C/D | `vscode-WorkTrees/{A,C,D}` | `loop/{A,C,D}` | 以各槽 `git` 为准 |
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
