---
title: "方案 r08：chat"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "hold 4，drop 0，weaken 1。一条请求还原失败会清空并回写会话；坏 jsonl 不回退旧 json；索引里的进行中和等待输入收不掉；拒绝新建文件时删除失败仍收掉条目。外部编辑开始只有回调真正拒绝时才会挂起。"
---
# 方案 r08：chat

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 1。

## r08-1（hold，高）
### 问题类
一条请求还原失败时，整段请求被换成空数组，保存或关闭会截断或删除已写盘的会话。

### 不变量
非空请求列表里，只有抛错的那一条可以从内存模型丢掉。至少还有一条还原成功时，模型保留成功的请求。输入列表非空但一条都没还原成功时，这次模型不得进入 `storeSessions`，也不得 `deleteSession`。

「不可存」标记不能在这个活模型上一直为真。用户之后成功追加一条可序列化请求后要清掉标记，否则新请求也不会落盘。部分还原会在下次写入时丢掉读不了的那一条（例如新的 `part.kind`），这是取舍，不是顺便。已有测试名是 `initialization with full serializable data (not imported)`。

### 要动的符号或文件
- `ChatModel._deserialize`（`src/vs/workbench/contrib/chat/common/model/chatModel.ts` 第 2928–2940 行）。第 2935–2939 行的 `try` 仍包住整个 `map`，失败就 `return []`。改成逐条 `try/catch` 调用 `_deserializeRequest`。失败时 `logService.error` 并跳过该条。
- 原始 `requests.length > 0` 且结果为 0 时，在模型上记下「这次还原把全部请求丢掉了」。`ChatService.shouldStoreSession`（`src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts` 第 395–403 行）看到该标记返回 false。`saveState`（第 368–389 行，`storeSessions` 在第 388 行）和 `willDisposeModel`（第 285–295 行：空且无自定义标题走第 289–291 行 `deleteSession`，否则第 292–294 行 `storeSessions`）因此都不会写回或删除。构造函数第 2815 行仍会挂上 `dataSerializer`，靠这个标记挡住写回。

### 明确不改
- `reviveParsedChatRequest`：未知 `part.kind` 仍在 `src/vs/workbench/contrib/chat/common/requestParser/chatParserTypes.ts` 第 317 行抛出；缺 `range` 仍在第 243 行读取 `part.range.start`。
- `_deserializePendingRequests`（`chatModel.ts` 第 3061 行起）仍直接调用 `_deserializeRequest`。
- `requests` 不是数组时第 2930–2932 行的 `return []`。
- `objectMutationLog.ts` 第 615–616 行和 `_applyPush` 第 492–493 行的截断。部分还原成功后的后续保存仍走现有 diff，跳过的那一条可以因此从日志里消失。
- 本来就没有请求的新会话，以及非数组 `requests` 造成的空模型，仍按现在的 `shouldStoreSession` / `willDisposeModel` 处理。

### 本地验证
- 已有：`src/vs/workbench/contrib/chat/test/common/model/chatModel.test.ts` 的 `initialization with invalid data`（`requests` 不是数组时仍是 0 条）、`initialization with full serializable data`。
- 新增：两条请求，其中一条 `message.parts` 含未知 `kind`。`getRequests()` 只保留成功的那条，且该模型仍允许保存。两条都无法还原时请求数为 0，这次模型不触发 `storeSessions`，也不触发 `deleteSession`。

## r08-2（hold，中）
### 问题类
`.jsonl` 能读到但解析失败时，同 id 的旧 `.json` 不会被用来打开会话。

### 不变量
日志文件读不到时，仍走现在的 flat 读取。日志文件在、但 `log.read` 或内容不可用时，再读同 id 的 flat `.json`。flat 也不可用才返回 `undefined`。

### 要动的符号或文件
- `ChatSessionStore.readSessionFromLocation`（`src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts` 第 653–711 行）。第 657–663 行只有 `readFile` 抛错才让 `rawData` 为空，第 666 行才读 flat。第 683–710 行解析失败直接 `return undefined`。
- 日志缓冲区解析失败时先 `reportError('malformedSession', …)`，再按第 666–676 行同一套读取 flat（含 `FILE_NOT_FOUND` 时的 `readSessionFromPreviousLocation`）。空日志会在 `objectMutationLog.ts` 第 392–393 行抛出 `Empty log file`，也走这条回退。flat 用 `JSON.parse`。不要复用已经 `read` 失败的那个 `ChatSessionOperationLog`。成功则 `normalizeSerializableChatData` 后返回，`serializer` 用新建的 `ChatSessionOperationLog`，与现在的 flat 分支一致。flat 再失败则 `return undefined`。

