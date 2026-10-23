---
title: "方案 r11：debug-scm"
type: plan
status: draft
phase: N/A
updated: 2026-10-23
summary: "hold 5，drop 0，weaken 0。r11-2 冷启动 Run to Line、r11-3 输出消费失败已落；评论合并、保存失败启动调试、数据断点转换仍开。"
---

hold 5，drop 0，weaken 0。

> **落地记录（2026-10-23，部分）：** 本方案仍 `draft`。r11-2 / r11-3 已落；r11-1 / r11-4 / r11-5 仍开。已落子项只改到各自点名的位置，未动其余子项，也不把整份方案升 `implemented`。

## r11-1（hold，高）
### 问题类
互不包含的两段待发评论合并时，模板字符串插进了整个待发对象，正文变成 `[object Object]`。

### 不变量
同一线程上已有未提交草稿、又恢复另一段互不包含的待发评论时，写回编辑器的正文必须是两段 `body` 用换行接起来。已有草稿的原文要留在结果里。

### 要动的符号或文件
- `CommentsController.resumePendingComment`（`src/vs/workbench/contrib/comments/browser/commentsController.ts` 第 1117–1127 行）。`existingPendingComment` 来自 `getPendingComments().newComment`，类型是 `languages.PendingComment`（`src/vs/editor/common/languages.ts` 第 2384–2387 行：`body` 与 `cursor`）。
- 只改第 1125 行的 else：`body` 改为 `` `${existingPendingComment.body}\n${thread.comment.body}` ``。`cursor` 仍用 `thread.comment.cursor`。
- `CommentReply.setPendingComment`（`commentReply.ts` 第 180–185 行）继续 `setValue(pending.body)`，不要改。

### 明确不改
- `isReply` 分支（第 1112–1114 行）直接 `setPendingComment(thread.comment)`。
- 第 1120–1123 行两个 `includes` 分支：一边包含另一边时仍整段采用较长的那条。
- 没有匹配 zone 时走 `createCommentThreadTemplate` 的路径（第 1128–1137 行）。

### 本地验证
没有覆盖 `resumePendingComment` 的测试。新增断言：已有草稿正文与待恢复正文互不包含时，传给 `setPendingComment` 的 `body` 等于两段原文用换行拼接，且不含 `[object Object]`。一边 `includes` 另一边时，结果仍是较长的那一条，不拼接。

## r11-2（hold，中）
### 问题类
没有调试会话时 Run to Line，第一次进入 `Stopped` 就删掉临时断点；启动返回后若仍停住，还会 `continue()`。

### 不变量
冷启动只修「第一次全局 `Stopped` 就删掉临时断点」。`threadToContinue` 在会话存在前取自 `focusedThread`，此时是 `undefined`，`startDebugging` 返回后第 1406–1411 行在没有线程时直接 return，不会 `continue()`。不要写「返回后对目标线程比对位置且不 `continue()`」，除非同时写明线程从哪重新取。`startDebugging` 抛错或返回 false 时，去掉那层监听之后仍要有人删临时断点。会话没起来变成 `Inactive` 时仍删除临时断点。

