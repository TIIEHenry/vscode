---
title: "验证与治理方案并行看板"
type: progress
status: active
phase: N/A
updated: 2026-09-05
summary: "八份治理方案：第一轮规则 16 改入 → 第二轮 Cursor CLI grok-4.6 对抗审查（7 份 Reject、ADR-007 Approve with changes）→ 父会话逐条复核改入，八份全部签收 accepted"
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

**跨方案实施顺序（签收裁定，摘要见 status.md Next）：**

1. **Wave 1（可并行）**：GC-1b 配对回路（P 槽）∥ PRD-008 E0 ∥ test-baseline 切片 0–4 ∥ packaging P0 ∥ GFS-1a/1b + GFS-2 ∥ cross-repo D1（docs-only）∥ ADR-007 U0 清单初稿（docs-only）+ U1 只读准备。
2. **Wave 2**：PRD-008 E1–E5（等 GC-1b）；packaging P1–P4；docs-burden S1（等 `docs-health` job）；prd-020 B0/B1（等 test-baseline 切片 1）；GFS-3（等切片 1）。
3. **Wave 3**：ADR-007 U2 第一次专项合入（等 U0 `comm` 为空 + test-baseline 切片 4 绿；独占 merge 槽、冻结 A 表文件）；docs-burden S3–S5；PRD-008 E6 / prd-020 B3（知识层升格）；GFS-4（等 G6 上游删除，Desktop 写者与 G-CORE-1 / G2 串行）。

**禁止：** 子 agent 改索引、改 PRD 状态、commit、启动多方评审。
