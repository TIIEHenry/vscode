---
title: "审查 r09：contrib-rest"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "剪切后的原生粘贴会移走源文件，快速搜索高亮错位，笔记本第一条输出匹配高亮被丢掉。"
---

# 发现

## r09-1 高
- 症状：在资源管理器里剪切之后，再把系统文件管理器中复制的文件粘贴进来，源文件会从原目录被移走，而不是复制一份。焦点在只读项上时快捷键粘贴不会跑，窗口上的 paste 监听仍会把剪贴板文件交进来；默认确认框点确认后同样会移动。按 Esc 取消剪切也不会清掉这个标志。
- 位置：`src/vs/workbench/contrib/files/browser/fileActions.ts` 第 1221–1236 行
- 引用：
```1221:1236:src/vs/workbench/contrib/files/browser/fileActions.ts
			if (sourceTargetPairs.length >= 1) {
				// Move/Copy File
				if (pasteShouldMove) {
					const resourceFileEdits = sourceTargetPairs.map(pair => new ResourceFileEdit(pair.source, pair.target, { overwrite: incrementalNaming === 'disabled' }));
					const options = {
						confirmBeforeUndo: configurationService.getValue<IFilesConfiguration>().explorer.confirmUndo === UndoConfirmLevel.Verbose,
						progressLabel: sourceTargetPairs.length > 1 ? nls.localize({ key: 'movingBulkEdit', comment: ['Placeholder will be replaced by the number of files being moved'] }, "Moving {0} files", sourceTargetPairs.length)
							: nls.localize({ key: 'movingFileBulkEdit', comment: ['Placeholder will be replaced by the name of the file moved.'] }, "Moving {0}", resources.basenameOrAuthority(sourceTargetPairs[0].target)),
						undoLabel: sourceTargetPairs.length > 1 ? nls.localize({ key: 'moveBulkEdit', comment: ['Placeholder will be replaced by the number of files being moved'] }, "Move {0} files", sourceTargetPairs.length)
							: nls.localize({ key: 'moveFileBulkEdit', comment: ['Placeholder will be replaced by the name of the file moved.'] }, "Move {0}", resources.basenameOrAuthority(sourceTargetPairs[0].target))
					};
					await explorerService.applyBulkEdit(resourceFileEdits, options);
				} else {
					const resourceFileEdits = sourceTargetPairs.map(pair => new ResourceFileEdit(pair.source, pair.target, { copy: true, overwrite: incrementalNaming === 'disabled' }));
					await applyCopyResourceEdit(sourceTargetPairs.map(pair => pair.target), resourceFileEdits);
				}
			}
```
- 为什么是问题：`pasteShouldMove` 是模块级标志，剪切时在第 1069 行设为 true，取消剪切（`fileActions.contribution.ts` 第 133–136 行）只调用 `setToCopy([], true)`，不会把它改回 false。资源管理器窗口的 paste 监听（`explorerView.ts` 第 457–464 行）把 `clipboardData.files` 交给 `filesExplorer.paste`。`getFilesToPaste`（第 1306–1311 行）在能拿到绝对路径时得到 `type: 'paths'`。此时不核对路径是不是当初剪切的那一批，编辑也不带 `copy: true`，批量编辑按移动执行，源文件离开原目录。快捷键粘贴要求 `ExplorerResourceWritableContext`（`fileActions.contribution.ts` 第 124 行），只读项上不成立，因此不会有另一次不带文件列表的粘贴先把标志清掉。
- 方向：只有剪贴板路径与当前剪切项一致时才移动，并在取消剪切时清掉 `pasteShouldMove`。

## r09-2 中
- 症状：用 `%` 快速文本搜索时，行首有缩进、匹配前文本短于 26 个字符的命中，列表里的高亮会相对真正的匹配文字向右偏；行尾空白被 trim 掉时，高亮终点还会超出可见标签。
- 位置：`src/vs/workbench/contrib/search/browser/quickTextSearch/textSearchQuickAccess.ts` 第 312–317 行
- 引用：
```312:317:src/vs/workbench/contrib/search/browser/quickTextSearch/textSearchQuickAccess.ts
				const preview = element.preview();
				const previewText = (preview.before + preview.inside + preview.after).trim().substring(0, 999);
				const match: IMatch[] = [{
					start: preview.before.length,
					end: preview.before.length + preview.inside.length
				}];
```
- 为什么是问题：`MatchImpl.preview`（`searchTreeModel/match.ts` 第 64–68 行）里，`before` 是匹配前的原文（不足 26 字符时不做左截断），缩进行会带前导空格。标签先 `trim()` 再显示，高亮下标仍用未 trim 的 `preview.before.length`。例如行内是四个空格加 `return`，标签变成 `return…`，高亮却从第 4 列开始，标到的不是 `return`。
- 方向：先按 trim 掉的前导长度平移高亮区间，再按截断后的标签长度夹紧终点。

## r09-3 中
- 症状：搜索笔记本的 Markdown 预览或单元格输出时，整次 webview 查找里序号为 0 的第一条命中不会画在编辑器的全部匹配高亮里。打开搜索高亮、或在结果里关掉任意一条笔记本匹配之后都会这样；结果树里那一条还在，只是编辑器里看不到它的高亮。
- 位置：`src/vs/workbench/contrib/search/browser/notebookSearch/notebookSearchModel.ts` 第 354–361 行
- 引用：
```354:361:src/vs/workbench/contrib/search/browser/notebookSearch/notebookSearchModel.ts
		const cellFindMatch = coalesce(cells.map((cell): CellFindMatchModel | undefined => {
			const webviewMatches: CellWebviewFindMatch[] = coalesce(cell.webviewMatches.map((match): CellWebviewFindMatch | undefined => {
				if (!match.webviewIndex) {
					return undefined;
				}
				return {
					index: match.webviewIndex,
				};
			}));
```
- 为什么是问题：webview 查找用 `matches.map((match, index) => …)` 从 0 编号（`notebook/browser/view/renderers/webviewPreloads.ts` 第 1581–1586 行），第一条输出或预览命中的 `index` 就是 0。`!match.webviewIndex` 把 0 当成没有序号丢掉。`updateNotebookHighlights`（第 285–288 行）在搜索高亮打开时会走这里，`removeMatch`（第 448 行）关掉一条结果时也会重绘。当前命中高亮用的是 `webviewIndex === undefined`（第 420 行），所以点中这一条仍能单独高亮，全部匹配装饰则一直缺第一条。
- 方向：用 `webviewIndex === undefined` 判断缺序号，0 要保留并传给装饰。
