---
title: "十六路审查 2026-11-07 r15：extensions/copilot 发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "抽查 extensions/copilot 的编辑类工具、BYOK 密钥迁移、会话元数据写入和笔记本运行工具，并复核 10-25 落地修复的新代码，证实 4 条：中 2、低 2。"
---

# 十六路审查 2026-11-07 r15：extensions/copilot 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

范围内 2026-10-30 之后没有新提交，也没有未提交改动，所以这次按工具调用与确认、文件写入、凭据、会话持久化、取消几个方向，抽查以往各稿没有覆盖的代码：替换字符串类编辑工具及其确认、`EditFileTool`、`toolUtils.ts` 的外部文件确认、装扩展与建目录工具、记忆工具的路径校验、笔记本编辑与运行工具、BYOK 的密钥存储与迁移、本地语言模型代理服务和进程内 MCP 服务的鉴权、Copilot CLI 锁文件、会话检查点与归档清理、令牌刷新、会话上云前的脱敏过滤。同时复核了 10-25 两个提交落地修复引入的新代码（补丁工具按请求隔离上下文、gitfile 与 commondir 解析、元数据临时文件写入、JSONL 刷盘）。共 4 条：中 2 条，低 2 条。

### r15-1

- 严重度：中
- 症状：`replace_string_in_file` 或 `multi_replace_string_in_file` 以相同的 `filePath`、`oldString`、`newString` 再调用一次时，工具不重新读文件，直接把上一次按旧正文算出的编辑再发一遍，并报告成功。第一次已经生效的文件会被改坏：把 `foo()` 改成 `foo(bar)` 的那次编辑重放后，文件里变成 `foo(barbar)`；删除类编辑重放会把后面无关的字符多删掉。上一次在确认框里被用户拒绝、之后文件又被改过时，再次确认看到的也是旧正文上的 diff，批准后落下的仍是旧偏移上的编辑。
- 代码：`extensions/copilot/src/extension/tools/node/abstractReplaceStringTool.tsx` 第 69–70 行、第 102–113 行；`extensions/copilot/src/extension/tools/node/replaceStringTool.tsx` 第 77–80 行；`extensions/copilot/src/extension/tools/node/editFileToolUtils.tsx` 第 285–290 行；`extensions/copilot/src/extension/tools/vscode-node/toolsService.ts` 第 97 行。

```69:70:extensions/copilot/src/extension/tools/node/abstractReplaceStringTool.tsx
	// Cache for ReplaceStringsOperation instances
	private lastOperation?: { inputKey: string; operation: Promise<IPrepareEdit[]> } | undefined;
```

```102:113:extensions/copilot/src/extension/tools/node/abstractReplaceStringTool.tsx
	protected prepareEdits(options: vscode.LanguageModelToolInvocationOptions<T> | vscode.LanguageModelToolInvocationPrepareOptions<T>, token: vscode.CancellationToken): Promise<IPrepareEdit[]> {
		const input = this.extractReplaceInputs(options.input);
		const cacheKey = JSON.stringify(input);
		if (this.lastOperation?.inputKey !== cacheKey) {
			this.lastOperation = {
				inputKey: cacheKey,
				operation: this._prepareEdits(options, input, token)
			};
		}

		return this.lastOperation.operation;
	}
```

```285:290:extensions/copilot/src/extension/tools/node/editFileToolUtils.tsx
	const identical = getIdenticalChars(oldStr, newStr);
	const editPosition = matchPositions.map(idx => ({
		start: idx + identical.leading,
		end: idx + oldStr.length - identical.trailing,
		text: newStr.slice(identical.leading, newStr.length - identical.trailing)
	}));
```

