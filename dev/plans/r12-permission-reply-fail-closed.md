---
title: "聊天流缺失时权限回复不得假装成功"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "没有聊天流时权限回复返回拒绝并留下可再点的失败；后到的普通补洞继续并进已有重写丢弃范围；纪元前进清掉未写出的权限决定时同样留下可再点的失败。方案保持 draft。不升 PRD。"
---

# 聊天流缺失时权限回复不得假装成功

> **slice_id**：`r12-permission-reply-fail-closed`
> **来源**：[审查 r12](review-2026-09-30-r12-agent-host.md) 的 r12-2、r12-3、r12-4。行号作废，以当前代码为准。已签收全文在 [方案 r12](review-2026-09-30-r12-agent-host-plan.md)，本稿只补还没对齐审查方向的三处，不改那篇已签收正文。
> **本稿是方案，未签收。** 状态保持 `draft`。不升 PRD。不宣布 r12 或十六路审查完成。
> **冲突域**：`session-actor-local-fact.ts` 的 `onPermissionRespond`、`session-core.ts` 的聊天流关闭拒绝、`session-actor-stream-fold.ts` 的 `clearPendingForRuntimeEpochChange`、对应单测。
> **不改**：连接服务、`connect()`、`linkId`、`engineIdentityId`、能力快照、Preview、r10 proposed API、`respondEnginePermission`、`dev/loop/**`、`status.md`、`deferred-gaps.md`、`engine-protocol-surface.md`、槽 C。

## 0. 一句话结论

没有聊天流时，权限回复对调用方仍是失败，座位留下可再点的失败，待确认项不删。已经排进聊天臂、还没写到引擎的权限决定，在 runtime epoch 前进被清出队列时同样留下这种失败，不能一声不响丢掉。带 `dropFromSeq` 的延迟重写窗口继续并进后到的普通补洞，不整份换成只有起止序号的窗口。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `post` 在 `chatAttemptId === null` 时对 `submitInput` 与 `permissionRespond` 直接返回 `accepted: false`、`reason: chat_stream_closed`，事实不进 Actor | `session-core.ts` `postRejectWhenChatStreamClosed` |
| `onPermissionRespond` 在 `currentChatAttemptId === null` 时只打日志并 return。清理补丁和 `chatStreamWrite` 都在这次返回之后 | `session-actor-local-fact.ts` |
| 因此经 `post` 进来的拒绝不会给座位记失败。界面上的待确认项还在，但看起来像没点过 | 同上；`sessionViewHostChatClose.test.ts` 只断言拒绝与行还在 |
| 权限写失败的现成通道是 `pendingRespondFailed`。快照不变，座位显示错误，`retryable: true` 时允许再点。原因只承认 `hostWriteFailed` 或 `commandFailed` | `types.ts`；`onHostWriteReceipt`；`conversationConfirmationSeat.ts` |
| `emitSendFailureEffect` 是 `send_failed` 效果，给提交用。权限不是用户消息 | `session-actor-chat-outbox.ts` |
| `maybeEmitHistoryFill` 在延迟窗口已有 `dropFromSeq` 时取较宽起止序号，并保留 drop、hello 水位和 rewind。没有 drop 的窗口仍被整份替换 | `session-actor-stream-fold.ts` |
| 注释仍写后到窗口一律覆盖 | `session-actor-fold-interface.ts` `DeferredHistoryWindow` |
| 纪元前进会清空 `pendingChatWrites`。已排队的 `permissionRespond` 不从 `pendingActions` 摘掉，也不记失败。随后同一新 epoch 的空 `overlayPendingSnapshot` 会整表替换掉这一行 | `clearPendingForRuntimeEpochChange`；测试 `epoch advance keeps a queued permission respond until the overlay snapshot` |
| 这些排队项只出现在聊天流未就绪时：`enqueueOrWriteChat` 在流已就绪时直接写，不进队列 | `session-actor-chat-outbox.ts` |
| r12-1 与 `emitRegenerateSubmit` 已在代际为空时发 `SEND_FAILED_STREAM_CLOSED` | `onSubmitInput`、`emitRegenerateSubmit`。不重做 |

## 2. 合同

### r12-2 没有聊天流的权限回复

1. `chatAttemptId === null` 时，`post` 的 `permissionRespond` 仍返回 `accepted: false`、`reason: chat_stream_closed`。不把成功交回调用方。不发 `chatStreamWrite`。不执行 `permissionRespondCleanupPatches`，待确认项留在快照里。
2. 同一次拒绝要让 Actor 记下可再点的失败：`pendingRespondFailed`，`cause: hostWriteFailed`，`retryable: true`，`error: chat_send_stream_closed`。不新增原因字面量，不新增 `ViewEffect.kind`。不调用 `emitSendFailureEffect`，也不往时间线画 `send_failed` 用户气泡。
3. 这条事实不进邮箱。`post` 在返回拒绝之前直接走 `onPermissionRespond` 的无流分支，避免这次拒绝把已经排在邮箱里的其它意图留在队列里不 drain。`onPermissionRespond` 自己在 `currentChatAttemptId === null` 时做同一件事，直接 `enqueue` 的测试路径也覆盖到。
4. `submitInput` 的拒绝仍停在 `post` 之外，不改成进 Actor。r12-1 不重做。

