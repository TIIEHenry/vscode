---
title: "十六路审查 r10：chat 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样 contrib/chat 的会话发送、工具确认、历史持久化与取消，证实 5 条。"
---
# 十六路审查 r10：chat 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`src/vs/workbench/contrib/chat` 的会话保存、转移会话读取、历史索引、编辑工具收尾、未发送队列反序列化。只记录这次读到的活码。

### r10-1

- 严重度：高
- 症状：关窗口时，正在写入的会话文件可能没被关机流程等完，最新对话落不到磁盘。
- 代码：

```87:96:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
		this._register(this.lifecycleService.onWillShutdown(e => {
			this.shuttingDown = true;
			if (!this.storeTask) {
				return;
			}

			e.join(this.storeTask, {
```

```191:204:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
		try {
			this.storeTask = this.storeQueue.queue(async () => {
				try {
					await Promise.all(sessions.map(session => this.writeSession(session)));
					await this.trimEntries();
					await this.flushIndex();
				} catch (e) {
					this.reportError('storeSessions', 'Error storing chat sessions', e);
				}
			});
			await this.storeTask;
		} finally {
			this.storeTask = undefined;
		}
```

```387:389:src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts
		// Kick off async file writes for session data.
		this._chatSessionStore.storeSessions(liveLocalChats);
		this._chatSessionStore.storeSessionsMetadataOnly(liveNonLocalChats);
```

`storeSessionsMetadataOnly`（同文件 213–224 行）同样在 `finally` 里无条件把 `storeTask` 置空。模型释放时也会 `await this._chatSessionStore.storeSessions([model])`（`chatServiceImpl.ts` 294 行）。

- 为什么是问题：关机只 join 字段里当前这一份 Promise。保存状态会连续排队「全文」和「仅元数据」两次，释放会话又会再排队一次。先结束的那次在 `finally` 里清掉字段，即便清掉的不是自己刚完成的那份。字段被清掉之后，`onWillShutdown` 看到空就直接返回，队列里还在写的会话文件不再阻塞退出。
- 方向：关机等待的句柄只由仍在排队的那次保存释放。

### r10-2

- 严重度：高
- 症状：历史索引里只要有一条会话缺字段，这次启动的历史列表会空掉；下一次保存把这个空索引写回去之后，其余会话从历史里消失。
- 代码：

```559:572:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
		try {
			const index = JSON.parse(data) as unknown;
			if (isChatSessionIndex(index)) {
				// Success
				this.indexCache = index;
			} else {
				this.reportError('invalidIndexFormat', `Invalid index format: ${data}`);
				this.indexCache = { version: 1, entries: {} };
			}

		} catch (e) {
			// Only if JSON.parse fails
			this.reportError('invalidIndexJSON', `Index corrupt: ${data}`, e);
			this.indexCache = { version: 1, entries: {} };
		}
```

```830:837:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
function isChatSessionEntryMetadata(obj: unknown): obj is IChatSessionEntryMetadata {
	return (
		!!obj &&
		typeof obj === 'object' &&
		typeof (obj as IChatSessionEntryMetadata).sessionId === 'string' &&
		typeof (obj as IChatSessionEntryMetadata).title === 'string' &&
		typeof (obj as IChatSessionEntryMetadata).lastMessageDate === 'number'
	);
}
```

```863:866:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
	for (const key in index.entries) {
		if (!isChatSessionEntryMetadata(index.entries[key])) {
			return false;
		}
	}
```

```762:772:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
	updateAndFlushIndexSync(localSessions: ChatModel[], externalSessions: ChatModel[]): void {
		const index = this.internalGetIndex();
		for (const session of localSessions) {
			index.entries[session.sessionId] = getSessionMetadataSync(session);
		}
		for (const session of externalSessions) {
			const externalSessionId = session.sessionResource.toString();
			index.entries[externalSessionId] = getSessionMetadataSync(session);
		}
		try {
			this.storageService.store(ChatIndexStorageKey, index, this.getIndexStorageScope(), StorageTarget.MACHINE);
```

- 为什么是问题：校验是整表失败。一条缺 `title` 或 `lastMessageDate` 的记录让 `isChatSessionIndex` 返回 false，内存索引被换成空表。后面的 timing 回填只跑在这张空表上。`saveState` 再调用 `updateAndFlushIndexSync` 时，写回去的只有当前还活着的会话，原先只在索引里的会话不再可发现。
- 方向：坏条目单独丢掉，保留其余索引项。

### r10-3

- 严重度：高
- 症状：工作区之间转移过来的会话，读失败一次之后源文件和转移索引都被删掉，无法再导入。
- 代码：

```314:318:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
			const sessionData = await this.readSessionFromLocation(storageLocation, undefined, sessionId);

			// Clean up the transferred session after reading
			await this.cleanupTransferredSession(sessionResource);
```

```326:339:src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts
	private async cleanupTransferredSession(sessionResource: URI): Promise<void> {
		try {
			// Remove from index
			const index = this.getTransferredSessionIndex();
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length === 1) {
				const workspaceKey = workspaceFolders[0].uri.toString();
				delete index[workspaceKey];
				this.storageService.store(ChatTransferIndexStorageKey, index, StorageScope.PROFILE, StorageTarget.MACHINE);
			}

			// Delete the transferred session file
			const storageLocation = this.getTransferredSessionStorageLocation(sessionResource);
			await this.fileService.del(storageLocation);
```