### 明确不改
- `getStorageLocation`（第 731–742 行）仍同时给出 `.json`，以及配置不是 false 时的 `.jsonl`。
- 日志解析成功时不读 flat。
- `acquireOrRestoreLocalSession`（`chatServiceImpl.ts` 第 663–665 行）在没有 `sessionData` 时仍返回 `undefined`。
- 回退成功后，下次 `write` 因新日志没有 `_previous` 会整文件替换 `.jsonl`。这是现有 flat 读入后的写入行为。

### 本地验证
- 已有：`src/vs/workbench/contrib/chat/test/common/model/chatSessionStore.test.ts` 的 `readSession returns undefined for non-existent session`、`readSession returns stored session data`。
- 新增：同一 sessionId 先有可解析的 `.json`，再有截断或空的 `.jsonl`。`readSession` 返回 flat 里的请求。只有坏 `.jsonl`、没有 `.json` 时仍是 `undefined`。只有完好 `.jsonl` 时不读 `.json`。

## r08-3（hold，中）
### 问题类
索引里已经写成 `Pending` 或 `NeedsInput` 的条目，读索引时不会被收成完成。

### 不变量
读入索引时，已持久化的 `Pending` 和 `NeedsInput` 变成 `Complete`。缺字段以及 `null` / `undefined` 仍补成 `Complete`。`Complete`、`Cancelled`、`Failed` 保持原值。

### 要动的符号或文件
- `ChatSessionStore.internalGetIndex` 对 `entry.lastResponseState` 的赋值，现在在 `chatSessionStore.ts` 第 584 行，仍是 `??=`。`ResponseModelState` 在 `src/vs/workbench/contrib/chat/common/chatService/chatService.ts` 第 1751–1757 行：`Pending` 是第一项，值为 `0`；`NeedsInput` 是 `4`。两者都不是 nullish，右侧的比较不会执行。
- 改成普通赋值：值等于 `Pending` 或 `NeedsInput` 时写成 `ResponseModelState.Complete`；否则仍用 `??=` 把缺字段补成 `Complete`。

### 明确不改
- `getSessionMetadataSync`（第 877–879 行）仍把活模型上的 `Pending` / `NeedsInput` 写成 `Cancelled`。
- `chatResponseStateToSessionStatus`（`src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts` 第 1997–2000 行）和 `LocalChatSessionItem` 第 231 行的取值。
- 不为此单独 `flushIndex`。

### 本地验证
- 已有用例只把 `lastResponseState` 设成 `Complete`（`src/vs/workbench/contrib/chat/test/browser/agentSessions/localAgentSessionsController.test.ts`），没有这条迁移。
- 新增：在 `src/vs/workbench/contrib/chat/test/common/model/chatSessionStore.test.ts`，索引里 `lastResponseState` 为 `Pending`（`0`）和 `NeedsInput` 时，`getIndex()` 得到 `Complete`；缺字段时仍是 `Complete`；`Cancelled` 与 `Failed` 不变。

## r08-4（hold，中）
### 问题类
拒绝本次新建的文件时，删除失败或没执行删除，工作集条目仍会因 `onDidDelete` 被拿掉。

### 不变量
只有 `fileService.del` 成功，或失败原因是文件已经不存在，才 `fire` `onDidDelete`。其它删除失败必须让 `_doReject` 拒绝，条目留在工作集，状态保持 `Modified`。

### 要动的符号或文件
- `ChatEditingModifiedDocumentEntry._doReject`（`src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedDocumentEntry.ts` 第 291–299 行）。`createdInRequestId` 等于当前 `requestId` 时：若 `isTextFileEditorModel`，仍先 `revert({ soft: true })`。然后不论是不是文本文件模型都 `del(modifiedURI)`。`catch` 里用 `toFileOperationResult`（`src/vs/platform/files/common/files.ts`）等于 `FileOperationResult.FILE_NOT_FOUND` 才当作已删除；其它错误重新抛出。确认已删除之后才 `_onDidDelete.fire()`。把第 299 行的 `fire` 挪到删除确认之后。

### 明确不改
- `chatEditingSession.ts` 第 1282–1285 行的 `onDidDelete`：确认删除后仍从工作集移除并关闭编辑器。
- `rejectDeferred`（`chatEditingModifiedFileEntry.ts` 第 259–266 行）先 `_notifySessionAction('rejected')` 再 `await _doReject` 的顺序。
- `_operateEntry`（`chatEditingSession.ts` 第 468–471 行）已经把 `rejectDeferred` 的拒绝记入日志，并且不执行状态回调。拒绝失败靠这条日志可见，不改会话级 `reject()`。
- `ChatEditingModifiedNotebookEntry._doReject`（第 445–452 行）。

