---
title: "方案 r12：agent-host"
type: plan
status: accepted
phase: N/A
updated: 2026-09-30
summary: "2026-09-30 用户签收。未实施。聊天流已关时提交与权限事实不再被接受；延迟重写的丢弃范围不被后到的普通补洞盖掉；epoch 前进时已排队的权限决定留到快照再收；MCP 认证取消后仍把工具失败写回等待中的 handler。"
---

# 方案

进入方案的是 r12-1、r12-3、r12-5（hold）与 r12-2、r12-4（weaken）。审查后 r12-5 从 drop 收回：HEAD 在认证取消后直接 return，没有把失败写回 handler。不占决策记录编号。

## r12-1

- 问题类：聊天流代际已空、引擎连接还在时，再发的 `submitInput` 被当成成功，正文不进队列，也没有发送失败。
- 不变量：`connectionUp === true` 且 `chatAttemptId === null` 时，`submitInput` 的 `post` 不得返回 `accepted: true`。调用方因此不会清掉草稿。`closeChatStream` 仍把 `currentChatAttemptId` 置空，且不改 `connectionUp`。代际仍匹配的 `onChatStreamDown` 仍会 `ensureChatStream`。`l1SessionClosed` 之后仍不重开聊天流。拒绝原因不得复用 `not_authenticated`。
- 要动的符号或文件：`createSessionCore` 的 `post`（`src/vs/platform/universeAgent/node/sessionCore/session-core.ts`）。在 `enqueue` 之前，若消息是 `localFact` 且 `kind === 'submitInput'` 且 `actor.chatAttemptId === null`，不要入队，返回 `accepted: false`。`PostOutcome` 在 `src/vs/platform/universeAgent/node/sessionCore/messages.ts` 与镜像 `src/vs/platform/universeAgent/common/conversationViewFrame.ts` 增加原因字面量 `chat_stream_closed`。`ConversationComposerPostFailureReason` 与 `showPostFailure`（`conversationLensDockStrings.ts`、`conversationLensComposerChrome.ts`）增加同一字面量，文案说明消息没发出、草稿还在，不要写成未登录或引擎已断开。`onSubmitInput` 在 `currentChatAttemptId === null` 时若事实仍进了 Actor（直接 `enqueue`），调用 `emitSendFailureEffect(SEND_FAILED_STREAM_CLOSED)`，且不得调用 `upsertLocalPendingSendFromSubmit`。经 `post` 拒绝的那条不会进 Actor，因此不会再发一次效果。
- 明确不改什么：不改 `closeChatStream` 里对已经在途的 `localPendingSends` 调用 `failAllLocalPendingSends(SEND_FAILED_STREAM_CLOSED)`。不改 `SessionViewHost.post` 的引擎连接闸，也不改 `session-core` 在 `connectionUp` 为假时返回 `not_authenticated`。不改远程 Chat `onClosed` 且代际仍匹配时的重开（现有「Actor must re-ensure the same chat generation」）。
- 本地验证：`scripts/test.sh --grep "sessionClosed submitInput is not accepted"`。在 `src/vs/platform/universeAgent/test/node/sessionViewHostChatClose.test.ts` 新增该测试：沿用 `sessionClosed disposes resident Chat and does not re-ensure` 的租约与 `session_closed`，连接保持不上断，再 `post({ kind: 'submitInput', text })`。断言 `accepted === false` 且 `reason === 'chat_stream_closed'`，resident Chat 的打开次数不增加，帧里没有这条正文。已有 `sessionClosed disposes resident Chat and does not re-ensure` 与 `remote Chat close posts chatStreamDown, warns, and does not fold streamClosed chrome` 保持通过。

## r12-2

