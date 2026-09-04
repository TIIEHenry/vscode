---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "接通后 SessionBar Snapshots overlay Delete 转发 AgentService.DeleteSnapshot（空 snapshotId / 断连 / 无 hook / 空 session 不发；确认后才发；History 仍回合索引）；Conversation 动作 createSnapshot 转发 CreateSnapshot；Snapshots 列表消费 listSnapshots；CreateSnapshot / RestoreSnapshot / DeleteSnapshot 已进 gRPC catalog"
---

# Development Progress

## Current Session

- **槽 merge：** 合入 A 的 `AgentService.RestoreSnapshot` catalog（node unary；空 sessionId / snapshotId 原样上线）、B 的 Conversation SessionBar Snapshots 只读 `listSnapshots`（断连 / 无 hook / 空 sessionId 不发；History 仍回合索引）、C 的 `AgentService.DeleteSnapshot` catalog（node unary；空 sessionId / snapshotId 原样上线）、D 的接通后 Conversation 动作 `createSnapshot` 转发 `AgentService.CreateSnapshot`（空 sessionId / 断连 / 无 hook 不发；空 title 原样上线）、C / D 同片的 `AgentService.CreateSnapshot` catalog。接通后 `respondClientTool`→`SendClientToolResponse`、问题座→`RespondQuestion`、时间线 `turnEdit`→`EditMessage` 已在 tip。Inbox AutoDrive 诚实空 / DeleteMessage / ToolInfo / Respond / Enqueue / Kill / MessageQueue 已在 tip。
- **槽 A / `loop/A`：** 把 `AgentService.RestoreSnapshot` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `restoreSnapshot`（snake_case `session_id`/`snapshot_id`；响应 `success`/`error_message`）。合同可选。空 `sessionId` / 空 `snapshotId` 原样上线。**不改** SessionBar History / Snapshots overlay / roster（History 仍回合索引）。测：catalog + 转发 / 空 id / 失败映射。此前 respondClientTool 转发 SendClientToolResponse。
- **槽 B / `loop/B`：** Conversation SessionBar extra control 只读引擎 snapshot 列表（`listSnapshots?`；id / title / created_at / turn_count）。断连 / 无 hook / 空 sessionId 不发，诚实空 / unavailable，不用 fixture 冒充引擎数据。**不**改 SessionBar History（仍 `conversationTrajectoryList.ts` 回合索引）。无 Create / Restore / Delete 写操作。测：conversation browser。此前问题座转发 RespondQuestion。
- **槽 C / `loop/C`：** 接通后 SessionBar Snapshots overlay Delete 转发已进 catalog 的 `AgentService.DeleteSnapshot`（接通 + hook + 非空 `snapshotId` + 已知 session 才发；空 id / 断连 / 无 hook 不发；`dialogService.confirm` warning 确认后才上线）。**不**改 gRPC catalog、不新增 RPC、不替换 SessionBar History（仍回合索引）。无 Create / Restore。测：conversation browser 转发 / 空 id / 断连 / 无 hook / 取消确认。
- **槽 D / `loop/D`：** 接通后 Conversation 命令 / roster `createSnapshot` 转发已进 catalog 的 `AgentService.CreateSnapshot`（空 `sessionId` / 未知 session / 断连缓存 / 无 hook 不发；省略 title 用默认 `Snapshot`，用户清空则空 title 原样上线）。**不改** SessionBar History（仍回合索引）。测：catalog 转发 / 空 id / 空 title / 断连 / 无 hook。此前 CreateSnapshot catalog。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | SessionBar Snapshots 只读 listSnapshots + RestoreSnapshot catalog + CreateSnapshot catalog + DeleteSnapshot catalog + createSnapshot 动作转发 + respondClientTool→SendClientToolResponse + 问题座→RespondQuestion + AutoDrive 诚实空 + deleteTurn DeleteMessage + turnEdit EditMessage + ToolInfo + Respond + Enqueue + Kill / MessageQueue |
| A | `vscode-WorkTrees/A` | `loop/A` | AgentService.RestoreSnapshot catalog + node unary；SessionBar History 仍回合索引 |
| B | `vscode-WorkTrees/B` | `loop/B` | Conversation SessionBar Snapshots 只读 listSnapshots；History 仍回合索引 |
| C | `vscode-WorkTrees/C` | `loop/C` | Snapshots overlay Delete→DeleteSnapshot；空 id / 断连 / 无 hook 不发；History 仍回合索引 |
| D | `vscode-WorkTrees/D` | `loop/D` | 接通后 Conversation 动作转发 CreateSnapshot；空 sessionId 不发；History 仍回合索引 |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal` / **Respond**、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`AgentService.DeleteMessage`、`AgentService.EditMessage`、`AgentService.RespondQuestion`、`AgentService.SendClientToolResponse`、`AgentService.ListSnapshots`、`AgentService.CreateSnapshot`、`AgentService.RestoreSnapshot`、`AgentService.DeleteSnapshot`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork** / **Kill** / **CancelToolCall** / **DeleteMessage** / **Respond** / **respondClientTool→SendClientToolResponse** / **RespondQuestion** / **MessageQueue 五操作 + Edit + Enqueue** / **updateUserTurnText→EditMessage** / **createSnapshot→CreateSnapshot**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent / CancelToolCall / DeleteMessage / EditMessage agent 用末条 streaming 否则 `root`；Kill 空 agentId 原样上线不默认 `root`，省略用末条 streaming 否则空串；Fork / Kill 不造本地 catalog id；队列无 GetQueue 显示空；Inbox AutoDrive 接通 / 断连缓存诚实空，不把 fixture 冒充引擎任务；权限座接通后转 Respond，未接通仍 Chat 臂；时间线删回合接通后转 DeleteMessage，不本地删引擎回合；空 turnId / 空正文不发 EditMessage；问题座接通后转 RespondQuestion，空 questionId 不发，未接通仍 Chat 臂；时间线 clientTool 接通后转 SendClientToolResponse，空 callId 不发，未接通仍 Chat 臂；ListSnapshots 由 Conversation SessionBar Snapshots 只读列表消费，断连 / 无 hook / 空 sessionId 不发；CreateSnapshot 接通后 Conversation 动作转发（空 sessionId / 断连 / 无 hook 不发；空 title 原样上线）；RestoreSnapshot 仅 catalog + node；DeleteSnapshot 由 SessionBar Snapshots overlay Delete 转发（空 snapshotId / 断连 / 无 hook / 空 session 不发；确认后才发）；SessionBar History 仍回合索引）。未接通 Fork tab 仍 `registerForkChat`；Engine Tools 选中行拉 `getToolInfo` 只读详情（不画 schema 编辑器）；Composer 发送仍 `submitInput` |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
