---
title: "十六路审查 r14：contrib 其余发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样 scm、git、files、search、preferences、extensions、comments、mergeEditor 的状态与销毁路径，证实 5 条。"
---

# 十六路审查 r14：contrib 其余发现
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围是 `src/vs/workbench/contrib` 里除禁读目录以外的抽样，优先看了 scm、git、files、search、preferences、extensions、comments、mergeEditor。下面 5 条都来自这次读到的源码。

### r14-1

- 严重度：高
- 症状：未发送的评论草稿在重启后不会从本窗口的存储里读回来；下一次保存工作台状态时，存储被当前已打开编辑器上的草稿整表覆盖，其它文件上的草稿被清掉。
- 代码：

```178:178:src/vs/workbench/contrib/comments/browser/commentService.ts
	private _continueOnComments = new Map<string, PendingCommentThread[]>(); // uniqueOwner -> PendingCommentThread[]
```

```203:213:src/vs/workbench/contrib/comments/browser/commentService.ts
		const storageEvent = Event.debounce(this.storageService.onDidChangeValue(StorageScope.WORKSPACE, CONTINUE_ON_COMMENTS, storageListener), (last, event) => last?.external ? last : event, 500);
		storageListener.add(storageEvent(v => {
			if (!v.external) {
				return;
			}
			const commentsToRestore: PendingCommentThread[] | undefined = this.storageService.getObject(CONTINUE_ON_COMMENTS, StorageScope.WORKSPACE);
			if (!commentsToRestore) {
				return;
			}
```

```231:237:src/vs/workbench/contrib/comments/browser/commentService.ts
		this._register(storageService.onWillSaveState(() => {
			const map: Map<string, PendingCommentThread[]> = new Map();
			for (const provider of this._continueOnCommentProviders) {
				const pendingComments = provider.provideContinueOnComments();
				this._addContinueOnComments(pendingComments, map);
			}
			this._saveContinueOnComments(map);
		}));
```

```521:527:src/vs/workbench/contrib/comments/browser/commentService.ts
	private _saveContinueOnComments(map: Map<string, PendingCommentThread[]>) {
		const commentsToSave: PendingCommentThread[] = [];
		for (const pendingComments of map.values()) {
			commentsToSave.push(...pendingComments);
		}
		this.storageService.store(CONTINUE_ON_COMMENTS, commentsToSave, StorageScope.WORKSPACE, StorageTarget.USER);
	}
```

```569:577:src/vs/workbench/contrib/comments/browser/commentsController.ts
			this.commentService.registerContinueOnCommentProvider({
				provideContinueOnComments: () => {
					const pendingComments: languages.PendingCommentThread[] = [];
					if (this._commentWidgets) {
						for (const zone of this._commentWidgets) {
							const zonePendingComments = zone.getPendingComments();
							const pendingNewComment = zonePendingComments.newComment;
							if (!pendingNewComment) {
								continue;
```

```589:600:src/vs/workbench/contrib/comments/browser/commentsController.ts
							if (pendingNewComment.body !== lastCommentBody) {
								pendingComments.push({
									uniqueOwner: zone.uniqueOwner,
									uri: zone.editor.getModel()!.uri,
									range: zone.commentThread.range,
									comment: pendingNewComment,
									isReply: (zone.commentThread.comments !== undefined) && (zone.commentThread.comments.length > 0)
								});
							}
						}
					}
					return pendingComments;
```

- 为什么是问题：内存里的 `_continueOnComments` 一开始是空表。唯一的 `getObject` 在存储监听里，而且 `external` 不为真就直接返回。本窗口启动不会走这条外部变更路径，所以磁盘上的草稿不会载入。`onWillSaveState` 却用一份新的空 Map，只收集当前还挂着的编辑器控件返回的草稿，再 `store` 整表覆盖。控件只汇报自己还活着的 zone。文件已经关掉、控件还没建出来、或者草稿只留在内存缓存里时，这次保存会把那些正文写成空列表。
- 方向：启动时读入已有草稿，保存时并上这份内存表，而不是只用当前打开编辑器的控件结果覆盖。

### r14-2

- 严重度：高
- 症状：把文件夹拖进已经有同名目录的资源管理器并确认替换后，目录里同名文件被直接写覆盖；上传取消或中途失败时，这些原文件不会恢复。
- 代码：

```175:189:src/vs/workbench/contrib/files/browser/fileImportExport.ts
				// Confirm overwrite as needed. Directories are not deleted here:
				// undo of a directory delete only recreates an empty folder.
				const entryName = entry.name;
				const destination = entryName ? joinPath(target.resource, entryName) : undefined;
				let deletedExistingFile = false;
				let deleteUndo: IUndoRedoElement | undefined;
				let undoSnapshot: ResourceEditStackSnapshot | undefined;
				if (target && entryName && destination && target.getChild(entryName)) {
					const { confirmed } = await this.dialogService.confirm(getFileOverwriteConfirm(entryName));
					if (!confirmed) {
						return;
					}

					const existing = target.getChild(entryName);
					if (existing && !existing.isDirectory) {
```

