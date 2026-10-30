---
title: "十六路审查 r06：sessions 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样审查 sessions 的列表状态、删除记账和会话配置权限，证实 3 条错误行为。"
---

# 十六路审查 r06：sessions 发现
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围只限 `src/vs/sessions` 的活码。抽样了会话状态、销毁、权限、持久化、被吞掉的错误和竞态。下面 3 条都是这次读到的行为错误。

### r06-1

严重度：高

症状：会话只是暂时从 provider 列表里消失，或在同一次防抖合并里先被移除再加回来时，这个窗口里已记住的当前聊天、关闭的聊天，以及最近打开记录会被删掉。合并结果里明明还有 `added` 时，格子上的槽位也会被拆掉。

```76:80:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		for (const session of event.added) {
			changes.set(session.sessionId, { removed: changes.get(session.sessionId)?.removed, added: session });
		}
		for (const session of event.removed) {
			changes.set(session.sessionId, { removed: session });
```

```99:102:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		if (change.added) {
			added.push(change.added);
		}
		if (change.removed) {
			removed.push(change.removed);
```

```636:640:src/vs/sessions/services/sessions/browser/sessionsService.ts
		if (e.removed.length) {
			for (const session of e.removed) {
				this._sessionStates.delete(session.resource);
			}
			this._visibility.removeMany(e.removed.map(r => r.sessionId));
```

```159:164:src/vs/sessions/services/sessions/browser/sessionNavigation.ts
	onDidRemoveSessions(e: ISessionsChangeEvent): void {
		if (e.removed.length === 0) {
			return;
		}
		const removedUris = new Set(e.removed.map(s => s.resource.toString()));
		this._recency.remove(entry => removedUris.has(entry.sessionResource.toString()));
```

```93:99:src/vs/sessions/services/sessions/browser/sessionsRecencyHistory.ts
	remove(predicate: (entry: IRecencyEntry) => boolean): void {
		const next = this._entries.filter(e => !predicate(e));
		if (next.length === this._entries.length) {
			return;
		}
		this._entries = next;
		this._save();
```

为什么是问题：`mergeSessionChangeEvents` 在后到的 `added` 上仍保留先前的 `removed`，输出里同一个会话可以既在 `added` 又在 `removed`。`SessionsService` 不看 `added`，见到 `removed` 就删掉 `_sessionStates`（当前聊天、关闭的聊天、格子位置）并把槽位拿掉。导航同样按 `removed` 删最近记录，而且 `_save()` 会马上写回工作区存储。同目录里分组和列表模型已经写明：从列表消失是驱逐，不是删除，这时清状态会变成永久丢失。

```155:159:src/vs/sessions/services/sessions/browser/sessionGroupsService.ts
		// A session dropping out of the provider's list is an eviction, not a
		// deletion — an agent that cannot answer `listSessions` yet reports no
		// sessions, so its sessions disappear until the next refresh. Clearing
		// membership here would turn that transient gap into a permanent,
		// unrecoverable loss of the user's grouping.
```

方向：合并后若同一会话仍在 `added` 里，就不要再放进 `removed`；视图状态和最近记录只在确认删除时清。

### r06-2

严重度：中

症状：agent host 上会话已经删掉，这一侧仍可能抛出「删除失败」。分组从属和置顶不会被清掉。

```4359:4376:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		try {
			for (const { sessionId, rawId, cached } of targets) {
				await connection.disposeSession(cached.backendUri);
				const removedSession = this._removeCachedSession(rawId, cached);
				if (removedSession) {
					removed.push(removedSession);
					removedIds.push(sessionId);
				}
			}
		} finally {
			if (removed.length > 0) {
				this._onDidChangeSessions.fire({ added: [], removed, changed: [] });
				for (const cached of removed) {
					cached.dispose();
				}
			}
		}
		return removedIds;
```

```5813:5831:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
	private _removeCachedSession(rawId: string, expected?: AgentHostSessionAdapter): AgentHostSessionAdapter | undefined {
		const cached = this._sessionCache.get(rawId);
		if (expected && cached && cached !== expected) {
			return undefined;
		}
		this._metaByRawId.delete(rawId);
		const stateOwner = cached ?? expected;
		if (!stateOwner) {
			return undefined;
		}
		if (cached) {
			this._sessionCache.delete(rawId);
		}
		this._runningSessionConfigs.delete(stateOwner.sessionId);
		this._runningSessionConfigResolveSeq.delete(stateOwner.sessionId);
		this._sessionStateIdleTimers.deleteAndDispose(stateOwner.sessionId);
		this._sessionStateSubscriptions.deleteAndDispose(stateOwner.sessionId);
		this._lastSessionStates.delete(stateOwner.sessionId);
		return cached;
```

```1248:1252:src/vs/sessions/services/sessions/browser/sessionsManagementService.ts
		const removedIds = await provider.deleteSessions([session.sessionId]);
		if (!removedIds.includes(session.sessionId)) {
			throw new Error(localize('sessions.deleteSession.failed', "Failed to delete the session."));
		}
		this._onDidDeleteSession.fire(session);
```

