---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M0
created: 2026-08-30
updated: 2026-08-30
summary: "仓外 vscode-WorkTrees 工位表；集成分支 agent-ide；首建 merge+A–D 五槽；扩容见文末。"
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
| 人类工位 | 主仓根目录；M0 在途时常驻 **`agent-ide`**（日后可切 `edit`，见套件 §人类工位） |

## 槽位表（2026-08-30 初建）

| 槽 | 路径 | 分支 | 状态 | 备注 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `idle` | 集成合并轨；须随时对齐 `agent-ide` |
| A | `vscode-WorkTrees/A` | `loop/A` | `idle` | 字母槽 |
| B | `vscode-WorkTrees/B` | `loop/B` | `idle` | 字母槽 |
| C | `vscode-WorkTrees/C` | `loop/C` | `idle` | 字母槽 |
| D | `vscode-WorkTrees/D` | `loop/D` | `idle` | 字母槽 |

并行 slice 归属记在 `status.md` 或 parallel board；**槽字母不绑定模块**。

## 扩容（E–J）

套件上限为 **1 merge + 10 字母槽**（`A`…`J`）。本仓首建仅 **A–D**（磁盘考虑）。需扩容时，在基线绿且 `git worktree list` 确认无重复路径后：

```bash
REPO_ROOT="/home/clarence/Projects/Agents/vscode"
WT_ROOT="/home/clarence/Projects/Agents/vscode-WorkTrees"
BASE="agent-ide"   # 或当时的集成分支
SLOT=E             # E … J

git -C "$REPO_ROOT" worktree add "$WT_ROOT/$SLOT" -b "loop/$SLOT" "$BASE"
```

扩容后更新上表并（若需要）在 `status.md` 记一笔。

## 相关

- [health-gates.md](health-gates.md) — 占槽前集成编译命令  
- [status.md](status.md) — 当前 tick / slice 与槽占用（Loop 主读路径）
