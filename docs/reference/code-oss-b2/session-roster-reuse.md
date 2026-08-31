---
title: "会话列表复用：Navigator roster 用哪些 vscode 零件"
type: reference
status: draft
phase: N/A
updated: 2026-08-31
summary: "对照 Singularity SessionList / Desktop Navigator Sessions：产品 roster 宿主、WorkbenchList donor、UA adapter 替换点；禁止 IChatModel / agentSessions 当真相"
---

# 会话列表复用：Navigator roster 用哪些 vscode 零件

> **结构性决策 SSOT** = [`dev/plans/page-access-schemes.md`](../../../dev/plans/page-access-schemes.md)；冲突以父方案为准。

外仓合同（只读，不复制正文）：[IA §2 Navigator roster](../../../../UniverseAgentDesktop/docs/product/information-architecture.md)、[screen-routing `SessionListScreen`](../../../../UniverseAgentDesktop/docs/reference/upstream/singularity/systems/navigation/screen-routing.md)、[ADR-061 决策 5](../../../../UniverseAgentDesktop/dev/decisions/061-code-oss-base-and-editor-window-shell.md)。  
本仓事实：[agent-ui](../../systems/chat/agent-ui.md)、[widget-parts](../../systems/chat/widget-parts.md)、[views-and-composites](../../systems/workbench/views-and-composites.md)、[activity-and-sidebar](../../systems/workbench/activity-and-sidebar.md)、[desktop-shell-mapping](desktop-shell-mapping.md)。

> **推荐（非正式决策）** = 本页对 ADR-061「进清单」的零件翻译，不是新 ADR。**已落地** = HEAD M3 代码事实。

## 1. 问题

Singularity `SessionListScreen` 曾是导航中枢（根页面：选会话再进聊天）。Desktop 把会话入口收到 Navigator Sessions（Activity 段含 Sessions），**不是**独立全屏页。

ADR-061 决策 5 写了「会话列表侧边栏（sessions viewlet / `agentSessions` 控件族）」进复用清单，但只写姿态。HEAD 是 stub roster，**没有**「复用哪个类、数据从哪来」。本页把那句话翻成零件级：复用的是 `ViewPane` + `WorkbenchList` **形态**，不是把 `AgentSessionsControl` 整块搬进 **产品 roster**（`workbench.view.sessions` / `ConversationSessionsView`）。

## 2. 五套「会话」不要混

权威画线见 [agent-ui §6](../../systems/chat/agent-ui.md)（那边列 UA / `IChatModel` / `ISessionsService`）。本页再拆 stub 占位与 agentSessions viewer，所以是五套。

| 名称 | Owner | 本页角色 |
|------|-------|----------|
| UA session | 外仓 session-core | **唯一权威**（有引擎后） |
| `IConversationStubService` | `contrib/conversation` | **无引擎占位**；adapter 的替换面（agent-ui §6 未列） |
| `IChatModel` / `sessionResource` | `contrib/chat` 持久化 | **禁止**当产品 roster |
| agentSessions / `IAgentSessionsService` | `contrib/chat` viewer 模型 | **禁止**当产品 roster（与 `IChatModel` 不是同一套） |
| `ISessionsService` | `vs/sessions` | Agents Window only；workbench 不得 import |

`ConversationStubModel` 是内存行，与 SessionBar 共享；**不是** UA listed session，也不是 `IChatModel`。

## 3. 推荐复用（非正式决策）

### 宿主（已落地，保持）

产品 roster = `ConversationSessionsView`（`CONVERSATION_SESSIONS_VIEW_ID` = `workbench.view.conversationSessions`），`extends ViewPane`，挂在 **独立** Sidebar 容器 `workbench.view.sessions`（`CONVERSATION_SESSIONS_CONTAINER_ID`，非 Explorer 内叶）。容器：`hideIfEmpty: true`、`alwaysUseContainerInfo: true`、`mergeViewWithContainerWhenSingleView: true`、`order: 10`；view：`canToggleVisibility: true`。单叶 + `hideIfEmpty`：用户关掉这一叶后 Activity 图标会消失（与「五段可点选」张力，见 [navigator-tabs-access](navigator-tabs-access.md) §2）。实现：`conversationSessionsView.ts`。测试：`conversationSessionsView.test.ts`。

- **不要**新 Part。
- **不要**把 roster 做成 Conversation 透镜（中心仍是 `CONVERSATION_PART`）。

### 控件 donor

