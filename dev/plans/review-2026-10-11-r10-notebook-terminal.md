---
title: "审查 r10：notebook-terminal"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；原始笔记本引用归零时会 dispose 仍在编辑的文档。"
---

## r10-1 高

- 症状：同一 URI 的笔记本已经在服务里时，原始模型引用归零会把这份文档 dispose 掉，单元格被清空，撤销记录被删掉。
- 位置：`src/vs/workbench/contrib/notebook/browser/diff/inlineDiff/notebookOriginalModelRefFactory.ts` 第 31–58 行
- 引用：

```ts
const model = this.notebookService.getNotebookTextModel(uri);
if (model) {
	return model;
}
```

```ts
// Finally we can dispose the model
model.dispose();
```

`NotebookTextModel.dispose`（`src/vs/workbench/contrib/notebook/common/model/notebookTextModel.ts` 第 412–426 行）接着做：

```ts
this._isDisposed = true;
this._onWillDispose.fire();
this._undoService.removeElements(this.uri);
dispose(this._cellListeners.values());
this._cellListeners.clear();
dispose(this._cells);
this._cells = [];
```

- 为什么是问题：`createReferencedObject` 发现服务里已有该 URI 的模型就原样返回，没有记下所有权。`destroyReferencedObject` 在引用归零时一律 `model.dispose()`。编辑器和工作副本持有的是同一个 `NotebookTextModel`，这次 dispose 会清掉单元格和该 URI 的撤销栈。
- 方向：只 dispose 自己 `createNotebookTextModel` 创建的模型，借来的模型在引用归零时保留。

## r10-2 高

- 症状：沙箱自动批准关掉后，只要终端自动批准仍为开启，运行终端命令不再要求确认；拒绝规则和工作区外写入拦截也不再挡住自动执行。
- 位置：`src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts` 第 1192–1280 行
- 引用：

```ts
const isSandboxAutoApproved = isSandboxEnabled && toolSpecificData.commandLine.isSandboxWrapped === true && !requiresAllowNetworkConfirmation && this._allowSandboxAutoApprove;
const isFinalAutoApproved = isSandboxAutoApproved || isAutoApprovedByRules || commandLineAnalyzerResults.some(e => e.forceAutoApproval);
const shouldShowConfirmation = (!isFinalAutoApproved && (!isSessionAutoApproved || requiresAllowNetworkConfirmation)) || context.forceConfirmationReason !== undefined;
```

`_allowSandboxAutoApprove`（同文件第 794–796 行）只有设置严格等于 `true` 才为真。沙箱分析器（`src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/commandLineSandboxAnalyzer.ts` 第 20–34 行）另写：

```ts
return this._configurationService.getValue(TerminalChatAgentToolsSettingId.EnableAutoApprove) !== false;
```

```ts
forceAutoApproval: !_options.requiresUnsandboxConfirmation && !_options.requiresAllowNetworkConfirmation && isAutoApproveEnabled,
```

`chat.tools.terminal.enableAutoApprove` 的默认值是 `true`（`terminalChatAgentToolsConfiguration.ts` 第 88–92 行）。沙箱自动批准项的说明是关闭后走原有审批（同文件第 601–604 行，`default: true`）。

- 为什么是问题：原有审批看 `isAutoApprovedByRules`，那里要求每个分析器都没有拒绝，并且 `isAutoApproveAllowed` 全为真。`forceAutoApproval` 不读沙箱自动批准开关，也不读这些拒绝结果。沙箱服务报告已启用、且这次没有要求离开沙箱或放开网络时，`isFinalAutoApproved` 为真，`confirmationMessages` 为 undefined。`invoke` 随后按 `toolSpecificData` 里的命令执行，不再做这道审批。
- 方向：`forceAutoApproval` 只在沙箱自动批准开启且命令确实包进沙箱时生效，并仍然服从拒绝规则和文件写入拦截。

## r10-3 中

- 症状：执行单元格时，选内核或内核请求抛错后，单元格一直停在未确认或执行中。
- 位置：`src/vs/workbench/contrib/notebook/browser/services/notebookExecutionServiceImpl.ts` 第 49–91 行
- 引用：

