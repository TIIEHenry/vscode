---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 C：subscribeSessionEventStream 补 onClosed（合同+传输）；宿主未折 streamClosed"
---

# Development Progress

## Current Session

- **槽 C / `loop/C`：** 对齐 `loop/merge` `a9fd77d4` 后补 `subscribeSessionEventStream` 第三参 `onClosed`（与 Chat / ContinueGeneration 同 `UniverseAgentSessionStreamCloseCause`）。`makeServerStreamClient` 用共用 `createStreamCloseGate`：远端 `end`→`remote`、`error`→`error`；本地 dispose 先 `closeLocal` 以免 CANCELLED 再回调。连接服务原样转发。**未改** `sessionViewHost`（不声称 Actor 已收 `streamClosed`）。
- **merge / `loop/merge`：** 合入槽 A `4c8235e6`（GC-1b `connectProfile` pairing gate）与槽 B `d19e2783`（chevron `transition` 只挂 `.ua-motion`）。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：A+B + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | GC-1b pairing gate（已合） |
| B | `vscode-WorkTrees/B` | `loop/B` | ua-motion a11y 收口（已合） |
| C | `vscode-WorkTrees/C` | `loop/C` | SessionEventStream `onClosed` 合同+传输 |
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
| SessionEventStream close | 宿主把 `onClosed` 折成 Actor `streamClosed`（本切片只落合同+传输） |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
