---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "Chat onClosed→chatStreamDown；D16 进口界改扫 src/"
---

# Development Progress

## Current Session

- **槽 A / `loop/A`：** `openResidentChat` remote/error `onClosed` → Actor `chatStreamDown`；`openStream` remote/error → `streamClosed`。测：`sessionViewHostChatClose` / IntentOwner。
- **槽 B / `loop/B`：** 测试桩补 `onClosed`；D16 四份进口界测改扫 `src/`（`>=80` 文件），去掉 `out/` 空扫假绿。
- **槽 C / `loop/C`：** ff-merge `loop/merge` `9688b303` 后，`SessionViewHost.openContinuation` 把 optional `openContinuationStream` 的 remote/error `onClosed` 接到句柄表：拆句柄并 warn，**不**折 Actor `streamClosed`（时间线仍走 SessionEventStream）。断连 / 再次 Continue 先本地 dispose。测：`sessionViewHostContinuationClose`。
- **槽 D / `loop/D`：** ff-merge `loop/merge` `9688b303` 后，按 git 回填知识层 [engine-catalog](../../docs/systems/workbench/engine-catalog.md)：九节两栏 + 六态已是 HEAD，不是「M7 未实施 / Overview 无」。卫星句（glossary / workbench INDEX / protocol §7 / settings-ua-access）同步改口。PRD-025 仍 `accepted`。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本会话：A+B + exhaustiveness 复绿 |
| A | `vscode-WorkTrees/A` | `loop/A` | Chat `chatStreamDown` + EventStream `streamClosed` |
| B | `vscode-WorkTrees/B` | `loop/B` | 桩 `onClosed` + D16 进口界扫 src |
| C | `vscode-WorkTrees/C` | `loop/C` | ContinueGeneration 宿主 `onClosed` |
| D | `vscode-WorkTrees/D` | `loop/D` | engine-catalog 九节诚实回填 |
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
| SessionEventStream close | 三路宿主 `onClosed` 已齐：SessionEventStream → `streamClosed`；Chat → `chatStreamDown`；ContinueGeneration 只拆句柄。传输仍未进 gRPC catalog |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
