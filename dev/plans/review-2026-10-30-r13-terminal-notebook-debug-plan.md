---
title: "十六路审查 r13：终端笔记调试方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "保留 4 条，降级 0 条。"
---

# 十六路审查 r13：终端笔记调试方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。


对照活码后 4 条都成立。严重度沿用发现稿。

| 编号 | 判定 | 严重度 |
|---|---|---|
| r13-1 | hold | 高 |
| r13-2 | hold | 中 |
| r13-3 | hold | 中 |
| r13-4 | hold | 中 |

### r13-1

问题类：展示命令命中自动批准规则时，脱离沙箱或放开沙箱网络的确认被整段跳过，执行的仍是改写后的命令。

不变量：走到 `shouldShowConfirmation` 时，`requiresUnsandboxConfirmation` 或 `requiresAllowNetworkConfirmation` 为真，规则批准和会话自动批准都不能单独把确认拿掉。`alternativeRecommendation` 在计算 `shouldShowConfirmation` 之前就返回 `confirmationMessages: undefined`，这条早退保持。用户确认之后，下发命令仍是 `userEdited ?? toolEdited ?? original`。

要动的符号或文件：

- `RunInTerminalTool.prepareToolInvocation` 里的 `isFinalAutoApproved` 与 `shouldShowConfirmation`（`src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts`）。
- 规则是否批准仍由 `CommandLineAutoApproveAnalyzer` 根据 `forDisplay` 优先的那一行计算。确认门单独看两个标志：任一为真，就不要把 `isAutoApprovedByRules` 算进最终自动批准。
- 同一布尔里，会话自动批准目前只把放开网络加回确认。脱离沙箱不在这个条件里。两个标志都要强制确认，否则只拆掉规则那一侧时，会话自动批准仍会放行脱离沙箱。

明确不改什么：

- `CommandLineSandboxRewriter.rewrite` 的 `forDisplay`、改写结果和两个标志。
- `CommandLineSandboxAnalyzer.analyze` 的现有合同：它只回设置项，不负责否决。`commandLineSandboxAnalyzer.test.ts` 里「不应强制自动批准」那几条保持通过。
- 沙箱关闭、依赖缺失、以及禁止脱离沙箱或禁止放开网络时的拒绝返回。
- 真正执行时对 `toolEdited` 的选择。

怎样本地验证：

- 已有：`should force confirmation for explicit unsandboxed execution requests`、`should force confirmation for explicit sandboxed allow-network requests`、`should auto-approve commands in allow list`、`should auto-approve sandboxed commands when sandbox auto approve is enabled`。
- 新增到 `runInTerminalTool.test.ts`：允许列表包含 `echo`，且 `wrapCommand` 标出 `requiresUnsandboxConfirmation` 时，`prepareToolInvocation` 仍有脱离沙箱的确认标题，`toolEdited` 仍是改写后的命令。放开网络做同样的断言。会话自动批准且只要脱离沙箱时，确认也不能消失。
- 命令：`scripts/test.sh --grep "should still confirm|should force confirmation for explicit|should auto-approve commands in allow list|should auto-approve sandboxed commands"`

### r13-2

问题类：结果超过 128 条时，丢掉的是列表末尾最旧的一条，dispose 的却是 store 数组末尾那条，仍留在列表里的上一次 `LiveTestResult` 被拆掉。

不变量：每条 `results` 里的结果对应自己的 `DisposableStore`。超限时只 dispose 被移出列表的那一条。留在列表里的 `LiveTestResult` 继续转发 `onComplete` 和 `onChange`。新结果仍在前，已完成结果仍按 `completedAt` 插入。不能只靠「两个数组下标永远对齐」：`resort()` 只排序 `results`，`clear()` 只替换 `_results`，都不碰 `_resultsDisposables`。`onComplete` 会调用 `resort`。

要动的符号或文件：

