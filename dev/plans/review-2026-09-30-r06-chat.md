---
title: "审查 r06：chat"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "chat 在编辑队列、本地重发、后台工具确认、回合恢复和队列出队上会丢消息或跳过确认。"
---

# 发现

## r06-1 高
- 症状：编辑队列或 steering 里的消息并提交后，若这次发送随后被中止，该消息从队列消失，默认行内编辑器里的正文也没了。
- 位置：`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts` 第 3243–3265 行
- 引用：

```3243:3265:src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts
			const editingPendingRequest = this.viewModel.editing!.pendingKind;
			if (editingPendingRequest !== undefined) {
				const editingRequestId = this.viewModel.editing!.id;
				this.chatService.removePendingRequest(this.viewModel.sessionResource, editingRequestId);
				if (!options.cancelCurrentRequest) {
					options.queue ??= editingPendingRequest;
				}
			} else {
				await this.chatService.cancelCurrentRequestForSession(this.viewModel.sessionResource, 'acceptInput-editing');
				if (!stillOn(capturedSession)) {
					return;
				}
				cancelledCurrentRequest = true;
				options.queue = undefined;
			}

			// For agents that support checkpoints, preserve the checkpoint
			// through finishedEditing so blocked requests are removed below
			// and the agent host can dispatch a protocol truncation action.
			const preserveCheckpoint = this._lockedAgent && !!this._attachmentCapabilities.supportsCheckpoints;
			if (preserveCheckpoint) {
				this.recentlyRestoredCheckpoint = true;
			}
			this.finishedEditing(true);
```

- 为什么是问题：`chat.editRequests` 默认是 `inline`。提交编辑时先 `removePendingRequest`，再 `finishedEditing(true)`。非 `input` 模式会在第 2339–2356 行卸掉行内编辑器并 `this.input.dispose()`，正文只活在这个编辑器里。底栏输入在发送成功后才于第 3439 行清空，失败路径不会把它填回去。此后仍有多处直接 `return`：提示词元数据把发送中止（第 3310–3314 行，例如用户取消模式切换）、目录附件解析期间会话已经换掉（第 3367–3369 行）、`sendRequest` 被拒绝（第 3418–3428 行，空消息、只读会话、没有默认 agent）。这些路径都不再把消息放回队列。
- 方向：发送被接受之前保留队列项和行内编辑文本，失败时按原队列种类放回。

## r06-2 中
- 症状：在未锁定到带检查点的 agent host 的本地会话里，编辑一条已发出的请求再提交，这条请求和它后面的回合都还在，新消息只是追加在末尾。
- 位置：`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts` 第 3258–3268 行
- 引用：

```3258:3268:src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts
			// For agents that support checkpoints, preserve the checkpoint
			// through finishedEditing so blocked requests are removed below
			// and the agent host can dispatch a protocol truncation action.
			const preserveCheckpoint = this._lockedAgent && !!this._attachmentCapabilities.supportsCheckpoints;
			if (preserveCheckpoint) {
				this.recentlyRestoredCheckpoint = true;
			}
			this.finishedEditing(true);
			if (!preserveCheckpoint) {
				this.viewModel.model?.setCheckpoint(undefined);
			}
```

- 为什么是问题：点进某条请求编辑时，第 2143 行 `setCheckpoint` 会把该条及之后的请求标成 blocked（`chatModel.ts` 第 3102–3105 行）。真正删掉它们的循环只在检查点还在时运行（第 3355–3363 行）。本地会话 `_lockedAgent` 为空，`preserveCheckpoint` 为假。`finishedEditing` 在 `recentlyRestoredCheckpoint` 为假时于第 2327–2330 行调用 `setCheckpoint(undefined)`，这会按 `chatModel.ts` 第 3097–3100 行把所有请求解除 blocked。第 3266–3268 行再清一次。即便编辑前已经有检查点（第 2138–2140 行把标志设为真，`finishedEditing` 因此不清理），第 3266–3268 行仍会清掉。删除循环看不到检查点，旧回合留在记录里，模型会同时看到原对话和这条“编辑后”的新消息。编辑过程中那些回合会显示为禁用，提交后恢复成正常历史。
- 方向：本地提交编辑时保持检查点，直到第 3355 行的删除循环跑完。

## r06-3 高
- 症状：一个仍在跑工具的会话被换走、界面上不再有对应的聊天部件时，后续工具确认会按当前焦点聊天的权限处理。焦点若是自动批准或 Autopilot，这个后台会话里本该询问的工具会直接执行。
- 位置：`src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts` 第 1298–1314 行
- 引用：

```1298:1314:src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts
	private _isSessionLiveAutoApproveLevel(chatSessionResource: URI): boolean {
		const widget = this._chatWidgetService.getWidgetBySessionResource(chatSessionResource)
			?? this._chatWidgetService.lastFocusedWidget;
		return !!widget && isAutoApproveLevel(widget.input.currentModeInfo.permissionLevel);
	}

	/**
	 * True if the session is in an auto-approve level (Auto-Approve / Autopilot),
	 * via either the last request's stamped level or the live picker level.
	 */
	private _isSessionInAutoApproveLevel(chatSessionResource: URI | undefined): boolean {
		if (!chatSessionResource) {
			return false;
		}
		const model = this._chatService.getSession(chatSessionResource);
		const request = model?.getRequests().at(-1);
		return isAutoApproveLevel(request?.modeInfo?.permissionLevel) || this._isSessionLiveAutoApproveLevel(chatSessionResource);
```

