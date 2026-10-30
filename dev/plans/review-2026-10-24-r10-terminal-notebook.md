---
title: "审查 r10：terminal-notebook"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；进程退出后命令会被当成已执行，活动终端和单元格输出会落到错误目标。"
---
# 审查 r10：terminal-notebook

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r10-1 高
- 症状：shell 已经退出或正在重启时，发往该终端的命令没有进入 pty，调用方仍收到已发送、已执行。
- 位置：`src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` 第 1432–1440 行
- 引用：
```1432:1440:src/vs/workbench/contrib/terminal/browser/terminalInstance.ts
		// Send it to the process
		this._logService.debug('sending data (vscode)', text);
		await this._processManager.write(text);
		this._onDidInputData.fire(text);
		this._onDidSendText.fire(text);
		this.xterm?.scrollToBottom();
		if (shouldExecute) {
			this._onDidExecuteText.fire();
		}
```
- 为什么是问题：`TerminalProcessManager._onExit`（`terminalProcessManager.ts` 第 780–781 行）只把 `_process` 置空，不清除 `shellProcessId`。`write`（第 731–739 行）在 `shellProcessId` 仍为真且 `_process` 为空时直接丢掉输入，不排队、不抛错。`sendText` 仍触发 `onDidSendText` 和 `onDidExecuteText`。`sendToTerminalTool.ts` 第 368–391 行据此回复 “Successfully sent command”。重启窗口里（`relaunch` 换了新的 `ptyProcessReady`，旧进程已空）同样把没写进去的命令标成已执行。
- 方向：进程已不在时让 `write`/`sendText` 报告失败，不要发已执行事件。失败用返回值表达，不要 throw 到没有 catch 的 xterm `onData` 与动作调用方。

## r10-2 高
- 症状：新命令还没送进 shell，工具结果却带上这条终端上一次进程的退出码；退出码为 0 时被当成成功。
- 位置：`src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/executeStrategy/richExecuteStrategy.ts` 第 95–101 行
- 引用：
```95:101:src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/executeStrategy/richExecuteStrategy.ts
			if (this._instance.exitCode !== undefined) {
				this._log(`Terminal pty already exited at strategy entry (code=${this._instance.exitCode})`);
				return {
					output: undefined,
					exitCode: this._instance.exitCode,
					additionalInformation: `Command exited with code ${this._instance.exitCode}`,
				};
			}
```
- 为什么是问题：返回发生在 `runCommand`（同文件第 179 行）之前，命令没有发送。`basicExecuteStrategy.ts` 第 110–116 行同样把旧退出码当成这次命令的结果。`runInTerminalTool.ts` 第 2309–2320 行写入 `terminalCommandState.exitCode`，第 2543 行只有非 0 才算错误，退出码 0 会作为成功的工具结果交回。shell 在 `_initTerminal` 返回之后、`execute` 之前退出（例如启动即退出）就会走上这条路径。
- 方向：pty 已退出时明确失败，不要把旧退出码记成这次命令的结果。

## r10-3 中
- 症状：在同一组里拖动分栏后，活动终端下标仍指向旧位置，标签和后续“活动终端”命令落到另一个实例。
- 位置：`src/vs/workbench/contrib/terminal/browser/terminalGroup.ts` 第 418–441 行
- 引用：
```418:441:src/vs/workbench/contrib/terminal/browser/terminalGroup.ts
	moveInstance(instances: SingleOrMany<ITerminalInstance>, index: number, position: 'before' | 'after'): void {
		instances = asArray(instances);
		const hasInvalidInstance = instances.some(instance => !this.terminalInstances.includes(instance));
		if (hasInvalidInstance) {
			return;
		}
		const insertIndex = position === 'before' ? index : index + 1;
		this._terminalInstances.splice(insertIndex, 0, ...instances);
		for (const item of instances) {
			const originSourceGroupIndex = position === 'after' ? this._terminalInstances.indexOf(item) : this._terminalInstances.lastIndexOf(item);
			this._terminalInstances.splice(originSourceGroupIndex, 1);
		}
		if (this._splitPaneContainer) {
			for (let i = 0; i < instances.length; i++) {
				const item = instances[i];
				const hadFocus = item.hasFocus;
				this._splitPaneContainer.remove(item);
				this._splitPaneContainer.split(item, index + (position === 'before' ? i : 0));
				if (hadFocus) {
					item.focus(true);
				}
			}
		}
		this._onInstancesChanged.fire();
	}
```
- 为什么是问题：重排后没有改 `_activeInstanceIndex`。`activeInstance`（第 334–338 行）仍用这个下标取实例。把未聚焦的分栏插到活动项前面时，下标 0 会从原来的活动终端变成刚插入的那个。`terminalTabsList.ts` 第 360 行用它画活动标签，`terminalTabbedView.ts` 第 626–638 行用它聚焦。被移动的实例自己有焦点时会靠 `focus` 把下标拨回去，没焦点的那次移动不会。
- 方向：重排后按实例重新解析活动下标，不要留着旧数字。