- `TestResultService.push`、`resort`、`clear`（`src/vs/workbench/contrib/testing/common/testResultService.ts`）。
- 用结果到 store 的对应，而不是假设排序之后下标仍一致。`push` 时按与 `results` 相同的位置登记。`resort` 和 `clear` 让留下的结果仍指向自己的 store，被移出的结果 dispose 自己的 store。超限时按被移出的那条结果取 store，再 `pop` 或等价地删掉它。

明确不改什么：

- `RETAIN_MAX_RESULTS`。
- `onComplete` 里的持久化调度，以及「进行中的结果排在前面」的排序规则。
- `LiveTestResult` 上发射器的注册方式。被移出列表的那条仍由它自己的 store dispose。

怎样本地验证：

- 已有：`pushes new result`、`keeps ongoing tests on top, restored order when done`（`testResultService.test.ts`，套件 `Workbench - Test Results Service`）。
- 新增：连续 `push` `RETAIN_MAX_RESULTS + 1` 个仍在运行的 `LiveTestResult`。列表里剩下的上一次结果还能收到 `onChange`。再补一条：较新的一条 `markComplete` 触发 `resort` 之后再超限，dispose 的是被移出列表的那条，不是仍留在列表里的那条。现有 `keeps ongoing tests on top, restored order when done` 会把 `[r2, r]` 收成 `[r, r2]`，新断言要覆盖这次重排之后的超限。
- 命令：`scripts/test.sh --grep "Workbench - Test Results Service"`

### r13-3

问题类：同一次调试会话重叠重启时，代数已经过期的 `initialize` 直接 `return`，调用方把它当成成功，继续对当前适配器 `launchOrAttach`。

不变量：`initializeGeneration` 与本次捕获的代数不一致时，这一次 `initialize` 以调用方能认出来的失败结束，`launchOrAttachToSession` 不再调用 `session.launchOrAttach`。`launchOrAttachToSession` 的签名是 `Promise<void>`，正常结束和「过期后返回」一样。过期不能只 `return`。失败路径不得 `shutdown` 当前 `this.raw`。被取代的那次 `doRestart` 不得 `c(true)`，不得 `_onDidNewSession.fire`，不得因为这次离开删掉仍被更新一次占用的 `restartingSessions`，也不得因此发出 `restart: false`。`doCreateSession` 在 `await launchOrAttachToSession` 之后同样会 fire 并 `return true`，过期时不得走这条。

要动的符号或文件：

- `DebugSession.initialize` 里四处代数检查（创建适配器之后、`raw.start` 之后、`raw.initialize` 之后、`catch`）。代数过期时拒绝本次 Promise。`catch` 里只丢掉尚未认领的适配器，代数过期时不要进入后面的 `shutdown`。
- `DebugService.launchOrAttachToSession`：过期用专门的错误拒绝，或在不改 `Promise<void>` 签名扫描的前提下用调用方能区分的结果。不要落到后面的 `launchOrAttach`，也不要把这种过期送进把启动失败抛给用户的那条 `catch`。`debugLeftoverPromiseCatchScanD847.test.ts` 把该签名钉成 `Promise<void>`。改返回值就要一起改这则扫描；用拒绝则签名可以不动。
- `DebugService.restartSession` 的 `doRestart`：认到过期时不要 `c(true)`，不要 `_onDidNewSession.fire`。`restartingSessions` 按进入次数成对加减，只有最后一次离开才删除；被取代的尝试离开时不要发 `restart: false`。`doCreateSession` 同样认过期，不要在 await 之后 fire 并 `return true`。

明确不改什么：

- `supportsRestartRequest` 时走 `session.restart()` 的那条路径。
- 断开后 300ms 再启动的延迟、关联测试运行的重启、配置替换。
- `shutdown` 里递增 `initializeGeneration` 这一事实。

怎样本地验证：

