---
title: "方案 r06：chat"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。发送被接受前保留编辑中的队列与检查点；工具确认只认本会话已记录的权限和本回合；本地队列在没有默认 agent 时不出队。"
---

# 方案

## r06-1

- 问题类：提交队列或 steering 的编辑后，发送若未被接受，队列项和行内正文会一起丢掉。
- 不变量：`chat.editRequests` 为默认 `inline` 时，用户正在编辑一条 `pendingKind` 已有的请求。从 `ChatWidget._acceptInput` 里 `removePendingRequest` 之后，直到 `sendRequest` 返回 `queued` 或 `sent` 之前的任何退出，队列里仍有同一种类、正文等于当时已捕获的 `inputValue` 的一项，行内编辑器仍开着并显示这段正文。会走到这里的退出包括：`_applyPromptFileIfSet` 得到 false（`_switchToAgentByName` 取消模式切换）、目录附件解析后 `stillOn(sendSessionResource)` 为假、以及 `sendRequest` 在入队前拒绝（空消息、只读会话）。`options.queue` 已经设上时，`sendRequest` 会在「没有默认 agent」检查之前走 `queuePendingRequest` 并返回 `queued`，那条拒绝不在本条的失败面上。
- 要动的符号或文件：`ChatWidget._acceptInput`、`ChatService.removePendingRequest`、`ChatModel.addPendingRequest`。待编辑项可以先从队列拿掉，避免 `sendRequest` 在 `options.queue` 分支里调用 `processPendingRequests` 时把旧项再发出去。`ChatService.removePendingRequest` 会把旧 deferred 完成成 `Request was removed from queue` 并删掉映射，旧 promise 不能再用来表示「仍在队列里」。失败时恢复后的队列项必须重新进入行内编辑。`setEditing` 在 id 相同时直接返回（`chatViewModel.ts` 约第 394 行）。沿用原 id 时先 `setEditing(undefined)` 再 `setEditing`，或直接对已挂上的编辑器 `setValue`。`createInput` 以空字符串 `render`（`chatWidget.ts` 约第 2462 行），恢复后必须再 `setValue` 成当时捕获的 `inputValue`。只新建一条并跳过 `finishedEditing` 不够：`removePendingRequest` 会刷新列表，待编辑行的身份是 `request_*` id，编辑器容器会被拆掉，`finishedEditing` 不调用只能避免 `this.input.dispose()`。只有 `sendRequest` 被接受之后才 `finishedEditing(true)`。只读会话的拒绝发生在 `sendRequest` 的 `options.queue` 分支之前，恢复必须走 `addPendingRequest` 这条不经 `sendRequest` 的路径，并带上原来的 `sendOptions`。`ChatRequestModel.message` 是只读的，不要就地改旧对象的正文。失败退出时不得把 `recentlyRestoredCheckpoint` 留成真。r06-2 的该标志只放在 `_lockedAgent` 为空且 `pendingKind === undefined` 的已发出请求分支。未锁定的队列编辑在任何可能 return 的 await 之前、删除循环之前 `setCheckpoint(undefined)`。锁定且 `supportsCheckpoints` 的队列编辑保持今天的跳过，删除循环仍跑。
- 明确不改什么：已发出请求的编辑仍走取消当前请求那一支，不把那一支改成入队。成功之后底栏 `ChatInputPart.acceptInput` 照常清空。`cancelEditing` 照常丢弃未提交的编辑。不改 `chat.editRequests` 的默认值。
- 怎样本地验证：现无对应该路径的测试名。在 `src/vs/workbench/contrib/chat/test/browser/widget/chatWidget.test.ts` 增加断言：编辑一条 queued 或 steering 请求并提交，迫使提示词模式切换取消或 `sendRequest` 以空消息 / 只读拒绝；原种类的队列项仍在，正文为提交时的 `inputValue`，该编辑器仍挂在对应行上且值为这段正文。只断言「未被 dispose」在编辑器被拆掉后仍能通过。用 `scripts/test.sh --grep` 跑这条新断言。

## r06-2