## r10-4 中
- 症状：整本笔记本从文件回读时，源码相同的单元格被当成同一个，输出写进前面那个单元格。
- 位置：`src/vs/workbench/contrib/notebook/common/model/notebookTextModel.ts` 第 521–531 行
- 引用：
```521:531:src/vs/workbench/contrib/notebook/common/model/notebookTextModel.ts
		const commonPrefix = this._commonPrefix(model.cells, model.cells.length, 0, cells, cells.length, 0, isExecuting);

		if (commonPrefix > 0) {
			for (let i = 0; i < commonPrefix; i++) {
				edits.push(
					{
						editType: CellEditType.Metadata,
						index: i,
						metadata: cells[i].metadata ?? {}
					},
					...this._computeOutputEdit(i, model.cells[i].outputs, cells[i].outputs)
				);
```
- 为什么是问题：`_commonPrefix`（第 595–601 行）用 `fastEqual` 对齐。`notebookCellTextModel.ts` 第 453–485 行的 `fastEqual` 只比语言、mime、种类、部分内部元数据和源码，不比输出，也不比单元格身份。文件在相同源码前插入另一个单元格时，前缀把新单元格的输出经 `_computeOutputEdit`（第 567–591 行）写到原单元格上。`notebookEditorModel.ts` 第 343–344 行的文件更新走 `reset`，就会这样串输出。
- 方向：对齐单元格时把输出身份算进去，不要只按源码前缀套用输出。

## r10-5 中
- 症状：后台终端上任意一次命令结束都会被说成这次命令已完成，隐藏终端随后被关掉，里面还在跑的进程一起停掉。
- 位置：`src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts` 第 3211–3237 行
- 引用：
```3211:3237:src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts
		store.add(commandDetection.onCommandFinished(command => {
			const execution = RunInTerminalTool._activeExecutions.get(termId);
			if (!execution) {
				disposeNotification();
				return;
			}

			if (handleSessionCancelled()) {
				return;
			}

			// Dispose after first notification to avoid chatty repeated messages
			// if the user runs additional commands via send_to_terminal.
			disposeNotification();

			const exitCode = command.exitCode;
			// A successful completion is already conveyed by "command completed";
			// only surface an exit code in chat when it provides failure context.
			const exitCodeText = exitCode !== undefined && exitCode !== 0 ? ` with exit code ${exitCode}` : '';
			const currentOutput = execution.getOutput();
			const isUserVisible = this._terminalService.foregroundInstances.includes(terminalInstance);
			const message = isUserVisible
				? `[Terminal ${termId} notification: command completed${exitCodeText}. Use send_to_terminal to send another command or kill_terminal to stop it.]\nTerminal output:\n${currentOutput}`
				: `[Terminal ${termId} notification: command completed${exitCodeText}. The terminal has been cleaned up.]\nTerminal output:\n${currentOutput}`;
```
- 为什么是问题：回调不比较 `command.command` 和本次启动的 `commandName`。退出码为 0 或缺失时，通知写成 “command completed”，不带失败码。同函数第 3260–3271 行接着 `execution.dispose()` 并 `terminalInstance.dispose()`。`basicExecuteStrategy.ts` 第 225–226 行已说明下一次结束事件可能不是这次请求的命令；这里仍把第一条结束事件当成这条后台命令结束。误报会关掉终端，正在跑的进程被杀掉。
- 方向：只在结束事件对上本次命令后再通知完成，不要因此关掉仍在跑的终端。
