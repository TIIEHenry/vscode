---
title: "方案 r07：workbench-shell"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "hold 1，drop 0，weaken 3。createOnly 在无提供者时仍覆盖已打开文本；权限回调、会话网格恢复和网页存储初始化只成立一部分。"
---

hold 1，drop 0，weaken 3。

## r07-1（hold，高）

### 问题类
无文件提供者时，`createOnly` 创建失败仍会把已解析到的可写文本模型整篇换成请求内容。

### 不变量
`AgentHostResourceService.write` 在 `params.createOnly` 为真时，`createFile` 抛错且 `hasProvider(uri)` 为假，必须把该错误抛回，不得调用 `_writeVirtual`，也不得 `setValue`。没有 `createOnly` 时，无提供者且模型可写，仍用同一缓冲更新模型并返回成功。有提供者时，磁盘错误原样抛回，不改模型。

### 要动的符号或文件
`AgentHostResourceService.write`（`src/vs/workbench/services/agentHost/common/agentHostResourceService.ts` 第 167–175 行）：`hasProvider` 为假之后、调用 `_writeVirtual` 之前，若 `params.createOnly` 则 `throw err`。

### 明确不改
`_writeVirtual`（第 349–364 行）对非 `createOnly` 的可写模型仍 `setValue`。有提供者时第 168–169 行的 `throw err` 保持。`read` 的 `_readVirtual` 回退保持。

### 本地验证
`src/vs/workbench/services/agentHost/test/common/agentHostResourceService.test.ts` 已有 `write with createOnly rethrows when provider exists and createFile fails without setValue`，以及 `write updates virtual model when no provider and model is writable`。新增断言：`hasProvider: false`、模型可写且已有内容、`createOnly: true` 时，`write` 以磁盘错误拒绝，`setValue` 调用次数为 0，缓冲保持原内容。上述两条旧断言保持原结果。

## r07-2（weaken，降为低）

### 问题类
同一条 `IPendingResourceRequest` 在 `deny` 把 deferred 拒绝之后，再调用该对象的 `allow` 或 `allowAlways` 仍会写入内存授权；`allowAlways` 还会把 `rw` 或 `r` 写入 `chat.agentHost.localFilePermissions`。

反证：生产调用只有 `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostPermissionUiContribution.ts` 第 32–42 行的三条命令，都先 `findPending(requestId)`。`deny`（`agentHostResourceService.ts` 第 506–508 行）先 `_dropPending`，`findPending`（第 272–274 行）之后找不到该 id，命令不会进入 `_resolve`。降级是因为这条命令路径现在授不出权限；对象方法本身仍会授出。

### 不变量
`deferred` 已经 `isSettled` 时，`allow` 与 `allowAlways` 直接返回：不 `_inMemoryGrants.set`，不 `_persistGrant`，不再 `complete`。尚未拒绝或完成时，第一次 `allow` 只加内存授权，第一次 `allowAlways` 再持久化，然后完成 deferred。

### 要动的符号或文件
`AgentHostResourceService._resolve`（`src/vs/workbench/services/agentHost/common/agentHostResourceService.ts` 第 515–535 行）：进入后若 `request.deferred.isSettled` 则返回。`deny` 已通过 `deferred.error` 把请求标成 settled（`src/vs/base/common/async.ts` 第 1847–1848、1876–1884 行）。

### 明确不改
三条命令仍经 `findPending`。`_dropPending`（第 537–542 行）与 `connectionClosed`（第 304–315 行）的队列移除保持。`_isCovered` 对内存授权和持久授权的匹配（第 421–441 行）保持。

### 本地验证
`src/vs/workbench/services/agentHost/test/common/agentHostResourceService.test.ts` 的 `request rejects with CancellationError on deny` 保持：`deny` 后等待方是 `CancellationError`。新增断言：对同一 `allPending` 对象先 `deny` 再 `allow`，以及先 `deny` 再 `allowAlways`，`check` 仍为假，设置里不出现该 URI 的 `r` 或 `rw`。单独 `allow`、单独 `allowAlways` 的现有授权断言保持。

## r07-3（weaken，降为低）

### 问题类
会话编辑器的工作区记忆键是进程内递增序号。下次启动时，先创建的那一块会按 `memento/workbench.parts.conversationEditor.1` 恢复上一轮网格，和 `sessionKey` 对不上。

反证：另一个已打开窗口不会因此关掉未标脏标签。桌面工作区库 `WorkspaceStorageDatabaseClient.onDidChangeItemsExternal` 是 `Event.None`（`src/vs/platform/storage/common/storageIpc.ts` 第 189–191 行）。网页工作区库 `IndexedDBStorageDatabase.createWorkspaceStorage` 不传 `broadcastChanges`（`src/vs/workbench/services/storage/browser/storageService.ts` 第 357–358 行）。`EditorPart.onDidChangeMementoState`（`editorPart.ts` 第 1696–1703 行）因此收不到另一窗口对这条工作区键的外部变更，`doPrepareApplyState`（第 1651–1661 行）不会在这条路径上跑。工作区库本身仍按 `workspace.id` 共用一份（`src/vs/platform/storage/electron-main/storageMainService.ts` 第 272–291 行），所以重启后的序号键冲突还在。