| 复用 | 不复用 |
|------|--------|
| `WorkbenchList` / `IListVirtualDelegate` / 22px 行高（已在用） | `AgentSessionsControl` 整块（welcome / entitlement / archive / cloud） |
| ViewPane 标题动作 New / Delete 模式（删的是 **当前活动会话** `getActiveSessionId()`，不是列表焦点行） | Copilot Archive All / Mark All Read（[widget-parts §8.1](../../systems/chat/widget-parts.md)：默认窗 F1 已 `IsSessionsWindowContext` 门闩）。**不要**把 `workbench.action.chat.openSessionInEditorGroup`（Open as Editor）当成已门闩：其 `when` 是 `IsSessionsWindowContext.negate()`（**默认窗启用**），执行走 `openSession` → `ChatEditorInput`。默认窗未挂 agentSessions viewer 故当前不可达，属 **未闭合 INV-TOPO 项** |
| SessionBar 与 roster **同一服务** | 第二份列表状态 |

已落地动作：`workbench.action.conversationSessions.newSession` / `deleteSession`；点击行 → `IConversationStubService.switchSession`。数据 = `IConversationStubService` / `ConversationStubModel`，**仅内存**。

### 有引擎后：换服务实现，不换 View

`IConversationStubService` 演进或换成 `IConversationRosterService`（推荐名，非正式），背后 adapter → UA listed sessions。View 只绑 `getSessions` / `getActiveSessionId()` / `switchSession` / `createSession` / `deleteSession` / 变更事件。高亮谓词 = `getActiveSessionId()`（与 §5 同一条）。

## 4. 与 agentSessions 的边界

| | 默认 Code 窗口 | Agents Window / donor |
|--|----------------|------------------------|
| 产品 roster | 容器 `workbench.view.sessions` / 叶 `workbench.view.conversationSessions` | — |
| `contrib/chat/browser/agentSessions/` | **禁止**再挂一份 Copilot sessions viewlet | 可留（donor `ChatViewPane` / Agents Window） |

点击切 `CONVERSATION_PART` 当前会话，**禁止** `openEditor(ChatEditorInput)`。`ISessionsService` 是 Agents Window 目录，不是 Navigator roster。

**禁止的偷换**

| 偷换 | 为什么算错 |
|------|------------|
| `AgentSessionsControl` 整块进产品 roster（`workbench.view.sessions` / `ConversationSessionsView`） | 进清单的是 `ViewPane` + `WorkbenchList` 形态，不是 Copilot 控件族；挂哪个容器都禁止 |
| `IChatModel` / `IChatSessionsService` 当 roster 真相 | agent-ui §6；INV-NO-COPILOT |
| workbench import `ISessionsService` | Agents Window only |
| roster 升格为新 Part / Conversation 透镜 | 宿主已是 Sidebar `ViewPane` |
| 点击打开 `ChatEditorInput` | 违反 INV-TOPO |

## 5. 产品动作对照

| Desktop / Singularity | 本仓 v1（已落地 stub） | 有引擎后 |
|----------------------|------------------------|----------|
| 列表选择会话 | stub `switchSession` | adapter bind listed id |
| New session | 内存新会话（标题 `New session` / `New session N`，`createUniqueNewSessionTitle()`） | `cmd.session.create` 生产路径（外仓） |
| Delete | 内存；删最后一项新建 Untitled | UA delete；空列表策略另切片 |
| History | SessionBar 提示 No history | 不把 Copilot history 当产品 History |
| 高亮 = 当前 | `getActiveSessionId()` | 同一谓词 |

## 6. 非目标

- 本页不接引擎、不改 `vs/sessions`。
- 不做 AppTabBar 多会话 tab（[chrome-title-status](../../systems/workbench/chrome-title-status.md) 已松映射）。
- 对话 **时间线** 列表不在本页（见 [conversation-lens-assembly](conversation-lens-assembly.md)）。

## 7. 相关文档

- [agent-ui](../../systems/chat/agent-ui.md) · [widget-parts](../../systems/chat/widget-parts.md)
- [views-and-composites](../../systems/workbench/views-and-composites.md) · [activity-and-sidebar](../../systems/workbench/activity-and-sidebar.md)
- [desktop-shell-mapping](desktop-shell-mapping.md) · [conversation-lens-assembly](conversation-lens-assembly.md) · [navigator-tabs-access](navigator-tabs-access.md)

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。Critical：禁令目标是产品 roster（`workbench.view.sessions`），不是 Explorer。Important：Open as Editor 默认窗 `when` 未门闩（未闭合 INV-TOPO）；adapter 须 `getActiveSessionId()`；新建标题是 `New session` / `New session N`（`Untitled` 只作种子 / 删空回退）。
