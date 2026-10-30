---
title: "十六路审查 r03：agentHost 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样审查 agentHost 的 shell 写入、沙箱自动批准、Claude 权限模式下发和写路径校验，共 4 条。"
---

# 十六路审查 r03：agentHost 发现
状态：草案。
覆盖需求：无（正文未引用需求编号）。


抽样范围是 `src/vs/platform/agentHost` 的会话工具权限、沙箱自动批准、权限模式下发和写路径校验。共 4 条。

### r03-1

严重度：高

症状：自定义 shell 的 `write_bash` / `write_powershell` 可以不经确认，向已经存在的 PTY 提交新命令，而且这段输入不会经过主 shell 工具的沙箱包装。

```573:592:src/vs/platform/agentHost/node/copilot/copilotShellTools.ts
	const writeTool: Tool<IWriteShellArgs> = {
		name: `write_${shellType}`,
		...
		overridesBuiltInTool: true,
		skipPermission: true,
		handler: async (args) => {
			const shells = shellManager.listShells();
			const shell = shells[shells.length - 1];
			...
			await terminalManager.sendText(shell.terminalUri, args.command, { shouldExecute: false });
```

```106:114:src/vs/platform/agentHost/node/agentHostTerminalManager.ts
export function formatTerminalText(data: string, options: IFormatTerminalTextOptions): string {
	...
	data = data.replace(/\r?\n/g, '\r');
	if (options.shouldExecute && !data.endsWith('\r')) {
		data += '\r';
	}
```

```227:236:src/vs/platform/agentHost/node/copilot/copilotShellTools.ts
	private _makeReference(shell: IManagedShell): IReference<IManagedShell> {
		...
			dispose: () => {
				...
				this._busyShellIds.delete(shell.id);
			},
```

```489:532:src/vs/platform/agentHost/node/copilot/copilotShellTools.ts
					let wrapped = await engine.wrapCommand(
						args.command,
						...
					);
					...
					commandToRun = wrapped.command;
				}
				const result = await executeCommandInShell(ref.object, commandToRun, timeoutMs, terminalManager, logService);
```

为什么是问题：`skipPermission: true` 让这条工具不进入权限确认。`shouldExecute: false` 只是不再额外补一个回车；`formatTerminalText` 已经把输入里的换行换成 `\r`，PTY 会把这一行提交执行。主 shell 工具才会 `wrapCommand` 后再送入终端。命令结束后引用只把 shell 从 busy 集合去掉，终端仍留在 `listShells()` 里，`write_*` 固定写最近一个。随后的换行输入因此在未批准、未包装的 shell 提示符上执行。

方向：`write_*` 与主 shell 工具使用同一套批准和沙箱包装，或拒绝会提交新命令的输入。

### r03-2

严重度：高

症状：自定义终端工具关闭、宿主沙箱配置为开启时，SDK 的 `options.update` 失败后，后续 shell 仍被当成已经在沙箱内而自动批准。

```3501:3524:src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts
			// Auto-approve shell commands that run sandboxed by default, since the
			// sandbox already contains them.
			if (!managedApprovalRequired && !this._launchPlan.hasScopedEditSurface && isShellRequest && !requestSandboxBypass && await this._isShellSandboxedByDefault()) {
				...
				if (this._pendingPermissions.has(toolCallId)) {
					this._pendingPermissions.respond(toolCallId, { kind: 'approve-once' });
```

```3636:3646:src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts
	private async _isShellSandboxedByDefault(): Promise<boolean> {
		if (this._isCustomTerminalToolEnabled()) {
			...
			return this._shellManager.getOrCreateSandboxEngine().isEnabled();
		}
		return this._computeSdkSandboxConfig() !== undefined;
	}
```

```2706:2709:src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts
	private async _prepareSdkTurn(mode: CopilotSdkMode | undefined): Promise<void> {
		await this.applyMode(mode);
		await this.syncPermissionMode('turn-start');
		await this._applyEffectiveSandboxConfig();
```

```3778:3794:src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts
	private async _applyEffectiveSandboxConfig(failOnError = false): Promise<void> {
		...
		try {
			const result = await this._wrapper.session.rpc.options.update({ sandboxConfig });
			if (!result.success) {
				throw new Error('Copilot SDK rejected sandbox config update');
			}
		} catch (err) {
			if (failOnError) {
				throw err;
			}
			this._logService.warn(`[Copilot:${this.sessionId}] Failed to update sandbox config for request`, err);
		}
```

```723:731:src/vs/platform/agentHost/node/copilot/copilotSessionLauncher.ts
	private async _applySandboxConfig(...): Promise<void> {
		...
		try {
			await session.rpc.options.update({ sandboxConfig });
		} catch (err) {
			this._logService.warn(`[Copilot:${sessionId}] Failed to apply SDK sandboxConfig`, err);
		}
```

为什么是问题：自定义终端关闭时，自动批准只看宿主配置能否算出一份沙箱策略，不看这次 `options.update` 是否成功。回合准备和会话启动都把更新失败记成警告并继续。策略没有下到 SDK 时，shell 仍走 `approve-once`。

方向：自动批准以沙箱策略已经成功应用到当前 SDK 会话为准；应用失败时改为要求确认或中止本回合。

### r03-3

严重度：高

