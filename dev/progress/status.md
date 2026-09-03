---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "D16 Lens 叶宽夹具 + 共享 ResizeObserver harness；Rename/Cancel catalog；roster 接通后转发 Rename 与 Inbox Stop Cancel；Overview 隐藏 Provider 行"
---

# Development Progress

## Current Session

- **槽 A / `loop/A`：** D16 Lens 夹具：sessionBar 给实测宽、`lens.layout` 走叶宽（300px 才能落到 `is-narrow`），拦住 ResizeObserver loop；删非末会话 / 窄宽 / permission aria 过时断言已改。`conversationLens.test.ts` **21 passing**（剩断言与 after-each 债）。identity 已绿（10/10）。
- **槽 B / `loop/B`：** **ConversationEngineRosterService.cancelGeneration** 接通后转发已进 catalog 的 `AgentService.Cancel`（未知 id / 断连缓存不发；未指定 agent 用末条 streaming 否则 `root`）。Inbox Stop 仅在已连接且有 streaming 行时启用。不改 `conversationLens.test.ts`。此前：其余 Lens 夹具共享 harness；进口界扫 `src/`；`openChatStream` close-gate。
- **槽 C / `loop/C`：** ContinueGeneration + `AgentService.Rename` + `AgentService.Cancel` 进 gRPC catalog；node unary `renameSession`（空 title 清自定义标题）与 `cancelGeneration`（`session_id` + `agent_id`）。Web stub `unsupported_environment`。测：catalog + 转发 / 失败映射。
- **槽 D / `loop/D`：** engine-catalog 诚实回填；D16 stub `deleteTurn` 改走 `createSession()`；Overview 按 E2 隐藏 Provider 行（G-ENG-1 前不画 Unavailable 假摘要）。**ConversationEngineRosterService.renameSession** 接通后转发已进 catalog 的 `AgentService.Rename`（空/未变/未知 id 不发；断连缓存只改本地）。Lens 未接通仍走本地标题。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：A+B+C+D + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | D16 Lens 叶宽夹具 + ResizeObserver |
| B | `vscode-WorkTrees/B` | `loop/B` | Inbox Stop 接通后转发 AgentService.Cancel |
| C | `vscode-WorkTrees/C` | `loop/C` | ContinueGeneration + Rename + Cancel 进 gRPC catalog |
| D | `vscode-WorkTrees/D` | `loop/D` | Overview 隐藏 Provider 行；roster 接通后转发 Rename |
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
| V | D16 剩 `conversationLens.test.ts` 断言债；reveal/trajectory 夹具已隔离 ResizeObserver 中止；D17 与产品验证 |
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration`、`Rename`、`Cancel`；roster 接通后已转发 Rename 与 Cancel（Inbox Stop 未生成仍禁用） |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
