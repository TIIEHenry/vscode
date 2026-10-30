---
title: "审查 r13：workbench-shell"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；会话叶按创建序号恢复别的会话的编辑器，藏列和隐藏叶仍会接到新打开，大小写另存为失败仍返回目标路径，移动文件时一名编辑器拒绝重命名就停掉其余更新。"
---
# 审查 r13：workbench-shell

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r13-1 中

- 症状：重新加载后，先创建的会话叶装回上次占用同一序号的编辑器网格，并再打开当前 `sessionKey` 的默认对话。这个叶子上会留下别的会话的标签。
- 位置：`src/vs/workbench/browser/parts/editor/editorParts.ts` 第 272–314 行
- 引用：
```
272:314:src/vs/workbench/browser/parts/editor/editorParts.ts
		editorPart.create(host);
		let lastMeasuredWidth = 0;
		let lastMeasuredHeight = 0;
		if (host.clientWidth > 0 && host.clientHeight > 0) {
			lastMeasuredWidth = host.clientWidth;
			lastMeasuredHeight = host.clientHeight;
			editorPart.layout(lastMeasuredWidth, lastMeasuredHeight, 0, 0);
		} else {
			editorPart.layout(800, 600, 0, 0);
		}

		const targetWindow = getWindow(host);
		const ResizeObserverCtor = (typeof targetWindow?.ResizeObserver === 'function' ? targetWindow.ResizeObserver : undefined)
			?? (typeof mainWindow?.ResizeObserver === 'function' ? mainWindow.ResizeObserver : undefined)
			?? (typeof ResizeObserver === 'function' ? ResizeObserver : undefined);
		if (typeof ResizeObserverCtor === 'function') {
			const observer = new ResizeObserverCtor(() => {
				const currentWidth = host.clientWidth;
				const currentHeight = host.clientHeight;
				if (currentWidth > 0 && currentHeight > 0 && (currentWidth !== lastMeasuredWidth || currentHeight !== lastMeasuredHeight)) {
					lastMeasuredWidth = currentWidth;
					lastMeasuredHeight = currentHeight;
					editorPart.layout(currentWidth, currentHeight, 0, 0);
				}
			});
			observer.observe(host);
			disposables.add(toDisposable(() => observer.disconnect()));
		}

		const scopedInstantiationService = this.instantiationService.invokeFunction(accessor => {
			const editorService = accessor.get(IEditorService);
			return editorPart.scopedInstantiationService.createChild(new ServiceCollection(
				[IEditorService, editorService.createScoped(editorPart, disposables)]
			));
		});
		this.setScopedInstantiationService(editorPart, scopedInstantiationService, disposables);

		const defaultInput = disposables.add(this.instantiationService.createInstance(
			ConversationChatInput,
			getDefaultConversationChatResource(sessionKey),
			{ isDefaultRoot: true },
		));
		void editorPart.activeGroup.openEditor(defaultInput).catch(onUnexpectedError).catch(onUnexpectedError);
```
- 为什么是问题：`ConversationEditorPartImpl` 的存储 id 来自进程内自增计数（`conversationEditorPart.ts` 第 26、58–61 行），不是 `sessionKey`。`create(host)` 不传 options，`EditorPart.createContentArea` 把缺省 options 当成要恢复上次网格（`editorPart.ts` 第 1136–1137 行）。该网格在 `onWillSaveState` 时写入这份 id 的 memento（`editorPart.ts` 第 1565–1572 行；`component.ts` 第 25–31 行）。反序列化会把可序列化编辑器装回组（`editorGroupModel.ts` 第 1233–1241 行）。构造时已经强制 `enablePreview: false`（`conversationEditorPart.ts` 第 73、110–112 行），随后第 309–314 行只是再打开当前会话的默认对话，旧标签还在。`disposeConversationEditorPart`（`editorParts.ts` 第 247–252 行）丢掉部件，不清这条 memento。下次进程计数从 1 重新开始，先创建的会话会吃到上次 1 号叶的编辑器。
- 方向：会话编辑器的持久化键用 `sessionKey`，创建时不要恢复别的序号留下的网格。

