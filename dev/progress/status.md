---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "接通后 Fork 动作转发 AgentService.Fork；ToolService.ToolInfo 进 gRPC catalog + node unary（Engine Tools 仍 list-only）；AgentService.CancelToolCall 进 catalog + node unary（时间线尚未转发）；AgentService.Kill 进 catalog + node unary（roster 未转发）；Inbox Goal 转发 SetSessionGoal；MessageQueue 族已进 catalog、队列 UI 仍 fixture；Create / Rename / Cancel 已转发；D16 Lens+identity 共享 harness"
---

# Development Progress

## Current Session

- **槽 merge：** Inbox Stop 两边保留：末条 streaming 否则 `root`；仅 connected+streaming；generating 文案 + connection 重绘。
- **槽 A / `loop/A`：** 接通后用户 Fork 动作 / roster `forkSubAgent` 转发已进 catalog 的 `AgentService.Fork`（未知 session / 断连缓存 / 无 hook 不发；未指定 parent 用末条 streaming 否则 `root`）。不造本地 catalog id、不开 Fork tab（catalog 仍 liveAgentTree）。未接通仍本地 `registerForkChat`。此前 Inbox Goal 转发 SetSessionGoal / CancelSessionGoal。
- **槽 B / `loop/B`：** 把 `ToolService.ToolInfo` 写入 gRPC catalog（`universeagent.tool.v1.ToolService`），node unary `getToolInfo`（snake_case `tool_name`；响应 name / description / category / `inputSchemaJson` / destructive / `requiresPermission` / aliases）。合同可选。**不改** Engine Tools UI（仍 `listTools` + profile checkbox）。测：catalog + 转发 / 空名映射。此前 `AgentService.Fork` catalog。
- **槽 C / `loop/C`：** 把 `AgentService.CancelToolCall` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `cancelToolCall`（snake_case `session_id`/`agent_id`/`tool_call_id`，空 agent id 线为 `root`；响应 `success`/`message`）。合同可选。不改时间线 / roster / Inbox Stop（仍只转 `Cancel`）。测：catalog + 转发 / 失败映射。此前 SetSessionGoal catalog。
- **槽 D / `loop/D`：** 把 `AgentService.Kill` 写入 gRPC catalog（`universeagent.agent.v1.AgentService`），node unary `killAgent`（snake_case `session_id`/`agent_id`/`force`；空 agent id 原样上线，不默认 `root`；响应 `success`/`message`）。合同可选。**不改** roster / 用户动作（≠ Cancel / CancelToolCall）。测：catalog + 转发 / 失败映射。此前 MessageQueue 族 catalog；roster 仍 fixture。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | Inbox Stop 合成 + compile 绿；本会话：A+B+C+D + Create + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | 接通后 Fork 转发 AgentService.Fork；未接通仍本地 Fork tab |
| B | `vscode-WorkTrees/B` | `loop/B` | ToolService.ToolInfo catalog + node unary；Engine Tools 仍 list-only |
| C | `vscode-WorkTrees/C` | `loop/C` | AgentService.CancelToolCall catalog + node unary；时间线尚未转发 |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`CancelToolCall`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal`、**MessageQueue 族七 unary**、`AgentService.Fork`、`AgentService.Kill`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal / **Fork**（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent / Fork parent 用末条 streaming 否则 `root`；Fork 不造本地 catalog id）。队列 UI 仍 fixture；Kill **未**转发；未接通 Fork tab 仍 `registerForkChat`；Engine Tools 仍 list-only；**时间线尚未转发 CancelToolCall** |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
