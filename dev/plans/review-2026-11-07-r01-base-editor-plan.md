---
title: "十六路审查 2026-11-07 r01：base 与 editor 方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 2、weaken 0、drop 0。r01-1 让最后落地的粘滞滚动更新轮合并被作废轮次的重建请求：全是数值取最小值，全是 undefined 仍传 undefined，两种都有传 0；r01-2 把 suggest 内联补全的过期判断改为只看取消标记、模型是否释放与模型版本号。2026-11-07 已经只读审查并改稿；同日已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r01：base 与 editor 方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无（两条都是上游编辑器内建功能里由本地修补带进来的回归：粘滞滚动的重建与相对行号、suggest 内联补全的过期判断。`docs/product/requirements.md` 没有以编辑器内部行为为用户可观察陈述或验收标准的条目；离编辑器最近的「Preview 类别隔离与 Surface 宿主」只验收类别条、类别内标签与切换保留，「Preview 与 Sources」只验收 Sources 的三个列表）。

只改 r01-1 与 r01-2 两条，范围停在 `src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts`、`src/vs/editor/contrib/suggest/browser/suggestInlineCompletions.ts` 和它们各自的测试文件。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r01-1 | hold | 中 | 见下文 |
| r01-2 | hold | 低 | 见下文 |

### r01-1

问题类：粘滞滚动的 `_updateState` 被后开始的一轮作废时，它带的重建请求一起丢掉，落地时只按最后一轮自己的参数重建。相对行号模式下，光标换行后同一任务里紧跟一次滚动，粘滞行的相对行号停在换行前的值；行高、字体或折叠图标带来的按行号请求与滚动落在同一任务里时，也会丢掉其中一方要求的重建。

下文「落地」指某一轮 `_updateState` 在 `await` 之后通过 dispose 与序号判断，写入状态并调用 `StickyScrollWidget.setState`。

`rebuildFromLine`（传给 `setState` 后叫 `rebuildFromIndexCandidate`）有两种取值，语义不同，不能比大小：

- `undefined`：`setState` 先比较新旧状态，相等就直接返回（`stickyScrollWidget.ts` 152–154 行）；不相等时由 `_findIndexToRebuildFrom` 按新旧行号差异，从第一条新出现的行开始重建（193–194 行）。
- 数值：`setState` 不比较状态，`_findIndexToRebuildFrom` 把它原样当下标（190–191 行），`_renderRootNode` 保留下标之前的旧行、只重画下标及之后的行（232–236 行、244 行）。数值有两种来源。`0` 表示整块重建，来自光标换行（491 行）、令牌变化（533 行）、尺寸变化（542 行）和配置变化（514 行）。模型行号来自行高变化（107 行）、字体变化（115 行）和折叠图标（453 行），这是上游把行号当下标传入；只要它不小于粘滞行数，就等于保留全部旧行、不画新行。

不变量：

- 自上一次落地以来开始的各轮中，只有最后开始、且 `await` 之后序号仍相等的那一轮写 `_foldingModel`、`_widgetState`、`_stickyScrollVisibleContextKey` 并调用 `setState`。被作废的轮次一律不写；控制器 dispose 之后也不写。这是 `ea803c3935b` 加入的判断，保持不变。
- 落地的那一轮交给 `setState` 的第三个参数，由自上一次落地以来所有已开始轮次的请求合并而成：全是数值时取最小值；全是 `undefined` 时传 `undefined`；两种都有时传 `0`。
- 合并结果只取决于这些请求，不依赖各轮在 `await` 之后恢复的先后。与 HEAD 下最后开始的那一轮单独落地相比，实际重建的粘滞行只多不少：HEAD 会传 `undefined` 时，合并结果是 `undefined` 或 `0`；HEAD 会传数值 w 时，合并结果是不大于 w 的数值或 `0`。
- 这一串请求里只要有一轮是 `undefined`，落地之后 widget 渲染出的粘滞行就与这次 `setState` 写进 `_lineNumbers` 的行号逐条一致，不留下与新列表不符的旧行。全是数值请求时维持上游现状，见「明确不改什么」。
- `editor.lineNumbers` 为 `relative` 时，光标换行带来的 `0` 进入 `_updateState` 之后的第一次落地结束，每条粘滞行的行号文本等于该行与当前光标行之差的绝对值，不论同一任务里随后有没有滚动。换行时若 `shouldUpdateState` 为假，这个 `0` 先留在 `_minRebuildFromLine`，由下一次进入 `_updateState` 的轮次带入。
- `shouldUpdateState` 为假（候选行版本落后于模型版本）期间经 `_updateAndGetMinRebuildFromLine` 累积在 `_minRebuildFromLine` 里的请求，仍由下一次进入 `_updateState` 的轮次带走，不被已经在飞的轮次提前接走。

