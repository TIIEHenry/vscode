---
title: "十六路审查 2026-11-07 r02：agentHost 发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读审查 agentHost 的近期改动、shell 自动批准的重定向判定和 Codex 取消路径，记录 3 条：两条 shell 写入绕过确认，一条取消后 Codex 回合照常执行。"
---

# 十六路审查 2026-11-07 r02：agentHost 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

2026-10-30 之后，本范围只有提交 `a319b6c2aa5` 改了 `node/agentService.ts` 与 `node/agentSessionResidency.ts`，内容是把重复的 `.catch(onUnexpectedError)` 收成一个，工作区没有未提交改动；这部分没有发现问题。随后抽查了会话驻留与释放、server tool 宿主及会话、合并、工件、反馈工具组、检查点服务、自动化运行、客户端重连恢复、shell 自动批准与重定向判定、Codex 回合绑定与取消、Claude 发送与中止。下面 3 条都来自这次读到的活码，严重度都是高。

### r02-1

- 严重度：高
- 症状：Copilot 会话在默认配置下（宿主沙箱关闭、终端自动批准开启），模型执行 `echo 内容 >& /home/<用户>/.bashrc` 这类命令不会弹确认，文件被写到工作目录之外。
- 代码：`src/vs/platform/agentHost/node/commandAutoApprover.ts` 74–92；`src/vs/platform/agentHost/node/sessionPermissions.ts` 607–626 与 342–361。

```74:92:src/vs/platform/agentHost/node/commandAutoApprover.ts
function classifyFileRedirect(redirectText: string, isPowerShell?: boolean): FileRedirectClassification {
	if (!redirectText.includes('>')) {
		return { kind: 'read' };
	}
	const destMatch = redirectText.match(/(?:[0-9]+|&|\*)?>>?\|?\s*(.+)$/);
	if (!destMatch) {
		return { kind: 'unsafeWrite', dest: undefined };
	}
	const rawDest = destMatch[1].trim();
	if (isSafeRedirectDestination(rawDest, isPowerShell)) {
		return { kind: 'safeWrite' };
	}
	let dest = rawDest;
	if ((dest.startsWith(`'`) && dest.endsWith(`'`)) ||
		(dest.startsWith('"') && dest.endsWith('"'))) {
		dest = dest.slice(1, -1);
	}
	return { kind: 'unsafeWrite', dest };
}
```

```607:626:src/vs/platform/agentHost/node/sessionPermissions.ts
	private _resolveShellRedirectResource(dest: string, workingDirectory: URI | undefined): URI | undefined {
		const trimmed = untildify(dest.trim(), homedir());
		if (!trimmed) {
			return undefined;
		}
		// A destination the shell expands (e.g. `$HOME/x.txt`) would otherwise be
		// treated as a literal relative path and resolve *inside* the working
		// directory, auto-approving a write that actually lands elsewhere.
		if (SessionPermissionManager._dynamicRedirectDestRegex.test(trimmed) || containsCmdDelayedExpansion(trimmed)) {
			this._logService.trace(`[SessionPermissionManager] Redirect destination expands at runtime, requiring confirmation: ${dest}`);
			return undefined;
		}
		if (path.isAbsolute(trimmed)) {
			return URI.file(trimmed);
		}
		if (!workingDirectory) {
			return undefined;
		}
		return URI.file(path.resolve(workingDirectory.fsPath, trimmed));
	}
```

```342:361:src/vs/platform/agentHost/node/sessionPermissions.ts
			const writeDests = this._commandAutoApprover.getWriteRedirectDestinations(e.toolInput, shellOptions);
			const approvedWriteDests = new Map<string, boolean>();
			for (const dest of writeDests) {
				if (dest === undefined) {
					return undefined;
				}
				const approved = await this._isShellWriteDestApproved(dest, workingDirectories);
				if (!approved) {
					return undefined;
				}
				approvedWriteDests.set(dest, true);
			}
			const result = this._commandAutoApprover.shouldAutoApprove(e.toolInput, {
				...shellOptions,
				isWriteDestApproved: dest => approvedWriteDests.get(dest) === true,
			});
			if (result === 'approved') {
				this._logService.trace('[SessionPermissionManager] Auto-approving shell command');
				return ToolCallConfirmationReason.NotNeeded;
			}
```

