---
title: "审查 r09：conversation"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "4 条；重叠的权限切换会让引擎停在比界面更宽的工具权限上。"
---

## r09-1 高
- 症状：连续改工具权限时，界面可以停在 Ask，引擎却已经停在后到的 Permit 或 Agent。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 第 847–880 行
- 引用：

```847:880:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
		const previous = getSessionConfig(host, sessionId).permissionIndex;
		if (permissionIndex === previous) {
			return;
		}
		if (!isSessionPermissionModeAvailable(host) || !host.uaConnection.setPermissionMode) {
			restoreSessionPermissionIndex(host, sessionId, previous);
			return;
		}
		setSessionConfig(host, sessionId, { permissionIndex });
		if (host.getBoundSessionId() === sessionId) {
			host.permissionSelectBox.select(permissionIndex);
		}
		const mode = SESSION_TOOL_PERMISSION_MODES[permissionIndex] ?? SESSION_TOOL_PERMISSION_MODES[0];
		try {
			const result = await host.uaConnection.setPermissionMode({ sessionId, mode });
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live apply.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionPermissionIndex(host, sessionId, previous);
				return;
			}
			if (result.ok) {
				return;
			}
			restoreSessionPermissionIndex(host, sessionId, previous);
			if (host.getBoundSessionId() === sessionId) {
				showGateNotice(host, result.message?.trim() || conversationLensDockPermissionFailed);
			}
		} catch (error) {
			restoreSessionPermissionIndex(host, sessionId, previous);
			if (host.getBoundSessionId() === sessionId) {
				const detail = error instanceof Error ? error.message.trim() : '';
				showGateNotice(host, detail || conversationLensDockPermissionFailed);
			}
		}
```

底栏每次 `onDidSelect` 都直接调用它（`conversationLensDock.ts` 第 206–208 行），进行中的请求不会关掉下拉框。
- 为什么是问题：每次调用只记住自己开始时的 `previous`，成功返回时也不看本地是不是还是这次选中的档。先发出的 Permit 若后返回且 `ok`，会直接 return，把后选的 Ask 留在界面上，引擎却执行了 Permit。先发出的请求若失败，`restoreSessionPermissionIndex` 会把更新的选择盖回这次的 `previous`。Ask / Agent / Permit 里更宽的那一档会在用户没再确认的情况下生效。
- 方向：同一次会话的权限写入串行化，过期的成功或失败都不要再改本地档，也不要让过期的模式留在引擎上。

## r09-2 中
- 症状：快速连改模型时，下拉框和引擎最后生效的模型会错开。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 第 944–989 行
- 引用：

```944:989:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
		const previous = host.modelSelectedIndex;
		if (modelIndex === previous) {
			return;
		}
		const previousId = (host.catalogModelIds[previous] ?? '').trim();
		if (!isSessionSwitchModelAvailable(host) || !host.uaConnection.switchModel) {
			restoreSessionModelIndex(host, sessionId, previous, previousId);
			return;
		}
		if (host.getBoundSessionId() === sessionId) {
			host.modelSelectedIndex = modelIndex;
			host.modelSelectBox.select(modelIndex);
			updateSendEnabled(host);
		}
		const modelId = (host.catalogModelIds[modelIndex] ?? '').trim();
		if (!modelId) {
			restoreSessionModelIndex(host, sessionId, previous, previousId);
			return;
		}
		try {
			const result = await host.uaConnection.switchModel({
				sessionId,
				agentId: '',
				modelType: '',
				modelId,
			});
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live model.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionModelIndex(host, sessionId, previous, previousId);
				return;
			}
			if (!result.resolvedModelId.trim()) {
				restoreSessionModelIndex(host, sessionId, previous, previousId);
				if (host.getBoundSessionId() === sessionId) {
					showGateNotice(host, conversationLensDockModelFailed);
				}
				return;
			}
			ensureSessionModelProfileIds(host).set(sessionId, modelId);
		} catch (error) {
			restoreSessionModelIndex(host, sessionId, previous, previousId);
			if (host.getBoundSessionId() === sessionId) {
				const detail = error instanceof Error ? error.message.trim() : '';
				showGateNotice(host, detail || conversationLensDockModelFailed);
			}
		}
```

入口是 `conversationLensDock.ts` 第 240–242 行，同样没有在途标记。
- 为什么是问题：`previous` 取的是共享的 `modelSelectedIndex`，不是这一次请求的代号。先发出的切换失败时会把下拉框打回自己的旧下标，盖掉后一次选择；先发出的切换后成功时只把当时的 `modelId` 写进表，不看下拉框是不是已经改过。之后发送若下标是 0，`submitDraft` 不会带 `modelProfileId`，引擎就留在这次错开的模型上。
- 方向：模型切换与权限一样按会话忽略过期结果，失败只回滚这一次仍然有效的选择。