要动的符号：`StickyScrollController._updateState`（602–614 行）、`StickyScrollController._resetState`（616–622 行），以及新增的两个私有字段：一个记数值请求的最小值（例如 `_pendingMinRebuildFromLine`），一个布尔值记是否出现过 `undefined` 请求（例如 `_pendingDiffRebuild`）。文件：`src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts`。

改法：

1. 新增上述两个私有字段，初值分别为 `undefined` 和 `false`，声明放在 `_minRebuildFromLine`、`_updateSeq`（77–78 行）旁边。
2. `_updateState` 开头，在递增 `_updateSeq`、清空 `_minRebuildFromLine` 的同一段同步代码里登记本轮请求：数值并入最小值字段，`undefined` 把布尔字段置真。这一步必须在第一个 `await` 之前完成，这样不论哪一轮先恢复，最后开始的那一轮落地时都已经看得到之前各轮的请求。
3. `await getFoldingModel()` 之后，dispose 或序号不等时照旧直接返回，两个字段都不读不清，本轮请求留给后一轮。
4. 序号相等时按合并规则算出本轮传给 `setState` 的值：最小值字段有值且布尔字段为真时传 `0`；只有最小值字段有值时传该值；只有布尔字段为真时传 `undefined`。随即把两个字段复位，再照旧 `findScrollWidgetState`、写上下文键并调用 `setState`。
5. `_resetState` 在清空 `_minRebuildFromLine` 的同时复位这两个字段。
6. 不采用发现稿「被作废的一轮把自己的参数并回 `_minRebuildFromLine`」的写法。后一轮的参数在前一轮恢复之前就已经定了，并回去只会留给下一次调用；若改成落地时读 `_minRebuildFromLine`，又会把 `shouldUpdateState` 为假期间累积、本应留给下一轮的请求提前接走，而且结果要靠被作废的那一轮先恢复。
7. 也不把 `undefined` 当成「没有请求」、只取数值最小值。反例：一轮带行号 k 的请求之后紧跟一轮滚动，吸顶集合变了。只取 k 会让落地按下标 k 只重画一部分，甚至什么都不重画，旧行留在原处；`_lineNumbers` 却已经换成新列表（156–157 行），之后状态相等就提前返回（152–154 行），旧行一直留着。HEAD 在这个顺序下按差异重建是对的，只取最小值会比 HEAD 更差。

覆盖的路径：

- 光标换行（491 行）后同一任务里滚动：`0` 与 `undefined` 混合，传 `0`。这是发现稿描述的情形。
- 令牌、尺寸、配置变化（533、542、514 行）的 `0` 与同一任务里的滚动：同上。
- 折叠图标：`_toggleFoldingRegionForLine` 先 `setScrollTop`（452 行），`scrollTop` 改变时同步起一轮 `undefined`，随后 `_renderStickyScroll(line)`（453 行）起一轮行号请求。合并后传 `0`，整块重建，图标按折叠模型的当前状态重新生成。图标 class 只在 `StickyFoldingIcon` 构造时写（`stickyScrollWidget.ts` 578 行），不重建就不会变。`setScrollTop` 没有改变 `scrollTop` 时只有行号一轮，按原值落地，与 HEAD 相同。
- 行高变化：`allowVariableLineHeights` 默认开（`editorOptions.ts` 6009–6010 行）。模型行高变化时，`viewModelImpl.ts` 474–496 行先 `changeSpecialLineHeights`，其中 `onHeightMaybeChanged` 更新滚动尺寸，`scrollTop` 需要夹紧时同步派发滚动事件；然后派发行高外发事件，`CodeEditorWidget` 在 1883–1884 行转发，控制器对仍在吸顶列表里的行起行号请求（103–110 行）。两轮落在同一任务里时按合并规则传 `0`。字体变化（111–118 行）同理。

边界情况：

- 只有一轮、没有被作废的轮次时，合并结果就是它自己的参数，与 HEAD 相同。
- 聚焦分支（`_focused` 为真，`_renderStickyScroll` 557–590 行）在调用 `_updateState` 之前算 `expectedUpdateSeq`，`_updateState` 仍在第一个 `await` 之前递增 `_updateSeq`，两者的对应关系不变。字段的登记与合并全在 `_updateState` 里，聚焦与非聚焦两条分支共用。

明确不改什么：

