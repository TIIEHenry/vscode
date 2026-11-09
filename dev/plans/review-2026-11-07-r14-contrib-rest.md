---
title: "十六路审查 2026-11-07 r14：contrib 其余发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "看了 10-30 以后的焦点与减弱动效 CSS、11-04 各波去重与销毁守卫重构，并抽查 searchEditor、output、extensions、preferences、files 的分支代码；2 条。"
---

# 十六路审查 2026-11-07 r14：contrib 其余发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次先看本路范围内 2026-10-30 以后改过的文件，范围内没有未提交改动。11-07 的键盘焦点与减弱动效提交在本路只改了 comments、files、imageCarousel、preferences、scm、search 的 CSS；`Button` 获得焦点时会把悬停底色写进内联样式，全局样式也统一处理了输入框和动作栏的 `:focus`，没有找到可证实的焦点缺失。11-04 各波「去重 catch、加销毁守卫」重构看了 files、scm、mergeEditor、comments、accessibility、bulkEdit、tasks、output、update、snippets、userDataProfile、codeEditor，新守卫检查的都是对象整个生命周期的 store，没有发现会误挡正常流程的。随后抽查分支自写较多的 searchEditor、output 通道模型、extensions 分页模型、设置写入时机与设置容器、剪切粘贴、资源管理器多视图。可达性按默认编辑器窗口核对：`extensionsViews.ts` 的 `PreferredExtensionsPagedModel` 按页序等待（1707–1713 行），跳页或前页请求被取消时后页会一直停在占位，但本产品不配置扩展市场、扩展侧栏在默认窗口隐藏，走不到，未计入。共 2 条。

### r14-1

- 严重度：中
- 症状：同一编辑器组里开着两个搜索编辑器 A 和 B。A 的搜索还在跑时切到 B，A 的搜索在 B 显示期间结束；之后在 B 里搜别的词。切回 A 时，A 的结果区被换成 B 那次搜索的命中，查询框里仍是 A 的词。A 若是已保存的 `.code-search` 文件，还会被标成未保存，这时保存会把错配的结果写进文件。
- 代码：`src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts` 621–635、646–659、677–685、792–802；窗格级 `searchModel` 在 133，标脏在 694。

```621:635:src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts
		configurationModel.updateConfig(config);
		const result = this.searchModel.search(query);
		const operation = result.asyncResults.finally(() => {
			this.ongoingOperations--;
			if (this.ongoingOperations === 0) {
				this.searchOperation.stop();
			}
		});
		startInput.ongoingSearchOperation = operation;

		const searchOperation = await operation;
		if (this._store.isDisposed || searchSeq !== this._searchSeq) {
			return;
		}
		await this.onSearchComplete(searchOperation, config, startInput, searchSeq, operation);
```

```646:659:src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts
		const input = this.getInput();
		if (this._store.isDisposed || !input || isStaleCompletion()) {
			return;
		}

		if (searchSeq === undefined && operation === undefined && this._searchSeq !== this._openAttachmentSearchSeq) {
			return;
		}

		if (operation === undefined) {
			input.ongoingSearchOperation = undefined;
		} else if (input.ongoingSearchOperation === operation) {
			input.ongoingSearchOperation = undefined;
		}
```

```677:685:src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts
		const results = serializeSearchResultForEditor(this.searchModel.searchResult, startConfig.filesToInclude, startConfig.filesToExclude, startConfig.contextLines, labelFormatter, sortOrder, searchOperation?.limitHit);
		const { resultsModel } = await input.resolveModels();
		if (isStaleCompletion()) {
			return;
		}

		this.updatingModelForSearch = true;
		this.modelService.updateModel(resultsModel, results.text);
		this.updatingModelForSearch = false;
```

```792:802:src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts
		this._openAttachmentSearchSeq = this._searchSeq;

		if (newInput.ongoingSearchOperation) {
			const existingConfig = this.readConfigFromWidget();
			newInput.ongoingSearchOperation.then(complete => {
				if (this._store.isDisposed) {
					return;
				}
				this.onSearchComplete(complete, existingConfig, newInput);
			}).catch(onUnexpectedError);
		}
```

- 为什么是问题：`searchModel` 在构造函数里每个窗格只建一个（133 行），同一组里的搜索编辑器输入复用同一个窗格，也共用这份结果。A 的搜索结束时当前输入已经是 B，`isStaleCompletion()` 为真，647–649 行在 655–659 行清掉 `ongoingSearchOperation` 之前就返回，A 上留着这次已经完成的 `operation`。B 的搜索调用同一个 `searchModel.search`，窗格里的 `searchResult` 换成 B 的命中。切回 A 时，792 行把 `_openAttachmentSearchSeq` 设成当前序号，794–801 行补放 A 留下的 `operation`；补放时两个序号相等，651 行的守卫放行，`existingConfig` 刚由 A 的配置写回控件，`isStaleCompletion()` 也为假。677 行序列化的却是 `this.searchModel.searchResult`，也就是 B 的结果，684 行把它写进 A 的结果模型，694 行再把非无标题的 A 标脏。分支提交 `df294508e62`（2026-09-25）加 `_openAttachmentSearchSeq` 只挡住「挂上之后又开始了新搜索」，挡不住「挂上之前窗格已经替别的输入搜过」。
- 方向：补放前确认窗格当前的 `searchResult` 就是这次 `operation` 产生的（例如在输入上记下发起时的 `_searchSeq` 再与当前值比对），对不上就不写结果，改为显示重新搜索提示。

