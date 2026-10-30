---
title: "审查 r08：chat"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；反序列化任一请求失败会把整段会话当成空会话，保存或关闭时删掉或覆盖已持久化的历史。"
---
# 审查 r08：chat

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r08-1 高

- 症状：历史会话里只要有一条请求还原失败，打开后整段对话变空；窗口保存或关掉这个会话时，磁盘上的原文被截断或直接删除。
- 位置：`src/vs/workbench/contrib/chat/common/model/chatModel.ts` 第 2935–2939 行
- 引用：

```ts
try {
	return requests.map(r => this._deserializeRequest(r));
} catch (error) {
	this.logService.error('Failed to parse chat data', error);
	return [];
}
```

- 为什么是问题：`_deserializeRequest` 会走 `reviveParsedChatRequest`。未知的 `part.kind` 在 `src/vs/workbench/contrib/chat/common/requestParser/chatParserTypes.ts` 第 316–317 行直接 `throw`；`part.range` 缺失时第 243 行访问 `part.range.start` 也会抛。上面的 `catch` 包住整个 `map`，一条失败就把全部请求换成 `[]`。这个空模型仍挂着读日志时填好的 `dataSerializer`（`chatModel.ts` 第 2815 行）。之后 `saveState`（`chatServiceImpl.ts` 第 373–388 行）会 `storeSessions`。变更日志在当前数组比已确认状态短时写入 `Push` 并把数组截到新长度（`objectMutationLog.ts` 第 615–616 行），已写盘的请求被截掉。关掉会话时更直接：`willDisposeModel`（`chatServiceImpl.ts` 第 289–294 行）看到 `getRequests().length === 0` 且没有自定义标题就 `deleteSession`，有自定义标题则再把这个空模型写回去。
- 方向：单条请求还原失败时跳过该条并保留其余请求，且不要把这次失败后的空模型写回或删掉原会话文件。

## r08-2 中

- 症状：`.jsonl` 会话日志能读到但解析失败时，旁边仍在的旧 `.json` 不会被用来打开会话，历史条目打不开。
- 位置：`src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts` 第 657–710 行
- 引用：

```ts
if (logStorageLocation) {
	try {
		rawData = (await this.fileService.readFile(logStorageLocation)).value;
		fromLocation = logStorageLocation;
	} catch (e) {
		this.reportError('sessionReadFile', `Error reading log chat session file ${sessionId}`, e);
	}
}

if (!rawData) {
	try {
		rawData = (await this.fileService.readFile(flatStorageLocation)).value;
		// ...
	}
}

try {
	// log.read 或 JSON.parse
} catch (err) {
	this.reportError('malformedSession', `Malformed session data in ${fromLocation.fsPath}: ...`, err);
	return undefined;
}
```

- 为什么是问题：只有 `readFile` 抛错时 `rawData` 才为空，才会去读 flat `.json`。日志文件存在但内容坏掉（截断、空文件、`log.read` 抛错）时，`rawData` 已经是那个坏缓冲区，解析失败后第 710 行直接 `return undefined`，不再读 `flatStorageLocation`。`getStorageLocation`（第 731–740 行）仍会同时给出 `<1.109` 的 flat 文件和现在的 `.jsonl`。`acquireOrRestoreLocalSession`（`chatServiceImpl.ts` 第 663–664 行）看到没有 `sessionData` 就放弃恢复。
- 方向：日志解析失败时再尝试同 id 的 flat `.json`，不要把「文件读到了但内容不可用」当成「没有备份」。

## r08-3 中

- 症状：索引里已经标成进行中或等待输入的旧会话，重新加载后仍显示进行中或等待输入。
- 位置：`src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts` 第 583–584 行
- 引用：

```ts
// TODO@connor4312: the check for Pending/NeedsInput guards old sessions from Insiders pre PR #288161 and it can be safely removed after a transition period, to only backfill the "complete" state when missing.
entry.lastResponseState ??= entry.lastResponseState === ResponseModelState.Pending || entry.lastResponseState === ResponseModelState.NeedsInput ? ResponseModelState.Complete : entry.lastResponseState || ResponseModelState.Complete;
```

