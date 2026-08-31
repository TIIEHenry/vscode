---
title: "ChatWidget 零件：列表、输入栈、content parts"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-31
summary: "ChatWidget 内部清单（列表、输入栈、picker、content parts 分组）；标 donor 与必须按 Desktop Conversation / Input Dock 重写的面；不是产品 Conversation"
---

# ChatWidget 零件

> 导航：[Chat 索引](INDEX.md)。宿主 / INV-TOPO / Copilot 边界：[agent-ui.md](agent-ui.md)。文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)。  
> 本页只盘 **`ChatWidget` 内部零件**。Desktop Conversation 是外仓产品面；本仓 Widget **不是** 那个 Conversation。

`widget/` 下约 **177** 个 `.ts` 文件。下文按角色分组，不枚举。组织规则：`widget/` 内核心零件必须被 `ChatWidget` **直接**引用。

实际路径：`src/vs/workbench/contrib/chat/browser/widget/`。content parts 在 **`widget/chatContentParts/`**（不在 `browser/` 根）。

## 1. 边界：零件 ≠ 产品 Conversation

`ChatWidget` 实现 `IChatWidget`（`browser/chat.ts`），按 `sessionResource` 挂到 `IChatModel` / `ChatViewModel`。它是 MIT 开源对话零件：列表 + 输入 + 选择器 + 响应块。

**不是：**

- Desktop Conversation Part（窗口壳中心透镜）
- SessionBar / 四钮 / Inbox / 权限座位
- UniverseAgent session 真相（权威在外仓；本仓 `IChatModel` 禁止提成权威）

宿主（`ChatViewPane` / `ChatEditor` / Quick Chat / Sessions 叶）见 [agent-ui.md](agent-ui.md)。本页不重复宿主红线。

发送路径：`acceptInput` → `IChatService.sendRequest`。改造接线时这条链要换成 UA adapter，但零件本身仍可当 donor。

## 2. `ChatWidget` 装配

根：`browser/widget/chatWidget.ts`。`render(parent)` 拼出 `.interactive-session`：

```text
.interactive-session
├── welcome（ChatViewWelcomePart，空会话）
├── [可选] ChatInputPart     ← renderInputOnTop 时在上（Quick Chat / composer）
├── .interactive-list        ← ChatListWidget（WorkbenchObjectTree）
├── ChatSuggestNextWidget    ← handoff / 下一提示
├── [可选] ChatReadOnlyBanner
└── ChatInputPart            ← 默认在下；内部再叠 chatInputStack
```

另有：内联编辑用第二份 `ChatInputPart`；`ChatFindWidget`（`enableFind`）；`ChatPetWidget`（装饰，可忽略）；contrib 钩子 `IChatWidgetContrib`。

### 公开面（按职责，不列全部方法）

契约是 `IChatWidget`；`ChatWidget` 另有宿主用的 `setModel` / `layout` / `setVisible`。

| 职责 | 代表符号 |
|------|----------|
| 会话绑定 | `setModel`、`viewModel`、`clear`、`getViewState` / `restoreViewState`、`getInputState` |
| 列表导航 | `reveal`、`focus`、`getFocus`、`getSibling`、`focusResponseItem`、`holdAutoScroll` |
| 输入 | `input` / `inputPart`、`inputEditor`、`setInput` / `getInput`、`acceptInput`、`focusInput` |
| 解析 / 模式 | `parsedInput`、`refreshParsedInput`、`getModeRequestOptions`、`getSelectedModelRequestOptions` |
| 请求编辑 | `startEditing` / `cancelEditing` / `finishedEditing`、`rerunLastRequest` |
| 代码块 / 文件树 | `getCodeBlockInfosForResponse`、`getFileTreeInfosForResponse` |
| 布局 / 显隐 | `layout`、`layoutForInputHeight`、`setVisible`、`setInputVisible`、`setReadOnly` |
| Agent 锁 / handoff | `lockToCodingAgent`、`executeHandoff`、`handleDelegationExitIfNeeded` |
| 查找 | `getFindController` |

`input` 在请求内联编辑时指向内联 `ChatInputPart`；`inputPart` **始终**是底部主输入。