- 问题类：本地会话提交对已发出请求的编辑时，检查点在删除循环前被清掉，旧回合留在历史里。
- 不变量：未锁定 agent host 的本地会话（`chatViewPane` 对 `localChatSessionType` 调用 `unlockFromCodingAgent`，`_lockedAgent` 为空）里，点已发出请求会 `setCheckpoint`。提交后、新请求进入模型之前，该条及之后 `shouldBeBlocked` 的请求已被 `removeRequest` 去掉，`getHistoryEntriesFromModel` 看不到它们。检查点要活到 `_acceptInput` 里 `if (this.viewModel.model.checkpoint)` 的删除循环；循环末尾已有 `setCheckpoint(undefined)`。
- 要动的符号或文件：`ChatWidget._acceptInput` 里、`_lockedAgent` 为空且 `pendingKind === undefined` 的已发出请求分支，在调用 `finishedEditing(true)` 之前把 `recentlyRestoredCheckpoint` 设为真，使这次 `finishedEditing` 不再清检查点。删掉紧随其后、只在该分支里的 `viewModel.model.setCheckpoint(undefined)`。锁定会话保持今天的 `preserveCheckpoint`（`_lockedAgent && supportsCheckpoints`，约第 3261 行）。队列编辑（`pendingKind` 已有）不设这个标志。未锁定的队列编辑在任何可能 return 的 await 之前、删除循环之前 `setCheckpoint(undefined)`，因此提交不会 `removeRequest`。锁定且 `supportsCheckpoints` 的队列编辑保持今天的跳过，删除循环仍跑，那是协议截断。待编辑项不在 `_requests` 里，`setCheckpoint(pendingId)` 会直接 return，所以未锁定队列的这次清理必须显式调用 `setCheckpoint(undefined)`。
- 明确不改什么：`cancelEditing` 调用的无参 `finishedEditing` 仍清检查点并解除 blocked。`ChatModel.setCheckpoint` 的 blocked 规则不改。`lockToCodingAgent` 在支持检查点时收紧 `editable` 的逻辑不改。
- 怎样本地验证：现无此断言。在 `src/vs/workbench/contrib/chat/test/browser/widget/chatWidget.test.ts` 增加断言：未锁定部件上编辑一条已发出请求并提交后，该条及更晚的请求已从 `getRequests()` 消失，新发送的是另一条请求。用 `scripts/test.sh --grep` 跑这条新断言。

## r06-3

- 问题类：会话已经没有自己的聊天部件时，工具确认会读当前焦点部件的自动批准级别。
- 不变量：`getWidgetBySessionResource(chatSessionResource)` 为空时，该会话的实时权限检查为假。自动批准只来自该会话自己请求上已有的 `modeInfo.permissionLevel`、企业策略，以及 `toolIdsThatCannotBeAutoApproved` 对非本地会话的例外。本会话部件还在时，选择器切到 Auto-Approve 或 Autopilot 仍立即生效。
- 要动的符号或文件：`LanguageModelToolsService._isSessionLiveAutoApproveLevel` 与 `_isSessionLiveAutopilotLevel`。两处都是 `getWidgetBySessionResource(...) ?? lastFocusedWidget`。没有本会话部件时不要读 `lastFocusedWidget`。`shouldAutoConfirm` 与 `shouldAutoConfirmPostExecution` 已通过 `_isSessionInAutoApproveLevel` 使用前一个助手，改助手即可，不必改确认入口的企业策略分支。
- 明确不改什么：`ChatWidget.setModel` 切换会话时不取消原会话正在跑的请求。`ChatWidgetService.register` 在旧会话没有部件时发出的后台会话事件不改。有本会话部件时的选择器读取不改。
- 怎样本地验证：在 `src/vs/workbench/contrib/chat/test/browser/tools/languageModelToolsService.test.ts` 增加断言：会话 A 最后一条请求的权限是默认，没有任何部件的 `sessionResource` 是 A，`lastFocusedWidget` 是自动批准或 Autopilot；A 的工具调用不返回 `ConfirmationNotNeeded` / `autoApproveAllReason`。再断言 A 自己的部件处于该级别时仍然自动批准。用 `scripts/test.sh --grep` 跑这两条。

## r06-4

