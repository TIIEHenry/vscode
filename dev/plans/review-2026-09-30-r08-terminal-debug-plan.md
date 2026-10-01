---
title: "方案 r08：terminal-debug"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。Run to Line 在被继续线程再次停下时才删临时断点；多会话按 Verified 记任意暂停；重跑只补 Map 里缺的变量；测试先保存再启动。runCommand 不把空输入改成发 Ctrl+C。"
---

# 方案 r08：terminal-debug

核对后 r08-1、r08-2、r08-3、r08-4 的引用行仍是所述行为。r08-5 的等待与 `sendText` 仍在，但被跟踪的前台命令在执行期间输入并不为空，降级为锁住现有 Ctrl+C 条件。

## r08-1（hold）

- 问题类：多会话 Run to Line 在目标线程刚继续时就删掉临时断点，程序不会停在那一行。
- 不变量：`continue()` 自己触发的 `onDidChangeState` 不得调用 `removeBreakpoints`。监听挂上时目标线程已经是暂停的，只读当前 `stopped` 区分不了「还没继续」和「再次停下」。分三种观察，不要用「必须先见到 `stopped === false`」这一条闩锁。`session.state === State.Inactive` 时删除。`continued` 把该线程写成 `stopped === false` 之后，后来的 `stopped === true` 删除一次。`continue` 在请求期间又收到 stop 时，`rawDebugSession.continue`（约第 364–370 行）先把 `stoppedSinceLastStep` 清掉，发送期间若再置回就不发模拟 `continued`，线程可以一直 `stopped === true`。这条没有 `stopped === false` 过渡的再次停下也要删除一次。目标线程仍停在原来的暂停上时，别的线程的 state 事件不删除。同会话里还有别的暂停线程时，临时断点仍保留到目标线程停下。
- 要动的符号或文件：`DebugService.runTo`（`src/vs/workbench/contrib/debug/browser/debugService.ts`）里挂在 `threadToContinue.session.onDidChangeState` 上的监听器。删除条件改读 `threadToContinue.stopped` 与 `threadToContinue.session.state === State.Inactive`。`continue` 处理在 `debugSession.ts` 的 `clearThreads` 里把该线程 `stopped` 设为 false 之后才 `_onDidChangeState.fire()`；再次停止时 `handleStop` 在 `fetchThreads` 把 `stopped` 设为 true 之后才 fire。不要改成读 `threadToContinue.session.state === State.Stopped`：焦点线程不属于该会话时，`DebugSession.state` 只要还有任一线程 `stopped` 就仍是 `Stopped`（`debugSession.ts` 第 285–290 行）。
- 明确不改什么：不改 `this.state === State.Inactive` 时用 `DebugService.onDidChangeState` 启动调试的那段。本条只改删除时机，不改分数；选线程由 r08-2 改（`addAndValidateBreakpoints` 里 `bestScore < Score.Verified` 的分支就是选线程）。不改 `removeTempBreakPoint` 在 `Inactive` 启动路径上对调试服务状态的判断。
- 怎样本地验证：没有覆盖 `runTo` 删除时机的现有测试。在 `src/vs/workbench/contrib/debug/test/browser/` 新增断言：被继续线程已 `stopped === false`、焦点会话仍是 `Stopped` 时不删除；该线程再次 `stopped === true` 时删除一次；同会话另一线程仍暂停时，继续事件不删除。再断言：目标线程仍停在原来的暂停上时，同会话另一线程的 state 事件不删除。另断言：`continue` 返回后没有 `continued`、目标线程仍是 `stopped === true` 的立即再次停下，也删除一次。只要求先见到 false 的闩锁会让这条永远不删。用 `scripts/test.sh --grep "runTo"` 跑。

## r08-2（hold）

