---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "J 进行中：GetNode capabilities/load decode。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 37 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A 流 wire** | `4c4d0232288` — SubscribeToolDetail；grpcClient 仍 JSON |
| **C 流 wire** | `fe2482220c4` — Memory Rebuild；grpcClient 仍 JSON |
| **D 流 wire** | `b80b958e628` — RemoteChat；grpcClient 仍 JSON |
| **F 流 wire** | `03804b7a245` — DownloadAttachment；grpcClient 仍 JSON |
| **G 流 wire** | `4ee00b70011` — UploadAttachment；仍 JSON、无 bytes client-stream helper |
| **H decode** | `5a7d59bb7c8` — Status `children`=8；`model_info`=9 仍不读 |
| **I decode** | `75674e62c42` — FetchToolUsageDetail `context_sources`=3 |
| **J decode** | `430a6df7c51` — GetRemoteSessionStatus pending 6/7 |
| **A D24 流** | `ae31bd96fc7` — Continue/Regenerate/Resume bytes；[D24](deferred-gaps.md) 仍开 |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **J** | in progress `d24-getnode-capabilities-load`：GetNode `capabilities`=7 `load`=8 已读；[D24](deferred-gaps.md) **仍开** |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON；四条新流未接线 |
| [D487](deferred-gaps.md) | **closed** Memory `score`=4 IEEE 754 LE |
| [D550](deferred-gaps.md)–[D674](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。下一刀接线 SubscribeToolDetail/Rebuild/RemoteChat/Download；Upload 另加 bytes client-stream。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
