---
title: "ADR-002 默认窗 Conversation：session 窗口与 chat tab"
type: decision
status: proposed
phase: N/A
updated: 2026-09-01
summary: "默认窗中间 Conversation 内嵌作用域 EditorPart；一张 session 窗口=一个 AH session；Fork 默认 tab；子代理默认窗口内对话框、最大化才 tab；窗口并列=另一个 session；只能藏不能关"
---

# ADR-002 默认窗 Conversation：session 窗口与 chat tab

## Context

默认窗中心是 `CONVERSATION_PART`（非 `EditorInput`）。产品要在中间对话区：

- 多 tab（根/默认 chat 钉死；用户 Fork 为延伸 tab；子代理默认窗口内对话框，最大化才为延伸 tab）；
- 子代理 tab 顶 agent 层级面包屑（点击替换当前延伸 tab）；
- 每扇 session 窗口一键关闭根以外的 tab；
- 前进后退（按钮 + 鼠标侧键）；
- 同一 session 默认 tab，用户 split 则同窗两列；
- 窗口并列展示 **另一个 session**；
- 中间窗口与每个 session 的默认面 **只能隐藏、不能关闭**。

引擎合同（Agent Host）：用户点 Fork 是 **同一 AH session 的 peer chat**（`createChat(..., { fork })`），不是新根会话。本地非 AH 的 `loadSessionFromData` 新 `sessionId` 不是本产品权威。

[INV-TOPO](../../docs/systems/workbench/parts-and-grid.md) 禁止把 Conversation 做成主 `EDITOR_PART` 的 `ChatEditor`。[ADR-001](001-chat-compare-form.md) 只约束 **Agents 窗口** PRD-011：同 session 多 chat 并排；双 session 孪生在 Agents 窗延后。本 ADR 不推翻 ADR-001。

候选：

1. **Conversation 作用域 EditorPart**：`CONVERSATION_PART` 内嵌一组/多组 `EditorGroup`；默认 `openEditor` 仍进 Preview；显式目标才进 Conversation 组。
2. **自研 chat tab 条**：只认识 conversation chat，其它内容以后另造注册表。
3. **把对话放回 Preview `ChatEditor`**：中心重新变成 EditorPart。

## Decision

选形态 1。

- 中心叶仍是 `CONVERSATION_PART`。Part 内嵌 **Conversation-scoped `IEditorPart`**（可多组）。这是第三条打开插入面：`PreferredGroup` 点名 Conversation 组；**不得**复用 Preview 的 `SIDE_GROUP`。
- **一张 session 窗口 = 一个 AH session**（无引擎时 = 一个 stub session）。窗口内 tab = 该 session 的 chat（默认根 chat + peer）。页布局相同：SessionBar（含「对话 | 轨迹」）+ 阅读列 + Dock。
- 每个 session 有 **默认面**（默认根 chat tab 钉死）。session 窗口与整块 Conversation **不支持关闭，只支持隐藏**。隐藏后数据与 tab 模型仍在；再打开该 session 照常显示。
- **同 session**：用户 Fork **默认新 tab**；子代理 **默认窗口内对话框（不加 tab、不换根页）**，**最大化才新建延伸 tab**；用户 split 则在 **这一扇 session 窗口内** 拆列。仍是同一个 session、同一扇窗口。
- **窗口并列**：展示 **另一个 session** 的窗口（只能藏）。藏后回到单 session 窗口。
- Agent 拉起的子代理仍在原 session；未点不弹对话框、不开 tab。子代理 **tab**（最大化后）页顶为 origin 链面包屑：点击某一级切到该 agent，**当前延伸 tab 被替换**。每扇窗口提供一键关闭根 tab 以外的全部 tab。
- workbench **不得** import `vs/sessions`。不把 `ChatGroupsView` 搬进默认窗。Agents 窗继续 ADR-001 / [chat-compare-split](../plans/chat-compare-split.md)。

## Consequences

- 须改 `IEditorGroupsService` / `IEditorService` 打开目标，使 Conversation 组可被点名；默认路径与文件 Preview 隔离。
- INV-TOPO 收窄为：「禁止 ChatEditor 占主 `EDITOR_PART` 当中心」；允许 Conversation Part **内部** 使用 EditorGroup 画 tab。须在 parts-and-grid / editor-part-tabs 签收后改知识层（方案审查通过之后）。
- 前进后退复用 `IHistoryService` 的组作用域（`GoScope.EDITOR_GROUP`）+ Conversation 聚焦时拦截鼠标 4/5 键；与 Preview 文件历史分栈。
- 其它 `EditorInput` 可预留进 Conversation 组，但默认 `openEditor` 仍进 Preview；第一期只实现 conversation 类 input。
- 实施方案：[conversation-session-windows](../plans/conversation-session-windows.md)。需求：[PRD-016](../../docs/product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)。

## Alternatives

- 形态 2（自研 tab）：fork/子代理能做，但「tab 以后挂其它内容」要第二套注册表，与「复用 VS Code 多窗口/多组」相反。
- 形态 3（ChatEditor 占中心）：已由 M0/M5 INV-TOPO 拒绝。
- 把同 session split 做成第二个 AH session：与引擎 `createChat({ fork })` 及「fork 依赖原根」冲突。
- 在默认窗搬 `ChatGroupsView`：违反 `workbench` 不得依赖 `sessions`。