- 问题类：同一断点被多个会话验证时，任意暂停线程被记成「已停在目标文件」，后面真正停在该文件的线程不能再入选。
- 不变量：分数只升不降。`VerifiedAndFocused` 仍高于 `VerifiedAndPausedInFile`，后者仍高于 `Verified`，`Verified` 仍高于 `Focused`。没有任何暂停线程时不改 `bestThread`、不改 `bestScore`。栈顶不在目标文件的暂停线程只记 `Score.Verified`。
- 要动的符号或文件：`DebugService.addAndValidateBreakpoints` 里 `bestScore < Score.Verified` 的分支（`src/vs/workbench/contrib/debug/browser/debugService.ts`）。有暂停线程时 `bestScore` 赋 `Score.Verified`，`bestThread` 仍取 `threads[0]`。`threads.length === 0` 时跳过该分支。
- 明确不改什么：不改 `Score` 的声明顺序；不改「焦点线程优先」「停在同一文件优先」两个分支的比较；不改 `sessionsThatVerified` 的 Map 插入序（`debugModel.ts` 的 `sessionsThatVerified`）。
- 怎样本地验证：没有这条分数的现有测试。新增断言：先遇到一个停在别的文件的线程后，后一个停在目标 `uri` 的线程仍成为 `bestThread`，分数为 `VerifiedAndPausedInFile`；先遇到空暂停列表时分数保持 `Focused`，后面停在文件里的线程仍能入选；已是 `VerifiedAndFocused` 时不被更低分覆盖。用 `scripts/test.sh --grep "addAndValidateBreakpoints|Run to"` 跑。

## r08-3（hold）

- 问题类：`reevaluateOnRerun` 为 false 时，重跑用 `Object.hasOwn` 查变量对象本身，Map 里的新 `${input:…}` 不会再走 `_acquireInput`。
- 不变量：上一轮 `resolvedVariables.variables` 里已有的键不再弹输入。只有 Map 里没有的键才重新 `_acquireInput`。键都在时仍复用上一轮 `resolvedVariables`，并走现有 `_executeInTerminal`。`reevaluateOnRerun` 不是 false 时仍走 `_executeCommand`。
- 要动的符号或文件：`TerminalTaskSystem._reexecuteCommand`（`src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts`）。用 `lastTask.getVerifiedTask().resolvedVariables.variables.has(value.substring(2, value.length - 1))` 判断缺失：缺失才把 `hasAllVariables` 设为 false。重新采集时，把上一轮 `variables` 拷进传给 `_acquireInput` 的 Map，再写入本次 `alreadyResolved` 里已有的键（本次依赖覆盖同名键），让 `_findUnresolvedVariables` 只留下新键。
- 明确不改什么：不改 `rerun` 里只有 `reevaluateOnRerun === false` 才设 `_isRerun`；不改 `_executeCommand`、`_findUnresolvedVariables`、`VariableResolver._replacer`；不把 `Object.hasOwn` 换成 `Map.has` 却保留现在的「键存在则 `hasAllVariables = false`」。
- 怎样本地验证：没有 `_reexecuteCommand` 的现有测试。新增断言：旧 Map 已有 `workspaceFolder`、没有 `input:foo` 时会调用 `_acquireInput`，且传下去的 Map 仍含 `workspaceFolder`；两个键都在时不调用 `_acquireInput`；`input:foo` 已在 Map 里时不因为它是 own property 名之外的键而跳过，也不因它存在而重新采集。用 `scripts/test.sh --grep "_reexecuteCommand|reevaluateOnRerun"` 跑。

## r08-4（hold）

