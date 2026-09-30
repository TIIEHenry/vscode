---
title: "审查 r10：workbench-shell"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "stable 上缺失的 proposed API 实验会放行全部提案；另存为、还原和代理写入会丢掉用户内容。"
---

# 发现

## r10-1 高

- 症状：stable 品质启动扩展主机时，若实验待遇缺失、5 秒内读不到或读取抛错，任何 `enabledApiProposals` 不是 `null`/`undefined` 的扩展都会被放行全部 proposed API。主进程刚刚把不允许的提案列表收成空数组的旁加载扩展也算在内。
- 位置：`src/vs/workbench/services/extensions/common/extensions.ts` 第 455–457 行
- 引用：

```455:457:src/vs/workbench/services/extensions/common/extensions.ts
	const resolver: ProposedApiEnabledResolver = value === undefined
		? () => true
		: (extension, proposal) => allowed.has(`${ExtensionIdentifier.toKey(extension.identifier)}:${proposal}`);
```

- 为什么是问题：`resolveEnabledApiProposalsFallbackExperiment`（同文件第 407–418 行）在 `quality === 'stable'` 时，待遇缺失、`raceTimeout` 超时或抛错都返回 `undefined`，旁边的注释写的是这样会保持原有限制。本地扩展主机在 `src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHost.ts` 第 540–547 行把该值放进初始化数据，`src/vs/workbench/api/common/extHostExtensionService.ts` 第 212 行再传给 `setEnabledApiProposalsFallbackExperiment`。stable 且值为 `undefined` 时解析器对每个提案返回 `true`。`isProposedApiEnabled`（同文件第 327–334 行）只在 `enabledApiProposals` 为 `null`/`undefined` 时直接拒绝，空数组是真值，会继续问解析器。`src/vs/workbench/services/extensions/common/extensionsProposedApi.ts` 第 110–113 行在 stable、且没有「全部放行」或按扩展放行开关时，把非内置扩展的提案列表赋成 `[]`。结果是：扩展在 package.json 里声明过任意提案、主进程已明确剥掉这些提案之后，扩展主机仍对任意 proposal 返回允许。
- 方向：`value` 为 `undefined` 时不要安装解析器，并按「没有提案」处理空数组。

## r10-2 高

- 症状：带关联路径的未命名文档去保存一个已存在的二进制文件，或超过文本模型大小限制的文件时，原文件先被删除，覆盖确认不会出现；随后若写入失败，原内容已经不在磁盘上。
- 位置：`src/vs/workbench/services/textfile/browser/textFileService.ts` 第 532–555 行
- 引用：

```532:555:src/vs/workbench/services/textfile/browser/textFileService.ts
				if (targetExists) {
					if (
						(<TextFileOperationError>error).textFileOperationResult === TextFileOperationResult.FILE_IS_BINARY ||
						(<FileOperationError>error).fileOperationResult === FileOperationResult.FILE_TOO_LARGE
					) {
						await this.fileService.del(target);

						return this.doSaveAsTextFile(sourceModel, source, target, options);
					}
				}

				throw error;
			}
		}

		// Confirm to overwrite if we have an untitled file with associated file where
		// the file actually exists on disk and we are instructed to save to that file
		// path. This can happen if the file was created after the untitled file was opened.
		// See https://github.com/microsoft/vscode/issues/67946
		let write: boolean;
		if (sourceModel instanceof UntitledTextEditorModel && sourceModel.hasAssociatedFilePath && targetExists && this.uriIdentityService.extUri.isEqual(target, toLocalResource(sourceModel.resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme))) {
			write = await this.confirmOverwrite(target);
		} else {
			write = true;
		}
```

- 为什么是问题：`save`（同文件第 359–371 行）对 `hasAssociatedFilePath` 的未命名文档不弹出保存对话框，直接按关联路径 `saveAs`。目标已存在且 `resolve` 得到 `FILE_IS_BINARY` 或 `FILE_TOO_LARGE` 时，第 537–539 行先 `del(target)` 再递归。递归里文件已经不存在，`targetExists` 为 false，第 552 行的 `confirmOverwrite` 条件不成立，`write` 为 true。用户没有机会取消；第二次创建或保存若再失败，被删掉的原文件也不会回来。
- 方向：先做覆盖确认，确认之后再删除并写入；写入失败时保留原文件。

## r10-3 高

- 症状：文件已从磁盘删除、编辑器里仍有未保存修改时执行还原，脏标记被清掉，热退出备份被丢弃，再关闭编辑器不会询问保存，缓冲里的修改丢失。
- 位置：`src/vs/workbench/services/workingCopy/common/storedFileWorkingCopy.ts` 第 1300–1320 行
- 引用：

```1300:1320:src/vs/workbench/services/workingCopy/common/storedFileWorkingCopy.ts
		// Unset flags
		const wasDirty = this.dirty;
		const undoSetDirty = this.doSetDirty(false);

		// Force read from disk unless reverting soft
		const softUndo = options?.soft;
		if (!softUndo) {
			try {
				await this.forceResolveFromFile();
			} catch (error) {

				// FileNotFound means the file got deleted meanwhile, so ignore it
				if ((error as FileOperationError).fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {

					// Set flags back to previous values, we are still dirty if revert failed
					undoSetDirty();

					throw error;
				}
			}
		}
```

- 为什么是问题：`doSetDirty(false)` 发生在读盘之前。`forceResolveFromFile` 使用 `forceReadFromFile`，同文件第 649–654 行对已解析工作副本的 `FILE_NOT_FOUND` 会继续抛出。`revert` 对这个错误不调用 `undoSetDirty`，`resolveFromContent` 也没有跑，模型里仍是未保存文本，但 `dirty` 已是 false。随后 `onDidChangeDirty` 触发 `src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts` 第 144–145 行的 `discardBackup`。关闭编辑器只看脏标记，因此不会再提示保存，备份也已经没了。
- 方向：确认文件不存在时恢复脏标记，并保留对应备份。

## r10-4 高

- 症状：代理对已打开文件的磁盘写入失败时（权限不足、文件锁定，或 `createOnly` 撞上已存在文件），调用仍成功返回，编辑器缓冲被整篇换成代理内容。
- 位置：`src/vs/workbench/services/agentHost/common/agentHostResourceService.ts` 第 161–172 行
- 引用：

```161:172:src/vs/workbench/services/agentHost/common/agentHostResourceService.ts
		try {
			if (params.createOnly) {
				await this._fileService.createFile(uri, buf, { overwrite: false });
			} else {
				await this._fileService.writeFile(uri, buf);
			}
		} catch (err) {
			if (await this._writeVirtual(uri, buf)) {
				return;
			}
			throw err;
		}
```

- 为什么是问题：`_writeVirtual`（同文件第 346–360 行）只要能解析出可写文本模型，就 `setValue` 并返回 true。磁盘 `writeFile` / `createFile` 的任何错误都会走进这个分支，然后 `write` 正常返回。已打开缓冲里的未保存内容被替换；自动保存开着时，替换后的内容还会写回磁盘。`createOnly` 在文件已存在时本应失败，同样会改写已打开的缓冲并报告成功。
- 方向：磁盘写入失败时把原错误抛回；模型回退只用于没有文件提供者的虚拟文档。