```ts
for (const cell of cellsArr) {
	const cellExe = this._notebookExecutionStateService.getCellExecution(cell.uri);
	if (!!cellExe) {
		continue;
	}
	cellExecutions.push([cell, this._notebookExecutionStateService.createCellExecution(notebook.uri, cell.handle)]);
}

const kernel = await KernelPickerMRUStrategy.resolveKernel(notebook, this._notebookKernelService, this._notebookKernelHistoryService, this._commandService);

if (!kernel) {
	cellExecutions.forEach(cellExe => cellExe[1].complete({}));
	return;
}
```

```ts
await kernel.executeNotebookCellsRequest(notebook.uri, validCellExecutions.map(c => c.cellHandle));
const unconfirmed = validCellExecutions.filter(exe => exe.state === NotebookCellExecutionState.Unconfirmed);
unconfirmed.forEach(exe => exe.complete({}));
```

- 为什么是问题：`createCellExecution` 发生在 `resolveKernel` 和 `executeNotebookCellsRequest` 之前。只有内核解析结果为空时才会 `complete`。`resolveKernel` 里会 `executeCommand`，这个调用或后面的执行请求一旦抛错，已经创建的 execution 没有 `finally` 收尾，状态服务里会一直留着。
- 方向：创建 execution 之后用 `try/finally`，失败路径上把这批 execution `complete` 掉。

## r10-4 中

- 症状：内核声明支持 interrupt 时，删掉还没进入 Executing 的单元格后，执行状态仍留在笔记本上。
- 位置：`src/vs/workbench/contrib/notebook/browser/services/notebookExecutionStateServiceImpl.ts` 第 362–393 行
- 引用：

```ts
if (exe?.state === NotebookCellExecutionState.Executing) {
	executingDeletedHandles.add(h);
} else if (exe) {
	pendingDeletedHandles.add(h);
}
```

```ts
const implementsInterrupt = kernel.implementsInterrupt;
const handlesToCancel = implementsInterrupt ? [...executingDeletedHandles] : [...executingDeletedHandles, ...pendingDeletedHandles];
if (handlesToCancel.length) {
	kernel.cancelNotebookCellExecution(this._notebookModel.uri, handlesToCancel);
}
```

- 为什么是问题：未确认和 Pending 都进 `pendingDeletedHandles`。内核 `implementsInterrupt` 为真时，这些句柄不会发给 `cancelNotebookCellExecution`，函数里也没有本地 `complete`。单元格已经从文档移除，内核若还没接过这次执行，就不会再回报完成，执行表里会一直留着这条记录。没有选中内核时，整个取消分支被跳过，正在执行的句柄同样不会在本地结束。
- 方向：单元格删除后，对尚未在内核中执行的 execution 本地结束；interrupt 只用于已经处于 Executing 的句柄。

## r10-5 中

- 症状：引擎终端已经打开之后，桥接再报错时，终端被当成正常退出关掉，错误说明不会出现。
- 位置：`src/vs/workbench/contrib/terminal/browser/universeAgentPtyTerminal.ts` 第 173–185 行
- 引用：

```ts
case 'sessionClosed':
	if (!this._launch.isSettled) {
		this._launch.complete({ message: 'Pty session closed' });
	} else {
		this._onProcessExit.fire(frame[1].exitCode);
	}
	break;
case 'error':
	if (!this._launch.isSettled) {
		this._launch.complete({ message: frame[1].message });
	} else {
		this._onProcessExit.fire(undefined);
	}
	break;
```

`parseExitResult`（`src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` 第 2916–2918 行）对 `undefined` 的处理是：

```ts
if (exitCodeOrError === undefined || exitCodeOrError === 0) {
	return { code: exitCodeOrError, message: undefined };
}
```

- 为什么是问题：启动前的 `error` 帧会把 `frame[1].message` 带回 `start()`。启动完成后的同一类帧改发 `undefined`。退出码 `undefined` 在这里没有文案，实例不会弹出失败通知，并按进程退出把终端关掉。用户看不到引擎报错内容。
- 方向：会话已经打开后的 `error` 帧带上失败信息再退出，不要发 `undefined`。
