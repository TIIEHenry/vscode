---
title: "Loop 健康检查 Gate（本仓命令）"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-02
summary: "M7 UI 开发继续规则：测试债旁路；compile/启动、安全/数据/分层为硬门；valid-layers-check 继续豁免"
---

# Loop 健康检查 Gate

> **项目专属：命令**。冷却 / verify-only 策略见 [`dev/loop/health-gates.md`](../loop/health-gates.md)。  
> 集成分支当前为 **`agent-ide`**（M0 拓扑手术在途；日后若切回 `main` 须同步更新本文与 [`worktree-pool.md`](worktree-pool.md)）。

## 开发继续规则

用户于 2026-09-02 明确要求测试不阻塞 UI 开发。M7 起按下表执行：

| 结果 | 是否阻塞后续 UI 切片 | 处置 |
|------|----------------------|------|
| 单测、E2E、视觉、a11y、性能失败 | 否 | 登记 [D17](deferred-gaps.md)，V 槽并行修复 |
| 既有基线失败 | 否 | 标明 baseline SHA，不归因给当前切片 |
| 方案**逐条点名**的断言替换（须写明测试文件、旧断言、新期望；目前仅 `settingsUaToc.test.ts:253` `ua.client.*` 负向 → 白名单） | 否，且不记 D17 | 由该切片自己改；未点名的红测一律记 D17 |
| 缺 Engine/Hub/Web 验证环境 | 否 | 代码状态与证据状态分开；不得升 `implemented` |
| 当前改动无法编译或 Workbench 无法启动 | 阻塞该冲突域合入 | 当前 owner 修复；其他槽继续 |
| 数据损坏、权限绕过、secret 泄漏 | 是，全局硬门 | 停止相关开发并修复 |
| `local/code-layering` 或 boundary 测证明生产边界破坏 | 阻塞该冲突域合入 | 修正依赖方向 |

测试失败不阻塞“下一切片开工”，也不等于测试可以删除、跳过或伪造通过；它只阻止对应 plan / PRD 升 `implemented`。

## 集成检查

```bash
npm run compile
npm run eslint
```

分层或跨模块变更在合入冲突域前应跑二者；失败时按上表分类。仅局部 TypeScript 变更可先用 `npm run compile-client` 代替全量 `compile`（见 [copilot-instructions.md](../../.github/copilot-instructions.md)）。触及 `contrib/conversation` / `contrib/sources` / `platform/universeAgent` 的切片仍运行对应目录单测，但普通红测进入 D17，不冻结不冲突 UI 槽。

**分层门**：ESLint `local/code-layering`（`common` / `browser` / `electron-browser` 不得见 `node`；对 `platform/universeAgent/**` 为 error，其余 warn）+ stream-timeline S1 落下的 platform 级 boundary 测。

**`valid-layers-check` 豁免（2026-09-02 裁决，[D8](deferred-gaps.md)）**：该命令第二阶段 `layersTypeCheck` 在本机 Node 24 / 26 均因 DOM / WebGPU / File System Access TS lib 缺失全量红（166× TS），与本仓业务变更无关，且它本就不查 import path。**D8 修好前不作集成门禁、不进 Blockers、不得作为 closeout 或 OV 的 FAIL 理由**；恢复条件见 D8 Exit。

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
| Grand | 距 status 上次全量 `npm run compile` + `npm run eslint` 绿 ≥ 8 tick，或大 slice 闭合后 1 次 |
| 文档健康 | `check-docs-health` → 0 errors；`dev/progress/status.md` ≤ 200 行 |
| verify-only tick | 不得连续两轮；须 status 写明 sentinel 目的 |
