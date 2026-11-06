---
title: "方案 r11：debug-scm"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "5 hold 已实施；临时断点在停止或目标行清理，取消后的重启与建会话不再发生，合并结果确认后才完成，preserveFocus 不再跳过保存。"
---
# 方案 r11：debug-scm

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核查

- r11-1 hold：`DebugService.runTo` 仍只在焦点会话为 `State.Stopped` 时删掉本次断点；`State.Running` 会落到函数末尾，没有可继续线程时在取线程处直接返回。
- r11-2 hold：`restartSession` 在替换结果为空时仍会 `runResolvedTests`，并在 `supportsRestartRequest` 且前置任务成功时仍会 `session.restart()`。
- r11-3 hold：`createSession` 在前置任务前读了 `initCancellationToken`，`resolveDebugConfigurationWithSubstitutedVariables` 返回之后、`doCreateSession` 之前不再读。
- r11-4 hold：临时模式在 `save` 前写入 `savedAltVersionId`；`save` 的返回值未使用。工作区 `accept` 先 `reportClose(true)` 再 `save`。`AcceptMerge` 随后固定返回 `{ successful: true }`。
- r11-5 hold：`saveAllBeforeTest` 在 `preserveFocus === true` 时直接返回 `true`。`testing.saveBeforeTest` 默认仍是 true。测试 `preserveFocus skips saveAll and still runTests` 仍断言不保存且会跑。

## r11-1 hold

- 问题类：这次「运行到光标」加上的断点在会话已在运行、或已停止但没有可继续线程时，会留在模型和存储里。
- 不变量：`runTo` 持有本次 `addBreakpoints` 得到的断点 id。该 id 必须在目标行被命中或这次调试会话结束时经 `removeBreakpoints` 去掉，不能继续充当用户断点。该行上原本就有的断点不属于这次调用。
- 要动的符号或文件：
  - `DebugService.runTo`（`src/vs/workbench/contrib/debug/browser/debugService.ts`）。
  - 其中的局部函数 `removeTempBreakPoint`：`State.Running` 下不能靠「只在 Stopped / Inactive 才删」把断点留下。命中目标或会话变为 `State.Inactive` 时调用已有的 `removeBreakpoints(id)`，让模型和 `debugStorage` 一起更新。
  - 焦点会话已是 `State.Running`，以及冷启动 `startDebugging` 成功后焦点会话仍是 `State.Running`：`runTo` 返回前挂上会话状态监听。监听在目标行命中（停止线程的顶栈帧与本次 `uri`、`lineNumber` 一致，沿用现有的行号与 URI 比较）或会话变为 `State.Inactive` 时删除并 `dispose`。停在别的行时保留，等后续命中或会话结束。
  - `State.Stopped` 且 `threadToContinue` 为空：在返回前删除本次加上的断点。
  - 冷启动后已经停在目标行、以及已停止且能 `continue` 的路径，继续用现有删除时机。
- 不改：
  - `addBreakpoints` 的第三个参数仍是不朗读。不给 `IBreakpointData` 加临时标记。
  - 该行已有断点时 `breakpointToRemove` 保持为空，不删除用户断点。
  - 冷启动后第一次停在别的行时不删，仍继续执行后再删。
  - `this.state` 仍读焦点会话。
- 本地验证：保留 `src/vs/workbench/contrib/debug/test/browser/runTo.test.ts` 里 `Debug - runTo temp breakpoint removal` 对「停在目标行才删、继续后目标线程再停才删、会话 Inactive 才删」的断言。另增断言：进入时焦点会话为 Running，或冷启动成功后仍为 Running，本次断点在命中目标行或会话 Inactive 时被 `removeBreakpoints`；未命中前还在。已停止且没有可继续线程时，本次断点在 `runTo` 返回前被删除。该行已有断点时 id 不变。

## r11-2 hold

- 问题类：重启所需的配置没有解析成功时，调试会话或关联测试仍会被再次启动。
- 不变量：这次重启的配置事实由 `substituteVariables` 和 `resolveDebugConfigurationWithSubstitutedVariables` 的结果持有。`needsToSubstitute` 为真时，`resolved` 为空，或这次替换使用的取消标记已置位，都表示没有可启动的新配置。此时不得调用 `session.restart()`，不得 `runResolvedTests`，也不得把 `__restart` 写进仍在使用的旧配置。
- 要动的符号或文件：
  - `DebugService.restartSession`。
  - 仅在 `launch && needsToSubstitute && unresolved` 这段替换里记失败：`substituteVariables` 得到空、提供者得到空、第二次解析得到空、或该段创建的 `CancellationTokenSource` 已取消。
  - 失败时在 `setConfiguration`、`session.configuration.__restart = restartData`、`setSessionDidTrigger`、关联测试分支和 `supportsRestartRequest` 分支之前返回。
  - 取消标记已置位但 `substituteVariables` 已得到配置时，不要把这份半截结果 `setConfiguration` 后再重启。
