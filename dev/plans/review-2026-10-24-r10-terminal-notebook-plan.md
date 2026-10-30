---
title: "方案 r10：terminal-notebook"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "4 hold，1 weaken；退出后的发送、活动分栏下标、单元格输出和后台结束通知仍会对错对象，策略入口的旧退出码在工具终端上通常先被销毁。写入失败用返回值表达，不用未处理 rejection。"
---
# 方案 r10：terminal-notebook

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核查

- r10-1 hold：`sendText` 在 `write` 返回后仍触发已发送和已执行；`_onExit` 只把 `_process` 置空，`shellProcessId` 仍留着，`write` 因此丢掉输入并正常返回。`SendToTerminalTool.invoke` 仍回复 Successfully sent command。修法必须让 `write` 报告“没写进去”，但不能把 rejection 漏给没有 catch 的 xterm / 动作调用方。
- r10-2 weaken：策略入口在 `exitCode` 已有值时仍会在发出命令前返回该码，但工具终端进程退出会在同一轮 `dispose`，`execute` 先看到 `isDisposed` 并抛出；`_initTerminal` 也会丢弃已有退出码的缓存终端。
- r10-3 hold：`moveInstance` 重排后仍不改 `_activeInstanceIndex`。未聚焦分栏插到活动项前面时，活动下标会指到刚插入的实例。
- r10-4 hold：`_commonPrefix` / `_commonSuffix` 仍只靠 `fastEqual`（语言、mime、种类、部分内部元数据、源码）。源码相同、输出不同的新单元格会把输出写到前面那个单元格。
- r10-5 hold：后台 `onCommandFinished` 仍不比较本次命令。隐藏终端（不在 `foregroundInstances`）会在第一条结束事件上 `dispose`。

## r10-1 hold

- 问题类：pty 已经不在时，输入被丢掉，调用方仍得到已发送、已执行。
- 不变量：`TerminalProcessManager` 持有「当前有没有可写的 `_process`」。`write` 只有在 `_process.input` 被调用后才能解决。`TerminalInstance.sendText` 只有在这次 `write` 成功之后才能触发 `onDidInputData`、`onDidSendText`，以及 `shouldExecute` 时的 `onDidExecuteText`。`SendToTerminalTool.invoke` 只有在 `sendText` 成功之后才能告诉调用方命令已送出。
- 要动的符号或文件：
  - `TerminalProcessManager.write`（`src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts`）。`await this.ptyProcessReady` 之后，没有 `_process` 且不能走预启动队列时，返回 `false`，不要 throw。`shellProcessId` 仍为旧 pid、`_process` 为 `null` 属于这一支。`ProcessType.PsuedoTerminal` 且 `_process` 为 `null` 同样返回 `false`。`_hasWrittenData = true` 和 `disableSeamlessRelaunch()` 挪到 `_process.input` 之前、确认有进程之后。`_process.input` 成功调用后返回 `true`。
  - `ITerminalProcessManager.write`（`src/vs/workbench/contrib/terminal/common/terminal.ts:305`）的返回类型从 `Promise<void>` 改为 `Promise<boolean>`。调用方必须显式处理 `false`，不能靠未处理 rejection 表达失败。
  - 为什么不用 reject：`terminalInstance.ts:702-705` 的 `_handleOnData` 只 `await this._processManager.write(data)`，xterm 的 `onData` 在 `:905-907` 也没有 catch；`terminalActions.ts:582` 的 `instance.sendText(...)` 同样没有 await / catch。直接 reject 会让用户在已退出终端里输入、或动作路径触发 `sendText` 时产生未处理 rejection。返回布尔值把失败变成必须检查的返回值。
  - `TerminalInstance.sendText`。`write` 返回 `false` 时，后面的 `_onDidInputData`、`_onDidSendText`、`_onDidExecuteText` 和 `scrollToBottom` 不执行，`sendText` 返回 `false`；成功返回 `true`。`sendText` 的返回类型同步改为 `Promise<boolean>`。
  - `ITerminalInstance.sendText`（`src/vs/workbench/contrib/terminal/browser/terminal.ts:1231`）与所有实现 / 测试替身同步改为 `Promise<boolean>`；`terminalVoice.test.ts` 里 `override async sendText(...): Promise<void>` 这类替身也要改，否则类型检查会失败。
  - `TerminalInstance._handleOnData` 与 xterm `onData`。`write` 返回 `false` 时不发 `_onDidInputData`；这条路径不 throw，也不产生未处理 rejection。
  - `SendToTerminalTool.invoke`（`src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/sendToTerminalTool.ts`）。检查 `sendText` 的返回值；为 `false` 时返回 `Error:` 文本，成功字符串不得出现。
  - `terminalActions.ts:582` 的 Run Selected Text。检查 `sendText` 的返回值；为 `false` 时不把这次调用当成已执行，并按现有动作错误路径提示，不要留下未处理 rejection。
