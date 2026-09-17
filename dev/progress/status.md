---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "工位 A `d24-envelope-leftover`：L2 leftover decode。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 见关仓；compile-client 0；attach mocha 61）
| 切片 | 提交 |
|:-----|:-----|
| **A SessionStream** | 16/23/30/31/32/34/35/36/37/38/39/44/46/50/51/52 |
| **D Resume / A Usage** | root_agent；Usage 10/11/12 |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **A** | `d24-envelope-leftover` 进行中；D24 **仍开**；未 compile-client |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **C** | gitlink 脏 `dev/loop`；勿 add |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/Watch/Resolve/Pty 仍 JSON |
| — | J ToolCallBlock 仅 1–3；本仓 decode+GetHistory 测锁发明号 `detail_ref`=4 / `file_mutation`=5；本刀未删、未标 unread |
| — | join 读 `snapshot.payload.file_mutation_payload`，host 读 sibling；本刀 decode 两侧都写 |
| — | TeamInfo 2/3 测锁；ListTeams 不在 J；GetConfig tags 测锁 `[]`；AgentProfile 17–19 非 J；work_dir 7/9 非 J |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
