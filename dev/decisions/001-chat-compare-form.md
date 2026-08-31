---
title: "ADR-001 Chat 并排比对的承载形态：同 session 多 chat"
type: decision
status: accepted
phase: N/A
updated: 2026-08-31
summary: "PRD-011 比对形态二选一：选同一 session 内多 chat 并排，弃（延后）同工作区双 session 孪生"
---

# ADR-001 Chat 并排比对的承载形态

## Context

[PRD-011](../../docs/product/requirements.md#prd-011-chat-并排比对) 要求把 fork 分支 / 子 agent 对话与原对话并排比对。候选形态有两种：

1. **同一 session 内两个 chat 并排**：复用 `ChatGroupsView` 的 chat group grid（`src/vs/sessions/browser/parts/chatGroupsView.ts`）。
2. **两个独立 session 共享同一工作区（孪生）**：两次 `createNewSession(sameFolderUri, { isolationMode: 'workspace' })` + `openSessionToSide`，落在 `SessionsPart` 的 session 级 grid。

## Decision

选形态 1（同 session 多 chat）。

## Consequences

- fork 与子 agent 天然同 session、同 agent 树、同工作区/worktree，无隔离问题。
- 不触碰布局控制器的多 session 可见规则（`baseSessionLayoutController.ts` 的 B5：多 session 可见时暂停 per-session aux/panel 同步）、editor working set 切换（B2）与按 sessionId 的终端集合切换——这些在形态 2 下全部需要为「同工作区」开特例。
- focus 联动（组 `onDidFocus` → `session.activeChat` 同步）与布局持久化（`sessions.chatGroupsLayout`）为现有能力，零新增。
- 实施方案见 [chat-compare-split](../plans/chat-compare-split.md)。

## Alternatives

形态 2（双 session 孪生）**延后而非否决**：适用于「两个独立 agent 各自跑同一项目」的场景，与 PRD-011 的「比对同一会话的分支/子任务」不同。若将来立项，需要单独方案处理 B5 特例、editor working set 与终端跟随策略；本 ADR 不预设结论。