## 3. 列表 / 回合

| 文件 | 角色 |
|------|------|
| `chatListWidget.ts` | `ChatListWidget`：`WorkbenchObjectTree<ChatTreeItem>`；滚动、`scrollLock`、`AutoScrollHolds`、reveal/focus、把 renderer 的 code block / file tree 查询转出 |
| `chatListRenderer.ts` | `ChatListItemRenderer`：把 `IChatRendererContent[]` diff 成 `IChatContentPart[]`；虚拟化复用模板 |
| `chatOptions.ts` | 嵌入编辑器主题 / 字号 |
| `chatFind/` | 时间线查找（`ChatFindWidget`） |
| `chatTurnPills.ts` | 回合药丸（与 content part `chatTurnPillsPart` 配套） |
| `chatDragAndDrop.ts` / `chatPendingDragAndDrop.ts` / `chatReferenceDrop.ts` | 拖放附件 |

`ChatListWidget` 头注释要点：`AutoScrollHolds` 是引用计数，编辑请求与选区可同时按住自动滚底，最后一个 hold 释放才恢复。

树项是 `ChatTreeItem`（request / response VM）。产品阅读层级（谁折叠、工具卡怎么排）以 Desktop 为准，不要像素抄 Copilot 回合。

**Donor：** 虚拟化列表、`hasSameContent` 增量重绘、code block 池、自动滚底 hold。  
**不是产品时间线：** 无权限座位、无 Desktop 工具卡路由。

## 4. 输入栈

`ChatInputPart`（`input/chatInputPart.ts`）实现 `IHistoryNavigationWidget`，是最接近 Input Dock 的现成块。体量很大（附件、模式、模型、工具、todo、carousel、语音……），**整块搬进新产品面会把 VS Code picker 合同一起搬进来**。

`input/chatInputStack.ts` 只管 **表面叠放**：槽位 `ChatInputStackSlot`（`Empty` / `Docked` / `Standalone`），让 notice / goal banner / todo / artifacts / working set 与输入框看起来像一条连续表面。它 **不是** Desktop Input Dock 合同。

默认栈（自上而下，槽可空）：

```text
chat-input-stack
├── notices / onboarding / goal banner
├── todo list / artifacts / working set
├── 附件条（ChatAttachmentModel）
├── CodeEditorWidget 输入（补全、粘贴、hover）
└── 工具条：execute + secondary（一排 picker）
```

### 输入编辑器（`input/editor/`）

`CodeEditorWidget` + `chatInputCompletions` / `agentHostInputCompletions` / 占位装饰 / paste providers。补全与编辑器基础设施可当 donor。

### `ChatInputPart` 公开面（摘要）

| 职责 | 代表符号 |
|------|----------|
| 文本 / 历史 | `setValue`、`acceptInput`、`showPreviousValue` / `showNextValue`、`getCurrentInputState` |
| 附件 | `attachmentModel`、`getAttachedContext`、`renderAttachedContext` |
| 模型 / 模式 | `currentLanguageModel`、`switchModel*`、`openModelPicker`、`setChatMode`、`openModePicker` |
| 其它 picker | `openPermissionPicker`、`openSessionTargetPicker`、`openDelegationPicker`、`openChatSessionPicker` |
| 工具 | `selectedToolsModel`（`ChatSelectedTools`） |
| 叠层控件 | todo / artifacts / question carousel / plan review |

## 5. Pickers（绑 VS Code participant / model）

均在 `input/`，由 `MenuId` 工具条挂到 `ChatInputPart`：

| Picker | 路径 | 选的是什么 |
|--------|------|------------|
| 模型 | `modelPicker/*`（`modelPickerActionItem`、`modelPickerWidget`） | `ILanguageModelsService` 的模型元数据 |
| 模式 | `modePickerActionItem.ts` | `IChatMode`（Agent / Ask / Edit / Plan + 自定义） |
| 权限 | `permissionPickerActionItem.ts` | `ChatPermissionLevel`（VS Code 自动批准，≠ Desktop 权限座位） |
| 会话目标 | `sessionTargetPickerActionItem.ts` | agent host / 本地会话类型 |
| 工作区 | `workspacePickerActionItem.ts` | 空窗口时的目标文件夹 |
| 委托 | `delegationSessionPickerActionItem.ts` | 交给另一 session |
| 队列 | `chatQueuePickerActionItem.ts` | 请求队列 |
| 基类 | `chatInputPickerActionItem.ts`、`chatInputPickerResponsiveLayout.ts` | 溢出与窄宽布局 |

