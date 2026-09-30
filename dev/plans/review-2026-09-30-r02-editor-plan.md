---
title: "方案 r02：editor"
type: plan
status: accepted
phase: N/A
updated: 2026-09-30
summary: "2026-09-30 用户签收。未实施。tree-sitter 编辑终点只按新文本以 0 基 UTF-16 推进；字面 \\n 软换行去掉双引号门槛，simple 与 advanced 共用行首也成立的奇数反斜杠判定；折行括号竖线仅在可见列不在首个折行片段时改横坐标。"
---

# 方案 r02：editor

核查：r02-1、r02-2、r02-3、r02-4 为 hold，r02-5 为 weaken。drop 不进入本文。

## r02-1

- 问题类：tree-sitter 增量编辑的 `newEndPosition` 在同一行时用了 1 基列，非空替换还会把旧范围长度算进终点。
- 不变量：`newEndPosition` 与 `startPosition` 同为 0 基，且只由起点沿 `change.text` 前进得到。列的单位是 UTF-16 码元，与 `startColumn - 1` 以及 `newEndIndex = rangeOffset + text.length` 一致。从 `row = startLineNumber - 1`、`column = startColumn - 1` 起，用 `charCodeAt` 扫描：码元 10（`\n`）则 row 加 1、column 归 0，其余码元 column 加 1。`text` 为空时 `newEndPosition` 等于 `startPosition`。不要把被替换范围的长度加进去。`TextLength.ofText` 的 `for...of` 按码点计数，代理对比模型列少 1，不能用它填 column。
- 要动的符号或文件：`TreeSitterTree._applyEdits`（`src/vs/editor/common/model/tokens/treeSitter/treeSitterTree.ts`）。把上述终点计算抽成同文件可单测的纯函数，`_applyEdits` 只用它填 `newEndPosition`。
- 明确不改什么：`startIndex`、`oldEndIndex`、`newEndIndex`、`startPosition`、`oldEndPosition` 的现有算法；`TreeSitterSyntaxTokenBackend.handleDidChangeContent` 到 `handleContentChange` 的调用顺序；`_parseAndUpdateTree` / `_parse` 如何把已 `edit` 的树交给 `parser.parse`。
- 怎样本地验证：仓库没有覆盖 `_applyEdits` 的测试。为纯函数新增断言：同一行、非第 1 列，把一个 BMP 换成一个代理对，期望 column 为 `(startColumn - 1) + text.length`（第 1 列插入代理对时，现有 1 基公式碰巧也是加 2，锁不住「禁用 `TextLength.ofText`」）。多行样本让末行以代理对结束，期望 column 为 2。保留：插入一个 BMP、同一行删除、两字符换成一字。不要把「第 1 列插入 `a\nb`」当成会在当前公式失败的断言：现有 `lineCount ? columnCount` 分支已经是 `{ row: 起点行差, column: 1 }`。`scripts/test.sh --grep "tree-sitter edit newEndPosition"`。

## r02-2

- 问题类：simple 断行把字面 `\n` 软换行额外要求行内有 `"`。
- 不变量：`wrapOnEscapedLineFeeds` 为 true 且行文本含字面 `\n`（反斜杠加 `n`）时，必须走 `createLineBreaks(..., true)`。单引号、无引号、双引号同一规则。行内没有该子串时仍可走 `createLineBreaksFromPreviousLineBreaks`。
- 要动的符号或文件：`MonospaceLineBreaksComputerFactory.createLineBreaksComputer` 中 `isLineFeedWrappingEnabled`（`src/vs/editor/common/viewModel/monospaceLineBreaksComputer.ts` 第 45 行）。去掉 `&& lineText.includes('"')`。
- 明确不改什么：`createLineBreaksFromPreviousLineBreaks` 的参数列表（含字面 `\n` 且开关打开时已经不进这条路径）；`assertLineBreaks` 里写死的 `wrapOnEscapedLineFeeds: false`；`includes('\\n')` 可以留下，只作「行内没有字面 `\n`」的短路。
- 怎样本地验证：已有 `issue #258022: wrapOnEscapedLineFeeds: should work correctly after editor resize` 继续通过。在 `src/vs/editor/test/common/viewModel/monospaceLineBreaksComputer.test.ts` 用 `getLineBreakData(..., wrapOnEscapedLineFeeds: true, ...)` 新增断言：单引号长行与无引号长行都在 `n` 之后断开；同一文本在开关为 false 时不在该处断开。`scripts/test.sh --grep wrapOnEscapedLineFeeds`。

