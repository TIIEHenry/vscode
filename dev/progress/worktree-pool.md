---
title: "Loop 并行工位池（本仓）"
type: progress
status: accepted
phase: M7
created: 2026-08-30
updated: 2026-10-25
summary: "2026-10-25：D1311（55cd0b1a786）已快进合入。未跑 npm run compile，未 push。槽 I 对照代码重选下一刀。H 的 attachments/ 仍未跟踪。"
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
| 集成尖端（`agent-ide`） | D1311 在 `55cd0b1a786`。本账本提交只记合入；写完后 merge 与字母槽、人类工位 `merge --ff-only` 到本提交。 |
| 相对 `origin/agent-ide` | 远程仍是 `9128b870dbe`（2026-09-26）。本提交 ahead 1834、behind 0。未跑 `npm run compile`，未 push。`6ecaeaa3f91` 上 compile-client 退出码 1（505 条 `error TS`，114 个文件）未复跑。 |

## 槽位表（2026-10-25 合入 D1311 后）

| 槽 | 路径 | 分支 | tip | 状态 |
|:---|:-----|:-----|:-----|:-----|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `55cd0b1a786`，随后快进到本账 | 干净，不是 `parked`。快进合入，没有二父 merge commit，没有 `npm run compile` |
| I | `vscode-WorkTrees/I` | `loop/I` | 同上 | `occupied`。对照代码重选下一刀并自行实施。不重做 D1305–D1311，优先 Navigator、编辑器、终端或会话窗。不把 compile-client 的 505 / 147 条 error TS 当成这一刀 |
| A、B、C、D、E、F、G、J | `vscode-WorkTrees/{槽}` | `loop/{槽}` | 同上 | `idle`。工作区干净 |
| H | `vscode-WorkTrees/H` | `loop/H` | 同上 | `blocked`。未跟踪 `attachments/`。勿 add，勿 `checkout -B` |
| 人类工位 | `Projects/Agents/vscode` | `agent-ide` | 本账本提交 | 只记合入。禁止 reset / stash / restore / clean / `checkout -B` |

P0 旧账：字母槽与 merge 曾停在 `59120887458`，人类工位曾在 `10e04195bf0` 上带着审查改动。那些改动已在 `279f2c18f08`。本轮核对时 stash 未再查；不把文档里的进度当成已完成。

并行归属见 [status.md](status.md)。M7 看板已归档：[m7-ui-completion](../parallel/archive/m7-ui-completion.md)。本波无独立 parallel board。`dev/parallel/active/` 里 2026-09 至 2026-10-05 的看板不是本波，本次未归档。

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
