---
title: "审查 r11：debug-scm"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；运行到光标会留下断点，配置取消后仍会重启，停止启动后仍会建会话，合并完成不看保存结果，preserveFocus 会跳过测试前保存。"
---
# 审查 r11：debug-scm

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r11-1 中
- 症状：会话正在运行时执行「运行到光标」，或冷启动后焦点会话仍是 Running，临时断点会留在目标文件上；已停止但找不到可继续的线程时同样留着。
- 位置：`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 1400–1469 行
- 引用：

```1428:1469:src/vs/workbench/contrib/debug/browser/debugService.ts
		if (this.state === State.Stopped) {
			const threadToContinue = pendingThread
				?? this.getViewModel().focusedSession?.getAllThreads().find(candidate => candidate.stopped);
			if (!threadToContinue) {
				return;
			}

			if (startedInactive) {
				const top = threadToContinue.getTopStackFrame();
				if (top && top.range.startLineNumber === lineNumber && this.uriIdentityService.extUri.isEqual(top.source.uri, uri)) {
					removeTempBreakPoint(State.Stopped);
					return;
				}
			}

			let sawTargetRunning = false;
			const disposeTempBreakpointListener = (): void => {
				if (breakpointToRemove) {
					this.removeBreakpoints(breakpointToRemove.getId());
					breakpointToRemove = undefined;
				}
				listener.dispose();
			};
			const listener = threadToContinue.session.onDidChangeState(() => {
				if (threadToContinue.session.state === State.Inactive) {
					disposeTempBreakpointListener();
					return;
				}
				if (!threadToContinue.stopped) {
					sawTargetRunning = true;
					return;
				}
				if (sawTargetRunning) {
					disposeTempBreakpointListener();
				}
			});
			await threadToContinue.continue();
			if (threadToContinue.stopped && !sawTargetRunning) {
				disposeTempBreakpointListener();
			}
		}
	}
```

- 为什么是问题：`addTempBreakPoint` 在第 1400 行就通过 `addBreakpoints` 写入普通断点，第三个参数只是不朗读，没有临时标记。`this.state` 取的是焦点会话状态（第 265–268 行）。删除逻辑只挂在 `State.Stopped` 里面：冷启动成功后会话通常已是 Running，函数在第 1469 行结束，之后命中该行也不会再 `removeBreakpoints`。第 1431–1432 行在已停止但没有线程时直接返回，断点同样留下。用户之后继续执行会再次停在这行。
- 方向：Running、没有可继续线程、以及冷启动后尚未停在目标行时，都要在命中目标或会话结束时删掉这次加的断点。

## r11-2 中
- 症状：重启时变量替换被取消、替换失败，或配置提供者返回空结果后，支持 restart 请求的会话仍会重启，由测试拉起的会话仍会再跑一遍测试。
- 位置：`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 872–934 行
- 引用：

```881:934:src/vs/workbench/contrib/debug/browser/debugService.ts
		if (resolved) {
			session.setConfiguration({ resolved, unresolved });
		}
		session.configuration.__restart = restartData;

		const doRestart = async (fn: () => Promise<boolean | undefined>) => {
			this.restartingSessions.add(session);
			let didRestart = false;
			try {
				didRestart = (await fn()) !== false;
			} catch (e) {
				didRestart = false;
				throw e;
			} finally {
				this.restartingSessions.delete(session);
				// we previously may have issued an onDidEndSession with restart: true,
				// assuming the adapter exited (in `registerSessionListeners`). But the
				// restart failed, so emit the final termination now.
				if (!didRestart) {
					this._onDidEndSession.fire({ session, restart: false });
				}
			}
		};

		for (const breakpoint of this.model.getBreakpoints({ triggeredOnly: true })) {
			breakpoint.setSessionDidTrigger(session.getId(), false);
		}

		// For debug sessions spawned by test runs, cancel the test run and stop
		// the session, then start the test run again; tests have no notion of restarts.
		if (session.correlatedTestRun) {
			if (!session.correlatedTestRun.completedAt) {
				session.cancelCorrelatedTestRun();
				await Event.toPromise(session.correlatedTestRun.onComplete);
				// todo@connor4312 is there any reason to wait for the debug session to
				// terminate? I don't think so, test extension should already handle any
				// state conflicts...
			}

			this.testService.runResolvedTests(session.correlatedTestRun.request);
			return;
		}

		if (session.capabilities.supportsRestartRequest) {
			const taskResult = await runTasks();
			if (taskResult === TaskRunResult.Success) {
				await doRestart(async () => {
					await session.restart();
					return true;
				});
			}

			return;
		}
```

