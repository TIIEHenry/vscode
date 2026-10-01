---
title: "方案 r09：contrib-rest"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。剪切标志只在路径与剪切集合一致时才移动，并在取消剪切时清掉；笔记本全部匹配装饰保留 webview 序号 0。"
---

# 方案 r09：contrib-rest

核查对照发现稿：hold 0，drop 1，weaken 2。r09-2 已 drop，不在本文。只改下列行为。

r09-2 的 drop 反证：`preview.before` 来自 `lcut`（`src/vs/base/common/strings.ts`），不足 26 字时已经 `trimStart()`。发现稿「四个空格加 `return`，高亮从第 4 列开始」在当前 `before` 上不成立。高亮终点是 `before.length + inside.length`，不包含 `after`；行尾空白只在 `after` 里时，`trim()` 不会让终点超出标签。`MAX_PREVIEW_CHARS` 为 250，`substring(0, 999)` 截不到这条预览。不要按发现稿把 r09-2 加回实施范围。

## r09-1（降为中）

- 问题类：模块级 `pasteShouldMove` 在取消剪切后仍为 true，带绝对路径的原生粘贴会把与剪切集合无关的文件做成移动。
- 反证：`explorerView.ts` 第 458–464 行在 `readonlyContext.get()` 为 true 时直接 return。该键是 `ExplorerResourceReadonlyContext`（第 261 行绑定，第 746 行按焦点项 `isReadonly` 写入），`ExplorerResourceWritableContext` 是它的否定（`files.ts` 第 43–44 行）。快捷键（`fileActions.contribution.ts` 第 124 行）和窗口 paste 监听用的是同一把只读钥匙，焦点在只读项上时两边都不把 `clipboardData.files` 交进 `filesExplorer.paste`。粘贴快捷键 id 是 `^filesExplorer.paste`（第 122 行）：`abstractKeybindingService.ts` 第 386–387 行在 `isBubble` 时不 `preventDefault`，可写树上的 Ctrl+V 会同时跑一次无 `FileList` 的 `pasteFileHandler`。这次调用不弹 `explorer.confirmPasteNative`（默认 true，`files.contribution.ts` 第 489–492 行），进入 `fileActions.ts` 第 1282–1286 行的 `finally` 后把 `pasteShouldMove` 置 false。带文件列表的那次要等确认框，用户点确认时标志通常已经是 false，于是走第 1233–1235 行的 `copy: true`。因此「只读焦点上窗口监听仍粘贴，默认确认后仍移动」不是当前行为。标志仍会在「监听跑了、快捷键没跑」时把外来绝对路径做成移动：过滤框获得焦点时 `inputFocus` 为 true，且 `filesExplorerFocus` 不在该元素的 context 上，所以快捷键不跑、窗口 paste 监听仍会跑。`explorer.confirmPasteNative` 为 false 时，两次调用还会抢读这个标志。
- 不变量：`toPaste.type === 'paths'` 时，比较的两侧先做与 `getFilesToPaste` 相同的 `distinctParents`（无 `FileList` 的粘贴会拿掉子孙；`cutFileHandler` 记下的是 `getContext(true)` 的全部 `stats`，父子多选时含子孙）。规范化之后，只有 `pasteShouldMove` 为 true 且两侧 URI 集合相等（`IUriIdentityService.extUri.isEqual`，忽略顺序；空集、仍缺成员的子集、超集都不算相等）才构造不带 `copy` 的 `ResourceFileEdit`。剪切集合含祖先和子孙、剪贴板回读只剩祖先时，仍允许移动。`BulkFileEdits.apply`（`bulkFileEdits.ts` 第 348–349 行）把缺 `copy` 当成 `RenameEdit`（移动）。不相等则必须带 `copy: true`，走现有 `applyCopyResourceEdit`。`findValidPasteFileTarget` 的 `allowOverwrite` 只在这次确实要移动该剪切集合时才因剪切而为 true；其余粘贴只在 `incrementalNaming === 'disabled'` 时允许覆盖（第 1210 行和第 1250 行两处一起改）。路径不相等的复制不得在 `finally` 里因为标志仍为 true 就 `setToCopy([], false)`。只有移动分支执行过、`copyFileHandler`、或取消剪切，才把 `pasteShouldMove` 和记下的 URI 清掉。剪切集合记在 `cutFileHandler` 当时的 `stats` 上，不用 `clipboardService.readResources()`：系统剪贴板文本一变，`clipboardService.ts` 第 277–281 行会因哈希不符 `clearResourcesState`。
- 要动的符号或文件：`src/vs/workbench/contrib/files/browser/fileActions.ts` 的 `pasteShouldMove`（第 1054 行）、`cutFileHandler`（第 1064–1070 行）、`copyFileHandler`（第 1055–1061 行）、`pasteFileHandler` 里 `type === 'paths'` 分支（第 1221–1236 行）、两处 `allowOverwrite`（第 1210、1250 行）、`finally`（第 1282–1286 行）。同文件导出一个清标志函数，供 `src/vs/workbench/contrib/files/browser/fileActions.contribution.ts` 的 `filesExplorer.cancelCut`（第 133–136 行）在 `setToCopy([], true)` 之外调用。集合相等判断放在 `fileActions.ts` 的纯函数里，便于单测。
- 明确不改什么：不改 `explorerView.ts` 第 458–464 行的焦点与只读提前返回。不改 `^filesExplorer.paste` 的 bubble。不改 `explorer.confirmPasteNative` 的默认值和确认文案。不改 data 分支里按字节构造 `ResourceFileEdit` 的那一段（第 1256–1266 行）。第 1250 行的 `allowOverwrite` 与第 1210 行一起改：data 粘贴不是移动剪切集合，不能再因 `pasteShouldMove` 允许覆盖。不改 `getFilesToPaste` 用 `getPathForFile` 分辨绝对路径（第 1306–1311 行）。
- 本地验证：现有 `src/vs/workbench/contrib/files/test/browser/fileActions.test.ts` 只覆盖文件名递增，没有粘贴用例，保持通过即可。非 Electron 下 `getPathForFile` 返回 undefined，到不了 `type: 'paths'`。为上面的纯函数新增断言：标志为 true 且规范化后的 URI 集合相等才允许移动；空集、规范化后仍少一个、多一个、顺序不同但成员相同、标志为 false，结果分别是不移动、不移动、不移动、移动、不移动。再断言：剪切集合含祖先和子孙、粘贴列表是 `distinctParents` 之后的祖先时仍允许移动。导出可读的标志与剪切 URI（或让清标志函数返回清之前的状态），断言直接调用该函数：取消剪切会把标志清掉；路径集合不相等时 `finally` 不清标志；`allowOverwrite` 只有在判定为移动时才因剪切为 true。命令：`scripts/test.sh --run src/vs/workbench/contrib/files/test/browser/fileActions.test.ts`（新断言可放在该文件或同目录新文件，跑到该新文件的路径）。

