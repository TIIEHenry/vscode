---
title: "审查 r14：sessions"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "4 条；并排追问打进别的会话，断连仍显示已读，分组不跟随会话替换，审阅打到当前会话。"
---

## r14-1 中

- 症状：并排打开多个会话时，某个窗格里的追问框并不属于这个窗格的会话。它读的是全局当前会话，草稿键却在控件创建时钉死。把焦点切到另一个会话后，从原来那个窗格发送，请求进的是新的当前会话的当前对话。
- 位置：`src/vs/sessions/contrib/chat/browser/newChatInSessionWidget.ts` 第 55–84 行
- 引用：

```55:84:src/vs/sessions/contrib/chat/browser/newChatInSessionWidget.ts
		this._session = derived(reader => {
			const activeSession = this.sessionsService.activeSession.read(reader);
			return activeSession;
		});
		// ...
			draftStorageKey: inSessionDraftStorageKey(this.sessionsService.activeSession.get()?.sessionId),
```

- 为什么是问题：`_send`（第 198–212 行）用的就是这个全局 `_session` 的 `activeChat`，后台发送还会对它调用 `openNewChatInSession`。`NewChatView.setChat` 是空实现（`src/vs/sessions/browser/parts/chatView.ts` 第 68–70 行），所在分组虽然传入了本窗格的会话，追问框并不接收。窗格会话对象不变时 `ChatGroupsView.setSession` 直接返回（`src/vs/sessions/browser/parts/chatGroupsView.ts` 第 129–132 行），控件不会重建，草稿键继续指向创建时那个 `sessionId`。用户在会话 B 的输入框里打的字，会发到会话 A，草稿却存在另一个键下。
- 方向：追问框和它的草稿键绑定到所在窗格的会话，窗格会话变化时跟着改。

## r14-2 中

- 症状：远程宿主已断开、会话列表仍留着缓存时，把会话标成已读会立刻清掉未读，宿主侧的已读动作不会发出。
- 位置：`src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts` 第 4308–4333 行
- 引用：

```4308:4333:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
	private _setSessionArchived(sessionId: string, isArchived: boolean): boolean {
		// ...
		if (!cached || !rawId || !connection) {
			return false;
		}
		cached.isArchived.set(isArchived, undefined);
		// ...
	}

	async setSessionReadState(sessionId: string, isRead: boolean): Promise<void> {
		const rawId = this._rawIdFromChatId(sessionId);
		const cached = rawId ? this._sessionCache.get(rawId) : undefined;
		if (cached && rawId && cached.isRead.get() !== isRead) {
			cached.isRead.set(isRead, undefined);
			this._onDidChangeSessions.fire({ added: [], removed: [], changed: [cached] });
			const connection = this.connection;
			if (connection) {
				const sessionUri = cached.backendUri;
				const action = { type: ActionType.SessionIsReadChanged as const, isRead };
				connection.dispatch(sessionUri.toString(), action);
			}
		}
	}
```

- 为什么是问题：同一文件里归档在没有 `connection` 时拒绝改本地状态，注释写明不能把记不下来的变更显示成已经生效。已读先改 `cached.isRead` 并广播，断连时跳过 `SessionIsReadChanged`。远程 provider 的 `connection` 在断开时为 `undefined`（基类第 2944–2945 行，`remoteAgentHostSessionsProvider.ts` 第 264 行）。`SessionsManagementService.setSessionReadState`（第 1223–1224 行）不看这次调用有没有真正发出。列表按 `isRead` 去掉未读标记，用户看到的是一次没有执行的成功。
- 方向：没有连接时不要改、也不要广播已读，并像归档一样让这次操作失败可见。

## r14-3 中

- 症状：发送已经开始、骨架会话已经出现在列表里之后，把它放进自定义分组；骨架换成正式会话、`sessionId` 变了，这条成员关系留在旧 id 上，列表里的会话离开该分组。
- 位置：`src/vs/sessions/services/sessions/browser/sessionGroupsService.ts` 第 209–230 行
- 引用：

```209:230:src/vs/sessions/services/sessions/browser/sessionGroupsService.ts
		// A draft graduates into a committed session with a new id; follow it.
		this._register(this.sessionsManagementService.onDidReplaceSession(({ from, to }) => {
			if (from.sessionId === to.sessionId) {
				return;
			}
			const groupId = this._inFlightSessionGroups.get(from.sessionId);
			if (groupId !== undefined) {
				this._inFlightSessionGroups.delete(from.sessionId);
				this._inFlightSessionGroups.set(to.sessionId, groupId);
			}
		}));

		// The started session carries the committed id; record its group now.
		this._register(this.sessionsManagementService.onDidStartSession(session => {
			const groupId = this._inFlightSessionGroups.get(session.sessionId);
			if (groupId === undefined) {
				return;
			}
			this._inFlightSessionGroups.delete(session.sessionId);
			if (this._groups.has(groupId)) {
				this.addToGroup(session.sessionId, groupId);
			}
		}));
```

- 为什么是问题：替换处理只搬 `_inFlightSessionGroups`。`addToGroup` / `setMembership`（第 319–327、365–368 行）立刻把成员写进 `_membership`。骨架在 `_waitForNewSession` 期间经 `getSessions` 放进列表（`baseAgentHostSessionsProvider.ts` 第 3255–3267 行），列表按 `session.sessionId` 查分组（`sessionsList.ts` 第 2562 行）。随后 `_onDidReplaceSession` 用新 id 换掉骨架（同文件第 4867–4871 行）。新 id 不在 `_membership` 里，`onDidStartSession` 也只查在途表。会话从分组里消失，旧 id 仍留着一份成员记录。
- 方向：会话 id 被替换时，把已写入的 `_membership` 从旧 id 迁到新 id，与在途分组同一套跟随。

## r14-4 中

- 症状：布局还停在上一会话时，变更编辑器继续显示上一份文件；对其中一行执行审阅或资源级变更操作，改的是全局当前会话的变更集。
- 位置：`src/vs/sessions/contrib/changes/browser/changesetReviewActions.ts` 第 41–73 行
- 引用：

```41:73:src/vs/sessions/contrib/changes/browser/changesetReviewActions.ts
	override run(accessor: ServicesAccessor, ...args: unknown[]): void {
		const resource = args[0];
		if (!(resource instanceof URI)) {
			return;
		}

		const changesViewService = accessor.get(IChangesViewService);
		if (changesViewService.activeSessionChangesetObs.get()?.capabilities?.review !== true) {
			return;
		}

		const change = findSessionFileChange(resource, changesViewService.activeSessionChangesObs.get());
		if (!change) {
			return;
		}
		// ...
		changesViewService.setChangesetFilesReviewState([reviewResource], review);
	}
```

- 为什么是问题：`SessionChangesEditor._scopedChangesObs` 在编辑器自己的会话不是全局当前会话时退回上一份列表（`sessionChangesEditor.ts` 第 183–189 行），中键入口也只拿 `activeSessionChangesObs` 做校验（同文件第 89–96 行）。行内资源操作同样在点击时读 `activeSessionChangesetObs` 和 `activeSessionChangesObs`（`changesActions.ts` 第 579–590 行）。工作集尚未切到新会话时，屏幕上仍是上一会话的 diff；两个会话共用工作区、URI 相同，这次点击会给当前会话标审阅，或对当前会话执行该资源操作。
- 方向：审阅和资源操作认变更编辑器自己绑定的会话，当前会话对不上时不要落到全局变更集上。
