---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 B：ToolService.ToolInfo 进 gRPC catalog + node unary；Engine Tools 仍 list-only；Fork / MessageQueue / Inbox Goal 已在 merge"
---

# Development Progress

## Current Session

- **槽 merge：** Inbox Stop 两边保留：末条 streaming 否则 `root`；仅 connected+streaming；generating 文案 + connection 重绘。
- **槽 A / `loop/A`：** 接通后 Inbox Goal / roster 转发已进 catalog 的 `PermissionService.SetSessionGoal` / `CancelSessionGoal`（空/未变/未知 session / 断连缓存 / 无 hook 不发）。Goal 钮仅 connected 启用；输入非空 set，已有本地目标时清空 cancel；取消输入框不发。无 `GetSessionGoal`，文案只记本机上次成功 set。未接通 stub 诚实 no-op。此前 `createSession` 转发 `SessionService.Create`。
- **槽 B / `loop/B`：** 把 `ToolService.ToolInfo` 写入 gRPC catalog（`universeagent.tool.v1.ToolService`），node unary `getToolInfo`（snake_case `tool_name`；响应 name / description / category / `inputSchemaJson` / destructive / `requiresPermission` / aliases）。合同可选。**不改** Engine Tools UI（仍 `listTools` + profile checkbox）。测：catalog + 转发 / 空名映射。此前 `AgentService.Fork` catalog。
- **槽 C / `loop/C`：** 把 `PermissionService.SetSessionGoal` / `CancelSessionGoal` 写入 gRPC catalog（`universeagent.session.v1.PermissionService`），node unary `setSessionGoal` / `cancelSessionGoal`（snake_case `session_id`/`goal`，响应 `success`/`error`）。合同可选，不改 roster / Inbox Goal（钮仍诚实禁用）。测：catalog + 转发 / 失败映射。此前 ContinueGeneration + Rename + Cancel catalog。
- **槽 D / `loop/D`：** 把 Inbox 对齐的 `AgentService` 队列族（`EnqueueQueueItem` / `PauseQueue` / `ResumeQueue` / `ClearQueue` / `HoldQueueItem` / `ReleaseQueueItemHold` / `EditQueueItem`）写入 gRPC catalog + node unary + Web `unsupported_environment`。roster / Inbox **仍 fixture**，不把本地队列冒充引擎。测：catalog 字面 + 转发/失败映射。此前 D16 identity 共享 harness；roster 转发 Create / Rename / Cancel。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | Inbox Stop 合成 + compile 绿；本会话：A+B+C+D + Create + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | Inbox Goal 转发 SetSessionGoal / CancelSessionGoal |
| B | `vscode-WorkTrees/B` | `loop/B` | ToolService.ToolInfo catalog + node unary；Engine Tools 仍 list-only |
| C | `vscode-WorkTrees/C` | `loop/C` | PermissionService.SetSessionGoal / CancelSessionGoal catalog |
| D | `vscode-WorkTrees/D` | `loop/D` | MessageQueue 族进 gRPC catalog；roster 仍 fixture |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`、`SessionService.Create`、`PermissionService.SetSessionGoal` / `CancelSessionGoal`、**MessageQueue 族七 unary**、`AgentService.Fork`、`ToolService.ToolInfo`；roster 接通后已转发 Create / Rename / Cancel / SetSessionGoal（Create 用引擎 id；Inbox Stop 仅 connected+streaming；Inbox Goal 仅 connected 启用；未指定 agent 用末条 streaming 否则 `root`）。队列 UI 仍 fixture；**用户 Fork tab / `registerForkChat` 尚未转发 Fork**；Engine Tools 仍 list-only |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