- 不改：
  - `shellProcessId` 仍为空、且不是伪终端时，继续把数据放进 `_preLaunchInputQueue`，并在 `onProcessReady` 里刷出。
  - `relaunch` 已经换上新的 `ptyProcessReady` 时，`write` 继续等待该 Promise。新进程在 `onProcessReady` 之前已经赋给 `_process`，等待结束后输入进新 pty，再发已执行。
  - `TerminalInstance.relaunch` 的 1 秒 debounce，以及 pty host 重启里对普通终端调用 `relaunch` 的顺序。
- 本地验证：`terminalProcessManager.test.ts` 与 `terminalInstance.test.ts` 没有覆盖退出后的 `write`。另增断言：进程退出后 `shellProcessId` 仍为旧值、`_process` 为 `null`、旧的 `ptyProcessReady` 已完成时，`write` 返回 `false`，`sendText` 返回 `false`，且不触发 `onDidSendText` 和 `onDidExecuteText`。首次 ready 之前仍入队并最终返回 `true`。`relaunch` 换上的新 Promise 完成后，输入进入新进程并触发已执行。`sendToTerminalTool.test.ts` 里现有的 Successfully sent command 断言保持给 `sendText` 成功的用例；另增断言：`sendText` 返回 `false` 时结果里没有这句。补三条调用路径的测试：xterm `onData` 在 `write` 返回 `false` 时不产生未处理 rejection；`terminalActions` 的 Run Selected Text 在 `sendText` 返回 `false` 时走错误路径；`SendToTerminalTool` 返回 `Error:`。

## r10-2 weaken

- 问题类：命令还没送进 shell 时，策略会把终端上已有的退出码当成这次结果；若该结果真的回到工具层，退出码 0 会被当成成功。
- 反证：`ToolTerminalCreator._createCopilotTerminal` 不设置 `waitOnExit`。`TerminalInstance._onProcessExit` 在写上 `_exitCode` 并触发 `onExit` 之后，同一轮调用 `dispose`。`RichExecuteStrategy.execute` 和 `BasicExecuteStrategy.execute` 先看 `isDisposed`，已销毁则抛出 `The terminal was closed`，到不了返回 `exitCode` 的那一支。`RunInTerminalTool._initTerminal` 对前台缓存终端在 `exitCode !== undefined` 时丢掉缓存并新建，注释写明是为了避开这个提前返回。因此「`_initTerminal` 返回之后、`execute` 之前退出，包括启动即退出」会走到抛出，工具 `catch` 再抛出，不会把退出码 0 写成成功的工具结果。
- 不变量：这次 `execute` 的结果只描述这次 `commandLine`。命令尚未交给 `runCommand` 或 `sendText` 时，结果里不得带有 `instance.exitCode`，也不得让 `RunInTerminalTool` 把该码写入 `terminalCommandState.exitCode`。退出码 0 只能表示这次命令已经执行并且以 0 结束。
- 要动的符号或文件：
  - `RichExecuteStrategy.execute` 与 `BasicExecuteStrategy.execute`。`isDisposed` 为假且 `instance.exitCode !== undefined` 时，改为抛出错误，说明 shell 已经退出、这次命令没有发送。不得 `return` 带 `exitCode: this._instance.exitCode` 的结果，也不得写 `Command exited with code …`。
  - 保持抛出，使 `RunInTerminalTool` 现有的 `catch` 继续向外抛。不要改成 `exitCode: undefined` 的普通结果：`isError` 只在退出码非 0 时为真，那样仍会变成成功的工具结果。