- 为什么是问题：bash 里 `>&word` 在 word 不是数字或 `-` 时，把标准输出和标准错误一起写进文件 word。打包的 tree-sitter-bash（`@vscode/tree-sitter-wasm` 0.3.1，开发依赖 `tree-sitter-bash` ^0.25）把 `>&` 作为 `file_redirect` 的运算符，`_extractSubCommands` 拿到的重定向文本是 `>& /home/<用户>/.bashrc`。`classifyFileRedirect` 的正则只吞掉 `>` 前面的可选 `&`，`>` 后面的 `&` 进了捕获组，目的地成了 `& /home/<用户>/.bashrc`。这串文字不以 `/` 开头，也不含 `_dynamicRedirectDestRegex` 列出的字符，`_resolveShellRedirectResource` 用 `path.resolve` 把它接到主工作目录下面。`assertPathIsSafe` 在非 Windows 上只查空字节；包含判断、`_isPlatformRestrictedResource` 和编辑 glob 判断的都是这个工作目录下的假路径，所以放行。默认 glob 只拦 `.npmrc`、`package.json` 等特定文件名，`.bashrc`、`.profile` 不在其中。`echo`、`cat` 在默认规则里允许（本文件 623、627 行的兜底表；工作台转发的默认规则同样允许），`shouldAutoApprove` 返回 `approved`，`getAutoApproval` 返回 `NotNeeded`，`AgentSideEffects._handleToolReady` 随即批准这次 shell 请求。终端自动批准开关在 `agentHostSchema.ts` 764 行默认是 `true`；工作台的沙箱设置默认是 Off，`buildSandboxConfigForSdk` 只在显式为 On 时启用沙箱，所以默认走的就是这条规则判断。现有用例 `does not auto-approve commands with write redirections to arbitrary paths` 不传 `isWriteDestApproved`，任何写重定向都会降成 `noMatch`，覆盖不到会话的这条路径。工作台的 `TreeSitterCommandParser.getFileWrites` 取的是语法节点的 `destination` 字段，没有这个问题。
- 方向：从 `file_redirect` 的 `destination` 字段取目的地；`>&` 后面不是数字或 `-` 时按写文件处理。

### r02-2

- 严重度：高
- 症状：同样的默认配置下，`cd /home/<用户> && echo 内容 > .bashrc` 不会弹确认，文件写进 `cd` 去的目录，而不是工作目录。用自定义终端工具时，先单独跑一条 `cd`，后面带相对重定向的命令同样写到别处，因为终端会被复用。
- 代码：`src/vs/platform/agentHost/node/sessionPermissions.ts` 569–584 与 607–626；`src/vs/platform/agentHost/node/commandAutoApprover.ts` 620–623；`src/vs/platform/agentHost/common/commandLineHelpers.ts` 82–90；`src/vs/platform/agentHost/node/copilot/copilotShellTools.ts` 176–192；`src/vs/platform/agentHost/node/shared/shellCommandExecution.ts` 273–276。

```569:584:src/vs/platform/agentHost/node/sessionPermissions.ts
	private async _isShellWriteDestApproved(dest: string, workingDirectories: readonly URI[] | undefined): Promise<boolean> {
		// A shell command runs in exactly one process cwd = the primary root
		// (index 0), so a *relative* redirect can only resolve against that cwd.
		const resource = this._resolveShellRedirectResource(dest, workingDirectories?.[0]);
		if (!resource) {
			return false;
		}
		if (!workingDirectories || workingDirectories.length === 0) {
			return false;
		}
		const resourcesToCheck = await this._resolveResourcesForApproval(resource);
		if (resourcesToCheck === undefined) {
			return false;
		}
		return workingDirectories.some(workingDirectory => resourcesToCheck.every(candidate => this._checkWriteResource(candidate, workingDirectory)));
	}
```

```620:623:src/vs/platform/agentHost/node/commandAutoApprover.ts
const DEFAULT_TERMINAL_AUTO_APPROVE_RULES: Readonly<Record<string, AgentHostTerminalAutoApproveRuleValue>> = {
	// Safe readonly commands
	cd: true,
	echo: true,
```

```82:90:src/vs/platform/agentHost/common/commandLineHelpers.ts
	const extracted = extractCdPrefix(command, isPowerShell);
	if (!extracted) {
		return false;
	}
	if (!sameDirectory(extracted.directory, workingDirectory)) {
		return false;
	}
	parameters.command = extracted.command;
	return true;
```

