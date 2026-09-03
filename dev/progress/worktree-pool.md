---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-09-03
summary: "仓外 vscode-WorkTrees；merge + A–D idle；P5 compile PASS @ Node 24.18.0"
---

# Loop 并行工位池（本仓）

> **通用规则 SSOT**：[`dev/loop/worktrees.md`](../loop/worktrees.md)。  
> **本文**：本仓路径、分支、槽占用快照。

## 路径与基线

| 项 | 值 |
|:---|:---|
| 主仓 | `/home/clarence/Projects/Agents/vscode` |
| 工位根 `$WT_ROOT` | `/home/clarence/Projects/Agents/vscode-WorkTrees` |
| 集成分支（当前） | **`agent-ide`**（merge 槽对齐此分支；非上游 `main`） |
| 集成本次 HEAD | 见本提交（compile 复绿后的 merge HEAD） |
| 工位池 compile | **本提交** @ merge · `npm run compile` **PASS**（2026-09-03，Node v24.18.0，0 errors） |

## 槽位表（2026-09-03 · 关仓）

| 槽 | 路径 | 分支 | 状态 | 切片 | 互斥域 |
|:---|:-----|:-----|:-----|:-----|--------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | **未 parked** | — | — |
| A | `vscode-WorkTrees/A` | `loop/A` | **idle** | — | — |
| B | `vscode-WorkTrees/B` | `loop/B` | **idle** | — | — |
| C | `vscode-WorkTrees/C` | `loop/C` | **idle** | — | — |
| D | `vscode-WorkTrees/D` | `loop/D` | **idle** | — | — |

并行归属见 [status.md](status.md)。M7 看板已归档：[m7-ui-completion](../parallel/archive/m7-ui-completion.md)。

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
