---
title: "审查 r03：agent-host-codex"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；过期 turn 会写回并清掉当前 turn，已终止的批准仍会放行，附加权限随允许原样授予，分叉或截断留住同一 turn 的后续内容，失败或未结束的 turn 被记成成功。"
---

## r03-1 高

- 症状：上一个 app-server turn 的 `turn/started` 或 `turn/completed` 到达时，如果 `sendMessage` 已经把 `currentTurnId` 换成新的 host turn，旧通知会改写这条新 turn 的映射，发出完成或取消，并清掉它的工具跟踪。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 2846–2890 行
- 引用：

```2846:2890:src/vs/platform/agentHost/node/codex/codexAgent.ts
	private _withHostTurn<T extends { readonly turn: { readonly id: string } }>(session: ICodexSession, params: T): T {
		const appTurnId = params.turn.id;
		const hostTurnId = session.currentTurnId ?? this._hostTurnId(session, appTurnId);
		session.hostTurnIdByAppTurnId.set(appTurnId, hostTurnId);
		session.currentAppTurnId = appTurnId;
		return hostTurnId === appTurnId ? params : { ...params, turn: { ...params.turn, id: hostTurnId } };
	}

	private _handleTurnStartedNotification(session: ICodexSession, params: TurnStartedNotification): (SessionAction | ChatAction)[] {
		// The workbench already dispatched the canonical turn start before sendMessage.
		// Codex's event only establishes app-server turn id correlation for later items.
		const appTurnId = params.turn.id;
		const mapped = this._withHostTurn(session, params);
		this._persistTurnEventId(session, mapped.turn.id, appTurnId);
		mapTurnStarted(session.mapState, mapped, session.lastPromptText);
		return [];
	}

	private _persistTurnEventId(session: ICodexSession, hostTurnId: string, appTurnId: string): void {
		// Copilot already records this bridge, while Claude reuses the host turn id as its transcript uuid.
		const storage = session.chatChannel ? chatStorageUri(session.chatChannel) : undefined;
		if (!storage) {
			return;
		}
		const ref = this._sessionDataService.openDatabase(storage);
		ref.object.setTurnEventId(hostTurnId, appTurnId).catch(error => {
			this._logService.warn(`[Codex:${session.threadId}] Failed to persist turn id mapping ${hostTurnId} -> ${appTurnId}`, error);
		}).finally(() => ref.dispose());
	}

	private _handleTurnCompletedNotification(session: ICodexSession, params: TurnCompletedNotification): (SessionAction | ChatAction)[] {
		const appTurnId = params.turn.id;
		const hostTurnId = this._hostTurnId(session, appTurnId);
		const out = mapTurnCompleted(session.mapState, this._withHostTurn(session, params), this._clearTurnStopWatch(session));
		// Remember which codex (app-server) turn each workbench turn maps to so
		// truncateChat can translate a host turn id to a thread rollback even
		// after the live correlation below is cleared.
		session.codexTurnIdByHostTurnId.set(hostTurnId, appTurnId);
		// Codex reports app-server turn ids, while the workbench owns host turn ids.
		// Clear the correlation after completion so later turns cannot reuse stale ids.
		if (session.currentAppTurnId === appTurnId || session.currentTurnId === hostTurnId) {
			session.currentTurnId = undefined;
			session.currentAppTurnId = undefined;
		}
		session.hostTurnIdByAppTurnId.delete(appTurnId);
```

- 为什么是问题：`_withHostTurn` 在 `currentTurnId` 有值时忽略该 app turn 已有的映射，并把 `currentAppTurnId` 写成这条通知的 app turn。完成处理紧接着用这个刚写上的值做相等判断，于是任何迟到的 `turn/completed` 都会清空当前 host turn。`/compact` 在 `thread/compact/start` 返回后就结束（第 5541–5554 行），普通发送也在 `turn/start` 返回前就把 `currentTurnId` 设成新 id（第 5566 行），两条路径都不等待上一个 app turn 的 `turn/completed`。旧完成通知经过 `mapTurnCompleted`（`codexMapAppServerEvents.ts` 第 1232–1254 行）后，会把完成、取消或错误记到新 turn 上，并把它尚未结束的工具收成失败。旧 `turn/started` 还会调用 `mapTurnStarted`（第 428–429 行），`resetCodexTurnMapState`（第 165–172 行）直接丢掉新 turn 的 item 映射和未刷出的 preflight。
- 方向：只有通知的 app turn 就是当前 app turn 时，才复用 `currentTurnId` 并清空它。

