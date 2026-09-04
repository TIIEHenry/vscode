---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "SessionService.Export 已进 gRPC catalog（node unary exportSession；空 sessionId / format 原样上线；无 Conversation UI；≠ Shelve / Unshelve / Resume / Delete）；AgentService.Status 已进 gRPC catalog（node unary getAgentStatus；空 sessionId / agentId 原样上线；无 Conversation UI；≠ Session.Info / Agent.Tree）；SessionService.Unshelve 已进 gRPC catalog（node unary unshelveSession；空 sessionId 原样上线；无 Conversation UI；≠ Shelve / Resume / Delete）；SessionService.Resume 已进 gRPC catalog（node unary resumeSession；空 sessionId 原样上线；无 Conversation UI；≠ Agent.ResumeQueue）；SessionService.Shelve 已进 gRPC catalog（node unary shelveSession；空 sessionId 原样上线；无 Conversation UI；≠ Delete / Unshelve / Resume）；SessionService.Info 已进 gRPC catalog（node unary getSessionInfo；空 sessionId 原样上线；无 Conversation UI）；接通后 SessionBar Snapshots overlay Delete 确认成功后再拉 listSnapshots 刷新行（overlay 保持打开；取消 / 失败 / 未发不刷新）；overlay Delete 转发 AgentService.DeleteSnapshot（空 snapshotId / 断连 / 无 hook / 空 session 不发；确认后才发）；overlay Restore 转发 restoreSnapshot（空 snapshotId / 断连 / 无 hook 不发；成功后 overlay 保持打开再拉 listSnapshots，失败 / 未发不刷新）；AgentService.ListLoopSnapshots 已进 gRPC catalog（node unary；空 sessionId / loopId 原样上线；不改 SessionBar / overlay）；接通后 Conversation 动作 createSnapshot 转发 AgentService.CreateSnapshot（空 sessionId / 断连 / 无 hook 不发；空 title 原样上线）；listSnapshots 列表消费（断连 / 无 hook / 空 sessionId 不发；History 仍回合索引）；AgentService.CreateSnapshot / RestoreSnapshot / DeleteSnapshot 已进 gRPC catalog（node unary；空 sessionId / title / snapshotId 原样上线）；接通后时间线 / roster respondClientTool 转发 AgentService.SendClientToolResponse（空 callId 不发；未接通仍 Chat 臂）；接通后时间线问题座转发 AgentService.RespondQuestion（空 questionId 不发；未接通仍 Chat 臂）；Inbox AutoDrive 接通 / 断连缓存诚实空；接通后时间线 deleteTurn 转发 AgentService.DeleteMessage；接通后时间线 turnEdit / updateUserTurnText 转发 AgentService.EditMessage（空 turnId / 空正文不发；未接通仍本地改）；Engine Tools 选中行拉 ToolInfo 只读详情；接通后权限座转发 Respond；CancelToolCall / Kill / MessageQueue 五操作 + Edit + Enqueue 已转发；Composer 发送仍走 submitInput"
---

# Development Progress

## Current Session

