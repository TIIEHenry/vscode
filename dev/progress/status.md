---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-16
summary: "工位 H D519 Skills 行内 toggleSkill 双链 catch。D508–D514 / D519 closed。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)；方案 → [plans INDEX](../plans/INDEX.md)；延期 → [deferred-gaps](deferred-gaps.md)。历史 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 本关仓提交；`npm run compile-client` 0；聚焦 **327 passing / 0 fail**）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **A Permission+Doctor bytes** | `2d8474f8ba1` — SetPermissionPolicy + Doctor **已** `makeUnaryBytesClient`。Doctor 空 proto 非 JSON `{}`。[D24](deferred-gaps.md) **仍开** |
| **C D508** | `83c5004f47d` — Agents 十二处双链 catch。gitlink 脏，cascade **勿 add** |
| **D D509** | `f58ed714ca9` — Plugins 四处写路径双链 catch |
| **F D510** | `1b4cbd47ca2` — Skills New/Save 双链 catch |
| **G D511** | `ef3617ec364` — Snapshots 七处单链升双链；**勿 add `out`** |
| **H D512** | `f1834c18b59` — Context Variables Read 双链 catch |
| **I D513** | `8998c3e9ef3` — session-chat overlay 两处双链 catch |
| **J D514** | `ec8fdfc503e` — Overview `renderAsync` 两处双链 catch；未碰 OPEN_CONNECTION |
| **前波** | A TokenUsage+Config bytes / F Permission wire / G Doctor wire / C–J D503–D507 |

更早流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。**D25/D26 已闭**。**不升 PRD-008**。不是 leftover/pills 完成。
### 进行中（2026-09-16 · merge 关仓；D24 仍开）
| 槽 | 切片 | 状态 |
|:---|:-----|:---------|
| **A** | Permission+Doctor bytes | 已合入 merge。[D24](deferred-gaps.md) **仍开** |
| **C** | D508 | 保持 `dev/loop` gitlink 脏；勿 add |
| **D/F/G/I/J** | D509–D514 | 已合入 merge |
| **H** | D519 | Skills 行内 `toggleSkill` 双链 catch；未重做 D499/D510；未碰 OPEN_CONNECTION。[D24](deferred-gaps.md) **仍开**；leftover **未**完成 |
| **B** | — | 脏 `worktree-pool.md`；**跳过**；勿 `-B` |
| **E** | leftover `fix/ci-gate-reds` | `blocked`；勿 `checkout -B` |
| **edit** | `agent-ide` | **仅 ff-only**；分歧则失败并记录；勿 reset |

子 agent 发现的既有代码问题：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D24](deferred-gaps.md) | A | **仍开**：TokenUsage+Config Get/Set + SetPermissionPolicy + Doctor **已** bytes；SaveSkillContent/Rebuild/Watch/model prefs 仍 JSON |
| [D487](deferred-gaps.md) | Memory | **open**：codec 无 double；Search score 未读 |
| [D508](deferred-gaps.md)–[D514](deferred-gaps.md) | C–J | **closed** 本文件 void catch；leftover **未**全局完成 |
| [D519](deferred-gaps.md) | H | **closed** Skills 行内 `toggleSkill` Promise 双链 catch；leftover **未**全局完成 |
| [D405](deferred-gaps.md) / [D16](deferred-gaps.md) / [D8](deferred-gaps.md) / [D147](deferred-gaps.md) | 基线 | **仍开** |
| [R9](research-queue.md) | — | **仍开** |
## 工位表（P0 · 2026-09-16）
| 槽 | 路径 | 分支 | 关仓状态 |
|----|------|------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | compile-client 0；327 passing；D24 仍开 |
| A,C,D,F–J | `vscode-WorkTrees/*` | `loop/*` | cascade ff-only；C 勿 add gitlink；G 勿 add `out` |
| B | `vscode-WorkTrees/B` | `loop/B` | **跳过**脏 `worktree-pool.md` |
| E | `vscode-WorkTrees/E` | `fix/ci-gate-reds` | `blocked` |
| edit | `Projects/Agents/vscode` | `agent-ide` | ff-only 失败（分歧）；勿 reset |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **loop 切片** | [D24](deferred-gaps.md) **仍开**（SaveSkillContent/Rebuild/Watch/GetModelPreferences/SetModelPreferences/ResolveModel 仍 JSON）。[D508](deferred-gaps.md)–[D514](deferred-gaps.md) / [D519](deferred-gaps.md) **closed**。[D487](deferred-gaps.md) **open**。不得宣称 leftover / pills 完成 |
| **test-baseline** | 本关仓聚焦 8 文件 **327 passing / 0 fail**。conversationNavigation 整文件 afterEach ConversationLens leak 已知，未跑整文件。**D16 仍开** |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 未满足前不开 U2 |
## 不做：**ADR-007 U2**、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
