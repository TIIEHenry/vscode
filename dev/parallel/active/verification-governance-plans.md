---
title: "验证与治理方案并行看板"
type: progress
status: active
phase: N/A
updated: 2026-09-05
summary: "八份治理方案签收 accepted；HEAD @ ec2bcbd9eb9 实况：Wave 1 多项已落（GC-1b、GFS-1–3、packaging P0、D1、U0、U1、docs-burden S1–S5、test-baseline 切片 4 workflow）；Desktop GFS-4 已拆 @ 0dd3146cd、本仓 sync open；P1 gulp 与切片 0/1/3 本工位未跑"
---

# 验证与治理方案并行看板

> 本轮 **不**走多方评审（未手动点名）。一篇一文、文件互斥。

| 冲突域 | 产物 | 写者 | 第二轮结论 | 状态 |
|:-------|:-----|:-----|:-----------|:-----|
| plan-008 | `dev/plans/prd-008-engine-e2e.md` | 子 agent → 父 | Reject（C1–C3）→ 改入 | **accepted** |
| plan-ci | `dev/plans/test-baseline-ci.md` | 子 agent → 父 | Reject（政策翻转 + 空跑）→ 改入 | **accepted** |
| adr-007 | `dev/decisions/007-upstream-sync.md` | 子 agent → 父 | 前两次运行连接丢失无输出；第三次（正文内联）Approve with changes（C1–C3）→ 改入 | **accepted** |
| plan-pkg | `dev/plans/packaging-and-release.md` | 子 agent → 父 | Reject（C1–C4）→ 改入 | **accepted** |
| plan-split | `dev/plans/giant-file-split.md` | 子 agent → 父 | Reject（C1–C4）→ 改入 | **accepted** |
| plan-docs | `dev/plans/docs-burden-reduction.md` | 子 agent → 父 | Reject（C1–C3）→ 改入 | **accepted** |
| plan-proto | `dev/plans/cross-repo-protocol.md` | 子 agent → 父 | Reject（C1–C3）→ 改入 | **accepted** |
| plan-020 | `dev/plans/prd-020-turn-fixture-bench.md` | 子 agent → 父 | Reject（C1–C2）→ 改入 | **accepted** |
| indexes | `dev/plans/INDEX.md` · `dev/decisions/INDEX.md` · `status.md` | 父 agent | — | done |

第二轮审查命令（只读）：`agent -p --mode=ask --model cursor-grok-4.6-high --output-format text "<对抗性提示>"`，八份并行，输出在 `/tmp/adv-review/<plan>.md`（临时，不入仓；结论已抄进各方案「审查记录」第二轮表）。

**跨方案实施顺序（签收裁定；**`HEAD` @ `ec2bcbd9eb9`** 实况见下节）：**

1. **Wave 1（可并行）**：GC-1b 配对回路 ∥ PRD-008 E0 ∥ test-baseline 切片 0–4 ∥ packaging P0 ∥ GFS-1a/1b + GFS-2 + GFS-3 ∥ cross-repo D1（docs-only）∥ ADR-007 U0（docs-only）+ U1 只读准备。
2. **Wave 2**：PRD-008 E1–E5（等 GC-1b）；packaging P1–P4；prd-020 B0/B1（等 test-baseline 切片 1）。
3. **Wave 3**：ADR-007 U2 第一次专项合入（等 U0 `comm` 为空 + U1 结论落盘 + test-baseline 切片 4 CI 绿；独占 merge 槽、冻结 A 表文件）；PRD-008 E6 / prd-020 B3（知识层升格）；GFS-4 本仓 sync（Desktop 已拆 @ `0dd3146cd`；G6 @ `48cd90952`）。

> **已过时（勿再排期）：** Wave 2「docs-burden S1 等 `docs-health` job」——S1 已合入且 `agent-ide.yml` `docs-health` job 已存在（`cc6bfd25`），全案 `implemented`（`75e18889`）。Wave 2「GFS-3 等切片 1」——GFS-3 已落（`c5d791c7`），与切片 1 无依赖。

