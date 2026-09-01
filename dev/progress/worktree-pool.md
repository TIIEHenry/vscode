---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M5
created: 2026-08-30
updated: 2026-09-02
summary: "仓外 vscode-WorkTrees 工位表；merge + A–D 全 idle；集成分支 HEAD @ aa71c27f"
---

# Loop 并行工位池（本仓）

> **通用规则 SSOT**：[`dev/loop/worktrees.md`](../loop/worktrees.md)（槽语义、合并流程、门禁）。  
> **本文**：本仓路径、分支、槽占用快照（Loop tick 更新；**不**改套件正文）。

## 路径与基线

| 项 | 值 |
|:---|:---|
| 主仓 | `/home/clarence/Projects/Agents/vscode` |
| 工位根 `$WT_ROOT` | `/home/clarence/Projects/Agents/vscode-WorkTrees` |
| 集成分支（当前） | **`agent-ide`**（merge 槽对齐此分支；非上游 `main`） |
| 集成本次 HEAD | 对齐 `agent-ide` **`aa71c27f`** |
| 工位池 compile 基线 | **`a047fe35`** @ merge 槽 · `npm run compile` **PASS**（0 errors，~25s，2026-09-02） |

## 槽位表（2026-09-02 · 全 idle）

| 槽 | 路径 | 分支 | 状态 | 切片 | 互斥域 |
|:---|:-----|:-----|:-----|:-----|--------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | **idle** | — | — |
| A | `vscode-WorkTrees/A` | `loop/A` | **idle** | — | — |
| B | `vscode-WorkTrees/B` | `loop/B` | **idle** | — | — |
| C | `vscode-WorkTrees/C` | `loop/C` | **idle** | — | — |
| D | `vscode-WorkTrees/D` | `loop/D` | **idle** | — | — |

并行 slice 归属记在 `status.md` 或 parallel board；**槽字母不绑定模块**。

## 扩容（E–J）

套件上限为 **1 merge + 10 字母槽**（`A`…`J`）。本仓首建仅 **A–D**。需扩容时，在基线绿且 `git worktree list` 确认无重复路径后：

```bash
REPO_ROOT="/home/clarence/Projects/Agents/vscode"
WT_ROOT="/home/clarence/Projects/Agents/vscode-WorkTrees"
BASE="agent-ide"
SLOT=E

git -C "$REPO_ROOT" worktree add "$WT_ROOT/$SLOT" -b "loop/$SLOT" "$BASE"
```

## 相关

- [health-gates.md](health-gates.md) · [status.md](status.md) · [deferred-gaps.md](deferred-gaps.md)