- 为什么是问题：`launch.json` 已变时才会进入这段替换。`substituteVariables` 在用户取消或出错时返回 `undefined`（同文件第 1000–1003 行，注释写的是退出），提供者返回空时 `resolved` 被写成空，第 881 行因此不会 `setConfiguration`。关联测试分支仍 `runResolvedTests`，`supportsRestartRequest` 分支在前置任务成功时仍 `session.restart()`。同函数第 952–954 行在断开再拉起的路径上会因 `resolved` 为空放弃；新建会话在第 517–519 行对同一种取消直接返回 `false`。取消替换之后调试目标或测试仍被再次启动。
- 方向：解析结果为空或启动取消标记已置位时停住重启，不要再发 restart，也不要重跑关联测试。

## r11-3 中
- 症状：启动调试尚未产生会话时用户按停止，前置任务之后的配置解析若仍返回配置，调试会话仍会被创建。
- 位置：`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 522–595 行
- 引用：

```557:595:src/vs/workbench/contrib/debug/browser/debugService.ts
				const cfg = await this.configurationManager.resolveDebugConfigurationWithSubstitutedVariables(launch && launch.workspace ? launch.workspace.uri : undefined, resolvedConfig.type, resolvedConfig, initCancellationToken.token);
				if (!cfg) {
					if (launch && type && cfg === null && !initCancellationToken.token.isCancellationRequested) {	// show launch.json only for "config" being "null".
						await launch.openConfigFile({ preserveFocus: true, type }, initCancellationToken.token);
					}
					return false;
				}
				resolvedConfig = cfg;

				const dbg = this.adapterManager.getDebugger(resolvedConfig.type);
				if (!dbg || (configByProviders.request !== 'attach' && configByProviders.request !== 'launch')) {
					let message: string;
					if (configByProviders.request !== 'attach' && configByProviders.request !== 'launch') {
						message = configByProviders.request ? nls.localize('debugRequestNotSupported', "Attribute '{0}' has an unsupported value '{1}' in the chosen debug configuration.", 'request', configByProviders.request)
							: nls.localize('debugRequesMissing', "Attribute '{0}' is missing from the chosen debug configuration.", 'request');

					} else {
						message = resolvedConfig.type ? nls.localize('debugTypeNotSupported', "Configured debug type '{0}' is not supported.", resolvedConfig.type) :
							nls.localize('debugTypeMissing', "Missing property 'type' for the chosen launch configuration.");
					}

					const actionList: IAction[] = [];

					actionList.push(toAction({
						id: 'installAdditionalDebuggers',
						label: nls.localize({ key: 'installAdditionalDebuggers', comment: ['Placeholder is the debug type, so for example "node", "python"'] }, "Install {0} Extension", resolvedConfig.type),
						enabled: true,
						run: async () => this.commandService.executeCommand('debug.installAdditionalDebuggers', resolvedConfig?.type)
					}));

					await this.showError(message, actionList); return false;
				}

				if (!dbg.enabled) {
					await this.showError(debuggerDisabledMessage(dbg.type), []);
					return false;
				}

				const result = await this.doCreateSession(sessionId, launch?.workspace, { resolved: resolvedConfig, unresolved: unresolvedConfig }, options, userConfirmedConcurrentSession);
