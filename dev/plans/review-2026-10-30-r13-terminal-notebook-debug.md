---
title: "十六路审查 r13：终端笔记调试发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样审查终端沙箱确认、测试结果生命周期和调试会话重启，记录 4 条可证实问题。"
---
# 十六路审查 r13：终端笔记调试发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


抽样范围是终端、终端贡献、笔记本、调试、测试结果和 REPL 笔记本。下面只记这次读到的错误行为。

### r13-1

- 严重度：高
- 症状：命令已经被改写成脱离沙箱，或需要放开沙箱网络时，只要展示命令命中自动批准规则，准备阶段就不再向用户要确认，随后直接执行改写后的命令。

沙箱改写把用户看到的命令和真正执行的命令拆开，并带上必须确认的标志：

```28:34:src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineRewriter/commandLineSandboxRewriter.ts
		return {
			rewritten: wrappedCommand.command,
			reasoning: wrappedCommand.requiresAllowNetworkConfirmation ? 'Wrapped command for sandbox execution with unrestricted network access' : wrappedCommand.requiresUnsandboxConfirmation ? 'Switched command to unsandboxed execution because the command includes a domain that is not in the sandbox allowlist' : 'Wrapped command for sandbox execution',
			forDisplay: options.commandLine, // show the command that is passed as input (after prior rewrites like cd prefix stripping)
			isSandboxWrapped: wrappedCommand.isSandboxWrapped,
			requiresUnsandboxConfirmation: wrappedCommand.requiresUnsandboxConfirmation,
			requiresAllowNetworkConfirmation: wrappedCommand.requiresAllowNetworkConfirmation,
```

自动批准看的是 `forDisplay` 优先的那一行。规则通过后，`isFinalAutoApproved` 为真，确认条件就不再看这两个标志。沙箱自动批准本身排除了放开网络，规则批准用 `||` 把它加回来了：

```1148:1148:src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts
		const commandLine = forDisplayCommand ?? rewrittenCommand ?? args.command;
```

```1210:1211:src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts
		const isSandboxAutoApproved = isSandboxEnabled && toolSpecificData.commandLine.isSandboxWrapped === true && !requiresAllowNetworkConfirmation && this._allowSandboxAutoApprove;
		const isFinalAutoApproved = isSandboxAutoApproved || isAutoApprovedByRules;
```

```1291:1318:src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts
		const shouldShowConfirmation = (!isFinalAutoApproved && (!isSessionAutoApproved || requiresAllowNetworkConfirmation)) || context.forceConfirmationReason !== undefined;
		// ...
		const confirmationMessages = shouldShowConfirmation ? {
			title: confirmationTitle,
			message: confirmationMessage,
			disclaimer,
			allowAutoConfirm: undefined,
			terminalCustomActions: customActions,
		} : undefined;
```

`CommandLineSandboxAnalyzer.analyze` 在沙箱开或关时都只回设置项，不读 `requiresUnsandboxConfirmation` / `requiresAllowNetworkConfirmation`，因此它不会否决这次批准。真正下发的是改写后的 `toolEdited`：

```1921:1921:src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts
		const command = toolSpecificData.commandLine.userEdited ?? toolSpecificData.commandLine.toolEdited ?? toolSpecificData.commandLine.original;
```

允许列表批准的是展示出来的原命令。脱离沙箱和放开网络会换成另一条命令，这条路径在规则命中时把确认整段省掉。

- 方向：脱离沙箱或放开网络时强制确认，不要让规则自动批准单独放行。

### r13-2

- 严重度：中
- 症状：测试结果超过保留上限后，仍留在列表里的上一次 `LiveTestResult` 会被 dispose，完成事件和后续状态更新从这条结果上拆掉；被挤出列表的那次结果的订阅却留着。

`push` 先把新结果放进 `results`，超限时从末尾丢掉结果，同时从 `_resultsDisposables` 末尾丢掉 store，然后才把这次结果自己的 store 推进去。结果列表是新的在前，store 数组是按 push 顺序在后，两边的末尾不是同一条结果。上限是 128：

```21:21:src/vs/workbench/contrib/testing/common/testResultStorage.ts
export const RETAIN_MAX_RESULTS = 128;
```

```174:195:src/vs/workbench/contrib/testing/common/testResultService.ts
	public push<T extends ITestResult>(result: T): T {
		if (result.completedAt === undefined) {
			this.results.unshift(result);
		} else {
			const index = findFirstIdxMonotonousOrArrLen(this.results, r => r.completedAt !== undefined && r.completedAt <= result.completedAt!);
			this.results.splice(index, 0, result);
			this.persistScheduler.schedule();
		}

		this.hasAnyResults.set(true);
		if (this.results.length > RETAIN_MAX_RESULTS) {
			this.results.pop();
			this._resultsDisposables.pop()?.dispose();
		}

		const ds = new DisposableStore();
		this._resultsDisposables.push(ds);

		if (result instanceof LiveTestResult) {
			ds.add(result);
```

被 dispose 的 store 持有整个 `LiveTestResult`。它的完成和变更发射器注册在 Disposable 上，dispose 之后 `onComplete` / `onChange` 不再转发：

```280:291:src/vs/workbench/contrib/testing/common/testResult.ts
export class LiveTestResult extends Disposable implements ITestResult {
	private readonly completeEmitter = this._register(new Emitter<void>());
	private readonly newTaskEmitter = this._register(new Emitter<number>());
	private readonly endTaskEmitter = this._register(new Emitter<number>());
	private readonly changeEmitter = this._register(new Emitter<TestResultItemChange>());
	// ...
	public readonly onChange = this.changeEmitter.event;
	public readonly onComplete = this.completeEmitter.event;
```

