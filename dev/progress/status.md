---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-05
summary: "Wave 1 治理合入 + ADR-007 U0/U1 + GFS-3 residue；merge tip ec2bcbd9eb9；Desktop GFS-4 已拆 @ 0dd3146cd；本仓 vendored 仍 PIN 02a2ba35；Next vscode sync；U2 未开"
---

# Development Progress

> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)（生成列）；方案状态 → [plans INDEX](../plans/INDEX.md)（生成列）；延期 → [deferred-gaps](deferred-gaps.md)。历史槽位 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。

## Current Session

### 已合入（`loop/merge` tip `ec2bcbd9eb9`）

| 切片 | 提交 / 落点 |
|:-----|:------------|
| **GFS-1** | `32f71812` / `32198d0b` — [giant-file-split](../plans/giant-file-split.md)：`grpcClient` mapper 特征测 + facade / mappers / calls 拆分 |
| **GFS-2** | `78bc8bbc` — timeline types / renderer / 门面 |
| **GFS-3** | `c5d791c7` — `conversationLens` 拆 projection / sessionBar / dock / composer / composerChrome |
| **GFS-3 residue** | `533fc6c42d5` — `conversationLensReadingColumn.ts` + `conversationLensSessionBinding.ts`；门面 `conversationLens.ts` **783** 行 |
| **Desktop G6** | `48cd90952` @ UniverseAgentDesktop `loop/merge` — 上游删四处 dead `SessionActor` private；vitest 1419 绿 |
| **Desktop GFS-4** | `0dd3146cd` @ UniverseAgentDesktop `loop/merge` — `session-actor` 拆为 fold 模块（门面 736 + stream 733 + overlay 288 + local-fact 659 + timeline-items 138 + chat-outbox 220；均 ≤800）；**本仓未 sync，不得声称 GFS-4 已落** |
| **lens-assembly honesty** | `72ae9907` — [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) GFS-3 拆后同步 |
| **packaging P0** | `b2b91259` / `9b451a1f` — [packaging-and-release](../plans/packaging-and-release.md) §4.0–4.2 只读证实登记；证据见 [packaging-p0-evidence](packaging-p0-evidence.md) |
| **cross-repo D1** | `fb31d650` — [cross-repo-protocol](../plans/cross-repo-protocol.md) 登记处与 [deferred-gaps](deferred-gaps.md) D1 对齐 |
| **ADR-007 U0** | `1f5ce19a` — [upstream-min-patch.md](upstream-min-patch.md)（371 文件 A/B 清单、`comm` 完备性闸门） |
| **ADR-007 U1** | `1975a1b8ce1` — 只读 fetch + 祖先可用；候选 tag `1.136.0` @ `520fb30b`；详情见 [upstream-min-patch.md](upstream-min-patch.md) 文件头 |
| **docs-burden S1** | `f363f033` — [docs-burden-reduction](../plans/docs-burden-reduction.md)：`generate-docs-status.py` + plans/traceability 生成列 + `docs-health` 钩子 |
| **docs-burden S3** | `4cd542bc` — [docs-burden-reduction](../plans/docs-burden-reduction.md) §3：glossary 对外可读闭集与维护规则指针 |
| **docs-burden S4** | `623de9cf` — 本文件重写为当前迭代账（catalog 流水归档，见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)） |
| **docs-burden S5** | `222dd61c` — [docs-burden-reduction](../plans/docs-burden-reduction.md) §5：DOCUMENTATION 规则 7 归档候选标准 |
| **agent-ide.yml** | `cc6bfd25` — [test-baseline-ci](../plans/test-baseline-ci.md) 切片 4：compile / eslint / docs-health / unit-custom 四 job |

并行 catalog/UI 绑定波（A–D 槽）已合入 tip；逐条流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)，不在本账复述。

八份治理方案签收与 Wave 排期见 [看板](../parallel/active/verification-governance-plans.md)。钉死调试引擎：[debug-engine](../../docs/guides/debug-engine.md)。

### 进行中

无。U1 已合；**U2 未开**（见 Next / 不做）。

## 工位表（与 `git worktree list` 对照 · 2026-09-05）

| 槽 | 路径 | 分支 | tip |
|----|------|------|-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `ec2bcbd9eb9` |
| A | `vscode-WorkTrees/A` | `loop/A` | `ec2bcbd9eb9` |
| B | `vscode-WorkTrees/B` | `loop/B` | `ec2bcbd9eb9` |
| C | `vscode-WorkTrees/C` | `loop/C` | `ec2bcbd9eb9` |
| D | `vscode-WorkTrees/D` | `loop/D` | `ec2bcbd9eb9` |
| edit | `Projects/Agents/vscode` | `agent-ide` | `ec2bcbd9eb9` |

## Blockers

无。

## Next

| 项 | 指针 |
|:---|:-----|
| **GFS-4 sync** | [giant-file-split](../plans/giant-file-split.md) — Desktop 已拆 @ `0dd3146cd`（G6 @ `48cd90952`）；本仓 vendored 仍 PIN `02a2ba35`。**Next：** `UA_DESKTOP_REPO=…/UniverseAgentDesktop-WorkTrees/merge npx tsx scripts/sync-universe-agent-session-core.ts`；sync 后才能在本文档声称 GFS-4 已落 |
| **test-baseline 切片 0** | [test-baseline-ci](../plans/test-baseline-ci.md) — D16 账本需先 `npm run compile` 产出 `out/` 再跑三文件单测 |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 — 须 U0 `comm` 空 + U1 完成 + CI 绿 + merge 独占 + A 表冻结；**未满足前不开 U2**（当前优先 GFS-4，非 U2） |

## 不做

**ADR-007 U2**（第一次上游 tag 合入）、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
