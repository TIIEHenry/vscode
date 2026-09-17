---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "merge 关仓：leftover D664–D671 关各 call site。compile-client 0。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 17 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `578739b020b` — gettingStarted 两处双链；[D664](deferred-gaps.md) |
| **C leftover** | `feacfd5f995` — survey closeEditor 双链；[D665](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `e015232c7da` — virtual-doc 双链+finally；[D666](deferred-gaps.md) |
| **F leftover** | `8a8c9f746a2` — codex profile 双链；[D667](deferred-gaps.md)；openCodex 仍单链 |
| **G leftover** | `4bf403e46ae` — wordHighlighter 三处双链；[D668](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `221a8d00cde` — formatActions 双链；[D669](deferred-gaps.md) |
| **I leftover** | `e116bde0b3f` — parameterHints delayer 双链；[D670](deferred-gaps.md) |
| **J leftover** | `c33f00cbd1c` — inPlaceReplace 两处双链；[D671](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D671](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