- 为什么是问题：缓存键只有 `extractReplaceInputs` 取出的路径和新旧字符串（不含 `explanation`），既不含文档版本，也不含请求 id，并且从不失效。`ToolsService` 只为每个工具建一个实例（`toolsService.ts` 第 97 行），`ToolsContribution` 把这个实例注册给 `vscode.lm.registerTool`（`tools.ts` 第 32–34 行），所以这份缓存跨回合、跨会话一直存活。设计本意是让 `prepareInvocation` 经 `generateConfirmationDetails` 算好的结果在随后的 `invoke`（`replaceStringTool.tsx` 第 78 行）里复用；但以后任何一次同样输入的调用也命中同一个 Promise，`_prepareEditsForFile` 里的允许列表检查、`openDocumentAndSnapshot` 取本轮快照、`applyEdit` 重新读文件全部被跳过。缓存里的编辑是按当时正文算出的偏移区间，而且已经裁掉了新旧串的公共前后缀（`editFileToolUtils.tsx` 第 285–290 行），`applyAllEdits` 把它们原样交给 `responseStream.textEdit`。以 `oldString: "foo()"`、`newString: "foo(bar)"` 为例，编辑内容是在第 4 个字符后插入 `bar`；第一次生效后文件里已经是 `foo(bar)`，同样的输入第二次调用时在同一位置再插一次。不走缓存时，这第二次调用会因找不到 `foo()` 报错，模型能知道修改已经生效。确认路径同理：编辑 `.vscode/*.json` 这类总要确认的文件时，用户第一次拒绝、随后手改文件、再让模型重试，确认框里的 diff 取自缓存里的旧 `document` 与 `updated`，批准后落下的编辑也按旧正文定位。补丁工具在 `dev/plans/review-2026-10-24-r15-copilot.md` 的 r15-3 之后已改成按请求 id 存放预备结果并在用完后删除，这两个替换工具没有跟着改，不是同一处缺陷。
- 方向：预备结果只在同一次调用的确认与执行之间复用，键里带上请求 id，`invoke` 用完即删；命中时还要确认目标文档自那以后没有变化。

### r15-2

- 严重度：中
- 症状：旧版本存进扩展 secret 的 BYOK API key（Anthropic、OpenAI、xAI、OpenRouter 等按 `copilot-byok-<名称>-api-key` 存放的 key），在扩展激活时会被迁移到核心的模型分组。迁移只要失败（启动时离线、提供方接口暂时不可用、key 暂时被拒），这把 key 已经从 secret 里删掉，核心分组里也没有写进去，用户只能重新找回并输入；扩展宿主还会多出一条未处理的 Promise 拒绝。
- 代码：`extensions/copilot/src/extension/byok/vscode-node/abstractLanguageModelChatProvider.ts` 第 36–38 行、第 47–59 行、第 165–168 行；`extensions/copilot/src/extension/byok/vscode-node/anthropicProvider.ts` 第 89–92 行；对照 `extensions/copilot/src/extension/byok/vscode-node/ollamaProvider.ts` 第 71–78 行、`extensions/copilot/src/extension/byok/vscode-node/customOAIProvider.ts` 第 108–114 行。

```47:59:extensions/copilot/src/extension/byok/vscode-node/abstractLanguageModelChatProvider.ts
	// TODO: Remove this after 6 months
	protected async configureDefaultGroupWithApiKeyOnly(): Promise<string | undefined> {
		const apiKey = await this._byokStorageService.getAPIKey(this._name);
		if (apiKey) {
			this.configureDefaultGroupIfExists(this._name, { apiKey } as C);
			await this._byokStorageService.deleteAPIKey(this._name, BYOKAuthType.GlobalApiKey);
		}
		return apiKey;
	}

	protected async configureDefaultGroupIfExists(name: string, configuration: C): Promise<void> {
		await commands.executeCommand('lm.migrateLanguageModelsProviderGroup', { vendor: this._id, name, ...configuration });
	}
```

- 为什么是问题：构造函数第 37 行不等待就调用 `configureDefaultGroupWithApiKeyOnly`。第 51 行发出迁移命令却不 `await`，第 52 行紧接着删掉 secret。核心的 `migrateLanguageModelsProviderGroup`（`src/vs/workbench/contrib/chat/common/languageModels.ts` 第 2284–2299 行，块外只读核对）先回调提供方的 `provideLanguageModelChatInfo({ silent: false, configuration })` 拉模型列表，成功后才调用 `addLanguageModelsProviderGroup` 写入分组。拉列表失败时，Anthropic（`anthropicProvider.ts` 第 89–92 行）和走 `getModelsFromEndpoint` 的 OpenAI、xAI、OpenRouter（本文件第 165–168 行）都会抛错，命令随之拒绝，分组不会写入。此时 key 已删，下一次激活读不到它，迁移也就没有重试的机会。同目录另外两处迁移的写法正好相反：`ollamaProvider.ts` 第 76–77 行先 `await` 迁移再清旧设置，`customOAIProvider.ts` 第 110–113 行逐个 `await` 成功后才记完成，并且不删 key。BYOK 在没有 GitHub 登录时也会注册（`byokProvider.ts` 第 222–225 行），这段迁移每次激活都会跑。本仓现在没有生产代码再写这个 secret（`handleAPIKeyUpdate`、`saveModelConfig` 都没有生产调用方），所以只影响旧版本留下的 key，这也是没有定为高的原因。
- 方向：等迁移命令成功之后再删除 secret；失败时保留 key，下次激活再试。