- 问题类：聊天代际为空时，经 `post` 送进 Actor 的 `permissionRespond` 会被接受后丢掉；已连接窗口上的允许/拒绝不是这条路径。
- 反证：引擎已连接时，窗口允许/拒绝走 `ConversationEngineRosterService.respondEnginePermission`，调用 `uaConnection.respondPermission`，不进入 `onPermissionRespond`。`conversationLensSessionBinding.resolveConfirmation` 只在 `isEngineConnected()` 为假时才 `postBound({ kind: 'permissionRespond' })`。`universeAgentTypes.ts` 写明已连接名册走一元 `PermissionService.Respond`，stub 才用聊天臂 `permissionRespond`。因此「点一下等于没写到引擎」不是这条引用在已连接窗口上的行为。
- 不变量：`respondEnginePermission` 在连接为真时仍调用 `respondPermission`。`chatAttemptId === null` 时，`post` 的 `permissionRespond` 不得返回 `accepted: true`，也不得执行 `permissionRespondCleanupPatches`，快照里的待确认行保持可再点。代际非空时仍 `enqueueOrWriteChat`。与 r12-1 共用 `chat_stream_closed`，不另造原因字面量。
- 要动的符号或文件：同上 `createSessionCore` 的 `post`：`localFact` 且 `kind === 'permissionRespond'` 且 `actor.chatAttemptId === null` 时不要入队，返回 `accepted: false`、`reason: 'chat_stream_closed'`。`onPermissionRespond` 在代际为空时保持不写清理补丁、不发 `chatStreamWrite`。
- 明确不改什么：不改 `respondEnginePermission`、`respondPermission`，也不改连接为真时 `resolveConfirmation` 的一元分支。不改溢出时保留待确认行的路径（`disposition === 'dropped'` 那段）。不把这次拒绝显示成未登录。
- 本地验证：`scripts/test.sh --grep "sessionClosed permissionRespond is not accepted"`。在 `sessionViewHostChatClose.test.ts` 新增：`session_closed` 之前先推一条与 `sessionViewHostWriteReceipt.test.ts` 相同的 `permission_request`（含该 `requestId`），再 `post({ kind: 'permissionRespond', requestId, decision: 'allow' })`。点名的 `sessionClosed` 夹具只推 `session_closed`，不先写入这一行时，拒绝 `post` 之后「快照仍含该 `requestId`」会在不变量已经成立时失败。断言 `accepted === false`、`reason === 'chat_stream_closed'`，快照 `pendingActions` 仍含该 `requestId`，没有对应 `chatStreamWrite`。`src/vs/platform/universeAgent/test/node/sessionViewHostWriteReceipt.test.ts` 里流已就绪时 `permissionRespond` 仍写到 resident Chat。`conversationEngineRosterService.test.ts` 的 `leftover-looks-live resolveConfirmation, respondClientTool and respondQuestion reject while pairingPending and skip unary` 里，配对未挂起时 `respondPermission` 调用次数保持为 1。

## r12-3

- 问题类：补洞还在飞时，带 `dropFromSeq` 的延迟重写窗口会被后到的普通 hello 整份换成只有起止序号的窗口，旧行留着。
- 不变量：同时只飞一个 `pendingHistoryRequestId`。已有 `dropFromSeq` 的 `deferredHistoryWindow` 被 `maybeEmitHistoryFill` 再次写入时，保留 `dropFromSeq`、`helloLastMutatedFromSeq`、`rewindLastAppliedSeq`。`fromExclusive` 取较小值，`toInclusive` 取较大值，避免先删掉一段再只补后到的窄窗。没有 drop 字段的延迟窗口仍被后到窗口整份替换。`pumpDeferredHistoryWindow` 仍只在 `dropFromSeq !== undefined` 时 `dropMirrorFromSeq`。
- 要动的符号或文件：`maybeEmitHistoryFill`（`src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts`，现为 `this.deferredHistoryWindow = { fromExclusive, toInclusive }`）。`historyFill`、`unknown_cursor`、`gap_too_large` 都进这个函数，改这一处即可。
- 明确不改什么：不改 `consumeRewriteWindowFromHello` 在已有补洞时整份写下新的重写窗口（后到的重写 hello 仍带自己的 `dropFromSeq`）。不改没有在途补洞时的立即 `dropMirrorFromSeq`。不改 `clearStreamHelloAnchor` 清掉延迟窗口。不改 `aligned`，以及 `bootstrapResync` 里 `session_version` / `local_ahead`（这两支不调用 `maybeEmitHistoryFill`）。
- 本地验证：`scripts/test.sh --grep "later history fill keeps the deferred rewrite drop"`。在 `src/vs/platform/universeAgent/test/node/sessionActorReconnectHistoryRegen.test.ts` 新增：`armInFlightRewrite()` 返回后、`historyResult` 之前，再送一条 `planGapFromStreamHello` 为 `historyFill` 的 hello（`lastMutatedFromSeq` 等于当前 `seqCursor.lastMutatedFromSeq`，`headSeq` 大于 `lastAppliedSeq`，间隙不超过 `HISTORY_FILL_MAX_GAP`）。在途补洞成功后，时间线 id 仍与现有 `in-flight history fill keeps its id and defers the rewrite drop` 的最终结果相同（夹具里是 `item-3` 与 `item-4`，不含 `item-6`）。该已有测试保持通过。

## r12-4

