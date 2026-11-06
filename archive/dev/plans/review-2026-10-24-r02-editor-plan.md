---
title: "方案 r02：editor"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "4 hold 已实施，1 weaken 维持现状；共享撤销栈不再错绑，重命名过期作废，补全光标随附加编辑移动，换粘贴类型只撤本次元素。"
---
# 方案 r02：editor

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核查

- r02-1 hold：`_createModelData` 在哈希不一致且 `sharesUndoRedoStack` 时仍 `setModel` 到新模型并 `setElementsValidFlag(true)`，版本号不恢复；`_applyUndo` / `_applyRedo` 按旧偏移写入当前缓冲。
- r02-2 hold：重命名命令只在 `await getWorkspaceEdit()` 之前调用 `isValid`；`getResult` 不看文档版本，NES 的 `ResourceTextEdit` 没有 `versionId`。
- r02-3 hold：接受补全时选区只由 `minimalEdits` 算出，提交的却是主编辑加 `additionalTextEdits`。
- r02-4 hold：`onDidSelectEdit` `await model.undo()` 之后无条件 `applyEditAndShowIfNeeded`，用闭包里的旧 `ranges` 写当前模型。
- r02-5 weaken：已写入并改过当前编辑器内容后，取消回调会因 `editorStateCts` 已取消而在默认粘贴前返回，不会把两份粘贴叠在同一选区；已落地的提供方编辑仍然不撤回。

## r02-1 hold

- 问题类：共享撤销栈在正文哈希不一致时仍把旧编辑绑到新模型并标为有效。
- 不变量：撤销元素的事实在撤销栈里，缓冲的事实在新模型里。只有 SHA1 与 dispose 时的快照一致，才允许把 `SingleModelEditStackElement` 指到新模型、标为有效，并恢复 `versionId` / `alternativeVersionId`。哈希不一致时，旧 `TextChange` 偏移不得通过 `_applyUndo` / `_applyRedo` 写入新缓冲。
- 要动的符号或文件：`ModelService._createModelData`。把 `sha1IsEqual || sharesUndoRedoStack` 拆开：仅 `sha1IsEqual` 时保持现在的重绑、`setElementsValidFlag(true)` 和版本恢复。`sharesUndoRedoStack && !sha1IsEqual` 时不要 `setModel(新模型)`，不要把这些元素重新标为有效，也不要 `restoreSnapshot`。同一比较键上其他 URI 的元素必须留在栈上。只摘掉 `matchesResource` 为这个 URI 的资源元素；工作区元素里该 URI 的子元素保持 dispose 时的 `setModel(uri)`，撤销时跳过该 URI。跳过时不要抛 `Invalid SingleModelEditStackElement` 把同一次撤销里其他 URI 打断，也不要靠「元素无效」走到 `UndoRedoService._resourceUndo` 的 `flushAllElements`。
- 不改：哈希相同的重绑与版本恢复；非共享栈且哈希不同时的 `restoreSnapshot`；`_applyUndo` / `_applyRedo` 的偏移换算。
- 本地验证：保留 `modelService.test.ts` 的 `maintains undo for same resource and same content`、`maintains version id and alternative version id for same resource and same content`、`does not maintain undo for same resource and different content`。新增：两个 URI 共用比较键，其中一个 dispose 后用不同正文重建，撤销不得改写新正文，另一个 URI 的撤销元素仍在。

## r02-2 hold