- 不改：
  - `needsToSubstitute` 为假时仍用会话里现有配置重启。
  - `substituteVariables` 在取消或出错时返回 `undefined` 的约定。
  - 断开再拉起路径里 `if (!resolved) return c(false)`。
  - `createSession` 在替换取消时返回 `false`。
  - 函数前部扩展宿主调试会话的 `reload` 早退。
- 本地验证：`src/vs/workbench/contrib/debug/test/browser/saveBeforeDebugStart.test.ts` 的 `restartSession returns before tasks when save fails` 只覆盖保存失败，覆盖不到这里。另增断言：`launch.json` 需要替换且 `substituteVariables` 返回空、提供者返回空、或取消标记已置位时，`session.restart` 与 `runResolvedTests` 调用次数为 0，旧配置上不出现这次的 `__restart`。同一会话在不需要替换时，`supportsRestartRequest` 仍会 `restart`。关联测试会话在替换失败时不调用 `cancelCorrelatedTestRun`，也不再 `runResolvedTests`。

## r11-3 hold

- 问题类：启动尚未产生会话时用户已停止，配置解析仍返回配置的话，会话仍会被创建。
- 不变量：`createSession` 放进 `sessionCancellationTokens` 的 `initCancellationToken` 持有「这次启动已取消」。`stopSession` 在模型里还没有会话时会 `cancelTokens`。该标记已取消时，`doCreateSession` 不得执行。提供者把传入配置原样返回，或当时没有提供者，都不是新的启动授权。
- 要动的符号或文件：
  - `DebugService.createSession`。在 `resolveDebugConfigurationWithSubstitutedVariables` 得到 `cfg` 且后续类型检查通过之后、调用 `doCreateSession` 之前，再读 `initCancellationToken.token.isCancellationRequested`。已取消则返回 `false`。
  - `DebugService.doCreateSession` 保持只负责创建；取消判断留在调用前，不把已取消的启动送进 `model.addSession`。
- 不改：
  - 前置任务之前那次取消判断，以及 `cfg` 为空时返回 `false`。
  - `stopSession` 在无会话时 `cancelTokens(undefined)`。
  - `DebugConfigurationManager.resolveDebugConfigurationWithSubstitutedVariables` 仍把标记传给提供者；不要求每个提供者自己拒绝。
- 本地验证：现无对应测试。另增断言：前置任务已成功、取消标记随后置位、解析仍返回原配置时，`createSession` 返回 `false`，调试模型中的会话数不增加。标记未取消且解析返回配置时，仍会调用 `doCreateSession`。

## r11-4 hold

- 问题类：合并结果还没有确认写入，完成状态和命令结果已经是成功。
- 不变量：写入事实由保存返回值持有。临时模式是 `ITextFileService.save` 返回的 URI；工作区模式是 `ITextFileEditorModel.save` 返回的 `true`。只有这份事实成立时，临时模式才可把 `savedAltVersionId` 对齐并置 `finished`，工作区才可 `reportClose(true)`，`AcceptMerge` 才可返回 `{ successful: true }` 并关闭编辑器。保存未确认时，临时模式的 `isDirty` 必须仍为真。
- 要动的符号或文件：
  - `IMergeEditorInputModel.accept` 改为返回 `Promise<boolean>`。`true` 表示结果已确认写入。
  - `TempFileMergeEditorInputModel.accept`：仍先把结果文本 `setValue` 到目标模型，再 `save`。保存前记下 `resultTextModel` 的 `alternativeVersionId`。只有保存返回 URI，且该版本在保存期间没有变，才 `savedAltVersionId.set` 并置 `finished`，然后返回 `true`。保存返回空、或保存期间结果版本已变：不改 `savedAltVersionId`，`finished` 保持 `false`，返回 `false`。
  - `WorkspaceMergeEditorInputModel.accept`：先 `resultTextFileModel.save()`。返回 `true` 之后才 `reportClose(true)` 并返回 `true`。返回 `false` 时不调用 `reportClose`，并返回 `false`。
  - `AcceptMerge.runWithMergeEditor`：`accept` 返回 `false` 时返回 `{ successful: false }`，不调用 `closeEditor`。返回 `true` 后再关闭，并返回 `{ successful: true }`。
  - `MergeEditorInput.accept` 把布尔结果传出去或由命令直接使用输入模型上的布尔结果。`confirmClose` 里选择保存后仍调用 `accept`；临时模式失败时 `isDirty` 仍为真，编辑器组现有的「仍脏则取消关闭」继续生效。
