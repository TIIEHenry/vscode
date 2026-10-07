---
title: "方案 r02：editor"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 1，drop 0，weaken 1。字面换行开关停在视图模型构造值；视口 Unicode 计数自加仍在，非基本 ASCII 打开时横幅类别与正确计数相同。"
---

hold 1，drop 0，weaken 1

## r02-1

- 问题类：编辑器已打开时切换 `editor.wrapOnEscapedLineFeeds`，字面 `\n` 的折行仍用构造时的开关。
- 不变量：`ViewModelLinesFromProjectedModel.wrapOnEscapedLineFeeds` 与当前配置一致。`setWrappingSettings` 在字体、折行策略、折行列、缩进、`wordBreak`、该开关都相同的时候返回 false。只有该开关变化时返回 true，并且 `previousLineBreaks` 保持 null，走 `_constructLines` 全量重建。第 314 行 `onlyWrappingColumnChanged` 仅在该开关也未变时为 true；开关与折行列同一次变化时不把旧投影交给增量断行。`createLineBreaksComputer` 继续把该字段传给工厂。无注入文本且 `wrappingColumn === -1` 时，`createLineBreaks` 在 `monospaceLineBreaksComputer.ts` 第 373–375 行返回 null；有注入文本时第 379 行返回单段投影。两条都不进入第 468 行的字面 `\n` 判定。DOM 路径在 `domLineBreaksComputer.ts` 第 61–66 行整段返回。开关变化仍写入字段并返回 true，可见折行仍依赖折行已开启。
- 要动的符号或文件：`IViewModelLines.setWrappingSettings`（`src/vs/editor/common/viewModel/viewModelLines.ts` 第 25 行）增加末位参数 `wrapOnEscapedLineFeeds: boolean`。`ViewModelLinesFromProjectedModel.setWrappingSettings`（第 304–320 行）做比较和赋值，并把该相等条件并进第 314 行。`ViewModelLinesFromModelAsIs.setWrappingSettings`（第 1199 行）写成 `(_fontInfo, _wrappingStrategy, _wrappingColumn, _wrappingIndent, _wordBreak, _wrapOnEscapedLineFeeds)`，新开关在 `wordBreak` 之后，方法体仍返回 false。`ViewModel._onConfigurationChanged`（`src/vs/editor/common/viewModel/viewModelImpl.ts` 第 274–283 行）读取 `EditorOption.wrapOnEscapedLineFeeds` 并传入。
- 明确不改什么：构造函数第 136 行的初次赋值；第 105–118 行构造 `ViewModelLinesFromProjectedModel` 时已经传入的开关；`createLineBreaksComputer` 第 349 行的传参；`monospaceLineBreaksComputer.ts` 与 `domLineBreaksComputer.ts` 的断行算法；`editorOptions.ts` 第 6861–6864 行的选项注册与文案；大文件走 `ViewModelLinesFromModelAsIs` 时不折行。
- 怎样本地验证：已有测试在创建断行器时传入开关，没有调用 `setWrappingSettings`：`wrapOnEscapedLineFeeds: isEscapedLineBreakAtPosition at line start`、`wrapOnEscapedLineFeeds: breaks after literal \n without double quotes`、`issue #258022: wrapOnEscapedLineFeeds: should work correctly after editor resize`、`wrapOnEscapedLineFeeds: breaks after literal \n in DOM measurement`。在 `src/vs/editor/test/browser/viewModel/modelLineProjection.test.ts` 按 `withSplitLinesCollection`（第 998–1025 行）的方式自己构造 `ViewModelLinesFromProjectedModel`，把 `fontInfo`、`wrappingColumn`、`wrappingIndent`、`wordBreak` 留在调用处。该 helper 不把这些值交给回调，也不 dispose 投影；现有调用在回调里 dispose（第 973、991 行）。文件第 365 行有 `ensureNoDisposablesAreLeakedInTestSuite`。新测试结束时 dispose 投影、model 和 configuration。`wordWrap` 使用 `wordWrapColumn`，折行列为正且大于样本可见列，样本无注入文本。样本是短于折行列、含一个字面 `\n` 的模型行。构造时开关为 false，断言 `getModelLineViewLineCount` 为 1。用同一组字体、`'simple'`、折行列、缩进、`wordBreak` 调用 `setWrappingSettings` 并传入 true，断言返回 true，且该模型行视图行数为 2。再传入 false，断言返回 true 且视图行数回到 1。再传入 false，断言返回 false。新断言的描述里写上 `setWrappingSettings` 与 `wrapOnEscapedLineFeeds`。`scripts/test.sh --grep wrapOnEscapedLineFeeds`。

