---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "D16 Lens+identity 共享 layout harness；Rename/Cancel catalog；roster 转发 Rename 与 Inbox Stop Cancel"
---

# Development Progress

## Current Session

- **槽 merge / `loop/merge`：** 合并 A+B 同切片 Inbox Stop。接通后 roster 转发 `AgentService.Cancel`（未指定 agent 用末条 streaming 否则 `root`；未知 session / 断连缓存不发）。Inbox Stop 仅 connected+streaming 启用；未接通 stub 诚实 no-op。保留 A 的 generating 文案与 `onDidChangeEngineConnection` 重绘。
- **槽 A / `loop/A`：** Inbox Stop 独立实现：接通后转发 Cancel（默认 `root`）；控件接通即可点。此前 D16 Lens 夹具 21 passing。
- **槽 B / `loop/B`：** D16：`conversationLens.test.ts` 与 identity 单测改走共享 `conversationLensLayoutHarness`（ResizeObserver 拦截 + layout flush），after-each 与 reveal / trajectory 套同式。Inbox Stop 已在 merge。此前进口界扫；`openChatStream` close-gate。
- **槽 C / `loop/C`：** ContinueGeneration + `AgentService.Rename` + `AgentService.Cancel` 进 gRPC catalog；node unary `renameSession`（空 title 清自定义标题）与 `cancelGeneration`（`session_id` + `agent_id`）。Web stub `unsupported_environment`。测：catalog + 转发 / 失败映射。
- **槽 D / `loop/D`：** engine-catalog 诚实回填；D16 stub `deleteTurn` 改走 `createSession()`；Overview 按 E2 隐藏 Provider 行（G-ENG-1 前不画 Unavailable 假摘要）。**ConversationEngineRosterService.renameSession** 接通后转发已进 catalog 的 `AgentService.Rename`（空/未变/未知 id 不发；断连缓存只改本地）。Lens 未接通仍走本地标题。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：合并 A+B Inbox Stop（B last-streaming-or-root + streaming 门闩；A generating 文案 + connection 重绘） |
| A | `vscode-WorkTrees/A` | `loop/A` | Inbox Stop 转发 Cancel（默认 root；接通可点） |
| B | `vscode-WorkTrees/B` | `loop/B` | D16 conversationLens + identity 共享 layout harness |
| C | `vscode-WorkTrees/C` | `loop/C` | ContinueGeneration + Rename + Cancel 进 gRPC catalog |
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
| V | D16：Lens / identity 已接共享 harness；剩 `conversationLens.test.ts` DOM/codicon 断言债；D17 与产品验证 |
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`；roster 接通后已转发 Rename 与 Cancel（Inbox Stop 仅 connected+streaming 启用；未指定 agent 用末条 streaming 否则 `root`） |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
