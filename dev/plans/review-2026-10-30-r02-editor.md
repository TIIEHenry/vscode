---
title: "十六路审查 r02：editor 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样 editor 的编辑、撤销、diff 与内联编辑状态，证实 3 条问题。"
---
# 十六路审查 r02：editor 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


抽样范围是 `src/vs/editor` 里编辑、撤销、diff 和内联编辑的状态所有权、销毁、被吞掉的错误和竞态。下面 3 条都来自这次读到的源码。

### r02-1

**严重度：** 中

**症状：** 跨文件内联建议一旦没被状态保住，`createModelReference` 拿到的模型引用不会释放，目标文本模型会一直被占着。

**代码：**

```265:282:src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource.ts
						if (targetUri && targetUri.toString() !== this._textModel.uri.toString()) {
							const modelRef = await this._textModelService.createModelReference(targetUri);
							targetModel = modelRef.object.textEditorModel;
							disposable = modelRef;
						} else {
							targetModel = this._textModel;
							disposable = undefined;
						}

						const ref = TextModelValueReference.snapshot(targetModel);

						const i = InlineSuggestionItem.create(item, ref);
						if (disposable) {
							const s = runOnChange(i.identity.onDispose, () => {
								disposable?.dispose();
								s.dispose();
							});
						}
```

```380:389:src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource.ts
				if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId
					|| userJumpedToActiveCompletion.get()  /* In the meantime the user showed interest for the active completion so dont hide it */) {
					const notShownReason =
						source.token.isCancellationRequested ? 'canceled:afterMinShowDelay' :
							this._store.isDisposed ? 'canceled:disposed' :
								this._textModel.getVersionId() !== request.versionId ? 'canceled:documentChanged' :
									userJumpedToActiveCompletion.get() ? 'canceled:userJumped' :
										'unknown';
					suggestions.forEach(s => s.setNotShownReasonIfNotSet(notShownReason));
					return false;
				}
```

```643:651:src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource.ts
		for (const inlineCompletion of this.inlineCompletions) {
			inlineCompletion.addRef();
		}

		this._register({
			dispose: () => {
				for (const inlineCompletion of this.inlineCompletions) {
					inlineCompletion.removeRef();
				}
```

```215:219:src/vs/editor/contrib/inlineCompletions/browser/model/inlineSuggestionItem.ts
	removeRef() {
		this._refCount--;
		if (this._refCount === 0) {
			this._onDispose.trigger(undefined);
		}
	}
```

```19:23:src/vs/editor/common/services/resolverService.ts
	/**
	 * Provided a resource URI, it will return a model reference
	 * which should be disposed once not needed anymore.
	 */
	createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>>;
```

`modelRef.dispose()` 只挂在该建议自己的 `identity.onDispose` 上。`onDispose` 只在 `removeRef` 把计数降到 0 时触发，而 `addRef` 只发生在建议被放进 `InlineCompletionsState` 时。取消、文档已变、或 `createStateWithAppliedResults` 把这项滤掉时，计数一直是 0，`dispose` 不会跑。`finally` 里关掉的是 provider 列表的引用，不是这份模型引用。`proposeRenameRefactoring` 若返回新的 `InlineSuggestionItem`，新对象有另一份 identity，原来挂着 `modelRef` 的那份同样进不了 state。

**方向：** 模型引用跟这次 fetch 的 `DisposableStore` 走，被状态接住后再转交，丢弃时立刻 `dispose`。

### r02-2

**严重度：** 中

**症状：** 内联重命名的批量编辑还在飞，命令就已经成功返回，失败没人接；下一次重命名可以同时再套一份编辑。

**代码：**

```450:463:src/vs/editor/contrib/inlineCompletions/browser/model/renameSymbolProcessor.ts
			try {
				const workspaceEdit = await renameRunnable.getWorkspaceEdit();
				// The edit was computed against the state captured when the rename was proposed. Waiting
				// for the provider or the user can change the document or move focus, and the ranges no
				// longer describe what is on screen.
				if (workspaceEdit === undefined || !renameRunnable.isValid(this._codeEditorService)) {
					return;
				}
				bulkEditService.apply(workspaceEdit, { reason: source });
			} finally {
				if (this._renameRunnable === renameRunnable) {
					this._renameRunnable = undefined;
				}
			}
```

```125:125:src/vs/editor/browser/services/bulkEditService.ts
	apply(edit: ResourceEdit[] | WorkspaceEdit, options?: IBulkEditOptions): Promise<IBulkEditResult>;
```