### r12-3 延迟重写窗口

1. 算法不改。已有 `dropFromSeq` 的 `deferredHistoryWindow` 被后到的普通 `historyFill` / `unknown_cursor` / `gap_too_large` 再写入时，保留 `dropFromSeq`、`helloLastMutatedFromSeq`、`rewindLastAppliedSeq`。`fromExclusive` 取较小值，`toInclusive` 取较大值。
2. 没有 drop 的延迟窗口仍被后到窗口整份替换。后到的重写 hello 仍整份写下自己的 `dropFromSeq`。
3. 注释改成与上述行为一致，不再写「后到窗口一律覆盖」。

### r12-4 纪元前进清掉未写出的权限决定

1. `clearPendingForRuntimeEpochChange` 仍清空整个 `pendingChatWrites`，仍不在新 epoch 上补写这些 `permissionRespond`。仍对其余待确认项发 `removePendingAction`。仍对 `localPendingSends` 发 `SEND_FAILED_EPOCH_CHANGED`。仍丢掉未提交的 regenerate。
2. 清队列之前，凡 payload 为 `{ kind: 'permissionRespond', requestId }` 的 id：不在本轮 `removePendingAction` 里摘掉；另发一条 `pendingRespondFailed`，`cause: hostWriteFailed`，`retryable: true`，`error: chat_send_epoch_changed`。同样不发 `send_failed` 用户气泡。
3. 这些 id 当时能留在队列里，就是聊天流还没就绪。不另造「流已就绪但仍在队列」的静默分支。
4. 随后同一新 epoch 的 `overlayPendingSnapshot` 若不再包含该 id，仍按整表替换收起。新快照是待确认集合的权威。失败留在清队列这一下，不是把旧请求永远钉在界面上。

## 3. 明确不做

- 不改 `respondEnginePermission`、连接为真时的一元 `Respond`、`closeChatStream` 里那次 `pendingChatWrites.length = 0`。关流本身不摘待确认项；下一次在代际为空时的回复走 r12-2。本切片不把关流改成另一套失败。
- 不改 `consumeRewriteWindowFromHello` 在已有补洞时整份写下新的重写窗口。不改 `clearStreamHelloAnchor` 清掉延迟窗口。
- 不改 r12-5，不改能力快照、Preview、proposed API、连接服务。
- 不把已签收的方案 r12 改成 `implemented`。

## 4. 验证

Node 单测，先在槽 B 执行 `flock /tmp/vscode-loop-compile.lock npm run compile-client`。锁被占用时不抢，只跑下面的切片，并写明编译进行中。

- `node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/sessionActorReconnectHistoryRegen.test.ts`
- `node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/sessionViewHostChatClose.test.ts`

断言：

- 聊天代际为空时 `permissionRespond`：`post` 为 `accepted: false` / `chat_stream_closed`；快照仍有该 `requestId`；帧里有 `pendingRespondFailed` 且 `retryable === true`、`error === chat_send_stream_closed`；没有 `chatStreamWrite`；没有 `send_failed` 效果，时间线不新增这条失败码的用户气泡。
- 纪元前进时，已排队且尚未 `chatStreamUp` 的 `permissionRespond`：该行仍在 `pendingActions`，队列为空，没有 `chatStreamWrite`，帧里有 `pendingRespondFailed` 且 `error === chat_send_epoch_changed`。随后同一新 epoch 的空快照仍把该行替换掉。既有「未提交的 regenerate 被丢掉」保持通过。
- 后到的普通 history fill：延迟窗口在补洞结束前仍是 `dropFromSeq === 5`、`fromExclusive === 4`、`toInclusive === 22`，并保留 hello 水位与 rewind。既有最终时间线断言保持通过。

## 5. 只读自审

本稿写完后在同一会话内自审。没有另开只读 reviewer。因此状态保持 `draft`，不标可签收。实施按本节核对后的合同全文做，不收窄。

- 只改 `onPermissionRespond` 而不改 `post`，调用方仍然在进 Actor 之前就收到拒绝，座位还是没有失败。合同要求拒绝返回和失败补丁发生在同一次 `post` 里。
- 把事实先 `enqueue` 再返回拒绝，会在 `postAndDrain` 因 `accepted === false` 而不取意图时，把这次 drain 产生的意图留在队列里。合同改为直接调用无流分支，不进邮箱。
- 给 `pendingRespondFailed` 加新的 `cause` 要改准入和折叠。现成通道只认 `hostWriteFailed` 与 `commandFailed`。合同复用 `hostWriteFailed`，用已有错误码区分「流没开」和「纪元变了」。
- `send_failed` 效果不是权限座位的失败通道。合同禁止用它画出用户气泡。
- 纪元清空后若禁止随后的空快照收起这一行，新 epoch 已经不再挂起的请求会永远留在界面上。合同只保证清队列当时留下可再点失败。
- r12-3 的合并已经在 `maybeEmitHistoryFill`。重写一遍没有新行为。合同只锁窗口字段并改正过时注释。
