---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-10-13
summary: "2026-10-13：loop/merge 在 a3c079e48c4。干净槽已对齐。C 只脏 dev/loop，H 有未跟踪 attachments。agent-ide 未 ff。未 push。"
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
| 产品尖端（人类工位 `agent-ide`） | `393ccc6e9fd`。未快进。 |
| 集成尖端（`loop/merge`） | `a3c079e48c4`（父 `73c2b545339` 与 `ee503183235`：缓存键被外部删掉或改写后，flush 不再落盘排队的旧写入或旧删除）。未 push。本轮调度未重编译。 |
| 工位池 compile | 本轮未重编译。`recover/*` 只作存档，不在本轮合入。 |

## 槽位表（2026-10-13）

| 槽 | 路径 | 分支 | tip | 状态 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `a3c079e48c4` | 干净。已含 `ee503183235`。未把 `agent-ide` 拉上来 |
| A、B、D、E、F、G、I、J | `vscode-WorkTrees/{槽}` | `loop/{槽}` | `a3c079e48c4` | 干净，已与 `loop/merge` 相同。没有独有提交 |
| C | `vscode-WorkTrees/C` | `loop/C` | `f939ea194b3` | `blocked`。仅脏 `dev/loop` gitlink。勿 add，勿 `checkout -B` |
| H | `vscode-WorkTrees/H` | `loop/H` | `f939ea194b3` | 未跟踪 `attachments/`。勿 add，勿 `checkout -B` |
| 人类工位 | `Projects/Agents/vscode` | `agent-ide` | `393ccc6e9fd` | 会话工作根等未提交改动。13 个 `trajectory-*.png` 删除不进提交。`status.md` 与进站历史重叠，禁止 ff |

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
