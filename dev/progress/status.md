---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "A Health/ContextVariable 已 bytes。F TokenUsage / G Config Get+Set wire 未接线（Watch 不转；勿 add out）。C–D/H–J D498–D502 void catch。SaveSkillContent/Rebuild 仍 JSON。D24 仍开。D487 open。D493–D502 closed。不是 leftover/pills 完成。R9/D405 仍开"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)；方案 → [plans INDEX](../plans/INDEX.md)；延期 → [deferred-gaps](deferred-gaps.md)。历史 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`npm run compile-client` 待跑）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **A Health/ContextVariable bytes** | `13058933d22` — HealthCheck/Shutdown + ContextVariable List/Read **已** bytes。SaveSkillContent/Rebuild 仍 JSON。[D24](deferred-gaps.md) **仍开** |
| **F TokenUsage wire** | `1321cb39cbb` — GetSessionUsage+GetGlobalUsage **未接线** grpcClient |
| **G Config Get+Set wire** | `905df0471e6` — Get+Set **未接线**；Watch 不转；**勿 add `out`** |
| **C D498** | `6ca6c4ac791` — Triggers `refresh` void catch。gitlink 脏 **勿 add** |
| **D D499** | `07efeb4715f` — Skills `refresh`/`loadSkillBody` void catch。不是 D482 |
| **H D500** | `591d9fc6c40` — Tools `refresh`/`loadToolInfo` void catch |
| **I D501** | `fe2e0bf2770` — MCP Runtime `refresh`/`loadTools` void catch |
| **J D502** | `e71ec06a986` — Plugins `refresh`/`loadInfo` void catch |
| **C–J D493–D497** | Clipboard / Context Variables / nav / Projects / banners **closed** |
| **前波** | ChatSync/Team bytes；Memory/File；D488–D492；D487 open |
更早流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。**不升 PRD-008**。不是 leftover/pills 完成。
### 进行中（2026-09-16 · 合入 J D502；D24 仍开）
| 槽 | 切片 | 状态 |
|:---|:-----|:---------|
| **A** | Health/ContextVariable bytes | `13058933d22` 已合。[D24](deferred-gaps.md) **仍开**。[D487](deferred-gaps.md) **open** |
| **F** | TokenUsage wire | `1321cb39cbb` **未接线** |
| **G** | Config Get+Set wire | `905df0471e6` **未接线**；Watch 不转；**勿 add `out`** |
| **C** | D498 | `6ca6c4ac791`；gitlink 脏 **勿 add** |
| **D** | D499 | `07efeb4715f` Skills void catch |
| **H** | D500 | `591d9fc6c40` Tools void catch |
| **I** | D501 | `fe2e0bf2770` MCP Runtime void catch |
| **J** | D502 | `e71ec06a986` Plugins void catch。[D502](deferred-gaps.md) **closed** |
| **B** | — | 脏 `worktree-pool.md`；**跳过**；勿 `-B` |
| **E** | leftover `fix/ci-gate-reds` | `blocked`；勿 `checkout -B` |
| **edit** | `agent-ide` | **仅 ff-only**；勿 reset/checkout/stash |

子 agent 发现的既有代码问题（开项 + 本波）：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D24](deferred-gaps.md) | A/F/G | **仍开**：Health/ContextVariable **已** bytes；SaveSkillContent/Rebuild/TokenUsage/Config 仍 JSON；TokenUsage + Config Get+Set wire **未接线**；Watch 不转 |
| [D487](deferred-gaps.md) | F Memory wire | **open**：codec 无 double；Search score 未读；mapper `requiredDouble`→0 |
| [D493](deferred-gaps.md)–[D502](deferred-gaps.md) | C/D/H/I/J | **closed** Clipboard / Context Variables / Triggers / Skills / Tools / MCP Runtime / Plugins / nav / Projects / banners void catch |
| [D405](deferred-gaps.md) | 手测 | **仍开**（S4a/S4b 前置） |
| [D16](deferred-gaps.md) / [D8](deferred-gaps.md) / [D147](deferred-gaps.md) | 基线 | **仍开**；勿开切片 1；勿降 `min_cases` |
| [D31](deferred-gaps.md) | Sources | **仍开**（剩 F4）；不升 PRD |
| [R8](research-queue.md) | B | **closed**；[R9](research-queue.md) 仍开 |
## 工位表（P0 盘点 · 2026-09-16 · 与 `git worktree list` 对照）
| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | MERGE_SHA | 干净 | 0 | 合入 A/F/G + C–D/H–J D498–D502；compile 待跑；D24 仍开；D487 open |
| A | `vscode-WorkTrees/A` | `loop/A` | `13058933d22` | 干净 | 0 | Health/ContextVariable **已** bytes |
| B | `vscode-WorkTrees/B` | `loop/B` | `28ffd1ae9f2` | 脏 `worktree-pool.md` | 0 | **跳过** |
| C | `vscode-WorkTrees/C` | `loop/C` | `6ca6c4ac791` | 脏 `dev/loop` gitlink | 0 | **勿 add**；D498 closed |
| D | `vscode-WorkTrees/D` | `loop/D` | `07efeb4715f` | 干净 | 0 | D499 closed |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `41f0d8c912f` | 干净 | 0 | `blocked` leftover；跳过 |
| F | `vscode-WorkTrees/F` | `loop/F` | `1321cb39cbb` | TokenUsage wire | 0 | **未接线**；D487 open |
| G | `vscode-WorkTrees/G` | `loop/G` | `905df0471e6` | 未跟踪 `out` | 0 | **勿 add `out`**；Config **未接线** |
| H | `vscode-WorkTrees/H` | `loop/H` | `591d9fc6c40` | 干净 | 0 | D500 closed |
| I | `vscode-WorkTrees/I` | `loop/I` | `fe2e0bf2770` | 干净 | 0 | D501 closed |
| J | `vscode-WorkTrees/J` | `loop/J` | `e71ec06a986` | D502 | 0 | Plugins void catch closed |
| edit | `Projects/Agents/vscode` | `agent-ide` | MERGE_SHA | `dev/loop`+docs | 0 | 仅 ff-only；勿 reset/checkout/stash |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **本仓解锁 A–F** | 引擎仓 A–F **已合** @ `748e7698e6`。下一刀 IDE Direct Address 接通后 Composer 发送。**不升 PRD-008** |
| **loop 切片** | [D24](deferred-gaps.md) **仍开**（Health/ContextVariable **已** bytes；SaveSkillContent/Rebuild/TokenUsage/Config 仍 JSON；TokenUsage + Config wire **未接线**；Watch 不转）。[D493](deferred-gaps.md)–[D502](deferred-gaps.md) **closed**。[D487](deferred-gaps.md) **open**。R9 / **D405** 仍开。不关 D8/D16/D147。不得宣称 leftover / pills 完成 |
| **test-baseline** | conversationNavigation 整文件 afterEach ConversationLens leak 已知，可跳过或只 grep D495。**D16 仍开**；勿开切片 1；勿降 `min_cases` |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 未满足前不开 U2 |
## 不做：**ADR-007 U2**、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
