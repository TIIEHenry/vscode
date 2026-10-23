---
title: "方案 r10：notebook-terminal"
type: plan
status: draft
phase: N/A
updated: 2026-10-23
summary: "hold 4，drop 0，weaken 1。r10-2 沙箱自动批准、r10-3 执行失败收尾、r10-4 删除未执行单元格已落；r10-1 借来的笔记本模型与 r10-5 终端 error 帧仍开。"
---

hold 4，drop 0，weaken 1。

> **落地记录（2026-10-23，部分）：** 本方案仍 `draft`。r10-2 / r10-3 / r10-4 已落；r10-1 / r10-5 仍开。已落子项只改到各自点名的位置，未动其余子项，也不把整份方案升 `implemented`。

## r10-1（weaken，降为低）
### 问题类
`OriginalNotebookModelReferenceCollection` 引用归零时仍 `dispose` 服务里已经存在的 `NotebookTextModel`。

反证：`INotebookOriginalModelReferenceFactory.getOrCreate` 在 `src/vs` 里只有定义（`notebookOriginalModelRefFactory.ts` 第 91–93 行）和 `registerSingleton`（`notebookInlineDiff.ts` 第 177 行），没有注入或调用。正在编辑的笔记本原始模型走 `ChatEditingModifiedNotebookEntry.create` 的 `resolver.resolve`（`chatEditingModifiedNotebookEntry.ts` 第 111–121 行）。那条引用集合在 `NotebookModelReferenceCollection.destroyReferencedObject`（`notebookEditorModelResolverServiceImpl.ts` 第 137–149 行）里先 `canDispose()`，脏模型还会在第 98–116 行多拿一份引用。内联 diff 的 `previousModel` 由 `NotebookInlineDiffWidget.show`（`notebookInlineDiffWidget.ts` 第 43、60 行）从外部传入，不经过这个工厂。因此「引用归零清掉正在编辑的文档」目前没有入口。工厂里的 dispose 行为本身还在。

### 不变量
只有本工厂经 `createNotebookTextModel` 创建的模型，引用归零才 `dispose`。`getNotebookTextModel` 借来的模型在引用归零后仍留在服务里，单元格和该 URI 的撤销栈不动。

### 要动的符号或文件
- `OriginalNotebookModelReferenceCollection.createReferencedObject`（`src/vs/workbench/contrib/notebook/browser/diff/inlineDiff/notebookOriginalModelRefFactory.ts` 第 31–44 行）：第 34–36 行命中已有模型时原样返回，没有所有权记录。
- 同文件 `destroyReferencedObject`（第 45–64 行）第 58 行对拿到的模型一律 `model.dispose()`。
- `NotebookTextModel.dispose`（`src/vs/workbench/contrib/notebook/common/model/notebookTextModel.ts` 第 412–428 行）会 `_undoService.removeElements`、清空单元格。这个方法保持不变。
- 在该集合上增加「本工厂创建」的 key 集合。只有走到 `createNotebookTextModel` 的 key 才加入。`destroyReferencedObject` 在 `modelsToDispose` 仍含该 key 时，仅对这个集合里的 key 调用 `dispose`；借来的模型直接返回。

### 明确不改
- `NotebookModelReferenceCollection` 的脏引用和 `canDispose()`。
- `ChatEditingModifiedNotebookEntry` 的快照 URI 与 `resolver.resolve`。
- `NotebookTextModel.dispose` 的清空语义。

### 本地验证
没有覆盖这个工厂的测试。新增：`getNotebookTextModel` 已有该 URI 时，引用归零后同一模型 `_isDisposed` 仍为 false、单元格还在；本工厂 `createNotebookTextModel` 创建的模型在引用归零后被 dispose。

## r10-2（hold，高）
### 问题类
`chat.agent.sandbox.allowAutoApprove` 关闭后，只要 `chat.tools.terminal.enableAutoApprove` 不是 false，沙箱里的命令仍会被强制自动批准，拒绝规则和工作区外写入拦截都不参与这道判断。