### 本地验证
- 没有覆盖这次新建文件拒绝删除的测试。`src/vs/workbench/contrib/chat/test/browser/chatEditing/chatEditingService.test.ts` 里的 `entry.reject()` 在接受/合并路径上。
- 新增：`createdInRequestId` 等于当前请求时，`del` 抛出非 `FILE_NOT_FOUND`，`reject()` 之后条目仍在 `session.entries`，状态仍是 `Modified`。`del` 成功或抛出 `FILE_NOT_FOUND` 时，条目从工作集消失。不是文本文件模型时，`del` 失败同样保留条目；`del` 成功才移除。

## r08-5（weaken，降为低）
### 问题类
持锁回调若在完成 `acquiredLock` 之前拒绝，`startExternalEdits` 会停在 `Promise.all` 上。

读到的反证：第 740 行 `_getOrCreateModifiedFileEntry` 使用 `NotExistBehavior.Abort`。`_createModifiedFileEntry` 第 1326–1327 行在 `Abort` 时 `return undefined`。文件不存在不会走进发现稿说的 `Create` 失败。`_acceptStreamingEditsStart` 第 1044 行仍用 `Create`，但 `startExternalEdits` 只在第 741–742 行 `entry` 已存在时才调用它；`_getOrCreateModifiedFileEntry` 第 1246–1250 行会返回已有条目，不再进入第 1323–1349 行的创建重试。`isDisposed` 分支在第 722–724、745–747、757–759、766–768 行已经 `acquiredLock.complete()`；第 781 行之后若已 dispose，第 782–784 行会完成全部 `releaseLock`。`contentFor` 的 `readFile` 失败已在第 735–737 行吞掉。`save()`（`chatEditingModifiedDocumentEntry.ts` 第 342–346 行）调用 `textFileService.save` 时没有 `ignoreErrorHandler`；`TextFileEditorModel.handleSaveError` 第 988–990 行只在该选项下重新抛出，写入错误在第 956–958 行被吞掉，`textFileService.save` 第 381 行失败时返回 `undefined`。`startExternalEdit`（`chatEditingModifiedFileEntry.ts` 第 423–425 行）只设置标志。`SequencerByKey.queue`（`src/vs/base/common/async.ts` 第 343–349 行）在任务拒绝后摘掉 key，不会停在尚未 `return` 的 `releaseLock.p` 上；`releaseLock.p` 只在第 777 行的成功路径返回。仍成立的是：第 721–777 行没有 `try/finally`。第 742 行 `_acceptStreamingEditsStart`（例如第 1039 行未知条目类型）或第 756 行 `resetEditTrackerToInitialContent` 若拒绝，第 774 行 `complete` 不会执行，第 781 行 `Promise.all` 不返回。

### 不变量
回调里的拒绝必须让 `startExternalEdits` 拒绝返回，`acquiredLock` 必须结束，这次开始拿到的 `releaseLock` 必须全部放开，且不得写入 `_externalEditOperations`。文件不存在、`contentFor` 读失败、会话已 dispose、普通保存失败（`save` 返回 `undefined`）仍按现在的方式结束。

### 要动的符号或文件
- `ChatEditingSession.startExternalEdits` 的 queue 回调（`chatEditingSession.ts` 第 721–777 行）和第 781 行之后。
- `DeferredPromise.complete` 在已结束时直接返回（`async.ts` 第 1864–1866 行），`finally` 里可以无条件 `acquiredLock.complete()`。
- `catch` 里记下错误，并 `complete` 这一条 `releaseLock`，不要 `return releaseLock.p`。调用方没有 `await` `queue()` 的返回值，所以不能只靠队列承诺拒绝来结束 `startExternalEdits`。
- `Promise.all` 之后若有错误：对其余 `releaseLock` 全部 `complete`（别的资源可能已经 `return releaseLock.p`），不要 `createSnapshot`，不要 `_externalEditOperations.set`，然后抛出该错误。

### 明确不改
- 第 740 行的 `NotExistBehavior.Abort`。
- `_createModifiedFileEntry` 的 `Abort` / `Create` 分工。
- 第 735–737 行的 `contentFor` catch，以及已 dispose 时第 782–784 行放开锁。
- `textFileService` / `TextFileEditorModel` 的保存错误处理。
- `stopExternalEdits`。

### 本地验证
- 已有：`src/vs/workbench/contrib/chat/test/browser/chatEditing/chatEditingService.test.ts` 的 `startExternalEdits keeps initial content when contentFor read fails`、`stopExternalEdits maps contentFor by start resources order when reads finish out of order`。这两条仍须正常返回。
- 新增：让 `_acceptStreamingEditsStart` 或 `resetEditTrackerToInitialContent` 拒绝时，`startExternalEdits` 在有限时间内拒绝，`_externalEditOperations` 没有这次 `operationId`，同一资源可以再次 `startExternalEdits`。文件不存在（`Abort`）时 `startExternalEdits` 仍正常返回。