### 不变量
发现稿给了两条路：不按序号恢复，或用 `sessionKey` 做键。本稿不选定「关闭恢复」。`ConversationChatInputSerializer` 是为恢复注册的。空覆盖 `saveState` 还会跳过 `EditorPart.saveState` 里 centered layout 的 profile memento。拍板之前不改 `create` 的 `restorePreviousState`，也不把 `saveState` 改成空返回。`createConversationEditorPart` 在 `editorParts.ts` 约第 255–272 行，不在 `conversationEditorPart.ts`。

### 要动的符号或文件
`ConversationEditorPartImpl.create`（`src/vs/workbench/browser/parts/editor/conversationEditorPart.ts` 第 122–125 行）：调用 `super.create` 时传入 `restorePreviousState: false`（`IEditorPartCreationOptions`，`editor.ts` 第 25–27 行）。这样 `EditorPart.createContentArea` 第 1132 行不会把 `_willRestoreState` 设为真，第 1364–1365 行不会走 `doCreateGridControlWithPreviousState`。

`ConversationEditorPartImpl.saveState`：覆盖为直接返回，不调用 `EditorPart.saveState`（第 1561–1582 行）。`createConversationEditorPart` 第 272 行的 `editorPart.create(host)` 不用再传恢复选项，恢复开关放在部件自己的 `create` 上。

### 明确不改
不把部件 id 改成 `sessionKey`，`COUNTER`（`conversationEditorPart.ts` 第 25、58–61 行）仍只保证本进程内 id 不同。不改 `EditorPart.onDidChangeMementoState`、`doPrepareApplyState`、`loadState`。不删除磁盘上已有的 `memento/workbench.parts.conversationEditor.*`。`ConversationChatInput` 的序列化器（`conversationEditor.contribution.ts` 第 51–54 行）保持。

### 本地验证
没有覆盖会话编辑器恢复的测试。新增断言：连续两个不同 `sessionKey` 的 `createConversationEditorPart`，创建后 `willRestoreState` 为假；工作区存储里不新增 `memento/workbench.parts.conversationEditor.1` 的 `editorpart.state`。预先写入该键时，先创建的会话部件不打开其中的编辑器。

## r07-4（weaken，降为低）

### 问题类
网页工作台里，应用存储 `init()` 拒绝后 `applicationStoragePromise` 既不完成也不失败。默认配置档 `createProfileStorage` 一直等这个 promise，`doInitialize` 不返回。

反证：工作区或共享库初始化拒绝、窗口仍打开时，关闭写回不是 `storageService.close()`。`BrowserLifecycleService` 在 `withExpectedShutdown`、`shutdown` 和 `doShutdown` 里调用 `storageService.flush(WillSaveStateReason.SHUTDOWN)`（`src/vs/workbench/services/lifecycle/browser/lifecycleService.ts` 第 79、102、116 行）。失焦时 `workbench.ts` 第 259–262 行也 `flush()`。`BrowserStorageService.close()`（`storageService.ts` 第 235–253 行）只在 Safari 上关库，其它浏览器保持打开，然后 `dispose()`。因此「没登记 `close()` 就不会写回」不成立。

### 不变量
`createApplicationStorage` 在 `init()` 或更早步骤抛错时，先 `applicationStoragePromise.error`，再把错误抛出。默认配置档（`isProfileUsingDefaultStorage`，`src/vs/platform/storage/common/storage.ts` 第 749–751 行）因此结束等待，`Promises.settled`（`src/vs/base/common/async.ts` 第 1913–1928 行）让 `doInitialize` 拒绝。`BrowserMain.createStorageService` 在 `initialize()` 拒绝时不把该服务放进 `serviceCollection`，先 `close()` 释放已建库，再抛出原错误。

### 要动的符号或文件
`BrowserStorageService.createApplicationStorage`（`src/vs/workbench/services/storage/browser/storageService.ts` 第 86–98 行）：整段放进 `try/catch`；catch 里若 `applicationStoragePromise` 尚未 settled，则 `error(err)`，然后 `throw err`。成功路径仍在 `init()` 与 `updateIsNew` 之后 `complete`。

不改 `web.main.ts` 第 613–617 行去 `close()` 后再抛出。那会让 `initServices` 的 `Promise.all` 整体拒绝，网页工作台起不来。工作区或共享库失败时带伤继续是现有行为，本稿不把它改成启动硬失败。只修应用存储 promise 停住：`createApplicationStorage` 失败时 `applicationStoragePromise.error`。非默认配置档没有人 await `applicationStoragePromise.p`，直接 `.error()` 会产生未处理拒绝，实施时要接住或只在默认档等待那条路径上 error。

### 明确不改
`BrowserLifecycleService` 的 `flush(WillSaveStateReason.SHUTDOWN)` 与失焦 `flush()` 保持。`BrowserStorageService.close()` 的 Safari 分支和非 Safari 不关库保持。`initialize` 里 `doInitialize` 成功之后才 `flushWhenIdleScheduler.schedule()`（`src/vs/platform/storage/common/storage.ts` 第 385–399 行）保持。非默认配置档自己的 `profileStorage.init()`（`storageService.ts` 第 135–145 行）保持。

### 本地验证
`src/vs/workbench/services/storage/test/browser/storageService.test.ts` 没有初始化失败用例。新增断言：默认配置档下应用存储 `init()` 拒绝时，`doInitialize` / `initialize()` 拒绝，而不是停在 `applicationStoragePromise.p`；`applicationStoragePromise.p` 以同一错误拒绝。`createStorageService` 在 `initialize()` 拒绝时拒绝，且该实例已 `close()`，调用方拿不到它。应用存储 `init()` 成功时，`complete` 的库和存储对象仍可被默认配置档await 到。
