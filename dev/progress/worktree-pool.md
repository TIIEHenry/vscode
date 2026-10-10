---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-10-10
summary: "仓外 vscode-WorkTrees；基线 agent-ide。2026-10-10 关仓产品尖端 74a46aabff5。C 仅脏 dev/loop gitlink。未 push origin/main。"
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
| 集成分支（当前） | **`agent-ide`**（与 `loop/merge` 同一产品历史；不是上游 `main`） |
| 产品尖端 | `74a46aabff5`（2026-10-10 19:45:47，`merge: 合入 loop/E 向下拆分测高传入组 id。`） |
| 关仓快照 | 本文件所在提交。干净槽与人类工位快进到该提交。未 push。 |
| 工位池 compile | 未在本次对齐时重跑。merge 上一次整包编译是测高组 id 那次，exit 0；之后没有为关仓再编译。 |

## 槽位表（2026-10-10）

| 槽 | 路径 | 分支 | tip | 状态 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本文件所在提交 | `parked`。产品父 `74a46aabff5` |
| A–B、D–J | `vscode-WorkTrees/{A…J}` | `loop/{slot}` | 同上 | `idle` |
| C | `vscode-WorkTrees/C` | `loop/C` | 同上 | `blocked`；仅脏 `dev/loop` gitlink，勿 add，勿 `checkout -B` |
| 人类工位 | `Projects/Agents/vscode` | `agent-ide` | 同上 | 参加了快进。另有 13 个未提交的 `trajectory-*.png` 删除，未纳入提交 |

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
