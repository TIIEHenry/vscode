---
title: "工具与编辑会话"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-31
summary: "ILanguageModelToolsService / confirmation / builtin tool sets；IChatEditingSession accept/reject/snapshot；映射 Desktop Changes/Diff/File 配套面；标出 CopilotToolId 与 INV-NO-COPILOT"
---

# 工具与编辑会话

> 导航：[Chat 索引](INDEX.md)。协作总览：[overview](overview.md)。宿主与 Copilot 边界：[agent-ui](agent-ui.md)。  
> B2：工具 **机制**可当 donor；会话真相 **不是** `IChatModel`。编辑 UI 是配套面，**不是** Conversation 中心。  
> **0×** 依赖 GitHub Copilot（INV-NO-COPILOT）。`CopilotToolId` 是本仓已织进的耦合，不是产品默认。

本页回答：改造时 **哪段是可评估的工具登记/调用形状、哪段是工作区改动评审机、它们落到 Desktop 的哪块配套面**。不要把工具卡或 `ChatEditingSession` 当成对话中心透镜。

## 1. 两套机制，都不是 Conversation

```text
ILanguageModelToolsService          IChatEditingService / IChatEditingSession
  登记 IToolData / IToolImpl           按 chat 会话创建或续上编辑会话
  beginToolCall → invokeTool           accept / reject / snapshot / streaming
  confirmation（风险门闩）               MultiDiff + 文件 entry 装饰
        │                                        │
        ▼                                        ▼
  工具调用进度（可进时间线卡片）          Desktop 配套：Changes / Diff / File
        │                                        │
        └──────── 都不是 Conversation 中心 ───────┘
```

`IChatModel.editingSession` 把 VS Code 对话回合与工作区改动绑在一起。这是 **本仓 chat 真相**，不是 UniverseAgent session-core。B2 若暂时显示工具卡或改动列表，必须经 adapter；禁止把 `IChatModel` 提成权威。

Desktop 合同：窗口壳 = Singularity/IDEA；Conversation 内 = 时间线 + Input Dock；引擎真相 = UniverseAgent。工具调用与工作区评审属于 **配套面**（Changes / Diff / File），与 [agent-ui](agent-ui.md) 把 `browser/chatEditing/` 标成「配套面，不是 Conversation 中心」一致。

## 2. `ILanguageModelToolsService`

契约：`src/vs/workbench/contrib/chat/common/tools/languageModelToolsService.ts`。  
浏览器实现：`src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts`。

| 符号 | 职责 |
|------|------|
| `IToolData` | 元数据：`id`、`source`、`when`、`models`、`inputSchema`、`canRequestPreApproval` / `canRequestPostApproval` |
| `IToolImpl` | 实际 `invoke` |
| `ToolDataSource` | `internal` / `extension` / `mcp` / `user` / `external` |
| `toolMatchesModel` | 无 `models` 则全模型可用；有则 OR 匹配 vendor/family/version/id |
| `registerTool` / `registerToolData` / `registerToolImplementation` | 登记；扩展经 contribution，不经过 sessions 层 |
| `getTools(model)` / `observeTools(model)` | 按 `when` 与模型选择器过滤后的启用集 |
| `beginToolCall` | 流式阶段创建 `IChatToolInvocation` 并挂到 chat |
| `updateToolStream` | 未完成调用的部分输入 |
| `invokeTool` | 真正执行；`cancelToolCallsForRequest` 按 request 取消 |

调用链是 **`beginToolCall` →（可选 `updateToolStream`）→ `invokeTool`**。`IToolInvocation.context.sessionResource` 是 VS Code chat 会话 URI；Agents Window 还可带 `workingDirectory`。

四个内置 `ToolSet`（服务只读字段，实现里 `createToolSet(..., deprecated: true)`）：

| 字段 | id / 参考名 | 意图 |
|------|-------------|------|
| `vscodeToolSet` | `vscode` | VS Code 功能（如 `AskQuestionsTool` 加入此集） |
| `executeToolSet` | `execute` | 本机执行（终端等往这里挂） |
| `readToolSet` | `read` | 读工作区 |
| `agentToolSet` | `agent` | 委派其他 agent（`RunSubagentTool` 加入此集） |

`toolSets` 是可观察全集；`getToolSetsForModel` 再按模型过滤。用户/MCP 还可 `createToolSet`。集合本身是 **分组与 picker 形状**，不是会话状态机。

## 3. Confirmation

`ILanguageModelToolsConfirmationService`（`common/tools/languageModelToolsConfirmationService.ts`）在工具执行前后做风险门闩，**不是** Desktop 权限 CTA / ResponseSeat。

- `IToolData.canRequestPreApproval` / `canRequestPostApproval` 声明工具会不会要确认
- `ILanguageModelToolConfirmationRef`：`toolId` + `source` + `parameters` + 可选 `chatSessionResource` / `workingDirectory` / combination key
- `computeCombinationKey`：SHA-256，避免把原始参数写入存储
- contribution：`registerConfirmationContribution(toolName, …)` 给单工具更细的 pre/post 动作
- 记忆范围：`session` / `workspace` / `profile`；`manageConfirmationPreferences` 打开 QuickTree
- `IToolInvocation.preApproved`：调用方（如 Agent Host）已带 `ConfirmedReason` 时跳过 `WaitingForConfirmation`