- `StickyScrollWidget.setState` 的状态相等提前返回（152–154 行）、`_findIndexToRebuildFrom`（186–195 行）、`_renderRootNode` 对下标之前的行只调 `_updatePosition`（232–236 行），都不改。
- 调用方把模型行号当下标传入（107、115、453 行）是上游现状，本条不改。全是数值请求的一串（例如只有行高与字体变化、没有滚动）仍按最小值落地；行号不小于粘滞行数时保留全部旧行，与 HEAD 相同。
- `_updateAndGetMinRebuildFromLine`（594–600 行，blame 为上游 `c46c45742eb9`）不改。它在候选行版本落后期间只累积数值，随后的无参调用会拿到累积的数值，同样会把「按差异重建」换成按数值重建；这是上游现状，不在本条修。
- `_renderStickyScroll` 的结构不改，不给任何 `_renderStickyScroll` 调用加 `.catch`。控制器里 `.catch(onUnexpectedError)` 的个数和写法由五个源码扫描测试锁定，下面五个文件整体保持通过：
  - `src/vs/editor/contrib/hover/test/node/editorContribLeftoverPromiseCatchScan.test.ts`，其中 `this knife covers eight leftover Promise sites` 在 64 行要求恰好 2 处；
  - `src/vs/editor/test/node/editorLeftoverPromiseCatchScanD978.test.ts`，`locked leftover remaining stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused`（289–290 行）；
  - `src/vs/editor/contrib/format/test/node/editorRemainingLeftoverPromiseCatchScan.test.ts`，`opener / D145 / two-arg then / Resolve / D703 eight / outline swallow / grpc Wire / Connect / Watch / Pty stay skipped`（177–178 行）；
  - `src/vs/editor/contrib/codeAction/test/node/editorApplyColorInlayLeftoverPromiseCatchScan.test.ts`，`opener / D145 / two-arg then / Resolve / D703 / D709 / Connect / Watch / Pty stay skipped`（158–159 行）；
  - `src/vs/editor/contrib/gotoSymbol/test/node/editorGotoOpenLeftoverPromiseCatchScan.test.ts`，`this knife covers six leftover Promise sites` 与 `stickyScroll leftover goToDefinitionWithLocation FOF is Promise single-catch`（56–76 行）。
- `RenderedStickyLine` 构造时按 `editor.getPosition()` 写相对行号（515–517 行）、`StickyFoldingIcon` 构造时写 class（578 行）的方式不改，不在 `_updatePosition` 里补写。
- 相对行号监听只在光标行号变化时才渲染（`_positionLineNumber` 判断，486–489 行），列变化不重画。
- `08185ca0c3d` 在聚焦分支里按 `expectedUpdateSeq` 跳过写焦点的逻辑不改。
- `src/vs/editor/browser/coreCommands.ts` 中 `CursorMoveBasedCommand.runCoreEditorCommand` 先 `setCursorStates` 后 `revealAllCursors` 的顺序（680–686 行），以及视图模型的事件派发，都不改。
- 保持 `src/vs/editor/contrib/stickyScroll/test/browser/stickyScroll.test.ts` 中 `Testing the function getCandidateStickyLinesIntersecting`、`issue #157180: Render the correct line corresponding to the scope definition`、`issue #156268 : Do not reveal sticky lines when they are in a folded region`、`issue #159271 : render the correct widget state when the child scope starts on the same line as the parent scope` 通过。

本地验证：

以下用例都加在 `stickyScroll.test.ts` 的 `Sticky Scroll Tests` 套件里，沿用 `withAsyncTestCodeEditor`、`documentSymbolProviderForTestModel()` 与 `registerAndInstantiateContribution`。`await stickyScrollCandidateProvider.update()` 之后先把滚动和光标放到粘滞行可见的位置，等这些准备轮落地。测试编辑器不建视图（`src/vs/editor/test/browser/testCodeEditor.ts` 91–94 行），命令里的 reveal 不会滚动，所以用同一段同步代码里的两次调用模拟同一任务里的两次派发。共同写法：准备轮落地之后再 `sinon.spy(StickyScrollWidget.prototype, 'setState')`，或挂好后调用 `resetHistory()`；在 `try/finally` 里 `restore`；行号节点从 `spy.lastCall.thisValue.getDomNode()` 读；每条用例只用一个 `assert.deepStrictEqual`，比较由「`setState` 调用次数、第三个参数、渲染结果」组成的对象；用例结束时像现有用例一样 dispose 控制器、候选行 provider 和模型。