## r02-3

- 问题类：advanced 断行收下 `wrapOnEscapedLineFeeds` 后没有用于测量，屏幕阅读器强制 advanced 时同样不在字面 `\n` 处断开。
- 不变量：开关打开时，DOM 路径在与 simple 相同的偏移强制断开（奇数个反斜杠之后的 `n` 的下一个字符之前）。短行也断，不等浏览器因宽度溢出才断。判定函数与 r02-4 修好后的是同一个。
- 要动的符号或文件：`DOMLineBreaksComputerFactory.createLineBreaksComputer`、同文件的 `createLineBreaks` 与 `renderLine`（`src/vs/editor/browser/view/domLineBreaksComputer.ts`）。把工厂参数传到 `createLineBreaks`，再传到 `renderLine`；在该偏移插入强制换行（`<br>` 一类会让 `readLineBreaks` 读到新行顶的节点）。偏移相对 `renderLineContent`，随后仍按现有逻辑加回 `firstNonWhitespaceIndex`。
- 明确不改什么：`WrappingStrategy.compute`（`src/vs/editor/common/config/editorOptions.ts` 第 3054–3061 行）——无障碍把策略改成 advanced 保持原样；`ViewModelLinesFromProjectedModel.createLineBreaksComputer` 里 simple / advanced 的工厂选择。
- 怎样本地验证：`scripts/test.sh --grep wrapOnEscapedLineFeeds` 只覆盖 r02-4 的 monospace 判定，不能代替 DOM。DOM 断言调用 `DOMLineBreaksComputerFactory`（Electron 渲染进程里已有 `window` 和布局），`wrappingColumn` 宽于样本，使浏览器本身不折行。开关为 true 时，`'hello\nworld'` 与 `"hello\nworld'` 的 `breakOffsets` 在 `n` 之后；为 false 时没有该断点。强制换行用仍记入 `spanStartOffsets`、且 `firstChild` 为整段文本的块级 span。裸 `<br>` 作为 `div` 子节点会错开 `readLineBreaks` 的 span 下标（第 370 行起），`setStart` 抛错后返回 `null`。若必须用裸 `<br>`，把 `readLineBreaks` 列入可改符号并写明如何跳过非 span。断点偏移相对 `renderLineContent`，只按现有逻辑加回一次 `firstNonWhitespaceIndex`。漏接 `wrapOnEscapedLineFeeds` 或漏插断点时，这条 DOM 断言失败。

## r02-4

- 问题类：`n` 前面直到行首全是反斜杠时，奇数次转义被判成不断行。
- 不变量：`isEscapedLineBreakAtPosition(lineText, i)` 在 `i >= 2` 且 `lineText[i - 1] === 'n'` 时，统计从 `i - 2` 到行首的连续反斜杠。循环走完（没有遇到非反斜杠）时返回 `escapeCount % 2 === 1`，与中途遇到非反斜杠的返回值相同。行首 `\\n`（偶数）仍为 false；行首 `\n` 与 `\\\n`（奇数）为 true。
- 要动的符号或文件：`isEscapedLineBreakAtPosition`（`src/vs/editor/common/viewModel/monospaceLineBreaksComputer.ts` 第 575–587 行）。在 `for` 之后、该 `if` 内部返回 `escapeCount % 2 === 1`。把该函数导出，或挪到 `common` 下的小模块，供 `domLineBreaksComputer.ts` 引用。不要在 DOM 侧再写一份循环。
- 明确不改什么：`createLineBreaks` 里调用该函数时的 `i` 范围（`startOffset` 到 `len - 1`）。行尾恰好是 `\n`、后面没有字符时，调用方不会以 `i === lineText.length` 进入本函数；本条不把扫描上界扩到 `lineText.length`。
- 怎样本地验证：直接对导出的 `isEscapedLineBreakAtPosition` 断言行首 `\n`、`\\\n` 为 true，`\\n` 为 false。`getLineBreakData` 的集成断言依赖 r02-2 先去掉第 45 行的引号门槛；样本不含 `"` 时，只改第 575–587 行仍然不断开。`scripts/test.sh --grep wrapOnEscapedLineFeeds`。

## r02-5

