---
title: "审查 r04：agent-host-rest"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；取消后的 Copilot 发送和工具批准仍会执行，Claude 换绑会把旧流写进新回合，没有完成事件的工具在历史里写成成功。"
---
# 审查 r04：agent-host-rest

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r04-1 高

- 症状：取消发生在真正 `session.send` 之前时，被取消的提示仍会启动，响应和工具写回该回合。
- 位置：`src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts` 第 2547–2562 行
- 引用：

```
2547:2562:src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts
		const sdkAttachments = await this._toSdkAttachments(attachments);

		await this._prepareSdkTurn(mode);
		const traceContext = this._otelService.getSessionTraceContext(this.sessionId, this.resourceUri.toString());
		const sendingTurn = this._currentTurn.value;
		sendingTurn?.markProviderCallPending();
		try {
			await this._otelService.withTraceContext(traceContext, () => {
				if (!this._environmentService.isBuilt && prompt === '$error') {
					return this._wrapper.session.rpc.sendMessages({
						messages: [{ prompt }],
						requestHeaders: { Authorization: '******' },
					});
				}
				return this._wrapper.session.send({ prompt, attachments: sdkAttachments?.length ? sdkAttachments : undefined });
			});
```

- 为什么是问题：`_send` 在 2413 行抓住 `abortToken`，注释写明取消带来的 `session.idle` 会把活动 token 换成新的。2547 行之后的附件转换和 `_prepareSdkTurn` 都在 `session.send` 之前。`abort()` 在 3026–3040 行对当前回合置 `_dropLateRootTurnEvents` 并调用 `session.abort()`，碰不到还停在预检里的这次发送；预检结束后 2554–2561 行仍调用 `session.send`。同一取消若赶上回合还是 `pending`，4883–4895 行把回合留着；随后该提示自己的 `user.message` 在 4364–4366 行清掉隔离并 `markRunning`，模型输出和工具结果写回这个已取消的回合。2719–2722 行的 fleet 预检会用抓住的 token 放弃启动。`resume()` 在 2581–2583 行同样在 `_prepareSdkTurn` 之后无条件 `sendMessages`。宿主在 1720 与 1724 行检查已取消回合，这两次检查都在进入 provider 的 `sendMessage` 之前，盖不住这段预检。协议层在回合结束后会丢掉后续 part，SDK 侧工具仍会执行。
- 方向：预检结束时若这次发送已取消，跳过 `session.send`，并丢掉仍为 pending 的该回合。

## r04-2 高

- 症状：回合已取消、activeTurn 清空后，迟到的工具确认仍可能被自动批准并执行。
- 位置：`src/vs/platform/agentHost/node/agentSideEffects.ts` 第 1267–1305 行
- 引用：

```
1267:1305:src/vs/platform/agentHost/node/agentSideEffects.ts
		const part = this._stateManager.getSessionState(sessionKey)?.activeTurn?.responseParts.find(part => part.kind === ResponsePartKind.ToolCall && part.toolCall.toolCallId === e.state.toolCallId);
		const toolCall = part?.kind === ResponsePartKind.ToolCall ? part.toolCall : undefined;
		if (toolCall
			&& toolCall.status !== ToolCallStatus.Streaming
			&& toolCall.status !== ToolCallStatus.Running
			&& toolCall.status !== ToolCallStatus.PendingConfirmation) {
			const toolCallKey = `${sessionKey}:${e.state.toolCallId}`;
			this._toolCallAgents.delete(toolCallKey);
			this._managedApprovalToolCalls.delete(toolCallKey);
			this._logService.trace(`[AgentSideEffects] Dropping stale tool ready for ${e.state.toolCallId}: status=${toolCall.status}`);
			return;
		}
		const contributor = e.state.contributor ?? toolCall?.contributor;
		let effective = e;
		const toolCallKey = `${sessionKey}:${e.state.toolCallId}`;
		if (forbiddenSnapshotWrite) {
			// Hard-deny: the model tried to edit a read-only attachment snapshot. Refusing lets the
			// model recover (e.g. reply with the transformed content / edit the real file) instead of
			// silently mutating the throwaway copy.
			this._logService.warn(`[AgentSideEffects] Denying write to read-only attachment snapshot: toolCallId=${e.state.toolCallId}`);
			this._toolCallAgents.delete(toolCallKey);
			this._managedApprovalToolCalls.delete(toolCallKey);
			agent.respondToPermissionRequest(e.state.toolCallId, false);
			return;
		}
		if (e.managedApprovalRequired) {
			this._managedApprovalToolCalls.add(toolCallKey);
		} else {
			this._managedApprovalToolCalls.delete(toolCallKey);
		}
		const clientShouldAutoApprove = autoApproval !== undefined
			&& contributor?.kind === ToolCallContributorKind.Client
			&& !!e.state.confirmationTitle;
		if (clientShouldAutoApprove) {
			this._toolCallAgents.set(toolCallKey, agent.id);
			effective = { ...e, state: { ...e.state, _meta: { ...toolCall?._meta, ...e.state._meta, ...toToolCallMeta({ autoApproveBySetting: true }) } } };
		} else if (autoApproval !== undefined) {
			this._toolCallAgents.delete(toolCallKey);
			agent.respondToPermissionRequest(e.state.toolCallId, true);
```

