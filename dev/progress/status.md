---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "工位 A leftover：D576 关 dictation listen/switch/service refresh 三处 call site。compile-client 0。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（compile-client 0 · 聚焦 8 文件 24 pass）
| 切片 | 提交 |
|:-----|:-----|
| **A leftover** | `d57f0a19d05` — dictationOnboarding startPreview 双链；[D568](deferred-gaps.md) |
| **C leftover** | `12c2bc56a5b` — embeddedMcpServerDetail loadSourceDefinition 双链；[D569](deferred-gaps.md)；gitlink 脏勿 add |
| **D leftover** | `94f049dc8c1` — agentHostSessionListStore refresh 双链；[D570](deferred-gaps.md) |
| **F leftover** | `0e9c7ddc403` — mcpList executeCommand 三处双链；[D571](deferred-gaps.md) |
| **G leftover** | `75b28c80f18` — pluginList filterPlugins 双链；[D572](deferred-gaps.md)；勿 add `out` |
| **H leftover** | `c0670e379d4` — voiceModeOnboarding executeCommand/persist 双链；[D573](deferred-gaps.md) |
| **I leftover** | `713c9b8a81d` — editor setSection/showEmbeddedEditor 双链；[D574](deferred-gaps.md) |
| **J leftover** | `9be916ee04d` — agentPluginsView openEditor 双链；[D575](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **A leftover** | 未 commit：dictation listen/switchMic/service refresh 双链；[D576](deferred-gaps.md) 只关这三处。D24 仍开 |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败（分歧 `ff278772b85`）；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor 仍 JSON |
| [D487](deferred-gaps.md) | **open** Memory score double 未读 |
| [D550](deferred-gaps.md)–[D576](deferred-gaps.md) | **closed** leftover catch；leftover **未**全局完成 |
| [D8](deferred-gaps.md)/[D16](deferred-gaps.md)/[D147](deferred-gaps.md)/[D405](deferred-gaps.md)/[R9](research-queue.md) | **仍开** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。SaveSkillContent 无 RPC。Connect/Watch/ResolveAnchor/ResolveTurn 跳过。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