### r14-2

- 严重度：低
- 症状：输出通道以编辑器打开、文件轮询在跑时，扩展对这个通道调用 `replace()`。如果轮询恰好落在这次替换读文件与算完差异之间，替换被整次丢掉，随后的追加把新内容接在旧内容后面，通道显示旧内容加新内容，而不是只有新内容。默认编辑器窗口里 Output 面板不可用（视图容器是 `WindowEnablement.Sessions`），这条只在用「Developer: Open Log...」打开扩展日志通道、且该通道调用 `replace()` 时可达；Agents 窗口的 Output 面板更容易碰到。
- 代码：`src/vs/workbench/contrib/output/common/outputChannelModel.ts` 199–207（轮询）、242–249（消费判定）、641–661（替换）、617–627（追加）、730–737（替换前把偏移拉回 `till`）。

```199:207:src/vs/workbench/contrib/output/common/outputChannelModel.ts
			if (stat.etag !== this.etag) {
				++this.contentGeneration;
				// Leave `etag` for a successful consume. Updating it here would hide a read that lost the race, and the new bytes would never be polled again.
				if (isNumber(stat.size) && this.endOffset > stat.size) {
					this.reset(0);
					this._onDidReset.fire();
				} else {
					this._onDidAppend.fire();
				}
```

```242:249:src/vs/workbench/contrib/output/common/outputChannelModel.ts
					consumed = true;
					if (generation !== this.contentGeneration || this._store.isDisposed || this.endOffset !== readOffset) {
						return false;
					}
					this.endOffset += fileContent.value.byteLength;
					this.etag = fileContent.etag;
					this.logEntries.push(...logEntries);
					return true;
```

```641:661:src/vs/workbench/contrib/output/common/outputChannelModel.ts
	private async replaceContent(model: ITextModel, token: CancellationToken): Promise<void> {
		/* Get content to replace */
		const { content, consume } = await this.outputContentProvider.getContent();
		/* Abort if operation is cancelled */
		if (token.isCancellationRequested) {
			return;
		}

		/* Compute Edits */
		const edits = await this.getReplaceEdits(model, content.toString());
		/* Abort if operation is cancelled */
		if (token.isCancellationRequested) {
			return;
		}

		if (consume() && edits.length) {
			/* Apply Edits */
			model.applyEdits(edits);
		}
		this.modelUpdateInProgress = false;
	}
```

```617:627:src/vs/workbench/contrib/output/common/outputChannelModel.ts
			const { content, consume } = await this.outputContentProvider.getContent();
			/* Abort if operation is cancelled */
			if (token.isCancellationRequested) {
				return;
			}

			/* Append only when this read still owns the offset. A rejected consume leaves endOffset put. */
			if (consume()) {
				this.doAppendContent(model, content);
			}
			this.modelUpdateInProgress = false;
```

```730:737:src/vs/workbench/contrib/output/common/outputChannelModel.ts
			if (mode === OutputChannelUpdateMode.Clear || mode === OutputChannelUpdateMode.Replace) {
				if (isNumber(till)) {
					this.fileOutput.reset(till);
				} else {
					this.fileOutput.resetToEnd();
				}
			}
			this.doUpdate(mode, immediate);
```

- 为什么是问题：替换先 `reset(till)` 把 `endOffset` 拉回替换前的位置，`replaceContent` 再读 `till` 之后的新内容，等 `computeMoreMinimalEdits` 算完，最后 `consume()` 成功才应用编辑。替换写进文件后 etag 变了，而 `this.etag` 只在 `consume()` 成功时更新，所以下一次轮询（约 500ms 一次）必定 `++contentGeneration` 并触发 `onDidAppend`。只要这次轮询落在替换的 `getContent` 取号之后、`consume()` 之前，`consume()` 因代数不符返回 false，656 行跳过整次替换，模型保留旧内容，`endOffset` 停在 `till`。轮询触发的追加随后从 `till` 读到新内容，在 624–625 行接到模型末尾，此后没有任何路径再发起替换。2026-10-24 按 r11-3 方案（`dev/plans/review-2026-10-11-r11-debug-scm-plan.md`）让三个写入点在 `consume()` 为 false 时跳过写入，这对追加是对的，因为下一次追加会从原偏移重读；替换被跳过之后跟上来的只有追加，所以结果仍然错。上游的 `doWatch` 发现变化时同步更新 etag，`consume` 也不做代数拒绝，替换总会生效。
- 方向：替换的 `consume()` 被拒时重新发起一次替换，而不是把剩下的内容交给追加。

## 打开过的文件