自动批准设置来自 `platform/chat` 的 `ChatEditAutoApproveSettingId`，与 confirmation service 并列，不要当成 UA 权限模型。

内置确认相关实现还在 `builtinTools/`：`confirmationTool.ts`、`chatExternalPathConfirmation.ts`、`chatUrlFetchingConfirmation.ts`。这些是 VS Code 确认对话框，B2 权限座位要自研。

## 4. 内置工具（`builtinTools/`）

登记入口：`common/tools/builtinTools/tools.ts` 的 `BuiltinToolsContribution`（`chat.builtinTools`）。向 `ILanguageModelToolsService.registerTool` 挂实现，部分再 `addTool` 进上述 tool set。

本目录现有实现（知识层清单，不以文件夹地图替代 [chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)）：

| 文件 | 角色 |
|------|------|
| `editFileTool.ts` | 写文件；驱动编辑会话 |
| `runSubagentTool.ts` | 子 agent；进 `agentToolSet` |
| `manageTodoListTool.ts` | todo 列表 |
| `askQuestionsTool.ts` | 提问；进 `vscodeToolSet` |
| `confirmationTool.ts` | 通用 / 带选项 / 已改文件确认 |
| `reviewPlanTool.ts` | 计划评审 |
| `taskCompleteTool.ts` | 任务完成标记 |
| `setArtifactsTool.ts` / `setArtifactRulesTool.ts` | artifacts（受 `ChatConfiguration.ArtifactsEnabled` 开关） |
| `chatExternalPathConfirmation.ts` / `chatUrlFetchingConfirmation.ts` | 路径/URL 确认辅助 |
| `resolveDebugEventDetailsTool.ts` | 调试事件细节 |

`electron-browser/builtInTools/` 另有桌面侧内置（含读文件等）。扩展工具经 `languageModelToolsContribution`，不复制到 sessions。

**B2 donor 边界：** 值得评估的是 **登记 + `beginToolCall`/`invokeTool` + confirmation 钩子** 这套机制。具体 `IToolImpl`、Copilot 名工具、VS Code picker 分组 **不要**整块搬进产品对话面。

## 5. `CopilotToolId` 耦合（INV-NO-COPILOT）

开源树已经把部分工具过滤绑到 Copilot 模型族，即使没装闭源扩展：

| 符号 | 位置 | 事实 |
|------|------|------|
| `CopilotToolId.ReadFile` | `common/tools/copilotToolIds.ts` | 字面量 `'copilot_readFile'` |
| `CopilotChatSettingId.Gpt55ReadFileToolEnabled` | 同上 | `github.copilot.chat.gpt55ReadFileTool.enabled` |
| `isToolEnabledForModel` | `browser/tools/languageModelToolsService.ts` | `id === CopilotToolId.ReadFile` 且 `model.family` 以 `gpt-5.5` 开头时，读上述 setting；`false` 则从 `getTools` **和** `readToolSet` 成员里拿掉 |

`extensions/copilot` 有同名 `ReadFile = 'copilot_readFile'`。测试与 terminal 侧也用该 id 当「其他工具」开关。这是 **产品面耦合**，不是中立工具登记。

INV-NO-COPILOT：B2 **不得**把 `CopilotToolId` / `CopilotChatSettingId` / entitlement / `chatSetup/` 当默认工具策略。默认 Code 窗口 Command Palette 亦不列出 Copilot prompt / skill / hook / plugin 工厂与管理命令（`IsSessionsWindowContext` 门闩；Agents Window 保留）。剥皮后留下的是 `ILanguageModelToolsService` 的注册形状；过滤规则与工具 id 要换 UA / 本产品自己的。

## 6. `IChatEditingSession`：accept / reject / snapshot

契约：`src/vs/workbench/contrib/chat/common/editing/chatEditingService.ts`。  
实现：`src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingSession.ts` 的 `ChatEditingSession`。

`IChatEditingService` 按 `ChatModel` / `sessionResource` 创建、续上、转移会话；也可 `registerEditingSessionProvider(scheme, …)` 换实现。`editingSessionsObs` 暴露可评审会话给编辑器级 UI。

INV-NO-COPILOT：默认 Code 窗口 Command Palette 亦不列出 chat editing 相关命令（`IsSessionsWindowContext` 门闩；Agents Window 保留）；`run` 与菜单注册保留。

分层：

| 接口 | 最小面 |
|------|--------|
| `IChatEditReviewSession` | `entries`、`accept(...uris)`、`reject(...uris)`；编辑器装饰 / keep-undo 依赖这一层 |
| `IChatEditingSession` | 再加上 snapshot、streaming、workspace edit、multi-diff、`stop` |

