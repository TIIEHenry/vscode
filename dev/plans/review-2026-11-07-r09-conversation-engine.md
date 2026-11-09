---
title: "十六路审查 2026-11-07 r09：conversation 引擎、连接与会话名册发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读审查 conversation 的 common 目录与引擎、连接、名册、会话前缀文件（重点是 10-30 之后的提交和未提交改动），记录 2 条可证实问题。"
---

# 十六路审查 2026-11-07 r09：conversation 引擎、连接与会话名册发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次看了 `src/vs/workbench/contrib/conversation/common/` 的全部文件，以及 `browser/` 下本路前缀文件在 2026-10-30 之后的提交和当前未提交改动：引擎名册服务（删除后的落点、新建会话补工作目录）、会话列表视图与内联过滤框（按行删除、Delete 键、焦点保持）、会话视图的断线缓存投影、帧源的详情补丁、状态栏、会话聊天服务、引擎偏好页（分区只激活一次、窄屏导航）、MCP 与 Provider/Model 对话框失败后重开、Skills 未保存草稿提示、Triggers 删除确认、确认弹层、连接偏好页的断开与忘记门控。另外抽查了窗口服务的可见叶持久化、快照与历史列表、队列读取器、写闸、本地 stub 模型、草稿存储和连接设备辅助函数。删除回滚快照不带 `workDir`（2026-10-06 r08 方案已写进「明确不改」）、直连先忘旧档（r11-1）、MCP 删除期间改选不刷新（r11-5）、Forget 只认本页记下的接通 id（bug-hunt 13 已接受的限制）都已有记录，本稿不重复。共 2 条。

### r09-1

