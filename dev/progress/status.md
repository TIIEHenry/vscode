---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "merge compile-client 0；聚焦 364 passing / 11 pending。D24 仍开（Memory/File grpcClient JSON）。D482–D486 / D490 closed；D487 open。不是 leftover/pills 完成。R9/D405 仍开"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)；方案 → [plans INDEX](../plans/INDEX.md)；延期 → [deferred-gaps](deferred-gaps.md)。历史 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`npm run compile-client` 0；聚焦 **364 passing / 11 pending / 0 fail**）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **A D24 Tool leftover** | `6af71063c05` — SkillInfo/SetSkillEnabled/ToolInfo/ListCommands/GetCommandDef（+DeleteAgentProfile）bytes。未转 SaveSkillContent。[D24](deferred-gaps.md) **仍开** |
| **F Memory wire** | `891c2c22a29` — `grpcMemoryUnaryWire` + 测；**未接线** grpcClient；跳过 Rebuild；score double 未读（[D487](deferred-gaps.md) **open**）。不得把 F 写成 D482 |
| **G File wire** | `2c57e7be17f` — `grpcFileUnaryWire` + 测；**未接线** grpcClient；**勿 add `out`** |
| **C D483** | `5202d99f3b4` — localAgentHost `createNewSession` DevContainer void catch。[D483](deferred-gaps.md) **closed**。C `dev/loop` gitlink 脏，cascade **勿 add** |
| **D D482** | `e8813c10003` — WSL reconnect 四处 void catch。**这才是 D482**。[D482](deferred-gaps.md) **closed** |
| **H D484** | `f988e140ea8` — sessionArtifacts `_actions` 四处 catch。[D484](deferred-gaps.md) **closed** |
| **I D485** | `cb1a6f4abce` — history `void refresh` catch。[D485](deferred-gaps.md) **closed** |
| **J D486** | `27743a2648f` — snapshots void refresh/restore/delete catch。[D486](deferred-gaps.md) **closed** |
| **前波 A+D** | `b7df6c535e7`/`25898088f8b` — respondQuestion/sendClientToolResponse bytes；Reveal CI catch。[D481](deferred-gaps.md) **closed** |
更早 GFS/UA chrome / leftover 关仓波见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。钉死引擎：[debug-engine](../../docs/guides/debug-engine.md)。**D25/D26 已闭**。grpcurl Chat PASS 是引擎面，不是 IDE Conversation 接通。**不升 PRD-008**。不是 leftover/pills 完成。
### 进行中（2026-09-16 · compile-client 0 · 364/11 pending；D24 仍开；不是 leftover/pills 完成）
| 槽 | 切片 | 状态 |
|:---|:-----|:---------|
| **A/F/G** | D24 wires | Tool leftover 已 bytes；Memory/File unary wire **未接线** grpcClient。[D24](deferred-gaps.md) **仍开**。[D487](deferred-gaps.md) **open** |
| **C** | D483 | **closed**；ff-only 保持 `dev/loop` gitlink 脏；勿 add |
| **D** | D482 WSL catch | **closed**。不得把 F 写成 D482 |
| **H/I/J** | D484–D486 / D490 | **closed**（artifacts / history / snapshots / untitled dispose void catch） |
| **B** | — | 脏 `worktree-pool.md`；**跳过**；勿 `-B` |
| **E** | leftover `fix/ci-gate-reds` | `blocked`；勿 `checkout -B` |
| **edit** | `agent-ide` | **仅 ff-only**；非祖先则失败并记录；勿 reset/checkout/stash |

子 agent 发现的既有代码问题（开项 + 本波）：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D24](deferred-gaps.md) | A/F/G | **仍开**：Tool leftover 已 bytes；Memory/File grpcClient **仍 JSON**；ChatSync 仍 JSON |
| [D487](deferred-gaps.md) | F Memory wire | **open**：codec 无 double；`MemorySearchResult.score` 未读 |
| [D482](deferred-gaps.md)–[D486](deferred-gaps.md) / [D490](deferred-gaps.md) | D/C/H/I/J | **closed** WSL / DevContainer / artifacts / history / snapshots / untitled dispose void catch |
| [D405](deferred-gaps.md) | 手测 | **仍开**（S4a/S4b 前置） |
| [D16](deferred-gaps.md) / [D8](deferred-gaps.md) / [D147](deferred-gaps.md) | 基线 | **仍开**；勿开切片 1；勿降 `min_cases` |
| [D31](deferred-gaps.md) | Sources | **仍开**（剩 F4）；不升 PRD |
| [R8](research-queue.md) | B | **closed**；[R9](research-queue.md) 仍开 |
## 工位表（P0 盘点 · 2026-09-16 · 与 `git worktree list` 对照）
| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | MERGE_SHA | 干净 | 0 | compile-client 0；364 passing / 11 pending；D24 仍开；D487 open |
| A | `vscode-WorkTrees/A` | `loop/A` | MERGE_SHA | 干净 | 0 | ff-only；D24 仍开 |
| B | `vscode-WorkTrees/B` | `loop/B` | `28ffd1ae9f2` | 脏 `worktree-pool.md` | 0 | **跳过**；勿 `-B` |
| C | `vscode-WorkTrees/C` | `loop/C` | MERGE_SHA | 脏 `dev/loop` gitlink | 0 | ff-only 保持 gitlink 脏；勿 add |
| D | `vscode-WorkTrees/D` | `loop/D` | MERGE_SHA | 干净 | 0 | ff-only；D482 closed |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `41f0d8c912f` | 干净 | 0 | `blocked` leftover；跳过 |
| F | `vscode-WorkTrees/F` | `loop/F` | MERGE_SHA | 干净 | 0 | ff-only；Memory 未接线；D487 open |
| G | `vscode-WorkTrees/G` | `loop/G` | MERGE_SHA | 未跟踪 `out` | 0 | ff-only；**勿 add `out`** |
| H | `vscode-WorkTrees/H` | `loop/H` | `057cf54df16d` | 脏 D490 | 0 | D490 closed；未 commit；D24 仍开 |
| I | `vscode-WorkTrees/I` | `loop/I` | MERGE_SHA | 干净 | 0 | ff-only；D485 closed |
| J | `vscode-WorkTrees/J` | `loop/J` | MERGE_SHA | 干净 | 0 | ff-only；D486 closed |
| edit | `Projects/Agents/vscode` | `agent-ide` | `ff278772b85` | `dev/loop`+docs | 0 | 仅 ff-only；非祖先则失败记录；勿 reset/checkout/stash |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **本仓解锁 A–F** | 引擎仓 A–F **已合** @ `748e7698e6`。下一刀是 IDE Direct Address 接通后 Composer 发送。**不升 PRD-008**。不要再清 store |
| **loop 切片** | [D24](deferred-gaps.md) **仍开**（Memory/File grpcClient JSON）。[D482](deferred-gaps.md)–[D486](deferred-gaps.md) / [D490](deferred-gaps.md) **closed**。[D487](deferred-gaps.md) **open**。R9 / **D405** 仍开。不关 D8/D16/D147。不得宣称 leftover / pills 完成 |
| **test-baseline** | 本关仓聚焦 8 文件 **364 passing / 11 pending / 0 fail**。**D16 仍开**；勿开切片 1；勿降 `min_cases` |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 未满足前不开 U2 |
## 不做：**ADR-007 U2**、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