`accept` / `reject`（无 URI = 当前 Modified 全集）：只处理 `ModifiedFileEntryState.Modified` 且不在 streaming 中的 entry。状态枚举：`Modified` / `Accepted` / `Rejected`。单文件还有 hunk 级 `IModifiedFileEntryChangeHunk.accept/reject`。

Snapshot（实现里 checkpoint timeline，不是 `IChatModel` 的对话 checkpoint）：

| 方法 | 含义 |
|------|------|
| `createSnapshot(requestId, undoStop)` | 在 timeline 打 checkpoint |
| `restoreSnapshot(requestId, stopId)` | 导航到该 checkpoint |
| `getSnapshotUri` / `getSnapshotContents` / `getSnapshotModel` | 某请求、某 undo stop **之后**的文件像 |
| `getEntryDiffBetweenStops` / `getEntryDiffBetweenRequests` | 停点之间 / 请求之间的 diff |
| `getDiffsForFilesInSession` / `getDiffsForFilesInRequest` | 会话或单请求的文件 diff 列表 |

流式：`startStreamingEdits` → `IStreamingEdits`；整树操作：`applyWorkspaceEdit`。磁盘上改、不经 chat 流的 agent 走 `startExternalEdits` / `stopExternalEdits`。状态机：`Initial` → `StreamingEdits` → `Idle` → `Disposed`。

持久化：`ChatEditingSessionStorage`。`show()` 用 `CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME` 打开 `MultiDiffEditorInput`（文案 “Suggested Edits”），走 `IEditorService`，即 **Editor/Diff 配套**，不是侧栏对话。

`IChatModel.editingSession` 可选挂上本对象。B2：**可以**借用 accept/reject/snapshot/diff 的评审机形状；**不可以**把挂载点 `IChatModel` 当成 session 真相。

## 7. 映射 Desktop 配套面（Changes / Diff / File）

配套面在 Conversation **之外**（Workbench End / Preview / Sources / 底 Panel）。不要把改动列表或 multi-diff 塞进时间线当中心透镜。壳投影见 [desktop-shell-mapping](../../reference/code-oss-b2/desktop-shell-mapping.md)。

| Desktop 配套 | 本仓最接近物 | 落点 | 改造含义 |
|--------------|--------------|------|----------|
| **Changes** | `IChatEditingSession.entries`、`WorkingSetDisplayMetadata`、`getDiffsForFilesInSession` | End 下格 `SOURCES_PART`：**Files** 列表已落（`contrib/sources`）；**Changes** tab 仍不在 End（ADR-051 / M2 未做） | 文件级 accept/reject 的名单；**不是** Timeline。产品 Changes 应对 End Sources，而不是 ChatWidget 列表 |
| **Diff** | `ChatEditingSession.show()` → `MultiDiffEditor`；`IEditSessionEntryDiff`；`IModifiedFileEntry.diffInfo`；editor hunk 装饰 | `EDITOR_PART` 的 multi-diff / `IDiffEditor`；深查看也可落 `PANEL_PART`（ADR-047） | 同构应保留：原生 diff 控件。打开路径不要绑成 Conversation tab |
| **File** | 被改 `URI` + `EDITOR_PART` tabs；`IModifiedFileEntry.getEditorIntegration` | Preview File tabs（与 Desktop Preview **同构**） | 打开/保存/tab 仍走 `IEditorService`。编辑会话只提供 snapshot URI 与 keep/undo |

`browser/chatEditing/` 其余零件（overlay、explanation widget、notebook 集成、`ChatEditingTextModelContentProvider`）都服务这三块配套，不服务 Conversation 中心。

**禁止的偷换：** 把 `ChatEditingSession.show()` 的 Suggested Edits 编辑器当 Conversation；把 `entries` 画进时间线当主阅读面；把 confirmation 当 Desktop 权限座位。

## 8. B2 结论

| 面 | 态度 |
|----|------|
| `ILanguageModelToolsService` 登记 / `beginToolCall` / `invokeTool` / tool set 分组 | **机制可 donor**；接线 UA 后过滤与 id 要换 |
| `ILanguageModelToolsConfirmationService` | 钩子形状可参考；UI 与记忆模型不替代产品权限 CTA |
| `builtinTools/` 实现 | 逐个评估；`editFile` 等写路径要接到 UA，而不是 `IChatModel` |
| `CopilotToolId` / `CopilotChatSettingId` / `gpt-5.5` 特例 | **INV-NO-COPILOT**：不进复用清单 |
| `IChatEditingSession` accept/reject/snapshot/diff | 评审机可 inform Changes / Diff / File |
| `IChatModel` / `sessionResource` / `editingSession` 挂载 | **禁止**当 UA session-core（与 [agent-ui](agent-ui.md) §6 同一条） |

adapter 是唯一反腐层。工具进度可以出现在时间线卡片上，但 **会话身份、回合真相、权限决策** 不在本页这些服务里。

## 9. 相关文档

- [Chat 概览](overview.md) · [Agent UI 清单](agent-ui.md) · [Chat 系统索引](INDEX.md)
- [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) · [Parts/Grid](../workbench/parts-and-grid.md)
- 文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)
