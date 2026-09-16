---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "merge compile-client 0；聚焦 120 passing / 0 pending。G 未提交 Config Get/Set wire（未接线 grpcClient；禁止 Watch）。D24 仍开。D487 open。不是 leftover/pills 完成。R9/D405 仍开"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)；方案 → [plans INDEX](../plans/INDEX.md)；延期 → [deferred-gaps](deferred-gaps.md)。历史 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`npm run compile-client` 0；聚焦 **120 passing / 0 pending / 0 fail**）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **A ChatSync/Team bytes** | `ddee1c48559` — grpcClient ChatSync/SyncInputDelivery + Team 七 mutator **已** bytes；Health/Rebuild 仍 JSON。[D24](deferred-gaps.md) **仍开**。[D487](deferred-gaps.md) **open** |
| **F Health/Shutdown wire** | `a03f9dee89c` — `grpcSystemUnaryWire` + 测；HealthCheck/Shutdown **未接线** grpcClient。禁止 Doctor/Connect |
| **G ContextVariable wire** | `73fae14032c` — **已提交**（不是本工位未提交）`grpcContextVariableUnaryWire` List+Read + 测；**未接线** grpcClient；不是 D482 |
| **C D493** | `4f6fe74514e` — Clipboard `refresh`/写读清 void catch。[D493](deferred-gaps.md) **closed**。C `dev/loop` gitlink 脏，cascade **勿 add** |
| **D D494** | `f2b0f6dd68b` — Context Variables `refresh` void catch。[D494](deferred-gaps.md) **closed** |
| **H D495** | `e4c43451a3e` — conversation nav / 关扩展页 void catch。[D495](deferred-gaps.md) **closed** |
| **I D496** | `8f8a5871a3f` — navigator Projects `openWindow` / `rebuildTree` void catch。[D496](deferred-gaps.md) **closed** |
| **J D497** | `88c31452118` — banners PR/CI `refresh()` 双链 catch。[D497](deferred-gaps.md) **closed**。不重开 D481 |
| **前波** | A Memory/File bytes / F ChatSync wire / G Team mutators wire / C D488 / D D489 / H D490 / I D491 / J D492；D487 open；当时 ChatSync/Team grpcClient 仍 JSON |
更早 GFS/UA chrome / leftover 关仓波见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。钉死引擎：[debug-engine](../../docs/guides/debug-engine.md)。**D25/D26 已闭**。grpcurl Chat PASS 是引擎面，不是 IDE Conversation 接通。**不升 PRD-008**。不是 leftover/pills 完成。
### 进行中（2026-09-16 · 槽空闲等下一波；D24 仍开）
| 槽 | 切片 | 状态 |
|:---|:-----|:---------|
| **A/F** | 空闲 | ChatSync/Team **已** bytes；Health/ContextVariable/SaveSkillContent/Rebuild 仍 JSON；HealthCheck/Shutdown/ContextVariable List+Read wire **未接线**。[D24](deferred-gaps.md) **仍开** |
| **G** | Config Get/Set wire | **未提交** `grpcConfigUnaryWire`；**未接线** grpcClient；禁止 Watch；不是 D482。[D24](deferred-gaps.md) **仍开** |
| **C** | 空闲 | 等下一波；ff-only 保持 `dev/loop` gitlink 脏；勿 add。[D493](deferred-gaps.md) closed |
| **D/H/I/J** | 空闲 | 等下一波。[D494](deferred-gaps.md)–[D497](deferred-gaps.md) closed |
| **B** | — | 脏 `worktree-pool.md`；**跳过**；勿 `-B` |
| **E** | leftover `fix/ci-gate-reds` | `blocked`；勿 `checkout -B` |
| **edit** | `agent-ide` | **仅 ff-only**；非祖先则失败并记录；勿 reset/checkout/stash |

