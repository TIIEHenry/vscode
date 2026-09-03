---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 C：ContinueGeneration 宿主 onClosed 拆句柄，不折 Actor streamClosed"
---

# Development Progress

## Current Session

- **槽 C / `loop/C`：** ff-merge `loop/merge` `9688b303` 后，`SessionViewHost.openContinuation` 把 optional `openContinuationStream` 的 remote/error `onClosed` 接到句柄表：拆句柄并 warn，**不**折 Actor `streamClosed`（时间线仍走 SessionEventStream）。断连 / 再次 Continue 先本地 dispose。测：`sessionViewHostContinuationClose`。
- **槽 A / `loop/A`：** 宿主已把 SessionEventStream remote/error `onClosed` 经 `postAndDrain` 折成 Actor `streamClosed`（已在 merge tip）。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：A+B + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | 宿主 `streamClosed` 折 remote/error |
| B | `vscode-WorkTrees/B` | `loop/B` | ua-motion a11y 收口（已合） |
| C | `vscode-WorkTrees/C` | `loop/C` | ContinueGeneration 宿主 `onClosed` |
| D | `vscode-WorkTrees/D` | `loop/D` | 以该槽 `git` 为准 |
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
| SessionEventStream close | 宿主已折 remote/error → Actor `streamClosed`；ContinueGeneration 宿主 `onClosed` 已接线（传输仍未进 gRPC catalog） |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
