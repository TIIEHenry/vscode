---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "G：pluginList 三处 Delayer.trigger 双链；D596。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 30 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `d289053fc3e` — dictation executeCommand 双链；[D584](deferred-gaps.md) |
| **C leftover** | `6c9b0ac4a97` — chatPlanReviewPart markUsed/feedback 双链；[D585](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `ee4f2b0669c` — sessionsSignInDialog footer executeCommand 双链；[D586](deferred-gaps.md) |
| **F leftover** | `655d6d77e4f` — promptFileContributions delayer.trigger 双链；[D587](deferred-gaps.md) |
| **G leftover** | `7fa46de7aff` — pluginList 列表 renderer Install 双链；[D588](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `9ff1ae3f6fa` — chatAttachmentWidgets renderPreviewImage/readFile 双链；[D589](deferred-gaps.md) |
| **I leftover** | `638551b508a` — editor 两处 showEmbeddedEditor 双链；[D590](deferred-gaps.md) |
| **J leftover** | `4f4cce10fc6` — chatWidget requestModelByIdentifier 双链；[D591](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **G** | Delayer trigger 三处双链；[D596](deferred-gaps.md)；勿 add `out` |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D596](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