- 严重度：中
- 症状：引擎目录里的会话带访问时间时，用户新建会话后，会话列表把这一行放进 Earlier 组，并排在整张列表的最后一行，列表随即滚到底部选中它。刚建好的会话被标成「更早」，直到下一次连接状态变化重新拉目录才回到 Today。
- 代码：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` 1040–1046、2061–2067；名册里唯一写访问时间的位置是 2182，目录刷新入口只有 265 与 1877；`src/vs/workbench/contrib/conversation/browser/conversationSessionsViewStrings.ts` 160–169、202–203；`src/vs/workbench/contrib/conversation/browser/conversationSessionsView.ts` 724–729。

```1040:1046:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
	private adoptEngineSession(sessionId: string, title: string, options?: { skipBindLease?: boolean }): ConversationStubSession {
		let record = this.engineSessions.find(session => session.id === sessionId);
		if (!record) {
			record = { id: sessionId, title, turns: [], source: 'engine-cache' };
			this.engineSessions = [...this.engineSessions, record];
			this._onDidChangeSession.fire(sessionId);
		}
```

```2061:2067:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
			const result = await this.uaConnection.getSessionInfo({ sessionId: engineSessionId }, { engineIdentityId, linkId });
			if (!current() || result.sessionId !== engineSessionId || !result.workDir?.trim()) {
				return;
			}
			record.workDir = result.workDir;
			this.persistEngineAwareRoster();
			this._onDidChangeSession.fire(record.id);
```

```160:169:src/vs/workbench/contrib/conversation/browser/conversationSessionsViewStrings.ts
	for (const session of sessions) {
		const accessed = sessionAccessedAtMs(session.lastAccessedAt);
		if (accessed === undefined || accessed < startOfYesterday.getTime()) {
			buckets.earlier.push(session);
		} else if (accessed < startOfToday.getTime()) {
			buckets.yesterday.push(session);
		} else {
			buckets.today.push(session);
		}
	}
```

```202:203:src/vs/workbench/contrib/conversation/browser/conversationSessionsViewStrings.ts
	dated.sort((a, b) => b.accessed - a.accessed || a.index - b.index);
	return [...dated.map(entry => entry.session), ...undated];
```

- 为什么是问题：新建会话绑定成功后，`monitorPendingEngineSessionBind` 调用 `adoptEngineSession`，新行只有 id、标题、空回合和来源，没有 `lastAccessedAt`。`activateEngineSession` 把它设为活动会话，会话列表的 `updateActiveSession` 在活动会话变化时选中并 `reveal` 这一行。名册里只有 `doRefreshEngineCatalog` 会从 `listSessions` 的结果写入访问时间（2182 行），而目录刷新只在接通（265 行）或连接快照变化（1877 行）时发生；主进程的 `createSession`（`universeAgentConnectionService.ts` 1393–1411）不发快照事件，所以新建之后不会立刻重列。`groupSessionsForRoster` 只要有一行带时间就分组，没有时间的行进 `earlier`，`sortRosterBucket` 再把它排到组尾，也就是整张列表的最后。未提交的 `hydrateNewSessionWorkDir` 已经为这条新会话调用了 `getSessionInfo`，结果类型带 `createdAt` 与 `lastAccessedAt`（`universeAgentTypes.ts` 165–175），但只写回 `workDir`。`docs/systems/conversation/commands.md` 第 63 行写的「没有访问时间的排在 Earlier 末尾，彼此保持引擎顺序」针对的是引擎目录里本来就缺时间的行；这一行缺时间，是因为客户端没有记下已经拿到的值。删除时的邻居 `nextShownId`（1757–1759 行）也按这个顺序取。
- 方向：新建会话补水时一并写入 `getSessionInfo` 返回的非零访问时间（没有时用创建时间或本地创建时刻），让新行落在 Today 组。

### r09-2

- 严重度：低
- 症状：在 Snapshots 浮层里删除快照时，如果确认框打开期间收到一次不换链接的连接事件，确认后删除照常发出并在引擎上生效，但浮层既不显示成功或失败，也不重新列出。已删除的快照仍留在列表里，它的 Restore 与 Delete 仍可点。
- 代码：`src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts` 501–526、593–612、639–641；刷新入口 265–272，`refresh` 在 423 行递增 `renderGeneration`。

```501:526:src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts
	/** Published identity, link, session, and list generation at the click. */
	private snapshotWriteOrigin(): SnapshotWriteOrigin {
		const snapshot = this.connection.getConnectionSnapshot();
		return {
			engineIdentityId: readPublishedEngineIdentityId(snapshot),
			linkId: readPublishedLinkId(snapshot),
			sessionId: this.resolveSessionId(),
			generation: this.renderGeneration,
		};
	}

	/** Identity, link, or session moved since the click. */
	private snapshotWriteTargetStill(origin: SnapshotWriteOrigin): boolean {
		const current = this.connection.getConnectionSnapshot();
		return readPublishedEngineIdentityId(current) === origin.engineIdentityId
			&& readPublishedLinkId(current) === origin.linkId
			&& this.resolveSessionId() === origin.sessionId;
	}

	/** Stale write result: do not paint the current status and do not refresh. */
	private snapshotWriteResultCurrent(origin: SnapshotWriteOrigin): boolean {
		if (this._store.isDisposed || !this.open || this.renderGeneration !== origin.generation) {
			return false;
		}
		return this.snapshotWriteTargetStill(origin);
	}
```

```593:612:src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts
		const confirmed = await this.dialogService.confirm({
			type: 'warning',
			message: localize('conversationLens.sessionBarSnapshotsDeleteConfirm', "Delete snapshot \"{0}\"?", label),
			detail: localize('conversationLens.sessionBarSnapshotsDeleteConfirmDetail', "This engine checkpoint will be removed. This cannot be undone."),
			primaryButton: conversationLensSessionBarSnapshotsDelete,
		});
		if (this._store.isDisposed) {
			return;
		}
		if (!confirmed.confirmed) {
			return;
		}
		if (!this.snapshotWriteTargetStill(origin)) {
			return;
		}
		const remove = this.connection.deleteSnapshot;
		if (!this.canSendDelete(snapshot.id, sessionId) || !remove || !sessionId) {
			return;
		}
		void this.deleteThenRefreshList(remove, sessionId, snapshot.id, origin).catch(onUnexpectedError);
```

```639:641:src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts
		if (this._store.isDisposed || !this.snapshotWriteResultCurrent(origin)) {
			return;
		}
```

```265:272:src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts
		this._register(this.connection.onDidChangeConnection(() => {
			if (this._store.isDisposed) {
				return;
			}
			if (this.open) {
				void this.refresh().catch(onUnexpectedError);
			}
		}));
```

- 为什么是问题：`deleteSnapshot` 在 587 行、弹出原生确认框之前就用 `snapshotWriteOrigin` 记下当时的列表代次。确认框是模态的，浮层在这段时间里仍然打开，不会因失焦关闭。此时到达的 `onDidChangeConnection`（例如同一链接上的相位更新；按 `universeAgentTypes.ts` 1680–1684 的约定，只改相位时 `linkId` 不变）会调用 `refresh`，代次加一并重新列出，快照这时还在。确认后 605 行只核对引擎身份、链接和会话，于是 612 行发出删除。结果回来时，639 行的 `snapshotWriteResultCurrent` 用确认前的代次比较，判为过期后直接返回，不写状态，也不 `refresh`。发送用的是「身份、链接、会话」，落地却多比了一个确认前的代次，两者基准不同。本路的 Triggers 删除用确认前的代次判断，代次变了就不发送并写出未发送文案（`engineTriggersSection.ts` 742–750、780–784），不会出现「已经发出却不认结果」。
- 方向：确认返回、真正发送删除之前重新记下列表代次（或像 Triggers 一样，代次变了就不发送），让发送与结果判定用同一个基准。

## 打开过的文件

本路范围内：

- `src/vs/workbench/contrib/conversation/common/conversationChatInput.ts`
- `src/vs/workbench/contrib/conversation/common/conversationEditorRouting.ts`
- `src/vs/workbench/contrib/conversation/common/conversationSessionChat.ts`
- `src/vs/workbench/contrib/conversation/common/conversationSessionReadiness.ts`
- `src/vs/workbench/contrib/conversation/common/conversationSessionsInlineFilter.ts`
- `src/vs/workbench/contrib/conversation/common/uaClientSettings.ts`
- `src/vs/workbench/contrib/conversation/common/uaClientSettingsHelpers.ts`
- `src/vs/workbench/contrib/conversation/common/uaClientSettingsMigration.ts`
- `src/vs/workbench/contrib/conversation/common/uaPreferencesPanes.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEngineHistoryList.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEngineQueueReader.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionsView.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionsViewStrings.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionsInlineFilterBox.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionView.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionChat.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionStatus.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionStatusBar.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSessionAvailability.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationStubService.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationStubModel.ts`
- `src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts`
- `src/vs/workbench/contrib/conversation/browser/connectionPreferencesPaneSas.ts`
- `src/vs/workbench/contrib/conversation/browser/connectionDeviceList.ts`
- `src/vs/workbench/contrib/conversation/browser/connectionDevicePair.ts`
- `src/vs/workbench/contrib/conversation/browser/enginePreferencesPane.ts`
- `src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineMcpRuntimePanel.ts`
- `src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineSkillsSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineTriggersSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineTriggerList.ts`
- `src/vs/workbench/contrib/conversation/browser/engineAgentsSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineAgentAgentsMd.ts`
- `src/vs/workbench/contrib/conversation/browser/enginePluginsSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineClipboardSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineRulesSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineMemorySection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineConfirmPopover.ts`
- `src/vs/workbench/contrib/conversation/browser/engineWriteGate.ts`
- `src/vs/workbench/contrib/conversation/browser/uaClientComposerDrafts.ts`
- `src/vs/workbench/contrib/conversation/browser/uaClientSettingsStartup.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/uaPreferencesNavigation.ts`
- `src/vs/workbench/contrib/conversation/browser/uaPreferencesPanes.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css`

块外，只读核对接口：

- `src/vs/workbench/contrib/conversation/browser/conversationDeleteSessionConfirm.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLivePhase.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTrajectoryModel.ts`
- `src/vs/workbench/contrib/conversation/browser/agentSessionContext.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationReviewNavService.ts`
- `src/vs/workbench/services/agentSession/common/agentWorkRoot.ts`
- `src/vs/workbench/browser/parts/conversation/conversationPart.ts`
- `src/vs/workbench/contrib/preferences/browser/preferencesEditor.ts`
- `src/vs/platform/universeAgent/common/universeAgentTypes.ts`
- `src/vs/platform/universeAgent/common/conversationViewFrame.ts`
- `src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`
- `src/vs/platform/universeAgent/node/universeAgentHubService.ts`
- `src/vs/platform/universeAgent/node/grpc/grpcClientMappersSession.ts`