- 问题类：事件流 hello 的 runtime epoch 从已有值前进时，尚未写出的 `permissionRespond` 被从待写队列清掉，这次点击没有可再点的待确认行。
- 反证：`failAllLocalPendingSends` 只遍历 `localPendingSends`；`local-fact.ts` 写明 `permissionRespond` 不进这张表。`onStreamHello` 在清空之后把 `lastStreamHello` 写成新 epoch。随后同一 epoch 的 `overlayPendingSnapshot` 在 `planOverlayPendingSetReplace` 里走 `apply`，可以装回待确认项，所以「待确认条永久消失」不成立。`clearPendingForRuntimeEpochChange` 本身不向引擎发取消或应答，不能据此说引擎仍停在原 `requestId`。`lastRuntimeEpoch` 的注释只说明该值在 hello 锚点清除、断线和 `openAttempt` 之后仍保留，没有把这次清空定义成「本地作废」。已有测试 `runtime epoch advance drops a regenerate that has not been submitted` 只断言未提交的 regenerate 被丢掉。已连接窗口的允许/拒绝走 `respondEnginePermission`，通常不会先进入 `pendingChatWrites`。本条只覆盖已经排进聊天臂队列的 `permissionRespond`。
- 不变量：epoch 前进仍清空其余 `pendingChatWrites`，仍对 `localPendingSends` 发 `SEND_FAILED_EPOCH_CHANGED`，仍对其余待确认项发 `removePendingAction`。已排队的 `permissionRespond` 不在新 epoch 上补 `chatStreamWrite`。这些 `requestId` 不在本轮被 `removePendingAction` 摘掉，留到随后 `planOverlayPendingSetReplace` 的 `apply` 按快照整表替换时再收。不新增 `ViewEffect.kind`。
- 要动的符号或文件：`clearPendingForRuntimeEpochChange`（`session-actor-stream-fold.ts`）。在 `pendingChatWrites.length = 0` 之前，收集 `payload` 为 `{ kind: 'permissionRespond', requestId }` 的 id，从本轮 `removes` 里滤掉。队列项本身仍然删除。
- 明确不改什么：不改 `tryAdvanceLastRuntimeEpoch` 的单调前进。不改 `onOverlayPendingSnapshot` 在 epoch 超前时调用同一清空函数（`clear_epoch_ahead`）。不改 regenerate 在 epoch 前进时被丢掉的行为。不改 `respondPermission`。不把权限决定塞进 `localPendingSends`。
- 本地验证：`scripts/test.sh --grep "epoch advance keeps a queued permission respond until the overlay snapshot"`。在 `sessionActorReconnectHistoryRegen.test.ts` 新增：租约与连接已起、聊天代际已有但尚未 `chatStreamUp`，快照里先有一条 `pendingActions`，再 `enqueue` 一条 `permissionRespond` 使其进入 `pendingChatWrites` 且没有 `chatStreamWrite`。然后 hello 的 `runtimeEpoch` 严格增大。断言该 `requestId` 仍在 `pendingActions`，`pendingChatWrites` 为空，仍无 `chatStreamWrite`。再送一条同一新 epoch 的 `overlayPendingSnapshot` 且 `pending` 不含该 id，断言该行被快照替换掉。已有 `runtime epoch advance drops a regenerate that has not been submitted` 保持通过。

## r12-5（hold）

- 问题类：客户端工具失败，且这次调用还挂在 MCP 认证请求上时，失败结果不会交给正在等的 SDK handler，这一轮停在工具调用上。
- 不变量：`handleClientToolCallComplete` 在 `!result.success` 且 `_cancelMcpAuthenticationForToolCall` 返回 true 时，仍然把这次失败 `respondOrBuffer` 进 `_pendingClientToolCalls`，再删活动工具。认证请求仍可标成 `cancelled`。不得在 `respondOrBuffer` 之前 `return`。
- 要动的符号或文件：`src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts` 的 `handleClientToolCallComplete`（约第 2022–2027 行）。失败分支已有的 `respondOrBuffer`（约第 2045 行）要能走到；认证取消只额外做取消，不代替失败回写。
- 明确不改什么：不改 `_cancelMcpAuthenticationForToolCall` 把空的认证请求标成 `cancelled`。不改成功分支的 `respondOrBuffer`。不改 `register(toolCallId)` 的等待方式。
- 本地验证：在 `copilotAgentSession.test.ts` 对已 `register` 的 toolCallId 走这条失败完成。当前断言若只看认证 promise 变成 `cancelled`，补上 handler 能取到失败文本。现状挂起或取不到失败文本；改后能取到。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r12-5 的 drop 与 HEAD 不符（认证取消后直接 return，失败没有 `respondOrBuffer`），已收回 hold。Minor：epoch 注释不再转述成「本地作废」；r12-2 先推 `permission_request` 再断言待确认行仍在。均已写入正文。

2026-09-30 第二轮只读审查。无新的 Critical / Important。

2026-09-30 用户签收。`accepted`。未实施。
