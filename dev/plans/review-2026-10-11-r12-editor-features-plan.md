---
title: "方案 r12：editor-features"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "hold 3，drop 1，weaken 1。下载取消仍会 close 把同名目标收成空文件或半截，上传取消仍会留下空缺或半截并报成功，剪切碰到同名仍会失败并清掉剪切标记；轮播 postMessage 没有转走源缓冲；首选内容只在 files.resolve 真正抛错时才留不住。"
---
# 方案 r12：editor-features

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 3，drop 1，weaken 1。

## r12-1（hold，高）

### 问题类
网页下载取消或源流失败时仍 `close()` 可写流，同名目标被空文件或已写前缀替换。

### 不变量
取消、`readFile` / `readFileStream` 抛错、或源流 `onError` 时，对这次 `FileSystemWritableFileStream` 调用 `abort()` 并等待结束，不调用 `close()`。只有字节全部写入且令牌未取消时才 `close()`。`abort()` 丢弃这次临时写入，所选目录里的同名文件保持打开可写流之前的内容。

### 要动的符号或文件
`FileDownload.downloadFileBufferedBrowser`、`downloadFileUnbufferedBrowser`（`src/vs/workbench/contrib/files/browser/fileImportExport.ts`，现 707–749 行）。

`downloadFileBufferedBrowser`：去掉 `toDisposable(() => target.close())`。`readFileStream` 返回后令牌已取消（现 709–711 行）时改为 `await target.abort()` 再返回。取消回调和 `onError` 里若尚未成功 `close()`，则 `await target.abort()`，再按现在的方式 `reject`。`onEnd` 里 `await target.close()` 再 `resolve`。用一个局部标志保证 `close()` 与 `abort()` 只发生一个。

`downloadFileUnbufferedBrowser`：`readFile` 抛错时进入 catch，`await target.abort()` 后把错误抛出。令牌已取消时不 `write`，`await target.abort()` 后返回。未取消时 `write`、报告进度，然后 `await target.close()`。

### 明确不改
`downloadFileBrowser` 里 `getFileHandle(file.name, { create: true })` 与 `createWritable()`（现 760–761 行）的参数。按 `file.size > ByteSize.MB` 在缓冲与非缓冲之间分流。`doDownloadBrowser` 里不走目录选择器、用 `triggerDownload` 的那条（现 692–703 行）。

### 本地验证
`src/vs/workbench/contrib/files/test` 下没有覆盖这两处下载的测试。应新增断言：小文件令牌已取消时调用 `abort()`、不调用 `write` 和 `close()`；大文件在取消或 `onError` 时调用 `abort()`、不调用 `close()`；源流正常 `onEnd` 时调用 `close()`、不调用 `abort()`；`readFile` 抛错时调用 `abort()`、不调用 `close()`。

## r12-2（hold，高）

### 问题类
确认覆盖并删掉原文件之后，取消会留下空缺或半截内容，缓冲上传仍被 `doUploadEntry` 当成成功。

### 不变量
文件被确认覆盖并删除之后，只有这次上传完整写完才留下新内容；取消或写入失败时，目标路径回到删除前的字节。没有删除过的新建文件，取消或写入失败时路径上不留半截文件。`doUploadEntry` 在令牌已取消或写入未完整成功时返回 `undefined`。小于等于 `ByteSize.MB` 或没有 `stream` 的文件，读的过程中取消则不调用 `writeFile`，读失败则 Promise reject。

目录确认覆盖后「不要删除、改成合并上传」本稿不拍板。确认框写的仍是覆盖，合并会留下旧目录里多出来的文件。在拍板前，目录仍按现有删除再上传。文件路径的取消回滚可以按上面的不变量做。

### 要动的符号或文件
`BrowserFileUpload`（`src/vs/workbench/contrib/files/browser/fileImportExport.ts`）。构造函数增加 `IUndoRedoService`。

顶层上传回调（现 172–192 行）：`target.getChild(entry.name)` 是目录时，确认覆盖后不要执行这条 `ResourceFileEdit` 删除。是文件时仍删除。删除返回后若令牌已取消，`undoRedoService.undo(被删文件 URI)` 后 return。`doUploadEntry` 抛错或返回空时：若这次删过该文件，先 `fileService.del` 目标（文件不存在则忽略），再 `undo(该 URI)`；若这是新建文件且 `entry.isFile`，则 `fileService.del` 该 URI（不存在则忽略）。有 `result` 才 `results.push`。`del` 使用 `fileService.del`，不要再走 `applyBulkEdit`，避免在同一 URI 上压进新的撤销项。