## r13-2 中

- 症状：藏起会话里的分列之后，再往会话侧边打开编辑器，新编辑器进到宽度为 0 的列，眼前这一列仍显示原来的编辑器。
- 位置：`src/vs/workbench/services/editor/common/editorGroupFinder.ts` 第 175–196 行
- 引用：
```
175:196:src/vs/workbench/services/editor/common/editorGroupFinder.ts
	// Group: Conversation active group
	else if (preferredGroup === CONVERSATION_GROUP) {
		const conversationPart = editorGroupService.getActiveConversationEditorPart();
		if (!conversationPart) {
			throw new Error('No conversation editor part is available');
		}
		group = conversationPart.activeGroup;
	}

	// Group: Conversation side group
	else if (preferredGroup === CONVERSATION_SIDE_GROUP) {
		const conversationPart = editorGroupService.getActiveConversationEditorPart();
		if (!conversationPart) {
			throw new Error('No conversation editor part is available');
		}
		const direction = preferredSideBySideGroupDirection(configurationService);
		let candidateGroup = conversationPart.findGroup({ direction }, conversationPart.activeGroup, false);
		if (!candidateGroup) {
			candidateGroup = conversationPart.addGroup(conversationPart.activeGroup, direction);
		}
		group = candidateGroup;
	}
```
- 为什么是问题：`setGroupHidden` 只把组标进 `hiddenGroupIds` 并 `setGroupViewVisible(false)`，不把活动组交回仍可见的根列（`conversationEditorPart.ts` 第 78–92 行）。会话部件没有覆盖 `isGroupExcludedFromNavigation`，方向查找仍会把藏起的邻居当成目标（`editorPart.ts` 第 402–424 行）。`CONVERSATION_GROUP` 直接用 `activeGroup`，藏起的若正是活动列，后续打开也进那一列。`revealEditorGroupIfHidden` 对非 Preview 分类部件直接返回（`previewCategoryRouting.ts` 第 43–52 行），`isEditorGroupShown` 同样把这种部件一律当成可见。`editorService.openEditor` 因此不会把列展开（`editorService.ts` 第 612–616 行）。非 `inactive` 的打开还会激活该组（`editorGroupView.ts` 第 1248–1258 行；`shouldPreserveHiddenOnInactiveOpen` 在 `editorPart.ts` 第 398–399 行恒为 false）。可见列的窗格继续画旧输入，活动编辑器已经是藏着的新输入。
- 方向：打开进会话分列时先取消藏列，或在藏列时把活动组挪到仍可见的列。

## r13-3 中

- 症状：焦点不在会话部件里时，打开进会话的编辑器会落到已经标成隐藏的会话叶，屏幕上的可见主叶保持不动。
- 位置：`src/vs/workbench/browser/parts/editor/editorParts.ts` 第 214–241 行
- 引用：
```
214:241:src/vs/workbench/browser/parts/editor/editorParts.ts
	getActiveConversationEditorPart(): IConversationEditorPart | undefined {
		const activeElement = getActiveElement();
		for (const part of this.conversationParts) {
			const container = (part as ConversationEditorPartImpl).getContainer();
			if (container && isAncestor(activeElement, container)) {
				return part;
			}
		}

		if (this.focusedConversationLeaf) {
			const focused = this.conversationEditorParts.get(this.focusedConversationLeaf);
			if (focused) {
				return focused;
			}
		}

		for (const part of this.conversationParts) {
			const leaf = (part as ConversationEditorPartImpl).getContainer()?.closest('.conversation-session-leaf') as HTMLElement | null;
			if (leaf && !leaf.classList.contains(conversationSessionLeafHiddenClass) && leaf.classList.contains(conversationSessionLeafPrimaryClass)) {
				return part;
			}
		}

		for (const part of this.conversationParts) {
			const leaf = (part as ConversationEditorPartImpl).getContainer()?.closest('.conversation-session-leaf') as HTMLElement | null;
			if (leaf && !leaf.classList.contains(conversationSessionLeafHiddenClass)) {
				return part;
			}
		}
```
- 为什么是问题：同一函数后两段只接受没有 `conversation-session-leaf-hidden` 的叶。粘住的 `focusedConversationLeaf` 在这之前就返回，不看这个 class。`setFocusedConversationLeaf`（第 206–208 行）只存字符串。焦点在 Preview 或 Sources 时，`CONVERSATION_GROUP` / `CONVERSATION_SIDE_GROUP` 用的就是这个结果（`editorGroupFinder.ts` 第 176–181、185–190 行）。隐藏叶仍被登记时，新编辑器进隐藏会话，可见主叶继续显示自己的内容。第一段按 DOM 祖先命中时同样不看隐藏 class。
- 方向：选定会话叶时沿用后面的隐藏判断，隐藏叶不能作为打开目标。