- `src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts`
- `src/vs/workbench/contrib/searchEditor/browser/searchEditorModel.ts`（分支 diff）
- `src/vs/workbench/contrib/searchEditor/browser/searchEditorInput.ts`（分支 diff）
- `src/vs/workbench/contrib/searchEditor/browser/searchEditor.contribution.ts`
- `src/vs/workbench/contrib/search/browser/searchView.ts`
- `src/vs/workbench/contrib/search/browser/search.contribution.ts`
- `src/vs/workbench/contrib/search/browser/replaceService.ts`（分支 diff）
- `src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts`
- `src/vs/workbench/contrib/search/browser/searchTreeModel/searchResult.ts`
- `src/vs/workbench/contrib/search/browser/searchTreeModel/textSearchHeading.ts`
- `src/vs/workbench/contrib/search/browser/media/searchview.css`（11-07 diff）
- `src/vs/workbench/contrib/output/common/outputChannelModel.ts`
- `src/vs/workbench/contrib/output/browser/output.contribution.ts`
- `src/vs/workbench/contrib/output/browser/outputServices.ts`
- `src/vs/workbench/contrib/extensions/browser/extensionsViews.ts`
- `src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts`
- `src/vs/workbench/contrib/scm/browser/scmInput.ts`
- `src/vs/workbench/contrib/scm/browser/scmViewPane.ts`
- `src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts`（11-04 diff）
- `src/vs/workbench/contrib/scm/browser/scmRepositoriesViewPane.ts`（11-04 diff）
- `src/vs/workbench/contrib/scm/browser/media/scm.css`（11-07 diff）
- `src/vs/workbench/contrib/files/browser/views/explorerView.ts`
- `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts`（11-04 diff）
- `src/vs/workbench/contrib/files/browser/views/openEditorsView.ts`（11-04 diff）
- `src/vs/workbench/contrib/files/browser/explorerInlineFilterBox.ts`
- `src/vs/workbench/contrib/files/browser/explorerLocationBreadcrumbBox.ts`
- `src/vs/workbench/contrib/files/browser/explorerService.ts`（分支 diff）
- `src/vs/workbench/contrib/files/browser/fileActions.ts`（分支 diff）
- `src/vs/workbench/contrib/files/browser/editors/textFileEditor.ts`（11-04 diff）
- `src/vs/workbench/contrib/files/browser/media/explorerviewlet.css`（11-07 diff）
- `src/vs/workbench/contrib/files/browser/views/media/openeditors.css`（11-07 diff）
- `src/vs/workbench/contrib/mergeEditor/browser/mergeEditorInputModel.ts`
- `src/vs/workbench/contrib/mergeEditor/browser/mergeEditorInput.ts`（分支 diff）
- `src/vs/workbench/contrib/mergeEditor/browser/model/mergeEditorModel.ts`（11-04 diff）
- `src/vs/workbench/contrib/mergeEditor/browser/commands/commands.ts`
- `src/vs/workbench/contrib/comments/browser/commentsController.ts`
- `src/vs/workbench/contrib/comments/browser/commentThreadWidget.ts`（11-04 diff）
- `src/vs/workbench/contrib/comments/browser/media/panel.css`、`review.css`（11-07 diff）
- `src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts`
- `src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEdit.contribution.ts`（分支 diff）
- `src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPreview.ts`（分支 diff）
- `src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts`
- `src/vs/workbench/contrib/preferences/browser/settingsEditFlush.ts`
- `src/vs/workbench/contrib/preferences/browser/settingsEditor2Search.ts`
- `src/vs/workbench/contrib/preferences/browser/preferencesEditor.ts`
- `src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts`
- `src/vs/workbench/contrib/preferences/browser/media/preferencesEditor.css`、`settingsEditor2.css`、`keybindingsEditor.css`（11-07 diff）
- `src/vs/workbench/contrib/imageCarousel/browser/media/imageCarousel.css`（11-07 diff）
- `src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts`（分支 diff）
- `src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts`（11-04 diff）
- `src/vs/workbench/contrib/accessibility/browser/accessibleView.ts`（11-04 diff）
- `src/vs/workbench/contrib/accessibility/browser/accessibilityStatus.ts`（11-04 diff）
- `src/vs/workbench/contrib/codeEditor/browser/find/simpleFindWidget.ts`（11-04 diff）
- `src/vs/workbench/contrib/codeEditor/browser/saveParticipants.ts`（11-04 diff）
- `src/vs/workbench/contrib/snippets/browser/snippetsService.ts`（11-04 diff）
- `src/vs/workbench/contrib/update/browser/update.ts`（11-04 diff）
- 块外，仅核对接口：`src/vs/base/browser/ui/button/button.ts`、`src/vs/base/browser/ui/inputbox/inputBox.ts`、`src/vs/base/browser/ui/list/listPaging.ts`、`src/vs/base/common/paging.ts`、`src/vs/workbench/browser/media/style.css`、`src/vs/workbench/common/views.ts`、`src/vs/workbench/common/activityViewletEnablement.ts`、`src/vs/workbench/services/views/browser/viewDescriptorService.ts`、`src/vs/workbench/browser/workbench.contribution.ts`、`src/vs/workbench/api/common/extHostOutput.ts`、`src/vs/platform/extensionManagement/common/extensionGalleryService.ts`、`src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`