```198:198:src/vs/workbench/contrib/files/browser/fileImportExport.ts
						deletedExistingFile = true;
```

```213:217:src/vs/workbench/contrib/files/browser/fileImportExport.ts
				try {
					result = await this.doUploadEntry(entry, target.resource, target, progress, operation, token);
				} catch {
					await this.rollbackUpload(deletedExistingFile, destination, entry.isFile, deleteUndo, undoSnapshot);
					return;
				}
```

```219:221:src/vs/workbench/contrib/files/browser/fileImportExport.ts
				if (!result) {
					await this.rollbackUpload(deletedExistingFile, destination, entry.isFile, deleteUndo, undoSnapshot);
					return;
				}
```

```461:461:src/vs/workbench/contrib/files/browser/fileImportExport.ts
		const writeFilePromise = this.fileService.writeFile(resource, writeableStream);
```

```547:547:src/vs/workbench/contrib/files/browser/fileImportExport.ts
						await this.fileService.writeFile(resource, buffer);
```

```263:275:src/vs/workbench/contrib/files/browser/fileImportExport.ts
	private async rollbackUpload(deletedExistingFile: boolean, resource: URI | undefined, entryIsFile: boolean, deleteUndo?: IUndoRedoElement, snapshot?: ResourceEditStackSnapshot): Promise<void> {
		if (!resource) {
			return;
		}
		if (deletedExistingFile) {
			await this.restoreOverwrittenFile(resource, deleteUndo, snapshot, true);
			return;
		}
		if (entryIsFile) {
			await this.deleteUploadTargetIfExists(resource);
		}
	}
```

```384:386:src/vs/workbench/contrib/files/browser/fileImportExport.ts
				if (folderExisted) {
					preExistingChildNames = await this.listUploadChildNames(resource);
				}
```

```418:420:src/vs/workbench/contrib/files/browser/fileImportExport.ts
					if (folderExisted && preExistingChildNames && childEntry.name && !preExistingChildNames.has(this.uploadChildKey(resource, childEntry.name))) {
						created.push(joinPath(resource, childEntry.name));
					}
```

```440:448:src/vs/workbench/contrib/files/browser/fileImportExport.ts
			} finally {
				if (!succeeded && ownsCleanup) {
					if (folderExisted) {
						for (const createdResource of created) {
							await this.deleteCreatedUploadTree(createdResource);
						}
					} else {
						await this.deleteCreatedUploadTree(resource);
					}
				}
```

- 为什么是问题：确认框按“替换”处理已存在的名字，但目录不会先删除，也没有像文件那样做 undo 快照，`deletedExistingFile` 保持 false。子文件上传会写到同名路径上。失败或取消时，回滚只删除 `created` 里“原来没有的名字”；已经被写过的旧文件不在这个名单里，外层 `rollbackUpload` 对目录也什么都不做。用户取消上传之后，目的地里同名文件的原内容已经没了。
- 方向：覆盖已有目录项之前先留下可恢复的原内容，取消或失败时按这份记录写回，不要只删新建名字。

### r14-3

- 严重度：中
- 症状：扩展更新的周期检查一旦失败，就不再预约下一次。
- 代码：

```1212:1213:src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts
		// Check for updates
		this.eventuallyCheckForUpdates(true);
```

```2096:2099:src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts
			this.logService.trace(`Checking updates for extensions`, infos.map(e => e.id).join(', '));
			const galleryExtensions = await this.galleryService.getExtensions(infos, { targetPlatform, compatible: true, productVersion: this.getProductVersion() }, CancellationToken.None);
```

```2241:2248:src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts
	private eventuallyCheckForUpdates(immediate = false): void {
		this.updatesCheckDelayer.cancel();
		this.updatesCheckDelayer.trigger(async () => {
			if (this.isAutoCheckUpdatesEnabled()) {
				await this.checkForUpdates();
			}
			this.eventuallyCheckForUpdates();
		}, immediate ? 0 : this.getUpdatesCheckInterval()).then(undefined, err => null);
	}
```

- 为什么是问题：下一次 `eventuallyCheckForUpdates()` 写在 `await this.checkForUpdates()` 后面。`getExtensions` 拒绝时，这次回调在预约下一轮之前就失败了。外层 `.then(undefined, err => null)` 把这个拒绝吃掉。构造时只在 `initializeAutoUpdate` 里启动这一轮循环；配置开关和产品更新只单独再调一次 `checkForUpdates`，不会把循环重新挂上。一次网络失败之后，定时检查不再发生。
- 方向：无论这次检查成功还是失败，都继续预约下一轮，不要把拒绝吞掉后让循环断掉。

