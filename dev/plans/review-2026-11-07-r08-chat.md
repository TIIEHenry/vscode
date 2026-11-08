---
title: "十六路审查 2026-11-07 r08：contrib/chat 发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "看了 10-30 之后的 chat 提交、默认窗口在用的 AI 自定义编辑器与对话复用件，并抽查会话持久化、改名、队列、工具确认、编辑收尾与模型选择，3 条。"
---

# 十六路审查 2026-11-07 r08：contrib/chat 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次范围内没有未提交改动。先逐个看了 2026-10-30 之后进入 `contrib/chat` 的提交：11-03 的五个「生命周期、DOM 清理、错误处理去重」提交（外加一个合并）和 11-04、11-05 的样式提交。随后按产品可达性筛代码：默认编辑器窗口里 Chat 视图带 `IsSessionsWindowContext`（`chatParticipant.contribution.ts` 59–60 行），打开会话在默认窗口直接改去聚焦 Conversation 部件（`agentSessionsOpener.ts` 188–192 行），默认窗口真正在跑的 chat 代码主要是 AI 自定义管理编辑器，以及对话时间线复用的 `chatDiffBlockPart`、`chatForkActions`。因此重点读了 `aiCustomizationManagementEditor.ts` 的内嵌编辑、返回列表和保存路径，又抽查了会话保存与恢复、会话改名、请求队列出队、工具确认、编辑会话接受与拒绝、模型选择。共 3 条：前两条在默认窗口可触发，第三条在本产品只有 Agents 窗口能走到。`parseUnifiedDiff` 会把 `---`、`+++` 文件头当成正文，但对话时间线没有传 `diffEditorPool`，只显示 `<pre>` 原文，chat 侧又只在工具确认消息里启用这种 diff 块，影响太窄，未列入。

### r08-1

- 严重度：高
- 症状：在 AI 自定义管理编辑器里改过一个工作区或用户自定义文件（agent、skill、instructions、hooks）并点「Back to list」之后，这个文件的文本模型一直保持未保存状态，不再随磁盘重新加载。之后磁盘上的文件被别处改过（agent 改写、git 切换分支、外部编辑器），再打开同一项看到的是旧内容；不做任何修改直接返回，旧内容就无提示地覆盖磁盘上的新内容。编辑期间磁盘被改，返回时同样直接覆盖，没有普通保存时的冲突提示。
- 代码：`src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts` 3122–3148（内嵌编辑器直接编辑这个文件的文本文件模型）；3170–3229（`goBackToList`，3189 行释放引用）；3284–3299；3317–3322。

```3143:3148:src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts
			this._editorContentChanged = this.workingCopyService.isDirty(uri);
			this.editorModelChangeDisposables.add(ref.object.textEditorModel.onDidChangeContent(() => {
				this._editorContentChanged = true;
				this.scheduleCurrentEditorPreviewRender();
				this.resetEditorSaveIndicator();
			}));
```

```3284:3299:src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts
	private createExistingCustomizationSaveRequest(): IExistingCustomizationSaveRequest | undefined {
		if (!this._editorContentChanged || this.currentEditingSource === AICustomizationSources.builtin || !this.currentEditingUri) {
			return undefined;
		}

		const model = this.currentModelRef?.object.textEditorModel;
		if (!model) {
			return undefined;
		}

		return {
			fileUri: this.currentEditingUri,
			content: model.getValue(),
			projectRoot: this.currentEditingProjectRoot,
		};
	}
```

```3317:3322:src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts
	private async saveExistingCustomization(request: IExistingCustomizationSaveRequest): Promise<void> {
		await this.fileService.writeFile(request.fileUri, VSBuffer.fromString(request.content));
		if (request.projectRoot) {
			await this.workspaceService.commitFiles(request.projectRoot, [request.fileUri]);
		}
	}
```

- 为什么是问题：内嵌编辑器用 `textModelService.createModelReference(uri)` 拿到的是这个文件的文本文件模型（3122、3130 行），用户的输入直接让它变脏。返回列表时，`createExistingCustomizationSaveRequest` 取出模型内容，`saveExistingCustomization` 用不带 mtime 和 etag 的 `fileService.writeFile` 写盘，绕过了文本文件模型自己的保存。模型不知道内容已经落盘，仍是脏的，保存基线也还是打开时的磁盘状态。`goBackToList` 随后在 3189 行释放引用，但文本文件模型管理器不销毁脏模型（`src/vs/workbench/services/textfile/common/textFileEditorModelManager.ts` 613–620 行），也从不按磁盘变化重新加载脏模型（同文件 122–125 行），这份旧内容于是一直留在内存里。桌面默认 `files.autoSave` 为 off，没有别的路径替它保存。再次打开同一项时拿到的是同一个脏模型，3143 行把 `_editorContentChanged` 直接设成 `isDirty(uri)`，即 true；用户只看不改就返回，3285 行的条件成立，3318 行把旧内容整份写回磁盘。这次写盘不做冲突检查，期间磁盘上的较新内容就此丢失。编辑过程中磁盘被改的情况也一样：模型脏着不重新加载，返回时直接覆盖。
- 方向：后台保存改为调用文本文件模型自己的保存，让写盘带上冲突检查并清掉脏状态。

