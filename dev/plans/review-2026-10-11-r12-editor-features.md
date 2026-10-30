---
title: "审查 r12：editor-features"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；网页下载取消或读失败时仍 close 可写流，同名目标会被空文件或半截内容盖掉。"
---
# 审查 r12：editor-features

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r12-1 高

- 症状：网页里把资源管理器中的文件下载到已选目录时，取消或读取失败仍会关闭可写流，同名目标变成空文件或半截内容。
- 位置：`src/vs/workbench/contrib/files/browser/fileImportExport.ts` 第 707–769 行
- 引用：

```707:723:src/vs/workbench/contrib/files/browser/fileImportExport.ts
	private async downloadFileBufferedBrowser(resource: URI, target: FileSystemWritableFileStream, operation: IDownloadOperation, token: CancellationToken): Promise<void> {
		const contents = await this.fileService.readFileStream(resource, undefined, token);
		if (token.isCancellationRequested) {
			target.close();
			return;
		}

		return new Promise<void>((resolve, reject) => {
			const sourceStream = contents.value;

			const disposables = new DisposableStore();
			disposables.add(toDisposable(() => target.close()));

			disposables.add(createSingleCallFunction(token.onCancellationRequested)(() => {
				disposables.dispose();
				reject(canceled());
			}));
```

```730:733:src/vs/workbench/contrib/files/browser/fileImportExport.ts
				onError: error => {
					disposables.dispose();
					reject(error);
				},
```

```742:749:src/vs/workbench/contrib/files/browser/fileImportExport.ts
	private async downloadFileUnbufferedBrowser(resource: URI, target: FileSystemWritableFileStream, operation: IDownloadOperation, token: CancellationToken): Promise<void> {
		const contents = await this.fileService.readFile(resource, undefined, token);
		if (!token.isCancellationRequested) {
			target.write(contents.value.buffer as Uint8Array<ArrayBuffer>);
			this.reportProgress(contents.name, contents.size, contents.value.byteLength, operation);
		}

		target.close();
```

```752:761:src/vs/workbench/contrib/files/browser/fileImportExport.ts
	private async downloadFileBrowser(targetFolder: FileSystemDirectoryHandle, file: IFileStatWithMetadata, operation: IDownloadOperation, token: CancellationToken): Promise<void> {

		// Report progress
		operation.filesDownloaded++;
		operation.fileBytesDownloaded = 0; // reset for this file
		this.reportProgress(file.name, 0, 0, operation);

		// Start to download
		const targetFile = await targetFolder.getFileHandle(file.name, { create: true });
		const targetFileWriter = await targetFile.createWritable();
```

- 为什么是问题：`getFileHandle(file.name, { create: true })` 打开的是用户所选目录里的同名文件，`createWritable()` 之后 `close()` 会用这一次写入替换该文件。小文件在取消时跳过 `write`，仍然 `close()`，目标被收成空文件。大文件在取消或源流出错时，`dispose` 走的也是 `target.close()`，已经 `write` 进去的前缀会被提交。用户取消的是下载，目录里原来的同名文件内容被空文件或残缺内容换掉。
- 方向：取消或读失败时丢弃这次可写流，目标原文件保持不动。

## r12-2 高

- 症状：浏览器上传确认覆盖并删掉原文件之后，取消会留下空缺或半截文件，入口仍把该资源当成上传成功。
- 位置：`src/vs/workbench/contrib/files/browser/fileImportExport.ts` 第 172–186、248–259、329–384 行
- 引用：

```172:186:src/vs/workbench/contrib/files/browser/fileImportExport.ts
				if (target && entry.name && target.getChild(entry.name)) {
					const { confirmed } = await this.dialogService.confirm(getFileOverwriteConfirm(entry.name));
					if (!confirmed) {
						return;
					}

					await this.explorerService.applyBulkEdit([new ResourceFileEdit(joinPath(target.resource, entry.name), undefined, { recursive: true, folder: target.getChild(entry.name)?.isDirectory })], {
						undoLabel: localize('overwrite', "Overwrite {0}", entry.name),
						progressLabel: localize('overwriting', "Overwriting {0}", entry.name),
					});

					if (token.isCancellationRequested) {
						return;
					}
				}
```

```329:355:src/vs/workbench/contrib/files/browser/fileImportExport.ts
			while (!res.done) {
				if (token.isCancellationRequested) {
					break;
				}

				// Write buffer into stream but make sure to wait
				// in case the `highWaterMark` is reached
				const buffer = VSBuffer.wrap(res.value);
				await writeableStream.write(buffer);

				if (token.isCancellationRequested) {
					break;
				}

				// Report progress
				progressReporter(file.size, buffer.byteLength);

				res = await reader.read();
			}
			writeableStream.end(undefined);
		} catch (error) {
			writeableStream.error(error);
			writeableStream.end();
		}

		if (token.isCancellationRequested) {
			return undefined;
		}
```