- 相对行号：选项加 `lineNumbers: 'relative'`。同步段里先 `editor.setPosition` 换到另一行，再 `editor.setScrollTop` 移动一个像素。先断言两个滚动位置的 `findScrollWidgetState()` 结果 `equals` 为真，保证这条用例在修之前会失败。等两轮恢复后，期望 `setState` 调用 1 次、第三个参数为 `0`，每条粘滞行 `.sticky-line-number-inner` 的文本等于该行与新光标行之差的绝对值。
- 配置变化与滚动：`editor.updateOptions` 把 `showFoldingControls` 从默认值改成 `always`，经 `_readConfigurationChange` 触发 `_renderStickyScroll(0)`，同步段里再 `setScrollTop` 一次。期望 `setState` 调用 1 次、第三个参数为 `0`。
- 行号请求与滚动混合，两种顺序各一条：用 `model.changeDecorations` 给当前某条粘滞行加 `lineHeight` 装饰（`src/vs/editor/common/model.ts` 228 行，值是行高倍数），经 `onDidChangeLineHeight`（控制器 103–110 行）起一轮行号请求；同步段里另做一次让吸顶集合改变的 `setScrollTop`。一条先加装饰后滚动，一条先滚动后加装饰。先断言滚动前后 `findScrollWidgetState().startLineNumbers` 不同，保证集合确实变了。等两轮恢复后，期望 `setState` 调用 1 次、第三个参数为 `0`，渲染出的 `.sticky-line-content` 节点按顺序从 `stickyLine<n>` 类名里取出的行号，等于此时 `findScrollWidgetState().startLineNumbers`。按现行代码，先滚动后加装饰的那条会落地行号、留下旧行；按改稿前只取数值最小值的写法，先加装饰后滚动的那条会留下旧行。
- 可选：注册 `FoldingController` 后点击粘滞行的折叠图标，期望图标 class 与折叠模型中该区域的状态一致。

验证命令与顺序见文末「实施前提与步骤」：先编译；再用 `scripts/test.sh --run src/vs/editor/contrib/stickyScroll/test/browser/stickyScroll.test.ts` 跑这个文件，并给上面五个扫描测试文件各加一个 `--run` 一起跑；最后跑 eslint。`scripts/run-unit-custom.sh` 只加载 conversation、sources、universeAgent，不会跑到这些测试。

### r01-2

问题类：suggest 的内联补全 provider 拿「按模型在 `listCodeEditors()` 里找到的第一个编辑器」的光标判断结果是否过期；同一模型同时挂在多个编辑器上时，从排在后面的编辑器发起的请求每次都被判为过期，内联补全不再出现。

不变量：

- `provideInlineCompletions` 的过期判断只看三件事：取消标记已置位、模型已释放、模型版本号与调用 `provideSuggestionItems` 之前记下的不同。不读任何编辑器的光标或当前模型。
- 判为过期时释放本次 `completions.disposable`，返回 `undefined`，不写 `_lastResult`。
- 先判断模型是否已释放，再读版本号。`TextModel.getVersionId` 对已释放的模型抛 `BugIndicatingError`（`src/vs/editor/common/model/textModel.ts` 737–740 行）。
- 不过期时，结果与光标在哪个编辑器无关：同一模型、同一版本、同一位置的请求，从哪个编辑器发起都得到相同的条目。

要动的符号：`SuggestInlineCompletions.provideInlineCompletions` 中「需要刷新」分支里的 `isStale` 闭包（200–204 行）及其两处调用（206–209 行、214–217 行）。文件：`src/vs/editor/contrib/suggest/browser/suggestInlineCompletions.ts`。

改法：

1. 在调用 `provideSuggestionItems`（192–198 行）之前记下 `model.getVersionId()`。这之前没有 `await`，此时模型一定未释放。
2. `isStale` 改为依次判断三项：`token.isCancellationRequested`、`model.isDisposed()`、当前 `model.getVersionId()` 与第 1 步记下的值不同。删去 `editor.getModel() !== model` 与 `!editor.getPosition()?.equals(position)` 两个条件。
3. 两处复核的位置不变：`provideSuggestionItems` 返回之后一次；`completions.needsClipboard` 为真时，`readText` 返回之后再一次。过期时都先 `completions.disposable.dispose()`，再返回 `undefined`。
4. `provideSuggestionItems` 在 token 已取消时自己会以 `CancellationError` 拒绝（`src/vs/editor/contrib/suggest/browser/suggest.ts` 325–328 行），所以第一次复核里的取消判断实际只在第二次复核时起作用。两处都保留这项判断，不为此改动 `provideSuggestionItems`。

明确不改什么：

- 按模型在 `listCodeEditors()` 里取第一个编辑器，读 `quickSuggestions`、`suggest`、`snippetSuggestions` 与 `SuggestModel.createSuggestFilter` 的做法（130–136 行）不改；找不到编辑器时直接返回（138–140 行）不改。改为按焦点或光标挑编辑器不在本条范围。
- `context.selectedSuggestionInfo` 存在时直接返回、`QuickSuggestionsOptions` 的两处开关判断、只在词尾触发的判断，都不改。
- 复用 `_lastResult` 的分支（`canBeReused`）没有 `await`，不加复核。
- `InlineCompletionsController` 的请求位置（`inlineCompletionsController.ts` 133 行）与 `InlineCompletionsSource.fetch` 的取消逻辑不改。同一编辑器里发起新请求时，`fetch` 先 `_updateOperation.clear()`（`inlineCompletionsSource.ts` 177 行），`UpdateOperation.dispose` 取消旧 token（627–629 行），旧结果不会再写 `_lastResult`；这正是 `941470b1a6d` 想挡住的情形，改完后仍由取消标记挡住。
- 保持 `src/vs/editor/contrib/suggest/test/browser/suggestInlineCompletions.test.ts` 中 `Aggressive inline completions when typing within line #146948` 与 `Snippets show in inline suggestions even though they are turned off #175190` 通过。这两条都在测试编辑器光标停在 (1,1) 时用 (1,3) 调用，按现行代码会返回 `undefined`，断言的 3 项与 2 项都不成立（按代码推断，未运行）；本条改完后应重新通过。

