---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "D16 identity 夹具；Chat onClosed 门；ContinueGeneration；Rename catalog；Overview 隐藏 Provider 行"
---

# Development Progress

## Current Session

- **槽 A / `loop/A`：** D16 identity 夹具绿（10/10）；Chat remote/error → `chatStreamDown`。
- **槽 B / `loop/B`：** 进口界扫 `src/`；`openChatStream` close-gate 合同测（remote 一次、dispose 静音）。
- **槽 C / `loop/C`：** ContinueGeneration + `AgentService.Rename` 进 gRPC catalog；node unary `renameSession`（空 title 清自定义标题）。Web stub `unsupported_environment`。roster / Lens 仍本地改标题。
- **槽 D / `loop/D`：** engine-catalog 诚实回填；D16 stub `deleteTurn` 改走 `createSession()`；Overview 按 E2 隐藏 Provider 行（G-ENG-1 前不画 Unavailable 假摘要）。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：A+B+C+D + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | D16 identity 夹具 + Chat onClosed |
| B | `vscode-WorkTrees/B` | `loop/B` | 进口界扫 src + Chat close-gate 测 |
| C | `vscode-WorkTrees/C` | `loop/C` | ContinueGeneration + AgentService.Rename 进 gRPC catalog |
| D | `vscode-WorkTrees/D` | `loop/D` | Overview 隐藏 Provider 行 |
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
| V | D16 剩 Lens 断言债；D17 与产品验证 |
| SessionEventStream close | 三路宿主 `onClosed` 已齐。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `ContinueGeneration` 与 `AgentService.Rename`（roster 仍本地标题） |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
