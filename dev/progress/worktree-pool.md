---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-09-05
summary: "仓外 vscode-WorkTrees；基线 agent-ide（非 origin/main）；merge + A–D @ a48a0c53"
---

# Loop 并行工位池（本仓）

> **通用规则 SSOT**：[`dev/loop/worktrees.md`](../loop/worktrees.md)。  
> **本文**：本仓路径、分支、槽占用快照。

> **本仓特例（ADR-007 Decision 4.6 / 5）**  
> 通用 [`worktrees.md`](../loop/worktrees.md) 仍写 `main` / `origin/main`；**本仓工位与 merge 槽的产品基线是 `agent-ide`，不是 `origin/main`。** Agent 读该文时须把文中「对齐 `main`」理解为对齐 **`agent-ide`**（或本地 `git rev-parse agent-ide`）。**禁止** force-push 本仓 `main`；**禁止**在 merge 槽以外 merge `microsoft/vscode` tag（见 [ADR-007](../decisions/007-upstream-sync.md) Decision 4）。U0 曾计划在同提交补 `worktrees.md` 本仓段；子模块未含该对象，特例暂记于此。

## 路径与基线

| 项 | 值 |
|:---|:---|
| 主仓 | `/home/clarence/Projects/Agents/vscode` |
| 工位根 `$WT_ROOT` | `/home/clarence/Projects/Agents/vscode-WorkTrees` |
| 集成分支（当前） | **`agent-ide`**（merge 槽对齐此分支；非上游 `main`） |
| 集成本次 HEAD | `a48a0c532cc`（`loop/merge` tip · 2026-09-05） |
| 工位池 compile | 上次 PASS @ `c104d0af`（2026-09-03，Node v24.18.0）；tip 前进后待复跑 |

## 槽位表（2026-09-05 · 与 merge 同 tip）

| 槽 | 路径 | 分支 | tip | 状态 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `a48a0c532cc` | idle |
| A | `vscode-WorkTrees/A` | `loop/A` | `a48a0c532cc` | idle |
| B | `vscode-WorkTrees/B` | `loop/B` | `a48a0c532cc` | idle |
| C | `vscode-WorkTrees/C` | `loop/C` | `a48a0c532cc` | idle |
| D | `vscode-WorkTrees/D` | `loop/D` | `a48a0c532cc` | idle |
| edit | `Projects/Agents/vscode` | `agent-ide` | `a48a0c532cc` | idle |

并行归属见 [status.md](status.md)。M7 看板已归档：[m7-ui-completion](../parallel/archive/m7-ui-completion.md)。

IDE 调试用引擎 **不是** 本表槽位：仓外 `vscode-debug-engine/`（UA 分离头指针），见 [钉死引擎调试](../../docs/guides/debug-engine.md)。

## 扩容（E–J）

```bash
REPO_ROOT="/home/clarence/Projects/Agents/vscode"
WT_ROOT="/home/clarence/Projects/Agents/vscode-WorkTrees"
BASE="agent-ide"
SLOT=E
git -C "$REPO_ROOT" worktree add "$WT_ROOT/$SLOT" -b "loop/$SLOT" "$BASE"
```

## 相关

- [health-gates.md](health-gates.md) · [status.md](status.md) · [deferred-gaps.md](deferred-gaps.md)