### 不变量
`AgentSandboxAllowAutoApprove` 为 false 时，不要再 `forceAutoApproval`，确认走现有审批。为 true 且命令已包进沙箱时，保持现在的强制自动批准，包括 `EnableAutoApprove` 为 false 仍自动批准。不要把 `analyzersIsAutoApproveAllowed` 加进这条开启路径：`runInTerminalTool.test.ts` 的 `should auto-approve sandboxed commands when sandbox auto approve is enabled` 设了 `AgentSandboxAllowAutoApprove=true` 且 `EnableAutoApprove=false`，加上这个条件会把该测试打红，也把发现稿没拍板的依赖写死。拒绝规则和工作区外写入是否在沙箱自动批准开启时仍要确认，本稿不另定。

### 要动的符号或文件
- `CommandLineSandboxAnalyzer.analyze`（`src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/commandLineSandboxAnalyzer.ts` 第 20–34 行）：`_isAutoApproveEnabled` 用 `EnableAutoApprove !== false`，并在沙箱启用且不需要离开沙箱、不需要放开网络时设置 `forceAutoApproval`。这里不再设置 `forceAutoApproval`。沙箱未启用时只返回 `isAutoApproveAllowed` 的现有结果保持。
- `RunInTerminalTool.prepareToolInvocation`（`runInTerminalTool.ts` 第 1198–1199、1280、1300 行）。`_allowSandboxAutoApprove` 在第 794–796 行，只有 `AgentSandboxAllowAutoApprove === true` 才为真。`isFinalAutoApproved` 不要再或上 `forceAutoApproval`。`isSandboxAutoApproved`（第 1198 行）保留「沙箱启用、命令已包进沙箱、不需要放开网络、`_allowSandboxAutoApprove`」这些条件，并加上 `commandLineAnalyzerResults.every(e => e.isAutoApproved !== false)` 与第 1174 行的 `analyzersIsAutoApproveAllowed`。
- 配置默认值保持：`EnableAutoApprove` 默认 true（`terminalChatAgentToolsConfiguration.ts` 第 88–92 行），`AgentSandboxAllowAutoApprove` 默认 true、说明为关闭后走原有审批（第 601–604 行）。

### 明确不改
- `invoke` 里 `_getDeniedSandboxFileAccess`（第 1933–1949 行）对 `requestFileValidationCheck` 的拒绝。
- 需要离开沙箱或放开网络时的确认标题，以及 `requiresUnsandboxConfirmation` / `requiresAllowNetworkConfirmation` 让沙箱分析器不强制批准的条件。
- 会话级自动批准过滤掉 `CommandLineAutoApproveAnalyzer` 的分支（第 1158–1160 行）。
- 命令行拒绝规则与 `CommandLineFileWriteAnalyzer` 把 `isAutoApproveAllowed` 设为 false 的检测本身。

### 本地验证
- 已有：`commandLineSandboxAnalyzer.test.ts` 的 `should force auto approval for sandboxed commands when auto approve is enabled`、`should not force auto approval for sandboxed commands when auto approve is disabled`；`runInTerminalTool.test.ts` 的 `should auto-approve sandboxed commands when sandbox auto approve is enabled`、`should use existing approval flow for sandboxed commands when sandbox auto approve is disabled`、`should require confirmation for commands in deny list even if in allow list`、`should prevent auto approval when writing to a file outside the workspace`。
- 调整：沙箱分析器不再因 `EnableAutoApprove === true` 返回 `forceAutoApproval: true`。
- 新增：沙箱启用、`AgentSandboxAllowAutoApprove` 为 false、`EnableAutoApprove` 为 true 时，普通沙箱命令要确认。同一组合下，拒绝规则或工作区外写入（`BlockDetectedFileWrites: outsideWorkspace`）也要确认。`AgentSandboxAllowAutoApprove` 为 true 且命令已包进沙箱时，命中拒绝规则或工作区外写入仍要确认；未命中时仍自动批准。

