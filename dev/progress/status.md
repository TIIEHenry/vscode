---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "把 AgentService.SendClientToolResponse 写入 gRPC catalog，node 传输实现 unary sendClientToolResponse；时间线 clientTool 仍 Chat 臂；Inbox AutoDrive 接通 / 断连缓存诚实空；接通后时间线 deleteTurn 转发 DeleteMessage；Engine Tools 选中行拉 ToolInfo 只读详情；接通后权限座转发 Respond；CancelToolCall / Kill / MessageQueue 五操作 + Edit + Enqueue 已转发；Composer 发送仍走 submitInput"
---

# Development Progress

## Current Session

- **槽 merge：** 合入 A 的 Engine Tools ToolInfo 只读详情、B 的权限座 `PermissionService.Respond` 转发（未接通仍 Chat 臂）、C 的 `enqueueMessageQueueItem` 转发 `AgentService.EnqueueQueueItem`（空正文不发；Composer 发送仍走 `submitInput`）、D 的 `killSubAgent` / Kill 动作转发 `AgentService.Kill`（空 agentId 不默认 `root`；省略用末条 streaming 否则空串）。Respond catalog、MessageQueue 五操作 + Edit、CancelToolCall 已在 tip。
- **槽 A / `loop/A`：** 把 `AgentService.SendClientToolResponse` 写入 gRPC catalog，node 传输实现 unary `sendClientToolResponse`（`session_id` + nested `response.call_id`/`is_error`/`content`/`metadata_json`/`canvas_refs`；空 `callId` 原样上线）。时间线 / roster **未**转发，仍 Chat 臂 `clientToolRespond`。测：catalog 名 + 转发 / 失败映射。此前 Inbox AutoDrive 诚实空。
- **槽 B / `loop/B`：** 接通后时间线 `deleteTurn` 转发已进 catalog 的 `AgentService.DeleteMessage`（空 `turnId` / 未知 session / 断连缓存 / 无 hook 不发；未指定 agent 用末条 streaming 否则 `root`；不本地删引擎回合）。未接通 / stub 仍本地删。测：catalog 转发 / 空 id / 断连 / 末条 streaming agent。此前权限座 Respond。
- **槽 C / `loop/C`：** 接通后 roster `enqueueMessageQueueItem` 转发已进 catalog 的 `AgentService.EnqueueQueueItem`（空正文 / 未知 session / 断连缓存不发；可选 `priority` / `opId`）。Composer 发送仍走 `submitInput`，不改 Inbox 列表。测：catalog 转发 / 空正文 / 断连。此前 Respond catalog。
- **槽 D / `loop/D`：** 接通后 roster `killSubAgent` / Kill 动作转发已进 catalog 的 `AgentService.Kill`（未知 session / 断连缓存 / 无 hook 不发；空 `agentId` 原样上线，**不**默认 `root`；省略时用末条 streaming 否则空串）。不造本地 catalog 变更。未接通仍 no-op。此前 MessageQueue 五操作 + Edit 转发。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | AutoDrive 诚实空 + deleteTurn DeleteMessage + ToolInfo + Respond + Enqueue + Kill / MessageQueue |
| A | `vscode-WorkTrees/A` | `loop/A` | SendClientToolResponse catalog + node unary；时间线 clientTool 仍 Chat 臂 |
| B | `vscode-WorkTrees/B` | `loop/B` | 接通后时间线 deleteTurn 转发 AgentService.DeleteMessage |
| C | `vscode-WorkTrees/C` | `loop/C` | 接通后 Enqueue 转发；Composer 发送仍 submitInput |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal` / **Respond**、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`AgentService.DeleteMessage`、`AgentService.SendClientToolResponse`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork** / **Kill** / **CancelToolCall** / **DeleteMessage** / **Respond** / **MessageQueue 五操作 + Edit + Enqueue**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent / CancelToolCall / DeleteMessage agent 用末条 streaming 否则 `root`；Kill 空 agentId 原样上线不默认 `root`，省略用末条 streaming 否则空串；Fork / Kill 不造本地 catalog id；队列无 GetQueue 显示空；Inbox AutoDrive 接通 / 断连缓存诚实空，不把 fixture 冒充引擎任务；权限座接通后转 Respond，未接通仍 Chat 臂；时间线删回合接通后转 DeleteMessage，不本地删引擎回合；SendClientToolResponse 仅 catalog，时间线 clientTool 仍 Chat 臂）。未接通 Fork tab 仍 `registerForkChat`；Engine Tools 选中行拉 `getToolInfo` 只读详情（不画 schema 编辑器）；Composer 发送仍 `submitInput` |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
