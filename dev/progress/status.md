---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 B：connection 测补齐 openChatStream onClosed 门（与 EventStream / Continue 同合同）"
---

# Development Progress

## Current Session

- **槽 A / `loop/A`：** Chat remote/error → `chatStreamDown`；EventStream remote/error → `streamClosed`。
- **槽 B / `loop/B`：** 传输层 `openChatStream` 合同测：mock 接 `createStreamCloseGate`；remote 只报一次、dispose 后 CANCELLED 静音。与宿主 `chatStreamDown`（槽 A）文件不交。**未改** `sessionViewHost` / D16 Lens。
- **槽 C / `loop/C`：** ContinueGeneration 进 gRPC catalog + node `openContinuationStream`。
- **槽 D / `loop/D`：** engine-catalog 诚实回填；D16 stub `deleteTurn` 改走 `createSession()`。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：A+B + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | Chat `chatStreamDown` + EventStream `streamClosed` |
| B | `vscode-WorkTrees/B` | `loop/B` | connection `openChatStream` onClosed 门 |
| C | `vscode-WorkTrees/C` | `loop/C` | ContinueGeneration 进 gRPC catalog |
| D | `vscode-WorkTrees/D` | `loop/D` | engine-catalog 回填 + stub deleteTurn |
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
| V | D16/D17 与产品验证 |
| SessionEventStream close | 三路宿主 `onClosed` 已齐。connection 测现覆盖 Chat / EventStream / Continue 三路 close gate（remote 一次、dispose 静音）。**传输已进** `UniverseAgentGrpcServices.Agent.ContinueGeneration` |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
