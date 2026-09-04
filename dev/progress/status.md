---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "AgentService.CreateSnapshot / RestoreSnapshot 已进 gRPC catalog（node unary createSnapshot / restoreSnapshot；空 sessionId / title / snapshotId 原样上线；Delete 未进；SessionBar History 仍回合索引）；接通后时间线 / roster respondClientTool 转发 AgentService.SendClientToolResponse（空 callId 不发；未接通仍 Chat 臂）；接通后时间线问题座转发 AgentService.RespondQuestion（空 questionId 不发；未接通仍 Chat 臂）；ListSnapshots 仅 catalog；Inbox AutoDrive 接通 / 断连缓存诚实空；接通后时间线 deleteTurn 转发 AgentService.DeleteMessage；接通后时间线 turnEdit / updateUserTurnText 转发 AgentService.EditMessage（空 turnId / 空正文不发；未接通仍本地改）；Engine Tools 选中行拉 ToolInfo 只读详情；接通后权限座转发 Respond；CancelToolCall / Kill / MessageQueue 五操作 + Edit + Enqueue 已转发；Composer 发送仍走 submitInput"
---

# Development Progress

## Current Session

- **槽 merge：** 合入 A 的 `AgentService.RestoreSnapshot` catalog（node unary restoreSnapshot；空 sessionId / snapshotId 原样上线；SessionBar History 仍回合索引）、C / D 同片的 `AgentService.CreateSnapshot` catalog（node unary；空 sessionId / title 原样上线；Delete 未进）。ListSnapshots catalog、接通后 `respondClientTool`→`SendClientToolResponse`、问题座→`RespondQuestion`、时间线 `updateUserTurnText` / `turnEdit`→`EditMessage` 已在 tip。Inbox AutoDrive 诚实空 / DeleteMessage / ToolInfo / Respond / Enqueue / Kill / MessageQueue 已在 tip。
- **槽 A / `loop/A`：** 把 `AgentService.RestoreSnapshot` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `restoreSnapshot`（snake_case `session_id`/`snapshot_id`；响应 `success`/`error_message`）。合同可选。空 `sessionId` / 空 `snapshotId` 原样上线。**不改** SessionBar History / roster（History 仍回合索引；Delete snapshot 未进）。测：catalog + 转发 / 空 id / 失败映射。此前 respondClientTool 转发 SendClientToolResponse。
- **槽 B / `loop/B`：** 接通后 roster `respondQuestion` 转发已进 catalog 的 `AgentService.RespondQuestion`（空 `questionId` / 未知 session / 断连缓存 / 无 hook 不发）。时间线问题座走该转发，**不**双写 Chat 臂 `questionRespond`。未接通仍 Chat 臂。测：catalog 转发 / 空 id / 断连。此前 ListSnapshots catalog。
- **槽 C / `loop/C`：** 把 `AgentService.CreateSnapshot` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `createSnapshot`（snake_case `session_id`/`title`/`description`；响应 `success`/`snapshot`/`error_message`）。合同可选。空 `sessionId` / 空 title 原样上线。**不改** SessionBar History / roster（History 仍回合索引；Restore / Delete snapshot 未进）。测：catalog + 转发 / 空 id / 失败映射。此前 turnEdit 转发 EditMessage。
- **槽 D / `loop/D`：** 把 `AgentService.CreateSnapshot` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `createSnapshot`（snake_case `session_id`/`title`/`description`；响应 `success`/`snapshot`/`error_message`）。合同可选。空 `sessionId` / 空 `title` 原样上线。**不改** SessionBar History / roster（History 仍回合索引）。Restore / Delete snapshot 未进。测：catalog + 转发 / 空 id / 失败映射。此前 RespondQuestion catalog（问题座转发已由 B 合入）。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | RestoreSnapshot catalog + CreateSnapshot catalog + ListSnapshots catalog + respondClientTool→SendClientToolResponse + 问题座→RespondQuestion + AutoDrive 诚实空 + deleteTurn DeleteMessage + turnEdit EditMessage + ToolInfo + Respond + Enqueue + Kill / MessageQueue |
| A | `vscode-WorkTrees/A` | `loop/A` | AgentService.RestoreSnapshot catalog + node unary；SessionBar History 仍回合索引 |
| B | `vscode-WorkTrees/B` | `loop/B` | 接通后问题座转发 AgentService.RespondQuestion；空 questionId 不发 |
| C | `vscode-WorkTrees/C` | `loop/C` | AgentService.CreateSnapshot catalog + node unary；SessionBar History 仍回合索引 |
| D | `vscode-WorkTrees/D` | `loop/D` | AgentService.CreateSnapshot catalog + node unary；Restore / Delete 未进 |
| edit | `Projects/Agents/vscode` | `agent-ide` | 请自行对齐 |

## Blockers

- 无代码硬阻塞。远端是否 parked 以 merge 槽 push 结果为准。
- 非阻塞账：[D8](deferred-gaps.md)–[D22](deferred-gaps.md)（D8/D9/D12/D15–D18/D20/D22；**D19 / D21 closed**）。

## Next

| 项 | 说明 |
|:---|:-----|
| W1 / D15 | Web 冒烟 |
| I6 | 发行标识等发布方 |
| H4a | 真 Hub 冒烟后才升 PRD-024 `implemented` |
| V | D16：Lens / identity 已接共享 harness；剩 `conversationLens.test.ts` DOM/codicon 断言债；D17 与产品验证 |
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal` / **Respond**、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`AgentService.DeleteMessage`、`AgentService.EditMessage`、`AgentService.RespondQuestion`、`AgentService.SendClientToolResponse`、`AgentService.ListSnapshots`、`AgentService.CreateSnapshot`、`AgentService.RestoreSnapshot`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork** / **Kill** / **CancelToolCall** / **DeleteMessage** / **Respond** / **respondClientTool→SendClientToolResponse** / **RespondQuestion** / **MessageQueue 五操作 + Edit + Enqueue** / **updateUserTurnText→EditMessage**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent / CancelToolCall / DeleteMessage / EditMessage agent 用末条 streaming 否则 `root`；Kill 空 agentId 原样上线不默认 `root`，省略用末条 streaming 否则空串；Fork / Kill 不造本地 catalog id；队列无 GetQueue 显示空；Inbox AutoDrive 接通 / 断连缓存诚实空，不把 fixture 冒充引擎任务；权限座接通后转 Respond，未接通仍 Chat 臂；时间线删回合接通后转 DeleteMessage，不本地删引擎回合；空 turnId / 空正文不发 EditMessage；问题座接通后转 RespondQuestion，空 questionId 不发，未接通仍 Chat 臂；时间线 clientTool 接通后转 SendClientToolResponse，空 callId 不发，未接通仍 Chat 臂；ListSnapshots / CreateSnapshot / RestoreSnapshot 仅 catalog + node，SessionBar History 仍回合索引；Delete snapshot 未进）。未接通 Fork tab 仍 `registerForkChat`；Engine Tools 选中行拉 `getToolInfo` 只读详情（不画 schema 编辑器）；Composer 发送仍 `submitInput` |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
