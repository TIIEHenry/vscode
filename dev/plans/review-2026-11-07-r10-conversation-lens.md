---
title: "十六路审查 2026-11-07 r10：conversation 阅读面、时间线与作曲器发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读审查 contrib/conversation 的镜头、会话绑定、作曲器、时间线、收件箱、轨迹与会话栏（含未提交改动），记录 3 条可证实问题。"
---

# 十六路审查 2026-11-07 r10：conversation 阅读面、时间线与作曲器发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次读了范围内 2026-10-30 以后改过的文件和工作区未提交改动：镜头 `conversationLens.ts`、会话绑定 `conversationLensSessionBinding.ts`、会话栏与叶子会话栏、作曲器三件（`conversationLensComposer.ts`、`conversationLensComposerChrome.ts`、`conversationLensDock.ts`）、`@` 引用、时间线宿主、渲染器与条目宿主、过程折叠与对账、收件箱、轨迹、投影、揭示服务、提问与确认座位、编辑器页和删除确认。为核对被调用的接口，只读打开了 r09 范围内的窗口服务、名册、引擎帧源和可用性判断，发现都落在本路文件上。共 3 条。已在旧稿或今天的方案里记过的问题没有再报，包括标题编辑框跨会话残留、整行重绘把焦点退回行本身、收件箱队列弹层焦点，以及切会话时丢回合编辑稿（`dev/plans/interaction-review-2026-11-06.md` 的 D7）。

### r10-1

- 严重度：高
- 症状：两扇会话窗口并排时，在 A 窗口里编辑一条排队消息（已占位 EDITING），点进 B 窗口再点回 A，A 的作曲器立刻退出队列编辑：改了一半的文字被换回撰写草稿，这条排队消息的占位被释放，随后按原内容发给引擎。同一路径也会丢掉 A 里正在写的回合编辑稿，而 A 窗口的会话从头到尾没有换过。
- 代码：`src/vs/workbench/contrib/conversation/browser/conversationLens.ts` 385–391；`src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts` 271–285（280 行）；`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 606–626。触发方与判断函数在块外，只读核对：`conversationSessionWindowService.ts` 615–620、`conversationSessionAvailability.ts` 110–121、`conversationEngineRosterService.ts` 420–425。

```385:391:src/vs/workbench/contrib/conversation/browser/conversationLens.ts
		this._register(this.stubService.onDidChangeActiveSession(sessionId => {
			if (this.boundSessionId !== undefined && sessionId !== this.boundSessionId) {
				this.closeBoundInnerOverlays();
				return;
			}
			this.applyActiveSession(sessionId);
		}));