## r03-2 高

- 症状：turn 被中断、完成，或被 steering 接管之后，命令、文件和权限批准仍停在原来的 deferred 上；之后的允许仍会返回给 app-server，尽管界面已经把工具标成停止或把 turn 标成取消。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 2894–2904 行
- 引用：

```2894:2904:src/vs/platform/agentHost/node/codex/codexAgent.ts
		// Unwind any still-pending "Approve anyway" guardian cards. codex does not
		// block on them, so the reducer cancels the card when the turn ends; here
		// we resolve the parked deferred (`cancel`) so the suspended
		// {@link _handleGuardianReviewCompleted} frame unwinds instead of leaking
		// until session dispose. The durable denial notification already emitted
		// remains in the transcript.
		if (session.pendingGuardianReviewCards.size > 0) {
			for (const guardianToolCallId of [...session.pendingGuardianReviewCards]) {
				session.pendingCommandApprovals.respond(guardianToolCallId, 'cancel');
			}
		}
```

- 为什么是问题：`turn/completed` 只对 guardian 卡片调用 `respond(..., 'cancel')`。`_abort`（第 5742–5757 行）只发 `turn/interrupt`，不拒绝 `pendingCommandApprovals`。steering 在第 2966 行用 `finalizeCodexTurnMapState` 把未完成工具收成 `success: false`（`completeOrphanedToolCalls`，`codexMapAppServerEvents.ts` 第 216–229 行），同样不结算已挂起的批准。命令批准在第 3551–3565 行、文件和权限批准在第 3568–3584 行都还停在 `registerAndFire` 上，用户之后点允许时仍返回 `accept`。app-server 因此会执行一个界面已经显示为停止或取消的命令、补丁或提权。
- 方向：turn 完成、中断和 steering 接管时，把仍挂起的命令、文件和权限批准解析为 `decline` 或 `cancel`。

## r03-3 高

- 症状：权限批准卡片只显示 reason 或固定标题，用户允许后，请求里的文件系统和网络权限会被原样授予；命令批准也不查看附加权限和工作目录就返回 `accept`。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 3573–3614 行
- 引用：

```3573:3584:src/vs/platform/agentHost/node/codex/codexAgent.ts
	private async _handlePermissionsApprovalRequestRpc(params: PermissionsRequestApprovalParams): Promise<{ readonly result: PermissionsRequestApprovalResponse }> {
		const decision = await this._requestItemApproval(params.threadId, params.itemId, params.reason ?? 'Grant elevated permissions');
		const granted = decision === 'accept' || decision === 'acceptForSession';
		return {
			result: {
				// Grant exactly what was requested on accept; nothing on decline.
				permissions: granted
					? { network: params.permissions.network ?? undefined, fileSystem: params.permissions.fileSystem ?? undefined }
					: {},
				scope: decision === 'acceptForSession' ? 'session' : 'turn',
			},
		};
	}
```

- 为什么是问题：`_requestItemApproval`（第 3606–3614 行）把 `confirmationTitle` 同时用作展示文案和 `toolInput`。`reason` 为空时，卡片只有 “Grant elevated permissions”。允许之后，应答却复制 `params.permissions.fileSystem` 和 `network`，其中包含读写路径列表（`AdditionalFileSystemPermissions` 第 14–20 行）。命令批准的入参类型只保留 `command` 和 `reason`（第 3518–3524 行），卡片只放剥壳后的命令（第 3547–3558 行），返回的 `decision` 却是整次 `item/commandExecution/requestApproval` 的决定；请求上的 `additionalPermissions` 和 `cwd`（`CommandExecutionRequestApprovalParams` 第 48–60 行）不会出现在卡片上，也不会被拒绝或收窄。
- 方向：允许前把将要授予的路径、网络和 cwd 放进批准决定，并只授予卡片上展示过的那一份。

## r03-4 中

- 症状：从同一条 codex turn 里较早的 host 片段分叉或截断时，这条 turn 后半段的用户消息和文件变更仍留在线程里。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 4846–4857 行；第 6003–6017 行
- 引用：