`readFlatSessionBuffer`（677–686 行）在读文件失败时捕获异常并返回 `undefined`，不向外抛。`reviveStoredSession`（711–713 行）解析失败同样返回 `undefined`。因此 `readTransferredSession` 的 `try` 不会因为「没读到内容」而跳过 cleanup。

- 为什么是问题：cleanup 不看 `sessionData` 是否真有内容。临时读失败或解析失败都会先删掉转移索引，再删文件。调用方 `acquireOrRestoreLocalSession`（`chatServiceImpl.ts` 658–667 行）拿到 `undefined` 就放弃，这份对话没有第二份副本。
- 方向：只有读到可用内容并交给正式会话之后再删转移副本。

### r10-4

- 严重度：中
- 症状：编辑文件的工具在等「正在修改」结束时不响应取消；等完后仍向模型报告编辑成功。若对应文件条目一直不出现，这次调用不返回。
- 代码：

```122:153:src/vs/workbench/contrib/chat/common/tools/builtinTools/editFileTool.ts
		if (token.isCancellationRequested) {
			throw new CancellationError();
		}
		if (result === undefined || !hasEdit) {
			throw new Error('The file edit did not produce any changes');
		}

		let dispose: IDisposable;
		await new Promise((resolve) => {
			// The file will not be modified until the first edits start streaming in,
			// so wait until we see that it _was_ modified before waiting for it to be done.
			let wasFileBeingModified = false;

			dispose = autorun((r) => {

				const entries = editSession.entries.read(r);
				const currentFile = entries?.find((e) => isEqual(e.modifiedURI, uri));
				if (currentFile) {
					if (currentFile.isCurrentlyBeingModifiedBy.read(r)) {
						wasFileBeingModified = true;
					} else if (wasFileBeingModified) {
						resolve(true);
					}
				}
			});
		}).finally(() => {
			dispose.dispose();
		});

		return {
			content: [{ kind: 'text', value: 'The file was edited successfully' }]
		};
```

- 为什么是问题：取消只在进入等待之前看一次。等待本身不订阅 `token`，也没有超时，只在目标 `uri` 的条目经历「正在修改 → 结束」时 resolve。用户在这段等待里停止请求后，函数仍返回成功。条目若始终对不上 `uri`，Promise 不结束，停止请求也结束不了这次工具调用。
- 方向：等待同时监听取消令牌，取消时按取消结束而不是报成功。

### r10-5

- 严重度：低
- 症状：恢复会话时，队列里只要有一条未发送消息反序列化失败，整队未发送消息都被丢掉。
- 代码：

```2942:2948:src/vs/workbench/contrib/chat/common/model/chatModel.ts
		const deserialized: ChatRequestModel[] = [];
		for (const request of requests) {
			try {
				deserialized.push(this._deserializeRequest(request));
			} catch (error) {
				this.logService.error('Failed to parse chat request', error);
			}
		}
```

```3076:3092:src/vs/workbench/contrib/chat/common/model/chatModel.ts
	private _deserializePendingRequests(pendingRequests: ISerializablePendingRequestData[]): IChatPendingRequest[] {
		try {
			return pendingRequests.map(pending => ({
				id: pending.id,
				request: this._deserializeRequest(pending.request),
				kind: pending.kind,
				sendOptions: {
					...pending.sendOptions,
					userSelectedTools: pending.sendOptions.userSelectedTools
						? constObservable(pending.sendOptions.userSelectedTools)
						: undefined,
				}
			}));
		} catch (e) {
			this.logService.error('Failed to parse pending chat requests', e);
			return [];
		}
	}
```

- 为什么是问题：已落盘的请求是逐条捕获，坏一条只丢那一条。未发送队列用一次 `map`，任意一条抛错就返回空数组。构造函数在有 `pendingRequests` 时直接采用这个结果（2830–2831 行），用户关掉窗口前排着的其他消息不会回来。
- 方向：和已发送请求一样按条跳过，保留能解析的队列项。

## 实际打开的文件

- `src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts`
- `src/vs/workbench/contrib/chat/common/chatService/chatService.ts`
- `src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts`
- `src/vs/workbench/contrib/chat/common/model/chatModel.ts`
- `src/vs/workbench/contrib/chat/common/model/objectMutationLog.ts`
- `src/vs/workbench/contrib/chat/common/model/chatProgressTypes/chatToolInvocation.ts`
- `src/vs/workbench/contrib/chat/common/tools/builtinTools/editFileTool.ts`
- `src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts`
- `src/vs/workbench/contrib/chat/browser/tools/languageModelToolsConfirmationService.ts`
- `src/vs/workbench/contrib/chat/common/tools/languageModelToolsConfirmationService.ts`
- `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionHandler.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`
- `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatMarkdownDecorationsRenderer.ts`
- `src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingSession.ts`
- `src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingServiceImpl.ts`
- `src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedFileEntry.ts`
