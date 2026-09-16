---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "merge 关仓：leftover D560–D567 关各 call site。compile-client 0。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦待跑）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `a08f3ad5c47` — dictationOnboarding refreshMicrophones 双链；[D560](deferred-gaps.md) |
| **C leftover** | `106602c5b86` — requestAgentTreeRefresh 双链；[D561](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `fde6b4fe250` — hub setActiveHubBaseUrl 双链；[D562](deferred-gaps.md) |
| **F leftover** | `9e18fc967d4` — mcpList action/install 双链；[D563](deferred-gaps.md) |
| **G leftover** | `eec38704cab` — pluginList queryMarketplace 双链；[D564](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `fdd6ddc91f8` — voiceModeOnboarding refreshMicrophones 双链；[D565](deferred-gaps.md) |
| **I leftover** | `f85df2c1bbf` — customization editor 八处 void 双链；[D566](deferred-gaps.md) |
| **J leftover** | `2d1c4352d21` — agentPluginsView show 双链；[D567](deferred-gaps.md) |

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
| [D550](deferred-gaps.md)–[D567](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