第 129 次 `push` 会从结果列表丢掉最旧的一条，却 dispose 掉 store 数组末尾那条，也就是仍在列表中的上一次运行。那次运行的完成回调和界面向前的 `onChange` 一起被拆掉。

- 方向：先登记本次 store，再按同一次下标同时丢掉结果和它自己的 store。

### r13-3

- 严重度：中
- 症状：同一次调试会话重叠重启时，被取代的 `initialize` 以成功结束，调用方继续对当前适配器发 launch/attach。

`restartSession` 把会话放进 `restartingSessions`，没有先看它是否已在重启。不支持 restart 请求的会话会在断开后再次 `launchOrAttachToSession`：

```899:900:src/vs/workbench/contrib/debug/browser/debugService.ts
		const doRestart = async (fn: () => Promise<boolean | undefined>) => {
			this.restartingSessions.add(session);
```

```949:970:src/vs/workbench/contrib/debug/browser/debugService.ts
		const shouldFocus = !!this.viewModel.focusedSession && session.getId() === this.viewModel.focusedSession.getId();
		return doRestart(async () => {
			if (isAutoRestart) {
				await session.disconnect(true);
			} else {
				await session.terminate(true);
			}

			return new Promise<boolean>((c, e) => {
				setTimeout(async () => {
					// ...
					try {
						await this.launchOrAttachToSession(session, shouldFocus);
```

`initialize` 用代数丢掉过期尝试，但代数不一致时直接 `return`。调用方把这当成初始化成功，紧接着 `launchOrAttach`：

```369:372:src/vs/workbench/contrib/debug/browser/debugSession.ts
			await this.raw.start();
			if (generation !== this.initializeGeneration) {
				return;
			}
```

```393:405:src/vs/workbench/contrib/debug/browser/debugSession.ts
			if (generation !== this.initializeGeneration) {
				return;
			}
			// ...
		} catch (err) {
			if (generation !== this.initializeGeneration) {
				this.disposeUnclaimedDebugAdapter(unclaimedAdapter);
				return;
			}
```

```720:722:src/vs/workbench/contrib/debug/browser/debugService.ts
		try {
			await session.initialize(dbgr!);
			await session.launchOrAttach(session.configuration);
```

后一次 `initialize` 已经执行过 `shutdown` 并换上新的 `this.raw` 时，先一次调用仍会成功返回，并向这个新适配器再发一次 launch/attach。适配器会收到重叠的启动请求。

- 方向：代数已经过期时让 `initialize` 失败，调用方不要继续 `launchOrAttach`。

### r13-4

- 严重度：中
- 症状：一次测试结果的索引先于结果文件落盘。文件没写上之后，后来的保存看到索引里已有这条 id，就跳过重写；下次读盘时这条结果被丢掉。

`persist` 把新文件放进 `todo`，先 `stored.store(toStore)`，再等文件写完。索引里已经有的 id 只扣字节预算，不再写文件：

```125:149:src/vs/workbench/contrib/testing/common/testResultStorage.ts
			const existingBytes = toDelete.get(result.id);
			if (existingBytes !== undefined) {
				toDelete.delete(result.id);
				toStore.push({ id: result.id, rev: currentRevision, bytes: existingBytes });
				budget -= existingBytes;
				continue;
			}
			// ...
			todo.push(this.storeForResultId(result.id, obj));
			toStore.push({ id: result.id, rev: currentRevision, bytes: contents.byteLength });
			budget -= contents.byteLength;
		}
		// ...
		this.stored.store(toStore);
		await Promise.all(todo);
```

读的时候文件缺失或反序列化失败就丢掉该条，并回写更短的索引：

```76:91:src/vs/workbench/contrib/testing/common/testResultStorage.ts
			try {
				const contents = await this.readForResultId(rec.id);
				if (!contents) {
					return undefined;
				}

				return { rec, result: new HydratedTestResult(this.uriIdentityService, contents) };
			} catch (e) {
				this.logService.warn(`Error deserializing stored test result ${rec.id}`, e);
				return undefined;
			}
		}));

		const defined = results.filter(isDefined);
		if (defined.length !== results.length) {
			this.stored.store(defined.map(({ rec }) => rec));
		}
```

调度侧也没有等这次 `persist` 结束：

```272:276:src/vs/workbench/contrib/testing/common/testResultService.ts
	protected async persistImmediately() {
		// ensure results are loaded before persisting to avoid deleting once
		// that we don't have yet.
		await this.loadResults();
		this.storage.persist(this.results);
	}
```

索引已经宣称文件存在，随后的保存不会再补写。崩溃或 `storeForResultId` 失败之后，这条已完成的测试结果在下次加载时消失。

- 方向：文件写成功后再提交索引；索引里有 id 但文件读不到时要重写，不要直接跳过。

## 实际打开的文件

- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminal/browser/universeAgentPtyTerminal.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminal/test/browser/terminalProcessManager.test.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineRewriter/commandLineSandboxRewriter.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/commandLineSandboxAnalyzer.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/commandLineAutoApproveAnalyzer.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/monitoring/outputMonitor.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/executeStrategy/basicExecuteStrategy.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/notebook/browser/services/notebookExecutionServiceImpl.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/notebook/browser/services/notebookExecutionStateServiceImpl.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/notebook/common/model/notebookTextModel.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/replNotebook/browser/replEditor.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/debug/browser/debugSession.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/debug/browser/debugService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/debug/browser/debugMemory.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/testing/common/testResultService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/testing/common/testResultStorage.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/testing/common/testResult.ts`
