---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-09-13
summary: "仓外 vscode-WorkTrees；基线 agent-ide；MERGE_SHA a6ebd8de7ac 已 push"
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
| 集成本次 HEAD | `a6ebd8de7ac`（`loop/merge` · 2026-09-13 关仓；已 push `origin/agent-ide`） |
| 工位池 compile | compile-client 0 @ `a6ebd8de7ac` |

## 槽位表（2026-09-13 · `MERGE_SHA`=`a6ebd8de7ac`）

| 槽 | 路径 | 分支 | tip | 状态 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `a6ebd8de7ac` | `parked`；== `origin/agent-ide` |
| A | `vscode-WorkTrees/A` | `loop/A` | `a6ebd8de7ac` | `idle` |
| B | `vscode-WorkTrees/B` | `loop/B` | `28ffd1ae9f2` | tip 已合；脏 `worktree-pool.md` 勿 `-B` |
| C | `vscode-WorkTrees/C` | `loop/C` | `815b4ad48e3` | 脏 `dev/loop`；勿 add；未 `-B` |
| D | `vscode-WorkTrees/D` | `loop/D` | `a6ebd8de7ac` | `idle` |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `41f0d8c912f` | `blocked` leftover；勿 `checkout -B` |
| edit | `Projects/Agents/vscode` | `agent-ide` | `815b4ad48e3` | 脏树未代拉；请人类自行 ff |

并行归属见 [status.md](status.md)。M7 看板已归档：[m7-ui-completion](../parallel/archive/m7-ui-completion.md)。本波无独立 parallel board。

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