- **槽 merge：** 合入 A 的 `SessionService.Unshelve` catalog（node unary `unshelveSession`；空 sessionId 原样上线；无 Conversation UI；≠ Shelve / Resume / Delete）、B 的 `AgentService.Status` catalog（node unary `getAgentStatus`；空 sessionId / agentId 原样上线；无 Conversation UI；≠ Session.Info / Agent.Tree）。`SessionService.Resume`、overlay restore-refresh、`SessionService.Shelve`、overlay delete-refresh、overlay Delete、`SessionService.Info`、overlay Restore、`ListLoopSnapshots` 已在 tip。createSnapshot 动作转发已在 tip。DeleteSnapshot catalog、SessionBar Snapshots `listSnapshots`、RestoreSnapshot / CreateSnapshot catalog 已在 tip。接通后 `respondClientTool`→`SendClientToolResponse`、问题座→`RespondQuestion`、时间线 `turnEdit`→`EditMessage` 已在 tip。Inbox AutoDrive 诚实空 / DeleteMessage / ToolInfo / Respond / Enqueue / Kill / MessageQueue 已在 tip。
- **槽 A / `loop/A`：** 把 `SessionService.Export` 写入 gRPC catalog（`universeagent.session.v1.SessionService`），node unary `exportSession`（snake_case `session_id`/`format`；响应 `content`/`format`）。合同可选。空 `sessionId` / `format` 原样上线。**不改** Conversation roster / SessionBar / Snapshots overlay。≠ `Shelve` / `Unshelve` / `Resume` / `Delete`。测：catalog + 转发 / 空 id。
- **槽 B / `loop/B`：** 把 `AgentService.Status` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `getAgentStatus`（snake_case `session_id`/`agent_id`；响应 `agent` → 既有 `AgentInfo`）。合同可选。空 `sessionId` / `agentId` 原样上线。**不改** Conversation roster / SessionBar / Snapshots overlay / FetchAgentStatus fold。≠ `Session.Info` / `Agent.Tree`。测：catalog + 转发 / 空 id。
- **槽 C / `loop/C`：** 把 `SessionService.Shelve` 写入 gRPC catalog（`universeagent.session.v1.SessionService`），node unary `shelveSession`（snake_case `session_id`；响应 `success`/`message`）。合同可选。空 `sessionId` 原样上线。**不改** Conversation roster / SessionBar / Snapshots overlay。≠ `Delete` / `Unshelve` / `Resume`。测：catalog + 转发 / 空 id。
- **槽 D / `loop/D`：** SessionBar Snapshots overlay Delete **确认成功后**再拉 `listSnapshots` 刷新行，overlay 保持打开；取消 / 失败 / 未发不刷新。对齐 tip 上 Restore 未带 refresh 时的 restore-refresh 规则（`conversationEngineSnapshotsList`）。**不**加新 RPC；**不**改 gRPC；**不**改 SessionBar History（仍回合索引）。测：`conversationEngineSnapshotsList` 成功刷新 / 取消不刷新 / 失败不刷新 / 未发不刷新。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | SessionBar Snapshots overlay Restore + restore 成功刷新 listSnapshots + overlay Delete + delete 成功刷新 listSnapshots + listSnapshots + ListLoopSnapshots catalog + SessionService.Info catalog + SessionService.Resume catalog + SessionService.Shelve catalog + SessionService.Unshelve catalog + AgentService.Status catalog + RestoreSnapshot catalog + CreateSnapshot catalog + DeleteSnapshot catalog + createSnapshot 动作转发 + respondClientTool→SendClientToolResponse + 问题座→RespondQuestion + AutoDrive 诚实空 + deleteTurn DeleteMessage + turnEdit EditMessage + ToolInfo + Respond + Enqueue + Kill / MessageQueue |
| A | `vscode-WorkTrees/A` | `loop/A` | SessionService.Export catalog + node unary exportSession；空 sessionId / format 原样上线；无 Conversation UI |
| B | `vscode-WorkTrees/B` | `loop/B` | AgentService.Status catalog + node unary getAgentStatus；空 sessionId / agentId 原样上线；无 Conversation UI |
| C | `vscode-WorkTrees/C` | `loop/C` | SessionService.Shelve catalog + node unary shelveSession；空 sessionId 原样上线；无 Conversation UI |
| D | `vscode-WorkTrees/D` | `loop/D` | overlay Delete 确认成功后再拉 listSnapshots；取消 / 失败 / 未发不刷新；History 仍回合索引 |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`SessionService.Info`、`SessionService.Resume`、`SessionService.Shelve`、`SessionService.Unshelve`、`SessionService.Export`、`AgentService.Status`、`PermissionService.SetSessionGoal` / `CancelSessionGoal` / **Respond**、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`AgentService.DeleteMessage`、`AgentService.EditMessage`、`AgentService.RespondQuestion`、`AgentService.SendClientToolResponse`、`AgentService.ListSnapshots`、`AgentService.ListLoopSnapshots`、`AgentService.CreateSnapshot`、`AgentService.RestoreSnapshot`、`AgentService.DeleteSnapshot`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork** / **Kill** / **CancelToolCall** / **DeleteMessage** / **Respond** / **respondClientTool→SendClientToolResponse** / **RespondQuestion** / **MessageQueue 五操作 + Edit + Enqueue** / **updateUserTurnText→EditMessage** / **createSnapshot→CreateSnapshot**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent / CancelToolCall / DeleteMessage / EditMessage agent 用末条 streaming 否则 `root`；Kill 空 agentId 原样上线不默认 `root`，省略用末条 streaming 否则空串；Fork / Kill 不造本地 catalog id；队列无 GetQueue 显示空；Inbox AutoDrive 接通 / 断连缓存诚实空，不把 fixture 冒充引擎任务；权限座接通后转 Respond，未接通仍 Chat 臂；时间线删回合接通后转 DeleteMessage，不本地删引擎回合；空 turnId / 空正文不发 EditMessage；问题座接通后转 RespondQuestion，空 questionId 不发，未接通仍 Chat 臂；时间线 clientTool 接通后转 SendClientToolResponse，空 callId 不发，未接通仍 Chat 臂；ListSnapshots 由 Conversation SessionBar Snapshots 列表消费，断连 / 无 hook / 空 sessionId 不发；overlay Restore 直呼 restoreSnapshot，空 snapshotId / 断连 / 无 hook 不发；成功后 overlay 保持打开再拉 listSnapshots，失败 / 未发不刷新；overlay Delete 确认后转发 deleteSnapshot，空 snapshotId / 断连 / 无 hook / 空 session 不发；确认成功后 overlay 保持打开再拉 listSnapshots，取消 / 失败 / 未发不刷新；CreateSnapshot 接通后 Conversation 动作转发（空 sessionId / 断连 / 无 hook 不发；空 title 原样上线）；ListLoopSnapshots / SessionService.Info / SessionService.Resume / SessionService.Shelve / SessionService.Unshelve / SessionService.Export / AgentService.Status 仅 catalog + node；SessionBar History 仍回合索引）。未接通 Fork tab 仍 `registerForkChat`；Engine Tools 选中行拉 `getToolInfo` 只读详情（不画 schema 编辑器）；Composer 发送仍 `submitInput` |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
