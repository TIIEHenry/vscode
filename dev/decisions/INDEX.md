---
title: "架构决策记录索引（ADR）"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "本仓库本地 ADR 索引；ADR-005 Diff owner 已接受；ADR-004 已被 ADR-005 取代；ADR-003 引擎 adapter 边界 draft；ADR-002 session 窗口已接受已实施"
---

# 架构决策记录

每个 ADR 记录 Context / Decision / Consequences / Alternatives。

新增文件命名：`NNN-short-name.md`，并在本索引登记。

| ADR | 状态 | 摘要 |
|-----|------|------|
| [001-chat-compare-form.md](001-chat-compare-form.md) | `accepted` | PRD-011 比对承载形态：同 session 多 chat；双 session 孪生延后 |
| [002-conversation-session-windows.md](002-conversation-session-windows.md) | `accepted` | 每 session 叶一个 Conversation IEditorPart；围栏 CONVERSATION_GROUP；不推翻 ADR-001 |
| [003-engine-adapter-boundary.md](003-engine-adapter-boundary.md) | `draft` | UA 传输落 platform/universeAgent；roster 同 token `'conversationStubService'`；AHP 非权威 |
| [004-diff-owner.md](004-diff-owner.md) | `superseded` | PRD-009 Diff owner：原推荐 B = `PANEL_PART` 专用容器；已被 [ADR-005](005-changes-diff-owner.md) 取代 |
| [005-changes-diff-owner.md](005-changes-diff-owner.md) | `accepted` | PRD-009 Diff owner：默认 Preview；可移对话窗口（只读审阅）或底部 Panel 产品 Diff 视图 |
| [006-shell-invariants.md](006-shell-invariants.md) | `accepted` | 追溯登记 M0–M5 壳不变量：采纳外仓 ADR-061；定义 INV-TOPO / INV-052-NO-DUAL-HIDE / INV-NO-COPILOT；ADR-005 是 INV-TOPO 围栏的唯一登记例外 |

编号说明：本仓 ADR 编号与外仓 UniverseAgentDesktop 互不相关（文中「Desktop ADR-003 token」「ADR-046 / 047 / 052 / 061」指外仓）。阶段日志落 [`status.md`](../progress/status.md) 与 `dev/progress/*-evidence/`，本仓不设 `dev/iterations/`（[DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 4）。
