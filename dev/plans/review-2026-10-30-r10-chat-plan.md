---
title: "十六路审查 r10：chat 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 4，weaken 1。"
---

# 十六路审查 r10：chat 方案

状态：草案。
覆盖需求：无（正文未引用需求编号）。

范围只含发现稿里仍对得上活码、且引用落在 `src/vs/workbench/contrib/chat` 的条目。方案只写改法。

| 编号 | 判定 | 严重度 |
|---|---|---|
| r10-1 | hold | 高 |
| r10-2 | hold | 高 |
| r10-3 | weaken | 中 |
| r10-4 | hold | 中 |
| r10-5 | hold | 低 |

### r10-1

- 问题类：重叠的会话保存会把关机正在等的那份 Promise 清掉，排在后面的写入不再挡住退出。
- 不变量：`storeQueue` 里还有未完成的 `storeSessions` 或 `storeSessionsMetadataOnly` 时，`onWillShutdown` 的 `join` 必须等到这些写入结束。先返回的那次只能清掉自己放进 `storeTask` 的 Promise；字段已经被后一次调用换掉时，不得把它置空。
- 要动的符号或文件：`ChatSessionStore.storeSessions`、`ChatSessionStore.storeSessionsMetadataOnly`（`src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts` 里两处 `finally` 无条件 `this.storeTask = undefined`）。`onWillShutdown` 仍 join 这个字段即可，因为 `Sequencer.queue` 返回的后一份 Promise 会等前一份。保存状态（`ChatService.saveState`）会连续排队全文和仅元数据；模型释放（`willDisposeModel`）还会再排队一次 `storeSessions`。先结束的 `finally` 若清掉后一次的句柄，关机就看不到仍挂在队列上的会话文件写入。
- 明确不改什么：不改 `writeSession` / `writeSessionMetadataOnly` 的文件格式，不改 `updateAndFlushIndexSync` 的同步索引写入，不放宽 `shuttingDown` 为真时拒绝新开保存的早退。
- 怎样本地验证：`src/vs/workbench/contrib/chat/test/common/model/chatSessionStore.test.ts` 已有 `storeSessions persists session to index`、`storeSessions persists custom title`，不覆盖关机。`storeSessions` 的 `finally` 在 `await this.storeTask` 之后；这个 Promise 要等队列里的 `writeSession` 结束。第一次 `writeFile` 还停着时，第一次 `finally` 不会跑。应新增的顺序是：第一次 `storeSessions` 的 `writeFile` 先停住，再发起第二次 `storeSessions`（或 `storeSessionsMetadataOnly`）；然后放开第一次 `writeFile`，让第一次 `finally` 跑完，同时第二次写入仍停住；这时再调用 `TestLifecycleService.fireShutdown()`。`shutdownJoiners` 里的 Promise 必须在第二次写入结束前保持 pending。若在第一次 `finally` 之前就关机，不改 `finally` 也会等到后一份 Promise，测不到清句柄。上述已有用例仍通过。

### r10-2

- 问题类：索引里一条元数据不合格，整张历史索引被换成空表，下一次保存把未打开的会话从历史里抹掉。
- 不变量：单条缺 `sessionId`、`title` 或 `lastMessageDate` 时只丢掉这一条。其余合格条目留在 `indexCache.entries`。之后 `updateAndFlushIndexSync` 只增改当前活会话，不得用空表覆盖合格旧条目。缺 `timing` 或 `lastResponseState` 的条目仍然算合格，继续走现有回填。
- 要动的符号或文件：`isChatSessionIndex` 对 `index.entries` 的整表失败（同文件约 863–866 行一票否决），以及 `internalGetIndex` 在 `isChatSessionIndex` 为假时把 `indexCache` 换成 `{ version: 1, entries: {} }` 的分支。条目级不合格只跳过该条。`version !== 1`、`entries` 不是对象，以及 `JSON.parse` 失败，仍整表替换。
- 明确不改什么：`JSON.parse` 失败仍清空索引。`version !== 1` 仍整表拒绝。留下的条目仍做 `timing` 与 `lastResponseState` 回填。不扫盘重建索引，不删磁盘上的会话文件，不改 `getSessionMetadataSync`。
- 怎样本地验证：`chatSessionStore.test.ts` 没有坏索引用例。应新增：向 `chat.ChatSessionStore.index` 写入 `version: 1` 的索引，一条缺 `title` 或 `lastMessageDate`，另一条三个字段齐全。构造 `ChatSessionStore` 后 `getIndex()` 只含合格那条。再对另一个活会话调用 `updateAndFlushIndexSync`，存储里读回的索引仍含那条合格旧条目。另断言缺 `timing` 的条目不被丢掉。

### r10-3