B2 接到 UniverseAgent 后，这些选择器要 **换或旁路**。不得用这套 picker 布局顶替 Input Dock。

## 6. Content parts（按角色，不枚举）

契约：`chatContentParts/chatContentParts.ts` 的 `IChatContentPart`（`hasSameContent`、可选 `onDidRemount`、code block 所有权）。`ChatListItemRenderer.renderChatContentPart` 按 `IChatRendererContent` 种类分发。

`widget/chatContentParts/` 含 media、`chatIncrementalRendering/`、`toolInvocationParts/`，文件数过百。分组如下：

| 角色 | 代表（不穷举） | Desktop 含义 |
|------|----------------|--------------|
| **契约 / 池** | `chatContentParts.ts`、`chatContentCodePools.ts`、`chatCollections.ts` | 渲染接口；可留 |
| **Markdown / 代码** | `chatMarkdownContentPart`、`codeBlockPart`、`chatDiffBlockPart`、增量渲染 | **强 donor** |
| **进度 / thinking / task** | `chatProgressContentPart`、`chatThinking*`、`chatTaskContentPart` | 阅读层级按 Desktop，零件可剥皮 |
| **工具调用** | `toolInvocationParts/`（确认、进度、输出、终端、MCP、风险徽章） | 确认流 ≠ 产品权限 CTA；卡片路由要重写 |
| **编辑 / diff** | `chatTextEditContentPart`、`chatWorkspaceEditContentPart`、`chatMultiDiffContentPart`、`chatChangesSummaryPart` | 配套 `ChatEditingSession`，不是 Conversation 中心 |
| **确认 / 问答** | `chatConfirmation*`、`chatElicitationContentPart`、`chatQuestionCarouselPart`、`chatPlanReviewPart` | VS Code elicitation；无对等 ResponseSeat |
| **引用 / 附件 / 树** | `chatAttachmentsContentPart`、`chatReferencesContentPart`、`chatTreeContentPart`、`chatCodeCitationContentPart` | 上下文展示 donor |
| **子 agent / 合并** | `chatSubagentContentPart`、`chatAgentMergeContentPart` | 绑 `IChatAgentService` participant |
| **MCP / 扩展 / hook / PR** | `chatMcp*`、`chatExtensionsContentPart`、`chatHookContentPart`、`chatPullRequestContentPart` | 产品面按需映射，勿整包当时间线 |
| **额度 / 错误 / tip** | `chatQuotaExceededPart`、`chatAnonymousRateLimitedPart`、`chatErrorContentPart`、`chatTipContentPart` | **高 Copilot/账号耦合**，不进复用清单 |
| **其它回合装饰** | `chatTurnPillsPart`、`chatTodoListWidget`、`chatSuggestNextWidget`、`chatRequestOriginPart` | 可选 donor；handoff 语义要对照 UA |

附件模型在 `browser/attachments/`（contrib 根，非 `widget/` 内）：`ChatAttachmentModel`、paste target、变量解析。

## 7. 周边（Widget 直接引用，但不是时间线内核）

| 区域 | 路径 | 改造态度 |
|------|------|----------|
| 欢迎 / setup | `viewsWelcome/`、`chatSetup/`（contrib，非 widget） | 高 Copilot 耦合；**不进复用** |
| 只读条 | `chatReadOnlyBanner.ts` | 可留或换成产品条 |
| 查找 | `chatFind/` | donor |
| Pet | `chatPetWidget*.ts` | 装饰；产品面可丢 |
| Checkpoint / fork | `chatRestoreCheckpointActionViewItem.ts`、`chatForkActionViewItem.ts` | 绑 `IChatModel` checkpoint |
| 编辑会话 UI | `browser/chatEditing/` | 配套面，见 tools-and-editing |
| Agent sessions 控件 | `browser/agentSessions/` | 勿与 `vs/sessions` 混淆 |

