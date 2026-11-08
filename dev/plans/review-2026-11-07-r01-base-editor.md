---
title: "十六路审查 2026-11-07 r01：base 与 editor 发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读审查 base 与 editor 在 10-30 之后的提交，以及 9 月以来本地加的防过期写回修补，记录 2 条：粘滞滚动丢掉整块重建，相对行号停在旧值；同一文件分屏时 suggest 内联补全每次都被判为过期。"
---

# 十六路审查 2026-11-07 r01：base 与 editor 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

2026-10-30 之后，本范围有 8 个提交，工作区里没有未提交改动。这 8 个提交是：`5faa81c765c`（`ContextView.show` 先释放上一次 render 的结果）、`b76647dcf98`（`TriStateCheckbox` 的 `aria-checked`）、`a4886c2f2da`（`Dialog` 多行输入和输入法组合态），`a84ee5d74d1`、`6bd0259a3b2`、`73bb4af0913`（合并重复的 `.catch`、加销毁守卫、销毁时移除 DOM），另有 `054fdd785e2`、`fbc4e93f92c` 只改测试。逐个读过 diff 和改动处的活码，没有找到可证实的问题。随后抽查了 9 月下旬以来本地加的防过期写回修补，以及 10-25 实施的修复，涉及 suggest、粘滞滚动、语义着色、链接、节标题、重命名、悬停、跳转定义与引用面板、goto symbol 快速输入、大纲缓存、查找、扩选、异常行终止符、颜色、CodeLens、代码操作、内联提示、异步树与分页、`AsyncReader`、web worker 模块加载。下面 2 条都是这些本地修补自己带进来的行为错误。

### r01-1

- 严重度：中
- 症状：`editor.lineNumbers` 设为 `relative`，粘滞滚动和平滑滚动都保持默认（前者开、后者关）。用 Page Down 翻页，或在视口底边按向下键，光标换行并带动滚动后，粘滞行左边的相对行号不更新，仍是按换行前的光标算出的距离。要等到下一次不带滚动的光标换行才改对。
- 代码：`src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts` 483–492、467–472、551–556、602–614；`src/vs/editor/contrib/stickyScroll/browser/stickyScrollWidget.ts` 149–154、232–236、515–516；`src/vs/editor/browser/coreCommands.ts` 680–686。

```680:686:src/vs/editor/browser/coreCommands.ts
			viewModel.model.pushStackElement();
			viewModel.setCursorStates(
				dynamicArgs.source,
				CursorChangeReason.Explicit,
				CursorMoveCommands.simpleMove(viewModel, viewModel.getCursorStates(), args.direction, args.select, args.value, args.unit)
			);
			viewModel.revealAllCursors(dynamicArgs.source, true);
```

```483:492:src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts
		if (lineNumberOption.renderType === RenderLineNumbersType.Relative) {
			if (!this._cursorPositionListener) {
				this._cursorPositionListener = this._editor.onDidChangeCursorPosition((e) => {
					if (this._positionLineNumber === e.position.lineNumber) {
						return;
					}
					this._positionLineNumber = e.position.lineNumber;
					this._showEndForLine = undefined;
					this._renderStickyScroll(0);
				});
```

```467:472:src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts
			this._sessionStore.add(this._editor.onDidScrollChange((e) => {
				if (e.scrollTopChanged) {
					this._showEndForLine = undefined;
					this._renderStickyScroll();
				}
			}));
```

```602:614:src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts
	private async _updateState(rebuildFromLine?: number): Promise<void> {
		const seq = ++this._updateSeq;
		this._minRebuildFromLine = undefined;
		const foldingModel = await FoldingController.get(this._editor)?.getFoldingModel() ?? undefined;
		if (this._store.isDisposed || seq !== this._updateSeq) {
			return;
		}
		this._foldingModel = foldingModel;
		this._widgetState = this.findScrollWidgetState();
		const stickyWidgetHasLines = this._widgetState.startLineNumbers.length > 0;
		this._stickyScrollVisibleContextKey.set(stickyWidgetHasLines);
		this._stickyScrollWidget.setState(this._widgetState, this._foldingModel, rebuildFromLine);
	}
```

