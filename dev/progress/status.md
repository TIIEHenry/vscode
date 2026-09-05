---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-05
summary: "Wave 1 治理合入：GFS-1/2/3、packaging P0、cross-repo D1、ADR-007 U0、docs-burden S1–S5（状态列生成、术语闭集、本账、归档标准）、agent-ide.yml CI；U1 上游只读 fetch 进行中"
---

# Development Progress

> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)（生成列）；方案状态 → [plans INDEX](../plans/INDEX.md)（生成列）；延期 → [deferred-gaps](deferred-gaps.md)。历史槽位 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。

## Current Session

### 已合入（`loop/merge` tip `4cd542bc`）

| 切片 | 提交 / 落点 |
|:-----|:------------|
| **GFS-1** | `32f71812` / `32198d0b` — [giant-file-split](../plans/giant-file-split.md)：`grpcClient` mapper 特征测 + facade / mappers / calls 拆分 |
| **GFS-2** | `78bc8bbc` — timeline types / renderer / 门面 |
| **GFS-3** | `c5d791c7` — `conversationLens` 拆 projection / sessionBar / dock / composer |
| **packaging P0** | `b2b91259` / `9b451a1f` — [packaging-and-release](../plans/packaging-and-release.md) §4.0–4.2 只读证实登记；证据见 [packaging-p0-evidence](packaging-p0-evidence.md) |
| **cross-repo D1** | `fb31d650` — [cross-repo-protocol](../plans/cross-repo-protocol.md) 登记处与 [deferred-gaps](deferred-gaps.md) D1 对齐 |
| **ADR-007 U0** | `1f5ce19a` — [upstream-min-patch.md](upstream-min-patch.md)（371 文件 A/B 清单、`comm` 完备性闸门） |
| **docs-burden S1** | `f363f033` — [docs-burden-reduction](../plans/docs-burden-reduction.md)：`generate-docs-status.py` + plans/traceability 生成列 + `docs-health` 钩子 |
| **docs-burden S3** | `4cd542bc` — [docs-burden-reduction](../plans/docs-burden-reduction.md) §3：glossary 对外可读闭集与维护规则指针 |
| **docs-burden S4** | `623de9cf` — 本文件重写为当前迭代账（catalog 流水归档，见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)） |
| **docs-burden S5** | `222dd61c` — [docs-burden-reduction](../plans/docs-burden-reduction.md) §5：DOCUMENTATION 规则 7 归档候选标准 |
| **agent-ide.yml** | `cc6bfd25` — [test-baseline-ci](../plans/test-baseline-ci.md) 切片 4：compile / eslint / docs-health / unit-custom 四 job |

并行 catalog/UI 绑定波（A–D 槽）已合入 tip；逐条流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)，不在本账复述。

八份治理方案签收与 Wave 排期见 [看板](../parallel/active/verification-governance-plans.md)。钉死调试引擎：[debug-engine](../../docs/guides/debug-engine.md)。

### 进行中

- **ADR-007 U1**（只读）：加 `microsoft/vscode` remote、fetch tags / unshallow、复证 `004a1fbb` 祖先关系，结论写回 [upstream-min-patch.md](upstream-min-patch.md) 文件头（见 [ADR-007](../decisions/007-upstream-sync.md) §5 U1）。

## 工位表（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | 状态 |
|----|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 集成分支 tip `4cd542bc` |
| A | `vscode-WorkTrees/A` | `loop/A` | GFS-3 已合；tip `c5d791c7` |
| B | `vscode-WorkTrees/B` | `loop/B` | test-baseline 切片 4 文档记录；tip `0e4aab79` |
| C | `vscode-WorkTrees/C` | `loop/C` | docs-burden S3–S5 已落；tip `4cd542bc` |
| D | `vscode-WorkTrees/D` | `loop/D` | 待 reset 到 merge tip（当前 `33219d1f`） |
| edit | `Projects/Agents/vscode` | `agent-ide` | 与 merge 同 tip |

## Blockers

无。

## Next

| 项 | 指针 |
|:---|:-----|
| **U1** | [ADR-007](../decisions/007-upstream-sync.md) · [upstream-min-patch.md](upstream-min-patch.md) — 只读 fetch、候选 stable tag、写回清单文件头 |
| **GFS-4** | [giant-file-split](../plans/giant-file-split.md) — Desktop `session-core` 拆分，等 G6 上游删除 |
| **test-baseline 切片 0** | [test-baseline-ci](../plans/test-baseline-ci.md) — D16 账本需先 `npm run compile` 产出 `out/` 再跑三文件单测 |

## 不做

H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