### r15-3

- 严重度：低
- 症状：单会话元数据文件 `vscode.metadata.json` 已损坏、而该会话又不在批量索引缓存里时，任何一次经 `updateMetadataFields` 的写入（设标题、写首条消息、归档、写 worktree 信息等）都会把损坏文件整份换成只含本次字段的新对象。原文件里的 worktree 路径和检查点引用从此无法再找回。
- 代码：`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts` 第 234–248 行、第 578–590 行、第 614–615 行；触发入口 `extensions/copilot/src/extension/chatSessions/vscode-node/copilotCLIChatSessionsContribution.ts` 第 744 行，`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/customSessionTitleServiceImpl.ts` 第 32–54 行。

```234:248:extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts
	private async updateMetadataFields(sessionId: string, fields: Partial<ChatSessionMetadataFile>): Promise<void> {
		if (isUntitledSessionId(sessionId)) {
			return;
		}
		await this._ready;
		// Optimistically update in-memory cache so callers in the same process observe
		// the change immediately. We pass only the partial `fields` to
		// `updateSessionMetadata` — that method reads fresh from disk and merges, so it
		// cannot stomp fields written by other processes (Step 3b: stale-cache fix).
		const existing = this._cache[sessionId] ?? {};
		this._cache[sessionId] = { ...existing, ...fields };
		this._updateFolderIndex(sessionId, this._cache[sessionId]);
		await this.updateSessionMetadata(sessionId, fields);
		this.updateGlobalStorage();
	}
```

```578:590:extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts
			if (corrupt) {
				// A session already in `_cache` (bulk file) can repair the per-session
				// file. Otherwise leave the bytes alone so worktree checkpoints survive.
				const cached = this._cache[sessionId];
				if (!cached || !Object.keys(cached).some(key => key !== 'writtenToDisc')) {
					this.logService.error(`[ChatSessionMetadataStore] Not overwriting corrupt metadata for ${sessionId}`);
					return;
				}
				const rest: ChatSessionMetadataFile = { ...cached };
				delete rest.writtenToDisc;
				existing = rest;
				diskFileExisted = true;
			}
```

- 为什么是问题：旧稿 `dev/plans/review-2026-10-11-r14-copilot-extension.md` 的 r14-2 已记过「损坏的元数据文件被覆盖」。方案 `dev/plans/review-2026-10-11-r14-copilot-extension-plan.md` 的不变量是能读到字节但解析失败时不得用空对象盖掉原文件，只有会话已经因批量文件在 `_cache` 里时才允许用缓存修复；落地表写的是 `281589a56b1` 已修。活码的读路径确实修好了：损坏时 `readSessionMetadataFile` 返回 `null`，`getSessionMetadata` 不再写 `origin: 'other'` 存根。写路径的拒写分支（第 582–585 行）却只在 `_cache[sessionId]` 为空或只有 `writtenToDisc` 时生效，而所有公开写入方法都经 `updateMetadataFields`，它在调用 `updateSessionMetadata` 之前先把本次字段放进 `_cache`（第 243–244 行）。于是第 582 行总能看到本次字段，从不拒写；第 586–589 行把这份只含本次字段的缓存当作修复来源，第 615 行用它替换掉损坏文件。第 579–580 行注释说的「否则保留字节」对这些调用方走不到，写路径仍是修复前的行为。触发面窄：这样的会话在列表里会因 `getSessionOrigin` 读不到元数据而被当成外部会话隐藏，主要在直接打开会话时触发。例如 V1 的 `provideChatSessionContentForExistingSession`（`copilotCLIChatSessionsContribution.ts` 第 744 行）调用 `getCustomSessionTitle`，元数据读不到、而全局存储里还留着旧版标题时，会经 `setCustomTitle` 写入并覆盖。会话不在缓存里，来自批量索引只保留 1000 条（第 691 行），或者 `dev/plans/review-2026-10-30-r15-copilot.md` 的 r15-1（仍未实施）把批量文件写成 `{}`。现有用例 `should leave corrupt per-session metadata bytes unchanged` 只走 `getWorktreeProperties`，`should repair corrupt per-session metadata from cache when the session is updated` 的会话预先放在批量文件里，都没有覆盖这条路径。
- 方向：拒写判断要看本次写入之前缓存里是否已有批量文件给出的记录，不能看 `updateMetadataFields` 刚放进去的字段；不满足时保持损坏文件不变，并让调用方知道这次没有写入。

