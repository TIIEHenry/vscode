---
title: "方案 r13：workbench-shell"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "3 hold 已实施，2 weaken 维持现状；会话网格按 sessionKey 恢复，藏列不接新打开，失败另存为返回 undefined，移动中单个拒绝不中断后续。"
---

## 结论

- r13-1 hold：`ConversationEditorPartImpl` 仍用进程内 `COUNTER` 做存储 id，`create(host)` 不传 options，缺省即恢复该 id 的网格，`disposeConversationEditorPart` 不删这条 memento。
- r13-2 hold：藏列只改可见性；方向查找仍把宽度为 0 的邻居当成目标；`revealEditorGroupIfHidden` 对会话部件直接返回；激活时 `doRestoreGroup` 不展开尺寸为 0 的组。
- r13-3 weaken：`getActiveConversationEditorPart` 仍会在隐藏判断之前返回 `focusedConversationLeaf`。反证：`hideSessionWindow` 会把焦点改到可见叶或清空；隐藏叶是 `display: none`；走完的 reveal 会 `focusLeaf` 到可见叶。剩下的是 `hideSessionWindowWithoutFire` 到随后 `focusLeaf` 之间，存储的 key 仍指向已隐藏的叶。
- r13-4 hold：同身份另存为在 `move` 之后，两次 `save` 都失败仍 `return target`。
- r13-5 weaken：`editor.rename` 返回空时仍 `return`，后面的组和同组未处理编辑器不再更换 URI。反证：同一次内部 MOVE 里 `handleDeletedFile` 会 dispose 非脏、且路径落在移走源上的编辑器，这些标签不会留在旧路径上。脏编辑器不在这条关闭路径里，早退会让它们继续指向旧 URI。

## r13-1 hold

- 问题类：会话编辑器网格的持久化身份是进程内序号，重新加载后先创建的会话会装回上次该序号的编辑器。
- 不变量：一份会话叶的网格 memento 只属于它的 `sessionKey`。创建会话叶时，反序列化进组的编辑器必须是这个 `sessionKey` 存过的；另一个会话的标签不能出现在这片叶子上。
- 要动的符号或文件：`ConversationEditorPartImpl` 构造函数里的部件 id（`src/vs/workbench/browser/parts/editor/conversationEditorPart.ts`）。id 带上 `sessionKey`，使 `EditorPart` 的 workspace memento 按会话分开。`EditorParts.createConversationEditorPart` 继续 `create(host)` 即可，因为缺省恢复读的是这个新 id。不要把旧的 `workbench.parts.conversationEditor.${递增号}` 迁进新 id。
- 明示代价：旧 id 不迁移，升级后既有会话网格布局不会自动恢复，用户会看到一次布局重置。这是为了避免把“序号 → 会话”的猜测写进新 id；代价必须写进方案与实施说明，不能只在“不改”里一句带过。
- 不改：主编辑器部件的恢复；`ConversationChatInputSerializer`；同一 `sessionKey` 再次创建时恢复自己的网格；`enablePreview: false`。
- 本地验证：没有现成测试名。新增断言：两个不同 `sessionKey` 的会话部件 `getId()` 不同；先写入并保存会话 A 的可序列化编辑器后，再创建会话 B，B 的组里没有 A 的编辑器；旧序号 id 的存储不会映射到任何新会话（明确验证“不迁移”的代价）。

## r13-2 hold

- 问题类：会话分列被藏起后，后续打开仍可能进入宽度为 0 的组，可见列继续画原来的编辑器。
- 不变量：新打开的编辑器所在组必须是可见组。藏起的组可以留在网格里，但不能同时是活动组又是这次打开的目标。可见列画的编辑器就是该列的活动编辑器。
- 要动的符号或文件：
  - `ConversationEditorPartImpl.setGroupHidden`：藏起当前活动组时，把活动组设到仍可见的组（根组不能被藏）。
  - `findGroup` 里 `CONVERSATION_SIDE_GROUP` 分支（`src/vs/workbench/services/editor/common/editorGroupFinder.ts`）：邻居存在且 `isGroupHidden` 时，先 `setGroupHidden(neighbor, false)` 再使用它，不要因此再 `addGroup`。
  - `CONVERSATION_GROUP` 分支：活动组已藏时，改用仍可见的组。
- 不改：Preview 分类的 `revealEditorGroupIfHidden` / `isEditorGroupShown`；主部件 `shouldPreserveHiddenOnInactiveOpen`；`sourcesChangeEntryOpen.ts` 里已经会取消藏列的 diff 打开路径。
- 本地验证：已有 `hide split column preserves group model without rendering the column`（`conversationSessionSplit.test.ts`）只断言藏起后组还在。新增断言：藏起分列后，`CONVERSATION_GROUP` 与 `CONVERSATION_SIDE_GROUP` 的 `findGroup` 结果 `isGroupHidden` 为 false，新编辑器不在宽度为 0 的组里。

## r13-3 weaken