### r08-2

- 严重度：中
- 症状：AI 自定义管理编辑器在返回列表时后台写文件，写失败时用户看不到任何提示；界面已经回到列表，用户会以为改动已保存。对内置提示词或技能点「Save override」并选好 Workspace 或 User 之后，若写入失败，这次修改直接丢失，再次打开看到的是内置原文。
- 代码：`src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts` 3185–3187（返回列表时销毁内置项的内存编辑模型）；3225–3228；3391–3399；对照 3445–3481 的 `handleBuiltinSave`。

```3185:3187:src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts
		if (fileUri && this.currentEditingSource === AICustomizationSources.builtin) {
			this.disposeBuiltinEditingSession(fileUri);
		}
```

```3225:3228:src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts
		if (backgroundSaveRequest) {
			const saveRequest = backgroundSaveRequest;
			void this.saveExistingCustomization(saveRequest).catch(onUnexpectedError);
		}
```

```3391:3399:src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts
			this.goBackToList();
			if (backgroundSaveRequest) {
				const saveRequest = backgroundSaveRequest;
				void this.saveBuiltinPromptCopy(saveRequest).then(() => {
					if (!this._store.isDisposed) {
						void this.listWidget?.refresh();
					}
				}).catch(onUnexpectedError);
			}
```

- 为什么是问题：提交 `c69a54d3d67`（2026-09-17，登记为 `dev/progress/deferred-gaps.md` 的 D582）把这两处原来的 `notificationService.warn`（「Could not save changes to {0}.」和「Could not save the override to …」）换成了 `onUnexpectedError`，11-03 的去重之后只剩一层。工作台的未预期错误处理器只写日志（`src/vs/workbench/browser/workbench.ts` 113–129 行），不给用户提示。内置项的路径会丢内容：`handleEditorActionButton` 先由 `createBuiltinPromptSaveRequest` 把内容抄进请求对象，再调用 `goBackToList`，后者在 3185–3187 行销毁内置项唯一的内存编辑模型，之后才异步执行 `saveBuiltinPromptCopy`。写入失败时，修改只存在于这个请求对象里，被 `catch` 之后就没了。同一件事走 `handleBuiltinSave`（编辑器保存命令）时会等写入结果，失败时提示并保留编辑态，两条路径不一致。D582 把这次改动当作 leftover Promise 收口，没有把「保存失败不再提示」登记成缺陷。工作区和用户文件这条路径在默认窗口始终可达；内置项只有内置 chat 扩展贡献了技能或提示词时才会出现（`src/vs/workbench/contrib/chat/browser/aiCustomization/promptsServiceCustomizationItemProvider.ts` 281–286 行）。
- 方向：后台写失败时恢复用户可见的提示；内置项等写入成功后再销毁编辑会话，失败时留在编辑态。

### r08-3

- 严重度：低
- 症状：在会话列表里给一个当前没有加载的本地 chat 会话改名，列表先显示新名字；打开这个会话后标题变回原来的名字，下一次保存之后列表也回到旧名字，改名丢失。
- 代码：`src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsActions.ts` 779–792；`src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts` 435–448、648–678、2557–2558；`src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts` 510–517、762–766、877–878；`src/vs/workbench/contrib/chat/common/model/chatModel.ts` 2816。

```435:448:src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts
	async setChatSessionTitle(sessionResource: URI, title: string): Promise<void> {
		const model = this._sessionModels.get(sessionResource);
		if (model) {
			model.setCustomTitle(title);
		}

		// Update the title in the file storage
		const localSessionId = LocalChatSessionUri.parseLocalSessionId(sessionResource);
		if (localSessionId) {
			await this._chatSessionStore.setSessionTitle(localSessionId, title);
			// Trigger immediate save to ensure consistency
			this.saveState();
		}
	}
```

```510:517:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
	public async setSessionTitle(sessionId: string, title: string): Promise<void> {
		await this.storeQueue.queue(async () => {
			const index = this.internalGetIndex();
			if (index.entries[sessionId]) {
				index.entries[sessionId].title = title;
			}
		});
	}
```

