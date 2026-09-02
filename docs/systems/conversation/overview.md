---
title: "Conversation 系统概览"
type: overview
status: accepted
phase: N/A
updated: 2026-09-02
summary: "三层：Part 槽宿主 → contrib 产品 chrome → 会话数据服务；关键符号表；与 Chat / Sessions / Agent Host 三套「会话」的边界"
---

# Conversation 系统概览

> 导航：[系统索引](INDEX.md)。不变量：[ADR-006](../../../dev/decisions/006-shell-invariants.md)。

## 1. 三层

```text
┌─ Part 槽宿主（workbench/browser/parts/conversation）──────────────────┐
│ ConversationPart = Parts.CONVERSATION_PART（中心叶，minimumWidth 300）  │
│ IConversationPartService.getSlots() → { sessionBar, sessionWindowGrid,  │
│                                          editorPartHost? }              │
│ 只提供 DOM 槽与 focus()；不渲染产品 chrome；不 import contrib            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ 填
┌─ 产品 chrome（workbench/contrib/conversation）─────────────────────────┐
│ Part 级：SessionBar（SelectBox、←→、关非根、Route）                      │
│ 窗口级：IConversationSessionWindowService — 最多两叶 session 窗口       │
│ 叶内：Conversation IEditorPart（CONVERSATION_GROUP）+ ConversationChatInput │
│ 页内：ConversationEditorPane → 「对话 | 轨迹」+ 阅读列 + Composer/Dock   │
│ 旁路：子代理 overlay、面包屑、导航栈、Navigator roster、StatusBar 芯片   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ 读写
┌─ 会话数据（今天 stub，PRD-008 后 adapter）─────────────────────────────┐
│ IConversationRosterService（decorator id 'conversationStubService'）    │
│ 会话 / 回合 / 轨迹记录 / 权限 / MessageQueue / AutoDrive / 引擎连接态    │
└─────────────────────────────────────────────────────────────────────────┘
```

层间只经接口：Part 不知道 contrib；contrib 不知道 stub 内部布局（只用 `ConversationStubTurn` 等导出类型）。引擎接通时**只换第三层**，见 [stub-and-fixtures](stub-and-fixtures.md)。

## 2. 关键符号

| 符号 | 文件 | 作用 |
|------|------|------|
| `ConversationPart` / `IConversationPartService` | `browser/parts/conversation/conversationPart.ts` | Part 本体；`onDidCreateSlots`、`getSlots()`、`focus()` |
| `partRegionHideControl.ts` | 同目录 | Conversation / Sources 区域内的 hide（−）控件，走 `setPartHidden` |
| `IConversationSessionWindowService` | `contrib/conversation/browser/conversationSessionWindowService.ts` | session 窗口叶：`ensurePrimaryWindow`、`openSessionBeside`、`hide/restoreSessionWindow`；`CONVERSATION_SESSION_WINDOW_MAX_LEAVES = 2` |
| `IConversationSessionChatService` | `conversationSessionChatService.ts` | 每 session 的 chat catalog（root / fork / tool / sideChat）、fork tab、子代理 overlay、面包屑、关非根、split |
| `IConversationNavigationService` | `conversationNavigationService.ts` | 每个 Conversation `IEditorPart` 自有的前进 / 后退栈（50 深），与 `IHistoryService` 隔离 |
| `ConversationChatInput` | `conversationChatInput.ts` | 唯一被 Conversation 组接受的 `EditorInput`；scheme `conversation-chat`；实现 `IEditorCloseHandler` 拦根 tab 关闭 |
| `conversationEditorRouting.ts`（common） | `isBlockedFromConversationGroup` 等 | ADR-002 围栏：非 `ConversationChatInput` 一律弹回 Preview |
| `ConversationEditorPane` | `conversationEditorPane.ts` | `workbench.editor.conversationChat`；页 chrome 宿主 |
| `ConversationLens` | `conversationLens.ts` | SessionBar + 时间线 + Dock 的组装体；持久化当前透镜 id（`StorageScope.WORKSPACE`） |
| `ConversationIdentityStrip` | `conversationIdentityStrip.ts` | 阅读列顶身份条（PreFirst 居中区 / Active 列顶）；引擎 chip 与 StatusBar `status.conversation.engine` 共用 `getConnectionPhaseStatusBarText`（H4b）与 B10 pane 路由 |
| `IConversationRosterService` | `conversationStubService.ts` | 会话数据契约（见 [stub-and-fixtures](stub-and-fixtures.md)） |
| `ConversationSessionsView` | `conversationSessionsView.ts` | Navigator「Sessions」容器（`workbench.view.sessions`）内的 roster |
| `UniverseAgentDeepLinkHandler` | `universeAgentDeepLink.contribution.ts` | `universe-agent://` URL handler → Settings 页（[page-access-schemes](../../../dev/plans/page-access-schemes.md)） |
| `ua.connection` / `ua.engine` panes | `connectionPreferencesPane.ts` / `enginePreferencesPane.ts` | vscode Preferences 内的 UA 两页；无引擎诚实空 + Test（[settings-two-surfaces](../../../dev/plans/settings-two-surfaces.md)） |

