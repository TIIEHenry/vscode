---
title: "方案 r07：chat"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 1，drop 0，weaken 4。排队编辑在确认发出前就收尾仍成立；contentFor 错配、读失败当空文件、解析失败丢队列、外部草稿附件只部分成立。"
---
# 方案 r07：chat

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 1，drop 0，weaken 4。

## r07-1 中（weaken，原高）

- 问题类：`stopExternalEdits` 用 snapshot 插入顺序去对 `contentFor` 下标，多文件并行读完后改后 URI 会记到另一个资源的时间线编辑上。
- 反证：`startExternalEdits` 在第 713 行已经用 `resources[i]` 对 `contentFor?.[i]`。错配只发生在停止时第 812–816 行。`ResourceMap` 按插入顺序遍历，`snapshots.set` 在第 759、768 行，位于 `readFile` / `_getOrCreateModifiedFileEntry` 的 await 之后，而第 720 行的 `SequencerByKey` 只按资源串行、不同资源并行。算出的 `textEdit` 带 `isExternalEdit`，`chatEditingServiceImpl.ts` 第 317–319 行直接跳过，不写进模型。第 906–908 行的后台 `entry.accept()` 走到 `keep()`，保留当前 modified。`mainThreadChatAgents2.ts` 第 498–499 行调用时没有传入 `contentFor`。
- 不变量：停止时 `contentFor[i]` 只属于开始时的 `resources[i]`。某个资源先读完、或根本没进 snapshot，都不能把后面的 URI 前移。没有 `contentFor` 时仍从磁盘取改后内容。
- 要动的符号或文件：`ChatEditingSession.startExternalEdits`、`ChatEditingSession.stopExternalEdits`。在操作状态里留下开始时的 `resources` 顺序，停止时按这个顺序建 `contentForMap`。
- 明确不改什么：`keep()`、`accept()`、`isExternalEdit` 的跳过；`agentHostSnapshotController` 里忽略 `contentFor` 的实现；扩展主机进度协议。不要为了这条去补 `contentFor` 的转发。
- 怎样本地验证：没有覆盖这条的测试名。在 `src/vs/workbench/contrib/chat/test/browser/chatEditing/chatEditingService.test.ts` 新增断言：两个资源的 `contentFor` 改后读取按相反顺序完成，每个资源的时间线编辑仍来自自己的改后 URI。

## r07-2 中（weaken，原高）

- 问题类：`contentFor` 读失败被写成空字符串；文本文档会把这份空字符串设成撤销基线，拒绝时用它覆盖修改稿。
- 反证：第 732–733 行和第 855–856 行确实把失败写成 `''`。文本文档的 `resetEditTrackerToInitialContent`（`chatEditingModifiedDocumentEntry.ts` 第 223–224 行）把 original 设成这份字符串，`undo()`（`chatEditingTextModelChangeService.ts` 第 332–336 行）再用 original 替换 modified。停止时的空 `afterSnapshot` 只进入 `computeEditsFromSnapshots` 和时间线，不写回 modified。后台接受的 `keep()` 把 original 设成当前 modified。笔记本的 `resetEditTrackerToInitialContent`（`chatEditingModifiedNotebookEntry.ts` 第 1033–1035 行）在 `initialContent` 为空字符串时不恢复快照。当前调用方没有传入 `contentFor`，这两处 `catch` 走不到。
- 不变量：读 `contentFor` 失败时，已有文件的磁盘内容和已有 entry 的 original 保持读之前的值。失败不得产生一条从现有内容到空文件的编辑记录。
- 要动的符号或文件：`ChatEditingSession.startExternalEdits` 第 727–759 行，`ChatEditingSession.stopExternalEdits` 第 845–883 行。读失败时不要把 `''` 传进 `_getOrCreateModifiedFileEntry`，不要赋 `entry.initialContent`，不要调用 `resetEditTrackerToInitialContent`，不要调用 `computeEditsFromSnapshots`。
- 明确不改什么：未提供 `contentFor` 时从磁盘做快照的分支；`keep()` 与后台 `entry.accept()`；`isExternalEdit` 跳过应用编辑的逻辑。
- 怎样本地验证：没有覆盖这条的测试名。在 `chatEditingService.test.ts` 新增断言：文本文档的 `contentFor` 读取抛错后，`entry.initialContent` 仍是读之前的正文，时间线上没有把该文件记成空内容。

## r07-3 中（weaken，原高）