```877:878:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
function getSessionMetadataSync(session: ChatModel): IChatSessionEntryMetadata {
	const title = session.customTitle || session.title;
```

- 为什么是问题：本地会话从列表改名走 `renameSession` 的 local 分支，调用 `setChatSessionTitle`。会话没加载时 `_sessionModels.get` 返回空，只有 `setSessionTitle` 改了内存索引里的标题，再由 `saveState` 把索引写进存储；会话文件里的 `customTitle` 没有动。之后打开会话，`acquireOrRestoreLocalSession` 只读会话文件，不合并索引里的标题，`ChatModel` 构造时 `_customTitle` 取文件里的旧值（`chatModel.ts` 2816 行）。打开后的列表项改由 `chatModelToChatDetail` 生成，显示模型标题；下一次 `saveState`（`updateAndFlushIndexSync`，762–766 行）或模型释放时写会话，`getSessionMetadataSync` 用 `session.customTitle || session.title` 重算标题，把索引里的新名字覆盖掉。在本产品里，这个会话列表只在 Chat 视图里创建（`src/vs/workbench/contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts` 968 行），而 Chat 视图只在 Agents 窗口出现，默认编辑器窗口走不到，所以按边界情况记为低。
- 方向：未加载的本地会话改名时，把新标题同时写进会话文件，或在恢复会话时用索引里的标题补上 `customTitle`。

## 打开过的文件

范围内：

- `src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts`
- `src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.contribution.ts`
- `src/vs/workbench/contrib/chat/browser/aiCustomization/customizationMigration.ts`
- `src/vs/workbench/contrib/chat/browser/aiCustomization/promptsServiceCustomizationItemProvider.ts`
- `src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsActions.ts`
- `src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsOpener.ts`
- `src/vs/workbench/contrib/chat/browser/agentSessions/localAgentSessionsController.ts`
- `src/vs/workbench/contrib/chat/browser/actions/chatActions.ts`
- `src/vs/workbench/contrib/chat/browser/actions/chatForkActions.ts`
- `src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingSession.ts`
- `src/vs/workbench/contrib/chat/browser/chatEditing/shareChatEditingDiff.ts`
- `src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts`
- `src/vs/workbench/contrib/chat/browser/chatShellRouting.ts`
- `src/vs/workbench/contrib/chat/browser/tools/languageModelToolsConfirmationService.ts`
- `src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatDiffBlockPart.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatMarkdownContentPart.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatAgentFeedbackReviewConfirmationSubPart.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatToolConfirmationSubPart.ts`
- `src/vs/workbench/contrib/chat/browser/widget/input/workspacePickerItems.ts`
- `src/vs/workbench/contrib/chat/common/chatSelectedModel.ts`
- `src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts`
- `src/vs/workbench/contrib/chat/common/model/chatModel.ts`
- `src/vs/workbench/contrib/chat/common/model/chatProgressTypes/chatToolInvocation.ts`
- `src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts`
- `src/vs/workbench/contrib/chat/common/modelSelection.ts`
- `src/vs/workbench/contrib/chat/common/promptSyntax/utils/promptFilesLocator.ts`
- 2026-10-30 之后提交的 diff（只看 diff）：`chatInputPart.ts`、`chatInputNotificationWidget.ts`、`modePickerActionItem.ts`、`modelPickerWidget.ts`、`permissionPickerActionItem.ts`、`agentHostInputCompletions.ts`、`chatInputEditorContrib.ts`、`chatPasteProviders.ts`、`chatExtensionsContentPart.ts`、`chatTipContentPart.ts`、`chatTreeContentPart.ts`、`abstractToolConfirmationSubPart.ts`、`chatTerminalToolProgressPart.ts`、`chatRequestOriginPart.ts`、`chatFindWidget.ts`、`embeddedAgentPluginDetail.ts`、`pluginListWidget.ts`、`mcpListWidget.ts`、`embeddedMcpServerDetail.ts`、`galleryItemRenderer.ts`、`agentGlobalConfigurationSettingsWidget.ts`、`aiCustomizationListWidget.ts`、`toolsListWidget.ts`

块外，只读核对接口：

- `src/vs/workbench/services/textfile/common/textFileEditorModel.ts`
- `src/vs/workbench/services/textfile/common/textFileEditorModelManager.ts`
- `src/vs/workbench/services/textmodelResolver/common/textModelResolverService.ts`
- `src/vs/platform/files/common/fileService.ts`
- `src/vs/workbench/browser/workbench.ts`
- `src/vs/workbench/common/contextkeys.ts`
- `src/vs/workbench/contrib/files/browser/files.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationForkActions.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTimelineHost.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensReadingColumn.ts`
