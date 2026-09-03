---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-09-03
summary: "仓外 vscode-WorkTrees；merge + A–D idle；集成分支 agent-ide @ 861e509f；P5 compile 红未 parked"
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
| 集成本次 HEAD | 本地 `861e509f`（关仓 P7 文档提交另计） |
| 工位池 compile | **`861e509f`** @ merge · `npm run compile` **FAIL**（2026-09-03，~82× TS，缺 `@grpc/grpc-js`） |
| 上次 compile 绿 | **`a047fe35`** @ merge · PASS（2026-09-02） |

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