### r15-4

- 严重度：低
- 症状：笔记本「运行单元格」工具在用户确认之后遇到的任何异常（确认框挂起期间笔记本被关掉或该单元格被删、选内核或执行命令抛错、渲染输出出错）都被吞掉。模型收到的是 `The user cancelled the tool call.`，整轮 agent 请求按用户取消结束，真实错误不出现在回复里。
- 代码：`extensions/copilot/src/extension/tools/node/runNotebookCellTool.tsx` 第 197–201 行、第 102 行、第 229–244 行；`extensions/copilot/src/extension/prompts/node/panel/toolCalling.tsx` 第 665–667 行；`extensions/copilot/src/extension/intents/node/toolCallingLoop.ts` 第 2380–2382 行。

```197:201:extensions/copilot/src/extension/tools/node/runNotebookCellTool.tsx
		} catch (error) {
			telemetryEvent.failed(error.message || 'exceptionThrown');
		} finally {
			await telemetryEvent.send(this.telemetryService);
		}
```

```2380:2382:extensions/copilot/src/extension/intents/node/toolCallingLoop.ts
		if (buildPromptResult.metadata.getAll(ToolResultMetadata).some(r => r.isCancelled)) {
			throw new CancellationError();
		}
```

- 为什么是问题：`invoke` 的 `catch` 只记遥测，既不返回结果也不重抛，函数以 `undefined` 结束。扩展宿主收到空结果时直接抛 `CancellationError`（`src/vs/workbench/api/common/extHostLanguageModelTools.ts` 第 236–239 行，块外只读核对）。`toolCallErrorToResult` 把取消错误写成 `The user cancelled the tool call.` 并标记 `isCancelled`，回合循环看到任一 `isCancelled` 就抛 `CancellationError`，结束整轮。`invoke` 里确定会抛错的一步是第 102 行再次调用的 `getNotebookAndCell`：`prepareInvocation` 时笔记本和单元格都在，用户在确认框挂起期间关闭笔记本或删掉这个单元格后点「允许」，第 236 行或第 241 行抛出的明确错误（原本会提示模型重新读取笔记本）被吞掉，用户看到的是一次自己没有做过的取消。`ensureKernelSelected`、`runCells` 转发的命令或输出渲染一旦拒绝，结局相同。同目录的 `editNotebookTool.tsx` 在 `catch` 里记完遥测后会 `throw error`（第 282–289 行），错误能作为工具错误交回模型。
- 方向：`catch` 记完遥测后对非取消错误重抛，或返回带错误文本的结果；只有真正的取消才走取消。

## 打开过的文件