- 问题类：内联补全的重命名在等待工作区编辑期间不再核对焦点和文档版本。
- 不变量：`RenameSymbolRunnable` 持有发起时的 `EditorState`（焦点编辑器与 `versionId`）。`bulkEditService.apply` 只能在这个状态仍然成立时调用。过期范围不得写进已经变化的文档。
- 要动的符号或文件：`renameSymbolCommandId` 的命令回调，在 `await renameRunnable.getWorkspaceEdit()` 之后、`apply` 之前再调用 `isValid`，失败则返回。`RenameSymbolRunnable.sendNesRenameRequest` 构造的、以及 `getWorkspaceEdit` 返回的、资源等于该模型且缺少 `versionId` 的 `ResourceTextEdit`，写上 `EditorState` 里捕获的 `versionId`，让 `BulkTextEdits._validateBeforePrepare` / `ModelEditTask.validate` 在写入前拒绝。盖章用捕获的版本，不用 `apply` 前一刻的当前版本。
- 不改：`isRenamePossible` 在提议阶段的状态检查；`getResult` 对取消令牌和 `rejectReason` 的处理；重命名推理本身。
- 本地验证：`renameSymbolProcessor.test.ts` 只覆盖 `RenameInferenceEngine`。新增：`getWorkspaceEdit` 仍未完成时改变 `versionId` 或焦点，命令不得调用 `apply`；NES 编辑带捕获的 `versionId`，模型版本已经变化时 `BulkTextEdits` 不得写入。

## r02-3 hold

- 问题类：接受带 `additionalTextEdits` 的内联补全时，光标停在附加编辑生效前的坐标上。
- 不变量：光标位置由实际提交的那份 `TextEdit` 决定。主编辑的结尾必须先经过附加编辑造成的位移，再交给 `setSelections`。
- 要动的符号或文件：`InlineCompletionsModel.accept` 中 `state.kind === 'ghostText'` 分支里计算 `selections` 的位置（现为 `getEndPositionsAfterApplying(minimalEdits)`）。用已经交给 `editor.edit` 的那份编辑（`edits` 与 `additionalTextEdits`）做位置映射，只取主编辑的新结尾。ghost text 仍是每个主编辑一个光标；inline edit 仍取主编辑序列的最后一个。`completion.hint !== undefined` 时仍不移动光标。
- 不改：`editor.edit` 的编辑内容；`snippetInfo` 分支；`removeTextReplacementCommonSuffixPrefix` 对主编辑公共前后缀的剥离。
- 本地验证：保留 `inlineCompletions.test.ts` 的 `Additional Text Edits`。新增：附加编辑在补全上方插入一行，接受后光标在下移后的补全结尾，不在插入前的行号上。

## r02-4 hold

- 问题类：更换粘贴或拖放类型时，撤销的是栈顶元素，返回后仍用旧选区写当前模型。
- 不变量：这次粘贴写入的撤销元素是「上一份编辑」的事实；当时的模型和选区只对那份缓冲有效。新类型只能写回同一个模型，并且只能在该元素已经被撤销、`alternativeVersionId` 回到粘贴前之后写入。
- 要动的符号或文件：`PostEditWidgetManager.applyEditAndShowIfNeeded` 里的 `onDidSelectEdit`。成功 `apply` 后记下模型对象、粘贴前的 `alternativeVersionId`，以及 `IUndoRedoService.getElements(uri).past` 的最后一项。选择新类型时：当前模型不是该对象，或栈顶不是该元素，则返回，不要 `undo`。`await undo()` 之后再次核对模型；栈顶仍是该元素，或 `alternativeVersionId` 不是粘贴前的值，则不要调用 `applyEditAndShowIfNeeded`。工作区撤销对话框取消时走这条拒绝路径。`PostEditWidgetManager` 需要注入 `IUndoRedoService`；`createInstance` 的现有参数不用加。
- 不改：粘贴编辑的组合方式 `createCombinedWorkspaceEdit`；模型或正文变化时 `clear()` 控件；首次粘贴的应用。
- 本地验证：`dropOrPasteInto` 下没有覆盖该回调的测试。新增：栈顶不是这次粘贴时不得撤销其他元素，也不得写入；撤销对话框取消或 `await` 期间换成另一个模型时，不得用旧 `ranges` 写入；栈顶仍是这次粘贴且撤销成功时，新类型写在恢复后的原选区。

## r02-5 weaken

