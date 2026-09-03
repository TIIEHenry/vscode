---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "D16 conversationLens.test.ts 接入共享 ResizeObserver / layout flush harness；Rename/Cancel catalog；roster 接通后转发 Rename 与 Inbox Stop Cancel"
---

# Development Progress

## Current Session

- **槽 merge：** Inbox Stop 两边保留：末条 streaming 否则 `root`；仅 connected+streaming；generating 文案 + connection 重绘。
- **槽 A：** Inbox Stop 转发 Cancel；D16 Lens 夹具。
- **槽 B：** 共享 Lens harness（reveal/trajectory）。
- **槽 C：** `conversationLens.test.ts` 接入共享 harness；ContinueGeneration + Rename + Cancel catalog。
- **槽 D / `loop/D`：** engine-catalog 诚实回填；D16 stub `deleteTurn` 改走 `createSession()`；Overview 按 E2 隐藏 Provider 行（G-ENG-1 前不画 Unavailable 假摘要）。**ConversationEngineRosterService.renameSession** 接通后转发已进 catalog 的 `AgentService.Rename`（空/未变/未知 id 不发；断连缓存只改本地）。Lens 未接通仍走本地标题。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | Inbox Stop 合成 + compile 绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | Inbox Stop + Lens 夹具 |
| B | `vscode-WorkTrees/B` | `loop/B` | 共享 Lens harness |
| C | `vscode-WorkTrees/C` | `loop/C` | Lens 测接 harness + RPC catalog |
| D | `vscode-WorkTrees/D` | `loop/D` | Overview 隐藏 Provider 行；roster 接通后转发 Rename |
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
| V | D16 Lens 已接共享 harness；剩 DOM/codicon 断言债；D17 与产品验证 |
| SessionEventStream close | 三路 `onClosed` 已齐。传输已进 ContinueGeneration / Rename / Cancel；roster 转发 Rename 与 Inbox Stop Cancel |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
