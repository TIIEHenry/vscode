---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "C leftover：Claude picker opener 双链。D609。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 20 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `69287028668` — mcpList delayedFilter 双链；[D600](deferred-gaps.md) |
| **C leftover** | `2d627438c7a` — modePicker OpenEditor 双链；[D601](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `25bc0964168` — newChatInput toggleDictation 双链；[D602](deferred-gaps.md) |
| **F leftover** | `9c2eaf08c9f` — automationsView 六处双链；[D603](deferred-gaps.md) |
| **G leftover** | `ea5c1b1397d` — desktopSessionLayout 七处双链；[D604](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `08c49e4fa77` — sessionCustomizations OpenEditor 双链；[D605](deferred-gaps.md) |
| **I leftover** | `4854e1a5066` — account pet executeCommand 双链；[D606](deferred-gaps.md) |
| **J leftover** | `9a1ee055b02` — sessionsMouseNavigation 翻页双链；[D607](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **C** | leftover `loop/C-d24-claude-picker-leftover` @ `72291665ec79`；D609 opener 双链；mocha 源扫 2/0；未 commit；gitlink 脏勿 add；勿 add `out` |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D609](deferred-gaps.md) | **closed** leftover catch（本槽 D609）；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