- 问题类：转移会话没读到可用内容时仍删除转移索引和转移文件，这一次导入不能重试。
- 不变量：`readTransferredSession` 仅在 `readSessionFromLocation` 返回可用内容时调用 `cleanupTransferredSession`，并且仍在返回前清理。内容为 `undefined` 时，转移索引项和转移文件都保留。`cleanupTransferredSession` 保持 private，`ChatService` 不调用它。成功读取后的清理仍然发生在 `acquireOrCreate` 之前。`acquireOrRestoreLocalSession` 只在读到可用内容之后清 `_transferredSessionResource`；读失败则保留这个指针，下一次仍走转移读取。
- 要动的符号或文件：`ChatSessionStore.readTransferredSession`（`src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts`）。现在无论 `sessionData` 是否有值，返回前都会 `cleanupTransferredSession`。改为只有 `sessionData` 有值才清理。`ChatService.acquireOrRestoreLocalSession`（`src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts`）现在先把 `_transferredSessionResource` 置空再读；改为读到可用内容后再清。不把清理挪到 `acquireOrCreate` 成功之后。
- 明确不改什么：过期转移仍按 `getTransferredSessionData` 里的 `TRANSFER_EXPIRATION_MS` 清理。不改 `storeTransferSession` 的成功写入。不删源工作区自己的 `chatSessions` 文件。非法 session resource 在读文件之前就返回的路径保持不清理。不把「装进正式会话之后再删转移副本」写进本条：`readTransferredSession cleans up after reading`（`chatSessionStore.test.ts`）只调用 `readTransferredSession`，成功后 `getTransferredSessionData()` 必须为 `undefined`。保住这条用例，清理就不能改到 `acquireOrCreate` 之后。
- 怎样本地验证：已有 `readTransferredSession returns session data`、`readTransferredSession cleans up after reading` 仍要求成功读到内容后 `getTransferredSessionData()` 为 `undefined`。应新增：转移文件缺失，或内容不是合法会话 JSON 时，`readTransferredSession` 得到 `undefined`，`getTransferredSessionData()` 仍指向该会话，已存在的文件不进入 `deleteOperations`。`readTransferredSession returns undefined for invalid session resource` 仍通过。
- 反证：`transferChatSession` 把副本写到 `transferredChatSessions` 并记下转移索引，不删除源工作区会话。同函数还会调用 `chatTransferService.addWorkspaceToTransferred`，那只追加 `chat.transferedWorkspaces`，不改变「源会话不在这条路径上被删除」。读失败会毁掉这次转移快照，源工作区里的会话还在，可以从源再转移一次。发现稿写的「没有第二份副本」「无法再导入」过重。
- 降级后的严重度：中（原为高）。

### r10-4

- 问题类：编辑文件工具在等「正在修改」结束时不响应取消，取消后仍报成功；条目对不上则调用不返回。
- 不变量：`mapCode` 之后的等待必须同时听 `token`。取消时以 `CancellationError` 结束，不得返回 `The file was edited successfully`。目标 `uri` 的条目一直不出现，或 `isCurrentlyBeingModifiedBy` 从未经历 true 再变 false，取消也必须让 `invoke` 结束。未取消且经历了「正在修改 → 结束」时，仍返回成功文案。
- 要动的符号或文件：`EditTool.invoke`（`src/vs/workbench/contrib/chat/common/tools/builtinTools/editFileTool.ts` 里等待 `editSession.entries` 的那个 Promise）。在 `autorun` 之外订阅 `token.onCancellationRequested`，取消时拒绝等待；`finally` 里仍 `dispose`。
- 明确不改什么：不改进入等待之前的 `token.isCancellationRequested` 检查，不改「没有产生修改」的错误，不改成功文案，不改 `prepareToolInvocation`，不改 `languageModelToolsService` 的调用框架。
- 怎样本地验证：`src/vs/workbench/contrib/chat/test/common/tools/builtinTools/editFileTool.test.ts` 的 `propagates cancellation instead of reporting success` 只覆盖进入等待之前令牌已取消。应新增：mapper 已经产生 `textEdit`、`isCurrentlyBeingModifiedBy` 仍为 true 时取消令牌，`invoke` 以 `CancellationError` 拒绝，结果不是成功文案。再一条：`entries` 里没有该 `uri`，取消后 `invoke` 在有限时间内结束。已有 `does not report success when mapping returns undefined`、`writes progress to the request named by chatRequestId, not the last request` 仍通过。

### r10-5

- 问题类：恢复会话时，未发送队列里一条反序列化失败，整队未发送消息被丢掉。
- 不变量：与已落盘请求的 `_deserialize` 一样按条捕获。能解析的队列项留下，坏的只记日志并跳过。全部失败时队列才为空。
- 要动的符号或文件：`ChatModel._deserializePendingRequests`（`src/vs/workbench/contrib/chat/common/model/chatModel.ts`）。把包住整个 `map` 的一次 `try/catch` 改成循环里逐条 `try/catch`，失败时不要 `return []`。
- 明确不改什么：不改 `_deserialize` / `_deserializeRequest`。构造函数在有 `pendingRequests` 时仍采用这个函数的返回值。不改已发送请求全部解析失败时的 `restoreDroppedAllRequests`。
- 怎样本地验证：`src/vs/workbench/contrib/chat/test/common/model/chatModel.test.ts` 已有 `pending requests restore instruction context`，只覆盖成功恢复。应新增：`pendingRequests` 两条，第二条的 `request` 不是对象、使 `_deserializeRequest` 抛错；恢复后 `getPendingRequests()` 只含第一条。两条都合法时长度仍为 2。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r10-3 不再要求在 `acquireOrCreate` 成功之后清理转移副本，也不再让 `ChatService` 调用 private 的 `cleanupTransferredSession`。成功读取仍在 `readTransferredSession` 返回前清理，以保住 `readTransferredSession cleans up after reading`。Important 已改：r10-1 的关机断言改为先放开第一次 `writeFile`，等第一次 `finally` 跑完且第二次写入仍停住，再 `fireShutdown`。Minor 已并入：坏索引只跳过条目，`version !== 1` 和 `JSON.parse` 失败仍整表替换；转移路径还会追加工作区记录，但不删源会话。
