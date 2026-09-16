---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "A 槽 ClearSessionDemoFake/Get·SetModelPreferences 转 bytes。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入
| 切片 | 提交 |
|:-----|:-----|
| **A webhook bytes** | `9512cae07f8` — FireTriggerWebhook / InstallSessionDemoFake **已** bytes。[D24](deferred-gaps.md) **仍开** |
| **F D542** | `8b5c77e1a0e` — dock applySession Permission/Model 双链 |
| **C D543** | `3752a287d51` — roster `void pending` 双链；gitlink 脏勿 add |
| **D D544** | `541134b21ce` — chrome applySessionPermissionIndex 双链 |
| **G D546** | `3311b6b754d` — mermaid Promise 双链；勿 add `out` |
| **H D547** | `595c918837e` — 轨迹详情 beginFetch 双链 |
| **I D548** | `c9076bcbca4` — tablist 循环 Promise 双链 |
| **J D549** | `fb59caeadcd` — loadConnectedComposerCatalogs 双链 |
| **关仓** | compile-client **0**；聚焦 webhook **7** roster **116** dispose-gate **121** 轨迹 **10** split **8** catalog **24** |

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
| [D24](deferred-gaps.md) | **仍开**：webhook/demoFake **已** bytes；ClearSessionDemoFake / Get·SetModelPreferences **已** bytes；ResolveTurn / Connect / SaveSkillContent / Watch·Rebuild 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D542](deferred-gaps.md)–[D550](deferred-gaps.md) | **closed** 本文件 leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。ClearSessionDemoFake / Get·SetModelPreferences **已** bytes。SaveSkillContent 无 RPC。Connect/Watch 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
