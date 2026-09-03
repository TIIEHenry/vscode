---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "Engine Tools 选中行拉 ToolService.ToolInfo 只读详情（无 schema 编辑器）；CancelToolCall 空 agent 用末条 streaming 否则 root；Kill roster 已转发；Respond catalog 已进、权限回执仍走 Chat 臂；队列 UI 仍 fixture"
---

# Development Progress

## Current Session

- **槽 merge：** 接通后时间线 Cancel Tool → `CancelToolCall`：保留 A 的 Kill roster + fold 测 + B 的末条 streaming 否则 `root`。本轮合入 C 的 `PermissionService.Respond` catalog。
- **槽 A / `loop/A`：** Engine Tools 选中工具行转发已进 catalog 的 `ToolService.ToolInfo`（`getToolInfo`）：只读详情（name / description / category / aliases / Destructive / Requires permission；有 `inputSchemaJson` 只标「Has input schema」，**不**画 schema 编辑器）。无 hook / 空名 / 未选中不拉。测：选中一行调一次；无 hook 隐藏详情。此前时间线 Cancel Tool、killSubAgent。
- **槽 B / `loop/B`：** 接通后时间线执行中工具行转发 `AgentService.CancelToolCall`（空 agent 用末条 streaming 否则 `root`）。此前 ToolInfo catalog。
- **槽 C / `loop/C`：** 把 `PermissionService.Respond` 写入 gRPC catalog（`universeagent.session.v1.PermissionService`），node unary `respondPermission`（snake_case `session_id`/`request_id`/`granted`/`metadata_json`；响应 `success`/`error`）。合同可选。**不改** roster / 时间线权限座（仍走 Chat 臂 `permissionRespond`）。测：catalog + 转发 / 失败映射。此前 CancelToolCall catalog。
- **槽 D / `loop/D`：** 把 `AgentService.Kill` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `killAgent`（snake_case `session_id`/`agent_id`/`force`；空 agent id 原样上线，不默认 `root`；响应 `success`/`message`）。合同可选。**不改** roster / 用户动作（≠ Cancel / CancelToolCall）。测：catalog + 转发 / 失败映射。此前 MessageQueue 族 catalog；roster 仍 fixture。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | CancelToolCall 时间线合成 + PermissionService.Respond catalog |
| A | `vscode-WorkTrees/A` | `loop/A` | Engine Tools 选中行 ToolInfo 只读详情；Kill / CancelToolCall 已转发 |
| B | `vscode-WorkTrees/B` | `loop/B` | 接通后时间线 CancelToolCall（末条 streaming 否则 root） |
| C | `vscode-WorkTrees/C` | `loop/C` | PermissionService.Respond catalog + node unary；权限回执仍走 Chat 臂 |
| D | `vscode-WorkTrees/D` | `loop/D` | AgentService.Kill catalog + node unary；roster 未转发 |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal` / **Respond**、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork** / **Kill** / **CancelToolCall**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent / CancelToolCall agent 用末条 streaming 否则 `root`；Kill 空 agent **不**默认 `root`；Fork 不造本地 catalog id）。队列 UI 仍 fixture；Respond **未**转发（权限回执仍走 Chat 臂）；未接通 Fork tab 仍 `registerForkChat`；Engine Tools 选中行拉 `getToolInfo` 只读详情（不画 schema 编辑器） |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
