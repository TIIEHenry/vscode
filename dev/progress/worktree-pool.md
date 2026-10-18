---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-10-16
summary: "2026-10-16：loop/merge 在 f551c7400c1。A、B、D、E、F、G、I、J 干净槽已全量 ff 对齐。C 只脏 dev/loop，H 有未跟踪 attachments。人类工位有 82 文件在途重叠未 ff。"
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
| 集成尖端（`loop/merge`） | `f551c7400c1`（第十二批：r02 与 r05 状态收归）。未 push。 |
| 工位池 compile | `flock -x /tmp/vscode-compile.lock npm run transpile-client` 0 错误。109 单测全绿。 |

## 槽位表（2026-10-16）

| 槽 | 路径 | 分支 | tip | 状态 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `f551c7400c1` | `parked`。已合入第十二批（r02/r05）及前十一批全部成果 |
| A、B、D、E、F、G、I、J | `vscode-WorkTrees/{槽}` | `loop/{槽}` | `f551c7400c1` | `idle`。已全量 `git merge --ff-only` 对齐 |
| C | `vscode-WorkTrees/C` | `loop/C` | `e9d176da857` | `blocked`。仅脏 `dev/loop` gitlink。勿 add，勿 `checkout -B` |
| H | `vscode-WorkTrees/H` | `loop/H` | `e9d176da857` | `blocked`。未跟踪 `attachments/`。勿 add，勿 `checkout -B` |
| 人类工位 | `Projects/Agents/vscode` | `agent-ide` | `393ccc6e9fd` | `HUMAN_DECISION_REQUIRED`。工作区含 82 个修改/未跟踪文件与进站提交重叠，`git merge --ff-only` 拒绝覆盖。按关仓 P6 规范严格保留在途修改不丢 WIP |

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