本地验证：

- 在 `suggestInlineCompletions.test.ts` 新增「同一模型挂两个编辑器」用例：用 `instantiateTestCodeEditor(insta, model)` 再建一个编辑器，把它的光标放到 (1,3)，`setup` 里建的第一个编辑器光标留在 (1,1)；以 (1,3) 调用 `provideInlineCompletions`，断言得到 3 项。用后 `disposeInlineCompletions`，并 dispose 第二个编辑器。
- 新增「挂起期间改模型」用例。先把模型改成两行（第 1 行仍是 `he`），把 `setup` 里那个编辑器的光标放到 (1,3)，这样改动前的光标判断挡不住，结果只能来自版本号判断。再注册一个 provider（同样加进 `disposables`），`provideCompletionItems` 返回由测试控制的 promise（例如 `DeferredPromise`），返回的列表带一个不接参数、记次数的 `dispose`：`isDisposable` 要求 `dispose.length === 0`（`src/vs/base/common/lifecycle.ts` 319–322 行），带参数就不会被收进 `completions.disposable`（`suggest.ts` 261–263 行）。以 (1,3) 调用挂起后只编辑第 2 行，再放行 promise。用一个 `assert.deepStrictEqual` 断言：结果是 `undefined`，该列表的 `dispose` 恰好被调用一次，编辑器光标仍在 (1,3)。按现行代码这条会拿到条目、断言失败。
- 可选：条目为含 `${CLIPBOARD}` 的片段（`SnippetParser.guessNeedsClipboard` 据此判断），使 `completions.needsClipboard` 为真；在 `insta.createInstance(SuggestInlineCompletions)` 之前用 `insta.stub(IClipboardService, 'readText', …)` 让 `readText` 挂起，期间编辑第 2 行或取消 token，断言同样返回 `undefined` 并释放一次。
- 验证命令与顺序见文末「实施前提与步骤」：先编译；再用 `scripts/test.sh --run src/vs/editor/contrib/suggest/test/browser/suggestInlineCompletions.test.ts` 跑整个文件；最后跑 eslint。`scripts/run-unit-custom.sh` 不会跑到这份测试。

## 实施前提与步骤

1. 实施前用只读 git 确认所引文件自本稿核对的 HEAD `841ea38816d` 之后有没有新提交或未提交改动；有的话按符号重新定位行号。
2. 按 r01-1、r01-2 两节分别改代码与测试。两条互不依赖，可以分开实施、分开提交。
3. 本地验证按这个顺序跑：
   - `npm run compile`；只改了 TypeScript 时可用 `npm run compile-client` 代替（`dev/progress/health-gates.md`「集成检查（本地）」）。`scripts/test.sh` 从 `out/` 加载编译产物：`test/unit/electron/renderer.js` 114–115 行定目录，189–195 行把 `--run src/…/*.ts` 换成 `out/` 下的模块。不先编译就会跑旧代码。
   - `scripts/test.sh --run <文件>`，文件见两节「本地验证」；可以重复给多个 `--run`。
   - `npm run eslint`。
   - 改了文档（包括本稿后续的状态与签收）时，跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。
4. 本稿与对应发现稿已登记进 `dev/plans/INDEX.md`（工作区里另一会话批量加的两行，尚未提交）。提交时按块暂存只带上本稿两行，不要整份暂存 `INDEX.md`。

## 核查记录（2026-11-07）

只读核对到 HEAD `841ea38816d`。`stickyScrollController.ts`、`stickyScrollWidget.ts`、`suggestInlineCompletions.ts`、`inlineCompletionsController.ts`、`coreCommands.ts`、`codeEditorWidget.ts`、`viewModelImpl.ts`、`viewModelEventDispatcher.ts`、`viewLines.ts`、`viewLayout.ts`、`scrollable.ts` 都没有未提交改动。发现稿引用的行号都没有漂移。没有编译，没有跑测试。

审查后复核（同日）：HEAD 仍为 `841ea38816d`，上述文件和 `model.ts`、`lifecycle.ts` 仍没有未提交改动。`stickyScrollWidget.ts` 152–157、186–195、232–236、244、578 行，控制器 103–118、452–453 行，`viewModelImpl.ts` 474–496 行，`textModel.ts` 1639–1640 行（带 `lineHeight` 的装饰变化在 `changeDecorations` 结束时同步派发模型行高事件），`lifecycle.ts` 319–322 行，都与本稿所写一致。

