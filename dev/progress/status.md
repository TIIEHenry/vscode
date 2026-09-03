---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 C：接通后 roster enqueueMessageQueueItem 转发 AgentService.EnqueueQueueItem（空正文 / 未知 session / 断连缓存不发）；Composer 发送仍走 submitInput；Respond 仍走 Chat 臂；Engine Tools / Kill / MessageQueue 五操作已在 tip"
---

# Development Progress

## Current Session

- **槽 merge：** 合入 A 的 Engine Tools ToolInfo 只读详情与 Kill roster；MessageQueue 五操作 + Edit、Respond catalog 已在 tip。
- **槽 A / `loop/A`：** Engine Tools 选中工具行转发已进 catalog 的 `ToolService.ToolInfo`（只读详情，不画 schema 编辑器）。此前 Kill / CancelToolCall。
- **槽 B / `loop/B`：** 接通后时间线权限座转发 `PermissionService.Respond`（未接通仍走 Chat 臂）。此前 CancelToolCall。
- **槽 C / `loop/C`：** 接通后 roster `enqueueMessageQueueItem` 转发已进 catalog 的 `AgentService.EnqueueQueueItem`（空正文 / 未知 session / 断连缓存不发；可选 `priority` / `opId`）。Composer 发送仍走 `submitInput`，不改 Inbox 列表。测：catalog 转发 / 空正文 / 断连。此前 Respond catalog。
- **槽 D / `loop/D`：** 接通后 roster 转发 MessageQueue 五操作 + `EditQueueItem`；无 GetQueue 显示诚实空。此前 Kill catalog。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | ToolInfo 只读详情 + Kill roster + Respond catalog + MessageQueue roster 转发 |
| A | `vscode-WorkTrees/A` | `loop/A` | Engine Tools 选中行 ToolInfo 只读详情；Kill / CancelToolCall 已转发 |
| B | `vscode-WorkTrees/B` | `loop/B` | 接通后时间线权限座转发 Respond |
| C | `vscode-WorkTrees/C` | `loop/C` | 接通后 Enqueue 转发；Composer 发送仍 submitInput |
| D | `vscode-WorkTrees/D` | `loop/D` | 接通后 MessageQueue 五操作 + Edit 转发 |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal` / **Respond**、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork** / **Kill** / **CancelToolCall** / **MessageQueue 五操作 + Edit + Enqueue**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent / CancelToolCall agent 用末条 streaming 否则 `root`；Kill 空 agent **不**默认 `root`；Fork 不造本地 catalog id；队列无 GetQueue 显示空）。Respond **未**转发（权限回执仍走 Chat 臂）；未接通 Fork tab 仍 `registerForkChat`；Engine Tools 选中行拉 `getToolInfo` 只读详情（不画 schema 编辑器）；Composer 发送仍 `submitInput` |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