子 agent 发现的既有代码问题（开项 + 本波）：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D24](deferred-gaps.md) | A/F/G | **仍开**：Memory/File/ChatSync/Team mutators **已** bytes；Health/ContextVariable/SaveSkillContent/Rebuild 仍 JSON；HealthCheck/Shutdown/ContextVariable List+Read/Config Get+Set wire **未接线** |
| [D487](deferred-gaps.md) | F Memory wire | **open**：codec 无 double；Search score 未读；grpcClient 已接线，mapper `requiredDouble`→0 |
| [D493](deferred-gaps.md)–[D497](deferred-gaps.md) | C/D/H/I/J | **closed** Clipboard / Context Variables `refresh` / conversation nav / Projects / banners PR/CI void catch |
| [D405](deferred-gaps.md) | 手测 | **仍开**（S4a/S4b 前置） |
| [D16](deferred-gaps.md) / [D8](deferred-gaps.md) / [D147](deferred-gaps.md) | 基线 | **仍开**；勿开切片 1；勿降 `min_cases` |
| [D31](deferred-gaps.md) | Sources | **仍开**（剩 F4）；不升 PRD |
| [R8](research-queue.md) | B | **closed**；[R9](research-queue.md) 仍开 |
## 工位表（P0 盘点 · 2026-09-16 · 与 `git worktree list` 对照）
| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | MERGE_SHA | 干净 | 0 | compile-client 0；120 passing / 0 pending；D24 仍开；D487 open |
| A | `vscode-WorkTrees/A` | `loop/A` | MERGE_SHA | 干净 | 0 | ff-only；ChatSync/Team 已 bytes；D24 仍开 |
| B | `vscode-WorkTrees/B` | `loop/B` | `28ffd1ae9f2` | 脏 `worktree-pool.md` | 0 | **跳过**；勿 `-B` |
| C | `vscode-WorkTrees/C` | `loop/C` | MERGE_SHA | 脏 `dev/loop` gitlink | 0 | ff-only 保持 gitlink 脏；勿 add |
| D | `vscode-WorkTrees/D` | `loop/D` | MERGE_SHA | 干净 | 0 | ff-only；D494 closed |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `41f0d8c912f` | 干净 | 0 | `blocked` leftover；跳过 |
| F | `vscode-WorkTrees/F` | `loop/F` | MERGE_SHA | 干净 | 0 | ff-only；Health/Shutdown wire **未接线**；D487 open |
| G | `vscode-WorkTrees/G` | `loop/G` | MERGE_SHA | 未跟踪 `out` | 0 | **勿 add `out`**；本工位未提交 Config Get/Set wire；**未接线**；ContextVariable List+Read 仍未接线 |
| H | `vscode-WorkTrees/H` | `loop/H` | MERGE_SHA | 干净 | 0 | ff-only；D495 closed |
| I | `vscode-WorkTrees/I` | `loop/I` | MERGE_SHA | 干净 | 0 | ff-only；D496 closed |
| J | `vscode-WorkTrees/J` | `loop/J` | MERGE_SHA | 干净 | 0 | ff-only；D497 closed |
| edit | `Projects/Agents/vscode` | `agent-ide` | MERGE_SHA | `dev/loop`+docs | 0 | 仅 ff-only；非祖先则失败记录；勿 reset/checkout/stash |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **本仓解锁 A–F** | 引擎仓 A–F **已合** @ `748e7698e6`。下一刀是 IDE Direct Address 接通后 Composer 发送。**不升 PRD-008**。不要再清 store |
| **loop 切片** | [D24](deferred-gaps.md) **仍开**（Health/ContextVariable/SaveSkillContent/Rebuild 仍 JSON；HealthCheck/Shutdown/ContextVariable List+Read/Config Get+Set wire **未接线**）。[D493](deferred-gaps.md)–[D497](deferred-gaps.md) **closed**。[D487](deferred-gaps.md) **open**。R9 / **D405** 仍开。不关 D8/D16/D147。不得宣称 leftover / pills 完成 |
| **test-baseline** | 本关仓聚焦 9 文件 **120 passing / 0 pending / 0 fail**（8 文件 115 含 assertCleanState；conversationNavigation D495 `--grep` 5）。整文件 createHarness afterEach 有 ConversationLens leak，未计入绿。**D16 仍开**；勿开切片 1；勿降 `min_cases` |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 未满足前不开 U2 |
## 不做：**ADR-007 U2**、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