```149:154:src/vs/editor/contrib/stickyScroll/browser/stickyScrollWidget.ts
	setState(state: StickyScrollWidgetState | undefined, foldingModel: FoldingModel | undefined, rebuildFromIndexCandidate?: number): void {
		const currentStateAndPreviousStateUndefined = !this._state && !state;
		const currentStateDefinedAndEqualsPreviousState = this._state && this._state.equals(state);
		if (rebuildFromIndexCandidate === undefined && (currentStateAndPreviousStateUndefined || currentStateDefinedAndEqualsPreviousState)) {
			return;
		}
```

```515:516:src/vs/editor/contrib/stickyScroll/browser/stickyScrollWidget.ts
		} else if (lineNumberOption.renderType === RenderLineNumbersType.Relative) {
			innerLineNumberHTML.innerText = Math.abs(lineNumber - editor.getPosition()!.lineNumber).toString();
```

- 为什么是问题：`cursorDown` 和 `cursorPageDown` 先 `setCursorStates`，再 `revealAllCursors`。两次调用各自在 `_withViewEventsCollector` 结束时同步派发外发事件，`CodeEditorWidget` 收到后同步 `fire`。第一次派发的是光标事件。相对行号监听调用 `_renderStickyScroll(0)`，进入 `_updateState(0)`：`_updateSeq` 加一，`_minRebuildFromLine` 清空，然后停在 `await getFoldingModel()`。第二次调用里，`ViewLines.onRevealRangeRequest` 同步 `setScrollPosition`；平滑滚动关闭时，`ViewLayout` 把平滑时长设为 0，`setScrollPositionSmooth` 直接走 `setScrollPositionNow`，滚动事件也同步发出。滚动监听调用 `_renderStickyScroll()`，第 551 行的 `_updateAndGetMinRebuildFromLine(undefined)` 读到的是刚被清空的 `undefined`，于是进入 `_updateState(undefined)`，序号再加一。两个 `await` 排在同一个任务后面。先恢复的是带 `0` 的那一轮，它看到 `seq !== this._updateSeq` 就返回，整块重建没有执行，也没有把 `0` 放回 `_minRebuildFromLine`。后一轮带着 `undefined` 调 `setState`：粘滞行没变时状态相等，152–153 行直接返回；粘滞行变了，`_findIndexToRebuildFrom` 也只从第一条新行号开始重建，前面留下的行在 232–236 行只经 `_updatePosition` 改位置。相对行号是 `RenderedStickyLine` 构造时按 `editor.getPosition()` 写进去的（515–516 行），行不重建，数字就停在旧值。这个序号判断由本地提交 `ea803c3935b` 加入。加入之前两轮都会落地，先恢复的那一轮按 `0` 整块重画。`_onTokensChange` 和 `_onDidResize` 传进来的 `0` 也走这条路：只要 `getFoldingModel()` 返回之前又来一次不带行号的 `_renderStickyScroll()`，这次整块重建同样会丢。
- 方向：被后一轮作废的那一轮，要把自己的 `rebuildFromLine` 合并回 `_minRebuildFromLine`，由后一轮按较小值重建，不能直接丢掉。

### r01-2

- 严重度：低
- 症状：`editor.quickSuggestions` 里某类设成 `inline`，同一个文件在两个编辑器里打开（例如左右分屏），在后打开的那个编辑器里输入时，suggest 提供的内联补全不再出现。
- 代码：`src/vs/editor/contrib/suggest/browser/suggestInlineCompletions.ts` 130–136、200–209；请求位置的来源是 `src/vs/editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.ts` 133；编辑器登记见 `src/vs/editor/browser/widget/codeEditor/codeEditorWidget.ts` 407。

```130:136:src/vs/editor/contrib/suggest/browser/suggestInlineCompletions.ts
		let editor: ICodeEditor | undefined;
		for (const candidate of this._editorService.listCodeEditors()) {
			if (candidate.getModel() === model) {
				editor = candidate;
				break;
			}
		}
```

```200:209:src/vs/editor/contrib/suggest/browser/suggestInlineCompletions.ts
			const isStale = () =>
				token.isCancellationRequested
				|| editor.getModel() !== model
				|| model.isDisposed()
				|| !editor.getPosition()?.equals(position);

			if (isStale()) {
				completions.disposable.dispose();
				return undefined;
			}
```

```133:133:src/vs/editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.ts
		this._positions = derived(this, reader => this._editorObs.selections.read(reader)?.map(s => s.getEndPosition()) ?? [new Position(1, 1)]);
```