- 为什么是问题：1269–1278 行只有在 activeTurn 里找到工具调用、且状态已结束时才丢弃。`ChatTurnCancelled` 经 endTurn 清掉 activeTurn 后，`toolCall` 为 undefined，丢弃不发生。692–695 行在没有活动回合时仍进入 `_handleToolReady`，注释写明这是为了回合完成后的 hook 续跑。1303–1305 行在 `getAutoApproval` 给出理由时 `respondToPermissionRequest(toolCallId, true)`，SDK 执行该工具。340–346 行记下的已取消 turn id 只在 700 行丢掉 `ChatTurnComplete`。
- 方向：确认属于已取消回合时直接拒绝；找不到活动工具调用时不要自动批准，hook 续跑仍可走无活动回合这条路径。

## r04-3 高

- 症状：取消后的 idle 换新 abort token，随后的沙箱 shell 权限请求仍直接批准执行。
- 位置：`src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts` 第 3492–3499 行
- 引用：

```
3492:3499:src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts
			if (!managedApprovalRequired && !this._launchPlan.hasScopedEditSurface && isShellRequest && !requestSandboxBypass && await this._isShellSandboxedByDefault()) {
				// Session may have been disposed while we awaited the engine
				// check; if so the deferred has already been settled and
				// removed, so leave it alone.
				if (this._pendingPermissions.has(toolCallId)) {
					this._pendingPermissions.respond(toolCallId, { kind: 'approve-once' });
					this._logService.info(`[Copilot:${this.sessionId}] Auto-approving sandboxed shell command for tool call ${toolCallId}`);
					return { kind: 'approve-once' };
```

- 为什么是问题：权限回调在 2133 行包进 `_guarded`，1903–1906 行只在进入时看当前 token。`onIdle` 在拆回合之前的 4860–4862 行对 aborted idle 调用 `_resetAbortToken()`，此后的权限回调不再被丢掉。3492–3499 行不读 `_dropLateRootTurnEvents`，shell 被判定为默认在沙箱内、且没有要求绕过沙箱时返回 `approve-once`。`buildSandboxConfigForSdk` 在 170 行设置 `addCurrentWorkingDirectory: true`，这条命令仍可写工作目录。用户已经取消，命令仍会跑。
- 方向：abort token 保持取消直到迟到权限回调结束，沙箱自动批准也服从这次取消。

## r04-4 中

- 症状：Claude 换绑后，旧 query 上尚未结束的消息会按新回合的 turnId 写回。
- 位置：`src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts` 第 695–716 行
- 引用：

```
695:716:src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts
			for await (const message of query) {
				if (this._abortController.signal.aborted) {
					throw new CancellationError();
				}
				if (message.type === 'system' && message.subtype === 'init') {
					// Capture the loaded native-plugin list on every init (incl.
					// resume / post-rebind) so the post-materialize filter is fresh.
					this._initPlugins = message.plugins ?? [];
					if (!this._isResumed) {
						this._isResumed = true;
					}
				}
				const parent = this._queue.peekParent();
				const turnId = parent?.turnId;
				const clientContext = parent?.clientContext;
				const turnDuration = parent?.stopWatch.elapsed();
				try {
					await this._router.handle(message, turnId, {
						turnDuration,
						mode: this._currentPermissionMode,
						clientContext,
					});
```

- 为什么是问题：循环在 690 行抓住当时的 `query`，696 行检查的是可变的 `this._abortController`。`_rebindQuery` 在 632 行装上尚未取消的 placeholder，660 行再换成新 controller，657 行不等旧 warm dispose 结束。`send` 在重绑定返回后才把新提示推进队列。旧循环再读到一条消息时，708–716 行用 `peekParent()` 的新 turnId 交给 router；router 在 74–89 行于 turnId 有值时发出协议信号。748–749 行对换过 query 的安静返回只发生在迭代结束之后。旧回答和工具结果出现在新回合，旧 `result` 还可能把新回合标成 `ChatTurnComplete`。
- 方向：消费循环绑定启动时的 abort controller 与 query 代际，换绑后不要把旧流消息派给新队列头。

## r04-5 中

- 症状：历史重建把没有 `execution_complete` 的工具调用写成成功完成。
- 位置：`src/vs/platform/agentHost/node/copilot/mapSessionEvents.ts` 第 823–825 行
- 引用：

```
823:825:src/vs/platform/agentHost/node/copilot/mapSessionEvents.ts
			builder.responseParts.push(makeCompletedToolCallPart(
				completion ?? { toolCallId: request.toolCallId, success: true },
				info,
```

- 为什么是问题：第一遍只在 357–358 行的 `tool.execution_complete` 上填写 `completionsByCallId`。第二遍遇到 `assistant.message` 里的 toolRequests 时，797–802 行仅当完成记录和 toolInfo 都在才跳过。中断、只有 tool request 或只有 start、没有 complete 时，823–825 行用 `{ success: true }` 合成完成对象。`makeCompletedToolCallPart` 在 996–1005 行把状态写成 `ToolCallStatus.Completed`，`success` 取 `d.success`。恢复出来的记录显示这条工具已经成功跑完。
- 方向：没有完成事件时不要标成成功完成。