- 问题类：`testing.saveBeforeTest` 默认为 true 时，`runTests` 在 `saveAll` 完成前就已经调用。
- 不变量：`preserveFocus !== true` 且 `testing.saveBeforeTest` 为 true 时，`editorService.saveAll()` 先完成，然后才调用控制器的 `runTests`（`MainThreadTesting` 里的 `$runControllerTests`）。`saveAll()` resolve 且 `success === false`，或该 promise reject，都不调用 `runTests`。只把 `await` 前移不够：`saveAllBeforeTest` 不看返回值，`saveAll` 在保存失败或用户取消时 resolve 为 `{ success: false }`，不 reject。`preserveFocus === true` 时仍立即返回、不保存，然后可以启动测试。
- 要动的符号或文件：`TestService.runResolvedTests`（`src/vs/workbench/contrib/testing/common/testServiceImpl.ts`）。把 `await this.saveAllBeforeTest(req)` 移到 `byController.map` 调用 `runTests` 之前，然后再 `await Promise.all(requests)`。在 `saveAllBeforeTest` 或 `runResolvedTests` 检查 `success`，失败则 return、不调用 `runTests`。
- 明确不改什么：不改 `saveAllBeforeTest` 对 `preserveFocus` 的提前返回；不改 `startContinuousRun`（它不保存）；不改 `testExplorerActions.ts` 里在光标处运行前的 `editorService.save` 加 `syncTests`。
- 怎样本地验证：`src/vs/workbench/contrib/testing/test/common/testService.test.ts` 没有这条顺序的测试。在该文件新增断言：默认配置下 `saveAll` 的 Promise 完成之前 `runTests` 未被调用，完成之后才被调用；`saveAll` resolve `{ success: false }` 时 `runTests` 调用次数为 0；`preserveFocus: true` 时不调用 `saveAll` 且仍调用 `runTests`；`testing.saveBeforeTest` 为 false 时不调用 `saveAll` 且仍调用 `runTests`。用 `scripts/test.sh --grep "saveAllBeforeTest|runResolvedTests"` 跑。

## r08-5（weaken）

反证：`PromptInputModel._handleCommandExecuted`（`src/vs/platform/terminal/common/capabilities/commandDetection/promptInputModel.ts`）把状态设为 `Execute`，只去掉幽灵文本，不清空 `_value`。执行期的 `_value` 由 `_handleCommandFinished` 写成 `''`；`_handleCommandStart` 也会写成 `''`，但那时状态已是 `Input`。因此被 shell integration 跟踪的前台命令在跑的时候 `value.length > 0`，`TerminalInstance.runCommand` 第 1072 行的条件为真，超时后会先 `sendText('\x03')`。输入为空且状态仍是 `Execute` 的窗口是命令已经结束、下一次 `Input` 还没到的时候，不是前台进程仍占着终端。状态仍是 `Unknown` 且 `value` 为空时，本条不改 `runCommand`，超时后仍不会发 `\x03`。

- 问题类：发现稿把「执行中且输入为空」当成不发 Ctrl+C 的原因；当前模型在执行中保留命令文本，空输入表示命令已结束。
- 不变量：有命令检测、状态为 `Execute`、`value` 非空时，超时结束后仍先发送 `\x03`，再写命令。`value` 已被 `_handleCommandFinished` 清空时不补发 `\x03`。已经处于 `PromptInputState.Input` 且输入为空时，只 `sendText` 命令，不发 `\x03`。
- 要动的符号或文件：不改 `TerminalInstance.runCommand`。在 `src/vs/workbench/contrib/terminal/test/browser/terminalInstance.test.ts` 增加上述两条路径的断言。
- 明确不改什么：不把第 1072 行改成「超时后状态仍不是 `Input` 就发 `\x03`」；不改 `_handleCommandFinished` 清空 `_value`；不改 `getShellIntegrationTimeout`。
- 怎样本地验证：现有 `runCommand should wait for prompt input when command detection already exists` 保持通过（到达 `Input` 且输入为空时，`sentText` 只有命令、没有 `\x03`）。新增断言：`Execute` 且 `value` 为非空命令时，等待结束后第一条 `sendText` 是 `\x03`，其后才是命令；命令结束后 `value === ''` 且状态还不是 `Input` 时，`sentText` 不含 `\x03`。用 `scripts/test.sh --grep "runCommand should wait for prompt input"` 跑。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r08-1 不再禁止 r08-2 改选线程；删除时机先见到 `stopped === false` 再允许删除；r08-4 在 `saveAll` 的 `success === false` 时不调用 `runTests`。Minor：r08-5 写明 `_handleCommandStart` 也会清空 `_value`。均已写入正文。

2026-09-30 第二轮。无 Critical。Important：r08-1 改成三种观察。请求期间再次 stop 时 `rawDebugSession.continue` 不发模拟 `continued`，没有 `stopped === false` 过渡也要删除一次。均已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