```

- 为什么是问题：第 522–524 行在前置任务之前会因 `initCancellationToken` 已取消而返回。第 557 行再次等待解析之后没有同样的判断。此时会话还没进模型，`stopSession` 第 974–979 行会 `cancelTokens`。`resolveDebugConfigurationWithSubstitutedVariables`（`debugConfigurationManager.ts` 第 176–189 行）把标记交给提供者，提供者不看标记时会把传入配置原样返回。`cfg` 因此为真，第 595 行仍 `doCreateSession`，停止之后调试仍启动。
- 方向：调用 `doCreateSession` 之前再读一次取消标记，已取消则返回 `false`。

## r11-4 高
- 症状：完成合并时，结果文件没有确认写入也会被当成已完成；临时文件模式在保存前就把合并编辑器标成未修改。
- 位置：`src/vs/workbench/contrib/mergeEditor/browser/mergeEditorInputModel.ts` 第 161–167 行
- 引用：

```161:167:src/vs/workbench/contrib/mergeEditor/browser/mergeEditorInputModel.ts
	async accept(): Promise<void> {
		const value = await this.model.resultTextModel.getValue();
		this.result.textEditorModel.setValue(value);
		this.savedAltVersionId.set(this.model.resultTextModel.getAlternativeVersionId(), undefined);
		await this.textFileService.save(this.result.textEditorModel.uri);
		this.finished = true;
	}
```

- 为什么是问题：`isDirty` 比较的是结果模型版本和 `savedAltVersionId`（第 152 行）。版本在 `save` 返回前就被对齐，保存被拒绝或失败后编辑器也不再是脏的。`save` 的返回值没有使用，只要不抛错，`finished` 就是 `true`。`AcceptMerge`（`commands.ts` 第 658–663 行）随后关闭编辑器并返回 `{ successful: true }`。关闭确认看到未修改就走 `DONT_SAVE`（第 224–233 行），对临时模型执行 `_discard`。工作区模式的 `accept`（第 418–420 行）先 `reportClose(true)` 再 `save`，同样不看保存结果，完成命令仍回报成功。
- 方向：只有保存确认写入后才标记完成并返回 `successful: true`；保存失败要保留脏状态。

## r11-5 中
- 症状：`testing.saveBeforeTest` 开启时，带 `preserveFocus` 的测试运行不保存脏编辑器就执行，结果对的是磁盘上的旧内容。
- 位置：`src/vs/workbench/contrib/testing/common/testServiceImpl.ts` 第 442–456 行
- 引用：

```442:456:src/vs/workbench/contrib/testing/common/testServiceImpl.ts
	private async saveAllBeforeTest(req: ResolvedTestRunRequest, configurationService: IConfigurationService = this.configurationService, editorService: IEditorService = this.editorService): Promise<boolean> {
		if (req.preserveFocus === true) {
			return true;
		}
		const saveBeforeTest = getTestingConfiguration(configurationService, TestingConfigKeys.SaveBeforeTest);
		if (saveBeforeTest) {
			try {
				const { success } = await editorService.saveAll();
				return success;
			} catch {
				return false;
			}
		}
		return true;
	}
```

- 为什么是问题：`testing.saveBeforeTest` 默认是 true（`configuration.ts` 第 142–145 行），含义是跑测试前保存全部脏编辑器。`preserveFocus` 在结果进度里只用来避免自动打开结果视图（`testingProgressUiService.ts` 第 50–52 行）。聊天工具因此带 `preserveFocus: true` 调用 `runTests`（`testingChatAgentTool.ts` 第 233–236 行），保存被跳过，测试按未保存前的文件执行。`testService.test.ts` 第 351–356 行断言 `saveAll` 次数为 0 且 `runTests` 仍为 1，把这次跳过锁进回归。
- 方向：`preserveFocus` 只控制焦点；保存设置开启时，这类运行也要先 `saveAll` 成功再 `runTests`。