- 不改：
  - 临时模式 `isDirty` 仍是结果模型版本与 `savedAltVersionId` 的比较。
  - 工作区 `isDirty` 仍读 `resultTextFileModel.isDirty()`。
  - 临时模式 `confirmClose` 在确实不脏时走 `ConfirmResult.DONT_SAVE` 并 `_discard`。修复之后，这条路径只出现在写入已经确认、版本已经对齐的时候。
  - 未处理冲突时 `AcceptMerge` 的确认框；用户拒绝时仍返回 `{ successful: false }`。
  - 保存失败时不把已经 `setValue` 的内存结果丢掉。
- 本地验证：合并编辑器现无 `accept` 单测。另增断言：临时模式 `save` 返回空时 `isDirty` 仍为真、`finished` 为假，命令结果为 `{ successful: false }`，且不关闭。`save` 返回 URI 且版本未变时 `isDirty` 为假，命令结果为 `{ successful: true }`。工作区 `save` 返回 `false` 时不调用 `reportClose(true)`，命令结果为失败；返回 `true` 时才 `reportClose(true)`。

## r11-5 hold

- 问题类：`preserveFocus` 被当成跳过「测试前保存」的许可，测试会按磁盘上的旧内容执行。
- 不变量：`testing.saveBeforeTest` 持有跑测试前要不要保存全部脏编辑器。`preserveFocus` 只持有要不要抢走结果视图的焦点。设置开启时，两种运行都必须先 `saveAll` 成功，才可以调用控制器的 `runTests`。`saveAll` 失败或抛错时不得开跑。
- 要动的符号或文件：
  - `TestService.saveAllBeforeTest`（`src/vs/workbench/contrib/testing/common/testServiceImpl.ts`）。去掉 `req.preserveFocus === true` 时直接 `return true`。其后仍只按 `TestingConfigKeys.SaveBeforeTest` 决定是否 `editorService.saveAll()`，并用 `{ success }` 作为是否继续的事实。
  - `src/vs/workbench/contrib/testing/test/common/testService.test.ts` 中 `preserveFocus skips saveAll and still runTests`：改成设置开启且 `preserveFocus: true` 时 `saveAll` 次数为 1，成功后 `runTests` 次数为 1。
- 不改：
  - `TestingProgressUiService.attachAutoOpenForNewResults` 在 `preserveFocus === true` 时不自动打开结果视图。
  - `TestingChatAgentTool._captureTestResult` 仍传 `preserveFocus: true`。
  - 扩展侧 `runTests` / `createTestRun` 里 `preserveFocus ?? true` 的默认值。
  - `testing.saveBeforeTest` 的默认 `true`。
  - 同文件已有断言：`does not runTests when saveAll resolves success false`、`does not runTests when saveAll rejects`、`saveBeforeTest false skips saveAll and still runTests`。设置关闭时，即使 `preserveFocus` 为真也不保存并仍会跑。
- 本地验证：改写 `preserveFocus skips saveAll and still runTests`。另增断言：`preserveFocus: true` 且 `saveAll` 结果为 `success: false` 或抛错时，控制器 `runTests` 次数为 0。`saveBeforeTest: false` 且 `preserveFocus: true` 时 `saveAll` 次数为 0、`runTests` 次数为 1。

## 落地

- 2026-10-25 实施 r11-1：`runTo` 的临时断点在会话停止于目标行或进入 Inactive 时移除；已在运行的会话由状态监听接管清理，不再留在模型与存储里。
- 2026-10-25 实施 r11-2 / r11-3：配置解析与变量替换在取消后返回，不再写回半解析配置、重启会话或创建新会话。
- 2026-10-25 实施 r11-4：合并编辑器 `accept()` 等到保存确认后才完成并关闭；保存失败返回 `{ successful: false }` 且不关闭。
- 2026-10-25 实施 r11-5：`preserveFocus` 只影响焦点，不再跳过测试前保存；`saveAll` 失败或抛错时不运行测试。
- 验证：`runTo.test.ts`、`saveBeforeDebugStart.test.ts`、`mergeEditorAccept.test.ts`、`testService.test.ts` 合计 46 passing（含全局 clean-state）。
- 既有失败：无。
