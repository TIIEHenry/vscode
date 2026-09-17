---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "merge 关仓：leftover D648–D655 关各 call site。compile-client 0。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 16 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `80d33ad9710` — hover openSettings 双链；[D648](deferred-gaps.md) |
| **C leftover** | `2164e8f29e6` — setRootConfigValue 双链；[D649](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `0b4809e1c8a` — sessions completions 双链；[D650](deferred-gaps.md) |
| **F leftover** | `f1ab9165728` — workbench completions 两处双链；[D651](deferred-gaps.md) |
| **G leftover** | `dd3b68cca26` — modeSynchronizer applyMode 双链；[D652](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `734b413e40e` — tip handleTipAction 双链；[D653](deferred-gaps.md) |
| **I leftover** | `d9290581b61` — origin openSource 双链；[D654](deferred-gaps.md) |
| **J leftover** | `3823abbf7e0` — tool closeEditors 双链；[D655](deferred-gaps.md) |

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
| [D550](deferred-gaps.md)–[D655](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
