---
title: "审查 r12：agent-host"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "聊天流已关但连接仍在时，已接受的用户消息和权限决定会被丢掉；并发 hello 还会让重写后的历史停在旧内容上。"
---

# 发现

## r12-1 高
- 症状：邮箱溢出或会话已关闭之后，引擎连接还在，用户再发一条消息会得到 accepted，但这条正文不会进入队列、不会出现在时间线，也没有发送失败提示。
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts` 第 166–172 行
- 引用：
```
		if (this.currentChatAttemptId === null) {
			this.deps.diagnostics.warn('submitInput without chat stream', {
				sessionId: this.sessionId,
				correlation: fact.correlation,
			})
			return
		}
```
- 为什么是问题：`failClosedOverflow`（`session-actor.ts` 第 544–551 行）和 `sessionClosed` / `sessionPurged`（`session-actor-overlay-fold.ts` 第 197、217 行）都会 `closeChatStream`，把 `currentChatAttemptId` 置空，同时 `connectionUp` 保持为真。随后的 `chatStreamDown` 在第 53–58 行被当成过期回调直接返回，同一租约不会再 `ensureChatStream`。`SessionViewHost.post`（第 410–416 行）只看引擎是否已连接，`session-core.ts` 第 125–132 行只在 `connectionUp` 为假时拒绝。乐观气泡和 `send_failed` 都写在这次提前返回之后，所以调用方以为发送成功，正文已经不在。
- 方向：聊天流代际为空时要把这次提交记成发送失败并退回 accepted，而不是只打诊断日志。

## r12-2 中
- 症状：同一窗口里用户点允许或拒绝，接口同样返回 accepted，决定不会写到引擎，待确认条也不消失，这次点击等于没发生。
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts` 第 285–292 行
- 引用：
```
		if (this.currentChatAttemptId === null) {
			this.deps.diagnostics.warn('permissionRespond without chat stream', {
				sessionId: this.sessionId,
				requestId: fact.requestId,
				decision: fact.decision,
			})
			return
		}
```
- 为什么是问题：权限回复走和 r12-1 相同的入口：连接仍在时 `post` 接受事实，Actor 在 `currentChatAttemptId === null` 时返回。清理补丁和聊天写入都在这次返回之后，待确认项留在快照里，引擎继续等原来的 `requestId`。
- 方向：没有聊天流时退回这次权限回复并保留可再点的失败状态，避免把 accepted 回给调用方。

## r12-3 中
- 症状：历史补洞还在飞的时候，先到一条重写窗口 hello，接着又来一条普通补洞或 bootstrap hello，界面会留下重写前的旧消息，重写掉的那一段也不会按原窗口再拉。
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts` 第 576–579 行
- 引用：
```
		if (this.pendingHistoryRequestId !== null) {
			// One fill in flight. Keep its id; remember only the latest window.
			this.deferredHistoryWindow = { fromExclusive, toInclusive }
			return false
```
- 为什么是问题：补洞进行中，`consumeRewriteWindowFromHello`（第 451–458 行）把带 `dropFromSeq` 的窗口放进 `deferredHistoryWindow`。之后的 `historyFill`（第 436–437 行）、`unknown_cursor`（第 432–433 行）或 `gap_too_large`（第 543 行）都会再进 `maybeEmitHistoryFill`，用只有起止序号的对象盖掉那份延迟窗口。当前补洞结束后 `pumpDeferredHistoryWindow`（第 605–609 行）只在 `dropFromSeq` 仍在时才删时间线，旧行因此留着。
- 方向：已有延迟重写窗口时，后到的 hello 要并进同一份 drop 范围，不能整份换成普通补洞。

## r12-4 中
- 症状：聊天流还没就绪、允许/拒绝已经进了待写队列时，事件流 hello 的 runtime epoch 往前走，这次决定被清掉，界面上的待确认项一并消失，没有失败提示，引擎仍停在等待确认。
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts` 第 559–568 行
- 引用：
```
		this.pendingChatWrites.length = 0
		this.inflightCleanups.clear()
		const removes: ViewPatch[] = this.snapshot.pendingActions.map((a) => ({
			op: 'removePendingAction' as const,
			requestId: a.requestId,
		}))
		if (removes.length > 0) {
			this.foldAndBroadcastPatches(removes)
		}
		this.failAllLocalPendingSends(SEND_FAILED_EPOCH_CHANGED)
```
- 为什么是问题：`onStreamHello` 在 epoch 从已有值前进时（第 380–381 行）调用这里。`pendingChatWrites` 被清空，其中包含尚未写出的 `permissionRespond`。`failAllLocalPendingSends` 只给提交类的 `localPendingSends` 发失败；权限决定不在那张表里。同时所有 `pendingActions` 被移除，用户不能再点一次。
- 方向：epoch 切换时把已排队的权限决定标成可重试失败并留下待确认项，确认新快照到达后再收起。

## r12-5 中
- 症状：客户端工具失败，且这次调用还挂在 MCP 认证请求上时，失败结果不会交给正在等的 SDK handler，这一轮停在工具调用上，直到会话结束才被取消。
- 位置：`src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts` 第 2022–2027 行
- 引用：
```
	handleClientToolCallComplete(toolCallId: string, result: ToolCallResult) {
		this._approvedDuplicablePermissionSignatures.delete(toolCallId);
		if (!result.success && this._cancelMcpAuthenticationForToolCall(toolCallId)) {
			this._activeToolCalls.delete(toolCallId);
			return;
		}
```
- 为什么是问题：客户端工具 handler 在第 1865–1867 行 `register(toolCallId)` 后一直等到 `session/toolCallComplete`。完成回调若因失败走进 `_cancelMcpAuthenticationForToolCall`（第 2060–2071 行，命中就返回 true），就删掉活动工具并返回，不会 `respondOrBuffer`。认证请求被标成 cancelled，等结果的 handler 没有失败文本，也没有缓冲供稍后注册的 handler 取走。
- 方向：取消 MCP 认证之后仍要把这次工具失败写回 `_pendingClientToolCalls`。
