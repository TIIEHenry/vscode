---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-05
summary: "八份验证/治理方案经 grok-4.6 第二轮对抗审查、逐条复核改入后全部签收 accepted；跨方案三波排期落看板；未提交、未开实施"
---

# Development Progress

## Current Session

- **治理方案八稿 2026-09-05 签收（`accepted`）：** [prd-008-engine-e2e](../plans/prd-008-engine-e2e.md) · [test-baseline-ci](../plans/test-baseline-ci.md) · [ADR-007](../decisions/007-upstream-sync.md) · [packaging-and-release](../plans/packaging-and-release.md) · [giant-file-split](../plans/giant-file-split.md) · [docs-burden-reduction](../plans/docs-burden-reduction.md) · [cross-repo-protocol](../plans/cross-repo-protocol.md) · [prd-020-turn-fixture-bench](../plans/prd-020-turn-fixture-bench.md)。第二轮为 Cursor CLI `cursor-grok-4.6-high` 只读对抗审查（7 份 Reject、ADR-007 Approve with changes），每条 Critical / Important 经 HEAD 复核后改入，记录在各稿「审查记录」第二轮表；实施顺序见 [看板](../parallel/active/verification-governance-plans.md)。**本会话未 commit**，未开任何实施切片。
- **钉死调试引擎：** 仓外 `vscode-debug-engine/` 听 `127.0.0.1:50061`。[debug-engine](../../docs/guides/debug-engine.md)。升 PRD-008 的 closer 现见 e2e 方案，本行仍不升。
- **仍 accepted：** [session-view-frame-fanout](../plans/session-view-frame-fanout.md) · [m7-gap-closeout](../plans/m7-gap-closeout.md)。D19 已闭；D20 活窗被 `@grpc/grpc-js` 挡住（打包方案承接）。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 跟本提交；push 成功才 `parked` |
| A–D | `vscode-WorkTrees/{A–D}` | `loop/{A–D}` | `idle` |
| edit | `Projects/Agents/vscode` | `agent-ide` | 请自行对齐；仅 IDE 垃圾未跟踪 |

## Blockers

- 无代码硬阻塞。远端是否 parked 以 merge 槽 push 结果为准。
- 非阻塞账：[D8](deferred-gaps.md)–[D20](deferred-gaps.md)（D8/D9/D12/D15–D18、D20；D19 已闭）。

## Next

| 项 | 说明 |
|----|------|
| 远端 | 网络若再断，只从 merge 重推两个 ref |
| W1 / D15 | Web 冒烟 |
| I6 | 发行标识等发布方 |
| V | D16/D17（[test-baseline-ci](../plans/test-baseline-ci.md) 切片 0–4）；D20 活窗 300px（[packaging](../plans/packaging-and-release.md) P0–P2） |
| Wave 1 | GC-1b（P 槽）∥ PRD-008 E0 ∥ test-baseline 切片 0–4 ∥ packaging P0 ∥ GFS-1a/1b + GFS-2 ∥ cross-repo D1 ∥ ADR-007 U0/U1（docs-only / 只读） |
| Wave 2 | PRD-008 E1–E5（等 GC-1b）；packaging P1–P4；docs-burden S1；prd-020 B0/B1 与 GFS-3（等 test-baseline 切片 1） |
| Wave 3 | ADR-007 U2 第一次合入（等 U0 + 切片 4）；docs-burden S3–S5；PRD-008 E6 / prd-020 B3 升格；GFS-4（等 G6 上游删除） |
| GC / fanout | 两份 `accepted`；F1 / GC-1b 为 P 槽优先切片 |

**不做：** H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI。