为什么是问题：`deleteSessions` 在 `await connection.disposeSession` 之后才摘缓存，而 `SessionRemoved` 通知会在这条 await 恢复前先走到 `_handleSessionRemoved` → `_removeCachedSession`。缓存已经空了时，后者返回的是 `cached`（`undefined`），不是 `expected`。成功销毁的 id 因此进不了 `removedIds`。管理服务把缺 id 当成失败并抛错，`onDidDeleteSession` 不会发。分组从属和置顶只在这个事件上删除。

方向：`disposeSession` 成功后就把该 id 算作已删除，即使缓存已被通知提前摘掉。

### r06-3

严重度：高

症状：用户改了审批级别（或其他会话配置）但 host 拒绝了这次写入后，选择器仍显示新值。把权限从自动批准收紧到更严时，界面像是已经收紧，host 仍按原来更高的权限执行。

```3707:3722:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		// Update local cache optimistically
		const nextValues = { ...runningConfig.values, [property]: normalizedValue };
		this._runningSessionConfigs.set(sessionId, {
			...runningConfig,
			values: nextValues,
		});
		this._onDidChangeSessionConfig.fire(sessionId);

		// Dispatch to the agent host
		const rawId = this._rawIdFromChatId(sessionId);
		const cached = rawId ? this._sessionCache.get(rawId) : undefined;
		if (cached && rawId) {
			const sessionUri = cached.backendUri;
			const action = { type: ActionType.SessionConfigChanged as const, config: { [property]: normalizedValue } };
			connection.dispatch(sessionUri.toString(), action);
			void this._resolveRunningSessionConfig(sessionId, cached, nextValues).catch(onUnexpectedError).catch(onUnexpectedError);
```

```3819:3831:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		const seq = (this._runningSessionConfigResolveSeq.get(sessionId) ?? 0) + 1;
		this._runningSessionConfigResolveSeq.set(sessionId, seq);
		try {
			const resolved = await connection.resolveSessionConfig({
				provider: cached.agentProvider,
				workingDirectory: cached.workspace.get()?.folders[0]?.root,
				config: values,
			});
			if (this._runningSessionConfigResolveSeq.get(sessionId) !== seq) {
				return;
			}
			this._runningSessionConfigs.set(sessionId, resolved);
```

```5737:5741:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
			// A rejected action never reached host state, so it must not be applied
			// here. This does not roll back the dispatcher's own optimistic write:
			// the echo carries the value it already set.
			if (e.rejectionReason) {
				return;
```

```244:252:src/vs/sessions/contrib/providers/agentHost/browser/agentHostPermissionPickerDelegate.ts
		const value = provider.getSessionConfig(session.sessionId)?.values[SessionConfigKey.AutoApprove];
		// Defensive: a legacy `autopilot` value on the autoApprove axis (from
		// before Autopilot moved onto the mode axis) is no longer a valid
		// approval level — surface it as Default rather than a level the picker
		// doesn't offer.
		if (value === ChatPermissionLevel.Autopilot) {
			return ChatPermissionLevel.Default;
		}
		return isChatPermissionLevel(value) ? value : ChatPermissionLevel.Default;
```

为什么是问题：乐观写入先覆盖 `_runningSessionConfigs`，拒绝回执被直接丢掉，没有恢复旧值。注释写明被拒绝的动作没有进入 host 状态。随后的 `_resolveRunningSessionConfig` 传入的仍是这份新 values，不是 host 上拒绝前的配置；resolve 成功还会再写回缓存。权限选择器读的就是 `getSessionConfig(...).values.autoApprove`。

方向：拒绝时把该会话配置恢复成派发前的值，不要再用被拒绝的 values 去 resolve。

## 实际打开的文件

- `src/vs/sessions/contrib/providers/agentHost/browser/agentHostAutomationStore.ts`
- `src/vs/sessions/contrib/providers/agentHost/browser/agentHostPermissionPickerDelegate.ts`
- `src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts`
- `src/vs/sessions/contrib/providers/agentHost/browser/localAgentHostSessionsProvider.ts`
- `src/vs/sessions/contrib/sessions/browser/sessionsActions.ts`
- `src/vs/sessions/browser/workbench.ts`
- `src/vs/sessions/services/sessions/browser/sessionGroupsService.ts`
- `src/vs/sessions/services/sessions/browser/sessionNavigation.ts`
- `src/vs/sessions/services/sessions/browser/sessionsListModelService.ts`
- `src/vs/sessions/services/sessions/browser/sessionsManagementService.ts`
- `src/vs/sessions/services/sessions/browser/sessionsRecencyHistory.ts`
- `src/vs/sessions/services/sessions/browser/sessionsService.ts`
- `src/vs/sessions/services/sessions/browser/visibleSessions.ts`