```4846:4857:src/vs/platform/agentHost/node/codex/codexAgent.ts
		const codexTurnId = resolveCodexTurnIdFromHostTurnId(fork.turnId, sourceSession?.codexTurnIdByHostTurnId);
		// Reject an unresolvable fork boundary rather than silently keeping the
		// full history: if neither the mapped codex turn id nor the caller's
		// `turnIndex` lands inside the source turns, a `numTurnsToDrop` of 0 would
		// branch from the wrong point (the tip instead of the requested turn).
		// A chat-fork source may carry no positional index; the turn id then
		// resolves the boundary alone, and an unresolvable id is rejected.
		const fallbackTurnIndex = fork.turnIndex ?? -1;
		const boundary = resolveForkBoundary(sourceTurns.map(t => t.id), codexTurnId, fallbackTurnIndex);
		if (!boundary.resolved) {
			throw new Error(`Cannot fork codex session ${sourceThreadId}: unable to resolve fork boundary for turn ${fork.turnId} (turnIndex=${fallbackTurnIndex}, turns=${sourceTurns.length})`);
		}
```

- 为什么是问题：`resolveCodexTurnIdFromHostTurnId`（`codexReplayTurnIds.ts` 第 65–77 行）把回放拆分 id 和 live 映射都折成整条 codex turn。`resolveForkBoundary` 按这个 turn 的下标保留到该 turn 末尾，turn 内部更晚的用户消息片段不会被丢掉。steering 把前后两个 host turn 都记到同一个 app turn（第 2970–2971 行，完成时第 2883 行）。`truncateChat` 只在拆分 id 不是该 turn 最后一条带文本的用户消息时拒绝（第 6009–6015 行），然后仍按整 turn 计算 `numTurns`（第 6017 行）；live steering 的 host id 没有拆分符，截断会静默留下后半段。fork 没有对应的检查。新会话或截断后的线程因此含有用户选定片段之后的内容和文件变更记录。
- 方向：分叉和截断遇到同一 codex turn 的非末尾 host 片段时拒绝，避免把后半段留在目标线程里。

## r03-5 中

- 症状：app-server 把 turn 标成失败但没有 error，或 turn 仍是 `inProgress` 时，宿主把这次 turn 记成正常完成。
- 位置：`src/vs/platform/agentHost/node/codex/codexMapAppServerEvents.ts` 第 1232–1254 行；第 1270–1280 行
- 引用：

```1232:1254:src/vs/platform/agentHost/node/codex/codexMapAppServerEvents.ts
	if (status === 'failed' && params.turn.error) {
		return [
			...recoveredToolCallActions,
			...preflightFlush,
			...orphanedToolCallActions,
			...deferredResponseActions,
			{
				type: ActionType.ChatError,
				turnId,
				duration,
				part: createErrorResponsePart(mapCodexTurnError(params.turn.error)),
			},
			{
				type: ActionType.ChatTurnComplete,
				turnId,
				duration,
			},
		];
	}
	if (status === 'interrupted') {
		return [...recoveredToolCallActions, ...preflightFlush, ...orphanedToolCallActions, ...deferredResponseActions, { type: ActionType.ChatTurnCancelled, turnId, duration }];
	}
	return [...recoveredToolCallActions, ...preflightFlush, ...orphanedToolCallActions, ...deferredResponseActions, { type: ActionType.ChatTurnComplete, turnId, duration }];
```

- 为什么是问题：`Turn.error` 的类型是 `TurnError | null`（`Turn.ts` 第 30 行），`TurnStatus` 含有 `inProgress`（`TurnStatus.ts` 第 9 行）。`status === 'failed'` 且 `error` 为 `null` 时，上面的条件不成立，函数落到最后的 `ChatTurnComplete`。`inProgress` 同样不是 `interrupted`，实时路径也发成功完成。回放在 `codexReplayMapper.ts` 第 233 行用 `turnStateFromStatus`，其 `default` 把 `inProgress` 映射成 `TurnState.Complete`（第 1278–1279 行）。用户会看到一次失败或尚未结束的 turn 已经成功结束。
- 方向：`failed` 一律发错误，`inProgress` 不要映射成完成。