- 不改：
  - `isDisposed` 时抛出 `The terminal was closed`。
  - `_initTerminal` 丢弃已有退出码的前台缓存终端。
  - 命令已经发出之后，由 `onCommandFinished` 或 `onExit` 得到的退出码，以及 `const isError = exitCode !== undefined && exitCode !== 0`。
  - 为避免 `Event.toPromise(onExit)` 挂起而保留的「入口立即结束」。立即结束的方式改为失败，而不是等待一个已经发过的事件。
- 本地验证：改 `richExecuteStrategy.test.ts` 与 `basicExecuteStrategy.test.ts` 的 `returns immediately with captured exit code when pty has already exited before execute()`。实例 `isDisposed === false` 且 `exitCode` 为 0 或 1 时，`execute` 拒绝，`runCommand` / `sendText` 不被调用，结果对象上不出现该退出码。已有的 `throws "The terminal was closed" when instance is already disposed before execute()` 保持抛出。

## r10-3 hold

- 问题类：同一组里重排分栏后，活动下标仍是旧数字，活动标签和后续聚焦落到另一个实例。
- 不变量：`TerminalGroup` 持有「哪个实例是活动的」。`_activeInstanceIndex` 必须一直是该实例在 `_terminalInstances` 里的当前位置。重排可以改变下标的数字，不能改活动实例的身份，除非被移动的实例本来就有焦点并因此成为活动实例。
- 要动的符号或文件：
  - `TerminalGroup.moveInstance`。重排数组之前记下 `activeInstance`。完成 splice，以及现有的 `hadFocus` 时 `focus(true)` 之后：若没有被移动的实例带焦点，把 `_activeInstanceIndex` 设为原先活动实例在新数组中的下标。
  - 带焦点的实例仍走现有 `focus(true)` → `onDidFocus` → `_setActiveInstance`。这一支跑过之后，不要再用旧的活动实例把下标写回去。
- 不改：
  - `_removeInstance` 在删除活动项或删除项位于活动下标之前时对下标的调整。
  - `TerminalGroupService.moveInstance` 在跨组时先 `removeInstance` 再 `addInstance` 的顺序，以及它只在 `hadFocus` 时 `setActiveInstance` 和 `focus(true)`。
  - `activeInstance` 仍用 `_activeInstanceIndex` 取实例。`terminalTabsList.ts` 的 `is-active` 和 `terminalTabbedView.ts` 的 `focus` / `focusHover` 继续读 `activeInstance`。
- 本地验证：保留 `terminalGroup.test.ts` 的 `same-group moveInstance focuses the moved instance after rearrange` 和 `cross-group moveInstance focuses the moved instance and not the one left behind`。另增断言：活动实例在下标 0、把同组里未聚焦的实例插到它前面之后，`activeInstance` 仍是原来的那个，未聚焦实例的 `focus` 调用次数为 0。

## r10-4 hold

- 问题类：从文件回读整本笔记本时，源码相同的单元格被当成同一个，输出写进前面那个单元格。
- 不变量：单元格输出属于该输出的 `outputId` 序列所在的那一格。`NotebookTextModel.computeEdits` 只有在模型格与文件格的 `fastEqual` 成立、且两边 `outputId` 序列相同（含两边都没有输出）时，才能把它们算进公共前缀或公共后缀，并调用 `_computeOutputEdit`。输出 id 不同的格是插入或替换，其输出不得写到另一格已有的 `outputId` 上。
- 要动的符号或文件：
  - `NotebookTextModel._commonPrefix` 与 `_commonSuffix`。在现有 `fastEqual` 之外，再比较两边 `outputs` 的 `outputId` 序列（长度和每个 id）。序列不同则停止对齐。
  - `_computeOutputEdit` 因此只会被调用到输出 id 已经相同的格上，继续按项更新；不得把另一格的输出项写进这一格的 `outputId`。
  - `NotebookFileWorkingCopyModel.update` 仍调用 `reset`，`reset` 仍调用 `computeEdits`。对齐规则改在 `computeEdits` 里，调用点不变。
- 不改：
  - `NotebookCellTextModel.fastEqual` 仍只比较语言、mime、种类、部分内部元数据和源码。它没有别的调用方。
  - `NotebookCellInternalMetadata.internalId`。注释写明它不落盘，文件回读的 DTO 上没有它，不能当作这次对齐的身份。
  - 两边都没有输出、且 `fastEqual` 成立时，前缀和后缀仍可对齐。
  - 输出 id 相同、输出项内容不同时，仍走 `CellEditType.OutputItems`。