- 问题类：粘贴进度在提供方编辑已经写入之后取消，该编辑不会撤回。
- 不变量：进度上的取消表示这次提供方粘贴不得保持为已执行。默认粘贴只在该编辑已经不在文档里时写入。取消本身不得被记成一次成功的提供方粘贴。
- 反证：`EditorStateCancellationTokenSource` 在 `CodeEditorStateFlag.Value | Selection` 下同步监听 `onDidChangeModelContent`。提供方编辑一旦改过当前编辑器，`editorStateCts` 已经取消，取消回调在 `applyDefaultPasteHandler` 之前返回。`applyDefaultPasteHandler` 读完剪贴板后会再查这个令牌。`BulkTextEdits.apply` 在 `await _createEditsTasks()` 之后检查操作令牌，然后同步 `task.apply`。点击取消插不进这次检查和写入之间。因此「已落地的提供方编辑」和「默认粘贴」不会叠在当前选区上。仍成立的是：写入已经发生时，`p.cancel()` 只拒绝外层 Promise 并取消令牌，`applyEditAndShowIfNeeded` 在 `apply` 之后看到取消只是 return，不撤销。
- 要动的符号或文件：`CopyPasteController.doPasteInline` 的进度 `cancel`。先 `p.cancel()`，再等 `p` 结束并吞掉取消错误。若这次粘贴已经把撤销元素压栈，撤销的是该元素，不是当时的任意栈顶。撤回之后再决定默认粘贴。这次提供方写入自己会取消 `editorStateCts`；撤回后的默认粘贴不要把这个令牌当成用户另一次编辑。用粘贴开始时的模型身份，以及撤回后 `alternativeVersionId` 是否回到粘贴前，决定能不能 `applyDefaultPasteHandler`。
- 不改：提供方尚未通过 `BulkTextEdits` 令牌检查时的取消（该路径继续只做默认粘贴）；`dropIntoEditorController` 只取消、不补默认粘贴的回调；`applyEditAndShowIfNeeded` 在令牌取消于 resolve 之前的提前返回。
- 本地验证：没有对应测试。新增：提供方编辑已经写入后取消，文档回到粘贴前，然后才插入默认文本；写入尚未发生时取消，只有默认文本，没有提供方编辑。

## 落地

- 2026-10-25 实施 r02-1：`ModelService._createModelData` 只在哈希一致时把旧编辑栈绑到新模型并恢复版本号；哈希不一致但共享撤销栈时，元素留在 URI 上并标为有效，撤销 / 重做跳过它们，不再按旧偏移写入。`SingleModelEditStackElement.undo` / `redo` 在模型仍是 URI 时安静返回，不中断同组其它资源。
- 2026-10-25 实施 r02-2：`RenameSymbolRunnable` 暴露计算时的 `versionId`；工作区编辑返回后先 `isValid` 再 `apply`，文档或焦点已变则放弃。当前文件的 `ResourceTextEdit` 带上该版本号。
- 2026-10-25 实施 r02-3：接受内联补全时，光标位置按实际提交的主编辑加附加编辑一起映射，再截回主编辑数量；附加编辑在补全上方插行时光标随之下移。
- 2026-10-25 实施 r02-4：`PostEditWidgetManager` 记住粘贴前的 `alternativeVersionId` 和本次粘贴的撤销元素；切换类型只撤这个元素，模型或栈顶已变则不写旧范围。
- r02-5 维持现状：`CopyPasteController.doPasteInline` 的进度取消先 `p.cancel()`，只撤本次粘贴压入的元素，再按恢复后的版本决定默认粘贴；提供方尚未写入时仍只做默认粘贴。
- 验证：`modelService.test.ts`、`renameSymbolProcessor.test.ts`、`postEditWidget.test.ts` 合计 43 passing；新增 `Additional Text Edits - cursor follows the shifted completion` 通过。
- 既有失败：`inlineCompletions.test.ts` 的 `No race conditions`、`Push item to preserve to front` 以及随之的 `LanguagesRegistry` 泄漏；HEAD 版测试同样失败，与本轮无关。
