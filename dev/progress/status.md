---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "SessionStream 30/50/51 已合入。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 见关仓；compile-client 0；attach mocha 47）
| 切片 | 提交 |
|:-----|:-----|
| **A SessionStream 51** | `893329eb666` — `ask_user_question`=51 AskUserQuestionEvent 1–3 + items |
| **A+I SessionStream 30/50** | `0d26ead1efa` — `streaming_delta`=30 + `permission_request`=50 keep-both |
| **D Resume** | `cf4de53376b` — Session.Resume `root_agent`=3 AgentInfo 1–8；`model_info`=9 unread |
| **A Usage 10/11** | `564a4645b0b` — Usage `context_window`=10 + `session_usage`=11 |
| **A Usage spans** | `7f42b796fe9` — `recent_request_spans`=12 |
| **F decode** | `0e6ca17a9ec` — CheckConnection 复用 GetNode |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **D/F/G/I** | 他线 leftover hunt：**无合法切片**（J 缺号 / 无公开 mapper / 测锁未读） |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **C** | gitlink 脏 `dev/loop`；勿 add |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：SessionStream 30/50/51 已 decode。Connect/Watch/Resolve/Pty 仍 JSON；`model_info`=9 unread |
| — | TeamInfo `members`=2/`tasks`=3 测锁未读；公开类型只有 teamId+status |
| — | `ListTeams` 不在 J `team_service.proto`；禁发明号 |
| — | GetConfig tags=`[]` vs GetNode `undefined`（测锁 `[]`） |
| — | `decodeAgentProfile` 读测锁 17–19；J 无这三号 |
| — | `decodeSessionSummary.work_dir`=9 / `SessionInfo.work_dir`=7 **不在 J** |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。下一刀 SessionStream `client_tool_call`=52。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