## r09-3（降为低）

- 问题类：刷新笔记本全部匹配装饰时，`webviewIndex === 0` 被当成没有序号丢掉。
- 反证：`webviewPreloads.ts` 第 1581–1586 行确实从 0 编号，`!match.webviewIndex`（`notebookSearchModel.ts` 第 356 行）会丢掉 0。当前命中高亮第 420 行用的是 `webviewIndex === undefined`，点中序号 0 仍会走 webview 当前高亮。`FindMatchDecorationModel.setAllFindMatchesDecorations`（`findMatchDecorationModel.ts` 第 146–155 行）不按 `webviewMatches[i].index` 画 webview 里的逐条标记，只用 `webviewMatches.length > 0` 决定概览标尺 `includeOutput`。打开搜索高亮时 `_addNotebookHighlights`（第 294–300 行）先 `stopWebviewFind`，清掉该 owner 的全部 webview 高亮，不只是序号 0。`removeMatch`（第 448 行）会重绘装饰模型，但不调用 `stopWebviewFind`，`widget.find` 已经画上的序号 0 标记还在。因此「第一条不画、其余照画」不成立。剩下的效果是：序号 0 被滤掉后，若该单元格没有其它非 0 的 webview 匹配，`includeOutput` 为 false。
- 不变量：交给 `setAllFindMatchesDecorations` 的 `CellWebviewFindMatch.index` 在 `webviewIndex` 为 0 时必须是 0。只有 `webviewIndex === undefined` 才从 `webviewMatches` 里省略。内容匹配的 `FindMatch` 列表保持原样。
- 要动的符号或文件：`src/vs/workbench/contrib/search/browser/notebookSearch/notebookSearchModel.ts` 的 `setNotebookFindMatchDecorationsUsingCellMatches`（第 354–361 行）。判断改成 `match.webviewIndex === undefined`。
- 明确不改什么：不改第 420 行当前命中分支。不改 `webviewPreloads.ts` 的从 0 编号，不改 `stopWebviewFind` / `addHighlights`。不改 `findMatchDecorationModel.ts` 的 `includeOutput` 公式。不改 `MatchInNotebook` 构造函数里 `webviewIndex ? '_' + webviewIndex : ''` 的 id 拼接（第 35 行）。
- 本地验证：`src/vs/workbench/contrib/search/test/browser/searchNotebookHelpers.test.ts` 不断言 `webviewIndex === 0`。新增断言：`webviewIndex` 为 0 的 `MatchInNotebook` 进入装饰用的 webview 列表且 `index` 为 0；`webviewIndex === undefined` 的匹配仍被省略。判断若留在私有方法里，把这个条件提成同文件可测函数再断言。命令：`scripts/test.sh --run src/vs/workbench/contrib/search/test/browser/searchNotebookHelpers.test.ts`（新断言若在新文件，改为该文件路径）。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：剪切集合先做 `distinctParents` 再比相等；第 1250 行 `allowOverwrite` 要改，不放在「不改 data 复制」里。Minor：过滤焦点的极性、r09-2 的 drop 反证、清标志断言可观察。均已写入正文。

2026-09-30 第二轮只读审查。无新的 Critical / Important。

2026-09-30 用户签收。`accepted`。未实施。