```592:600:src/vs/editor/contrib/inlineCompletions/browser/model/renameSymbolProcessor.ts
		if (this._renameRunnable === undefined) {
			return true;
		}
		if (this._renameRunnable.requestUuid === suggestItem.requestUuid) {
			return false;
		} else {
			this._renameRunnable.cancel();
			this._renameRunnable = undefined;
			return true;
		}
```

`apply` 返回 Promise，调用处没有 `await`，也没有把拒绝接回这个 async 命令。`finally` 在 `apply` 落地前就把 `_renameRunnable` 清掉。`isRenamePossible` 看到它是 `undefined` 就允许再提议一次。两次 `apply` 可以叠在同一版本文档上；第一次的拒绝也不会变成这次命令的失败。

**方向：** `await` 这次 `apply`，在它结束之前不要清掉对应的 runnable。

### r02-3

**严重度：** 中

**症状：** 粘贴过程中点取消，可能先落入默认粘贴，随后 provider 编辑再写上来，文档里叠两份粘贴。

**代码：**

```411:436:src/vs/editor/contrib/dropOrPasteInto/browser/copyPasteController.ts
		this._pasteProgressManager.showWhile(selections[0].getEndPosition(), localize('pasteIntoEditorProgress', "Running paste handlers. Click to cancel and do basic paste"), p, {
			cancel: async () => {
				p.cancel();
				// A provider edit may already have landed. Undo exactly that element, then decide about
				// the default paste against the restored buffer rather than the stale editor-state
				// token, which its own write has already cancelled.
				const model = editor.getModel();
				if (!model) {
					return;
				}

				const top = this._undoRedoService.getElements(model.uri).past.at(-1);
				if (alternativeVersionIdBeforePaste === undefined) {
					return;
				}

				// Only undo an element this paste pushed. Anything else would be somebody else's edit.
				if (top && top !== topBeforePaste && model.getAlternativeVersionId() !== alternativeVersionIdBeforePaste) {
					await model.undo();
				}

				if (this._editor.getModel() !== model || model.getAlternativeVersionId() !== alternativeVersionIdBeforePaste) {
					return;
				}

				await this.applyDefaultPasteHandler(dataTransfer, metadata, CancellationToken.None, clipboardEvent);
			}
```

```249:263:src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts
		this._editor.focus();
		let editResult: IBulkEditResult;
		let editRange: Range | null;
		try {
			editResult = await this._bulkEditService.apply(combinedWorkspaceEdit, { editor: this._editor, token });
			editRange = model.getDecorationRange(editTrackingDecoration[0]);
		} catch (e) {
			return handleError(e, localize('applyError', "Error applying edit '{0}':\n{1}", edit.title, toErrorMessage(e)));
		} finally {
			model.deltaDecorations(editTrackingDecoration, []);
		}

		if (token.isCancellationRequested) {
			return;
		}
```

取消回调只调用了 `p.cancel()`，没有等待 `p` 结束。版本号还停在粘贴前时，它就直接走默认粘贴。此时 `applyEditAndShowIfNeeded` 可能正停在 `bulkEditService.apply` 上；这个 `await` 返回后如果 token 已取消，函数直接 return，已经写上的 provider 编辑不会撤掉。默认粘贴和这份编辑会先后落在同一缓冲上。

**方向：** 取消时先等这次粘贴 promise 结束，再按最终撤销栈决定要不要默认粘贴。

## 实际打开的文件

- `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/model/inlineSuggestionItem.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/model/renameSymbolProcessor.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/model/provideInlineCompletions.ts`
- `src/vs/editor/contrib/inlineCompletions/browser/utils.ts`
- `src/vs/editor/common/services/resolverService.ts`
- `src/vs/editor/browser/services/bulkEditService.ts`
- `src/vs/editor/common/model/editStack.ts`
- `src/vs/editor/common/model/textModel.ts`
- `src/vs/editor/common/services/modelService.ts`
- `src/vs/editor/contrib/dropOrPasteInto/browser/copyPasteController.ts`
- `src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts`
- `src/vs/editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.ts`
- `src/vs/editor/browser/widget/diffEditor/diffEditorWidget.ts`
- `src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts`
- `src/vs/editor/contrib/linkedEditing/browser/linkedEditing.ts`
- `src/vs/editor/contrib/snippet/browser/snippetController2.ts`
- `src/vs/editor/common/viewModel/viewModelLines.ts`
- `src/vs/editor/common/viewModel/viewModelImpl.ts`
