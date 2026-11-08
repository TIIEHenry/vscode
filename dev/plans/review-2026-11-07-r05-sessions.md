---
title: "十六路审查 2026-11-07 r05：sessions 发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读审查 sessions 在 2026-10-30 后的销毁守卫与 catch 合并改动，并抽查自动化、代码审阅、分组与列表模型等持久化代码，记录 2 条。"
---

# 十六路审查 2026-11-07 r05：sessions 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次先逐个看了 `src/vs/sessions` 在 2026-10-30 之后的提交：d47c382192d、a88702714f1、26e7f43c0f8 三次把重复的 `.catch(onUnexpectedError)` 合成一层，给异步回调加 `isDisposed` 提前返回，并在 `dispose()` 里清理 DOM；另外两次只改 CSS（删掉的 `hostPickerDropdown.css` 与 `hostPickerSheet.css` 重复，无引用）。随后抽查了自动化账本、代码审阅、会话分组、列表置顶与排序、最近工作区、输入横幅和反馈提交等带状态的代码。共 2 条，都是 11-04 新加的销毁检查截断了用户已经确认的后续步骤。

### r05-1

- 严重度：中
- 症状：从命令面板运行「Manage Remote Agent Hosts...」，选中一台远程主机进入它的选项列表后，点标题栏的返回按钮，选择器直接关闭，不会回到远程主机列表。
- 代码：`src/vs/sessions/contrib/providers/remoteAgentHost/browser/manageRemoteAgentHosts.ts` 155–182；返回按钮的结果在 `src/vs/sessions/contrib/providers/remoteAgentHost/browser/remoteHostOptions.ts` 487–495、507–508；同步隐藏链（块外，只用来核对接口）在 `src/vs/platform/quickinput/browser/quickInput.ts` 366–377 与 `src/vs/platform/quickinput/browser/quickInputController.ts` 461、824–856。

```155:182:src/vs/sessions/contrib/providers/remoteAgentHost/browser/manageRemoteAgentHosts.ts
			store.add(picker.onDidAccept(() => {
				const selected = picker.selectedItems[0];
				picker.hide();
				if (!selected) {
					return;
				}
				if (selected.kind === 'remote') {
					void instantiationService.invokeFunction(a => showRemoteHostOptions(a, selected.provider, { showBackButton: true })).then(result => {
						if (store.isDisposed) {
							return;
						}
						if (result === 'back') {
							showManagePicker();
						}
					}).catch(onUnexpectedError);
				} else if (selected.kind === 'menu-action') {
					if (store.isDisposed) {
						return;
					}
					commandService.executeCommand(selected.action.id, () => {
						if (!store.isDisposed) {
							showManagePicker();
						}
					});
				}
			}));

			store.add(picker.onDidHide(() => store.dispose()));
```

- 为什么是问题：`onDidAccept` 第一件事就是第 157 行的 `picker.hide()`。`QuickInput.hide()` 调用 `this.ui.hide()`，也就是 `QuickInputController.hide()`；后者在返回前同步调用 `controller.didHide(reason)`，`didHide` 同步触发 `onDidHide`，第 182 行的监听随即执行 `store.dispose()`。所以从第 161 行往下，`store.isDisposed` 已经恒为真。远程分支里，用户点返回按钮时 `showRemoteHostOptions` 解析为 `'back'`（`remoteHostOptions.ts` 第 490–494、507–508 行），但第 163 行的检查先返回，第 167 行的 `showManagePicker()` 永远走不到。这个检查是 2026-11-04 的 26e7f43c0f8 加的，之前这里直接按 `result === 'back'` 重新打开列表。第 171 行给 menu-action 分支加了同样的检查，走到这个分支时命令也不会执行；不过该菜单的三个条目都带 `sessionWorkspacePickerGroup == remote` 条件（`remoteAgentHostActions.ts` 第 655、1092、1288 行），这个键只在工作区选择器弹出时设置、隐藏时复位（`sessionWorkspacePicker.ts` 第 370–372、736 行），从命令面板打开时通常不会出现，所以这里不把它算作已证实的症状。
- 方向：去掉这两处对外层 `store.isDisposed` 的检查，外层选择器关闭后仍按 `'back'` 重新打开列表、仍执行所选的菜单命令。

### r05-2

- 严重度：低
- 症状：在 Automations 视图的运行历史里删除某次运行的会话，确认后、删除请求返回前，如果自动化视图被关掉（例如打开了别的会话），会话已经删除，这条运行记录却留在自动化账本里。先从历史里打开过这次运行的会话（它成为当前会话），网格里并排还开着另一个会话，再回到 Automations 视图删除它时，每次都会这样。确认框写的是会删除会话并把这一项从运行历史里移除。
- 代码：`src/vs/sessions/contrib/sessions/browser/views/automationsView.ts` 1001–1023；视图销毁链在 `src/vs/sessions/services/sessions/browser/sessionsService.ts` 647–654、714–717，`src/vs/sessions/browser/parts/customViewGridPart.ts` 90，`src/vs/sessions/browser/parts/customViewNode.ts` 47，`automationsView.ts` 138、1258；删除在返回前发出移除事件见 `src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts` 4374–4382 与 `src/vs/sessions/services/sessions/browser/sessionsManagementService.ts` 199。