## r09-3 中
- 症状：引擎拒绝删除会话之后，该会话的叶子和子代理对话框已经被拆掉。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` 第 1630–1637 行与第 1652–1655 行；`src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts` 第 139–142 行、第 711–714 行与第 726–732 行；`src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts` 第 73–76 行
- 引用：

```85:88:src/vs/workbench/contrib/conversation/browser/conversationStubService.ts
	/**
	 * Deleted session id, fired only after that delete has succeeded.
	 * Pairing-hold, leftover list-fail, and a missing id do not fire.
	 */
```

```1630:1637:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
		if (callRemote) {
			this.dispatchEngineAction(
				sessionId,
				'deleteSession',
				() => this.uaConnection.deleteSession({ sessionId }),
				() => this.rollbackEngineSessionDelete(snapshot),
			);
		}
```

```1652:1655:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
		this._onDidChangeSession.fire(sessionId);
		this.persistEngineAwareRoster();
		this._onDidDeleteSession.fire(sessionId);
		return true;
```

```139:142:src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts
		if (this.rosterService.onDidDeleteSession) {
			this._register(this.rosterService.onDidDeleteSession(sessionKey => {
				this.disposeLeafForDeletedSession(sessionKey);
			}));
		}
```

```711:714:src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts
	private rollbackHalfAppliedLeaf(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		try {
			this.editorGroupsService.disposeConversationEditorPart(sessionKey);
```

```726:732:src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts
	private disposeLeafForDeletedSession(sessionKey: string): void {
		if (!this.leaves.has(sessionKey)) {
			return;
		}
		const wasPrimary = this.primarySessionKey === sessionKey;
		const wasFocused = this.focusedLeafSessionKey === sessionKey;
		this.rollbackHalfAppliedLeaf(sessionKey);
```

```73:76:src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts
		if (this.rosterService.onDidDeleteSession) {
			this._register(this.rosterService.onDidDeleteSession(sessionId => {
				this.closeSubAgentDialog(sessionId);
			}));
		}
```

- 为什么是问题：远程删除在 `deleteSession` 的 Promise 结算前就发出 `onDidDeleteSession`。窗口服务随即 `disposeConversationEditorPart` 并卸掉叶子，会话聊天服务关掉子代理对话框。`rollbackEngineSessionDelete`（第 1658–1678 行）只把名册行和目标插回去，不重建叶子，也不重开对话框。活动会话若被切回，只会 `reveal` 出一个新叶子，原先打开的编辑器页已经没了。
- 方向：等删除一元成功后再发 `onDidDeleteSession`；拒绝时只走名册回滚。

## r09-4 中
- 症状：成功删掉最后一个引擎会话后，下次启动仍会把该会话从工作区缓存装回名册。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` 第 1638–1653 行与第 2110–2113 行
- 引用：

```1638:1653:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
		if (this.engineSessions.length === 0) {
			// Honest empty — no stub seed refill (m6 §6 / M6-A2).
			this.listCompleted = true;
			if (this.isEngineConnected()) {
				this.markEngineSessionBindFailed();
			} else {
				this.activeEngineSessionId = undefined;
			}
		} else if (wasActive) {
			const newIndex = Math.min(index, this.engineSessions.length - 1);
			const nextId = this.engineSessions[newIndex]!.id;
			this.activeEngineSessionId = nextId;
			this._onDidChangeActiveSession.fire(nextId);
		}
		this._onDidChangeSession.fire(sessionId);
		this.persistEngineAwareRoster();
```

```2110:2113:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
	private buildPersistedEngineCache(): ConversationRosterEngineCache | undefined {
		if (this.engineSessions.length === 0) {
			return selectEngineCache(this.currentRosterStorage(), this.boundEngineIdentityId);
		}
```

`markEngineSessionBindFailed`（第 203–204 行）会把 `engineSessions` 清成空数组。`restoreEngineCacheFromStorage`（第 2012–2025 行）在下次启动时按这块缓存把会话装回内存。
- 为什么是问题：内存里已经没有会话时，持久化不写空缓存，而是把存储里上一份缓存原样写回。最后一条会话被删掉后，这份缓存仍含该会话。当前进程会显示绑定失败占位，冷启动或 `adoptSnapshotEngineIdentity` 再走恢复时，已删除的会话和它的 turns 会重新出现在离线名册里。
- 方向：确认删除已经生效且名册为空时，把该引擎桶写成空会话列表，不要回写删除前的缓存。
