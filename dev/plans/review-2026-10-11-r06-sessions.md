---
title: "审查 r06：sessions"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "4 条；宿主拒绝审批级别变更后，界面仍显示新级别，当前会话继续按原来的更高权限执行。"
---

## r06-1 高

- 症状：把正在运行的会话从自动执行改成需要确认时，若宿主拒绝这次变更，选择器仍显示已经改成需要确认，该会话继续按原来的更高权限跑工具。
- 位置：`src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts` 第 3707–3722 行，以及第 5714–5720 行；选择器入口在 `src/vs/sessions/contrib/providers/agentHost/browser/agentHostPermissionPickerDelegate.ts` 第 184–185 行
- 引用：

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

```5714:5720:src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts
		store.add(connection.onDidAction(e => {
			// A rejected action never reached host state, so it must not be applied
			// here. This does not roll back the dispatcher's own optimistic write:
			// the echo carries the value it already set.
			if (e.rejectionReason) {
				return;
			}
```

```184:185:src/vs/sessions/contrib/providers/agentHost/browser/agentHostPermissionPickerDelegate.ts
		provider.setSessionConfigValue(session.sessionId, SessionConfigKey.AutoApprove, level)
			.catch(() => { /* best-effort */ });
```

- 为什么是问题：审批级别写的是 `SessionConfigKey.AutoApprove`。写入先改本地 `_runningSessionConfigs` 并通知选择器，再发给宿主。宿主带回 `rejectionReason` 时直接返回，本地值不恢复。选择器读的就是这份缓存，所以界面变成「需要确认」，宿主仍停在自动执行。同一次调用在派发之前已经把该值写入 remembered（第 3675–3684 行），拒绝后也不会撤回。
- 方向：宿主拒绝时用拒绝前的配置覆盖本地缓存，并撤回这次 remembered 写入。

## r06-2 中

- 症状：重新打开窗口时，上次正在看的那路会话若 30 秒内还没出现，网格不再放它；旁边已经恢复出来的会话还在。
- 位置：`src/vs/sessions/services/sessions/browser/sessionsService.ts` 第 1559–1608 行
- 引用：

```1559:1561:src/vs/sessions/services/sessions/browser/sessionsService.ts
		const activeSessionPromise: Promise<ISession | undefined> = activeTarget.resource
			? this._waitForSession(activeTarget.resource, token, RESTORE_SESSION_WAIT_TIMEOUT).then(session => session ?? undefined)
			: Promise.resolve<ISession | undefined>(undefined);
```

```1581:1588:src/vs/sessions/services/sessions/browser/sessionsService.ts
			} else if (idx === activeIdx) {
				session = activeSession;
			} else {
				session = this.sessionsManagementService.getSession(target.resource);
			}
			if (session === undefined) {
				continue; // not yet available — placed incrementally below
			}
```

```1606:1608:src/vs/sessions/services/sessions/browser/sessionsService.ts
		await Promise.all(targets.map(async (target, idx) => {
			if (idx === activeIdx || !target.resource || token.isCancellationRequested || resolved[idx] !== undefined) {
				return;
			}
```

- 为什么是问题：活动槽先等 `RESTORE_SESSION_WAIT_TIMEOUT`（30 秒）。超时后 `activeSession` 是 `undefined`，`resolved[activeIdx]` 仍是 `undefined`，注释说稍后补放。补放循环却因 `idx === activeIdx` 直接返回，这路会话不会再进网格。旁边的槽不在这个例外里，到点后仍会补上。
- 方向：活动槽第一次没等到时，走和旁边槽相同的补放。

## r06-3 中

- 症状：定时自动化超时后，运行记录先变成失败，代理仍继续执行；随后若取消会话失败，记录保持失败，代理继续改工作区。
- 位置：`src/vs/sessions/contrib/automations/browser/automationScheduler.ts` 第 203–223 行；`src/vs/sessions/contrib/automations/browser/automationRunner.ts` 第 255–269 行
- 引用：