## 3. 三套「会话」不要混

| 名称 | Owner | 在本系统中的地位 |
|------|-------|------------------|
| `IConversationRosterService` 会话 | 本系统 | 产品 Conversation 今天的唯一数据源（stub）；引擎后由 adapter 实现同一契约 |
| `IChatModel` / `sessionResource` | `contrib/chat` | Copilot Chat 的持久化模型；**禁止**当本系统权威（ADR-006 INV-NO-COPILOT） |
| AHP session / `IAgentHostService` | `platform/agentHost` | vscode 侧 harness 管道；**不是**引擎权威（[agent-host overview](../agent-host/overview.md)） |
| `ISession` / `ISessionsService` | `vs/sessions` | Agents Window 目录 facade；本系统不依赖 |
| UniverseAgent session | 外仓引擎 | 目标权威；接线设计见 R5 / [reference/universe-agent](../../reference/universe-agent/INDEX.md) |

## 4. 与邻接系统的接缝

- **Workbench Layout**：本 Part 是中心叶；显隐走 `IWorkbenchLayoutService.setPartHidden`，互斥由 `enforceAgentShellVisible` 维持。本系统不改 grid。
- **Editor 服务**：Conversation 组是 `IEditorGroupsService.parts` 中的第四类 part，`excludeFromGlobalEditorAggregation`；默认路径下文件类 input 落主 `EDITOR_PART`（Preview）。[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) 放宽围栏接受**显式动作**带入的只读 Diff 审阅 input（`ConversationDiffReviewInput`），是 INV-TOPO 围栏的唯一登记例外（F1 已落）；规格见 [session-windows](session-windows.md) §2 · [sources-changes-diff](../../../dev/plans/sources-changes-diff.md)。
- **Chat contrib**：只借 `chatContentParts/**` 渲染函数，经 `IConversationTurnContentAdapter` 单点入参；`chatShellRouting.ts` 把默认窗的 Chat 入口转到本 Part。
- **Sources / Preview**：本系统不打开文件；点击时间线内文件引用走 `IEditorService.openEditor` 到 Preview。
- **Preferences**：`ua.connection` / `ua.engine` 两页注册为 `IPreferencesEditorPane`，Settings 宿主仍是 `SettingsEditor2`。

## 5. 当前边界（无引擎）

- 会话与回合在内存，重启即丢（[PRD-017](../../product/requirements.md#prd-017-本地会话持久化) `proposed`）。
- 助手回合是本地 echo，UI 与 fixture 文案带 `Stub`；引擎 chip（身份条 + StatusBar）文案由 `IUniverseAgentConnection.getConnectionPhase()` 经 `getConnectionPhaseStatusBarText` 驱动（[connection-hub H4b](../../../dev/plans/connection-hub-client.md)）；stub 期默认 disconnected，点击路由同 B10（connected → Engine pane，否则 Connection）。
- 四钮默认键位与 F6 / Shift+F6 part 循环已登记（[commands §7](commands.md#7-键盘可达性现状)；[PRD-018](../../product/requirements.md#prd-018-键盘可达与辅助功能) `accepted`）；Conversation 内透镜 / 过程折 / 权限座位等仍缺默认键位。
- `contrib/conversation` 注册于 `workbench.common.main.ts`，Web 入口理论共用但无冒烟证据（[PRD-019](../../product/requirements.md#prd-019-web--远程窗口一致性)）。
