---
title: "审查 r05：editor"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "4 条；差异计算尚未跟上编辑就把旧 diff 标成最新，回退会按旧行号改修改稿。"
---
# 审查 r05：editor

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r05-1 高
- 症状：差异还在算时用户改了原文或修改稿，算完后界面把这份旧 diff 当成最新；点回退会按旧行号覆盖修改稿里已经变过的文字。
- 位置：`src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts` 第 307–318 行
- 引用：

```307:318:src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts
			result = normalizeDocumentDiff(result, model.original, model.modified);
			result = applyOriginalEdits(result, originalTextEditInfos, model.original, model.modified) ?? result;
			result = applyModifiedEdits(result, modifiedTextEditInfos, model.original, model.modified) ?? result;

			transaction(tx => {
				/** @description write diff result */
				updateUnchangedRegions(result, tx);

				this._lastDiff = result;
				const state = DiffState.fromDiffResult(result);
				this._diff.set(state, tx);
				this._isDiffUpToDate.set(true, tx);
```

```651:652:src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts
function applyOriginalEdits(diff: IDocumentDiff, textEdits: TextEditInfo[], originalTextModel: ITextModel, modifiedTextModel: ITextModel): IDocumentDiff | undefined {
	return undefined;
```

```676:677:src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts
function applyModifiedEdits(diff: IDocumentDiff, textEdits: TextEditInfo[], originalTextModel: ITextModel, modifiedTextModel: ITextModel): IDocumentDiff | undefined {
	return undefined;
```

```589:599:src/vs/editor/browser/widget/diffEditor/diffEditorWidget.ts
	revert(diff: LineRangeMapping): void {
		const model = this._diffModel.get();
		if (!model || !model.isDiffUpToDate.get()) { return; }

		this._editors.modified.pushUndoStop();
		this._editors.modified.executeEdits('diffEditor', [
			{
				range: diff.modified.toExclusiveRange(),
				text: model.model.original.getValueInRange(diff.original.toExclusiveRange())
			}
		]);
```

- 为什么是问题：`await computeDiff` 之后没有核对这次计算是否仍是当前一轮。等待期间记在 `originalTextEditInfos` / `modifiedTextEditInfos` 里的编辑，要靠 `applyOriginalEdits` / `applyModifiedEdits` 平移；这两个函数现在直接 `return undefined`，`?? result` 就留下等待开始时的映射，并立刻 `_isDiffUpToDate.set(true)`。内容变更监听刚把该标志设成 false，这里又盖回去。`revert` 只看这个标志，然后用映射里的旧行号对当前修改稿 `executeEdits`。行号还在范围内时，会把用户刚打的字换成原文对应片段；行被删掉后，`normalizeDocumentDiff` 里的 `getLineMaxColumn` 会因非法行号抛错，这一轮结果写不回去。
- 方向：等待期间有编辑且平移失败时保持未完成，不要把未平移的 diff 标成最新。

## r05-2 高
- 症状：双击带文本编辑的 inlay 提示后，解析回来仍按按下时的范围改当前编辑器；期间换了文件或继续打字，会改到另一份缓冲或盖掉新输入。
- 位置：`src/vs/editor/contrib/inlayHints/browser/inlayHintsController.ts` 第 397–402 行
- 引用：

```397:402:src/vs/editor/contrib/inlayHints/browser/inlayHintsController.ts
			e.event.preventDefault();
			await part.item.resolve(CancellationToken.None);
			if (isNonEmptyArray(part.item.hint.textEdits)) {
				const edits = part.item.hint.textEdits.map(edit => EditOperation.replace(Range.lift(edit.range), edit.text));
				this._editor.executeEdits('inlayHint.default', edits);
				updateInlayHints();
```

- 为什么是问题：`resolve` 用 `CancellationToken.None`，模型更换、版本变化或销毁都不会取消。返回后不比较 `getModel()` 是否仍是双击时的模型，也不比较 `getVersionId()`。`textEdits` 的范围是解析前的文档坐标，`executeEdits` 写的是编辑器此刻的模型。同一文件里继续输入时，范围会落到新文字上；编辑器已换成别的模型时，这些替换会写进那份缓冲。
- 方向：应用前确认仍是双击时的模型且版本未变，否则丢掉这次 `textEdits`。

## r05-3 中
- 症状：折行打开时，括号水平引导线仍按模型可见列定位，和已经换算过的竖线错位，或因为超出折行列宽被丢掉。
- 位置：`src/vs/editor/common/viewModel/viewModelLines.ts` 第 643–684 行
- 引用：

```643:648:src/vs/editor/common/viewModel/viewModelLines.ts
					if (!g.horizontalLine) {
						if (g.bracketGuideVisibleColumnSourceLineNumber === -1 || g.visibleColumn === -1) {
							return g;
						}
						const sourceProjection = this.modelLineProjections[g.bracketGuideVisibleColumnSourceLineNumber - 1];
						const renderVisibleColumn = bracketGuideModelVisibleColumnToRenderVisibleColumn(sourceProjection, g.visibleColumn);
```

```677:683:src/vs/editor/common/viewModel/viewModelLines.ts
					if (p.lineNumber === viewLineInfo.modelLineWrappedLineIdx) {
						return new IndentGuide(g.visibleColumn, column, g.className,
							new IndentGuideHorizontalLine(g.horizontalLine.top,
								viewPosition.column),
							-1,
							-1,
							g.bracketGuideVisibleColumnSourceLineNumber,
```

- 为什么是问题：竖线会走 `bracketGuideModelVisibleColumnToRenderVisibleColumn`，把来源行的模型可见列换成当前折行片段上的绘制列。有 `horizontalLine` 时这段被跳过，`new IndentGuide` 的第一个参数仍是模型可见列，终点 `endColumn` 却已换成视图列。绘制时 `left` 用 `(visibleColumn - 1) * spaceWidth`，水平线起点落在错误的视图列上；起点超过折行宽度时，这条水平线会被丢掉。
- 方向：水平引导线的 `visibleColumn` 与竖线一样按来源折行片段换算后再画。

## r05-4 低
- 症状：tree-sitter 这一轮解析已经得到树，但等待让出之后文档版本变了，树被丢掉且不释放，连续输入时 wasm 树会积压。
- 位置：`src/vs/editor/common/model/tokens/treeSitter/treeSitterTree.ts` 第 349–359 行
- 引用：

```349:359:src/vs/editor/common/model/tokens/treeSitter/treeSitterTree.ts
			newTree = this._parser.parse((index: number, position?: TreeSitter.Point) => this._parseCallback(index), this._tree.get(), { progressCallback, includedRanges: this._ranges });

			time += performance.now() - timer;
			passes++;

			// So long as this isn't the initial parse, even if the model changes and edits are applied, the tree parsing will continue correctly after the await.
			await new Promise<void>(resolve => setTimeout0(resolve));

		} while (!this._store.isDisposed && !newTree && inProgressVersion === this.textModel.getVersionId());
		this._sendParseTimeTelemetry(parseType, time, passes);
		return (newTree && (inProgressVersion === this.textModel.getVersionId())) ? newTree : undefined;
```

- 为什么是问题：`parse` 一旦给出 `newTree`，循环就结束。`setTimeout0` 期间若 `getVersionId()` 已变，返回值是 `undefined`，调用方不会安装这棵树，也没有人 `delete()`。快速连续编辑时，每一轮在让出期间被新版本作废的树都留在 wasm 堆里。销毁路径会先抬高 `_parseGeneration`，调用方还能删掉返回的树；版本变了这条路径不会把树交出去。
- 方向：版本已变时先 `newTree.delete()`，再返回 `undefined`。