## r02-2 降为低

降为低是优先级。信任工作区里解析后的 `nonBasicASCII` 为 false 时，横幅类别仍然错，修复和下面的断言保留。

- 问题类：视口 Unicode 高亮把三类计数加到自己身上，计数停在 0；`hasMore` 时横幅总是走进非基本 ASCII 分支。
- 降级说明（读到的反证）：第 366–368 行确实是 `totalResult` 各计数字段自加，从第 354–359 行的 0 出发后保持 0。第 363–365 行区间来自 `result.ranges`，第 369 行 `hasMore` 来自 `result.hasMore`。第 95–102 行在三个计数都是 0 时 `Math.max` 为 0，`nonBasicAsciiCharacterCount >= max` 成立，横幅文案与命令固定是非基本 ASCII。反证在分类器：`CodePointHighlighter.shouldHighlightNonBasicASCII`（`unicodeTextModelHighlighter.ts` 第 194–196 行）在 `options.nonBasicASCII` 为 true 时直接返回 `NonBasicASCII`，不可见与易混计数保持 0。正确聚合后仍然是非基本 ASCII 大于等于 max，横幅文案与 `DisableHighlightingOfNonBasicAsciiCharactersAction` 和现在相同。默认值是 `nonBasicASCII: inUntrustedWorkspace`（`editorOptions.ts` 第 4335 行）；`resolveOptions`（`unicodeHighlighter.ts` 第 206 行）在不受信任工作区把该选项变成 true。发现稿「禁用按钮也关错类别」只在解析后的 `nonBasicASCII` 为 false、真实最大计数是不可见或易混时成立。信任工作区的默认解析是 false，那条路径上的横幅类别仍然是错的。
- 不变量：`ViewportUnicodeHighlighter._update` 对每个可见区间，把 `result.ambiguousCharacterCount`、`result.invisibleCharacterCount`、`result.nonBasicAsciiCharacterCount` 分别加进 `totalResult` 的同名字段。`ranges` 仍逐段推入 `result.ranges`。`hasMore` 仍是各段 `result.hasMore` 的或。横幅仍只在聚合后 `hasMore` 为 true 时出现。类别仍由 `_updateState` 第 95–112 行的现有顺序决定。
- 要动的符号或文件：`ViewportUnicodeHighlighter._update`（`src/vs/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.ts` 第 366–368 行）三处 `+=` 的右值，改成 `result` 上的同名字段。
- 明确不改什么：第 363–365 行的 ranges；第 369 行的 hasMore；第 372–378 行 `hasMore` 时不画装饰；`_updateState` 第 88–134 行的文案、优先级和三个禁用动作；`UnicodeTextModelHighlighter.computeUnicodeHighlights` 与 `MAX_RESULT_LENGTH`（第 82 行）；`DocumentUnicodeHighlighter._update`（第 268 行把 worker 的 `info` 原样交给 `_updateState`）；`canComputeUnicodeHighlights` 对超过同步上限的模型返回 false（`src/vs/editor/browser/services/editorWorkerService.ts` 第 47–55 行与第 101–103 行，`TextModel._MODEL_SYNC_LIMIT` 为 50MB）。
- 怎样本地验证：没有覆盖这段聚合的测试。已有 `computeUnicodeHighlights (#168068)` 只断言 `UnicodeTextModelHighlighter.computeUnicodeHighlights`，右值写错时它仍然通过。`scripts/test.sh --grep computeUnicodeHighlights` 只跑到这条。新测试放在 `src/vs/editor/contrib/unicodeHighlighter/test/browser/`，描述里写上 `ViewportUnicodeHighlighter`，用 `scripts/test.sh --grep ViewportUnicodeHighlighter` 跑。

  `instantiateTestCodeEditor`（`testCodeEditor.ts` 第 277 行）传入 `contributions: []`。`CodeEditorWidget` 第 339–340 行在收到数组时只用这份列表。`getContribution` 因此得不到 `UnicodeHighlighter`。用 `TestCodeEditor.registerAndInstantiateContribution`（第 108–111 行）创建它。`TestEditorWorkerService.canComputeUnicodeHighlights` 返回 false（`src/vs/editor/test/common/services/testEditorWorkerService.ts` 第 19 行），`createCodeEditorServices` 第 224 行登记的就是它，所以会走到视口高亮。

  创建编辑器前在 `serviceCollection` 里补上构造函数会用到的服务。`IWorkspaceTrustManagementService`：`isWorkspaceTrusted()` 返回 true，并提供 `onDidChangeTrust`（第 66 行会订阅）。编辑器测试不要引用 `src/vs/workbench/test` 里的同名类。`IMarkdownRendererService`：`Banner` 构造要注入它（`bannerController.ts` 第 58–60 行）；这次 `message` 是字符串，第 79–82 行不调用 `render`。`IHoverService` 用已有的 `NullHoverService`（`src/vs/platform/hover/test/browser/nullHoverService.ts`），因为 `Link` 构造需要它（`link.ts` 第 84–89 行）。`IOpenerService` 已经是 `NullOpenerService`。

  `TestCodeEditor._createView`（第 91–93 行）不创建视图。`TestEditorDomElement`（第 128–138 行）没有 `contains` 和 `prepend`，`setBanner`（`codeEditorWidget.ts` 第 1738 行）会抛。`registerAndInstantiateContribution` 返回后、第 319 行 250ms 的 `RunOnceScheduler` 触发前，把该编辑器实例的 `setBanner` 换成记录传入节点的函数。`Banner.show` 在调用 `setBanner` 之前已经建好节点。读该节点的文本和 `a.monaco-link` 的 `href`。`withAsyncTestCodeEditor` 只等待 callback 的 Promise。callback 里用 `base/common/async.js` 的 `timeout` 至少等到 250ms，它不会自己推进这次调度。

  样本是一行，折行保持关闭，让 1001 个字符留在同一视图行。默认 `outerHeight` 100、`lineHeight` 19（`testConfiguration.ts` 第 25、41 行）。断言 `editor.getVisibleRanges()`（`viewModelImpl.ts` 第 646–648 行）覆盖这一整行。整行范围来自 `getCompletelyVisibleViewRange` 第 700–708 行的 `getLineMaxColumn`。`hasMore` 来自这一次 `computeUnicodeHighlights` 的 `ranges.length >= 1000`（第 82–86 行），不是多段可见区相加。选项 `unicodeHighlight.nonBasicASCII` 为 false，`invisibleCharacters` 为 true，`ambiguousCharacters` 为 false。字符是 U+00A0。横幅文本是 `This document contains many invisible unicode characters`，`href` 是 `command:editor.action.unicodeHighlight.disableHighlightingOfInvisibleCharacters`。

  易混样本同样是一行 1001 个 U+03B1。该码位在 `strings.ts` 第 1253 行 `_common` 表里与 97 成对，且不在 `InvisibleCharacters` 里。第 1310–1311 行把 `_common` 并进任何 locale。选项 `nonBasicASCII` 为 false，`ambiguousCharacters` 为 true，`invisibleCharacters` 为 false。整行只有这个字符，避免第 216–220 行因词内另有非易混的非基本 ASCII 而跳过。`href` 是 `command:editor.action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters`。不要用夹具里的 `å`（U+00E5），`computeUnicodeHighlights (#168068)` 对它的 `ambiguousCharacterCount` 是 0。

  `nonBasicASCII: true` 时横幅文本在修改前后都是 `This document contains many non-basic ASCII unicode characters`。计数不出现在横幅节点上，这条只核对降级，不证明第 368 行的右值。第三行与前两行一起改。

## 审查

2026-10-06 只读审查后改稿。Critical：原验证以为 `getContribution` 会创建视口高亮，并以为 `withAsyncTestCodeEditor` 会等到 250ms。HEAD 上 `contributions: []`，测试 DOM 没有 `contains` / `prepend`。已改成 `registerAndInstantiateContribution`、补服务、在调度前替换 `setBanner`、callback 里 `timeout`。Important：`hasMore` 按单次可见区计算；样本改为一行；易混码位写成 U+03B1。Minor：`ViewModelLinesFromModelAsIs` 写全六参；`wrappingColumn === -1` 补上无注入文本和 DOM 提前返回；投影测试补 dispose；降级旁注明信任工作区默认路径仍然错类别。未采纳「U+03B1 位于 `strings.ts` 第 1268–1276 行」：那几行是 `mergeMaps`，码位在第 1253 行的 `_common` JSON 里。
