---
title: "ADR-002 默认窗 Conversation：session 窗口与 chat tab"
type: decision
status: accepted
phase: N/A
updated: 2026-09-01
summary: "CONVERSATION_PART 自管 session 叶，每叶内嵌 Conversation IEditorPart；Fork 默认 tab；子代理默认叶内对话框；围栏与自有导航栈；只能藏不能关"
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

引擎合同（Agent Host）：用户点 Fork 是 **同一 AH session 的 peer chat**。连接面 `createChat(session, chat, { fork: { source, turnId } })` 映射到协议 `CreateChatParams.source: { kind: "fork", chat, turnId }`。本地非 AH 的 `loadSessionFromData` 新 `sessionId` 不是本产品权威。

HEAD `EditorParts` 只工厂 main / auxiliary / modal。未指定的 `openEditor` 落到 `activeGroup`。默认 `IHistoryService` 是 `GoScope.DEFAULT`（跨所有组）。已接受的 [INV-TOPO](../../docs/systems/workbench/parts-and-grid.md) 锁的是 **插入面**（编辑器仅 `EDITOR_PART`；Conversation 不是 editor pane），不是 ChatEditor 品牌名。

[ADR-001](001-chat-compare-form.md) 只约束 **Agents 窗口** PRD-011。本 ADR 不推翻 ADR-001。

候选：

1. **ConversationPart 网格 + 每叶一个 Conversation `IEditorPart`**（Modal 同款注册，共享 `windowId`，独立 scoped `IEditorService`）。
2. **自研 chat tab 条**：只认识 conversation chat，其它内容以后另造注册表。
3. **把对话放回 Preview `ChatEditor`**：中心重新变成 EditorPart。
4. **同一 EditorPart、组贴纸 sessionId**：扁平组冒充嵌套窗口（Grok Block；拒绝）。

## Decision

选形态 1。细节以 [conversation-session-windows](../plans/conversation-session-windows.md) §3 为 SSOT。摘要：

- 中心叶仍是 Layout `Parts.CONVERSATION_PART`。Part **自管**最多两叶的 session 窗口网格（不是 EditorGroup）。**每叶**内嵌一个 Conversation `IEditorPart`：DOM 父是该叶 content；`EditorParts.createConversationEditorPart` 注册到 `IEditorGroupsService.parts`；**不**新增 Layout `Parts` 枚举；`windowId` = 主窗（Modal special-case）；独立 scoped `IEditorService`。
- 这是 **第四类 editor 容器**（与 Modal/Aux 并列），**不是** `Parts.EDITOR_PART`，也不是「收窄 INV-TOPO 的脚注」。产品对话用新 `ConversationChatInput` + `ConversationEditorPane`。**禁止** `ChatEditorInput`。
- `PreferredGroup`：`CONVERSATION_GROUP` (`-5`)、`CONVERSATION_SIDE_GROUP` (`-6`)。围栏对齐 Modal：Conversation 组只接受 conversation 类 input，且只在显式目标时进入；文件 / untitled / `ChatEditorInput` / `SIDE_GROUP` / 未指定目标 **永远** MainEditorPart，即使 Conversation 组是 `activeGroup`。
- **一张 session 窗口 = 一个 AH session**（无引擎时 = 一个 stub session）。窗口内 tab = 该 session 的 chat。两扇窗 = 两个 Conversation EditorPart。禁止组贴纸 `sessionId`。
- Chrome 分层：**窗口**（藏、←→、关非根、PRD-002 SelectBox）vs **页**（对话\|轨迹、Dock、面包屑）。PRD-012 标题条透镜改为每 chat 页。
- 每个 session 有 **默认面**。根 tab 用 **关闭拦截器**（不是 pin/sticky）。session 窗口与整块 Conversation **不支持关闭，只支持隐藏**。关非根不得 `closeGroup` 根组。
- **同 session**：用户 Fork **默认新 tab**（workbench `createChat` / `_forkSession` + `CONVERSATION_GROUP`；**不** import `agentHostForkActions.ts`）；子代理 **默认 session 叶对话框**（父 pane mounted；不是 `mainContainer` visualize overlay，不是 `MODAL_GROUP`），**最大化才新建延伸 tab**；用户 split 走 `CONVERSATION_SIDE_GROUP`。
- **窗口并列**：另一 session 叶。共享同一个 Preview / Sources / Panel。**不是** ADR-001 形态 2。worktree 隔离 session 在没有 Preview-owner 规则前不得当真并排。
- 面包屑沿协议 **`origin.chat`**，不读 sessions `parentChat`。
- 导航：Conversation **自有**栈；`IHistoryService` 只服务 Preview。鼠标 4/5 在 `hasFocus(CONVERSATION_PART)` 时拦截。模式抄 `sessionsMouseNavigation.ts`，禁止 import。
- workbench **不得** import `vs/sessions`（ESLint `code-import-patterns`）。不把 `ChatGroupsView` 搬进默认窗。Agents 窗继续 ADR-001 / [chat-compare-split](../plans/chat-compare-split.md)。

## Consequences

- 2026-09-01 用户签收。须扩展 `EditorParts` / `findGroup` / `PreferredGroup`（S1）。知识层 `parts-and-grid` §5、`editor-part-tabs` §2/§4、`agent-ui` INV-TOPO 已随本签收改写为插入面合同；**S1–S6 已落**（S6 知识层签收 @ loop/C）。
- `IConversationLensSlots` 的 timeline/dock 退役，迁入 EditorPane；窗口 chrome 留在 Part/叶。
- 须改写 `does not host the lens as ChatEditorInput` 的断言形态，但 **保持** ChatEditorInput 禁令与 `chatEditorShellPaths` 默认窗路径。
- 实施方案：[conversation-session-windows](../plans/conversation-session-windows.md)（`accepted`）。需求：[PRD-016](../../docs/product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)。

## Alternatives

- 形态 2（自研 tab）：fork/子代理能做，但「tab 以后挂其它内容」要第二套注册表，与「复用 VS Code 多窗口/多组」相反。
- 形态 3（ChatEditor 占中心）：已由 M0/M5 INV-TOPO 拒绝。
- 形态 4（组贴纸 sessionId）：与 `addGroup` 扁平网格冲突；藏窗 vs 藏列、跨 session DND 无模型。Grok 2026-09-01 Block。
- 把同 session split 做成第二个 AH session：与引擎 `createChat` fork source 及「fork 依赖原根」冲突。
- 在默认窗搬 `ChatGroupsView`：违反 `workbench` 不得依赖 `sessions`。
- 复用 `IHistoryService` `GoScope.EDITOR_GROUP`：HEAD 默认是全局栈；不能靠改用户 navigationScope 冒充隔离。