r01-1：

- 可达性。`CursorMoveBasedCommand.runCoreEditorCommand`（`coreCommands.ts` 680–686 行）先 `setCursorStates` 再 `revealAllCursors`，两次调用各自经 `_withViewEventsCollector`（`viewModelImpl.ts` 1159–1160 行、1231–1232 行）。光标外发事件在 `setCursorStates` 自己的 `endEmitViewEvents`（`viewModelEventDispatcher.ts` 94–110 行）末尾同步派发，`CodeEditorWidget` 在 1849 行同步 `fire`。`revealAllCursors` 的视图事件由 `ViewLines.onRevealRangeRequest` 同步调用 `setScrollPosition`（`viewLines.ts` 299–301 行）：位移不超过一行时用 `ScrollType.Immediate`；超过一行时用平滑类型，而平滑滚动默认关闭（`editorOptions.ts` 6699–6702 行），`ViewLayout` 把时长设为 0（`viewLayout.ts` 203–205 行），`Scrollable.setScrollPositionSmooth` 改走 `setScrollPositionNow`（`scrollable.ts` 306–310 行）。滚动外发事件（`viewModelImpl.ts` 128–140 行）推迟到同一次 `endEmitViewEvents` 末尾派发，`CodeEditorWidget` 在 1803–1805 行同步 `fire`。两次派发之间没有微任务。粘滞滚动默认开启（`editorOptions.ts` 3157 行）。光标移动不会让 `FoldingController` 换掉 `foldingModelPromise`（只在 `triggerFoldingModelChanged` 里换，`folding.ts` 311 行），两轮 `await` 同一个 promise，按开始顺序恢复，先恢复的带 `0` 的那一轮被序号判断作废。视口底边按向下键只滚一行，走 `ScrollType.Immediate`，开了平滑滚动也照样触发；Page Down 只在平滑滚动关闭（默认）时触发。
- 补充。发现稿写「粘滞行没变时状态相等」。`StickyScrollWidgetState.equals` 还比较 `lastLineRelativePosition`：行号相同而 `lastLineRelativePosition` 变了时，`_findIndexToRebuildFrom` 返回 0，会整块重建，这时相对行号是对的。最常见的情形是滚动后粘滞行和末行偏移都不变，仍会停在旧值，结论不变。
- 有意如此的依据：没有。`stickyScroll.test.ts` 不覆盖相对行号或并发更新；`ea803c3935b` 与 `08185ca0c3d` 都只改了 `stickyScrollController.ts` 一个文件，没有加测试；`docs/` 与 `docs/decisions/` 没有相关条目。
- 重复：没有。`dev/plans/review-2026-*.md`（11-07 其它路除外）、`dev/plans/INDEX.md`、`dev/progress/deferred-gaps.md`、`archive/`、`dev/archive/` 里没有承接这条缺陷的方案。`deferred-gaps.md` 的 D703、D725、D1254 涉及 stickyScroll 的只是 Promise 双链 catch，与本条无关。

r01-2：

- 可达性。`quickSuggestions` 默认是 `other: 'offWhenInlineCompletions'`，`comments` 与 `strings` 为 `off`（`editorOptions.ts` 3773–3777 行），要用户把某类设成 `inline` 才会走过 151 行。每个编辑器各有一个 `InlineCompletionsController`，请求位置取自己主选区的末端（`inlineCompletionsController.ts` 133 行），经 `InlineCompletionsSource.fetch`（`inlineCompletionsSource.ts` 165 行、233 行）交给全局 provider。`listCodeEditors()` 按 `addCodeEditor` 的登记顺序返回（`abstractCodeEditorService.ts` 70–83 行；键形如 `vs.editor.ICodeEditor:<n>`，不是整数，`Object.keys` 保持插入顺序），编辑器在构造时登记（`codeEditorWidget.ts` 407 行）。同一文件在两个编辑器组里同时可见，或工作副本同时显示在 diff 编辑器的修改侧、引用速览的嵌入编辑器里，都会让同一模型挂在多个编辑器上；从排在后面的编辑器输入时，`isStale` 每次都成立。这些都在默认编辑器窗口里可达。
- 有意如此的依据：相反。上游用例 `Aggressive inline completions when typing within line #146948` 与 `Snippets show in inline suggestions even though they are turned off #175190` 都在测试编辑器光标为 (1,1) 时用 (1,3) 调用并期望拿到条目，说明结果不应依赖编辑器光标。`dev/progress/` 下没有把这两条登记为已知红测。`941470b1a6d` 的提交说明写明没有新增测试。
- 重复：没有。同样范围内没有承接 `suggestInlineCompletions.ts` 或 `941470b1a6d` 的方案。

