---
title: "架构决策记录索引（ADR）"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "本仓库本地 ADR 索引；ADR-003 引擎 adapter 边界 draft；ADR-004 Diff owner 草案（推荐 Panel）；ADR-002 session 窗口已接受已实施"
---

# 架构决策记录

每个 ADR 记录 Context / Decision / Consequences / Alternatives。阶段实现日志见 [`dev/progress/status.md`](../progress/status.md)（规范路径 `dev/iterations/` 待建，见 [DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 4）。

新增文件命名：`NNN-short-name.md`，并在本索引登记。

| ADR | 状态 | 摘要 |
|-----|------|------|
| [001-chat-compare-form.md](001-chat-compare-form.md) | `accepted` | PRD-011 比对承载形态：同 session 多 chat；双 session 孪生延后 |
| [002-conversation-session-windows.md](002-conversation-session-windows.md) | `accepted` | 每 session 叶一个 Conversation IEditorPart；围栏 CONVERSATION_GROUP；不推翻 ADR-001 |
| [003-engine-adapter-boundary.md](003-engine-adapter-boundary.md) | `draft` | UA 传输落 platform/universeAgent；roster 同 token `'conversationStubService'`；AHP 非权威 |
| [004-diff-owner.md](004-diff-owner.md) | `draft` | PRD-009 Diff owner：推荐 B = `PANEL_PART` 专用容器；否决 A（HEAD 编辑器区）与 C（Changes 内嵌） |
