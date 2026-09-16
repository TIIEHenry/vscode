---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "G 槽 RunToolInBackground wire+测未接线。D24 仍开。勿 add out。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 关仓后填）
| 切片 | 提交 |
|:-----|:-----|
| **A five bytes** | `55b0613d851` — SwitchWorkDir / Compact / Todo / Usage / Status **已** bytes。[D24](deferred-gaps.md) **仍开** |
| **C Pause wire** | `d751b2faf6e` — Pause wire；未接线；gitlink 脏勿 add |
| **D History wire** | `8a85334dc72` — Agent.History wire；未接线 |
| **F TestModelProfile** | `0889a6e4f6c` — TestModelProfile wire（params unread） |
| **G Back wire** | `927b21b180d` — Back wire；勿 add `out` |
| **H Prune wire** | `ee6324961d5` — Prune wire |
| **I Branch wire** | `bf524c7be8a` — Branch wire（0/-1 必写） |
| **J Reset wire** | `a105db577cd` — Reset wire |
| **关仓** | compile-client **0**；聚焦 SwitchWorkDir **5** Compact **5** Todo **5** Usage **5** Status **5** Pause **5** History **5** TestModelProfile **5** Back **4** Prune **5** Branch **5** Reset **5** |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **G** | `d24-run-tool-bg-unary-wire` RunToolInBackground wire+测未接线；勿 add `out`；D24 仍开 |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：五条 Agent unary **已** bytes；Pause/History/TestModelProfile/Back/Prune/Branch/Reset/RunToolInBackground wire 未接线；ResolveTurn/Connect/SaveSkillContent/Watch·Rebuild 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D551](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。A 下一刀接 Pause/History/Back/Prune/Branch/Reset/TestModelProfile/RunToolInBackground。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
