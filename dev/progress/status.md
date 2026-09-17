---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "merge 关仓：leftover D640–D647 关各 call site。compile-client 0。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 17 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `17cdbc4998d` — windowNotifier Completed 双链；[D640](deferred-gaps.md) |
| **C leftover** | `efc7a7c8810` — feedback tree reveal 双链；[D641](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `706e499a5bb` — detailPanel queue 双链；[D642](deferred-gaps.md) |
| **F leftover** | `eee897446be` — newSessionStrategy finally 双链；[D643](deferred-gaps.md) |
| **G leftover** | `fb075ed7afe` — terminal close/archive 双链；[D644](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `2b732070373` — sessionsTelemetry 24 处双链；[D645](deferred-gaps.md) |
| **I leftover** | `d542cf1817a` — untitledProvisional 四处双链；[D646](deferred-gaps.md) |
| **J leftover** | `9bb0ad077f4` — signedOut notify 三处双链；[D647](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **A** | hover `openSettings` 双链；[D648](deferred-gaps.md)；D24 仍开；未 commit；勿 add `out` |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **F** | workbench completions 两处 `_registerForScheme` 双链；[D651](deferred-gaps.md)；mocha 2/0；D24 仍开；勿 add `out` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D648](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