症状：Claude 会话把权限模式改严后，SDK `setPermissionMode` 失败时调用仍成功返回，本回合继续按旧模式跑。

```521:548:src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts
	async setPermissionMode(mode: PermissionMode): Promise<void> {
		this._currentPermissionMode = mode;
		if (this._query && !this._needsRebind && mode !== this._appliedPermissionMode) {
			...
				try {
					await this._query.setPermissionMode(requested);
					...
					this._appliedPermissionMode = requested;
				} catch (err) {
					this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] setPermissionMode failed: ${err}`);
				}
			...
			await run;
		}
	}
```

```1063:1069:src/vs/platform/agentHost/node/claude/claudeAgentSession.ts
		} else {
			await pipeline.setPermissionMode(resolveCurrentPermissionMode(...));
		}
		await this._reconcileMcpServerEnablement();
		...
		await pipeline.send(prompt, turnId, clientContext);
```

```684:692:src/vs/platform/agentHost/node/claude/claudeAgentSession.ts
		this._register(this._configurationService.onDidSessionConfigChange(event => {
			...
			this.setInheritedPermissionMode(inheritedMode).catch(err => {
				this._logService.warn(`[Claude:${this.sessionId}] mid-turn setPermissionMode(${mode}) failed`, err);
			});
		}));
```

为什么是问题：失败被吃掉后 `_appliedPermissionMode` 仍是旧值，但 Promise 成功结束。`send` 接着把提示发给 SDK。配置监听同样只记日志，不中止当前回合。用户从 `bypassPermissions` 改回更严模式时，SDK 可以继续按旧模式执行工具。

方向：`setPermissionMode` 失败要传给调用方；未成功收紧前不要开始或继续本回合。

### r03-4

严重度：中

症状：工作目录路径经过符号链接时，目录内的写和 shell 重定向不会自动批准，同一次读取可以。

```547:552:src/vs/platform/agentHost/node/sessionPermissions.ts
	private async _isReadContainedByRoot(...): Promise<boolean> {
		const [resourcesToCheck, workingDirectories] = await Promise.all([
			resourcesToCheckPromise,
			this._resolveResourcesForApproval(workingDirectory),
		]);
		return ... resourcesToCheck.every(candidate => workingDirectories.some(directory => this._isResourceInDirectory(candidate, directory)));
	}
```

```641:656:src/vs/platform/agentHost/node/sessionPermissions.ts
	private async _isEditAutoApproved(...): Promise<boolean> {
		const resourcesToCheck = await this._resolveResourcesForApproval(resource);
		...
		return workingDirectories.some(workingDirectory => resourcesToCheck.every(candidate => this._checkWriteResource(candidate, workingDirectory)));
	}
```

```686:693:src/vs/platform/agentHost/node/sessionPermissions.ts
	private _checkWriteResource(resource: URI, workingDirectory: URI | undefined): boolean {
		...
		if (!this._isResourceInWorkingDirectory(resource, workingDirectory)) {
			return false;
		}
```

```559:560:src/vs/platform/agentHost/node/sessionPermissions.ts
	private _isResourceInDirectory(resource: URI, directory: URI): boolean {
		return extUriBiasedIgnorePathCase.isEqualOrParent(normalizePath(resource), normalizePath(directory));
	}
```

为什么是问题：读路径会把工作目录也做一次 realpath，字面路径和真实路径可以分别对上。写路径只 realpath 目标文件，再要求每个候选路径都落在未解析的工作目录字符串下面。工作目录本身是符号链接时，文件真实路径对不上该字符串，`_isEditAutoApproved` 失败。`_isShellWriteDestApproved` 复用 `_checkWriteResource`，shell 重定向同样不会自动批准。用户会看到目录内每次编辑都要确认。

方向：写和 shell 重定向与读路径一样，用工作目录的真实路径做包含判断。

## 实际打开的文件

- `src/vs/platform/agentHost/node/copilot/copilotShellTools.ts`
- `src/vs/platform/agentHost/node/agentHostTerminalManager.ts`
- `src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts`
- `src/vs/platform/agentHost/node/copilot/copilotSessionLauncher.ts`
- `src/vs/platform/agentHost/node/copilot/sandboxConfigForSdk.ts`
- `src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts`
- `src/vs/platform/agentHost/node/claude/claudeAgentSession.ts`
- `src/vs/platform/agentHost/node/sessionPermissions.ts`
- `src/vs/platform/agentHost/node/commandAutoApprover.ts`
- `src/vs/platform/agentHost/node/agentSideEffects.ts`
- `src/vs/platform/agentHost/node/sessionDatabase.ts`
- `src/vs/platform/agentHost/node/sessionDataService.ts`
- `src/vs/platform/agentHost/node/agentService.ts`
- `src/vs/platform/agentHost/node/claude/claudeCanUseTool.ts`
- `src/vs/platform/agentHost/common/pendingRequestRegistry.ts`
- `src/vs/platform/agentHost/common/reconnectingTransport.ts`
- `src/vs/platform/agentHost/node/agentHostStateManager.ts`
- `src/vs/platform/agentHost/node/shared/shellCommandExecution.ts`
- `src/vs/platform/agentHost/common/state/protocol/channels-chat/reducer.ts`
- `src/vs/platform/agentHost/node/agentSessionResidency.ts`
