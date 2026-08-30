---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M0
created: 2026-08-30
updated: 2026-08-31
summary: "仓外 vscode-WorkTrees 工位表；M0 壳合入后 A–D idle；集成分支 agent-ide"
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
| 集成本次 HEAD | **`b283fe19`**（Sources+四钮 + 文档刷新；pin `004a1fbb`） |

## 槽位表（2026-08-31 M0 合入后）

| 槽 | 路径 | 分支 | 状态 | 备注 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `idle` | 已对齐 `agent-ide` |
| A | `vscode-WorkTrees/A` | `loop/A` | `idle` | 已合入 |
| B | `vscode-WorkTrees/B` | `loop/B` | `idle` | 已合入 |
| C | `vscode-WorkTrees/C` | `loop/C` | `idle` | 文档刷新已合入 |
| D | `vscode-WorkTrees/D` | `loop/D` | `idle` | |

并行 slice 归属记在 `status.md` 或 parallel board；**槽字母不绑定模块**（上表为当前 M0 tick 快照）。

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