- 为什么是问题：`_isShellWriteDestApproved` 的注释认定 shell 进程的当前目录就是主工作目录，相对重定向一律对它求值。tree-sitter 把 `cd /home/<用户> && echo 内容 > .bashrc` 拆成 `cd /home/<用户>` 和 `echo 内容` 两个子命令，二者都命中默认允许规则（兜底表 622 行；工作台转发的默认规则同样允许 `cd`）。重定向 `.bashrc` 被解析成 `<主工作目录>/.bashrc`，包含判断通过；`_isPlatformRestrictedResource` 看到的也是工作目录下的路径，不按主目录点文件处理，于是 `getAutoApproval` 返回 `NotNeeded`，bash 实际写的是 `/home/<用户>/.bashrc`。`stripRedundantCdPrefix` 只去掉指向工作目录本身的 `cd` 前缀，别的目录原样留给判断。自定义终端工具的 `getOrCreateShell` 复用空闲的同类型终端，`executeCommandInShell` 把命令原样送进去，不先回到工作目录，所以上一条被自动批准的 `cd` 会延续到下一条命令。工作台的 `CommandLineFileWriteAnalyzer` 对相对路径用终端探测到的 cwd 求值，探测不到时不自动批准。2026-10-06 r04 方案（`dev/plans/review-2026-10-06-r04-agent-host-plan.md` 的 r04-1）修符号链接时保留了「相对路径只对主工作目录求值」，没有涉及命令自己换目录，不是同一缺陷。
- 方向：命令行里有改变当前目录的子命令，或无法确认 shell 当前目录就是主工作目录时，相对重定向不自动批准。

### r02-3

- 严重度：高
- 症状：Codex 会话里，用户在 app-server 的 `turn/started` 到达之前点停止，界面显示这一回合已取消，Codex 却会把它完整跑完；按默认权限，它会继续修改工作区文件、在沙箱里执行命令。
- 代码：`src/vs/platform/agentHost/node/agentSideEffects.ts` 1530–1535；`src/vs/platform/agentHost/node/codex/codexAgent.ts` 5894–5907、5711–5716、2937–2943、436–439。

```1530:1535:src/vs/platform/agentHost/node/agentSideEffects.ts
				if (agent) {
					const chat = URI.parse(channel);
					const session = parseRequiredSessionUriFromChatUri(channel);
					agent.chats.abort(chat, { ...this._chatContext(session, channel), clientTelemetryContext: clientContext }).catch(err => {
						this._logService.error('[AgentSideEffects] abort failed', err);
					});
```

```5894:5907:src/vs/platform/agentHost/node/codex/codexAgent.ts
		this._cancelPendingApprovals(session);
		if (!session.currentAppTurnId || session.threadId === undefined) {
			return;
		}
		const threadId = session.threadId;
		const conn = this._connection;
		if (conn.kind !== 'ready') {
			return;
		}
		try {
			await conn.client.request<'turn/interrupt'>('turn/interrupt', {
				threadId,
				turnId: session.currentAppTurnId,
			});
```

```5711:5716:src/vs/platform/agentHost/node/codex/codexAgent.ts
			session.lastPromptText = prompt;
			session.currentTurnId = effectiveTurnId;
			session.modifiedTime = Date.now();
			this._startTurnStopWatch(session);
			turnRequestStarted = true;
			await conn.client.request<'turn/start'>('turn/start', {
```

```2937:2943:src/vs/platform/agentHost/node/codex/codexAgent.ts
		if (session.currentTurnId === undefined || session.currentAppTurnId !== undefined) {
			return params;
		}
		const hostTurnId = session.currentTurnId;
		session.hostTurnIdByAppTurnId.set(appTurnId, hostTurnId);
		session.currentAppTurnId = appTurnId;
		return hostTurnId === appTurnId ? params : { ...params, turn: { ...params.turn, id: hostTurnId } };
```