## 实施进度（2026-09-05）

`HEAD` = `ec2bcbd9eb9`（`loop/merge`）。下列为 present-tense 实况，SHA 经 `git merge-base --is-ancestor` 核对在 `HEAD` 上。

### Wave 1 — 已落

| 项 | 提交 / 落点 | 备注 |
|:---|:------------|:-----|
| **GC-1b** | `a551fdef`（Hub 配对回路 + 生产 `confirmPairing` / `cancelPairing`）；`4c8235e`（`connectProfile` → `pairing_required`）；`2ef996d`（recoverTrust 对话框）；`9cbd4ea`（identity gate 合入） | 生产路径已接线；非 Web stub |
| **packaging P0** | `b2b91259` / `9b451a1f` | §4.0–4.2 只读证实；证据 [packaging-p0-evidence.md](../../progress/packaging-p0-evidence.md) |
| **GFS-1a/1b + GFS-2** | `32f71812` / `32198d0b` / `78bc8bbc` | grpcClient 拆分 + mapper 特征测；timeline facade |
| **GFS-3** | `c5d791c7` | `conversationLens` → projection / sessionBar / dock / composer |
| **cross-repo D1** | `fb31d650` | 登记处与 [deferred-gaps](../../progress/deferred-gaps.md) 对齐 |
| **ADR-007 U0** | `1f5ce19a` | [upstream-min-patch.md](../../progress/upstream-min-patch.md) A/B 清单 + `comm` 闸门 |
| **ADR-007 U1** | `1975a1b8ce1` | 只读 fetch + 祖先可用；候选 tag `1.136.0` @ `520fb30b`；详情见 [upstream-min-patch.md](../../progress/upstream-min-patch.md) 文件头 |
| **docs-burden S1–S5** | `f363f033`（S1）… `75e18889`（plan `implemented`） | [docs-burden-reduction.md](../../plans/docs-burden-reduction.md) 全案落地 |
| **test-baseline 切片 4** | `cc6bfd25` | [.github/workflows/agent-ide.yml](../../../.github/workflows/agent-ide.yml) 四 job（compile / eslint / docs-health / unit-custom） |

### Wave 1 — 未跑 / 进行中

| 项 | 状态 | 备注 |
|:---|:-----|:-----|
| **PRD-008 E0** | 未在本看板单独记账 | 仍属 Wave 1 并行项 |
| **test-baseline 切片 0 / 1 / 3** | **未跑** | 本工位未 `compile`，无 `out/`；切片 0 须先跑 D16 三文件单测 |
| **packaging P1** | **未跑** | `gulp vscode-linux-x64` 与产物启动未做（用户 skip compile） |

### Wave 2 — 可启 / 仍阻塞

| 项 | 状态 |
|:---|:-----|
| **PRD-008 E1–E5** | GC-1b 已落 → **可启**（仍须独占冲突域） |
| **packaging P1–P4** | P1 阻塞于 gulp 黄金路径未跑 |
| **prd-020 B0/B1** | 仍等 test-baseline **切片 1**（切片 0 未跑） |

### Wave 3 — 仍 open

| 项 | 前置 |
|:---|:-----|
| **ADR-007 U2** | U0 `comm` 为空 + U1 已合 @ `1975a1b8ce1` + 切片 4 workflow **CI 绿**；独占 merge 槽 |
| **PRD-008 E6 / prd-020 B3** | Wave 2 收尾 + 知识层升格纪律 |
| **GFS-4 sync** | Desktop 已拆 @ `0dd3146cd`（G6 @ `48cd90952`）；本仓 vendored 仍 PIN `02a2ba35`。**Next：** `UA_DESKTOP_REPO=…/UniverseAgentDesktop-WorkTrees/merge npx tsx scripts/sync-universe-agent-session-core.ts` |

**禁止：** 子 agent 改索引、改 PRD 状态、commit、启动多方评审。
