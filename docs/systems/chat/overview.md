---
title: "Chat 系统概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-31
summary: "ChatWidget、IChatService/IChatModel、工具、ChatEditingSession、participants 的跨层协作"
---

# Chat 系统概览

> 导航见 [系统索引](INDEX.md)。`browser/` / `common/` 文件夹地图以 [chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md) 为 **SSOT**，下文只写协作，不复述目录清单。

chat 是 **workbench contrib 虚拟模块**（`src/vs/workbench/contrib/chat/`），不是 `src/vs/` 独立层。Workbench 通过 `workbench.common.main.ts` 拉入 `chat.shared.contribution.ts` 等；Sessions 窗口同样导入该 shared contribution，再叠加 `src/vs/sessions/contrib/chat/`。

```text
sessions（Agents Window）
    消费 IChatService / IChatWidgetService
    窗口特有 contrib：src/vs/sessions/contrib/chat/
        │
        ▼
workbench/contrib/chat          ← 虚拟模块本体
    browser/  ChatWidget、widgetHosts、ChatEditingSession
    common/   IChatService、model、participants、tools、editing
        │
        ▼
workbench/services/chat         IChatEntitlementService
platform/chat                   设置与 AI_AGENT 约定
```

## ChatWidget 与宿主

`IChatWidget` / `IChatWidgetService` 定义在 `browser/chat.ts`。`ChatWidget`（`browser/widget/chatWidget.ts`）实现对话列表、输入、agent/model 选择器；`chatCodeOrganization.md` 要求 `widget/` 内核心零件必须被 `ChatWidget` 直接引用。

响应块渲染在 `browser/widget/chatContentParts/`（markdown、代码块、工具输出等）。`widgetHosts/` 把同一 Widget 嵌进：

| 宿主 | 位置 |
|------|------|
| 侧栏视图 | `ChatViewPane` |
| 编辑器页 | `ChatEditor` / `ChatEditorInput` |
| Quick Chat | `chatQuick` |

`IChatWidgetService` 按 `sessionResource` 查找 Widget，并跟踪焦点会话。发送走 `acceptInput` → `IChatService.sendRequest`。

## 模型与服务

`common/chatService/` 的 `IChatService` / `ChatService` 拥有活动会话：`startNewLocalSession`、`acquireOrLoadSession`、`sendRequest`、取消/重发。会话身份是 `URI`（`sessionResource`），不是旧的字符串 `sessionId`。

`common/model/`：

- `IChatModel`：请求/响应、checkpoint、可选 `editingSession`、序列化
- `ChatViewModel`：给 Widget 的展示模型
- `chatSessionStore` / `chatModelStore`：持久化

`IChatSessionsService`（`common/chatSessionsService.ts`）登记会话类型与外部 provider，供列表与跨窗口加载。Workbench 与 Sessions 都经过这组接口，而不是复制一份模型。

## Participants（代码里的 agents）

`common/participants/` 管理 chat participant。代码符号用 **agent**（`IChatAgentService`、`IChatAgentData`、`ChatAgentService`），产品语义仍是 participant。

`IChatAgentService` 负责注册元数据与 `IChatAgentImplementation`、解析默认 agent、`invokeAgent`。扩展与 core 都可贡献；动态远程 participant 标 `isDynamic`。Slash command 在同目录的 `IChatSlashCommandService`。

`ChatService.sendRequest` 解析输入（`requestParser`）后调用选中的 agent，再把 `IChatProgress` 写回 `IChatModel`。

## 工具

`common/tools/languageModelToolsService.ts` 的 `ILanguageModelToolsService` 登记 `IToolData` / `IToolImpl`，按 `when` 与模型选择器过滤，并驱动 `beginToolCall` → `invokeTool`。内置集合包括 `vscodeToolSet`、`executeToolSet`、`readToolSet`、`agentToolSet`。

`common/tools/builtinTools/` 提供部分内置实现（如 `editFileTool`、`runSubagentTool`、`manageTodoListTool`）。确认与风险另有 `ILanguageModelToolsConfirmationService`。扩展工具经 contribution 注册，不经过 sessions 层。

## 编辑会话

契约在 `common/editing/chatEditingService.ts`：`IChatEditingService` 按 chat 会话创建或续上 `IChatEditingSession`（accept/reject、snapshot、streaming edits、workspace edit）。

浏览器实现是 `browser/chatEditing/chatEditingSession.ts` 的 `ChatEditingSession`，含 diff UI、checkpoint timeline、`ChatEditingSessionStorage`。`IChatModel.editingSession` 把对话回合与工作区改动绑在一起。自动批准模式来自 `platform/chat` 的 `ChatEditAutoApproveSettingId`。

## 与 Sessions、Workbench、Platform

