---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "D 已写 ListNodes wire（capabilities/load unread）未接线。仍勿关本行。D24 仍开。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 70）
| 切片 | 提交 |
|:-----|:-----|
| **A seven bytes** | `99db14584d0` — Pause / History / Back / Prune / Branch / Reset / TestModelProfile **已** bytes。[D24](deferred-gaps.md) **仍开** |
| **C SuspendLoop** | `aa761311396` — wire 未接线；gitlink 脏勿 add |
| **D ResumeLoop** | `745e6667e14` — wire 未接线 |
| **F StopLoop** | `12d2a36b3f6` — wire 未接线 |
| **G RunToolBG** | `5f19fa47755` — wire 未接线；勿 add `out` |
| **H StopShellTask** | `83ea1f8435a` — wire 未接线 |
| **I ListLoopSnapshots** | `fa78bad62e8` — wire 未接线 |
| **J FetchToolUsage** | `f825e1c7799` — wire（context_sources unread） |
| **前波** | SwitchWorkDir / Compact / Todo / Usage / Status bytes |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **D** | ListNodes wire（capabilities/load unread）未接线。仍勿关本行 |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：D 已写 ListNodes wire（capabilities/load unread）未接线。仍勿关本行。七条 loop/tool 仍 JSON；ResolveTurn/Connect/SaveSkillContent/Watch 跳过 |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D551](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。A 下一刀接七条 loop/tool wire。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
