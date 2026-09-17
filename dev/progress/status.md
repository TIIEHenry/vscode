---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "SessionStream 16/23/30–32/34–39/44/46/50–52 与 L2 envelope leftover 已合入。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 见关仓；compile-client 0；attach mocha 65）
| 切片 | 提交 |
|:-----|:-----|
| **A SessionStream** | 16/23/30–32/34–39/44/46/50–52 |
| **A L2 envelope** | thinking 键；summary/canvas/span；original_type/raw_json；branch_reason；range 4/9/11 |
| **D Resume / A Usage** | root_agent；Usage 10/11/12 |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **A** | leftover 再猎（忽略账本「已完成」措辞） |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **C** | gitlink 脏 `dev/loop`；勿 add |
| **D** | leftover fire-and-forget：terminal `_toggleOutput` 八处双链；D24 仍开 |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/Watch/Resolve/Pty 仍 JSON |
| — | ToolCallBlock 4/5 发明号被 GetHistory 测锁；join `payload` vs sibling |
| — | TeamInfo 2/3 测锁；ListTeams 不在 J；GetConfig tags 测锁 `[]`；AgentProfile 17–19 非 J；work_dir 7/9 非 J |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