- 为什么是问题：`??=` 只在左值是 `null` 或 `undefined` 时才赋值。`ResponseModelState.Pending` 是枚举第一项，值为 `0`，`NeedsInput` 也是已写入的非空值（`chatService.ts` 第 1751–1756 行），两边都不会进入右侧。右侧对 `Pending` / `NeedsInput` 的判断因此不会执行。会话模型还没加载时，列表状态取索引里的 `lastResponseState`（`localAgentSessionsController.ts` 第 231 行）；`Pending` 显示为进行中，`NeedsInput` 显示为等待输入（`chatSessions.contribution.ts` 第 1997–2000 行）。新写入已经在 `getSessionMetadataSync`（第 877–879 行）把这两种状态改成 `Cancelled`，缺字段的旧条目也会被补成 `Complete`，唯独索引里已经写成这两种状态的条目会一直留着。
- 方向：读索引时用普通赋值，把已持久化的 `Pending` 和 `NeedsInput` 收成完成（或取消）。

## r08-4 中

- 症状：拒绝本次新建的文件时，删除失败或根本没删，文件仍留在磁盘上，但编辑会话里这条变更已经消失。
- 位置：`src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedDocumentEntry.ts` 第 291–299 行
- 引用：

```ts
if (this.createdInRequestId === this._telemetryInfo.requestId) {
	if (isTextFileEditorModel(this._docFileEditorModel)) {
		await this._docFileEditorModel.revert({ soft: true });
		await this._fileService.del(this.modifiedURI).catch(err => {
			// don't block if file is already deleted
		});
	}
	this._onDidDelete.fire();
}
```

- 为什么是问题：`del` 的 `catch` 吃掉所有错误，不只是文件已经不存在。注释写的是不因已删除而卡住，代码却在权限、占用等失败后继续。`_onDidDelete` 还写在 `isTextFileEditorModel` 判断外面：模型不是文本文件编辑模型时，删除根本没执行也会触发。会话收到 `onDidDelete` 后把该条目从工作集拿掉并关掉编辑器（`chatEditingSession.ts` 第 1282–1285 行）。用户看到的是拒绝已完成，磁盘上的新建文件还在，工作集里也没有可再拒绝的条目。
- 方向：只有确认文件已不存在时才结束这条变更；删除失败时保留条目并让拒绝失败可见。

## r08-5 中

- 症状：外部编辑开始阶段一旦抛错，`startExternalEdits` 不再返回，调用方会一直停在这次开始上。
- 位置：`src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingSession.ts` 第 721–781 行
- 引用：

```ts
const acquiredLock = new DeferredPromise<void>();
acquiredLockPromises.push(acquiredLock);

this._streamingEditLocks.queue(resource.toString(), async () => {
	// ...
	const entry = await this._getOrCreateModifiedFileEntry(...);
	if (entry) {
		await this._acceptStreamingEditsStart(responseModel, undoStopId, resource);
	}
	// ...
	await entry?.save();
	// ...
	acquiredLock.complete();
	return releaseLock.p;
});

await Promise.all(acquiredLockPromises.map(p => p.p));
```

- 为什么是问题：`acquiredLock.complete()` 只在回调后半段。前面的 `await` 没有 `try/finally`。`_acceptStreamingEditsStart`（第 1043–1044 行）用 `NotExistBehavior.Create` 建条目，创建失败会继续抛（`_createModifiedFileEntry` 第 1323–1349 行）；`save()`（`chatEditingModifiedDocumentEntry.ts` 第 342–346 行）在文件仍脏时调用 `textFileService.save`，保存失败也会拒绝。任一处抛错都不会执行 `complete()`，第 781 行的 `Promise.all` 等不到结果。同一次提前返回也没有把 `releaseLock` 结束掉，调用方到不了后面的 `stopExternalEdits`。
- 方向：在持锁回调里用 `try/finally` 结束 `acquiredLock`，失败时同时放开 `releaseLock` 并让 `startExternalEdits` 失败返回。