## r10-3（hold，中）
### 问题类
单元格 execution 在内核解析和执行请求之前就创建，这两步抛错后没有收尾，状态会停在未确认或执行中。

### 不变量
`executeNotebookCells` 一旦为本批单元格创建了 execution，函数以抛错结束时，这批仍留在状态服务里的 execution 都要 `complete({})`。内核为空、语言不匹配、请求返回后仍为 Unconfirmed 的现有 `complete` 保持。

### 要动的符号或文件
- `NotebookExecutionService.executeNotebookCells`（`src/vs/workbench/contrib/notebook/browser/services/notebookExecutionServiceImpl.ts` 第 49–91 行）。`createCellExecution` 在第 56 行，`KernelPickerMRUStrategy.resolveKernel` 在第 59 行（其实现会 `executeCommand`，`notebookKernelQuickPickStrategy.ts` 第 817–827 行），`runExecutionParticipants` 在第 81 行，`executeNotebookCellsRequest` 在第 84 行。这三处都没有 try/catch。
- 创建完成后用 try/catch 包住这三步。catch 里对 `cellExecutions` 中 `getCellExecution` 仍能取到的项调用 `complete({})`，然后把原错误抛出。`!kernel` 分支（第 61–64 行）、语言不匹配（第 72–73 行）和 Unconfirmed 收尾（第 86–89 行）留在 try 内。

### 明确不改
- 信任请求失败时在第 45–47 行直接 return（此时还没创建 execution）。
- 已有 execution 的单元格在第 53–54 行 `continue`，不重复创建。
- `cancelNotebookCellHandles`。

### 本地验证
- 已有：`notebookExecutionService.test.ts` 的 `Completes unconfirmed executions`。
- 新增：`resolveKernel` 的 `executeCommand` 拒绝，或 `executeNotebookCellsRequest` 拒绝之后，返回的 Promise 拒绝，且 `getCellExecution(cell.uri)` 为 undefined。成功路径上 Unconfirmed 仍被 complete，语言匹配的执行请求仍发出一次。

## r10-4（hold，中）
### 问题类
内核 `implementsInterrupt` 为真时，删掉尚未进入 Executing 的单元格不会取消也不会在本地结束，执行记录留在表里；`getSelectedOrSuggestedKernel` 返回空时，正在执行的句柄同样不会在本地结束。

### 不变量
单元格删除完成后，未处于 Executing 的 execution 在本地 `complete({})`。不要在 `onWillAddRemoveCells` 里、`this._cells.splice` 之前调用 `complete`：`notebookTextModel.ts` 在 splice 前触发这个事件，单元格还在，此时 `complete` 会走进 `_applyExecutionEdits` 并重入正在进行的 `applyEdits`。收尾延后到删除完成之后。`implementsInterrupt` 为真时，`cancelNotebookCellExecution` 仍只携带 Executing 句柄。`implementsInterrupt` 为 false 时，两组句柄仍交给 `cancelNotebookCellExecution`。没有任何内核对象时，删除涉及的 execution（含 Executing）都在本地 `complete({})`。第 524–527 行「单元格已不在文档里就跳过编辑」在这个调用点还不成立。