### 要动的符号或文件
- `DebugService.runTo`（`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 1364–1437 行）。
- `removeTempBreakPoint`（第 1382–1390 行）在 `State.Stopped` 与 `State.Inactive` 上都删断点。冷启动监听（第 1393–1404 行）把它挂在 `this.onDidChangeState` 上，第一次 `Stopped` 就会删。
- 去掉这层「第一次全局 `Stopped` 就删」的监听。`Inactive` 仍删除。
- `startDebugging` 返回后若 `this.state === State.Stopped`（第 1405 行起）：用本次 `uri` / `lineNumber` 对一下目标线程的停止位置。已在目标行则删除临时断点并返回，不调用第 1433 行的 `thread.continue()`。停在别处则保留断点再 `continue()`，删除时机沿用下面已有的门闩。
- 已暂停分支（第 1412–1436 行）的 `sawTargetRunning`：目标线程 `!thread.stopped` 之后再次停住，或 `continue()` 结束后仍停着且没看到跑起来，才 `removeBreakpoints`。冷启动在需要 `continue()` 时复用同一门闩。

### 明确不改
- 进入 `runTo` 时全局状态已经是 `Stopped` 的那条路径的门闩条件。
- `addAndValidateBreakpoints`（第 1440 行起）。
- 临时断点的添加条件（该行还没有断点才加）。

### 本地验证
已有 `src/vs/workbench/contrib/debug/test/browser/runTo.test.ts` 套件 `Debug - runTo temp breakpoint removal`：`runTo does not delete when target is running even if session would read Stopped`、`runTo deletes once when target stops again after running`、`runTo keeps temp breakpoint when another thread pauses before continue finishes`、`runTo deletes after continue without continued when target remains stopped`。这些锁的是已暂停门闩。
新增：从 `State.Inactive` 进入 `runTo` 时，第一次全局 `Stopped` 不删除临时断点。`startDebugging` 结束后仍是 `Stopped` 且停止位置就是目标行时，不调用 `thread.continue()`。停止位置不是目标行时仍 `continue()`，且在目标线程跑起来之前不断点。

## r11-3（hold，中）
### 问题类
文件轮询把 `contentGeneration` 加一后，`consume` 放弃这次读取，调用方仍把刚读到的文本写入模型，`endOffset` 不前进。

### 不变量
同一次 `getContent` 若 `consume` 没有推进 `endOffset`，这段 `content` 不得写入输出模型。下一次仍从原来的 `endOffset` 读取。多文件聚合的 `getContent`（约第 372–384 行）也要返回布尔，并规定部分文件成功、部分失败时 `logEntries.push` 做不做。两个无操作 `consume` 必须返回明确的布尔，不能是 `undefined`，否则 `replaceContent` 用空内容替换的路径会被跳过。`loadModel` 在 `watch()` 之前，`consume` 失败后若没有后续 append，要能再读，不能让模型一直空。

### 要动的符号或文件
- `FileContentProvider`（`src/vs/workbench/contrib/output/common/outputChannelModel.ts`）。`doWatch` 第 199–206 行在 etag 变化时 `++this.contentGeneration` 并 `_onDidAppend.fire()`。`getContent` 第 229 行再次 `++this.contentGeneration`，第 238–244 行的 `consume` 在代数、已释放或 `endOffset !== readOffset` 时直接 return，不执行第 244 行的 `this.endOffset += fileContent.value.byteLength`。
- `consume` 改为返回布尔：偏移已加上字节长度时为 true，提前 return 时为 false。`IContentProvider.getContent`（第 112 行）的 `consume` 类型一并改成返回布尔。
- 三个写入点在 `consume()` 为 false 时跳过写入：`AbstractFileOutputChannelModel.loadModel`（第 513–521 行）、`appendContent`（第 606–614 行）、`replaceContent`（第 631–647 行）。`appendContent` 是连续增长时重复粘贴的那条路径。

### 明确不改
- 轮询间隔、etag 不等才触发、文件变短时 `reset(0)` 再 `_onDidReset`（第 202–204 行）。
- `appendContent` 在 `token.isCancellationRequested` 时于 `consume()` 之前 return（第 608–610 行）。
- `parseLogEntryAt` 与 `doAppendContent` 的插入方式。

### 本地验证
`src/vs/workbench/contrib/output/test/browser/outputChannelModel.test.ts` 只覆盖 `parseLogEntryAt`。新增断言：`readFile` 尚未结束时另一轮 `doWatch` 增加 `contentGeneration`，随后 `consume()` 为 false，`endOffset` 不变，模型不包含这次读到的文本；下一次成功的 `consume` 仍从原偏移读取，这段文本只出现一次。

## r11-4（hold，中）
### 问题类
`debug.saveBeforeStart` 不是 `none` 时，`saveAll` 或未命名文件 `save` 失败后函数仍正常返回，调试继续启动。

### 不变量
需要保存时，`saveAll` 与（配置为 `allEditorsInActiveGroup` 时）活动未命名编辑器的 `save` 都成功，才允许启动或重启调试。任一结果 `success === false` 则停在启动之前。配置为 `none` 时不保存，仍允许启动。

### 要动的符号或文件
- `saveAllBeforeDebugStart`（`src/vs/workbench/contrib/debug/common/debugUtils.ts` 第 377–390 行）改为返回 `Promise<boolean>`。`editorService.saveAll()` 与未命名文件的 `editorService.save(...)` 都看 `ISaveEditorsResult.success`（`src/vs/workbench/services/editor/common/editorService.ts` 第 88–93 行）。有一次为 false 就在 `reloadConfiguration()` 之前返回 false。两次都成功（或配置为 `none`）才 `reloadConfiguration()` 并返回 true。
- `DebugService.startDebugging`（`debugService.ts` 第 362–369 行）在 `saveBeforeStart` 为真且返回 false 时，调用 `endInitializingState()` 并 `return false`。此时 `startInitializingState` 已经执行，退出方式与复合启动任务失败（第 392–394 行）相同。不要把用户取消当成异常丢进第 445 行的 `catch`。
- `DEBUG_START_COMMAND_ID`（`debugCommands.ts` 第 770–776 行）自己先调用 `saveAllBeforeDebugStart`，再以第四个参数 `false` 调用 `startDebugging`。保存返回 false 时直接 return，不要调用 `startDebugging`。
- `DebugService.restartSession`（第 813–816 行）在 `session.saveBeforeRestart` 且保存返回 false 时 return，不要进入后面的 `runTasks` 和会话重启。

### 明确不改
- `IEditorService.save` / `saveAll` 的实现，以及 `debug.saveBeforeStart` 的配置枚举。
- `saveBeforeStart === 'none'` 时不调用 `saveAll`、调试仍可启动。
- 其它把 `saveBeforeStart` 留空、因而走 `startDebugging` 默认参数的调用。它们靠 `startDebugging` 内部这次检查停住。

### 本地验证
没有覆盖 `saveAllBeforeDebugStart` 的测试（`debugUtils.test.ts` 未引用它）。新增断言：`saveAll` 的 `success` 为 false，或 `allEditorsInActiveGroup` 下未命名文件 `save` 的 `success` 为 false 时，函数返回 false，且不调用 `reloadConfiguration`。`startDebugging` 在该返回值下返回 false，并离开 initializing。配置为 `none` 时返回 true。`DEBUG_START_COMMAND_ID` 在返回 false 时不调用 `startDebugging`。

## r11-5（hold，中）
### 问题类
数据断点 `toDAP` 抛错后，session data 里放的是错误字符串；`mixin` 不会从字符串上拷出 `verified` 和 `message`，视图看不到这段错误。

### 不变量
`toDAP` 抛错时，该断点的 session data 必须是 `{ verified: false, message }` 这种断点对象，`message` 为错误文本。`BaseBreakpoint.message` 能读到这段文本。

### 要动的符号或文件
- `DebugSession.sendDataBreakpoints`（`src/vs/workbench/contrib/debug/browser/debugSession.ts` 第 624–643 行）。`catch` 现在返回 `{ bp, message: e.message }`，第 637–638 行在 `!dap.dap` 时 `data.set(dap.bp.getId(), dap.message)`。`data` 的类型是 `Map<string, DebugProtocol.Breakpoint>`。
- 这里改为写入 `{ verified: false, message }`。`message` 取错误文本：`Error` 用 `message`，其它值用 `String(e)`。不要把字符串放进 Map。
- `toBreakpointSessionData`（`debugModel.ts` 第 886–895 行）继续 `mixin` 到能力对象上。传入带 `verified` 和 `message` 的对象后，这两个字段会进 session data。`setBreakpointSessionData` 里数据断点循环（第 1888–1894 行）不用改。
- `BaseBreakpoint.message`（第 947–952 行）和 `getBreakpointMessageAndIcon` 在 `!breakpoint.verified` 时优先显示 `breakpoint.message`（`breakpointsView.ts` 第 1844–1848 行）不用改。

### 明确不改
- `DataBreakpoint.toDAP` 在拿不到 `dataId` 时 `return undefined`（`debugModel.ts` 第 1276–1277 行）。那条路径没有错误字符串。
- `mixin`（`src/vs/base/common/objects.ts` 第 89–109 行）对非对象 source 直接返回 destination 的行为。
- 函数断点、指令断点、普通断点的 `setBreakpointSessionData` 循环。

### 本地验证
`debugSession.test.ts` 与 `debugModel.test.ts` 都没有 `sendDataBreakpoints` 在 `toDAP` 抛错时的用例。新增断言：`toDAP` 拒绝时，交给 `setBreakpointSessionData` 的值是 `verified === false` 且 `message` 为该错误文本的对象；`DataBreakpoint.message` 返回这段文本，`verified` 为 false。