## 审查

2026-11-07 只读审查的结论是须改稿，r01-2 可按稿实施。Critical 已改：审查指出改稿前把 `undefined` 当成「没有请求」、只取数值最小值，与 `setState` 的语义冲突——`undefined` 表示按新旧差异重建，数值被原样当下标，而行高、字体、折叠图标传入的是模型行号；带行号的一轮之后紧跟滚动、且吸顶集合变了时，改稿前的写法会落地行号、留下旧行，比 HEAD 更差。对照 `stickyScrollWidget.ts` 152–157、190–194、232–236、244 行与控制器 107、115、453 行核实属实。r01-1 改为分别记录数值请求的最小值和是否出现过 `undefined`，两种都有时传 `0`；不变量 2、3 与边界情况相应改写，新增「有 `undefined` 时渲染结果与 `_lineNumbers` 一致」一条，改法补第 7 步写明不采用的写法，并补两种顺序的混合用例。Important 已改：审查指出折叠图标（452–453 行，图标 class 只在构造时写，widget 578 行）与行高变化（`viewModelImpl.ts` 474–496 行）两条路径同根。核实属实，新的合并规则同时覆盖，已在 r01-1「覆盖的路径」里写明，字体变化一并写入；`setScrollTop` 没改变 `scrollTop` 时只有行号一轮、维持 HEAD 行为，也已写明。

Minor 全部顺手改了：不变量 5（原第 4 条）补了「光标换行带来的 `0` 进入 `_updateState` 之后的第一次落地」的限定；测试写法改为准备轮落地后再挂 spy 或调用 `resetHistory`、在 `try/finally` 里恢复、每条用例一个 `deepStrictEqual`、用后 dispose；五个扫描测试已点名列入「明确不改什么」，并写明不给 `_renderStickyScroll` 的调用加 `.catch`；r01-2 的挂起用例改为光标放在 (1,3)、列表的 `dispose` 不带参数、在 `createInstance` 之前给 `readText` 打桩。范围外两点只记在这里、不进本稿：`_resetState` 不递增 `_updateSeq`，复位前已经在飞的轮次仍可能在复位之后落地；上游 `_readConfiguration` 关闭粘滞滚动时，`_sessionStore.clear()` 释放了 `_cursorPositionListener` 但没清字段，重新开启后 484 行的判断不再注册相对行号监听。另按本轮各路审查的共性意见：本地验证写明先编译、再跑测试、再跑 eslint、改了文档再跑 docs-health；「覆盖需求」改写为不对应的实际理由，为免被当成覆盖声明，理由里不写需求编号；实施步骤写明提交时登记 `dev/plans/INDEX.md`。判定与严重度不变。

## 实施记录（2026-11-07）

用户同意实施，并要求不编译。按本稿在当前工作区落地 r01-1 与 r01-2，本稿没有 drop 条目。HEAD 仍为 `841ea38816d`；所改四个源文件在实施前都没有别的会话的未提交改动，也不依赖别的会话尚未提交的改动，提交时没有顺序要求。没有编译，没有跑测试，没有跑 eslint 和 docs-health。

r01-1：已实施。

- `src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts`：在 `_minRebuildFromLine`、`_updateSeq` 旁新增私有字段 `_pendingMinRebuildFromLine` 与 `_pendingDiffRebuild`（78–79 行）。`_updateState`（604–629 行）在第一个 `await` 之前登记本轮请求：数值并入最小值字段，`undefined` 把布尔字段置真。作废轮次照旧直接返回，不碰这两个字段。落地时按「两种都有传 `0`、只有数值传最小值、只有 `undefined` 传 `undefined`」算出合并值，复位两个字段，再把合并值作为第三个参数传给 `setState`。`_resetState`（631–639 行）同时复位这两个字段。`_renderStickyScroll`、`_updateAndGetMinRebuildFromLine` 和 widget 都没改，也没有新增 `.catch`。
- `src/vs/editor/contrib/stickyScroll/test/browser/stickyScroll.test.ts`：新增 `sinon`、`StickyScrollWidget`、`timeout`、`Position`、`Range` 五个导入，两个读取渲染结果的辅助函数 `renderedStickyLineNumbers` 与 `renderedStickyLineNumberTexts`，以及四条用例：`relative sticky line numbers follow a cursor line change that is followed by a scroll in the same task`、`a full rebuild requested by a configuration change survives a scroll in the same task`、`a line number request and a scroll in the same task rebuild the whole widget (line height change first)`、`a line number request and a scroll in the same task rebuild the whole widget (scroll first)`。
- 与方案的出入：
  - 方案写「先断言两个滚动位置的状态相等」「先断言集合确实变了」。实现时把这些前提和结果并进同一个 `assert.deepStrictEqual` 的对象（`stateUnchanged`、`stickyLines`、`stickyLinesBefore`、`stickyLinesAfter`），以满足审查要求的每条用例一个 `deepStrictEqual`。
  - 「`setState` 调用 1 次、第三个参数为 `0`」写成 `getCalls().map(call => call.args[2])` 等于 `[0]`，一次比较同时覆盖次数和参数。
  - spy 在准备阶段之前挂上，准备轮落地后从 `lastCall.thisValue` 取 widget，再 `resetHistory()`。这是方案允许的两种写法之一。spy 的恢复和控制器、候选行 provider、模型的释放都放在 `finally` 里。
  - 混合用例的滚动目标取 `11 * lineHeight + 1`，期望集合从 [7, 9] 变成 [7]。候选行的 `top`/`height` 在查询时按当前行高计算（`stickyScrollProvider.ts` 224–225 行）；第 9 行加两倍行高后，`10 * lineHeight + 1` 仍是 [7, 9]，要到 `11 * lineHeight + 1` 才变成 [7]。这几个期望值是按代码推算写进去的，没有运行确认。
