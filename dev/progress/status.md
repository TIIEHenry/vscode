---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "merge 关仓：leftover D624–D631 关各 call site。compile-client 0。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 18 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `f92bca702e6` — picker finally 双链；[D624](deferred-gaps.md) |
| **C leftover** | `9d240c00f12` — sessionTurnChanges 四处双链；[D625](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `650c4e70f21` — banner revealPR 双链；[D626](deferred-gaps.md) |
| **F leftover** | `b662eed8364` — wsl reconnect 四处双链；[D627](deferred-gaps.md) |
| **G leftover** | `a27b475b1a0` — sandbox discover/disconnect 五处双链；[D628](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `21e83f5d690` — titlebar openSession 两处双链；[D629](deferred-gaps.md) |
| **I leftover** | `d0ff5c46f27` — sessionsView open then 四处双链；[D630](deferred-gaps.md) |
| **J leftover** | `88487609fb2` — chatGroupsView 七处双链；[D631](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **A** | D632 `sessionHeader` inline rename 双链；mocha **2/0**；D24 仍开；不是 leftover/pills 完成 |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D632](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