- 问题类：括号竖线的模型可见列只有落在非首个折行片段上时，才会和字形的横坐标不一致；发现稿把这说成所有折行后续行都会偏右。
- 降级说明（读到的反证）：`modelLineProjection.ts` 在 `outputLineIndex > 0` 时只在行内容前补 `wrappedTextIndentLength` 个空格（约第 200–207 行），`startVisibleColumn` 仅用于制表位。`viewLine.ts` 的 `renderLine` 只写 `top` / `height`，第 1 列的像素是该行盒字符映射的起点，也就是内容左缘。折行后续行的第 1 列并不在模型行的中后部。可见列落在第一个折行片段（`startVisibleColumn === 0`）时，`indentGuides.ts` 第 132–136 行的 `leftOffset + (visibleColumn - 1) * spaceWidth` 与括号字形对齐，原样返回 `g` 是对的。发现稿要求把 `visibleColumn` 改成「当前折行片段」的局部列，会在更靠后的片段上把竖线再往左挪，离开字形。
- 不变量：一条竖线在所有仍显示它的视图行上共用一个横坐标，等于 `guideVisibleColumn` 在「包含该可见列的那个折行片段」上的绘制列（该片段的 `startVisibleColumn`、`wrappedTextIndentLength`，再换回渲染公式使用的 1 基可见列）。该列落在模型行第一个折行片段时，这个值和现在的 `g.visibleColumn` 相同，保持不动。它大于第一个片段的可见列跨度时，绘制列小于模型可见列，并且后续模型行也复用这个绘制列，而不是各自再减自己的片段起点。
- 要动的符号或文件：`ViewModelLinesFromProjectedModel.getViewLinesBracketGuides` 里 `!g.horizontalLine` 时返回 `g` 的分支（`src/vs/editor/common/viewModel/viewModelLines.ts` 第 615–616 行），以及产出 `IndentGuide` 的一侧。`IndentGuide`（`textModelGuides.ts`）没有来源行；`guidesTextModelPart.ts` 把 `Math.min(startVisibleColumn, endVisibleColumn, pair.minVisibleColumnIndentation + 1)` 写进每一行的 `visibleColumn`，不记录这三个数里谁取中。产出时记下取中的模型行（缩进取中时记下达到该缩进的行；并列时用行号较小的那一行）。第 615 行只用该行的 projection（`startVisibleColumn`、`wrappedTextIndentLength`）换成渲染公式的 1 基列，不是「当前正在画的这条视图行」的片段起点。返回前按新 `visibleColumn` 排序：`indentGuides.ts` 第 220 行 `takeWhile` 和第 141–143 行 `break` 假定升序，只改第 615 行、不重排时，绘制列变小的竖线仍可能排在超宽引导线后面被 `break` 掉。
- 明确不改什么：`IndentGuidesOverlay.prepareRender` 的 `left` 公式（缩进引导线共用它，缩进列在第一个片段上）；水平引导线把 `g.column` 换成视图列的那段；`forWrappedLinesAfterColumn` / `forWrappedLinesBeforeOrAtColumn` 的显隐；`ViewModelLinesFromModelAsIs.getViewLinesBracketGuides`。裁剪条件（`indentGuides.ts` 第 141–143 行，`left > scrollWidth` 或超过 `_maxIndentLeft` 时 `break`）保持；可见列改对之后，原先因模型列过大被裁掉的竖线会落回该片段宽度内。
- 怎样本地验证：`src/vs/editor/test/browser/viewModel/modelLineProjection.test.ts` 没有 `getViewLinesBracketGuides` 断言。用该文件第 942 行带 `wordWrap` 参数的 `withSplitLinesCollection`（第 96 行那个默认 `wordWrap: 'off'`，折不出第二段），传入 `wordWrap: 'wordWrapColumn'`。跨模型行的 `()`，`includeInactive: true`（第 353–354 行在该标志为假且没有活动位置时整对跳过；第 369–384 行对同一模型行上的括号对直接 `continue`）。引导列落在锚点行的第二段。断言仍显示该竖线的视图行共用一个绘制列，与模型列、与「用当前片段起点换算」都不同。可见列落在第一个折行片段时，`visibleColumn` 与模型给出的相同。`scripts/test.sh --grep getViewLinesBracketGuides`。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r02-5 记下取中的模型行并按新列排序；r02-3 的 DOM 断言必须走 advanced 测量，不能只靠 monospace grep。Minor：r02-1 代理对断言改到非第 1 列；r02-4 直接测导出函数；折行夹具用第 942 行的 `withSplitLinesCollection`。均已写入正文。

2026-09-30 第二轮只读审查。无新的 Critical / Important。

2026-09-30 用户签收。`accepted`。未实施。