```1001:1023:src/vs/sessions/contrib/sessions/browser/views/automationsView.ts
		try {
			await this.sessionsManagementService.deleteSession(session);
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			this.clearPendingFocus();
			this.logService.error('[AutomationsCards] Failed to delete automation run session', error);
			await this.dialogService.error(
				localize('automationRunSessionDeleteFailed', "Failed to delete the automation run session."),
				getErrorMessage(error),
			);
			return;
		}
		if (this._store.isDisposed) {
			return;
		}
		if (hadFocus) {
			this.pendingFocusRunId = focusRunId;
			this.shouldRestoreFocus = true;
		}
		try {
			await this.automationService.deleteRun(run.id);
```

```647:654:src/vs/sessions/services/sessions/browser/sessionsService.ts
		if (e.removed.length && e.removed.some(r => r.sessionId === currentActive.sessionId)) {
			const fallback = this._visibility.activeSession.get();
			if (fallback && this.sessionsManagementService.getSession(fallback.resource)) {
				this.openSession(fallback.resource, { source: 'fallback' });
			} else {
				this.openNewSession();
			}
		}
```

- 为什么是问题：第 1015 行的检查是 2026-11-04 的 a88702714f1 加的，位置在会话已经删除成功之后、`deleteRun` 之前；修改前这里会无条件继续删运行记录。历史区挂在自动化自定义视图下：视图被隐藏时 `CustomViewGridPart._renderView()` 先 `_node.clear()`（`customViewGridPart.ts` 第 90 行），自定义视图、卡片部件和历史区依次销毁。打开任何会话都会经 `_startOpenSession()` 调 `hideCustomView()`（`sessionsService.ts` 第 714–717 行）。agent host 提供方的 `deleteSessions` 在返回前同步发出移除事件（`baseAgentHostSessionsProvider.ts` 第 4374–4376 行），管理服务同步转发（`sessionsManagementService.ts` 第 199 行）。被删会话是当前会话、网格里还有别的会话时，`removeMany` 选出回退会话，上面第 650 行在这次 `await` 恢复之前就调 `openSession`，历史区随之销毁，第 1015 行返回，`deleteRun` 被跳过。用户在请求返回前自己点开别的会话也是同样结果。账本没有别处会在会话删除时清理运行（`automationService.ts` 只有显式的 `deleteRun`）。历史列表和无障碍视图都会滤掉会话已不存在的已完成运行（`automationsView.ts` 第 646–650 行，`automationsAccessibility.ts` 第 62–66 行），所以界面上看不到这条残留；它仍留在持久化账本里，并占用每个自动化最多 50 条的运行配额（`automationService.ts` 第 40、482 行）。
- 方向：会话删除成功后无论历史区是否已销毁都执行 `deleteRun`，只把焦点恢复和状态提示放在销毁检查之后。

## 打开过的文件

- `src/vs/sessions/browser/parts/chatGroupsView.ts`
- `src/vs/sessions/browser/parts/customViewGridPart.ts`
- `src/vs/sessions/browser/parts/customViewNode.ts`
- `src/vs/sessions/browser/parts/sessionHeader.ts`
- `src/vs/sessions/browser/sessionsSignInDialog.ts`
- `src/vs/sessions/browser/workbench.ts`
- `src/vs/sessions/contrib/agentFeedback/browser/agentFeedbackPRReviewSeeder.ts`
- `src/vs/sessions/contrib/agentFeedback/browser/agentFeedbackService.ts`
- `src/vs/sessions/contrib/automations/browser/automationDialog.ts`
- `src/vs/sessions/contrib/automations/browser/automationService.ts`
- `src/vs/sessions/contrib/automations/browser/automationTools.ts`
- `src/vs/sessions/contrib/chat/browser/newChatWidget.ts`
- `src/vs/sessions/contrib/chat/browser/sessionWorkspacePicker.ts`
- `src/vs/sessions/contrib/codeReview/browser/codeReviewService.ts`
- `src/vs/sessions/contrib/github/browser/createSessionFromPullRequestAction.ts`
- `src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts`
- `src/vs/sessions/contrib/providers/remoteAgentHost/browser/manageRemoteAgentHosts.ts`
- `src/vs/sessions/contrib/providers/remoteAgentHost/browser/remoteAgentHostActions.ts`
- `src/vs/sessions/contrib/providers/remoteAgentHost/browser/remoteHostOptions.ts`
- `src/vs/sessions/contrib/sessionInputBanners/browser/sessionInputBanners.ts`
- `src/vs/sessions/contrib/sessions/browser/views/automationsAccessibility.ts`
- `src/vs/sessions/contrib/sessions/browser/views/automationsView.ts`
- `src/vs/sessions/contrib/sessions/browser/views/sessionsList.ts`
- `src/vs/sessions/services/customView/browser/customViewService.ts`
- `src/vs/sessions/services/sessions/browser/sessionGroupsService.ts`
- `src/vs/sessions/services/sessions/browser/sessionsListModelService.ts`
- `src/vs/sessions/services/sessions/browser/sessionsManagementService.ts`
- `src/vs/sessions/services/sessions/browser/sessionsRecentWorkspacesService.ts`
- `src/vs/sessions/services/sessions/browser/sessionsService.ts`
- `src/vs/sessions/services/sessions/browser/visibleSessions.ts`
- `src/vs/platform/quickinput/browser/quickInput.ts`（块外，核对接口）
- `src/vs/platform/quickinput/browser/quickInputController.ts`（块外，核对接口）
