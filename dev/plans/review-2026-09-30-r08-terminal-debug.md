---
title: "审查 r08：terminal-debug"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "Run to Line 会拆掉临时断点或继续错线程；重跑任务漏掉新变量；测试在保存前启动；忙终端上的 runCommand 把命令写进前台进程。"
---

# 发现

## r08-1 中
- 症状：多会话时对某一行执行 Run to Line，临时断点在目标线程刚开始继续时就被删掉，程序不会停在那一行。
- 位置：`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 1382–1416 行
- 引用：

```
1382|		const removeTempBreakPoint = (state: State): boolean => {
1383|			if (state === State.Stopped || state === State.Inactive) {
1384|				if (breakpointToRemove) {
1385|					this.removeBreakpoints(breakpointToRemove.getId());
1386|				}
1387|				return true;
1388|			}
1389|			return false;
1390|		};
1391|
1392|		await addTempBreakPoint();
1393|		if (this.state === State.Inactive) {
1394|			// If no session exists start the debugger
1395|			const { launch, name, getConfig } = this.getConfigurationManager().selectedConfiguration;
1396|			const config = await getConfig();
1397|			const configOrName = config ? Object.assign(deepClone(config), {}) : name;
1398|			const listener = this.onDidChangeState(state => {
1399|				if (removeTempBreakPoint(state)) {
1400|					listener.dispose();
1401|				}
1402|			});
1403|			await this.startDebugging(launch, configOrName, undefined, true);
1404|		}
1405|		if (this.state === State.Stopped) {
1406|			const focusedSession = this.getViewModel().focusedSession;
1407|			if (!focusedSession || !threadToContinue) {
1408|				return;
1409|			}
1410|
1411|			const listener = threadToContinue.session.onDidChangeState(() => {
1412|				if (removeTempBreakPoint(focusedSession.state)) {
1413|					listener.dispose();
1414|				}
1415|			});
1416|			await threadToContinue.continue();
```

- 为什么是问题：`addAndValidateBreakpoints` 可以选出另一个会话里的线程，并把它赋给 `threadToContinue`。监听器挂在被继续的会话上，删除条件读的却是 `focusedSession.state`。会话状态由焦点线程决定（`debugSession.ts` 第 285–290 行）：焦点线程仍停着时，状态保持 `Stopped`。被继续的会话一收到 continued、在 `debugSession.ts` 第 1190 行发出 `onDidChangeState`，回调看到的焦点会话仍是 `Stopped`，于是立刻 `removeBreakpoints`。临时断点在命中前就没了。
- 方向：用被继续会话这次状态变化后的状态决定是否删除临时断点。

## r08-2 中
- 症状：同一个断点被多个调试会话验证时，Run to Line 会继续先被扫到的那个会话里任意一个已暂停线程，而不是停在目标文件里的线程。
- 位置：`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 1445–1487 行
- 引用：

```
1445|		const enum Score {
1446|			/** The focused thread */
1447|			Focused,
1448|			/** Any other stopped thread of a session that verified the bp */
1449|			Verified,
1450|			/** Any thread that verified and paused in the same file */
1451|			VerifiedAndPausedInFile,
1452|			/** The focused thread if it verified the breakpoint */
1453|			VerifiedAndFocused,
1454|		}
1455|
1456|		let bestThread = viewModel.focusedThread;
1457|		let bestScore = Score.Focused;
1458|		for (const sessionId of breakpoint.sessionsThatVerified) {
1459|			const session = debugModel.getSession(sessionId);
1460|			if (!session) {
1461|				continue;
1462|			}
1463|
1464|			const threads = session.getAllThreads().filter(t => t.stopped);
1465|			if (bestScore < Score.VerifiedAndFocused) {
1466|				if (viewModel.focusedThread && threads.includes(viewModel.focusedThread)) {
1467|					bestThread = viewModel.focusedThread;
1468|					bestScore = Score.VerifiedAndFocused;
1469|				}
1470|			}
1471|
1472|			if (bestScore < Score.VerifiedAndPausedInFile) {
1473|				const pausedInThisFile = threads.find(t => {
1474|					const top = t.getTopStackFrame();
1475|					return top && this.uriIdentityService.extUri.isEqual(top.source.uri, uri);
1476|				});
1477|
1478|				if (pausedInThisFile) {
1479|					bestThread = pausedInThisFile;
1480|					bestScore = Score.VerifiedAndPausedInFile;
1481|				}
1482|			}
1483|
1484|			if (bestScore < Score.Verified) {
1485|				bestThread = threads[0];
1486|				bestScore = Score.VerifiedAndPausedInFile;
1487|			}
```

- 为什么是问题：`sessionsThatVerified` 按验证顺序遍历（`debugModel.ts` 第 955–963 行）。某一会话只要有暂停线程、且栈顶不在目标文件，就会把分数写成 `VerifiedAndPausedInFile`。后面的会话即使有线程真的停在该文件，也会因为 `bestScore < Score.VerifiedAndPausedInFile` 不再入选。`runTo` 于是继续错误的线程。该会话若没有暂停线程，`threads[0]` 还是 `undefined`，分数同样被抬高，后面停在文件里的线程一样被跳过。
- 方向：任意暂停线程只记 `Score.Verified`，好让后续「停在目标文件」的线程仍能胜出。

## r08-3 中
- 症状：任务把 `reevaluateOnRerun` 设为 false 后，命令里新增了 `${input:…}` 一类变量再点 Rerun，不会重新收集这个变量，任务按上一轮的变量表执行。
- 位置：`src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts` 第 855–877 行
- 引用：

```
855|		// Check that the task hasn't changed to include new variables
856|		let hasAllVariables = true;
857|		variables.forEach(value => {
858|			if (Object.hasOwn(lastTask.getVerifiedTask().resolvedVariables, value.substring(2, value.length - 1))) {
859|				hasAllVariables = false;
860|			}
861|		});
862|
863|		if (!hasAllVariables) {
864|			return this._acquireInput(lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().workspaceFolder, task, variables, alreadyResolved).then((resolvedVariables) => {
865|				if (!resolvedVariables) {
866|					// Allows the taskExecutions array to be updated in the extension host
867|					this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
868|					return { exitCode: 0 };
869|				}
870|				thisRun.resolvedVariables = resolvedVariables;
871|				return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, resolvedVariables.variables, this._configurationResolverService), workspaceFolder, thisRun);
872|			}, reason => {
873|				return Promise.reject(reason);
874|			});
875|		} else {
876|			thisRun.resolvedVariables = lastTask.getVerifiedTask().resolvedVariables;
877|			return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().resolvedVariables.variables, this._configurationResolverService), workspaceFolder, thisRun);
```

- 为什么是问题：只有 `reevaluateOnRerun === false` 时 `rerun()` 才会把 `_isRerun` 设为 true（第 316–318 行），从而走进 `_reexecuteCommand`。`resolvedVariables` 的类型是 `{ process?: string; variables: Map<string, string> }`（`taskSystem.ts` 第 122–124 行），变量名在 Map 里，不是对象自身的属性。`Object.hasOwn` 看不到 `workspaceFolder`、`input:foo` 这种键，`hasAllVariables` 一直为 true，于是走 else，跳过 `_acquireInput` 里的 `resolveWithInteraction`（第 783 行）。新变量不会再弹输入；`VariableResolver._replacer`（第 103–112 行）只在旧表里查找，找不到才调用 `resolveAsync`。
- 方向：用 `resolvedVariables.variables` 判断是否缺变量，缺了才重新 `_acquireInput`。

## r08-4 中
- 症状：`testing.saveBeforeTest` 为默认 true 时，编辑器里还有未保存修改就运行测试，测试会在保存完成前启动，跑到的是磁盘上的旧内容。
- 位置：`src/vs/workbench/contrib/testing/common/testServiceImpl.ts` 第 270–288 行
- 引用：

```
270|			const byController = groupBy(req.targets, (a, b) => a.controllerId.localeCompare(b.controllerId));
271|			const requests = byController.map(
272|				group => this.getTestController(group[0].controllerId)?.runTests(
273|					group.map(controlReq => ({
274|						runId: result.id,
275|						excludeExtIds: req.exclude!.filter(t => !controlReq.testIds.includes(t)),
276|						profileId: controlReq.profileId,
277|						controllerId: controlReq.controllerId,
278|						testIds: controlReq.testIds,
279|					})),
280|					cancelSource.token,
281|				).then(result => {
282|					const errs = result.map(r => r.error).filter(isDefined);
283|					if (errs.length) {
284|						this.notificationService.error(localize('testError', 'An error occurred attempting to run tests: {0}', errs.join(' ')));
285|					}
286|				})
287|			);
288|			await this.saveAllBeforeTest(req);
```

- 为什么是问题：`map` 回调会立刻调用 `runTests`。`saveAllBeforeTest`（第 439–446 行）要到下一行才 `await`，其中 `testing.saveBeforeTest` 默认是 true（`configuration.ts` 第 142–145 行），才会 `editorService.saveAll()`。保存没有成为启动测试的前置条件，扩展宿主可以在脏缓冲落盘前开始读文件，结果对的是旧内容。`preserveFocus === true` 时这个函数还会直接返回，那条路径本身不保存。
- 方向：先 `await this.saveAllBeforeTest(req)`，再调用 `runTests`。

## r08-5 中
- 症状：终端已有 shell integration、前台进程还在跑且提示输入为空时，`runCommand` 等到超时后不发 Ctrl+C，把新命令写进前台进程的标准输入，shell 不会执行它。
- 位置：`src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` 第 1035–1080 行
- 引用：

```
1035|		if (!commandDetection || commandDetection.promptInputModel.state !== PromptInputState.Input) {
1036|			const store = new DisposableStore();
1037|
1038|			await Promise.race([
1039|				new Promise<void>(r => {
1040|					const waitForPromptInput = (capability: ICommandDetectionCapability) => {
1041|						commandDetection = capability;
1042|						if (capability.promptInputModel.state === PromptInputState.Input) {
1043|							r();
1044|						} else {
1045|							store.add(capability.promptInputModel.onDidStartInput(() => {
1046|								r();
1047|							}));
1048|						}
1049|					};
1050|
1051|					if (commandDetection) {
1052|						waitForPromptInput(commandDetection);
1053|					} else {
1054|						store.add(this.capabilities.onDidAddCommandDetectionCapability(waitForPromptInput));
1055|					}
1056|				}),
1057|				timeout(timeoutMs)
1058|			]);
1059|			store.dispose();
1060|		}
1061|
1062|		// If a command ID was provided and we have command detection, set it as the next command ID
1063|		// so it will be used when the shell sends the command start sequence
1064|		if (commandId && commandDetection) {
1065|			const commandLineToReport = commandLineForMetadata ?? commandLine;
1066|			this.xterm?.shellIntegration.setNextCommandId(commandLineToReport, commandId);
1067|			await this._processManager.setNextCommandId(commandLineToReport, commandId);
1068|		}
1069|
1070|		// Determine whether to send ETX (ctrl+c) before running the command. Only do this when the
1071|		// command will be executed immediately or when command detection shows the prompt contains text.
1072|		if (shouldExecute && (!commandDetection || commandDetection.promptInputModel.value.length > 0)) {
1073|			await this.sendText('\x03', false);
1074|			// Wait a little before running the command to avoid the sequences being echoed while the ^C
1075|			// is being evaluated
1076|			await timeout(100);
1077|		}
1078|		// By default, use bracketed paste mode only when not running the command; callers can override
1079|		// this by explicitly enabling it via the bracketedPasteMode argument.
1080|		await this.sendText(commandLine, shouldExecute, !shouldExecute || forceBracketedPasteMode);
```

- 为什么是问题：等待只在进入 `PromptInputState.Input` 或超时二者谁先到。超时之后没有再看 state。`shouldExecute` 为 true、shell integration 已经存在、并且 `promptInputModel.value` 为空时，第 1072 行的条件为假，不会发送 `\x03`。第 1080 行仍然把命令和回车写进 pty。提示符还没回到 Input、输入行为空（前台进程占着终端）时，这段文本成为该进程的标准输入，不会作为新的 shell 命令执行。
- 方向：超时后若状态仍不是 Input，先发 Ctrl+C，或在确认回到提示符之前不要 `sendText`。
