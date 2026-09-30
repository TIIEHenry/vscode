---
title: "审查 r03：sessions"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "多聊天的审批写到组内第一个会话，解析中的选择会被记住，提交和恢复时布局会错位。"
---

# 发现

## r03-1 高
- 症状：Copilot 多聊天会话里，权限芯片显示并修改的是组内第一个聊天的审批级别；当前聊天按自己的级别发送。在组里新建聊天时，新聊天用全局默认级别，芯片仍显示第一个聊天的级别。全局默认为自动批准、第一个聊天为默认时，用户在新聊天里发送，工具会自动批准，芯片仍显示需要确认。
- 位置：`src/vs/sessions/contrib/providers/copilotChatSessions/browser/copilotChatSessionsProvider.ts` 第 1827–1840 行
- 引用：
```1827:1840:src/vs/sessions/contrib/providers/copilotChatSessions/browser/copilotChatSessionsProvider.ts
	setPermissionLevel(sessionId: string, level: string): void {
		const newSession = this._newSessions.get(sessionId);
		if (newSession) {
			if (isChatPermissionLevel(level)) {
				newSession.setPermissionLevel(level);
			}
			return;
		}

		this._ensureSessionCache();
		const session = this._findChatSession(sessionId);
		if (session && isChatPermissionLevel(level)) {
			session.setPermissionLevel(level);
		}
```
- 为什么是问题：分组后的 `ISession.sessionId` 是组 id（同文件第 3156、3211–3212 行）。`_findChatSession` 在缓存未直接命中时取组内第一个聊天（第 3044–3052 行）。权限芯片通过 `getSession(session.sessionId)` 读写的也是这一个对象（`permissionPicker.ts` 第 517、528–534 行）。后续聊天在第 2109 行被设成 `_defaultPermissionLevel()`，发送时用的是该聊天自己的 `permissionLevel`（第 2409 行）。因此把芯片改成更严的级别只锁住第一个聊天，当前聊天仍按更宽的级别跑工具。
- 方向：按当前活动聊天读写并发送审批级别，新建聊天继承该会话正在显示的级别。

## r03-2 高
- 症状：新会话配置还在解析时，用户改审批或隔离模式，当前草稿丢掉这次选择，芯片保持旧值；同一选择已经写入配置文件里的 remembered 值。下一份新会话会按这个值启动。被丢掉的若是自动批准，下一份会话会在用户看到当前芯片未变化的情况下以自动批准开始。
- 位置：`src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts` 第 3548–3568 行
- 引用：
```3548:3568:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		// Remember portable config picks across sessions.
		if (typeof normalizedValue === 'string' && isRememberedSessionConfigKey(property)) {
			const rememberedValues = this._storageService.getObject<Record<string, unknown>>(STORAGE_KEY_REMEMBERED_SESSION_CONFIG_VALUES, StorageScope.PROFILE, {});
			const nextRememberedValues = Object.create(null) as Record<string, string>;
			for (const [key, rememberedValue] of Object.entries(rememberedValues)) {
				if (typeof rememberedValue === 'string' && isRememberedSessionConfigKey(key)) {
					nextRememberedValues[key] = rememberedValue;
				}
			}
			nextRememberedValues[property] = normalizedValue;
			this._storageService.store(STORAGE_KEY_REMEMBERED_SESSION_CONFIG_VALUES, JSON.stringify(nextRememberedValues), StorageScope.PROFILE, StorageTarget.MACHINE);
		}

		// Mark resolution before firing so the first picker render is already inert.
		const newSession = this._getNewSession(sessionId);
		if (newSession) {
			// Defense-in-depth: pickers render disabled during a resolve,
			// but keyboard dropdown and mobile sheet paths bypass that.
			// Drop the second pick so it can't race the schema replacement.
			if (newSession.isResolvingConfig.get()) {
				return;
			}
```
- 为什么是问题：`isRememberedSessionConfigKey` 对除分支名以外的项都返回真（第 278–279 行），`autoApprove` 会进 remembered。下一份草稿按「策略 > remembered > 设置」播种（第 3476–3479 行）。隔离开关在 `_applyIsolationValue` 里直接调用 `setSessionConfigValue`，不看是否正在解析（`agentHostSessionConfigPicker.ts` 第 741–764 行）。审批下拉只在打开菜单时检查解析状态，确认对话框返回后再次写入（同文件第 767–774、806–814 行）。解析若在确认期间开始，这次自动批准对当前草稿无效，对下一份会话有效。
- 方向：解析进行中的写入整段丢弃，不要先写入 remembered。

