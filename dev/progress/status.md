---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "merge 本波：A Device pair 四条已 bytes；D515–D521 closed。compile-client 0；聚焦 467 passing。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`compile-client` 0；聚焦 467 passing）
| 切片 | 提交 |
|:-----|:-----|
| **A Device pair bytes** | `c158637774a` — PairApprove/PairReject/ListPending/RotateToken **已** bytes。ListPending 空 proto。RotateToken 不解 reserved 2。ListDevices 不重做。[D24](deferred-gaps.md) **仍开** |
| **C D515** | `58008cca4bd` — Triggers 写路径双链 catch。gitlink 脏勿 add |
| **D D516** | `8e2a2803e97` — Preferences Test Engine 双链 catch；未碰 OPEN_CONNECTION |
| **F D517** | `f00f00915b7` — MCP 行内 toggle 双链 catch |
| **G D518** | `ea7de098868` — Connection pane 八处 void+双链；勿 add `out` |
| **H D519** | `7c35d780227` — Skills 行内 toggle 双链 catch |
| **I D520** | `2dfc76a4ba9` — Sources Review list 两处双链 catch |
| **J D521** | `06c67530223` — Navigator Agents 三处单链升双链 |
| **前波** | Permission+Doctor bytes；D508–D514；TokenUsage+Config bytes；D503–D507 |

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
| [D24](deferred-gaps.md) | **仍开**：Device pair 四条 **已** bytes；SaveSkillContent/Rebuild/Watch/model prefs/Revoke 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D515](deferred-gaps.md)–[D521](deferred-gaps.md) | **closed** 本文件 leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开（Revoke / SaveSkillContent / Watch / model prefs）。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