- 问题类：被重新激活、且不是模型最后一条的回合，其工具调用会因最后一条已完成而被取消。
- 不变量：`invokeTool` 在会话里判定取消或完成时，绑定 `dto.chatRequestId` 对应的请求；没有该 id 时才用最后一条。被 `reopen()` 的那条 `isComplete` 为假时，即使后面还有已完成回合，也不抛 `CancellationError`。工具归因的 `requestId` 是这一条。
- 要动的符号或文件：`LanguageModelToolsService.invokeTool` 的请求查找，对齐 `beginToolCall` 与 `AskQuestionsTool.getRequest`：先 `getRequests().find(r => r.id === chatRequestId)`，再退回 `at(-1)`。`AgentHostSessionHandler._executeClientTool` 调用 `invokeTool` 时传入 `chatRequestId: request.turnId`（与 `startServerRequest(activeTurn.id, …, { resume })` 写入模型的 id 相同）。扩展宿主 `$invokeTool` 已会带上 `chatRequestId`，查找改完后那条路径一起生效。
- 明确不改什么：`_ensureClientToolInvocation` 里 `beginToolCall` 继续不传 `sessionResource` 和 `chatRequestId`，避免往已完成请求上 `appendProgress`。`ChatResponseModel.reopen` 不把请求移到末尾。`onDidStartServerRequest` 的 `resume` 分支仍按 id 查找并 `reopen()`。
- 怎样本地验证：在 `languageModelToolsService.test.ts` 增加断言：同一会话有两条请求，前一条经 `reopen()` 后未完成，后一条 `isComplete`；`invokeTool` 带前一条的 `chatRequestId` 和该 `sessionResource` 时不抛 `CancellationError`，且调用记在前一条上。不带 `chatRequestId` 且最后一条已完成时仍抛 `CancellationError`。这两条是调用方自己带上 id，锁不住 `_executeClientTool` 第 2821 行的参数对象（今天没有 `chatRequestId`）。把该参数对象收成同文件可测函数，或在 agent host 客户端工具测试里断言 dto 含 `chatRequestId: request.turnId`。缺这个字段时断言失败。用 `scripts/test.sh --grep` 跑查找断言和这条 dto 断言。

## r06-5

- 问题类：本地队列在没有默认 agent 时，消息已出队然后被丢掉。合并多条 steering 的解析失败不作为本条的现网症状。
- 降级反证：`processNextPendingRequest` 在合并多条 steering 时调用 `parseChatRequest`，并显式把 `agentId` 设为 `undefined`。`ChatService.parseChatRequest` 仅在 `options.agentId` 有值且 agent 不存在时抛错。`ChatRequestParser.parseChatRequest` 没有 `throw`。因此 2074–2080 行的 catch 不会因「合并正文解析失败」执行。没有默认 agent 时，出队发生在 `getDefaultAgent` 之前，拒绝后直接 return，队列里已经没有这些消息，这条成立。
- 不变量：`_isServerManagedQueue` 为假的本地会话，当前请求结束后若该 location 与 mode 没有默认 agent，队首的 steering 组或那一条非 steering 消息仍按出队前的顺序留在 `getPendingRequests()` 里，deferred 仍挂在 `_queuedRequestDeferreds` 上，不被完成成 `rejected`。
- 要动的符号或文件：`ChatService.processNextPendingRequest`。用 `ChatModel.getPendingRequests()` 先看将要处理的那一组的 `sendOptions`，`getDefaultAgent` 为空则直接 return，不要先调用 `dequeueAllSteeringRequests` 或 `dequeuePendingRequest`。
- 明确不改什么：agent host 会话在 `_isServerManagedQueue` 处的提前 return。已经找到默认 agent 之后的合并、发送和 deferred 完成。不改 `ChatRequestParser`。解析 catch 不是本条要修的症状；若顺手让它在抛错时插回，必须按出队前顺序放回队首，不能用 `addPendingRequest` 的队尾插入把非 steering 接到后面。
- 怎样本地验证：在 `src/vs/workbench/contrib/chat/test/common/chatService/chatService.test.ts` 增加断言，与已有 `race condition: processNextPendingRequest dequeues before commit handler runs` 并列：进行中的请求完成后 `getDefaultAgent` 为空，原先的 steering 与 queued 顺序不变，deferred 未以 `No default agent available` 完成。用 `scripts/test.sh --grep` 跑这条新断言。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r06-1 失败后编辑器必须仍挂在对应行上；r06-2 的检查点标志只用于已发出请求；r06-4 的 dto 断言打在 `_executeClientTool` 的参数对象上。均已写入正文。剩余风险：非末条回合真正执行后，确认级别仍可能来自另一条已完成请求的 `modeInfo.permissionLevel`，不在本方案。

2026-09-30 第二轮。无 Critical。Important：同一 id 的 `setEditing` 会直接返回，`createInput` 之后必须 `setValue`；未锁定队列在删除循环前 `setCheckpoint(undefined)`，锁定且 `supportsCheckpoints` 的队列编辑保持跳过。该标志只在 `_lockedAgent` 为空的已发出请求上设置。均已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