- **Workbench**：本 contrib 的分层归属，见 [workbench 模块](../../modules/workbench/INDEX.md)。`workbench/services/chat` 只做 entitlement，不持有 `IChatModel`。
- **Platform**：[`platform` 模块](../../modules/platform/INDEX.md) 的 `src/vs/platform/chat/` 只有设置与约定（`chatSettings.ts`、`aiAgentEnv.ts`、`sessionArchiveActions.ts`），供 contrib 与 entitlement 共用。
- **Sessions**：Agents Window 高于 workbench，复用同一套 `IChatService` / Widget，并在 `src/vs/sessions/contrib/chat/` 做窗口宿主（新会话 composer、side chat、voice bridge 等）。**不要**在本树复制 sessions 正文；分层与会话域契约见 [Sessions 系统](../sessions/INDEX.md) 及其就近 SSOT（`src/vs/sessions/LAYERS.md`、`SESSIONS.md`）。

## INV-NO-COPILOT：默认窗口 Command Palette

默认 Code 窗口 Command Palette 不列出 Copilot Chat 宿主遗留的 Move / Voice 命令（`IsSessionsWindowContext` 门闩；Agents Window 保留）：`workbench.action.chat.openInNewWindow`、`workbench.action.chat.openInSidebar`、`workbench.action.chat.voiceChatInChatView`、`workbench.action.chat.inlineVoiceChat`、`workbench.action.chat.quickVoiceChat`（`workbench.action.chat.openInEditor` 已为 `f1: false`）。

默认 Code 窗口 Command Palette 亦不列出 Copilot **New Chat / Quick Chat / Execute** 捐赠命令（`IsSessionsWindowContext` 门闩；Agents Window 保留）：`workbench.action.chat.newChat`、`workbench.action.openQuickChat`、`workbench.action.chat.undoEdit`、`workbench.action.chat.redoEdit`、`workbench.action.chat.redoEdit2`、`workbench.action.chat.toggleAgentMode`、`workbench.action.chat.switchToNextModel`、`workbench.action.chat.switchToNextPinnedModel`（`workbench.action.quickchat.toggle` 已为 `f1: false`；Cancel / Send 等 Execute 菜单命令已为 `f1: false`）。产品入口为 Open Conversation（`workbench.action.chat.open`）。

默认 Code 窗口编辑器右键与子系统 **Generate Code / Tips / Voice simulate / Agent Plugins refresh** 等 Chat 输入 chrome 亦经 `IsSessionsWindowContext` 门闩隐藏（Agents Window 保留）。

默认 Code 窗口 Notebook 单元格 **Generate / Start Chat** 插入 chrome（`notebook.cell.chat.start` 等）与 **Add Cell Output to Chat**（`notebook.cellOutput.addToChat`）、内核变量 Chat 命令（`notebook.chat.selectAndInsertKernelVariable`）亦经 `IsSessionsWindowContext` 门闩隐藏；显式开启 `notebook.experimental.cellChat` / `notebook.experimental.generate` 时 Agents Window 保留前者。

默认 Code 窗口 **Terminal Inline Chat**（`workbench.action.terminal.chat.start` 等）、**SCM Generate Commit Message / Resolve Conflicts with AI / Graph Add to Chat** 与 **Inline Chat Fix diagnostics** marker hover 亦经 `IsSessionsWindowContext` 门闩隐藏（Agents Window 保留）。

默认 Code 窗口 Command Palette 与编辑器右键亦不列出 Chat setup 命令（`workbench.action.chat.triggerSetup`、`workbench.action.chat.triggerSetupForceSignIn`、`workbench.action.chat.triggerSetupAnonymousWithoutDialog` 等，`f1: false` + `IsSessionsWindowContext` 门闩；Agents Window 保留）。默认 Code 窗口 Agent Host SDK 的 GitHub 登录（`AgentSdkSetupService.signInToGitHub` → `workbench.action.chat.triggerSetup`）亦经 `IsSessionsWindowContext` 门闩跳过（Agents Window 保留）。

默认 Code 窗口不显示 Copilot 额度 / 限速输入通知、匿名限速响应块与 Status Dashboard 的 **Use AI Features** setup 区（`shouldShowCopilotQuotaChrome`；Agents Window 保留）。

默认 Code 窗口亦不执行 Chat setup runner 的 **Use AI Features** 对话框与 `DefaultSetup` 策略（`shouldRunChatSetupRunner` / `IsSessionsWindowContext`；Agents Window 保留）。

默认 Code 窗口亦不注册 Copilot growth session、「Try again」setup 失败对话框、Copilot 扩展 deep-link setup、Chat 标题栏 Upgrade/Budget 菜单，以及 Status Dashboard 的 Copilot 额度区（`shouldShowCopilotQuotaChrome` / `shouldRunChatSetupRunner`；Agents Window 保留）。

## 相关文档

- [Chat 系统索引](INDEX.md) · [chat 模块索引](../../modules/chat/INDEX.md)
- 文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)