- 问题类：`processNextPendingRequest` 在 `try` 之外出队；合并解析一旦抛错，只拒绝 deferred，不把已取出的请求放回 pending。
- 反证：出队在第 2033、2036 行，`try` 从第 2086 行开始，`catch` 在第 2099–2105 行只 `complete({ kind: 'rejected' })` 后返回。合并调用在第 2091–2095 行把 `agentId` 和 `slashCommand` 清掉。`parseChatRequest` 里唯一的 `throw` 是未知 `agentId`（第 1412–1415 行），这条走不到。`ChatRequestParser.parseChatRequest` 没有 `throw`。单条排队走第 2096–2098 行，直接复用已解析消息，不重新解析。出队前缺省 agent 的返回由现有测试 `processNextPendingRequest retains queue when no default agent` 覆盖，那次返回发生在出队之前。
- 不变量：第 2099 行的 `catch` 跑完后，刚取出的那批请求仍以原对象、原顺序留在 pending 前部，对应 deferred 为 rejected。不要立刻再次进入 `processNextPendingRequest`，避免同一抛错循环出队。
- 要动的符号或文件：`ChatService.processNextPendingRequest`。用 `ChatModel.replacePendingRequests` 把刚取出的对象接回当前 pending 前面，再拒绝 deferred。
- 明确不改什么：第 2025–2029 行出队前就返回的缺省 agent 路径；`ChatRequestParser`；单条请求不重新解析的分支。
- 怎样本地验证：不要改 `processNextPendingRequest retains queue when no default agent`。在 `src/vs/workbench/contrib/chat/test/common/chatService/chatService.test.ts` 同一组新增断言：合并路径的 `parseChatRequest` 抛错后，pending 的 id 与文本顺序与出队前一致，相关 deferred 为 rejected。

## r07-4 高（hold）

- 问题类：编辑尚未发出的排队消息时，入队结果还没确认发出，就把编辑收尾并清掉用于恢复的 capture。
- 不变量：`sendRequest` 返回 queued、deferred 随后不是 sent 时，`restorePendingRequestAfterQueueEditRemoval` 仍用编辑提交时的 capture 把排队消息放回去。`finishedEditing(true)` 只在 `acceptAndAwaitSentRequest` 返回 sent 之后调用。
- 要动的符号或文件：`ChatWidget._acceptInput` 第 3477–3502 行。把 `_completeDeferredRequestEditAfterAcceptedSend` 和 `deferredRequestEdit = undefined` 挪到 `sent` 成立之后。`!sent` 时 capture 还在，走现有 `_abortDeferredRequestEditSend`。同一条 pending 编辑路径上，确认发出前不要对仍处于编辑中的输入调用 `this.input.acceptInput`（它会 `setValue('')`）。`finishedEditing` 会 `setEditing(undefined)`，之后 `this.input` 指向底部输入。
- 明确不改什么：第 3458–3469 行立即 rejected 时的 abort；`acceptAndAwaitSentRequest` 在入队时就调用 `onRequestAccepted` 的行为；没有 `deferredRequestEdit` 的普通发送仍在等待 deferred 之前调用 `acceptInput`。
- 怎样本地验证：现有 `restores queued pending edit after send rejection keeps message and inline editor value` 只调用 `_restorePendingQueueEditAfterFailedSend`。现有 `a queued request that is rejected when it runs stays accepted but is not sent` 只覆盖 `acceptAndAwaitSentRequest` 的结算。在 `src/vs/workbench/contrib/chat/test/browser/widget/chatWidget.test.ts` 的 `ChatWidget - request edit send deferral` 新增断言：`sendRequest` 先返回 queued、deferred 再 rejected 时，`restorePendingRequestAfterQueueEditRemoval` 被调用，且 `finishedEditing(true)` 没有在 deferred 结算前运行。

## r07-5 中（weaken，原高）

- 问题类：外部会话写入索引时把草稿 `attachments` 固定成空数组；提供者没有 `transferredState` 时，重载只能从索引恢复正文和模式。
- 反证：第 876–878 行确实写成 `attachments: []`。`hasDraftInput`（`chatServiceImpl.ts` 第 77–85 行）会因附件触发 `storeSessionsMetadataOnly`，`writeSessionMetadataOnly` 只写索引。`InputModel.toJSON` 第 2449–2461 行已经导出可持久化附件，索引层再整表清空。Agent Host 另有 draft：`AgentHostChatSession` 把 draft 放进 `transferredState`，`loadRemoteSession` 第 816–819 行优先用它。`hydrates chat input attachments from AHP draft` 已覆盖 file、paste、image 从 draft 还原。
- 不变量：没有 `transferredState` 的外部会话，重载后可持久化附件与处置前一致。已有 `transferredState` 时，附件以 draft 为准，不用索引里的空数组覆盖。正文、模式、权限的现有恢复保持。
- 要动的符号或文件：`getSessionMetadataSync`、`updateAndFlushIndexSync`、`writeSessionMetadataOnly`、`ChatService.loadRemoteSession` 里组装 `restoredDraft` 的位置。附件另存，并在 `updateAndFlushIndexSync` 这条同步刷索引的路径里一起写入；该函数的注释写明这里不能做异步文件写。`loadRemoteSession` 只在 `transferredInputState` 缺席时，把另存附件挂回 `restoredDraft`。
- 明确不改什么：`chatInputStatePersistence.ts` 的 untitled 分存；Agent Host 的 `_inputStateToDraft` / `_applyRemoteDraft`；`hasDraftInput` 的判定。索引元数据里的 `inputState.attachments` 可以继续是空数组。
- 怎样本地验证：不要改 `hydrates chat input attachments from AHP draft`。在 `src/vs/workbench/contrib/chat/test/common/model/chatSessionStore.test.ts` 的 `ChatSessionStore` 与 `loadRemoteSession` 路径新增断言：外部会话只有可持久化附件、提供者没有 `transferredState`，经 metadata-only 再加载后附件仍在。