### r14-4

- 严重度：中
- 症状：Git 扩展委托被卸掉之后，再打开仓库会立刻失败，不会等待新的委托接上。
- 代码：

```30:58:src/vs/workbench/contrib/git/browser/gitService.ts
	setDelegate(delegate: IGitExtensionDelegate): IDisposable {
		if (this._delegate) {
			this.logService.error('[GitService][setDelegate] GitExtension delegate is already set.');
			throw new BugIndicatingError('GitExtension delegate is already set.');
		}
		this._delegate = delegate;
		this._delegateBarrier.open();
		return toDisposable(() => {
			this._delegate = undefined;
		});
	}

	async openRepository(uri: URI): Promise<IGitRepository | undefined> {
		await this._delegateBarrier.wait();
		if (!this._delegate) {
			this.logService.warn('[GitService][openRepository] GitExtension delegate is not set after 10 seconds. Cannot open repository.');
			return undefined;
		}
		return this._delegate.openRepository(uri);
	}
```

- 为什么是问题：屏障在第一次 `setDelegate` 时被 `open()`，销毁回调只把 `_delegate` 置空，不换一个新的屏障。之后 `wait()` 马上返回。扩展宿主重启、旧委托已清、新委托尚未 `setDelegate` 时，`openRepository` 走到 `!this._delegate` 并返回 `undefined`。若新委托在旧委托还没清掉时调用 `setDelegate`，这里会直接抛 `BugIndicatingError`，这一窗口里的 Git 委托就装不回去。
- 方向：卸掉委托时重置等待屏障，让下一次 `openRepository` 重新等待新委托，而不是沿用已经打开的屏障。

### r14-5

- 严重度：低
- 症状：连续搜索，尤其是边输入边搜时，进度用的 Emitter 和延迟定时器会一直留在同一个搜索模型上，直到这个模型被销毁。
- 代码：

```256:261:src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts
		const progressEmitter = this._register(new Emitter<void>());
		this._replacePattern = new ReplacePattern(this.replaceString, this._searchQuery.contentPattern);

		// In search on type case, delay the streaming of results just a bit, so that we don't flash the only "local results" fast path
		this._startStreamDelay = new Promise(resolve => setTimeout(resolve, this.searchConfig.searchOnType ? 150 : 0));
```

```441:446:src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts
	override dispose(): void {
		this.cancelSearch();
		this.cancelAISearch();
		this.searchResult.dispose();
		super.dispose();
	}
```

```459:463:src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts
	get searchModel(): SearchModelImpl {
		if (!this._searchModel) {
			this._searchModel = this.instantiationService.createInstance(SearchModelImpl);
		}
		return this._searchModel;
	}
```

- 为什么是问题：每次 `search()` 都 `this._register` 一个新的 `Emitter`，没有在这次搜索结束时丢掉它。延迟用的 `setTimeout` 也没有句柄，取消搜索不会清掉它。工作台服务把同一个 `SearchModelImpl` 留到替换或销毁为止，所以这些 Emitter 会跟着按键次数往上叠。取消令牌本身有 `dispose`，这两样没有。
- 方向：一次搜索结束或被新搜索取代时，释放这次的 Emitter，并取消还没触发的延迟定时器。

## 这次实际打开的文件

- `src/vs/workbench/contrib/comments/browser/commentService.ts`
- `src/vs/workbench/contrib/comments/browser/commentsController.ts`
- `src/vs/workbench/contrib/files/browser/fileImportExport.ts`
- `src/vs/workbench/contrib/files/browser/explorerService.ts`
- `src/vs/workbench/contrib/files/browser/views/explorerView.ts`
- `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts`
- `src/vs/workbench/contrib/files/common/explorerModel.ts`
- `src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts`
- `src/vs/workbench/contrib/git/browser/gitService.ts`
- `src/vs/workbench/contrib/git/common/gitService.ts`
- `src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts`
- `src/vs/workbench/contrib/search/browser/replaceService.ts`
- `src/vs/workbench/contrib/scm/browser/scmInput.ts`
- `src/vs/workbench/contrib/scm/browser/scmViewService.ts`
- `src/vs/workbench/contrib/scm/browser/workingSet.ts`
- `src/vs/workbench/contrib/scm/common/scmService.ts`
- `src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts`
- `src/vs/workbench/contrib/preferences/browser/settingsEditFlush.ts`
- `src/vs/workbench/contrib/mergeEditor/browser/model/mergeEditorModel.ts`
- `src/vs/workbench/contrib/mergeEditor/browser/view/conflictActions.ts`
