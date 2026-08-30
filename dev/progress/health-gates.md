---
title: "Loop 健康检查 Gate（本仓命令）"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-08-30
summary: "项目侧 gate 命令 SSOT；策略见套件 dev/loop/health-gates.md；本仓集成门禁为 compile + valid-layers-check。"
---

# Loop 健康检查 Gate

> **项目专属：命令**。冷却 / verify-only 策略见 [`dev/loop/health-gates.md`](../loop/health-gates.md)。  
> 集成分支当前为 **`agent-ide`**（M0 拓扑手术在途；日后若切回 `main` 须同步更新本文与 [`worktree-pool.md`](worktree-pool.md)）。

## 集成门禁

```bash
npm run compile
npm run valid-layers-check
```

分层或跨模块变更时二者皆须绿；仅局部 TypeScript 变更可先用 `npm run compile-client` 代替全量 `compile`（见 [copilot-instructions.md](../../.github/copilot-instructions.md)）。

文档健康（提交前建议）：

```bash
python3 scripts/check-docs-health.py
```

## 合并两边保留门禁（按需）

本仓**尚无** `scripts/check-merge-both-sides.sh`。合并字母槽后若需机器门禁，从消费仓移植脚本并在本节补命令；规格见套件 `dev/loop/worktrees.md` §5.1–5.2。

## 冷却（与套件通用层一致）

| Gate 类型 | 规则 |
|:----------|:-----|
| 聚焦 | 同域连续 2 tick 绿且无该域 prod 变更 → 下轮禁止再跑 |
| Grand | 距 status 上次全量 `npm run compile` + `valid-layers-check` 绿 ≥ 8 tick，或大 slice 闭合后 1 次 |
| 文档健康 | `check-docs-health` → 0 errors；`dev/progress/status.md` ≤ 200 行 |
| verify-only tick | 不得连续两轮；须 status 写明 sentinel 目的 |