```203:223:src/vs/sessions/contrib/automations/browser/automationScheduler.ts
			// Best-effort: mark the active run row as failed so the UI doesn't show "running" forever.
			try {
				const active = this.automationService.getActiveRunFor(automation.id);
				if (active) {
					const updated = await this.automationService.updateRun(active.id, {
						status: 'failed',
						errorMessage: localize('automation.timedOut', "Timed out after {0} minute(s).", Math.round(timeoutMs / 60_000)),
						completedAt: this._now().toISOString(),
					});
					if (updated) {
						this.logService.warn(`[AutomationScheduler] automation ${automation.id} timed out after ${timeoutMs}ms; marked run ${active.id} failed (previousStatus=${active.status}, session=${updated.sessionResource?.toString() ?? '(none)'}).`);
					} else {
						this.logService.warn(`[AutomationScheduler] automation ${automation.id} timed out after ${timeoutMs}ms, but active run ${active.id} disappeared before it could be marked failed (previousStatus=${active.status}, session=${active.sessionResource?.toString() ?? '(none)'}).`);
					}
				} else {
					this.logService.warn(`[AutomationScheduler] automation ${automation.id} timed out after ${timeoutMs}ms with no active run recorded.`);
				}
			} catch (err) {
				this.logService.warn(`[AutomationScheduler] automation ${automation.id} timed out after ${timeoutMs}ms and failed to mark its active run as failed.`, err);
			}
			perRunCts.cancel();
```

```255:269:src/vs/sessions/contrib/automations/browser/automationRunner.ts
	private async _markCancelled(runId: string, trigger: AutomationRunTrigger, automation: IAutomationDescriptor, startTimeMs: number, session: ISession | undefined): Promise<void> {
		try {
			if (session) {
				try {
					const status = session.mainChat.get().status.get();
					if (status !== SessionStatus.Completed && status !== SessionStatus.Error) {
						await this.sessionsManagementService.cancelCurrentRequest(session);
					}
				} catch (err) {
					this.logService.error(`[AutomationRunner] error cancelling the session for ${automation.id}`, err);
				}
			}
			if (this.automationService.getActiveRunFor(automation.id)?.id === runId) {
				await this.automationService.updateRun(runId, {
```

- 为什么是问题：`raceTimeout` 到期只把 `timedOut` 设为 true，令牌要等 `updateRun` 把状态写成 `failed` 之后才 `cancel`。在这之前 `runOnce` 仍停在会话完成等待上，代理继续跑。取消若抛错，只记日志。此时 `findActiveRun` 只认 `pending` 和 `running`（`automationService.ts` 第 845–846 行），这条已经标失败的运行不会再被取消。
- 方向：超时先取消令牌并确认会话已停，再把运行标成失败。

## r06-4 中

- 症状：删掉会话时，若关掉其中一个终端失败，还没关掉的终端会留在原地，并且不再挂在这路会话上。
- 位置：`src/vs/sessions/contrib/terminal/browser/sessionsTerminalContribution.ts` 第 303–304 行，以及第 913–928 行
- 引用：

```303:304:src/vs/sessions/contrib/terminal/browser/sessionsTerminalContribution.ts
			for (const session of e.removed) {
				void this._closeTerminalsForSession(session.sessionId, `session removed (${session.sessionId})`).catch(onUnexpectedError).catch(onUnexpectedError).finally(() => this._sessionTerminals.delete(session.sessionId));
```

```913:928:src/vs/sessions/contrib/terminal/browser/sessionsTerminalContribution.ts
	private async _closeTerminalsForSession(sessionId: string, reason: string): Promise<void> {
		const protectedInstanceId = this._terminalService.activeInstance?.instanceId;
		for (const instance of this._getTrackedTerminalsForSession(sessionId)) {
			if (protectedInstanceId !== undefined && instance.instanceId === protectedInstanceId) {
				this._logService.info(`[SessionsTerminal] Skipping active terminal ${instance.instanceId} for session ${sessionId} (user is working in it)`);
				continue;
			}
			const availableInstance = this._getAvailableTerminal(instance, `close removed session terminal for session ${sessionId}`);
			if (!availableInstance) {
				continue;
			}
			this._logService.info(`[SessionsTerminal] Killing terminal ${availableInstance.instanceId} (session: ${sessionId}, reason: ${reason})`);
			await this._terminalService.safeDisposeTerminal(availableInstance);
			this._removeTerminalFromTrackedSessions(availableInstance.instanceId);
		}
	}
```

- 为什么是问题：循环里用 `await` 逐个关闭。前一个 `safeDisposeTerminal` 抛错时，后面的终端不会再关。外层 `catch` 吃掉错误后，`finally` 仍把该会话的整份 `_sessionTerminals` 删掉，没关掉的实例失去跟踪，之后这路会话的清理找不到它们。
- 方向：单个终端关闭失败时留下它的跟踪，并继续关闭其余终端。
