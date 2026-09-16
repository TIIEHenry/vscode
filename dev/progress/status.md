---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "merge compile-client 0；聚焦 206 passing / 0 pending。D24 仍开（Health/SaveSkillContent/Rebuild 仍 JSON；HealthCheck/Shutdown wire 未接线；Memory/File/ChatSync/Team mutators 已 bytes）。D488–D492 closed；D487 open。不是 leftover/pills 完成。R9/D405 仍开"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)；方案 → [plans INDEX](../plans/INDEX.md)；延期 → [deferred-gaps](deferred-gaps.md)。历史 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`npm run compile-client` 0；聚焦 **206 passing / 0 pending / 0 fail**）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **A Memory/File bytes** | `8519ddcce6c` — grpcClient Memory/File unary **已** bytes；Rebuild 仍 JSON。[D24](deferred-gaps.md) **仍开**。[D487](deferred-gaps.md) **open** |
| **F ChatSync wire** | `8fcdcb4f7ea` — `grpcChatSyncUnaryWire` + 测；ChatSync/SyncInputDelivery **未接线** grpcClient |
| **G Team mutators wire** | `62fa5f700aa` — `grpcTeamUnaryWire` + 测；**未接线** grpcClient；ListTeams/MemberStatus/TaskList/TeamInfo 不重做；**勿 add `out`** |
| **C D488** | `79563cf086f` — navigator Agents reveal/inspect void catch。[D488](deferred-gaps.md) **closed**。C `dev/loop` gitlink 脏，cascade **勿 add** |
| **D D489** | `5f228952455` — Sessions `openSessionBeside` void catch。[D489](deferred-gaps.md) **closed** |
| **H D490** | `d19dab213c5` — untitled provisional dispose void catch。[D490](deferred-gaps.md) **closed** |
| **I D491** | `66e349f5139` — navigator Team list reveal/inspect void catch。[D491](deferred-gaps.md) **closed** |
| **J D492** | `36385430867` — Codex Approvals Learn more opener 双链 catch。[D492](deferred-gaps.md) **closed** |
| **前波** | A Tool leftover / F Memory wire / G File wire / C D483 / D D482 / H D484 / I D485 / J D486；D487 open；D24 当时 Memory/File grpcClient 仍 JSON |
更早 GFS/UA chrome / leftover 关仓波见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。钉死引擎：[debug-engine](../../docs/guides/debug-engine.md)。**D25/D26 已闭**。grpcurl Chat PASS 是引擎面，不是 IDE Conversation 接通。**不升 PRD-008**。不是 leftover/pills 完成。
### 进行中（2026-09-16 · D24 仍开；F Health/Shutdown wire 未提交、未接线）
| 槽 | 切片 | 状态 |
|:---|:-----|:---------|
| **A** | D24 ChatSync/Team bytes | ChatSync/SyncInputDelivery + Team 七 mutator **已接线** grpcClient bytes；Rebuild/Health/SaveSkillContent 仍 JSON。[D24](deferred-gaps.md) **仍开**。[D487](deferred-gaps.md) **open** |
| **F** | D24 Health/Shutdown wire | `grpcSystemUnaryWire` + test；HealthCheck/Shutdown **未接线** grpcClient。禁止 Doctor/Connect。[D24](deferred-gaps.md) **仍开** |
| **C** | D488 | **closed**；ff-only 保持 `dev/loop` gitlink 脏；勿 add |
| **D** | D489 Sessions beside | **closed** |
| **H/I/J** | D490–D492 | **closed**（untitled dispose / Team list / Codex Learn more） |
| **B** | — | 脏 `worktree-pool.md`；**跳过**；勿 `-B` |
| **E** | leftover `fix/ci-gate-reds` | `blocked`；勿 `checkout -B` |
| **edit** | `agent-ide` | **仅 ff-only**；非祖先则失败并记录；勿 reset/checkout/stash |