- `extensions/copilot/src/extension/tools/node/abstractReplaceStringTool.tsx`
- `extensions/copilot/src/extension/tools/node/replaceStringTool.tsx`
- `extensions/copilot/src/extension/tools/node/multiReplaceStringTool.tsx`
- `extensions/copilot/src/extension/tools/node/editFileToolUtils.tsx`
- `extensions/copilot/src/extension/tools/node/insertEditTool.tsx`
- `extensions/copilot/src/extension/tools/node/toolUtils.ts`
- `extensions/copilot/src/extension/tools/node/installExtensionTool.tsx`
- `extensions/copilot/src/extension/tools/node/createDirectoryTool.tsx`
- `extensions/copilot/src/extension/tools/node/manageTodoListTool.tsx`
- `extensions/copilot/src/extension/tools/node/viewImageTool.tsx`
- `extensions/copilot/src/extension/tools/node/skillTool.ts`
- `extensions/copilot/src/extension/tools/node/memoryTool.tsx`
- `extensions/copilot/src/extension/tools/node/runNotebookCellTool.tsx`
- `extensions/copilot/src/extension/tools/node/editNotebookTool.tsx`
- `extensions/copilot/src/extension/tools/node/applyPatchTool.tsx`
- `extensions/copilot/src/extension/tools/vscode-node/toolsService.ts`
- `extensions/copilot/src/extension/tools/vscode-node/tools.ts`
- `extensions/copilot/src/extension/tools/test/node/replaceString/replaceStringTool.spec.tsx`
- `extensions/copilot/src/extension/tools/node/test/multiReplaceStringTool.spec.tsx`
- `extensions/copilot/src/extension/prompts/node/panel/toolCalling.tsx`
- `extensions/copilot/src/extension/intents/node/toolCallingLoop.ts`
- `extensions/copilot/src/extension/inlineChat2/node/inlineChatIntent.ts`
- `extensions/copilot/src/extension/prompt/node/chatParticipantRequestHandler.ts`
- `extensions/copilot/src/extension/prompt/common/conversation.ts`
- `extensions/copilot/src/extension/conversation/vscode-node/chatParticipants.ts`
- `extensions/copilot/src/extension/byok/vscode-node/byokStorageService.ts`
- `extensions/copilot/src/extension/byok/common/byokProvider.ts`
- `extensions/copilot/src/extension/byok/vscode-node/abstractLanguageModelChatProvider.ts`
- `extensions/copilot/src/extension/byok/vscode-node/byokContribution.ts`
- `extensions/copilot/src/extension/byok/vscode-node/anthropicProvider.ts`
- `extensions/copilot/src/extension/byok/vscode-node/customOAIProvider.ts`
- `extensions/copilot/src/extension/byok/vscode-node/customEndpointProvider.ts`
- `extensions/copilot/src/extension/byok/vscode-node/ollamaProvider.ts`
- `extensions/copilot/src/extension/chronicle/common/secretFilter.ts`
- `extensions/copilot/src/extension/externalAgents/node/oaiLanguageModelServer.ts`
- `extensions/copilot/src/extension/agents/node/langModelServer.ts`
- `extensions/copilot/src/extension/agents/vscode-node/cachedAgentFileWriter.ts`
- `extensions/copilot/src/extension/agents/vscode-node/githubOrgChatResourcesService.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/lockFile.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/inProcHttpServer.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/test/chatSessionMetadataStoreImpl.spec.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/customSessionTitleServiceImpl.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/node/copilotcliSessionService.ts`
- `extensions/copilot/src/extension/chatSessions/vscode-node/chatSessionWorktreeCheckpointServiceImpl.ts`
- `extensions/copilot/src/extension/chatSessions/vscode-node/sessionRequestLifecycle.ts`
- `extensions/copilot/src/extension/chatSessions/vscode-node/chatSessionWorktreeServiceImpl.ts`
- `extensions/copilot/src/extension/chatSessions/vscode-node/copilotCLIChatSessions.ts`
- `extensions/copilot/src/extension/chatSessions/vscode-node/copilotCLIChatSessionsContribution.ts`
- `extensions/copilot/src/extension/onboardDebug/vscode/launchConfigService.ts`
- `extensions/copilot/src/platform/authentication/common/authentication.ts`
- `extensions/copilot/src/platform/authentication/vscode-node/copilotTokenManager.ts`
- `extensions/copilot/src/platform/git/vscode-node/gitServiceImpl.ts`
- `extensions/copilot/src/platform/notebook/vscode/notebookServiceImpl.ts`
- `extensions/copilot/src/platform/notebook/common/helpers.ts`
- 块外，仅为核对接口只读打开：`src/vs/workbench/contrib/chat/common/languageModels.ts`、`src/vs/workbench/contrib/chat/browser/actions/chatLanguageModelActions.ts`、`src/vs/workbench/api/common/extHostLanguageModelTools.ts`、`src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts`、`src/vs/workbench/contrib/notebook/browser/controller/executeActions.ts`、`extensions/git/src/repository.ts`、`extensions/git/src/git.ts`