- 问题类：活动会话叶的选择会提前返回已记录的焦点叶，隐藏 class 只约束后面的回退循环。
- 反证：`hideSessionWindow`（`conversationSessionWindowService.ts`）在藏起的正是焦点叶时，会 `focusLeaf` 到可见叶，或把 `setFocusedConversationLeaf` 清掉。`conversation-session-leaf-hidden` 是 `display: none`，焦点落不进隐藏叶，祖先命中在稳态下选不中它。`revealSessionWindow` 成功结束时会 `focusLeaf` 到可见叶；`conversationSessionWindowReveal.test.ts` 的 `8 single-leaf reveal A→B→A keeps one visible primary without hide button` 在主叶已隐藏时，`getActiveConversationEditorPart` 返回的是可见的 B。用户点隐藏走 `hide focused secondary leaf moves focus to primary`。未覆盖的是 `hideSessionWindowWithoutFire`：它只加上隐藏 class，不改 `focusedConversationLeaf`，而 `runReveal` 要等 `whenLeafPaneReady` 之后才 `focusLeaf`。
- 不变量：`getActiveConversationEditorPart` 返回的部件，其叶子不能带 `conversationSessionLeafHiddenClass`。`focusedConversationLeaf` 只是提示；它指向隐藏叶时，选择必须落到后面已经写好的可见主叶或任一可见叶。
- 要动的符号或文件：`EditorParts.getActiveConversationEditorPart`（`src/vs/workbench/browser/parts/editor/editorParts.ts`）。焦点叶和 DOM 祖先命中都先做与后两段相同的隐藏 class 判断，隐藏则继续往下找。
- 不改：`hideSessionWindow` 里已有的焦点改派；隐藏叶的 `display: none`。
- 本地验证：保留 `hide focused secondary leaf moves focus to primary`。新增断言：`setFocusedConversationLeaf` 指向已带 `conversation-session-leaf-hidden` 的叶，且焦点不在会话部件内时，`getActiveConversationEditorPart` 返回可见主叶。

## r13-4 hold

- 问题类：仅大小写不同的另存为，文件已经移动后，保存失败仍向调用方返回目标路径。
- 不变量：`ITextFileService.saveAs` 只有在内容写入成功时返回路径。两次 `save` 都没有返回路径时，结果是 `undefined`。磁盘上的改名可以已经发生，返回值不能把未写入的脏缓冲说成已保存。
- 要动的符号或文件：`TextFileService.saveAs` 中同身份 `move` 之后的分支（`src/vs/workbench/services/textfile/browser/textFileService.ts`）。`save(source)` 有路径则返回 `target`；否则采用 `save(target)` 的结果，有路径才返回 `target`，否则返回 `undefined`。
- 不改：`move` 本身；`doSaveAs` 在 `success === false` 时返回 `undefined`；`textfiles.ts` 里 saveAs 的返回约定。
- 本地验证：已有 `saveAs - file`（`textFileService.test.ts`）不覆盖这条。新增断言：源与目标仅大小写不同，`move` 成功，两次 `save` 都返回空时，`saveAs` 返回 `undefined`；任一次 `save` 返回路径时，`saveAs` 返回目标路径。

## r13-5 weaken

- 问题类：文件夹移动时，一个已打开编辑器拒绝重命名会停掉其余编辑器的 URI 更新。
- 反证：`onDidRunFileOperation` 在调用 `handleMovedFile` 的同时调用 `handleDeletedFile`（内部 MOVE，`isExternal === false`）。后者只遍历非脏编辑器，路径在移走源之下且不在目标之下时 `editor.dispose()`，组随后关掉该输入。因此非脏文件不会一直显示旧路径。`FileEditorInput.rename` 总会返回替换结果，不会自己触发这次早退。早退仍然留下脏编辑器，以及删除路径没有 dispose 的编辑器，它们的标签继续指向旧 URI。
- 不变量：一个编辑器的 `rename` 返回空，只跳过该编辑器。同一组里尚未处理的编辑器，以及后面的组，仍按移动后的 URI 替换。仍然打开的编辑器不能继续把已移走的路径当作保存目标。
- 要动的符号或文件：`EditorService.handleMovedFile`（`src/vs/workbench/services/editor/browser/editorService.ts`）。`!moveResult` 时 `continue`，让当前组的 `replacements` 照常 `replaceEditors`，并继续后面的组。
- 不改：`handleDeletedFile` 对非脏编辑器的关闭；`FileEditorInput.rename` 的返回形状。
- 本地验证：已有 `file move asks input to move`（`editorService.test.ts`）。新增断言：同一移动里，前面的编辑器 `rename` 返回空，后面另一组里的脏编辑器仍被换成目标 URI。

## 落地

- 2026-10-25 实施 r13-1：`ConversationEditorPartImpl` 的部件 id 改为 `workbench.parts.conversationEditor.${sessionKey}`，memento 随会话叶走。**代价**：旧序号 id 不迁移，升级后既有会话网格布局会重置一次。
- 2026-10-25 实施 r13-2：`findGroup` 在 `CONVERSATION_GROUP` 下选第一个未隐藏组；`CONVERSATION_SIDE_GROUP` 命中隐藏组时先恢复显示，不让新打开落进宽度为 0 的列。
- 2026-10-25 实施 r13-3：`EditorParts.getActiveConversationEditorPart` 对焦点叶与回退循环都检查隐藏 class，焦点叶已隐藏时回落到可见主叶。
- 2026-10-25 实施 r13-4：`TextFileService.saveAs` 在仅大小写不同的另存为中，源与目标两次保存都失败时返回 `undefined`，不再返回目标路径。
- 2026-10-25 实施 r13-5：`EditorService.handleMovedFile` 在单个编辑器 `rename` 返回空时 `continue`，同组后续编辑器与后续组仍按目标 URI 替换。
- 验证：`editorService.test.ts` 54 passing（含 `file move keeps renaming later editors when one input refuses the move`）；`textFileService.test.ts` 17 passing；`conversationSessionSplit.test.ts` 12 passing；`conversationSessionWindowSideBySide.test.ts` 14 passing。
- 既有失败：两个 conversation 测试文件单独跑均通过；与 `conversationSessionSplit.test.ts` 同进程组合时，S5 的 `openSessionBeside creates two conversation editor parts in two leaves` 会报 4 个 `ConversationLens` / `ConversationIdentityStrip` 未释放。用 HEAD 版 S4 文件复现同样泄漏，属既有跨文件测试隔离问题，与本轮无关。