### 要动的符号或文件
- `NotebookExecutionListeners.onWillAddRemoveCells`（`src/vs/workbench/contrib/notebook/browser/services/notebookExecutionStateServiceImpl.ts` 第 362–393 行）。非 Executing 进入 `pendingDeletedHandles`（第 375–376 行）。第 386–390 行在 `implementsInterrupt` 为真时只把 `executingDeletedHandles` 传给 `cancelNotebookCellExecution`，函数内没有 `complete`。
- 内核来自 `getSelectedOrSuggestedKernel`（第 384 行）。未选中时，若该笔记本只有一个匹配内核或一个 preferred 内核，`notebookKernelServiceImpl.ts` 第 262–273 行仍会返回它，取消分支仍会进入。只有这个方法返回 undefined 时，第 385 行的分支被跳过。
- `pendingDeletedHandles` 里的 `INotebookCellExecution` 一律 `complete({})`。`implementsInterrupt` 为真时，`handlesToCancel` 保持只有 `executingDeletedHandles`。`implementsInterrupt` 为 false 且有内核时，仍把两组句柄传给 `cancelNotebookCellExecution`，同时对 pending 做本地 `complete({})`。内核为 undefined 时，两组句柄都 `complete({})`，不调用 cancel。

### 明确不改
- Executing 且存在内核时仍调用 `cancelNotebookCellExecution`，不在本地把已在内核中执行的单元格直接标完成。
- `implementsInterrupt` 为 false 时，pending 句柄继续计入 cancel。
- `onWillDisposeDocument` / `cancelAll`。
- `CellExecution.complete` 写回 metadata 的行为。单元格已不在文档里时，它已经会跳过编辑（第 524–527 行）。

### 本地验证
- 已有：`notebookExecutionStateService.test.ts` 的 `cancel execution when cell is deleted`（`implementsInterrupt` false，期望 cancel 3 次）、`cancel execution when cell is deleted in interrupt-type kernel`（期望 cancel 1 次）。两次的 cancel 次数保持。两次都追加：删除后 Executing、Pending、Unconfirmed 的 `getCellExecution` 均为 undefined。
- 新增：不注册内核（避免「仅一个内核」被当成建议内核），删除带 Executing execution 的单元格后，`getCellExecution` 为 undefined。

## r10-5（hold，中）
### 问题类
引擎终端会话已经打开后，桥接 `error` 帧用 `undefined` 退出，失败说明被丢掉，终端按正常进程退出关掉。

### 不变量
启动完成前的 `error` 帧仍把 `frame[1].message` 交给 `start()`。启动完成后的 `error` 帧带着同一条 `message` 退出，实例能弹出这条说明。`undefined` 和退出码 0 仍表示没有失败文案。

### 要动的符号或文件
- `UniverseAgentCustomPty.onServerFrame`（`src/vs/workbench/contrib/terminal/browser/universeAgentPtyTerminal.ts` 第 180–186 行）。`BasePty._onProcessExit` 是 `Emitter<number | undefined>`（`basePty.ts` 第 43 行），`ITerminalChildProcess.onProcessExit` 同样是 `Event<number | undefined>`。不要 `fire({ message })`，那样编译不过，`TerminalProcessManager._onExit` 也只转发数字。
- 启动完成后的 `error` 帧：先 `_onProcessData.fire(frame[1].message)`，再 `_onProcessExit.fire(1)`。不要改 `ITerminalChildProcess` 到 `TerminalInstance` 的类型链。`undefined` 和 0 仍表示没有失败退出码。
- 不改 `parseExitResult` 的 object 分支，也不改 `TerminalInstance._onProcessExit`。失败说明在数据流里，不靠启动失败那条 `ITerminalLaunchError`。

### 明确不改
- 启动前 `error` 与 `sessionClosed` 的现有分支（第 173–178、181–182 行）。`sessionClosed` 继续转发 `frame[1].exitCode`。
- `parseExitResult` 对 `undefined`、0，以及对 message 含 `Could not find pty with id` 的忽略。
- 打开编辑器终端的 launch config（第 230–236 行）不设置 `waitOnExit`。

### 本地验证
- 已有：`terminalInstance.test.ts` 的 `parseExitResult` 套件（`undefined` 与 0 没有 message）。
- 新增：`_launch` 已完成后再送 `error` 帧，数据流里出现 `frame[1].message`，`onProcessExit` 收到非 0 数字，而不是 `undefined`，也不是对象。`undefined` 与 0 的现有断言保持。
