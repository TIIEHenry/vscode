---
title: "审查 r02：editor"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "tree-sitter 增量编辑终点算错，字面 \\n 软换行会漏，折行后括号引导线横坐标未换算。"
---

# 发现

## r02-1 中
- 症状：启用 tree-sitter 分词的文档里，插入、删除或替换文本后，增量语法树的终点列号与真实文本不一致，后续着色和括号区间会落到错误列。
- 位置：`src/vs/editor/common/model/tokens/treeSitter/treeSitterTree.ts` 第 124–136 行
- 引用：
```
124	private _applyEdits(changes: IModelContentChange[]) {
125		for (const change of changes) {
126			const originalTextLength = TextLength.ofRange(Range.lift(change.range));
127			const newTextLength = TextLength.ofText(change.text);
128			const summedTextLengths = change.text.length === 0 ? newTextLength : originalTextLength.add(newTextLength);
129			const edit = {
130				startIndex: change.rangeOffset,
131				oldEndIndex: change.rangeOffset + change.rangeLength,
132				newEndIndex: change.rangeOffset + change.text.length,
133				startPosition: { row: change.range.startLineNumber - 1, column: change.range.startColumn - 1 },
134				oldEndPosition: { row: change.range.endLineNumber - 1, column: change.range.endColumn - 1 },
135				newEndPosition: { row: change.range.startLineNumber + summedTextLengths.lineCount - 1, column: summedTextLengths.lineCount ? summedTextLengths.columnCount : (change.range.endColumn + summedTextLengths.columnCount) }
136			};
```
- 为什么是问题：`startPosition` / `oldEndPosition` 用的是 0 基列，`newEndIndex` 也按新文本字节算。同一行插入时 `lineCount` 为 0，`newEndPosition.column` 却是 1 基的 `endColumn + 新文本列数`。在第 1 列插入一个字符，字节上的新终点是偏移 1，点坐标却写成列 2。删除时新文本长度为 0，列被写成旧范围的 `endColumn`，而不是删除后的起点列。非空替换还会把旧范围长度加进新文本长度。`TreeSitterSyntaxTokenBackend.handleDidChangeContent` 会把这次 `edit` 交给旧树再增量 parse，错误终点会留在装上去的树里。
- 方向：`newEndPosition` 只按起点加上新文本的行列长度计算，并与 `startPosition` 一样使用 0 基列。

## r02-2 中
- 症状：`editor.wordWrap` 与 `editor.wrapOnEscapedLineFeeds` 都打开、换行策略为 simple 时，行内的字面 `\n` 只要这一行没有双引号，就不会在 `\n` 处软换行。
- 位置：`src/vs/editor/common/viewModel/monospaceLineBreaksComputer.ts` 第 45–49 行
- 引用：
```
45					const isLineFeedWrappingEnabled = wrapOnEscapedLineFeeds && lineText.includes('"') && lineText.includes('\\n');
46					if (previousLineBreakData && !previousLineBreakData.injectionOptions && !injectedText && !isLineFeedWrappingEnabled) {
47						result[i] = createLineBreaksFromPreviousLineBreaks(this.classifier, previousLineBreakData, lineText, tabSize, wrappingColumn, columnsForFullWidthChar, wrappingIndent, wordBreak);
48					} else {
49						result[i] = createLineBreaks(this.classifier, lineText, injectedText, tabSize, wrappingColumn, columnsForFullWidthChar, fontInfo, wrappingIndent, wordBreak, isLineFeedWrappingEnabled);
```
- 为什么是问题：开关被再与 `includes('"')` 相与。单引号字符串、没有引号的 `\n`，或只有单引号的长行，`isLineFeedWrappingEnabled` 为 false。有上一轮断行数据时走 `createLineBreaksFromPreviousLineBreaks`，该函数不接收这个开关；没有旧数据时 `createLineBreaks` 也会拿到 false。两种路径都不会在该 `\n` 断开，长行继续横向伸出。
- 方向：是否处理字面 `\n` 只看 `wrapOnEscapedLineFeeds`，不要要求行内必须有 `"`。