- 为什么是问题：`shouldAutoConfirm` 第 1392–1395 行在 `_isSessionInAutoApproveLevel` 为真时返回 `ConfirmationNotNeeded` 并带上全量自动批准原因，工具不再弹出确认。`ChatWidget.setModel`（第 2667–2674 行）切换会话时只结束编辑，不取消原会话正在进行的请求。部件换走后，`chatWidgetService.ts` 第 294–296 行确认旧会话已没有任何部件。此时 `getWidgetBySessionResource` 为空，确认级别落到 `lastFocusedWidget`，也就是当前打开的另一个聊天的权限选择。后台会话自己的请求若是默认权限，只要焦点聊天是自动批准或 Autopilot，后台会话的工具调用就会跳过确认。
- 方向：会话没有自己的部件时只采用该请求上已记录的权限，不要读另一个聊天的选择器。

## r06-4 中
- 症状：Agent host 把一个已经出现过、且不是模型里最后一条的回合重新激活后，这个回合上的工具调用会被取消，工具不执行，结果也不会回到该回合。
- 位置：`src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts` 第 495–500 行
- 引用：

```495:500:src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts
		if (dto.context?.sessionResource) {
			model = this._chatService.getSession(dto.context.sessionResource);
			request = model?.getRequests().at(-1);
			if (request?.response?.isCanceled || request?.response?.isComplete) {
				this._logService.debug(`[LanguageModelToolsService#invokeTool] Ignoring tool ${dto.toolId} for cancelled/complete request ${request.id}`);
				throw new CancellationError();
```

- 为什么是问题：`beginToolCall` 第 1136–1139 行会按 `chatRequestId` 找到对应请求。`invokeTool` 忽略 `dto.chatRequestId`，只取最后一条。`agentHostSessionHandler.ts` 第 2370、2410 行在活动回合 id 已经见过时带 `resume: true` 调用 `startServerRequest`。`chatServiceImpl.ts` 第 997–1006 行按 id 找到那条请求并 `reopen()`，不把它移到末尾。后面若还有已完成的回合，最后一条的 `isComplete` 为真，这次 `invokeTool` 在执行前抛出 `CancellationError`。被恢复回合上的工具结果因此被丢掉。
- 方向：`invokeTool` 与 `beginToolCall` 一样先按 `chatRequestId` 绑定请求，只在没有该 id 时才退回最后一条。

## r06-5 中
- 症状：本地会话里排在队列中的消息，在当前请求结束后出队；若这时没有默认 agent，或几条 steering 合并解析失败，这些消息从队列消失并且不会发出。
- 位置：`src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts` 第 2008–2056 行
- 引用：

```2008:2056:src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts
		const steeringRequests = model.dequeueAllSteeringRequests();

		// Then dequeue a single non-steering request if no steering was found
		const nextQueued = steeringRequests.length === 0 ? model.dequeuePendingRequest() : undefined;

		const allRequests = steeringRequests.length > 0 ? steeringRequests : (nextQueued ? [nextQueued] : []);
		if (allRequests.length === 0) {
			return;
		}

		this.trace('processNextPendingRequest', `Processing ${allRequests.length} queued request(s) for session ${model.sessionResource}`);

		// Collect and remove all deferreds
		const deferreds: DeferredPromise<ChatSendResult>[] = [];
		for (const req of allRequests) {
			const deferred = this._queuedRequestDeferreds.get(req.request.id);
			this._queuedRequestDeferreds.delete(req.request.id);
			if (deferred) {
				deferreds.push(deferred);
			}
		}

		// Build send options from the first request, combining attachments from all
		const firstRequest = allRequests[0];

		// Preserve terminal correlation only when all merged requests agree on the
		// same terminal. With subagents, multiple terminals can queue steering
		// requests simultaneously — picking one arbitrarily would misattribute the
		// notification, so we drop the ID when they conflict.
		const terminalIds = new Set(allRequests.map(req => req.sendOptions.terminalExecutionId).filter((id): id is string => !!id));
		if (terminalIds.size > 1) {
			this.info('processNextPendingRequest', `Dropping terminalExecutionId: ${terminalIds.size} conflicting terminal IDs (${[...terminalIds].join(', ')})`);
		}
		const mergedTerminalExecutionId = terminalIds.size === 1 ? [...terminalIds][0] : undefined;

		const sendOptions: IChatSendRequestOptions = {
			...firstRequest.sendOptions,
			terminalExecutionId: mergedTerminalExecutionId,
			attachedContext: allRequests.flatMap(req => req.request.variableData.variables.slice()),
		};

		const location = sendOptions.location ?? sendOptions.locationData?.type ?? model.initialLocation;
		const defaultAgent = this.chatAgentService.getDefaultAgent(location, sendOptions.modeInfo?.kind);
		if (!defaultAgent) {
			this.logService.warn('processNextPendingRequest', `No default agent for location ${location}`);
			for (const deferred of deferreds) {
				deferred.complete({ kind: 'rejected', reason: 'No default agent available' });
			}
			return;
```

- 为什么是问题：出队发生在默认 agent 检查之前。该 location 与 mode 没有已激活的默认 agent 时，函数只把 deferred 标成拒绝并返回，没有 `addPendingRequest` 把原文放回队列。合并多条 steering 时，第 2074–2080 行解析抛错走同一条路。入队时输入框已经清空，拒绝后界面上队列气泡消失，消息不在记录里。Agent host 会话在第 2003 行提前返回，这条路径只影响本地队列。
- 方向：默认 agent 缺失或解析失败时，按原顺序把已出队的消息放回队列。
