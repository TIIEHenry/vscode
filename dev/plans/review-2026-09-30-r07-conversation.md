---
title: "审查 r07：conversation"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "会话草稿、导航揭示、MCP 启动与授权、来源文件树有五处会丢内容或卡住。"
---

# 发现

## r07-1 高
- 症状：发送尚未返回时继续打字，或先切到别的会话，成功之后刚写下的未发送文字会从输入框和草稿里消失。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts` 第 351–363 行
- 引用：
```351:363:src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts
			const stillOnSubmitSession = host.getBoundSessionId() === sessionId;
			if (!outcome.accepted) {
				if (stillOnSubmitSession) {
					host.showPostFailure(outcome.reason);
				}
				return;
			}
			writeComposerDraft(host, sessionId, '');
			if (stillOnSubmitSession) {
				host.dockTextarea.value = '';
				host.resetInputHistoryBrowse();
				host.updateConversationPhase();
			}
```
- 为什么是问题：`submitDraft` 在 `await postBound` 之前只记下当时的 `text`，期间输入框仍可编辑，`conversationLensDock.ts` 的 `input` 监听会把新内容写入草稿。返回且 `accepted` 后，这里无条件 `writeComposerDraft(sessionId, '')`，同一会话上还会把 `dockTextarea.value` 清掉。切走会话时 `setBoundSessionId` 刚把文本框存进原会话，成功回调仍按原 `sessionId` 把草稿写成空字符串。慢响应时后写的句子无法恢复。
- 方向：仅当草稿仍等于本次已提交文本时才清空。

## r07-2 中
- 症状：子代理标签已经打开、当前却停在根会话或非工具标签时，在导航里点该代理没有任何跳转，也没有错误提示。
- 位置：`src/vs/workbench/contrib/navigator/browser/navigatorReveal.ts` 第 46–49 行
- 引用：
```46:49:src/vs/workbench/contrib/navigator/browser/navigatorReveal.ts
		const existing = sessionChatService.findOpenTabForChat(sessionKey, agentId);
		if (existing) {
			await sessionChatService.navigateAgentBreadcrumb(sessionKey, agentId);
			return;
```
- 为什么是问题：`findOpenTabForChat` 已经找到标签，这里却只调用 `navigateAgentBreadcrumb` 然后返回，不会走到下面的 `openSubAgent`。`conversationSessionChatService.ts` 第 173–175 行在活动编辑器不是 `ConversationChatInput`，或 `isDefaultRoot` 时直接 `return`；第 180–181 行在来源不是 `tool` 时也 `return`。根会话上点击已打开的子代理因此停在原地。`openSubAgent` 对已有标签会 `openEditor`。
- 方向：已有标签时直接打开该编辑器。

## r07-3 中
- 症状：MCP 服务器启动进入错误状态后，开始操作一直不结束，同一服务器之后的再次启动排在队列里不再执行。
- 位置：`src/vs/workbench/contrib/mcp/common/mcpServer.ts` 第 890–904 行
- 引用：
```890:904:src/vs/workbench/contrib/mcp/common/mcpServer.ts
			if (state.state === McpConnectionState.Kind.Error) {
				let disposable: IDisposable;
				state = await new Promise<McpConnectionState>((resolve, reject) => {
					disposable = autorun(reader => {
						const cnx = this._connection.read(reader);
						const state = cnx?.state.read(reader);
						if (cnx && state?.state === McpConnectionState.Kind.Error) {
							if (!this._isQuietStart) {
								this.showInteractiveError(cnx, state, this._lastModeDebugged);
							} else {
								reject(new UserInteractionRequiredError('start'));
							}
						}
					});
				}).finally(() => disposable.dispose());
			}
```
- 为什么是问题：`connection.start()` 在连接变为 `Error` 时会返回该状态。非安静启动只调用 `showInteractiveError`，没有 `resolve`；状态离开 Error 时同样没有 `resolve`。这个 `await` 停在 `_connectionSequencer` 里。`StartServerAction.run` 在 `await server.start` 之后才 `showOutput`，所以按钮一直转、输出不打开。`stop()` 不走这条队列，但下一次 `start()` 要等前一个任务结束，失败后的重试不会再真正启动。
- 方向：展示错误后 resolve 当前错误状态，让启动队列继续。

## r07-4 中
- 症状：MCP 要求打开 URL 做授权时，会话模型还没有请求，或调用已被取消，授权既不出现在通知里，等待也不会结束。
- 位置：`src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts` 第 166–205 行
- 引用：
```166:205:src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts
		const value = await new Promise<MCP.ElicitResult>(resolve => {
			const chatModel = context?.chatSessionResource && this._chatService.getSession(context.chatSessionResource);
			if (chatModel instanceof ChatModel) {
				const request = chatModel.getRequests().at(-1);
				if (request) {
					const part = new ChatElicitationRequestPart(
						localize('mcp.elicit.url.title', 'Authorization Required'),
						new MarkdownString().appendText(elicitation.message)
							.appendMarkdown('\n\n' + localize('mcp.elicit.url.instruction', 'Open this URL?'))
							.appendCodeblock('', elicitation.url),
						localize('msg.subtitle', "{0} (MCP Server)", server.definition.label),
						localize('mcp.elicit.url.open', 'Open {0}', URI.parse(elicitation.url).authority),
						localize('mcp.elicit.reject', 'Cancel'),
						async () => {
							const result = await this._doElicitUrl(elicitation, token);
							resolve(result);
							completePromise.then(() => part.hide());
							return result.action === 'accept' ? ElicitationState.Accepted : ElicitationState.Rejected;
						},
						() => {
							resolve({ action: 'decline' });
							return Promise.resolve(ElicitationState.Rejected);
						},
						mcpServerToSourceData(server),
					);
					chatModel.acceptResponseProgress(request, part);
				}
			} else {
				const handle = this._notificationService.notify({
					message: elicitation.message + ' ' + localize('mcp.elicit.url.instruction2', 'This will open {0}', elicitation.url),
					source: localize('mcp.elicit.source', 'MCP Server ({0})', server.definition.label),
					severity: Severity.Info,
					actions: {
						primary: [store.add(new Action('mcp.elicit.url.open2', localize('mcp.elicit.url.open2', 'Open URL'), undefined, true, () => resolve(this._doElicitUrl(elicitation, token))))],
						secondary: [store.add(new Action('mcp.elicit.cancel', localize('mcp.elicit.cancel', 'Cancel'), undefined, true, () => resolve({ action: 'decline' })))],
					}
				});
				store.add(handle.onDidClose(() => resolve({ action: 'cancel' })));
				store.add(token.onCancellationRequested(() => resolve({ action: 'cancel' })));
			}
		}).finally(() => store.dispose());
```
- 为什么是问题：`chatModel instanceof ChatModel` 且 `getRequests().at(-1)` 为空时，既不 `resolve`，也不进入下面的通知。表单授权在同一情况下会落到通知。已有请求时，取消令牌只在 `else` 里把结果收成 `cancel`；聊天卡片这条路径不听 `token`。工具调用停在 `elicit()` 上，用户看不到可操作的授权，或取消后仍要等卡片被点。
- 方向：没有请求时走通知；聊天路径在取消时结束等待。

## r07-5 中
- 症状：多根工作区里有一个文件夹搜索失败时，来源文件树只剩下成功的根，失败的根整夹消失，状态栏也不报错。
- 位置：`src/vs/workbench/contrib/sources/common/sourcesFilesModel.ts` 第 78–108 行
- 引用：
```78:108:src/vs/workbench/contrib/sources/common/sourcesFilesModel.ts
	for (let index = 0; index < settled.length; index++) {
		const result = settled[index];
		if (result.status === 'rejected') {
			failures.push(result.reason);
			continue;
		}
		if (result.value.limitHit) {
			limitHit = true;
		}
		const folder = folders[index];
		for (const match of result.value.results) {
			entries.push({
				resource: match.resource,
				name: basename(match.resource),
				description: relativePath(folder, match.resource) ?? basename(match.resource),
			});
		}
	}

	if (failures.length === folders.length) {
		const first = failures[0];
		throw first instanceof Error ? first : new Error(String(first));
	}

	entries.sort((a, b) => compareFileNamesDefault(a.description, b.description) || compareFileNamesDefault(a.name, b.name));
	let truncated = limitHit;
	if (entries.length > maxResults) {
		entries.length = maxResults;
		truncated = true;
	}
	return { entries, limitHit, truncated };
```
- 为什么是问题：只有全部文件夹都 `rejected` 才抛错。部分失败被 `continue` 掉，返回值里没有失败信息。`sourcesFilesList.ts` 的 `refresh` 只在抛错时保留 `lastGoodEntries` 并显示读失败；否则用这次的 `entries` 覆盖上次完整结果。失败根里上次还能看到的文件会从列表消失，截断提示也不会出现。
- 方向：部分根失败时保留失败标记，不要把缺根的结果当成完整列表。
