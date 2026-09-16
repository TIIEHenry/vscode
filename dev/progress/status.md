---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "F mcpList leftover：D555 关本文件 refresh/query fire-and-forget call site。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 76）
| 切片 | 提交 |
|:-----|:-----|
| **A seven bytes** | `779eaa44829` — GetConfig / DeleteConfig / Reload / Destroy·Cancel·Resume / CheckConnection **已** bytes。[D24](deferred-gaps.md) **仍开** |
| **C Status** | `41ba59ed55a` — GetRemoteSessionStatus wire（pending unread）；gitlink 脏勿 add |
| **D History** | `e3144bc0349` — GetRemoteSessionHistory wire（messages unread） |
| **F CreateSession** | `44b6fac69da` — CreateRemoteSession wire（SessionParams known） |
| **G UploadProgress** | `cff8b77b99e` — GetUploadProgress wire；勿 add `out` |
| **H ResolveModel** | `b571e9f8f5e` — ResolveModel wire（ModelEntry unread） |
| **I SaveConfig** | `e75b477c814` — SaveConfig wire（config nested scalars；connection_test unread） |
| **J leftover** | `da37a0c205e` — sessionViewHost 五处 void 双链；[D552](deferred-gaps.md) 关 call site |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |
| **F** | `loop/F-d24-mcp-list-leftover`：[D555](deferred-gaps.md) 关 mcpList 本文件 call site；未 commit |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：七条 **已** bytes；Status/History/CreateRemoteSession/UploadProgress/ResolveModel/SaveConfig wire 未接线；Connect/SaveSkillContent/Watch 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D552](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D555](deferred-gaps.md) | **closed** mcpListWidget 本文件 call site；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。mcpList leftover 只关本文件 call site。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