```362:384:src/vs/workbench/contrib/files/browser/fileImportExport.ts
	private doUploadFileUnbuffered(resource: URI, file: File, progressReporter: (fileSize: number, bytesUploaded: number) => void): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = async event => {
				try {
					if (event.target?.result instanceof ArrayBuffer) {
						const buffer = VSBuffer.wrap(new Uint8Array(event.target.result));
						await this.fileService.writeFile(resource, buffer);

						// Report progress
						progressReporter(file.size, buffer.byteLength);
					} else {
						throw new Error('Could not read from dropped file.');
					}

					resolve();
				} catch (error) {
					reject(error);
				}
			};

			// Start reading the file to trigger `onload`
			reader.readAsArrayBuffer(file);
```

```250:259:src/vs/workbench/contrib/files/browser/fileImportExport.ts
			if (typeof file.stream === 'function' && file.size > ByteSize.MB) {
				await this.doUploadFileBuffered(resource, file, reportProgress, token);
			} else {
				await this.doUploadFileUnbuffered(resource, file, reportProgress);
			}

			return { isFile: true, resource };
```

- 为什么是问题：覆盖确认后先用目标为 `undefined` 的 `ResourceFileEdit` 删掉原文件。删除返回后若已取消，函数直接 return，新内容没有写上，原文件已经不在。大文件循环里取消只是 `break`，随后仍调用与正常写完相同的 `writeableStream.end(undefined)`，再提前返回、不等 `writeFilePromise`。`doUploadEntry` 不区分这次提前返回，仍交出 `{ isFile: true, resource }`。小于 1MB 或没有 `stream` 的文件走 `doUploadFileUnbuffered`，参数里没有取消标记，`FileReader` 只挂了 `onload`，取消停不掉写入，读失败时 Promise 也不会结束。
- 方向：取消时撤销已做的覆盖删除，并用错误结束写入流；小文件上传同样遵守取消标记，读失败要 reject。

## r12-3 高

- 症状：轮播第一次播放内存里的视频后，这段数据的底层 ArrayBuffer 被转走，再次播放失败，交给轮播的同一份数据也空了。
- 位置：`src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts` 第 103、419–457、578–580 行
- 引用：

```103:103:src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts
		this._sections = input.collection.sections;
```

```419:434:src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts
			const rawData = await this._loadRawData(currentImage);
			if (updateSeq !== this._updateSeq || this._currentIndex !== navigationIndex) {
				return;
			}

			const nonce = generateUuid();
			const videoHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src blob: data:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}
video{width:100%;height:100%;object-fit:contain;outline:none}</style>
</head><body>
<video id="v" controls></video>
<script nonce="${nonce}">
window.addEventListener("message",function(e){var m=e.data;if(m.type==="loadVideo"){var b=new Blob([m.data],{type:m.mimeType});document.getElementById("v").src=URL.createObjectURL(b);}});
```

```453:457:src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts
			webview.setHtml(videoHtml);

			// Send the video data to the webview via postMessage
			const buffer = (rawData as Uint8Array<ArrayBuffer>).buffer;
			webview.postMessage({ type: 'loadVideo', data: buffer, mimeType: currentImage.mimeType }, [buffer]);
```

```578:580:src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts
	private async _loadRawData(image: ICarouselImage): Promise<Uint8Array> {
		if (image.data) {
			return image.data instanceof Uint8Array ? image.data : image.data.buffer;
```

- 为什么是问题：`setInput` 直接持有调用方的 `sections`，`data` 是 `VSBuffer`，没有另存一份。`_loadRawData` 在 `data` 存在时返回 `image.data.buffer`，不会改从 `uri` 读。`postMessage` 的转移列表是这个 `Uint8Array` 的底层 `ArrayBuffer`，源缓冲被拆掉。页面用整个 `m.data` 造 Blob，视图若只是大缓冲中的一段，还会带上视图以外的字节。`data` 仍为真，下次播放继续走已拆掉的缓冲。
- 方向：发给页面的是当前视图的副本，原 `image.data` 在播放之后仍可再读。

## r12-4 中

- 症状：剪切后粘贴到已有同名文件上时移动失败，剪切标记被清掉，文件仍留在原地。
- 位置：`src/vs/workbench/contrib/files/browser/fileActions.ts` 第 343–354、1098–1104、1289–1353 行
- 引用：

```1098:1104:src/vs/workbench/contrib/files/browser/fileActions.ts
export function pathsPasteAllowOverwrite(shouldMovePaths: boolean, incrementalNaming: string | undefined): boolean {
	return shouldMovePaths || incrementalNaming === 'disabled';
}

export function shouldClearPasteMoveInFinally(executedMove: boolean): boolean {
	return executedMove;
}
```

