---
title: "审查 r02：editor"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；共享撤销栈、内联重命名、补全光标、更换粘贴类型和取消粘贴会把编辑写到错误内容或在取消后仍提交。"
---

## r02-1 高

- 症状：同一 URI 以不同正文再次建模型，且该 URI 与其他资源共享撤销栈时，撤销/重做会按旧偏移改写新正文。
- 位置：`src/vs/editor/common/services/modelService.ts` 第 325–341 行
- 引用：

```325:341:src/vs/editor/common/services/modelService.ts
			if (sha1IsEqual || disposedModelData.sharesUndoRedoStack) {
				for (const element of elements.past) {
					if (isEditStackElement(element) && element.matchesResource(resource)) {
						element.setModel(model);
					}
				}
				for (const element of elements.future) {
					if (isEditStackElement(element) && element.matchesResource(resource)) {
						element.setModel(model);
					}
				}
				this._undoRedoService.setElementsValidFlag(resource, true, (element) => (isEditStackElement(element) && element.matchesResource(resource)));
				if (sha1IsEqual) {
					model._overwriteVersionId(disposedModelData.versionId);
					model._overwriteAlternativeVersionId(disposedModelData.alternativeVersionId);
					model._overwriteInitialUndoRedoSnapshot(disposedModelData.initialUndoRedoSnapshot);
				}
```

- 为什么是问题：哈希不一致时仍把旧 `SingleModelEditStackElement` 指到新模型并标为有效，版本号却只在哈希相同才恢复。`textModel.ts` 第 1441–1472 行的 `_applyUndo` / `_applyRedo` 不核对 `alternativeVersionId`，直接用旧 `TextChange` 的偏移在当前缓冲上落编辑。内容不同的非共享栈会丢掉撤销；共享栈这条路径把旧编辑写进新正文。
- 方向：正文与快照不一致时，保持这些元素无效，不要重新绑到新模型。

## r02-2 高

- 症状：内联补全的重命名在文档版本或焦点已经变了之后，仍提交按旧正文算出的工作区编辑。
- 位置：`src/vs/editor/contrib/inlineCompletions/browser/model/renameSymbolProcessor.ts` 第 437–447 行
- 引用：

```437:447:src/vs/editor/contrib/inlineCompletions/browser/model/renameSymbolProcessor.ts
		this._register(CommandsRegistry.registerCommand(renameSymbolCommandId, async (_: ServicesAccessor, source: TextModelEditSource, renameRunnable: RenameSymbolRunnable | undefined) => {
			if (renameRunnable === undefined || !renameRunnable.isValid(this._codeEditorService)) {
				return;
			}

			try {
				const workspaceEdit = await renameRunnable.getWorkspaceEdit();
				if (workspaceEdit === undefined) {
					return;
				}
				bulkEditService.apply(workspaceEdit, { reason: source });
```

- 为什么是问题：`isValid`（第 363–365 行）要求焦点编辑器仍是该模型且 `versionId` 未变，但只在 `await` 之前调用。`getResult`（第 387–397 行）只看取消令牌；文档变化不会取消请求。`sendNesRenameRequest` 构造的 `ResourceTextEdit` 不带 `versionId`。等待期间用户输入或切走焦点后，旧范围仍会写回去。
- 方向：`getWorkspaceEdit` 返回后再次 `isValid`，失败就不要 `apply`。

## r02-3 中

- 症状：接受带 `additionalTextEdits` 的内联补全后，光标落在附加编辑生效前的坐标上。
- 位置：`src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts` 第 972–984 行
- 引用：

```972:984:src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts
					if (state.kind === 'ghostText') {
						minimalEdits = removeTextReplacementCommonSuffixPrefix(edits, this.textModel);
					}
					const selections = getEndPositionsAfterApplying(minimalEdits).map(p => Selection.fromPositions(p));

					const additionalEdits = completion.additionalTextEdits.map(e => new TextReplacement(Range.lift(e.range), e.text ?? ''));
					const edit = TextEdit.fromParallelReplacementsUnsorted([...edits, ...additionalEdits]);

					editor.edit(edit, this._getMetadata(completion, this.textModel.getLanguageId()));

					if (completion.hint === undefined) {
						// do not move the cursor when the completion is displayed in a different location
						editor.setSelections(state.kind === 'inlineEdit' ? selections.slice(-1) : selections, 'inlineCompletionAccept');
```

- 为什么是问题：选区只按 `minimalEdits` 计算，真正提交的是 `edits` 加上 `additionalTextEdits`。附加编辑在补全上方插入行（例如补 import）后，补全所在行已经下移，`setSelections` 仍用旧行号。
- 方向：用包含附加编辑的那份 `TextEdit` 计算接受后的光标。

## r02-4 中

- 症状：更换粘贴或拖放类型时，可能撤掉另一次编辑，再用当初的选区写到当前模型。
- 位置：`src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts` 第 183–191 行
- 引用：

```183:191:src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts
		const onDidSelectEdit = async (newEditIndex: number) => {
			const model = this._editor.getModel();
			if (!model) {
				return;
			}

			await model.undo();
			this.applyEditAndShowIfNeeded(ranges, { activeEditIndex: newEditIndex, allEdits: edits.allEdits }, canShowWidget, resolve, token);
		};
```

- 为什么是问题：`undo()` 可以返回 Promise。等待期间栈顶未必还是这次粘贴，编辑器也可能已换模型。返回后无条件再次进入 `applyEditAndShowIfNeeded`，该方法第 177 行重新读取当前模型，第 218 行用闭包里的旧 `ranges` 给这个模型组编辑。
- 方向：只撤销这次粘贴对应的元素，并在应用前确认编辑器模型未换。

## r02-5 中

- 症状：在粘贴进度上取消后，默认粘贴仍会插入；已经提交的提供方编辑不会撤回。
- 位置：`src/vs/editor/contrib/dropOrPasteInto/browser/copyPasteController.ts` 第 406–412 行
- 引用：

```406:412:src/vs/editor/contrib/dropOrPasteInto/browser/copyPasteController.ts
			cancel: async () => {
				p.cancel();
				if (editorStateCts.token.isCancellationRequested) {
					return;
				}

				await this.applyDefaultPasteHandler(dataTransfer, metadata, editorStateCts.token, clipboardEvent);
```

- 为什么是问题：`p.cancel()` 取消令牌并拒绝外层 Promise，不会让已经通过令牌检查、正在 `applyEditAndShowIfNeeded` 里提交的编辑回滚。取消回调不等待该操作结束，随即调用 `applyDefaultPasteHandler`。提供方编辑和默认粘贴可以叠在同一选区上。
- 方向：取消后先等原操作结束并撤回已落地的粘贴，再决定是否插入默认文本。
