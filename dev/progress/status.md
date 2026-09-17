---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "merge 关仓：leftover D632–D639 关各 call site。compile-client 0。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 16 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `07699689d8f` — sessionHeader renameSession 双链；[D632](deferred-gaps.md) |
| **C leftover** | `6ab8765be12` — bannerWidget _runAction 双链；[D633](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `2d4b71046e8` — promptOptions _select 双链；[D634](deferred-gaps.md) |
| **F leftover** | `b8c2e7641a0` — browsersControl _openBrowser 双链；[D635](deferred-gaps.md) |
| **G leftover** | `b2aebd90e7e` — windowNotifier _notify 双链；[D636](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `c1ac20042f9` — sessionsList 三处双链；[D637](deferred-gaps.md) |
| **I leftover** | `536a6e679ae` — feedback reveal 双链；[D638](deferred-gaps.md) |
| **J leftover** | `53f762056ea` — dockedTabs 五处双链；[D639](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **G** | D644 terminal close 两处双链（removed finally / archived）；源扫 **2/0**；勿 add `out`；D24 仍开；不是 leftover 完成 |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D644](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
