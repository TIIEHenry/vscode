---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "F 槽 TestModelProfile wire（params unread）；grpcClient 仍 JSON。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 关仓后填）
| 切片 | 提交 |
|:-----|:-----|
| **A prefs bytes** | `cb9d59c20a2` — ClearSessionDemoFake / Get·SetModelPreferences **已** bytes。[D24](deferred-gaps.md) **仍开** |
| **C D550** | `95c9a834ff9` — Inbox Goal/Enqueue 双链；gitlink 脏勿 add |
| **D D551** | `f897e47eab2` — history list refresh 四处双链 |
| **F wire** | `7499c57fc11` — SwitchWorkDir wire；未接线 |
| **G wire** | `4338b680765` — Compact wire；勿 add `out` |
| **H wire** | `a18bc9fa6f3` — Todo wire |
| **I wire** | `474e27ca376` — Usage wire（10/11 unread） |
| **J wire** | `2616802221a` — Status wire（children/model_info unread） |
| **关仓** | compile-client **0**；聚焦 clear **5** prefs **7** SwitchWorkDir **4** Compact **4** Todo **4** Usage **4** Status **5** webhook **7** inbox **49** history **16** |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **F** | TestModelProfile wire（`params`=6 unread / omit）；grpcClient 仍 JSON；[D24](deferred-gaps.md) **仍开** |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Clear/Get·SetModelPreferences **已** bytes；SwitchWorkDir/Compact/Todo/Usage/Status/TestModelProfile wire 未接线（params unread）；ResolveTurn/Connect/SaveSkillContent/Watch·Rebuild 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D551](deferred-gaps.md) | **closed** 本文件 leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。A 下一刀接 SwitchWorkDir/Compact/Todo/Usage/Status/TestModelProfile。SaveSkillContent 无 RPC。Connect/Watch 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