## 8. Donor vs 必须重写

对照对象是 **Desktop Conversation / Input Dock**，不是把本仓 Widget 升格成产品 Conversation。Input Dock 的例外合同在 **外仓 ui-interaction-spec §8.3**（本文不复述、不发明条款）。

| 面 | 本仓最近似 | 判定 |
|----|------------|------|
| 时间线虚拟化 + 增量 part | `ChatListWidget` + `IChatContentPart` | **Donor**（剥 Copilot 皮） |
| Markdown / code block / diff 块 | `chatMarkdownContentPart`、`codeBlockPart` | **Donor** |
| 输入编辑器、补全、历史、附件条 | `input/editor/*`、`ChatAttachmentModel` | **Donor**（基础设施） |
| 输入表面叠放 | `chatInputStack.ts` | 可参考叠层算法；**不是** Dock 合同 |
| `ChatInputPart` 整块（含一排 picker） | `chatInputPart.ts` | **必须重写接线**。外仓 ui-interaction-spec §8.3 的 Input Dock / MessageQueue 不得用 VS Code picker 布局顶替 |
| 模型 / 模式 / 权限 / 会话目标 picker | `input/*Picker*` | **换或旁路**（绑 participant / entitlement / Copilot 模型族） |
| 工具确认 / elicitation | `toolInvocationParts/`、`chatConfirmation*` | 机制可参考；**权限座位 / CTA 自研** |
| SessionBar、四钮、Inbox | 无对等（标题条 / Activity 不是） | **必须自研**（见壳映射） |
| 额度 / setup / anonymous rate limit | `chatQuotaExceededPart`、`chatSetup/` | **禁止复用**（INV-NO-COPILOT） |
| 会话真相 | `IChatModel` | **禁止**当 UA session-core |

**复用建议（分析，非正式决策）：** 列表虚拟化、markdown/code block、输入编辑器补全值得当 donor。`ChatInputPart` 当对照实现，按 §8.3 重做 Dock。SessionBar、四钮、权限座位、Inbox 按 Desktop 自研。

## 8.1 Agent Sessions 命令面板

`IAgentSessionsService` 侧栏的批量管理命令（Archive All、Mark All Read、Delete All Local Sessions、Show/Hide/Toggle Agent Sessions Sidebar、Focus Agent Sessions 等）仅在 **Agents Window**（`IsSessionsWindowContext`）的 Command Palette 中列出；默认 Code 窗口不暴露这些 F1 入口，产品会话列表走 `IConversationStubService` / Conversation Navigator，而非 Copilot Agent Sessions 管理面。

## 8.2 Chat widget chrome 命令面板（INV-NO-COPILOT）

默认 Code 窗口 Command Palette 不列出 Copilot **Chat widget 内导航 / 上下文 / 代码块 / 查找 / 文件树 / 无障碍 / 提示导航** 捐赠命令（`IsSessionsWindowContext` 门闩；Agents Window 保留）：`workbench.action.chat.attachFile`、`workbench.action.chat.attachPinnedEditors`、`workbench.action.chat.attachSelection`、`workbench.action.chat.insertCodeBlock`、`workbench.action.chat.insertIntoNewFile`、`workbench.action.chat.runInTerminal`、`workbench.action.chat.nextCodeBlock`、`workbench.action.chat.previousCodeBlock`、`workbench.action.chat.find`、`workbench.action.chat.nextFileTree`、`workbench.action.chat.previousFileTree`、`workbench.action.chat.focusConfirmation`、`workbench.action.chat.toggleThinkingContentAccessibleView`、`workbench.action.chat.nextUserPrompt`、`workbench.action.chat.previousUserPrompt`。各命令在 Chat widget 内的 **keybinding** 与上下文菜单保留；仅 F1 入口受门闩。

## 9. 相关文档

- [Agent UI 清单](agent-ui.md) — 宿主、INV-TOPO、Copilot 边界
- [Chat 概览](overview.md) — `IChatService` / 工具 / 编辑会话协作
- [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) — Conversation Part 与 Widget 的壳层差
- 文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)
