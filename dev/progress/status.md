---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "merge compile-client 0；聚焦 168 passing / 0 pending。A Health/ContextVariable 已 bytes。F TokenUsage / G Config Get+Set wire 未接线（Watch 不转）。SaveSkillContent/Rebuild 仍 JSON。D24 仍开。D487 open。D498–D502 / D506 closed。不是 leftover/pills 完成。R9/D405 仍开"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)；方案 → [plans INDEX](../plans/INDEX.md)；延期 → [deferred-gaps](deferred-gaps.md)。历史 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`npm run compile-client` 0；聚焦 **168 passing / 0 pending / 0 fail**）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **A Health/ContextVariable bytes** | `13058933d22` — HealthCheck/Shutdown + ContextVariable List/Read **已** `makeUnaryBytesClient` + wire，decode 后仍 map*。SaveSkillContent/Rebuild 仍 JSON。[D24](deferred-gaps.md) **仍开** |
| **F TokenUsage wire** | `1321cb39cbb` — `grpcTokenUsageUnaryWire` GetSessionUsage+GetGlobalUsage；GetGlobalUsageRequest **空 payload**（reserved 1-10 不发明）；**未接线** grpcClient |
| **G Config Get+Set wire** | `905df0471e6` — `grpcConfigUnaryWire` Get+Set；**未接线** grpcClient；Watch stream 不转；**勿 add `out`** |
| **C D498** | `6ca6c4ac791` — Triggers `refresh` 三处双链 catch。[D498](deferred-gaps.md) **closed**。C `dev/loop` gitlink 脏，cascade **勿 add** |
| **D D499** | `07efeb4715f` — Skills `refresh`/`loadSkillBody` 五处双链 catch。[D499](deferred-gaps.md) **closed**。不是 D482 |
| **H D500** | `591d9fc6c40` — Tools `refresh`/`loadToolInfo` 五处双链 catch。[D500](deferred-gaps.md) **closed** |
| **I D501** | `fe2e0bf2770` — MCP Runtime `refresh`/`loadTools` 九处双链 catch。[D501](deferred-gaps.md) **closed** |
| **J D502** | `e71ec06a986` — Plugins `refresh`/`loadInfo` 八处双链 catch。[D502](deferred-gaps.md) **closed** |
| **前波** | A ChatSync/Team bytes / F Health wire / G ContextVariable wire / C–J D493–D497；D487 open |
更早流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。钉死引擎：[debug-engine](../../docs/guides/debug-engine.md)。**D25/D26 已闭**。**不升 PRD-008**。不是 leftover/pills 完成。
### 进行中（2026-09-16 · merge 关仓；D24 仍开）
| 槽 | 切片 | 状态 |
|:---|:-----|:---------|
| **A** | Health/ContextVariable bytes | HEAD == MERGE_SHA（ff-only）。Health/ContextVariable **已** bytes。[D24](deferred-gaps.md) **仍开** |
| **F** | TokenUsage wire | HEAD == MERGE_SHA（ff-only）。GetSession/GetGlobal **未接线** |
| **G** | Config Get+Set wire | HEAD == MERGE_SHA（ff-only）。Get+Set **未接线**；Watch 不转；**勿 add `out`** |
| **C** | D498 | 保持 `dev/loop` gitlink 脏；勿 add。[D498](deferred-gaps.md) closed |
| **D** | D499 | HEAD == MERGE_SHA（ff-only）。[D499](deferred-gaps.md) closed |
| **H/I/J** | D500–D502 | HEAD == MERGE_SHA（ff-only）。[D500](deferred-gaps.md)–[D502](deferred-gaps.md) closed |
| **I D506** | leftover MCP definitions | 工位 I 本刀：`engineMcpSection.ts` 八处双链 catch。[D506](deferred-gaps.md) **closed**。未 commit。D24 仍开。不是 leftover 完成 |
| **B** | — | 脏 `worktree-pool.md`；**跳过**；勿 `-B` |
| **E** | leftover `fix/ci-gate-reds` | `blocked`；勿 `checkout -B` |
| **edit** | `agent-ide` | **仅 ff-only**；非祖先则失败并记录；勿 reset/checkout/stash |

