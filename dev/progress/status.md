---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "把 AgentService.ListSnapshots 写入 gRPC catalog（node unary listSnapshots）；SessionBar History 仍回合索引；Inbox AutoDrive 诚实空；DeleteMessage / EditMessage / ToolInfo / Respond / Kill / Enqueue 已转发；Composer 发送仍走 submitInput"
---

# Development Progress

## Current Session

- **槽 merge：** 合入 A 的 Inbox AutoDrive 接通 / 断连缓存诚实空、B 的时间线 `deleteTurn` 转发 `AgentService.DeleteMessage`、C 的时间线 `updateUserTurnText` / `turnEdit` 转发 `AgentService.EditMessage`（空 turnId / 空正文不发；未接通仍本地改）。ToolInfo / Respond / Enqueue / Kill / MessageQueue 已在 tip。
- **槽 A / `loop/A`：** 接通 / 断连缓存后 Inbox AutoDrive `getAutoDriveTasks` 诚实空（Inbox 无任务列表 RPC，不把 fixture 冒充引擎任务；`setAutoDriveTaskFixture` 接通后忽略）。`Team.TaskList` 仍只给 Navigator。stub / 从未连过仍 fixture。测：connected 忽略 fixture；断连缓存仍空。此前 Engine Tools ToolInfo 只读详情。
- **槽 B / `loop/B`：** 把 `AgentService.ListSnapshots` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `listSnapshots`（snake_case `session_id`；响应 `snapshots[]` 的 `id`/`session_id`/`title`/…）。合同可选。空 `sessionId` 原样上线。**不改** SessionBar History / roster（History 仍回合索引，不把 snapshot 列表冒充历史）。测：catalog + 转发 / 空 id / 空列表。此前时间线 `deleteTurn` 转发 DeleteMessage。
- **槽 C / `loop/C`：** 接通后 roster `updateUserTurnText` 转发已进 catalog 的 `AgentService.EditMessage`（空 `turnId` / 空正文 / 未知 session / 断连缓存 / 无 hook 不发；未指定 agent 用末条 streaming 否则 `root`）。时间线 `turnEdit` 保存走该转发（≠ EditQueueItem）。未接通仍本地改 stub。测：catalog 转发 / 空 id / 空正文 / 断连。此前 Enqueue + Respond catalog。
- **槽 D / `loop/D`：** 接通后 roster `killSubAgent` / Kill 动作转发已进 catalog 的 `AgentService.Kill`（未知 session / 断连缓存 / 无 hook 不发；空 `agentId` 原样上线，**不**默认 `root`；省略时用末条 streaming 否则空串）。不造本地 catalog 变更。未接通仍 no-op。此前 MessageQueue 五操作 + Edit 转发。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | AutoDrive 诚实空 + deleteTurn DeleteMessage + turnEdit EditMessage + ToolInfo + Respond + Enqueue + Kill / MessageQueue |
| A | `vscode-WorkTrees/A` | `loop/A` | Inbox AutoDrive 接通 / 断连缓存诚实空；ToolInfo 只读详情 |
| B | `vscode-WorkTrees/B` | `loop/B` | AgentService.ListSnapshots catalog + node unary；SessionBar History 仍回合索引 |
| C | `vscode-WorkTrees/C` | `loop/C` | 接通后 turnEdit 转发 AgentService.EditMessage；空 turnId / 空正文不发 |
| D | `vscode-WorkTrees/D` | `loop/D` | 接通后 Kill roster / 用户动作转发；空 agentId 不默认 root |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal` / **Respond**、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`AgentService.DeleteMessage`、`AgentService.EditMessage`、`AgentService.ListSnapshots`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork** / **Kill** / **CancelToolCall** / **DeleteMessage** / **Respond** / **MessageQueue 五操作 + Edit + Enqueue** / **updateUserTurnText→EditMessage**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent / CancelToolCall / DeleteMessage / EditMessage agent 用末条 streaming 否则 `root`；Kill 空 agentId 原样上线不默认 `root`，省略用末条 streaming 否则空串；Fork / Kill 不造本地 catalog id；队列无 GetQueue 显示空；Inbox AutoDrive 接通 / 断连缓存诚实空，不把 fixture 冒充引擎任务；权限座接通后转 Respond，未接通仍 Chat 臂；时间线删回合接通后转 DeleteMessage，不本地删引擎回合；空 turnId / 空正文不发 EditMessage；ListSnapshots 仅 catalog + node，SessionBar History 仍回合索引）。未接通 Fork tab 仍 `registerForkChat`；Engine Tools 选中行拉 `getToolInfo` 只读详情（不画 schema 编辑器）；Composer 发送仍 `submitInput` |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
