---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "合入 D24 四条服务端流 bytes + unread decode + client-stream helper。compile-client 0；聚焦 62 passing。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 见下；compile-client 0；聚焦 62 passing）
| 切片 | 提交 |
|:-----|:-----|
| **A 四流 bytes** | `d7754adb481` — SubscribeToolDetail / Rebuild / RemoteChat / Download |
| **C decode** | `88a3e669d16` — History `messages`=1 |
| **D decode** | `e0054aa79cc` — ResolveModel ModelEntry 1–9 |
| **F decode** | `0fe24d1e787` — SaveConfig `connection_test` 标量 1–4 |
| **G helper** | `13172ee8e4c` — `makeClientStreamBytesClient`；Upload 仍 JSON |
| **H decode** | `0c9e3ca7f58` — CheckConnection nested 5/6/7 |
| **I encode** | `f7dc39e3ae7` — TestModelProfile `params`=6 |
| **J decode** | `1a5ef2a31c3` — GetNode capabilities/load |
| **A D24 流** | `ae31bd96fc7` — Continue/Regenerate/Resume bytes；[D24](deferred-gaps.md) 仍开 |

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
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON；Upload 仍 JSON |
| [D487](deferred-gaps.md) | **closed** Memory `score`=4 IEEE 754 LE |
| [D550](deferred-gaps.md)–[D674](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。下一刀接线 Upload（`makeClientStreamBytesClient` 已落）。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