子 agent 发现的既有代码问题（开项 + 本波）：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D24](deferred-gaps.md) | A/F/G | **仍开**：Memory/File/ChatSync/Team mutators **已** bytes；Health/SaveSkillContent/Rebuild 仍 JSON；HealthCheck/Shutdown wire **未接线** |
| [D487](deferred-gaps.md) | F Memory wire | **open**：codec 无 double；Search score 未读；grpcClient 已接线，mapper `requiredDouble`→0 |
| [D488](deferred-gaps.md)–[D492](deferred-gaps.md) | C/D/H/I/J | **closed** Agents / Sessions beside / untitled dispose / Team list / Codex Learn more void catch |
| [D405](deferred-gaps.md) | 手测 | **仍开**（S4a/S4b 前置） |
| [D16](deferred-gaps.md) / [D8](deferred-gaps.md) / [D147](deferred-gaps.md) | 基线 | **仍开**；勿开切片 1；勿降 `min_cases` |
| [D31](deferred-gaps.md) | Sources | **仍开**（剩 F4）；不升 PRD |
| [R8](research-queue.md) | B | **closed**；[R9](research-queue.md) 仍开 |
## 工位表（P0 盘点 · 2026-09-16 · 与 `git worktree list` 对照）
| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | MERGE_SHA | 干净 | 0 | compile-client 0；206 passing / 0 pending；D24 仍开；D487 open |
| A | `vscode-WorkTrees/A` | `loop/A` | MERGE_SHA | grpcClient ChatSync/Team bytes | 0 | 未 commit；D24 仍开（Health/SaveSkillContent/Rebuild JSON） |
| B | `vscode-WorkTrees/B` | `loop/B` | `28ffd1ae9f2` | 脏 `worktree-pool.md` | 0 | **跳过**；勿 `-B` |
| C | `vscode-WorkTrees/C` | `loop/C` | MERGE_SHA | 脏 `dev/loop` gitlink | 0 | ff-only 保持 gitlink 脏；勿 add |
| D | `vscode-WorkTrees/D` | `loop/D` | MERGE_SHA | 干净 | 0 | ff-only；D489 closed |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `41f0d8c912f` | 干净 | 0 | `blocked` leftover；跳过 |
| F | `vscode-WorkTrees/F` | `loop/F` | MERGE_SHA | 未跟踪 Health/Shutdown wire+测 | 0 | Health/Shutdown **未提交、未接线** grpcClient；6 passing；D24 仍开 |
| G | `vscode-WorkTrees/G` | `loop/G` | MERGE_SHA | 未跟踪 `out` | 0 | ff-only；**勿 add `out`**；Team mutators **未接线** |
| H | `vscode-WorkTrees/H` | `loop/H` | MERGE_SHA | 干净 | 0 | ff-only；D490 closed |
| I | `vscode-WorkTrees/I` | `loop/I` | MERGE_SHA | 干净 | 0 | ff-only；D491 closed |
| J | `vscode-WorkTrees/J` | `loop/J` | MERGE_SHA | 干净 | 0 | ff-only；D492 closed |
| edit | `Projects/Agents/vscode` | `agent-ide` | MERGE_SHA | `dev/loop`+docs | 0 | 仅 ff-only；非祖先则失败记录；勿 reset/checkout/stash |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **本仓解锁 A–F** | 引擎仓 A–F **已合** @ `748e7698e6`。下一刀是 IDE Direct Address 接通后 Composer 发送。**不升 PRD-008**。不要再清 store |
| **loop 切片** | [D24](deferred-gaps.md) **仍开**（Memory/File/ChatSync/Team mutators 已 bytes；Health/SaveSkillContent/Rebuild 仍 JSON；HealthCheck/Shutdown wire **未接线**）。[D488](deferred-gaps.md)–[D492](deferred-gaps.md) **closed**。[D487](deferred-gaps.md) **open**。R9 / **D405** 仍开。不关 D8/D16/D147。不得宣称 leftover / pills 完成 |
| **test-baseline** | 本关仓聚焦 9 文件 **206 passing / 0 pending / 0 fail**。**D16 仍开**；勿开切片 1；勿降 `min_cases` |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 未满足前不开 U2 |
## 不做：**ADR-007 U2**、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
