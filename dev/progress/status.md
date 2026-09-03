---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-04
summary: "槽 C：recoverTrust 身份+指纹确认对话框（ADR-031）接到 pane"
---

# Development Progress

## Current Session

- **槽 C / `loop/C`：** `git merge --ff-only loop/merge` 已快进。
- **本 commit：** Connection pane 对 S4 `recoverTrust` 走独立 identity+fingerprint 对话框（Desktop ADR-031 文案；0× SAS），确认仍 `confirmPairing` / 取消 `cancelPairing`；`connectProfile` 返回 `recoverTrust` + `leafSha256Hex`。node 侧 `confirmRecoverTrust` 钩子仍 auto-approve（与 `confirmSas` 同形：pane 已确认）。未跑全量 compile；pane 新增测绿。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 以 merge 槽 `git` 为准 |
| C | `vscode-WorkTrees/C` | `loop/C` | 本会话：recoverTrust 对话框 |
| A/B/D | `vscode-WorkTrees/{A,B,D}` | `loop/{A,B,D}` | 以各槽 `git` 为准 |
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

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（D22）。