```

```271:285:src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts
export function applyActiveSession(host: IConversationLensSessionBindingHost, sessionId: string): void {

	host.visualizeOverlay.close({ restoreFocus: false });
	host.engineHistoryList?.close({ restoreFocus: false });
	host.engineSnapshotsList?.close({ restoreFocus: false });
	host.inboxOverlay.closeListPanel();
	host.trajectoryView.clearSessionState();
	host.clearPostFailure?.();
	host.timelineTree.clearTurnActionState?.();
	host.exitComposerEdit(true, !engineQueueEditMustKeepHold(host, host.editingQueueItemId));
	host.resetInputHistoryBrowse();
	host.refreshSessionSelectOptions();
	host.syncSessionConfigSelects(sessionId);
	host.updateSessionTitle();
	applyComposerSurfaceText(host, host.readComposerDraft(sessionId));
```

```606:626:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
		const sessionId = host.getBoundSessionId();
		const prevPolicy = host.composerPolicy;
		const prevQueueItemId = host.editingQueueItemId;
		if (prevPolicy === 'queueEdit' && prevQueueItemId && releaseQueueHold && engineQueueEditMustKeepHold(host, prevQueueItemId)) {
			if (host.queueEditSettlementItemId !== prevQueueItemId) {
				showPostFailure(host, queueEditKeptReason(host));
			}
			return false;
		}
		host.composerPolicy = 'compose';
		host.editingTurnId = undefined;
		host.editingQueueItemId = undefined;
		if (prevPolicy === 'queueEdit' && prevQueueItemId && releaseQueueHold) {
			host.stubService.releaseMessageQueueItemHold(sessionId, prevQueueItemId);
			host.renderInboxStatus();
		}
		host.timelineTree.setEditingTurnId(undefined);
		applyComposerSurfaceText(host, restoreComposeDraft
			? (host.composeDraftSnapshot || host.readComposerDraft(sessionId) || '')
			: '');
		host.composeDraftSnapshot = '';
```

```615:620:src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts
		store.add(addDisposableListener(container, 'focusin', () => {
			this.setFocusedLeaf(sessionKey);
			if (this.rosterService.getActiveSessionId() !== sessionKey) {
				this.rosterService.switchSession(sessionKey);
			}
		}, true));
```

```110:121:src/vs/workbench/contrib/conversation/browser/conversationSessionAvailability.ts
	if (itemId && host.queueEditSettlementItemId === itemId) {
		return true;
	}
	const state = host.stubService.getMessageQueueState?.(host.getBoundSessionId());
	if (!state || state.readState === undefined) {
		return false;
	}
	const live = state.readState === 'ready'
		&& host.stubService.isEngineConnected()
		&& !isConversationPairingHold(host.uaConnection)
		&& !isConversationSessionNotReady(host.stubService);
	return !live;
```

- 为什么是问题：编辑器页里的镜头都绑定了自己的会话 key（`conversationEditorPane.ts` 168–173 带 `sessionKey` 构造，120 行 `setBoundSessionId`）。焦点进入某扇叶子窗口时，窗口服务在活动会话不同就 `switchSession`，名册切到另一个引擎会话会发 `onDidChangeActiveSession`。焦点去 B 时，A 的镜头因为 `sessionId !== boundSessionId` 只关内层浮层；焦点回到 A 时 `sessionId === boundSessionId`，落进 `applyActiveSession`，按切会话处理。队列已列出、引擎在线、没有在途保存时，`engineQueueEditMustKeepHold` 返回 false，280 行于是以 `releaseQueueHold = true` 调 `exitComposerEdit`：618–620 行发出 `releaseMessageQueueItemHold`，623–625 行用撰写草稿覆盖输入框。队列编辑的文字不进草稿（输入事件只在 `compose` 时写草稿，`conversationLensDock.ts` 537–539），所以这段修改直接丢失。EDITING 占位放掉后，该项回到待发：合同 `docs/systems/conversation/composer-and-inbox.md` 第 78 行写明未在编辑的 PENDING 才算 Queued，于是原文会按队列发出。同一合同第 61 行规定队列编辑只在 Escape / Exit 时退出并释放。D7 只记了「切会话时」丢回合编辑稿；这里镜头绑定的会话没有变，而且队列编辑会把用户正要改掉的原文发出去，D7 没有覆盖这两点。
- 方向：绑定镜头在自己的会话重新成为活动会话时不走切会话的 `applyActiveSession`，至少不退出编辑、不释放队列占位。

### r10-2

- 严重度：中
- 症状：在会话 A 的作曲器里加了 `@` 引用芯片之后，从 A 窗口会话栏的下拉框（或 More 菜单里的会话行）切到会话 B，A 存下的草稿只剩正文，引用没了。之后焦点回到 A 窗口，或 A 的窗口被替换掉后重新打开 A，作曲器按这份草稿恢复，引用芯片消失。在叶子会话栏上新建会话、删除会话也会写回同样不带引用的草稿。
- 代码：`src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts` 787–789、962–968，另有 808 与 926–927；`src/vs/workbench/contrib/conversation/browser/conversationComposerRefs.ts` 93–100、120–130；`src/vs/workbench/contrib/conversation/browser/conversationLeafSessionBar.ts` 127、322–324；引用数组只在 `conversationLens.ts` 255 行。

```787:789:src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts
function outgoingComposerDraftText(host: IConversationLensSessionBarHost): string {
	return host.composerPolicy !== 'compose' ? host.composeDraftSnapshot : composerDraftText(host);
}
```

```962:968:src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts
		const previousId = host.getBoundSessionId();
		if (previousId !== sessionId) {
			host.visualizeOverlay.close({ restoreFocus: false });
			host.engineHistoryList?.close({ restoreFocus: false });
			host.engineSnapshotsList?.close({ restoreFocus: false });
			host.writeComposerDraft(previousId, outgoingComposerDraftText(host));
		}
```

```93:100:src/vs/workbench/contrib/conversation/browser/conversationComposerRefs.ts
export function composerDraftText(host: IComposerSurfaceHost): string {
	const surfaceRefs = host.composerRefResources ?? [];
	const { body, refs } = resolveComposerSurfacePayload(host.dockTextarea.value, surfaceRefs);
	if (refs.length === 0) {
		return body;
	}
	return composeConversationPayload(body, refs) ?? '';
}
```

```322:324:src/vs/workbench/contrib/conversation/browser/conversationLeafSessionBar.ts
	writeComposerDraft(sessionId: string, text: string): void {
		this.accessors.writeComposerDraft(sessionId, text);
	}
```

```120:130:src/vs/workbench/contrib/conversation/browser/conversationComposerRefs.ts
export function applyComposerSurfaceText(host: IComposerSurfaceHost, full: string): void {
	const split = splitConversationRefs(full);
	if (split.trailer) {
		host.dockTextarea.value = split.body;
		host.composerRefResources?.splice(0, host.composerRefResources.length, ...uniqueLegalComposerRefs(split.refs));
	} else {
		host.dockTextarea.value = full;
		host.composerRefResources?.splice(0, host.composerRefResources.length);
	}
	host.syncComposerRefs?.();
}
```

- 为什么是问题：编辑器页的镜头不挂自己的会话栏（`conversationEditorPane.ts` 168–173 不传 `sessionBar`），产品里的会话栏是 `ConversationLeafSessionBar`，`switchToSession`、`createNewSession`、`deleteActiveSession` 收到的宿主都是叶子栏。叶子栏只在 127 行借来镜头的 `dockTextarea`，自己没有 `composerRefResources`；引用数组只在镜头上（`conversationLens.ts` 255）。所以 `composerDraftText(叶子栏)` 只拿到输入框里的正文，`refs` 为空，返回不带 `<<<conversation-refs>>>` 尾块的文字，再经 accessor 写进镜头的草稿表并落盘（`conversationLensComposer.ts` 669–676；`ua.client.chatInput.restoreDrafts` 默认开启）。加芯片时镜头已经把带尾块的整段写进草稿（`conversationComposerAt.ts` 221–225），这一步把它覆盖掉。之后 `applyActiveSession`（`conversationLensSessionBinding.ts` 285）或新镜头构造时的 `restoreComposerDraftToInput` 读回这份草稿，`applyComposerSurfaceText` 走无尾块分支，把芯片数组清空。`dev/plans/conversation-timeline-session-pills.md` 第 441 行要求 `outgoingComposerDraftText` 读写含引用的整段，「切会话才不会丢掉引用」。活码只在宿主是镜头时满足这一点，产品里实际走的叶子栏路径仍然丢引用。
- 方向：会话栏计算出站草稿时向镜头取含引用的整段文本（例如经 accessor 调镜头的 `composerDraftText`），不用叶子栏宿主自己拼。

### r10-3

- 严重度：低
- 症状：队列编辑点了保存、引擎还没答复时，若作曲器已被别的路径退出编辑（目前产品里就是 r10-1 那条焦点切回），用户接着点开一条用户消息开始回合编辑；等引擎接受这次队列编辑、Release 也结算后，保存链的收尾把这次回合编辑一起退出，已经输入的修改被撰写草稿覆盖。
- 代码：`src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts` 557–562、588–594；对照 `src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 655–666。

```557:562:src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts
		host.queueEditSettlementItemId = itemId;
		const finalize = (): void => {
			clearChain();
			host.exitComposerEdit(true, false);
			host.renderInboxStatus();
		};
```

```588:594:src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts
			void (releaseSettlement ?? settleDispatchedEngineWrite(host.stubService, true))
				.then(released => {
					if (released && samePublishedEngineLink(host, publishedLink)) {
						finalize();
					} else {
						failChain(released ? 'delivery_unknown' : undefined);
					}
```

```655:666:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
		void release.settlement.then(accepted => {
			if (host.queueEditSettlementItemId === itemId) {
				host.queueEditSettlementItemId = undefined;
			}
			if (host.composerPolicy !== 'queueEdit' || host.editingQueueItemId !== itemId) {
				return;
			}
			if (!accepted || !samePublishedEngineLink(host, publishedLink) || engineQueueEditMustKeepHold(host, itemId)) {
				showPostFailure(host, queueEditKeptReason(host));
				return;
			}
			exitComposerEdit(host, true, false);
```

- 为什么是问题：保存时 557 行把 `queueEditSettlementItemId` 设成这一项。在途期间 `applyActiveSession` 调 `engineQueueEditMustKeepHold`，因 settlement id 相同返回 true，于是以 `releaseQueueHold = false` 退出编辑（`conversationLensSessionBinding.ts` 280；`conversationLensComposerChrome.ts` 609 行的拦截只在 `releaseQueueHold` 为真时生效）。作曲器回到 `compose` 后，`beginTurnEdit` 里的 `exitComposerEdit(host, false)` 在 603–605 行直接返回 true，回合编辑照常开始。引擎接受编辑后走 `releaseAfterAcceptedEdit`，Release 结算为真时调 `finalize()`。它不看当前的 `composerPolicy` 和编辑对象，直接 `exitComposerEdit(true, false)`，退出回合编辑并用 `composeDraftSnapshot` 覆盖输入框（`conversationLensComposerChrome.ts` 615–625）。同一链上的 `failChain` 也会把队列编辑的失败行写到正在进行的回合编辑上。`cancelQueueEdit` 的结算回调在 659–661 行先核对仍在编辑同一项，保存链缺少这一步。时间窗只有 Edit 与 Release 两次往返，所以记为低。
- 方向：`finalize` 与 `failChain` 先核对仍处于 `queueEdit`、编辑的是同一项且会话未变，再退出或报错，与 `cancelQueueEdit` 的结算回调保持一致。

## 打开过的文件

- `src/vs/workbench/contrib/conversation/browser/conversationLens.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLeafSessionBar.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEditorPane.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSubAgentOverlay.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensDock.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationComposerRefs.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationComposerAt.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensProjection.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensReadingColumn.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTimelineHost.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTimelineItemHost.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTimelineReconcile.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTimelineRevealService.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationProcessFoldModel.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLivePhase.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationInboxOverlay.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTrajectory.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTrajectoryModel.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTrajectoryDetailInspector.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationQuestionSeat.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationConfirmationSeat.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationContextViewEvent.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationNotifications.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationSplitActions.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationNavigation.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationAgentBreadcrumb.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationTurnContentAdapter.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationVisualizeOverlay.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationWorkRootMount.contribution.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationDeleteSessionConfirm.ts`
- 块外只读核对：`src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts`、`conversationSessionAvailability.ts`、`conversationSessionView.ts`、`conversationSessionChatService.ts`、`conversationEngineRosterService.ts`、`conversationEngineFrameSource.ts`、`conversationStubService.ts`；`src/vs/platform/universeAgent/common/sessionView/types.ts`、`src/vs/platform/universeAgent/node/sessionViewHost.ts`、`src/vs/platform/universeAgent/node/sessionCore/stream-event-to-view-patch.ts`；`docs/systems/conversation/composer-and-inbox.md`