- 没做：方案标为可选的 `FoldingController` 折叠图标用例。测试编辑器默认不实例化编辑器贡献（`instantiateTestCodeEditor` 传 `contributions: []`），这条用例要注册 `FoldingController` 并合成点击，不编译时出错的风险高；折叠图标路径与行号加滚动的混合用例走的是同一条合并逻辑。

r01-2：已实施。

- `src/vs/editor/contrib/suggest/browser/suggestInlineCompletions.ts`：「需要刷新」分支在调用 `provideSuggestionItems` 之前记下 `model.getVersionId()`（192 行）。`isStale`（203–206 行）改为依次判断取消标记、`model.isDisposed()` 和版本号是否变化，删去按模型找到的编辑器的模型与光标两项。两处复核位置和过期时的释放都没变。
- `src/vs/editor/contrib/suggest/test/browser/suggestInlineCompletions.test.ts`：新增 `DeferredPromise` 导入和两条用例：`inline completions do not depend on the cursor of another editor that shows the same model`、`inline completions are dropped when the model changes while completion providers are pending`。后一条先把模型改成两行，把 `setup` 里的编辑器光标放到 (1,3)，在 provider 挂起期间只编辑第 2 行；列表的 `dispose` 是对象字面量里的无参方法；一个 `deepStrictEqual` 同时断言结果为 `undefined`、`dispose` 恰好调用一次、光标仍在 (1,3)。
- 与方案的出入：无。
- 没做：方案标为可选的剪贴板用例。第二次复核与第一次共用同一个 `isStale`，判断逻辑已由挂起用例覆盖。

之后要跑的本地验证，按顺序：

1. `npm run compile`；只改了 TypeScript，可用 `npm run compile-client` 代替。
2. `scripts/test.sh --run src/vs/editor/contrib/stickyScroll/test/browser/stickyScroll.test.ts --run src/vs/editor/contrib/hover/test/node/editorContribLeftoverPromiseCatchScan.test.ts --run src/vs/editor/test/node/editorLeftoverPromiseCatchScanD978.test.ts --run src/vs/editor/contrib/format/test/node/editorRemainingLeftoverPromiseCatchScan.test.ts --run src/vs/editor/contrib/codeAction/test/node/editorApplyColorInlayLeftoverPromiseCatchScan.test.ts --run src/vs/editor/contrib/gotoSymbol/test/node/editorGotoOpenLeftoverPromiseCatchScan.test.ts`
3. `scripts/test.sh --run src/vs/editor/contrib/suggest/test/browser/suggestInlineCompletions.test.ts`。预期 `Aggressive inline completions when typing within line #146948` 与 `Snippets show in inline suggestions even though they are turned off #175190` 恢复通过。
4. `npm run eslint`。
5. 本稿改过，跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。
6. `dev/plans/INDEX.md` 已登记；提交时按块暂存只带上本稿两行，不要整份暂存 `INDEX.md`。

代码审查（2026-11-07）：只读代码审查的结论是可接受，只有 Minor，都已处理，仍未编译、未跑测试。

- `stickyScroll.test.ts` 的 `renderedStickyLineNumbers` 改用命名捕获组 `(?<lineNumber>\d+)`，读 `match?.groups?.lineNumber`，符合 `.github/copilot-instructions.md` 的约定。
- 「实施前提与步骤」第 4 步和上面第 6 条改为：`INDEX.md` 已登记，提交时按块暂存只带上本稿两行，不整份暂存。
- 可选项已做：配置变化用例 `a full rebuild requested by a configuration change survives a scroll in the same task` 也在准备轮落地后取 widget，把吸顶行、`setState` 的第三个参数和渲染出的行放进同一个快照，吸顶行与渲染行都期望为 [7, 9]。