`doUploadFileBuffered`（现 315–360 行）：循环里取消时调用 `writeableStream.error(canceled())` 再 `end()`，与现 349–351 行的 catch 相同，不要调用成功路径的 `end(undefined)`。取消与失败都 `await writeFilePromise`。该 Promise 拒绝，或等待结束后令牌已取消，都抛 `canceled()` 或原来的错误，不要在 354–356 行直接 return。

`doUploadEntry` 的文件分支（现 250–259 行）：把 `token` 传给 `doUploadFileUnbuffered`。缓冲或非缓冲抛错时不要返回 `{ isFile: true, resource }`。目录分支末尾（现 311 行）若令牌已取消，返回 `undefined`。

`doUploadFileUnbuffered`（现 362–385 行）：增加 `token` 参数。`reader.onerror` 时 reject。令牌取消时 `reader.abort()`，`onabort` 时 reject `canceled()`。`onload` 里调用 `writeFile` 之前若令牌已取消，不写并 reject `canceled()`。`event.target.result` 不是 `ArrayBuffer` 时仍 reject。

### 明确不改
用户拒绝覆盖时的 return（现 174–176 行）。`MAX_PARALLEL_UPLOADS`、进度文案、单文件上传成功后打开编辑器的条件（现 200–202 行）。`fileService.writeFile` 与 `doWriteBuffered` 的写入循环。`DeleteOperation` 对目录不读子项内容（`bulkFileEdits.ts` 现 259–270 行）：目录撤销只建空目录，所以目录不要先删。目录里已经存在的子文件被 `writeFile` 就地覆盖时，没有删除前快照，不在子路径上 `del`。

### 本地验证
没有覆盖 `BrowserFileUpload` 的测试。应新增断言：确认覆盖文件并删除后、尚未 `writeFile` 时令牌已取消，`undo` 后原字节还在，`results` 不含该 URI。大文件循环中取消时调用的是 `writeableStream.error`，不是成功的 `end(undefined)`，`doUploadEntry` 不返回 `{ isFile: true, resource }`，半截目标被删掉后原字节经 `undo` 回来。新建文件取消时目标不存在。`file.size` 不超过 `ByteSize.MB` 或没有 `stream` 时，取消后不调用 `writeFile`；`FileReader` 出错时 Promise reject。目录确认覆盖后不调用那条删除用的 `applyBulkEdit`。

## r12-3（drop）

### 问题类
发现稿说轮播播放内存视频时 `postMessage` 转走了底层 `ArrayBuffer`。活码没有把 `transfer` 交给浏览器。

### 不变量
不按「源缓冲被拆掉」改轮播。`IWebviewElement.postMessage`（`webviewElement.ts` 约第 402–404 行）把 `transfer` 放进 `{ message, transfer }` 数据体。`_send` 调 `doPostMessage` 时 `transferable` 是空数组（约第 406–413、596–598 行）。源 `ArrayBuffer` 被结构化克隆，没有被转走。

### 要动的符号或文件
没有。发现稿里「`rawData.buffer` 可能多带视图外字节」那一半本稿没有回应，若要修另写一条，不要挂在转走缓冲上。

### 明确不改
`postMessage` 的 `transfer` 参数和 `doPostMessage` 的空 `transferable`。

### 本地验证
不新增「缓冲被拆掉」的断言。

## r12-4（hold，中）

### 问题类
剪切后粘贴到已有同名文件上时，增量命名未禁用却既不改名也不覆盖，移动失败后剪切标记被清掉。

### 不变量
`incrementalNaming` 为 `simple` 或 `smart` 时，剪切到另一个已有同名目标才走增量改名，移动编辑的 `overwrite` 为 false。目标就是源本身（粘贴回原文件夹）时不改名，保持现在的 `allowOverwrite`。`incrementalNaming === 'disabled'` 时仍先询问，确认后 `overwrite` 为 true。`applyBulkEdit` 兑现之后才把 `executedMove` 设为 true；它拒绝时 `finally` 不调用 `setToCopy([], false)` 和 `clearPasteMoveState()`。现有 `allowOverwrite from cut only when paths paste is a move` 钉的是剪切移动可以覆盖，不要整条翻掉。