- 现有 `debugSession.test.ts` 只覆盖 `ThreadStatusScheduler`，没有这条代数行为。`saveBeforeDebugStart.test.ts` 的套件 `Debug - restart and create cancellation` 覆盖的是配置替换取消和 `createSession` 取消，不是保存失败，也对不上重叠 `initialize`。保存失败在套件 `Debug - saveAllBeforeDebugStart`。
- 新增：同一次会话上两次 `initialize` 重叠。后一次已经 `shutdown` 并装上新的 `raw` 之后，先一次 Promise 拒绝；对新 `raw` 的 `launchOrAttach` 只来自后一次调用方。先一次结束时会话仍算在重启中，不发出 `restart: false`。
- 命令：`scripts/test.sh --grep "Debug - restart and create cancellation"`，加上新断言的标题。

### r13-4

问题类：测试结果索引在结果文件写完之前就提交；文件没写上时，后来的保存看到索引里已有这条 id 就跳过重写，下次读盘丢掉这条结果。

不变量：`storedTestResults` 里出现某条 id，当且仅当这次 `storeForResultId` 已经成功。索引里有 id 但读文件抛错或得不到内容时，这次 `persist` 要重写，再把新的字节数写入索引。写失败时保留上一次索引。字节预算、`RETAIN_MIN_RESULTS` 和 `RETAIN_MAX_RESULTS` 的取舍不变。

要动的符号或文件：

- `BaseTestResultStorage.persist`（`src/vs/workbench/contrib/testing/common/testResultStorage.ts`）。磁盘实现的 `readForResultId` 是 `fileService.readFile` 再 `JSON.parse`，文件不存在时抛错，不是返回空。`InMemoryResultStorage` 才是 `cache.get`，没有键时得到 `undefined`。两种都要进入 `storeForResultId`，不要只判断返回值 `!== undefined` 然后 `continue`。缺文件时捕获异常再重写。不捕获的话，磁盘上的 `persist` 会在提交索引之前抛出，索引里的 id 还在，下一次仍抛。先等新文件写完，再 `this.stored.store`；写失败则不要提交含这条 id 的新索引。旧 id 的删除放在索引提交成功之后。
- `TestResultService.persistImmediately`：`await this.storage.persist(this.results)`。`RunOnceScheduler.doRun` 不理会 runner 的返回值，所以在 `TestResultService` 上把前后两次 `persist` 串成一条链，后一次必须看到前一次已经写完并提交索引。调度器类留在 `src/vs/base/common/async.ts`，不改。

明确不改什么：

- `read` 在文件缺失或反序列化失败时丢掉该条并回写更短索引。那是读盘清理，补写必须发生在内存里还有 `ITestResult` 的 `persist`。
- `InMemoryResultStorage` 的缓存语义，以及现有「按已存字节扣预算」的跳过：文件确实可读时仍用已记录的字节数，不强制重写。
- 500ms 的 `persistScheduler` 延迟。

怎样本地验证：

- 已有：`stores a single result`、`deletes old results`、`takes into account existing stored bytes`（`testResultStorage.test.ts`，套件 `Workbench - Test Result Storage`），以及 `serializes and re-hydrates`。
- 新增：`storeForResultId` 第一次拒绝时，`persist` 失败后 `read` 不含这条 id，索引仍是上一版。随后同一次结果再次 `persist`，文件被写上，`read` 能读回。索引里已有 id、内存实现返回 `undefined` 时要重写。同一条路径在读抛错时也要重写，不能只覆盖「返回空」。现有存储测试用的是 `InMemoryResultStorage`。
- 命令：`scripts/test.sh --grep "Workbench - Test Result Storage|serializes and re-hydrates"`

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r13-2 的 store 必须跟着 `resort` 和 `clear` 走，不能只改 `push` 的下标。Important 已改：r13-3 的过期要让 `doRestart` 和 `doCreateSession` 认出来，不能只从 `Promise<void>` 里返回；r13-4 对抛错和空读都重写，磁盘实现缺文件时抛的是 `FileOperationError`。