```343:354:src/vs/workbench/contrib/files/browser/fileActions.ts
	while (true && !fileToPaste.allowOverwrite) {
		if (!explorerService.findClosest(candidate)) {
			break;
		}
		if (incrementalNaming !== 'disabled') {
			name = incrementFileName(name, !!fileToPaste.isDirectory, incrementalNaming);
		}
		candidate = resources.joinPath(targetFolder.resource, name);
	}
	return candidate;
```

```1289:1299:src/vs/workbench/contrib/files/browser/fileActions.ts
				if (shouldMovePaths) {
					executedMove = true;
					const resourceFileEdits = sourceTargetPairs.map(pair => new ResourceFileEdit(pair.source, pair.target, { overwrite: incrementalNaming === 'disabled' }));
					const options = {
						confirmBeforeUndo: configurationService.getValue<IFilesConfiguration>().explorer.confirmUndo === UndoConfirmLevel.Verbose,
						progressLabel: sourceTargetPairs.length > 1 ? nls.localize({ key: 'movingBulkEdit', comment: ['Placeholder will be replaced by the number of files being moved'] }, "Moving {0} files", sourceTargetPairs.length)
							: nls.localize({ key: 'movingFileBulkEdit', comment: ['Placeholder will be replaced by the name of the file moved.'] }, "Moving {0}", resources.basenameOrAuthority(sourceTargetPairs[0].target)),
						undoLabel: sourceTargetPairs.length > 1 ? nls.localize({ key: 'moveBulkEdit', comment: ['Placeholder will be replaced by the number of files being moved'] }, "Move {0} files", sourceTargetPairs.length)
							: nls.localize({ key: 'moveFileBulkEdit', comment: ['Placeholder will be replaced by the name of the file moved.'] }, "Move {0}", resources.basenameOrAuthority(sourceTargetPairs[0].target))
					};
					await explorerService.applyBulkEdit(resourceFileEdits, options);
```

```1346:1353:src/vs/workbench/contrib/files/browser/fileActions.ts
	} catch (e) {
		notificationService.error(toErrorMessage(new Error(nls.localize('fileDeleted', "The file(s) to paste have been deleted or moved since you copied them. {0}", getErrorMessage(e))), false));
	} finally {
		if (shouldClearPasteMoveInFinally(executedMove)) {
			// Cut is done. Make sure to clear cut state.
			await explorerService.setToCopy([], false);
			clearPasteMoveState();
		}
```

- 为什么是问题：剪切时 `pathsPasteAllowOverwrite` 为 true，`findValidPasteFileTarget` 不再做增量改名；询问覆盖只发生在 `incrementalNaming === 'disabled'`。移动编辑的 `overwrite` 也只有这时才为 true。增量命名未禁用时，同名目标既不改名也不能覆盖，`applyBulkEdit` 失败。`executedMove` 在这次 await 之前就已经是 true，`finally` 仍清掉剪切状态。`catch` 还把这次失败说成源文件已被删除或移走。
- 方向：移动成功后再清剪切；同名目标要么增量改名，要么确认后带 `overwrite` 移动。

## r12-5 中

- 症状：用首选内容打开文件时，解析一旦失败，这个输入上的首选内容就没了，再次解析不会再带上它。
- 位置：`src/vs/workbench/contrib/files/browser/editors/fileEditorInput.ts` 第 353–410 行
- 引用：

```353:365:src/vs/workbench/contrib/files/browser/editors/fileEditorInput.ts
			// Unset preferred contents after having applied it once
			// to prevent this property to stick. We still want future
			// `resolve` calls to fetch the contents from disk.
			const preferredContents = this.preferredContents;
			this.preferredContents = undefined;

			// Resolve resource via text file service and only allow
			// to open binary files if we are instructed so
			await this.textFileService.files.resolve(this.resource, {
				languageId: this.preferredLanguageId,
				encoding: this.preferredEncoding,
				contents: typeof preferredContents === 'string' ? createTextBufferFactory(preferredContents) : undefined,
```

```403:410:src/vs/workbench/contrib/files/browser/editors/fileEditorInput.ts
		} catch (error) {

			// Handle binary files with binary model
			if ((<TextFileOperationError>error).textFileOperationResult === TextFileOperationResult.FILE_IS_BINARY) {
				return this.doResolveAsBinary();
			}

			// Bubble any other error up
			throw error;
```

- 为什么是问题：首选内容在 `files.resolve` 返回之前就从输入上抹掉。解析抛错时，`catch` 只把二进制改去二进制模型，其它错误原样抛出，不会把刚取走的字符串写回 `preferredContents`。文件不存在这类失败发生在内容进入模型之前，输入上这份额外文本已经不在了。
- 方向：`resolve` 成功后再清除首选内容，失败时把这次取走的字符串写回。