## r03-3 中
- 症状：多个会话并排，或当前操作的是一条可见的旁路聊天、而窗口焦点在另一条会话上时，在这条聊天的 Agent 选择器里改 Agent，选择落到该会话的默认聊天上。旁路聊天的 Agent 不变，选择器弹回原值，默认聊天的 Agent 被改掉。
- 位置：`src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts` 第 4018–4024 行
- 引用：
```4018:4024:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		if (cached && rawId && connection) {
			const chatResource = this._activeChatResource(cached);
			cached.setChatAgent(chatResource, agent);
			this._updateChatSessionState(chatResource, cached.getChatModelId(chatResource), agent?.uri).catch(err => this._logService.error(`[${this.id}] Failed to update chat model state for ${chatResource.toString()}`, err));
			this._onDidChangeSessions.fire({ added: [], removed: [], changed: [cached] });
		}
	}
```
- 为什么是问题：`_activeChatResource` 只在「被改的会话就是窗口当前活动会话」时使用该会话的活动聊天，否则用会话资源，也就是默认聊天（第 4822–4824 行）。选择器只把 `sessionId` 传进来（`agentHostAgentPicker.ts` 第 264–271 行）。活动聊天的 mode 已经按当前聊天分开（`visibleSessions.ts` 第 35–39、256 行），这次写入仍按窗口活动会话猜测目标聊天。
- 方向：`setAgent` 带上调用方聊天的 resource，写入那条聊天。

## r03-4 中
- 症状：新会话草稿里已经打开文件或 Changes 页，发出第一条消息、草稿被换成资源不同的正式会话后，编辑区被套上空的 working set，这些标签被关掉。
- 位置：`src/vs/sessions/contrib/layout/browser/baseSessionLayoutController.ts` 第 366–384 行
- 引用：
```366:384:src/vs/sessions/contrib/layout/browser/baseSessionLayoutController.ts
		this._register(runOnChange(this._sessionsService.activeSession, (session, previousSession) => {
			if (
				previousSession
				&& !isEqual(previousSession.resource, session?.resource)
				&& previousSession.status.read(undefined) !== SessionStatus.Untitled
				&& !this._isRestoringSessionLayout
			) {
				this._saveWorkingSet(previousSession.resource);
			}
		}));

		// [B2] Session changed (apply)
		this._register(runOnChange(this._activeSessionForWorkingSet, (session, previousSession) => {
			// Apply working set for current session.
			// On initial load (no previous session), only apply if we have a saved working set —
			// skip applying 'empty' to avoid closing editors that are being restored.
			if (previousSession || (session && this._workingSets.has(session.resource))) {
				this._withSessionLayoutRestore(() => this._applyWorkingSet(session?.resource, { isInitialRestore: !previousSession }));
			}
		}));
```
- 为什么是问题：离开未发送草稿时不保存 working set。替换后的会话资源不同，`previousSession` 仍在，于是照常套用。新资源没有记录时，套用值是 `'empty'`（第 791–793 行），编辑区被清空。`_onSessionReplaced` 只搬走编辑区显隐和面板视图（第 499–514 行），不搬走 working set。
- 方向：草稿提交替换时把当前编辑区 working set 记到正式会话资源上，再套用。

## r03-5 中
- 症状：重启后打开一个仍有分栏聊天布局的会话时，若当时列表里只有默认聊天且 `loading` 已是 false，分栏在同伴聊天到达前被收起，保存的分栏布局被清掉。后到的同伴聊天全部进剩余的那一栏。
- 位置：`src/vs/sessions/browser/parts/chatGroupsView.ts` 第 413–428 行
- 引用：
```413:428:src/vs/sessions/browser/parts/chatGroupsView.ts
		if (this._restorePending) {
			const allSavedPresent = this._restoreAssignment ? [...this._restoreAssignment.keys()].every(id => validIds.has(id)) : true;
			const catalogChanged = !this._restoreInitialIds || orderedIds.length !== this._restoreInitialIds.size || orderedIds.some(id => !this._restoreInitialIds!.has(id));
			const catalogSettled = !session.loading.read(reader);
			if (allSavedPresent || catalogChanged || catalogSettled) {
				this._restorePending = false;
				this._restoreAssignment = undefined;
				this._restoreOrder = undefined;
				this._restoreInitialIds = undefined;
			}
		}

		if (!this._restorePending) {
			this._removeEmptyGroups();
			this._persistLayout();
		}
```
- 为什么是问题：恢复开始时 `_restoreInitialIds` 只含当时可见的聊天（第 256 行）。已登录的 agent host 会话把 `loading` 设成 `authenticationPending`（`baseAgentHostSessionsProvider.ts` 第 1016、2888 行），认证结束后该值保持 false，此时目录仍可能只有默认聊天。第一次 reconcile 因 `catalogSettled` 结束恢复，空栏被删。栏数变成 1 后 `_persistLayout` 把该会话的已存布局写成空（第 906–908 行）。随后 `applyChatCatalog` 补上的同伴聊天不再有保存的目标栏。
- 方向：在目录仍可能补聊天时保持恢复；用聊天目录到齐作为结束条件，不要用会话 `loading`。
