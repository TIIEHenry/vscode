---
title: "Agent UI 清单：宿主、Widget、Copilot 边界"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-01
summary: "本仓对话 UI 三层；Conversation 列 + session 窗口/chat tab + empty-hero；M5 切片 1–4 已落（chatShellRouting、roster、D4 V1–V8）；D5 EH 仍 open"
---

# Agent UI 清单

> 导航：[Chat 索引](INDEX.md)。文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)。  
> B2：Conversation **不是** Preview 里的 `ChatEditor` tab（INV-TOPO）；中心叶仍是 `CONVERSATION_PART`。Part **内部**嵌 Conversation `IEditorPart` 画 chat tab（**PRD-016 S1–S5 已落**）。**0×** 依赖 GitHub Copilot（INV-NO-COPILOT）。  
> Sessions 窗口契约：[LAYOUT.md](../../../src/vs/sessions/LAYOUT.md)、[SESSIONS.md](../../../src/vs/sessions/SESSIONS.md)。

本页回答：改造时 **哪些 UI 是 MIT 开源零件、哪些宿主违反产品壳、哪些状态机不能当会话真相**。

## 1. 三层，不要混谈

```text
┌─ 窗口壳（Parts / Grid）─────────────────────────────────────┐
│  默认 Code（M1+PRD-016）：CONVERSATION_PART 中心（session 窗口 + 嵌套 EditorPart） │
│              End 列 EDITOR_PART（Preview）+ SOURCES Files    │
│              titlebar 四钮 Nav/Conv/Preview/Sources（D7）    │
│  Agents Window：SESSIONS_PART 中心 + 可选 EDITOR_PART       │
└─────────────────────────────────────────────────────────────┘
        │ 嵌
┌─ 宿主（把 Widget 装进某个 Part / View / Editor）────────────┐
│  ChatViewPane（Sidebar/Panel 视图）                          │
│  ChatEditor + ChatEditorInput（EDITOR_PART tab）← 违反 TOPO │
│  chatQuick（Quick Chat）                                     │
│  SessionView / AbstractChatView（SESSIONS_PART 内叶）        │
└─────────────────────────────────────────────────────────────┘
        │ 嵌
┌─ ChatWidget 零件（列表、输入、content parts）───────────────┐
│  browser/widget/  — 必须被 ChatWidget 直接引用的零件         │
│  会话模型 IChatService / IChatModel（VS Code chat 真相）     │
└─────────────────────────────────────────────────────────────┘
```

Desktop 合同：窗口壳 = Singularity/IDEA；Conversation 内 = 时间线 + Input Dock；引擎真相 = UniverseAgent。  
因此：**壳要改 Part；对话产品面要自研接线；Widget 零件最多当 donor。** 不能把 `IChatModel` 或 Copilot provider 提成权威。

## 2. ChatWidget 零件（可评估复用的 MIT 面）

根：`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`（`ChatWidget`）。  
组织规则：`widget/` 内核心零件必须被 `ChatWidget` **直接**引用。