```84:89:src/vs/editor/contrib/suggest/test/browser/suggestInlineCompletions.test.ts
		{
			// (1,3), end of word -> suggestions
			const result = await completions.provideInlineCompletions(model, new Position(1, 3), context, CancellationToken.None);
			assert.strictEqual(result?.items.length, 3);
			completions.disposeInlineCompletions(result);
		}
```

- 为什么是问题：provider 只收到 `model` 和 `position`，编辑器是按模型在 `listCodeEditors()` 里找到的第一个。`CodeEditorWidget` 在构造时 `addCodeEditor(this)`，先建的编辑器排在前面。请求位置来自发起请求的那个编辑器自己的选区（`inlineCompletionsController.ts` 133）。分屏后在第二个编辑器里输入，找到的 `editor` 是第一个编辑器，它的光标停在别处，`!editor.getPosition()?.equals(position)` 一直为真。于是 `isStale()` 每次都成立，补全项被释放，provider 返回 `undefined`。这条位置比较由本地提交 `941470b1a6d` 加入，加入之前同样的请求会返回结果。上游用例 `Aggressive inline completions when typing within line #146948` 也是这种调用：测试编辑器的光标还在 (1,1)，用 (1,3) 调用，期望拿到 3 项。按现在的判断，这次调用会返回 `undefined`。
- 方向：判断过期不要拿按模型猜出来的那个编辑器的光标去比；需要判断时改看请求时的模型版本号和取消标记。

## 打开过的文件

- `src/vs/base/browser/ui/contextview/contextview.ts`
- `src/vs/base/browser/ui/dialog/dialog.ts`
- `src/vs/base/browser/ui/toggle/toggle.ts`
- `src/vs/base/browser/ui/tree/asyncDataTree.ts`
- `src/vs/base/common/async.ts`
- `src/vs/base/common/scrollable.ts`
- `src/vs/base/common/worker/webWorker.ts`
- `src/vs/base/parts/ipc/node/ipc.net.ts`
- `src/vs/base/parts/storage/common/storage.ts`
- `src/vs/editor/browser/coreCommands.ts`
- `src/vs/editor/browser/viewParts/viewLines/viewLines.ts`
- `src/vs/editor/browser/widget/codeEditor/codeEditorWidget.ts`
- `src/vs/editor/common/config/editorOptions.ts`
- `src/vs/editor/common/model/tokens/treeSitter/treeSitterTree.ts`
- `src/vs/editor/common/viewLayout/viewLayout.ts`
- `src/vs/editor/common/viewModel/viewModelImpl.ts`
- `src/vs/editor/common/viewModelEventDispatcher.ts`
- `src/vs/editor/contrib/clipboard/browser/clipboard.ts`
- `src/vs/editor/contrib/codeAction/browser/codeActionController.ts`
- `src/vs/editor/contrib/codeAction/browser/codeActionModel.ts`
- `src/vs/editor/contrib/colorPicker/browser/colorDetector.ts`
- `src/vs/editor/contrib/find/browser/findWidgetSearchHistory.ts`
- `src/vs/editor/contrib/gotoSymbol/browser/peek/referencesController.ts`
- `src/vs/editor/contrib/gotoSymbol/browser/peek/referencesTree.ts`
- `src/vs/editor/contrib/gotoSymbol/browser/referencesModel.ts`
- `src/vs/editor/contrib/hover/browser/hoverOperation.ts`
- `src/vs/editor/contrib/inlayHints/browser/inlayHintsController.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/utils.ts`
- `src/vs/editor/contrib/sectionHeaders/browser/sectionHeaders.ts`
- `src/vs/editor/contrib/semanticTokens/browser/documentSemanticTokens.ts`
- `src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts`
- `src/vs/editor/contrib/stickyScroll/browser/stickyScrollWidget.ts`
- `src/vs/editor/contrib/suggest/browser/suggestController.ts`
- `src/vs/editor/contrib/suggest/browser/suggestInlineCompletions.ts`
- `src/vs/editor/contrib/suggest/browser/suggestModel.ts`
- `src/vs/editor/contrib/suggest/test/browser/suggestInlineCompletions.test.ts`
- `src/vs/editor/contrib/unicodeHighlighter/browser/bannerController.ts`
- `src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts`
- `src/vs/platform/actionWidget/browser/actionWidget.ts`（只读，核对接口）
- `src/vs/platform/secrets/common/secrets.ts`（只读，核对接口）
- `src/vs/platform/storage/electron-main/storageMain.ts`（只读，核对接口）
- `src/vs/workbench/services/storage/electron-browser/storageService.ts`（只读，核对接口）