- 为什么是问题：客户端发出的 `ChatTurnCancelled` 在 `AgentSideEffects` 里直接调用 `agent.chats.abort`；Codex 的 `abort` 不经过发送队列，直接进 `_abort`。`_abort` 只有 `currentAppTurnId` 有值时才发 `turn/interrupt`，否则直接返回，也不清 `currentTurnId`。`currentAppTurnId` 只由 `turn/started` 通知经 `_withHostTurn` 写入。`_sendMessage` 写 `currentTurnId` 之前要依次等待工作目录采用、MCP 发现、线程物化、连接、恢复、模型解析等步骤，之后发出 `turn/start`，整段没有取消检查；`turn/start` 的响应（`TurnStartResponse` 为 `{ turn: Turn }`）也没有被读取。所以只要取消落在 `turn/started` 之前，这次 `turn/start` 照样发出，随后到达的 `turn/started` 按 2937–2943 行把仍然留着的 `currentTurnId` 领走，回合正常执行，而界面上这一回合已经结束。默认值表把 `approvalPolicy` 设为 `on-request`、`sandboxMode` 设为 `workspace-write`（436–439 行）；按 318 行的说明，这个策略只在 Codex 判断需要提权时才询问，工作区内的修改和沙箱内的命令直接执行。宿主在 `_sendTurnMessage` 里的两次取消检查都在调用 `agent.chats.sendMessage` 之前，管不到 Codex 自己的这段预检。2026-10-24 r04-1（`dev/plans/review-2026-10-24-r04-agent-host-rest.md`）记的是 Copilot 的同类问题，落地只改了 `CopilotAgentSession`。
- 方向：取消时记下被取消的 host turn；`_sendMessage` 在发 `turn/start` 前核对，已取消就不发；已经发出时，在该回合的 `turn/started` 到达后立即发 `turn/interrupt`。

## 打开过的文件

- `src/vs/platform/agentHost/node/agentSessionResidency.ts`
- `src/vs/platform/agentHost/node/agentService.ts`
- `src/vs/platform/agentHost/test/node/agentSessionResidencyCatchScan.test.ts`（只看提交 diff）
- `src/vs/platform/agentHost/node/shared/sessionServerTools.ts`
- `src/vs/platform/agentHost/node/shared/agentServerToolHost.ts`
- `src/vs/platform/agentHost/node/shared/agentMergeServerTools.ts`
- `src/vs/platform/agentHost/node/shared/artifactServerTools.ts`
- `src/vs/platform/agentHost/node/shared/agentFeedbackServerTools.ts`
- `src/vs/platform/agentHost/node/agentMergeTools.ts`
- `src/vs/platform/agentHost/node/agentMergeController.ts`
- `src/vs/platform/agentHost/node/agentHostStateManager.ts`
- `src/vs/platform/agentHost/node/agentHostCheckpointService.ts`
- `src/vs/platform/agentHost/node/chatContributions/checkpointAndChangeset/checkpointAndChangesetContribution.ts`
- `src/vs/platform/agentHost/node/agentSideEffects.ts`
- `src/vs/platform/agentHost/node/agentHostAutomationService.ts`
- `src/vs/platform/agentHost/node/agentHostTurnTracker.ts`
- `src/vs/platform/agentHost/common/agentHostFileSystemProvider.ts`
- `src/vs/platform/agentHost/browser/agentHostProtocolClient.ts`
- `src/vs/platform/agentHost/common/state/agentSubscription.ts`（只看提交 diff）
- `src/vs/platform/agentHost/node/protocolServerHandler.ts`
- `src/vs/platform/agentHost/node/commandAutoApprover.ts`
- `src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts`
- `src/vs/platform/agentHost/node/sessionPermissions.ts`
- `src/vs/platform/agentHost/common/agentHostSchema.ts`
- `src/vs/platform/agentHost/common/sandboxConfigSchema.ts`
- `src/vs/platform/agentHost/common/commandLineHelpers.ts`
- `src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts`
- `src/vs/platform/agentHost/node/copilot/copilotToolDisplay.ts`
- `src/vs/platform/agentHost/node/copilot/copilotShellTools.ts`
- `src/vs/platform/agentHost/node/copilot/sandboxConfigForSdk.ts`
- `src/vs/platform/agentHost/node/shared/shellCommandExecution.ts`
- `src/vs/platform/agentHost/node/shared/worktreeIsolation.ts`
- `src/vs/platform/agentHost/node/agentHostGitService.ts`
- `src/vs/platform/agentHost/node/codex/codexAgent.ts`
- `src/vs/platform/agentHost/node/codex/protocol/generated/v2/TurnStartResponse.ts`
- `src/vs/platform/agentHost/node/claude/claudeAgent.ts`
- `src/vs/platform/agentHost/node/claude/claudeAgentSession.ts`
- `src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts`

块外，只为核对接口而读：

- `src/vs/platform/terminal/common/autoApprove/autoApproveParseSafety.ts`
- `src/vs/platform/chat/common/chatSettings.ts`
- `src/vs/platform/sandbox/common/settings.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/treeSitterCommandParser.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/commandLineFileWriteAnalyzer.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.ts`
- `node_modules/@vscode/tree-sitter-wasm/package.json` 与 `wasm/tree-sitter-bash.wasm` 的符号表