子 agent 发现的既有代码问题（开项 + 本波）：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D24](deferred-gaps.md) | A/F/G | **仍开**：HealthCheck/Shutdown + ContextVariable List/Read **已** bytes；SaveSkillContent/Rebuild/TokenUsage/Config 仍 JSON；TokenUsage GetSession/GetGlobal + Config Get+Set wire **未接线**；Watch 不转 |
| [D487](deferred-gaps.md) | F Memory wire | **open**：codec 无 double；Search score 未读；mapper `requiredDouble`→0 |
| [D498](deferred-gaps.md)–[D502](deferred-gaps.md) | C/D/H/I/J | **closed** Triggers / Skills / Tools / MCP Runtime / Plugins void catch |
| [D506](deferred-gaps.md) | I | **closed** MCP definitions catalog 八处 void catch（非 runtime）。不是 leftover 完成 |
| [D405](deferred-gaps.md) | 手测 | **仍开**（S4a/S4b 前置） |
| [D16](deferred-gaps.md) / [D8](deferred-gaps.md) / [D147](deferred-gaps.md) | 基线 | **仍开**；勿开切片 1；勿降 `min_cases` |
| [D31](deferred-gaps.md) | Sources | **仍开**（剩 F4）；不升 PRD |
| [R8](research-queue.md) | B | **closed**；[R9](research-queue.md) 仍开 |
## 工位表（P0 盘点 · 2026-09-16 · 与 `git worktree list` 对照）
| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | MERGE_SHA | 干净 | 0 | compile-client 0；168 passing / 0 pending；D24 仍开；D487 open |
| A | `vscode-WorkTrees/A` | `loop/A` | MERGE_SHA | 干净 | 0 | ff-only；Health/ContextVariable **已** bytes |
| B | `vscode-WorkTrees/B` | `loop/B` | `28ffd1ae9f2` | 脏 `worktree-pool.md` | 0 | **跳过**；勿 `-B` |
| C | `vscode-WorkTrees/C` | `loop/C` | `6ca6c4ac791` | 脏 `dev/loop` gitlink | 0 | 保持 gitlink 脏；勿 add；D498 closed |
| D | `vscode-WorkTrees/D` | `loop/D` | MERGE_SHA | 干净 | 0 | ff-only；D499 closed |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `41f0d8c912f` | 干净 | 0 | `blocked` leftover；跳过 |
| F | `vscode-WorkTrees/F` | `loop/F` | MERGE_SHA | 干净 | 0 | ff-only；TokenUsage **未接线**；D487 open |
| G | `vscode-WorkTrees/G` | `loop/G` | MERGE_SHA | 未跟踪 `out` | 0 | ff-only；**勿 add `out`**；Config **未接线** |
| H | `vscode-WorkTrees/H` | `loop/H` | MERGE_SHA | 干净 | 0 | ff-only；D500 closed |
| I | `vscode-WorkTrees/I` | `loop/I` | MERGE_SHA | 脏 D506 | 0 | D501 closed；D506 本刀未 commit；D24 仍开 |
| J | `vscode-WorkTrees/J` | `loop/J` | MERGE_SHA | 干净 | 0 | ff-only；D502 closed |
| edit | `Projects/Agents/vscode` | `agent-ide` | MERGE_SHA | `dev/loop`+docs | 0 | 仅 ff-only；勿 reset/checkout/stash |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **本仓解锁 A–F** | 引擎仓 A–F **已合** @ `748e7698e6`。下一刀 IDE Direct Address 接通后 Composer 发送。**不升 PRD-008**。不要再清 store |
| **loop 切片** | [D24](deferred-gaps.md) **仍开**（Health/ContextVariable **已** bytes；SaveSkillContent/Rebuild/TokenUsage/Config 仍 JSON；TokenUsage + Config wire **未接线**；Watch 不转）。[D498](deferred-gaps.md)–[D502](deferred-gaps.md) / [D506](deferred-gaps.md) **closed**（D506 仅 `engineMcpSection.ts`）。[D487](deferred-gaps.md) **open**。R9 / **D405** 仍开。不关 D8/D16/D147。不得宣称 leftover / pills 完成 |
| **test-baseline** | 本关仓聚焦 9 文件 **168 passing / 0 pending / 0 fail**（含 assertCleanState）。conversationNavigation 整文件 afterEach ConversationLens leak 已知，未跑整文件。**D16 仍开**；勿开切片 1；勿降 `min_cases` |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 未满足前不开 U2 |
## 不做：**ADR-007 U2**、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
