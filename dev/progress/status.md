---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 D 收口 D16 stub deleteTurn 过时空种子断言"
---

# Development Progress

## Current Session

- **槽 A / `loop/A`：** ff-merge `loop/merge` `20f58df7` 后，`SessionViewHost.openResidentChat` 把 `openChatStream` 的 remote/error `onClosed` 拆句柄并 warn，经 `postAndDrain` 折成 Actor `chatStreamDown`（同代可再 `ensureChatStream`）。本地 dispose / 断连不回调、不折 `streamClosed` chrome。测：`sessionViewHostChatClose`。D16/D22 未动。
- **槽 B / `loop/B`：** 对齐 `loop/merge` `bfaac2b0` 后，把剩余 conversation / navigator / engine 与 grpc 测试桩的 `subscribeSessionEventStream` 补上第三参 `onClosed`（`UniverseAgentSessionStreamCloseCause`）。**未改**宿主接线。
- **槽 C / `loop/C`：** ff-merge `loop/merge` `9688b303` 后，`SessionViewHost.openContinuation` 把 optional `openContinuationStream` 的 remote/error `onClosed` 接到句柄表：拆句柄并 warn，**不**折 Actor `streamClosed`（时间线仍走 SessionEventStream）。断连 / 再次 Continue 先本地 dispose。测：`sessionViewHostContinuationClose`。
- **槽 D / `loop/D`：** ff-merge `loop/merge` `5c1ab071` 后，D16 收口 `conversationStubService` 两条 `deleteTurn`：不再把带 7 条 fixture 的 `untitled` 当成空会话，改在 `createSession()` 上空会话上数回合。Lens / identity 红测未动。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：A+B + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | 宿主 Chat `onClosed` → `chatStreamDown` |
| B | `vscode-WorkTrees/B` | `loop/B` | 测试桩对齐 SessionEventStream `onClosed` |
| C | `vscode-WorkTrees/C` | `loop/C` | ContinueGeneration 宿主 `onClosed` |
| D | `vscode-WorkTrees/D` | `loop/D` | D16 stub `deleteTurn` 过时断言 |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。传输仍未进 gRPC catalog |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
