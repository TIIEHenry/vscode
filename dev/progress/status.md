---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "merge compile-client 0；聚焦 9 文件 309 passing / 0 fail。工位 D：Plugins 写路径双链 catch。[D509](deferred-gaps.md) **closed（本文件写路径）**。leftover 未全局完成。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)；方案 → [plans INDEX](../plans/INDEX.md)；延期 → [deferred-gaps](deferred-gaps.md)。历史 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`npm run compile-client` 0；聚焦 **309 passing / 0 fail**）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **A TokenUsage+Config bytes** | `ae3c8b971d9` — GetSessionUsage/GetGlobalUsage + Config Get/Set **已** `makeUnaryBytesClient`。GetGlobalUsage 空 proto 非 JSON `{}`。[D24](deferred-gaps.md) **仍开** |
| **F SetPermissionPolicy wire** | `7be5ef1768a` — `grpcConfigPermissionUnaryWire`；**未接线** grpcClient |
| **G Doctor wire** | `006ac22c0b8` — `grpcSystemUnaryWire` Doctor；**未接线**；**勿 add `out`** |
| **C D503** | `e8dbe12603c` — ProviderModel 四处双链 catch。[D503](deferred-gaps.md) **closed**。C `dev/loop` gitlink 脏，cascade **勿 add** |
| **D D504** | `9724e41b6bf` — Rules 三处双链 catch。[D504](deferred-gaps.md) **closed** |
| **H D505** | `48aaef0ebfb` — Hooks 三处双链 catch。[D505](deferred-gaps.md) **closed** |
| **I D506** | `ac22278fc01` — MCP definitions 八处双链 catch。[D506](deferred-gaps.md) **closed**。非 runtime（D501） |
| **J D507** | `adfde997b56` — Connection pane 九处双链 catch。[D507](deferred-gaps.md) **closed** |
| **前波** | A Health/ContextVariable bytes / F TokenUsage wire / G Config Get+Set wire / C–J D498–D502；D487 open |

更早流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。钉死引擎：[debug-engine](../../docs/guides/debug-engine.md)。**D25/D26 已闭**。**不升 PRD-008**。不是 leftover/pills 完成。
### 进行中（2026-09-16 · merge 关仓；D24 仍开）
| 槽 | 切片 | 状态 |
|:---|:-----|:---------|
| **A** | TokenUsage+Config bytes | 已合入 merge。[D24](deferred-gaps.md) **仍开** |
| **F** | SetPermissionPolicy wire | 已合入；**未接线** |
| **G** | Doctor wire | 已合入；**勿 add `out`** |
| **C** | D503 | 保持 `dev/loop` gitlink 脏；勿 add。[D503](deferred-gaps.md) closed |
| **D** | leftover-d509-engine-plugins-writes | 未 commit。Plugins scan/enable/reload/unload 四处双链 catch。[D509](deferred-gaps.md) **closed（本文件写路径）**；leftover **未**全局完成。[D24](deferred-gaps.md) **仍开** |
| **H/I/J** | D505–D507 | 已合入 merge |
| **B** | — | 脏 `worktree-pool.md`；**跳过**；勿 `-B` |
| **E** | leftover `fix/ci-gate-reds` | `blocked`；勿 `checkout -B` |
| **edit** | `agent-ide` | **仅 ff-only**；非祖先则失败并记录；勿 reset/checkout/stash |

子 agent 发现的既有代码问题（开项 + 本波）：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D24](deferred-gaps.md) | A/F/G | **仍开**：TokenUsage+Config Get/Set **已** bytes；SetPermissionPolicy/Doctor wire **未接线**；SaveSkillContent/Rebuild/Watch/model prefs 仍 JSON |
| [D487](deferred-gaps.md) | Memory | **open**：codec 无 double；Search score 未读 |
| [D503](deferred-gaps.md)–[D507](deferred-gaps.md) | C/D/H/I/J | **closed** ProviderModel / Rules / Hooks / MCP definitions / Connection pane void catch |
| [D509](deferred-gaps.md) | D 槽 leftover-d509-engine-plugins-writes | **closed（本文件写路径）**：scan/enable/reload/unload 双链 catch；leftover 未全局完成。不重开 D502 |
| [D405](deferred-gaps.md) | 手测 | **仍开**（S4a/S4b 前置） |
| [D16](deferred-gaps.md) / [D8](deferred-gaps.md) / [D147](deferred-gaps.md) | 基线 | **仍开**；勿开切片 1；勿降 `min_cases` |
| [D31](deferred-gaps.md) | Sources | **仍开**（剩 F4）；不升 PRD |
| [R8](research-queue.md) | B | **closed**；[R9](research-queue.md) 仍开 |
## 工位表（P0 盘点 · 2026-09-16）
| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | MERGE_SHA | 干净 | 0 | compile-client 0；309 passing；D24 仍开 |
| A–J except B/E | `vscode-WorkTrees/{A,C,D,F–J}` | `loop/*` | 本波 tip | C gitlink；G `out` | 0 | cascade ff-only；C 勿 add gitlink；G 勿 add `out` |
| B | `vscode-WorkTrees/B` | `loop/B` | `28ffd1ae9f2` | 脏 `worktree-pool.md` | 0 | **跳过**；勿 `-B` |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `41f0d8c912f` | 干净 | 0 | `blocked`；跳过 |
| edit | `Projects/Agents/vscode` | `agent-ide` | 分歧 | `dev/loop`+docs | 0 | 仅 ff-only；勿 reset |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **loop 切片** | [D24](deferred-gaps.md) **仍开**（SaveSkillContent/Rebuild/Watch/GetModelPreferences/SetModelPreferences/ResolveModel 仍 JSON；SetPermissionPolicy/Doctor wire 未接线）。[D509](deferred-gaps.md) **closed（本文件写路径）**；leftover **未**全局完成。[D503](deferred-gaps.md)–[D507](deferred-gaps.md) **closed**。[D487](deferred-gaps.md) **open**。R9 / **D405** 仍开。不得宣称 leftover / pills 完成 |
| **test-baseline** | 本关仓聚焦 9 文件 **309 passing / 0 fail**（含各文件 assertCleanState）。conversationNavigation 整文件 afterEach ConversationLens leak 已知，未跑整文件。**D16 仍开**；勿开切片 1；勿降 `min_cases` |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 未满足前不开 U2 |
## 不做：**ADR-007 U2**、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