### 要动的符号或文件
`pathsPasteAllowOverwrite`（`src/vs/workbench/contrib/files/browser/fileActions.ts`，现 1098–1100 行）：只在 `incrementalNaming === 'disabled'` 时返回 true。去掉 `shouldMovePaths` 参数。调用点现 1276 行与 1317 行改为只传 `incrementalNaming`。

`pasteFileHandler` 里剪切移动（现 1289–1299 行）：`executedMove = true` 挪到 `await explorerService.applyBulkEdit(...)` 兑现之后。`ResourceFileEdit` 的 `overwrite: incrementalNaming === 'disabled'` 保持。`findValidPasteFileTarget`（现 343–354 行）在 `allowOverwrite` 为 false 时继续增量改名，函数体不改。

### 明确不改
`askForOverwrite` 仍只在 `incrementalNaming === 'disabled'` 时调用（现 336–341 行）。`shouldClearPasteMoveInFinally` 仍返回传入的布尔值。catch 里 `fileDeleted` 文案保持。数据粘贴分支（现 1308–1333 行）的编辑形状保持，只跟着改 `pathsPasteAllowOverwrite` 的参数个数。

### 本地验证
`src/vs/workbench/contrib/files/test/browser/fileActions.test.ts` 的 `allowOverwrite from cut only when paths paste is a move`：改为剪切且 `incrementalNaming` 为 `simple` 时返回 false，`disabled` 时返回 true，复制且 `simple` 时返回 false。`finally clears cut state only after move` 仍断言 `shouldClearPasteMoveInFinally(false)` 为 false、`true` 为 true。

应新增断言：`findValidPasteFileTarget` 在 `allowOverwrite` 为 false、`incrementalNaming` 为 `simple`、`findClosest` 对原名返回节点时，结果的 basename 是 `incrementFileName` 的下一个名字。`pasteFileHandler` 在 `applyBulkEdit` 拒绝时不调用 `clearPasteMoveState`，`readPasteMoveState` 仍保留剪切 URI。

## r12-5（weaken，降为低）

### 问题类
`files.resolve` 若在首选内容装进模型之前抛错，再次解析不会再带上这段字符串；文件不存在并不会走到这条失败。

### 不变量
`this.preferredContents = undefined` 只发生在 `this.textFileService.files.resolve(...)` 兑现之后。这次调用拒绝时，字段保持调用前的字符串，随后同一次输入上的 `resolve` 仍把该字符串传给 `contents`。

### 要动的符号或文件
`FileEditorInput.doResolveAsText`（`src/vs/workbench/contrib/files/browser/editors/fileEditorInput.ts`，现 356–357 行）：把 `this.preferredContents = undefined` 挪到 369 行 `await this.textFileService.files.resolve(...)` 返回之后、创建模型引用之前。`catch`（现 403–411 行）不写这个字段。

### 明确不改
`textFileEditorModel.resolveFromBuffer` 在 `stat` 失败时仍装入缓冲并标脏。`doResolve` 有 `contents` 时仍走 `resolveFromBuffer`。脏模型且没有 `contents` 时 `resolve` 仍直接返回。`toUntyped` 仍从脏模型读 `contents`。二进制分支仍 `return this.doResolveAsBinary()`。成功之后只用一次首选内容：再次 `setPreferredContents` 之前，后续 `resolve` 不覆盖用户已改的脏文本。

### 本地验证
反证：`textFileEditorModel.doResolve`（现 319–321 行）在 `options.contents` 存在时返回 `resolveFromBuffer`。`resolveFromBuffer`（现 345–381 行）捕获 `fileService.stat` 的错误，包括 `FILE_NOT_FOUND`，然后 `resolveFromContent` 装入这份缓冲。因此文件不存在时 `files.resolve` 不抛，内容已经在模型里。`resolve`（现 305–308 行）在没有 `contents` 且模型已脏时直接返回。`fileEditorInput.toUntyped`（现 450–456 行）从脏模型取值。`fileEditorInput.test.ts` 的 `preferred contents` 在成功 `resolve` 之后仍能读到这段文本。`FILE_IS_BINARY` 来自 `resolveFromFile`，有 `contents` 时不会进入。

保留 `preferred contents`（`src/vs/workbench/contrib/files/test/browser/fileEditorInput.test.ts`）。应新增断言：`files.resolve` 在装入缓冲之前拒绝时，同一 `FileEditorInput` 再次 `resolve` 仍把原来的字符串传给 `contents`。