- 本地验证：保留 `notebookTextModel.test.ts` 的 `computeEdits output items changed`（同一 `outputId`，项内容从 `_Hello_` 变为 `_World_`，仍是 `OutputItems`）。改 `computeEdits output changed` 的编辑形状断言：模型格原先没有输出、文件格带新的 `outputId` 时，不再把该输出当成同一格的原地 `Output` 编辑；后面那一格的源码和输出保持不动。另增断言：模型为 `[源码 x 且输出 id A，源码 y]`，文件在前面插入源码同为 x、输出 id 为 B 的单元格时，id A 上的输出项仍是原来的，id B 的输出在新插入的格上。

## r10-5 hold

- 问题类：后台终端上任意一条命令结束都会被说成这次命令已完成，隐藏终端连同仍在跑的进程被关掉。
- 不变量：这次后台执行的身份由 `_registerCompletionNotification` 收到的 `commandName`，以及 `toolSpecificData.terminalCommandId` 持有。只有结束事件对上其中之一，才能发送 “command completed”，才能 `execution.dispose()` 和 `terminalInstance.dispose()`。对不上的结束事件不得改变终端或这次 execution 的存活。
- 要动的符号或文件：
  - `RunInTerminalTool._registerCompletionNotification` 里 `commandDetection.onCommandFinished` 的回调。在 `disposeNotification()`、拼完成消息、`execution.dispose()`、`terminalInstance.dispose()` 之前先判断：`command.id` 有值且等于 `toolSpecificData.terminalCommandId`，或 `command.command` 等于参数 `commandName`。
  - 对不上时直接返回。监听、`_activeExecutions` 里的 execution、终端实例都留着。
  - 对得上之后，保持现在的顺序：退出码非 0 才写入通知里的 exit code 文本；终端在 `foregroundInstances` 里则只通知、不 `dispose`；仍隐藏则在 `capture` 之后再查一次 `foregroundInstances`，仍隐藏才 `dispose`。
- 不改：
  - 没有 `CommandDetection` 时直接 return，并 `dispose` 传入的 `outputMonitor`。
  - `buildCompletionNotificationCommand` 只用于通知标签。它会截断第一行，不能用来做匹配。
  - 用户已经把终端显示出来（进入 `foregroundInstances`）后不关闭终端。
  - `basicExecuteStrategy` 里「下一次结束事件可能不是这次请求」的等待逻辑。这里只改后台通知这条监听。
- 本地验证：`runInTerminalTool.test.ts` 已有 `should preserve conversation context for background completion notifications`，它的结束事件没有 `command` 字段。给该辅助函数里的假事件补上与本次 `commandName` 相同的 `command`，使对得上的路径仍发通知。另增断言：`command.command` 与 `commandName` 不同、且 `command.id` 也不是 `terminalCommandId` 时，不调用 `sendRequest`，不调用 `terminalInstance.dispose()`，监听还在；随后一条对得上的事件才通知，并在终端不在 `foregroundInstances` 时 `dispose`。

## 落地

- 2026-10-25 实施 r10-1：`sendText` 返回 `Promise<boolean>`；pty 已退出或写入未送达时返回 false，`runSelectedTextInActiveTerminal` 据此报错并不再宣告已发送。执行策略同样按返回值判断。
- 2026-10-25 实施 r10-2：执行策略只在明确属于本次命令的结束事件上取退出码；后台通知按 `command` / `terminalCommandId` 匹配，不把终端上已有的退出码当成这次结果。
- 2026-10-25 实施 r10-3：分栏重排后按实例重新定位活动下标，活动标签与后续聚焦不再落到另一个实例。
- 2026-10-25 实施 r10-4：`NotebookTextModel.computeEdits` 比较单元格输出 id；源码相同但输出 id 不同的单元格不再被当成同一个，输出不会写进前面的单元格。
- 2026-10-25 实施 r10-5：后台终端只有匹配本次命令的结束事件才通知；不匹配时保留监听、不 dispose 仍在运行的终端。
- 验证：terminal / notebook 合计 423 passing（109 pending）；2 条既有失败为 `terminalInstance.test.ts` 的自定义 key-event 用例。
- 既有失败：`terminalInstance.test.ts` 的两条自定义 key-event 用例（`XtermTerminal.attachToElement` 的 `catch` 读取 undefined，HEAD 同样失败）。