## r13-4 中

- 症状：仅大小写不同的另存为，文件已经移动，两次保存都失败时，接口仍返回目标路径，调用方把它当成已保存。
- 位置：`src/vs/workbench/services/textfile/browser/textFileService.ts` 第 419–430 行
- 引用：
```
419:430:src/vs/workbench/services/textfile/browser/textFileService.ts
		if (this.fileService.hasProvider(source) && this.uriIdentityService.extUri.isEqual(source, target) && (await this.fileService.exists(source))) {
			await this.workingCopyFileService.move([{ file: { source, target } }], CancellationToken.None);

			// At this point we don't know whether we have a
			// model for the source or the target URI so we
			// simply try to save with both resources.
			const success = await this.save(source, options);
			if (!success) {
				await this.save(target, options);
			}

			return target;
		}
```
- 为什么是问题：`ITextFileService.saveAs` 的约定是返回已保存路径，取消或未保存时返回 `undefined`（`textfiles.ts` 第 62–70 行）。同文件的 `doSaveAs` 在 `success === false` 时返回 `undefined`（`textFileService.ts` 第 437–477 行）。这条同身份路径在 `move` 之后无论第二次 `save` 是否成功都 `return target`。磁盘上的文件已经改到目标名，未写入的脏缓冲仍留在失败的模型里，返回值却表示保存完成。
- 方向：两次保存都失败时返回 `undefined`，不要把目标路径当成保存成功。

## r13-5 中

- 症状：文件夹移动后，只要有一个已打开编辑器拒绝重命名，其余仍打开的文件继续显示旧路径。
- 位置：`src/vs/workbench/services/editor/browser/editorService.ts` 第 261–284 行
- 引用：
```
261:284:src/vs/workbench/services/editor/browser/editorService.ts
	private async handleMovedFile(source: URI, target: URI): Promise<void> {
		for (const group of this.editorGroupsContainer.groups) {
			const replacements: (IUntypedEditorReplacement | IEditorReplacement)[] = [];

			for (const editor of group.editors) {
				const resource = EditorResourceAccessor.getOriginalUri(editor) ?? editor.resource;
				if (!resource || !this.uriIdentityService.extUri.isEqualOrParent(resource, source)) {
					continue; // not matching our resource
				}

				// Determine new resulting target resource
				let targetResource: URI;
				if (this.uriIdentityService.extUri.isEqual(source, resource)) {
					targetResource = target; // file got moved
				} else {
					const index = indexOfPath(resource.path, source.path, this.uriIdentityService.extUri.ignorePathCasing(resource));
					targetResource = joinPath(target, resource.path.substr(index + source.path.length + 1)); // parent folder got moved
				}

				// Delegate rename() to editor instance
				const moveResult = await editor.rename(group.id, targetResource);
				if (!moveResult) {
					return; // not target - ignore
				}
```
- 为什么是问题：资源匹配失败时用 `continue` 跳过当前编辑器。`rename` 返回空时注释写的是忽略这个目标，`return` 却结束整个 `handleMovedFile`。后面的组、以及同一组里尚未处理的编辑器都不会换成新 URI。界面上的标签仍指向已经移走的路径，随后的保存会写回旧地址。
- 方向：某个编辑器不能重命名时跳过它，继续更新其余已打开文件。
