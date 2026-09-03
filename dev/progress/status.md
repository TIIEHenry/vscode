---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "roster 接通后转发 SessionService.Create（引擎 id 入目录）；D16 Lens+identity 全套共享 layout harness；Rename/Cancel catalog；Inbox Stop Cancel"
---

# Development Progress

## Current Session

- **槽 merge：** Inbox Stop 两边保留：末条 streaming 否则 `root`；仅 connected+streaming；generating 文案 + connection 重绘。
- **槽 A / `loop/A`：** 接通后 `createSession` 转发已进传输的 `SessionService.Create`，用返回 `sessionId` 入引擎目录并切活动会话（同步返回 `''`，不把旧 active / stub `untitled` 冒充新会话）；空 id 忽略；断连缓存不发 unary、不造 stub 种子。此前 Inbox Stop 转发 `AgentService.Cancel`。
- **槽 B / `loop/B`：** D16：`conversationLens.test.ts` 与 identity 单测改走共享 `conversationLensLayoutHarness`（ResizeObserver 拦截 + layout flush），after-each 与 reveal / trajectory 套同式。此前抽出 harness 接到 reveal / trajectory / trajectoryUi；进口界扫；`openChatStream` close-gate。
- **槽 C / `loop/C`：** `conversationLens.test.ts` 接入共享 harness；ContinueGeneration + `AgentService.Rename` + `AgentService.Cancel` 进 gRPC catalog；node unary `renameSession`（空 title 清自定义标题）与 `cancelGeneration`（`session_id` + `agent_id`）。Web stub `unsupported_environment`。Inbox Stop 仍诚实降级。测：catalog + 转发 / 失败映射。
- **槽 D / `loop/D`：** D16 leftover：`conversationIdentityStrip.test.ts` 改走共享 `conversationLensLayoutHarness`（ResizeObserver loop 拦截 + layout flush），after-each 与 reveal/trajectory 同式。不改 Inbox/Cancel/roster。此前 engine-catalog 诚实回填；Overview 隐藏 Provider 行；roster 接通后转发 Rename。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | Inbox Stop 合成 + compile 绿；本会话：A+B+C+D + Create + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | roster 接通后转发 SessionService.Create；Inbox Stop Cancel + Lens 夹具 |
| B | `vscode-WorkTrees/B` | `loop/B` | D16 conversationLens + identity 共享 layout harness |
| C | `vscode-WorkTrees/C` | `loop/C` | Lens 测接 harness + ContinueGeneration + Rename + Cancel catalog |
| D | `vscode-WorkTrees/D` | `loop/D` | Overview 隐藏 Provider 行；roster 接通后转发 Rename；D16 identity 接入共享 layout harness |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`SessionService.Create`；roster 接通后已转发 Create / Rename / Cancel（Create 用引擎 id；Inbox Stop 仅 connected+streaming 启用；未指定 agent 用末条 streaming 否则 `root`） |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