| 区域 | 路径（均在 `browser/widget/`） | 改造含义 |
|------|-------------------------------|----------|
| 列表 / 回合 | `chatListWidget.ts`、content parts（`chatContentParts/` 在 browser 根） | 时间线 donor；产品阅读层级以 Desktop spec §8.6 为准，不要像素抄 Copilot |
| 输入 | `input/chatInputPart.ts`、`chatInputStack.ts`、input/editor/* | 最接近 Input Dock 的现成块；**不得**把 Desktop §8.3 合同换成这套 picker 布局 |
| 模型/模式/工具条 | `input/modelPicker/*`、`modePickerActionItem.ts`、`chatSelectedTools.ts` | 绑 VS Code participant/model；B2 接线 UA 后这些选择器要换或旁路 |
| 附件 | `browser/attachments/`（contrib 根，非 widget 内） | 上下文附件；与 UA 附件模型需 adapter |
| 欢迎 / setup | `viewsWelcome/`、`chatSetup/` | **高 Copilot/账号耦合**，见 §5 |
| 编辑会话 UI | `browser/chatEditing/` | workspace edits/diff；配套面，不是 Conversation 中心 |
| Agent sessions 控件 | `browser/agentSessions/` | 工作台内「会话列表」另一套，勿与 `vs/sessions` 服务混淆 |

`IChatWidget` / `IChatWidgetService`：`browser/chat.ts`。按 `sessionResource`（`URI`）查找 Widget。

**复用建议（分析，非正式决策）：** 列表虚拟化、markdown/code block content parts、输入编辑器补全基础设施值得当 donor。SessionBar、四钮、权限座位、Inbox 按 Desktop 自研。

**Agent Host 类型分层（M5 切片 3）：** `IAgentHostMcpServer`（MCP server status / enablement / start/stop 协议面）下沉至 `platform/agentHost/common/agentHostMcpServer.ts`；`workbench/contrib/chat` 与 `vs/sessions` 均依赖 platform 落点，workbench 生产路径 **不再** import `sessions/common` 取该类型；eslint `code-import-patterns` 已从 workbench/contrib allow-list 去掉 `vs/sessions/~`（H7）。

**复用姿态拍板（人类，2026-08-30，外仓父方案 §3 / ADR-061 决策 5）：** sessions / agent-host **配套功能面默认保留绝大部分**（Customizations 编辑器零件、Tasks / worktree 运行面；含功能，不只 UI）。姿态 = 默认保留、例外才换。**2026-09-01 产品目录：** Skill/Agent/Rules/Hooks/MCP 定义 / 引擎工具的 **主面是 Engine pane**，Customizations 降为文件工具，见 [settings-two-surfaces](../../../dev/plans/settings-two-surfaces.md)。例外：Copilot provider / entitlement / setup（§5 不可复用面不变）、会话真相归属（§6 不变）、Task ↔ client-tool 双执行面 owner（后续切片）。

**明确进复用清单（人类补充 2026-08-30）：** 会话列表侧边栏（sessions viewlet / `agentSessions` 控件族）、对话列表、**权限确认弹框组件**（chat confirmation 零件：Allow/Skip 按钮、「N confirmation pending」摘要行、Input needed 徽标）。权限交互为**半自研**：座位位置与语义按 Desktop spec（权限座位在时间线内），实现零件优先复用本仓 confirmation 组件；SessionBar / Inbox / Conversation 透镜仍自研。

**Navigator stub roster（page-access 1a + M5 切片 2）：** `workbench.view.conversationSessions`（`ConversationSessionsView`）挂在 **独立** Sidebar 容器 `workbench.view.sessions`（`CONVERSATION_SESSIONS_CONTAINER_ID`，非 Explorer 内叶），与 SessionBar 共用 `IConversationRosterService`（decorator id `'conversationStubService'`）内存会话；有会话时 Body 顶展示 IDE inline 文本 filter（`Filter sessions`）按标题即时筛行。**打开行**（单击或键盘 `onDidOpen`）顺序：`switchSession(id)` → 显示 `CONVERSATION_PART` → `IConversationPartService.focus()`（经 `IWorkbenchLayoutService`，**不** import `chatShellRouting`）；stale/空元素不改变布局。**Delete session** 标题动作与 SessionBar 紧凑删除控件均调用 `deleteSession`（仅内存，无 Copilot archive/cloud），**不走** `IChatModel` / `IChatService` / `ChatEditorInput`。Activity 默认仍是 Files（Explorer）；产品 roster 是配套列表，不是中心透镜。细节见 [session-roster-reuse](../../reference/code-oss-b2/session-roster-reuse.md)。

**Navigator 产品方向（agent-ide doc，draft）：** Projects / Agents / Team 独立容器 + honest empty 与各 tab 重设计见 [navigator-tabs-access](../../reference/code-oss-b2/navigator-tabs-access.md)（draft）；Sessions 独立容器已落地。

## 3. Workbench 宿主（默认 Code 窗口）

均在 `browser/widgetHosts/`：

| 宿主 | 文件 | 落在哪 | INV-TOPO |
|------|------|--------|----------|
| **ChatViewPane** | `viewPane/chatViewPane.ts` | Sidebar / Panel 的 `ViewPane` | 不占 editor tab，但是 **侧栏插件形**（经验原则明确拒绝「Agent 当聊天插件」）。可作开发期对照，**不能**当 B2 中心透镜；Aux donor 仍注册，但默认窗口 **无** View 菜单 open command / `Ctrl+Cmd+Alt+I`（与 Open Conversation 键位不冲突） |
| **ChatEditor** | `editor/chatEditor.ts` | `EDITOR_PART` | **违反**。`ChatEditorInput` 是 `EditorInput`；打开即 editor tab |
| **Quick Chat** | `chatQuick.ts` | 浮层 | 不是主流程；**M5 切片 1**：`QuickChatGlobalAction` 全局快捷键与 `ChatTitleBarMenu` 入口 `when: IsSessionsWindowContext`（Agents Window only） |

**默认窗 Chat 路由（M5 切片 1，SSOT `contrib/chat/browser/chatShellRouting.ts`）：** `isDefaultCodeWindow` / `shouldRouteChatEditorToConversation` / `focusConversationPart` 为唯一可审计 helper；New/Open Chat Editor 族在默认窗 **无条件** 显示并聚焦 `CONVERSATION_PART`（**不再** 因 active editor 已是 `ChatEditorInput` 而放行）。`openChatSession(..., Editor)` 在默认窗 **第一句** `BugIndicatingError`（先于 URI mint / `importConversationStore.set` / `openEditor`）；Sidebar 等非 Editor 位置亦短路为 `focusConversationPart`。`ChatResolverContribution` 经 `shouldRegisterChatEditorResolver(isSessionsWindow)`：**默认窗不为任何** content-provider scheme 注册 `ChatEditorInput` resolver（含 EH 动态 scheme）；Agents Window 保留。Continue-in / Agent Host Editor 等带 payload 的 Editor 路径在注册层不可见。

`ChatEditor` 继承 `AbstractEditorWithViewState`，走 `IEditorService`。spike **S0 拒绝**的就是这条路径。源码与 `registerEditorPane(ChatEditor, ChatEditorInput)` **仍保留**（donor / EH 对照）；默认 Code 窗口里，Command Palette 主入口为 **`workbench.action.chat.open` → Open Conversation**（`New Chat Editor` / `workbench.action.openChat` 不在 F1），「Move into Editor Area」/ agentSessions「Open as Editor」/ 其余 open-chat 路径已 **藏或转** 到 `CONVERSATION_PART`，`ChatEditorInputWorkbenchSerializer` 对默认窗 `canSerialize === false`。`ChatWidget` 仍作 donor，**不是**「从注册表删除 ChatEditor」。默认窗 Command Palette 亦不再列出已重定向的 `workbench.action.openChatToSide`（New Chat Editor to the Side）、`workbench.action.newChatWindow`（New Chat Window）与 `workbench.action.chat.hideSetup`（Learn How to Hide AI Features），三者 `f1: false`。

`ChatViewPane` 还嵌 `AgentSessionsControl`、welcome、entitlement、mic/TTS——体量远超「一个列表 + Dock」。把它整块搬进新 Part 会把 Copilot 设置流一起搬进来。

**产品中心（M2 透镜 + PRD-016 session 窗口，S1–S5 已落）：** `workbench/contrib/conversation` 在 `ConversationPart` 提供 Part 级 SessionBar（SelectBox、←→、关非根）与 session 窗口网格（`IConversationSessionWindowService`，最多两叶）；每叶内 `EditorParts.createConversationEditorPart` + 默认根 `ConversationChatInput`。页 chrome 在 `ConversationEditorPane`：「对话\|轨迹」+ 阅读列 + Dock + 子代理 tab 面包屑（`ConversationAgentBreadcrumbBox`）。子代理默认 **session 叶 overlay**（`ConversationSubAgentOverlay`），最大化才延伸 tab；Fork → `CONVERSATION_GROUP` 延伸 tab。自有导航栈（S2）与 `IHistoryService` 隔离；`conversation.navigate.closeChildOnBack` 默认开。roster「打开到旁边」/ Alt+点击可并列第二 session 叶（S5），共享 End Preview。仍用 stub 时间线 / composer（`IConversationRosterService` 内存会话）；非 `ChatEditorInput` / `ChatViewPane`，不走 Copilot setup 或 `IChatModel`。SessionBar 仍含 compact New/Delete session、History stub、Inbox 单行（PRD-015 选定布局未实施）。

**Inbox 选定布局（[PRD-015](../../product/requirements.md#prd-015-conversation-空会话与输入面)，2026-09-01 签收，未实施）：** PreFirst 无 Inbox / Goal / Stop；Active 左右分簇（左 Task · MessageQueue · Goal，右 Stop · 上下文环），Task 在 MessageQueue 左侧。HEAD 仍是上一段单行 inbox-row。合同见 [conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)。

**Session 窗口 / chat tab（[PRD-016](../../product/requirements.md#prd-016-conversation-session-窗口与-chat-tab) / [ADR-002](../../../dev/decisions/002-conversation-session-windows.md)，**S1–S5 已落**）：** 中心叶仍是 `CONVERSATION_PART`。Part 自管最多两叶 session 窗口；每叶内嵌 Conversation `IEditorPart`（`CONVERSATION_GROUP` / `CONVERSATION_SIDE_GROUP`）。产品对话用 `ConversationChatInput`，**禁止** `ChatEditorInput`。文件 / Preview `SIDE_GROUP` 永远 Preview；**出站**聚合豁免（`excludeFromGlobalEditorAggregation`：chat tab 不进全局 editor 枚举 / MRU / 工作集 / `IHistoryService`）已落。Fork 默认延伸 tab；子代理 spawn 不加 tab、点击开叶内对话框、最大化才 tab；面包屑沿 stub `origin.chat` 链替换延伸 tab；窗口 chrome「关非根」不 `closeGroup` 根组。协议 `ChatOrigin` 四 kind / `ChatInteractivity`（§3.3b）呈现合同已签收，**SideChat / ReadOnly / Hidden 活数据仍等 PRD-008**；stub 期一律 `Full`。细节见 [conversation-session-windows](../../../dev/plans/conversation-session-windows.md)。

## 4. Sessions / Agents Window 宿主（更接近透镜，但不是文档壳）

| 对象 | 路径 | 说明 |
|------|------|------|
| `SessionsPart` | `src/vs/sessions/browser/parts/sessionsPart.ts` | **非 Editor** 的中心 Part；内部再 `SerializableGrid<SessionView>` |
| `SessionView` | `parts/sessionView.ts` | 一个可见 session 的槽 |
| `AbstractChatView` | `parts/chatView.ts` | Part 内叶的抽象；具体实现在 `sessions/contrib/chat/`，避免 core import contrib |
| 内部 chat 实现 | `src/vs/sessions/contrib/chat/` | 窗口特有 composer / side chat |
| 布局控制器 | `LAYOUT_CONTROLLER.md` | 按 session 恢复工作集 |
| 单 pane | `SINGLE_PANE_SCENARIOS.md` | Editor+Aux 合成侧栏；**Sessions Part 仍是主表面** |

[LAYOUT.md](../../../src/vs/sessions/LAYOUT.md) 要点（不复制全文）：

- 省略默认 **Activity Bar、Status Bar、Banner**
- 主区：`Sessions Part | Editor | Auxiliary Bar | Custom View Grid` + Panel
- **Editor 可独立于 Sessions Part 隐藏**（比默认窗口的 editor↔panel 互斥更接近 T2/T3）
- Sessions Part 的叶 **不是** workbench editor group

**对 B2 的含义：**

- 拓扑上，Agents Window **已经证明**「非 Editor 中心 Part + Editor 可藏」在本仓可行。
- 默认 Code 窗口在 **M1 亦已落地** 同构拓扑（`ConversationPart` 中心透镜 + End Editor/Sources Files + titlebar 四钮 D7）；**M5 切片 1–3** 已加固默认窗 Chat 路由与 roster 导航、清掉 workbench→sessions 的 `IAgentHostMcpServer` 依赖。**启动演示（D4）与 EH 探针（D5）仍 open** → [deferred-gaps](../../../dev/progress/deferred-gaps.md)。
- 壳合同上，它 **缺** Activity 通高与四钮，**多**了 session 多开网格 / Custom View Grid，**不能**拿来当文档壳交差（选项 C）。
- S1 主路径仍是改 **默认 Code `Layout`**，而不是把生产入口改成 Agents Window。Sessions 是 **算法与 Part 样例**，不是产品壳。

三类 provider（`agentHost` / `copilotChatSessions` / `remoteAgentHost`）是 **计算后端**，见 [SESSIONS.md](../../../src/vs/sessions/SESSIONS.md)。B2 引擎权威是 UniverseAgent；`copilotChatSessions` **不可**当默认真相。

## 5. Copilot / 账号边界（INV-NO-COPILOT）

开源树里的 chat **已经织进** GitHub Copilot 设置流，即使没装闭源扩展：

| 面 | 位置 | 改造态度 |
|----|------|----------|
| `chatSetup/` | 安装/升级 Copilot Chat、`GitHub.copilot-chat` URI | **不进复用清单** |
| `IChatEntitlementService` | `workbench/services/chat` | 账号/额度门闩；UA 不用这套 |
| `CopilotChatSettingId` / `CopilotToolId` | `common/tools/copilotToolIds.ts` | 工具过滤绑 Copilot 模型族 |
| `extensions/copilot/` | 本仓另有 copilot 扩展文档 | 闭源产品面；spike 禁止依赖 |
| Chat participant 名 `agent` | `IChatAgentService` | VS Code 的 participant，≠ UA Agent |

**可复用（需剥皮）：** Widget 渲染、list、部分 builtin tools 机制、`ILanguageModelToolsService` 的「工具注册」形状。  
**不可复用：** setup 对话框、entitlement、Copilot session provider、ChatEditor 当壳。空 Preview watermark 与 untitled 编辑器 empty hint 亦不得再作 Copilot Chat 入口（INV-NO-COPILOT chrome）。默认窗口不显示 Copilot StatusBar 条目（`chat.statusBarEntry`）、Accounts 菜单中的 Copilot Sign In（`workbench.action.chat.triggerSetupFromAccounts`，`IsSessionsWindowContext` 门闩）、Help 菜单与 Command Palette 中的 Ask @vscode（`workbench.action.askVScode`，`f1: false` + `IsSessionsWindowContext` 门闩）、Command Palette 中的 Copilot setup/upgrade/budget/settings 命令（`workbench.action.chat.triggerSetup`、`workbench.action.chat.upgradePlan`、`workbench.action.chat.manageAdditionalSpend`、`workbench.action.chat.manageSettings`、`workbench.action.chat.showExtensionsUsingCopilot`，`f1: false`；ChatTitleBarMenu 等入口保留）、Chat widget 聚焦 chrome（`workbench.action.chat.clearInputHistory`、`workbench.action.chat.focusTodosView`、`workbench.action.chat.focusQuestionCarousel`、`workbench.action.chat.previousQuestion`、`workbench.action.chat.nextQuestion`、`workbench.action.chat.focusQuestionCarouselTerminal`、`workbench.action.chat.focusTip`，`IsSessionsWindowContext` 门闩；Agents Window 保留）、Copilot prompt 工厂命令（`workbench.action.chat.generateAgentInstructions`、`workbench.action.chat.generateOnDemandInstructions`、`workbench.action.chat.generatePrompt`、`workbench.action.chat.generateSkill`、`workbench.action.chat.generateAgent`、`workbench.action.chat.generateHook`、`workbench.action.chat.insertForkConversationCommand`、`workbench.action.chat.insertTroubleshootCommand`，`f1: false`）、工具确认 chrome（`workbench.action.chat.resetTrustedTools`、`workbench.action.chat.editToolApproval`，`f1: false`）与 Chat Settings（`workbench.action.chat.openFeatureSettings`，`f1: false`；ChatWelcomeContext 等入口保留）、Command Palette 中的 Chat developer / Agent Host 诊断命令（`workbench.action.chat.logInputHistory`、`workbench.action.chat.logChatIndex`、`workbench.action.chat.inspectChatModel`、`workbench.action.chat.inspectChatModelReferences`、`workbench.action.chat.inspectAgentHostSubscriptions`、`workbench.action.chat.clearRecentlyUsedLanguageModels`、`workbench.action.chat.resetPermissionWarningDialogs`、`workbench.action.chat.openCopilotCliStateFile`、`workbench.action.chat.openAgentDebugPanel`、`workbench.action.chat.exportAgentDebugLog`、`workbench.action.chat.importAgentDebugLog`、`workbench.action.chat.exportAgentHostDebugLogs`、`workbench.action.chat.openStorageFolder`、`workbench.action.chat.debugAgentHostInDevTools`、`workbench.action.chat.restartLocalAgentHost`、`workbench.action.chat.profileAgentHost`、`workbench.action.chat.stopAgentHostProfile`、`workbench.action.chat.agentHostNetworkDiagnostics`、`workbench.action.chat.agentHost.otel.exportAgentTracesDB`、`workbench.action.chat.exportAsZip`，`IsSessionsWindowContext` 门闩；Agents Window Developer 类别保留）、Command Palette 中的 Chat management / setup / pets / import-export / language-model / speech / sessions contrib 命令（`workbench.action.chat.manage`、`workbench.action.openLanguageModelsJson`、`aiCustomization.openManagementEditor`、`aiCustomization.generateDebugReport`、`workbench.action.chat.export`、`workbench.action.chat.import`、`workbench.action.chat.manageLanguageModelAuthentication`、`chat.configureToolSets`、`workbench.action.chat.openAgentHostSettings`、`workbench.action.chat.resetGrowthSession`、`chat.pet.developer.*`、`workbench.action.chat.selectSpeechToTextMicrophone`、dictation onboarding 命令、`workbench.action.chat.openNewSessionEditor.*`、unified quick access 命令、`agentSession.exitAgentSessionProjection`，`IsSessionsWindowContext` 门闩；Agents Window 保留）、Preview 编辑器中的 Inline Chat（`inlineChat.start` / `inlineChat.askInChat`，`IsSessionsWindowContext` 门闩；Agents Window 保留）。默认 Code 窗口 Welcome / Getting Started 的 **Setup** walkthrough 不显示 Copilot 安装步骤（`CopilotSetupAnonymous` / `CopilotSetupSignedOut` / `CopilotSetupSignedIn` / `CopilotSetupComplete`，`IsSessionsWindowContext` 门闩；Agents Window 保留捐赠 walkthrough）。默认 Code 窗口 Welcome onboarding（`welcomeOnboarding` Sign-in 步与 footer 登录引导）不运行 Copilot setup（`getOnboardingStepsForWindow` + `IsSessionsWindowContext` 门闩；Agents Window 保留 Variation A 完整流程）。Titlebar 出厂不显示 Copilot Sign In（`chat.titleBar.signIn.enabled` = `false`）与 Agent Status compact 命令中心 chrome（`chat.agentsControl.enabled` = `hidden`）。

**StatusBar（默认 Code 窗口）：** `contrib/conversation` 注册右对齐 stub 芯片（无 Copilot / 无额度 / 无 Sign In）：`status.conversation.session`（`IConversationStubService` 当前会话标题，无标题 **No session**）、`status.conversation.engine`（恒 **Engine not connected**，无 command，不打开 setup）、`status.conversation.model`（**No model**，**仅当** `CONVERSATION_PART` 隐藏时注册；座位可见时整槽省略，Dock 为 model owner，UI-INV-14）。session / model 点击执行 `workbench.action.showConversationPart` → `setPartHidden(false, CONVERSATION_PART)` + `IConversationPartService.focus()`；不打开 ChatEditor 或 Aux Chat。无 session-usage / turns / tok/s 芯片（无权威则省略槽位）。

## 6. 状态机：两套「会话」不要当一个

| 名称 | Owner | B2 |
|------|-------|-----|
| `IChatModel` / `sessionResource` | `workbench/contrib/chat` | VS Code chat 持久化；**禁止**当 UA session-core |
| `ISession` / `ISessionsService` | `vs/sessions` | Agents Window 目录；provider-neutral facade |
| UniverseAgent session | 外仓 desktop-domain | **唯一权威**（父方案 §5.1） |

adapter 是唯一反腐层。M1 透镜仍用 stub 时间线（spike 允许），但知识层必须把这三套画开。

## 7. 与 Desktop Conversation 的零件对照

| Desktop（IA / spec） | 本仓最接近物 | 差距 |
|----------------------|--------------|------|
| SessionBar | `ChatViewTitleControl` / sessions `sessionHeader` | 合同不同（无 maximize 等，见 spec §6.4） |
| Timeline | `ChatWidget` 列表 + content parts | 阅读层级、权限座位、工具卡路由按 Desktop |
| Input Dock / MessageQueue | `ChatInputPart` | **例外合同**在 spec §8.3，不能用 VS Code picker 顶替 |
| 权限 CTA | 无对等（有 confirmation service） | 自研 ResponseSeat |
| Preview File tabs | `EDITOR_PART` tabs | **同构**，应保留；出厂 **`editor.inlineSuggest.enabled` = `false`**（Preview 内不自动显示 Copilot 式 ghost-text 补全；用户可在设置中开启） |
| Sources | `SOURCES_PART` + `contrib/sources` **Files \| Changes \| Review** tab strip | Files 已落；Changes / Review = SCM 资源列表 → Preview（`SourcesChangesList` / `SourcesReviewList`）；Diff 深查看（ADR-051 / ADR-047 FORK）仍 **EDITOR_PART**，未接线 |

## 8. 相关文档

- [Chat 概览](overview.md) · [Parts/Grid](../workbench/parts-and-grid.md) · [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)
- [会话列表复用](../../reference/code-oss-b2/session-roster-reuse.md) · [透镜组装](../../reference/code-oss-b2/conversation-lens-assembly.md) · [Settings 接入](../../reference/code-oss-b2/settings-ua-access.md) · [Navigator tab](../../reference/code-oss-b2/navigator-tabs-access.md)（draft）
- 空会话 / 输入面选定（未实施）：[conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)（PRD-015）
- [Sessions 概览](../sessions/overview.md)