## r02-3 中
- 症状：换行策略为 advanced，或无障碍模式把策略改成 advanced 时，打开 `wrapOnEscapedLineFeeds` 仍然不会在字面 `\n` 处换行。
- 位置：`src/vs/editor/common/viewModel/viewModelLines.ts` 第 308–312 行；`src/vs/editor/browser/view/domLineBreaksComputer.ts` 第 29–36 行；`src/vs/editor/common/config/editorOptions.ts` 第 3054–3059 行
- 引用：
```
308	public createLineBreaksComputer(_context?: ILineBreaksComputerContext): ILineBreaksComputer {
309		const lineBreaksComputerFactory = (
310			this.wrappingStrategy === 'advanced'
311				? this._domLineBreaksComputerFactory
312				: this._monospaceLineBreaksComputerFactory
```
```
29	public createLineBreaksComputer(context: ILineBreaksComputerContext, fontInfo: FontInfo, tabSize: number, wrappingColumn: number, wrappingIndent: WrappingIndent, wordBreak: 'normal' | 'keepAll', wrapOnEscapedLineFeeds: boolean): ILineBreaksComputer {
30		const lineNumbers: number[] = [];
31		return {
32			addRequest: (lineNumber: number, previousLineBreakData: ModelLineProjectionData | null) => {
33				lineNumbers.push(lineNumber);
34			},
35			finalize: () => {
36				return createLineBreaks(assertReturnsDefined(this.targetWindow.deref()), context, lineNumbers, fontInfo, tabSize, wrappingColumn, wrappingIndent, wordBreak);
```
```
3054	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: 'simple' | 'advanced'): 'simple' | 'advanced' {
3055		const accessibilitySupport = options.get(EditorOption.accessibilitySupport);
3056		if (accessibilitySupport === AccessibilitySupport.Enabled) {
3057			// if we know for a fact that a screen reader is attached, we switch our strategy to advanced to
3058			// help that the editor's wrapping points match the textarea's wrapping points
3059			return 'advanced';
```
- 为什么是问题：advanced 固定走 DOM 断行。`createLineBreaksComputer` 收下 `wrapOnEscapedLineFeeds` 后没有传给 `createLineBreaks`，而 DOM 的 `createLineBreaks` 参数列表里也没有这个开关。屏幕阅读器会把策略强制改成 advanced，因此即使用户打开了该选项，带 `\n` 的长字符串仍按浏览器普通断行，不会在转义换行处拆开。
- 方向：DOM 断行在测量断点时同样识别奇数个反斜杠后的 `n`，并在该位置强制断开。

## r02-4 低
- 症状：simple 策略下即使行内已有 `"` 且开关打开，以反斜杠开头的字面 `\n`（整段反斜杠一直延伸到行首）仍然不会软换行。
- 位置：`src/vs/editor/common/viewModel/monospaceLineBreaksComputer.ts` 第 575–587 行
- 引用：
```
575	function isEscapedLineBreakAtPosition(lineText: string, i: number): boolean {
576		if (i >= 2 && lineText.charAt(i - 1) === 'n') {
577			// Check if there's an odd number of backslashes
578			let escapeCount = 0;
579			for (let j = i - 2; j >= 0; j--) {
580				if (lineText.charAt(j) === '\\') {
581					escapeCount++;
582				} else {
583					return escapeCount % 2 === 1;
584				}
585			}
586		}
587		return false;
```
- 为什么是问题：循环在遇到非反斜杠时才根据奇偶返回。若 `n` 前面直到行首全是反斜杠，循环结束并落到函数末尾的 `return false`。行内容以 `\n` 或 `\\\n` 开头时，转义次数为奇数，应当断开，结果被当成普通字符。`\\n` 开头因为次数为偶数，碰巧也返回 false，表现正确，奇数情况会被漏掉。
- 方向：循环走完后返回 `escapeCount % 2 === 1`。

## r02-5 中
- 症状：打开自动换行和括号配对引导线时，折行后续行上的竖向引导线按模型可见列从该视图行左缘起算，引导线会偏到括号右侧，或超出该视图行后被裁掉。
- 位置：`src/vs/editor/common/viewModel/viewModelLines.ts` 第 598–616 行；`src/vs/editor/browser/viewParts/indentGuides/indentGuides.ts` 第 132–139 行
- 引用：
```
598				// visibleColumns stay as they are (this is a bug and needs to be fixed, but it is not a regression)
599				// model-columns must be converted to view-model columns.
600				const result = bracketGuides.map(g => {
601					if (g.forWrappedLinesAfterColumn !== -1) {
602						const p = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.forWrappedLinesAfterColumn);
603						if (p.lineNumber >= viewLineInfo.modelLineWrappedLineIdx) {
604							return undefined;
605						}
606					}
607
608					if (g.forWrappedLinesBeforeOrAtColumn !== -1) {
609						const p = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.forWrappedLinesBeforeOrAtColumn);
610						if (p.lineNumber < viewLineInfo.modelLineWrappedLineIdx) {
611							return undefined;
612						}
613					}
614
615					if (!g.horizontalLine) {
616						return g;
```
```
132			const leftOffset = ctx.visibleRangeForPosition(new Position(lineNumber, 1))?.left ?? 0;
133			for (const guide of indent) {
134				const left =
135					guide.column === -1
136						? leftOffset + (guide.visibleColumn - 1) * this._spaceWidth
137						: ctx.visibleRangeForPosition(
138							new Position(lineNumber, guide.column)
139						)!.left;
```
- 为什么是问题：同一模型行被折成多条视图行时，竖向引导线原样返回，`visibleColumn` 仍是模型行上的可见列。绘制时用「该视图行第 1 列的横坐标 + (visibleColumn - 1) × 空格宽」。折行后续行的第 1 列已经在行中后部，再叠模型可见列，引导线不再对准括号。水平引导线会把 `g.column` 换成视图列，竖线没有做同样的换算。
- 方向：竖向引导线的 `visibleColumn` 先换成当前折行片段上的视图列，再乘空格宽。
