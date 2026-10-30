---
title: "十六路审查 r09：workbench 壳发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "只读审查 workbench 壳的布局、部件生命周期与焦点，发现 5 条。"
---
# 十六路审查 r09：workbench 壳发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围是 `src/vs/workbench/browser`、`common`、`electron-browser`、`test`，以及 `src/vs/workbench` 根目录的 `*.ts`。下面 5 条都来自这次读到的实现。

### r09-1

**严重度：** 中

**症状：** Preview 和 Sources 都藏起来之后，壳把末列隐藏当成面板已最大化。这时再藏起对话，对话、Preview、Sources 会同时不可见；再关闭面板，则会按一份旧的最大化快照把 Preview 和 Sources 重新打开。

**代码：**

```2497:2501:src/vs/workbench/browser/layout.ts
	isPanelMaximized(): boolean {
		return (
			this.getPanelAlignment() === 'center' || 	// the workbench grid currently prevents us from supporting panel
			!isHorizontal(this.getPanelPosition())		// maximization with non-center panel alignment
		) && this.isEndColumnHidden() && !this.isAuxiliaryBarMaximized();
```

```2934:2936:src/vs/workbench/browser/layout.ts
	private isEndColumnHidden(): boolean {
		return this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN) && this.stateModel.getRuntimeValue(LayoutStateKeys.SOURCES_HIDDEN);
	}
```

```2103:2106:src/vs/workbench/browser/layout.ts
	private enforceAgentShellVisible(justHid: AgentShellPart, visible: IAgentShellVisibility = this.getAgentShellVisibility()): void {
		if (this.inMaximizedAuxiliaryBarTransition || this.isAuxiliaryBarMaximized() || this.inMaximizedPanelTransition || this.isPanelMaximized()) {
			return;
		}
```

```2058:2060:src/vs/workbench/browser/layout.ts
		if (hidden && beforeHide) {
			this.enforceAgentShellVisible(Parts.CONVERSATION_PART, this.getAgentShellVisibilityAfterHide(Parts.CONVERSATION_PART, beforeHide));
		}
```

```2348:2351:src/vs/workbench/browser/layout.ts
		// If maximized and in process of hiding, unmaximize FIRST before
		// changing visibility so the End column (Editor/Sources) is restored first.
		if (hidden && isPanelMaximized) {
			this.toggleMaximizedPanel();
```

```2551:2557:src/vs/workbench/browser/layout.ts
		} else {
			const state = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_VISIBILITY);
			this.inMaximizedPanelTransition = true;
			try {
				this.setEditorHidden(!(state?.editorVisible ?? true));
				this.setSourcesHidden(!(state?.sourcesVisible ?? true));
```

```3315:3318:src/vs/workbench/browser/layout.ts
	PANEL_LAST_NON_MAXIMIZED_VISIBILITY: new RuntimeStateKey('panel.lastNonMaximizedVisibility', StorageScope.WORKSPACE, StorageTarget.MACHINE, {
		editorVisible: true,
		sourcesVisible: true,
		panelVisible: true,
```

```3336:3336:src/vs/workbench/browser/layout.ts
	PANEL_ALIGNMENT: new RuntimeStateKey<PanelAlignment>('panel.alignment', StorageScope.PROFILE, StorageTarget.USER, 'center'),
```

**为什么是问题：** 默认面板对齐是 `center`，所以只要 Preview 和 Sources 同时隐藏，`isPanelMaximized()` 就是 true。`setConversationHidden` 先把对话标成隐藏，再调用 `enforceAgentShellVisible`；该函数看到“已最大化”就返回，注释要求的「对话、Preview、Sources 至少留一块」不会补回。`ensureAgentShellMinimumVisible` 用同一条件返回，之后的 `layout()` 也不会补。关闭面板时若这个判断为 true，会先走 `toggleMaximizedPanel` 的恢复分支；快照缺省把 `editorVisible` 和 `sourcesVisible` 当成 true，于是把用户刚藏起的末列重新打开。用户藏末列并没有进入面板最大化。

**方向：** 面板最大化单独记状态；末列只是被用户藏起时，仍执行至少留一块可见的补回，关闭面板不要按最大化快照把末列打开。

### r09-2

**严重度：** 中

**症状：** 末列整列不可见时保存布局（面板最大化、禅模式，或 Preview 与 Sources 都已隐藏），下次启动末列宽度变成 Sources 的分割高度。

**代码：**

```1808:1825:src/vs/workbench/browser/layout.ts
			// Editor column size (End column width; shared with Sources)
			const editorHidden = this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN);
			const sourcesHidden = this.stateModel.getRuntimeValue(LayoutStateKeys.SOURCES_HIDDEN);
			const endColumnHidden = editorHidden && sourcesHidden;
			const endColumnView = editorHidden ? this.sourcesPartView : this.editorPartView;
			const editorSize = endColumnHidden
				? this.workbenchGrid.getViewCachedVisibleSize(endColumnView)
				: this.workbenchGrid.getViewSize(endColumnView).width;
			this.stateModel.setInitializationValue(LayoutStateKeys.EDITOR_SIZE, editorSize as number);

			// Sources height inside the End column (only persist the split size, not a solo fill)
			if (!sourcesHidden && !editorHidden) {
				this.stateModel.setInitializationValue(LayoutStateKeys.SOURCES_SIZE, this.workbenchGrid.getViewSize(this.sourcesPartView).height);
			} else if (sourcesHidden) {
				const cachedSourcesSize = this.workbenchGrid.getViewCachedVisibleSize(this.sourcesPartView);
				if (typeof cachedSourcesSize === 'number') {
					this.stateModel.setInitializationValue(LayoutStateKeys.SOURCES_SIZE, cachedSourcesSize);
				}
			}
```

```2534:2537:src/vs/workbench/browser/layout.ts
				// Sources is Low priority and Preview is High. Hiding Preview first
				// lets Sources absorb the End column height, and that expanded
				// height is what the grid caches. Hide Sources first so its cache
				// stays the pre-maximize split.
```

**为什么是问题：** 末列隐藏时，`EDITOR_SIZE` 取的是 `sourcesPartView` 的 `getViewCachedVisibleSize`。同一次保存里，Sources 隐藏分支把同一次调用的结果写入 `SOURCES_SIZE`，上面的注释写明这是分割高度。面板最大化也写明要保住的是最大化前的分割高度。列宽和分割高度因此共用一个缓存数。`EDITOR_SIZE` 没有 `typeof === 'number'` 判断，缓存缺失时会把 `undefined` 写进初始化状态；`SOURCES_SIZE` 有这层判断。

**方向：** 末列宽度只保存横向尺寸；Sources 叶子上的可见尺寸缓存继续只作为分割高度。

### r09-3

**严重度：** 中

**症状：** 启动时要打开的文件若带 `viewColumn`，列号超过当前可见分类组的数量时，该文件不会打开，也没有日志。

**代码：**

```1066:1073:src/vs/workbench/browser/layout.ts
				const editorGroupsInVisualOrder = mainPart.getGroups(GroupsOrder.GRID_APPEARANCE).filter(group =>
					!isPreviewCategoryRoutingPart(mainPart) || mainPart.isGroupVisible(group));
				const mapEditorsToGroup = new Map<GroupIdentifier, Set<IUntypedEditorInput>>();

				for (const editor of editors) {
					const group = editorGroupsInVisualOrder[(editor.viewColumn ?? 1) - 1]; // viewColumn is index+1 based
					if (!group) {
						continue;
```

```383:393:src/vs/workbench/browser/parts/editor/categorizedMainEditorPart.ts
	isGroupVisible(group: IEditorGroup | GroupIdentifier): boolean {
		if (!this.ready) {
			return true;
		}

		const category = this.getGroupCategory(group);
		if (!category) {
			return true;
		}

		return category === this.previewCategoryService.activeCategory;
	}
```

**为什么是问题：** 主 Preview 是分类部件。`whenReady` 之后 `ready` 为真，网格里其他分类的组 `isGroupVisible` 为 false，被滤掉。每个分类保留一个根组时，可见列表通常只有当前分类那一组。`viewColumn` 从 1 计，第 2 列及以后得到 `undefined`，`continue` 直接丢掉，不会进入后面的 `openEditors`。打开失败的分支会 `logService.error`，这条跳过路径没有记录。

**方向：** 可见组数量不够时，把文件打开到当前分类的活动组，或先在当前分类补组，不要静默丢弃。

### r09-4

**严重度：** 低

**症状：** `zenMode.centerLayout` 默认为 true。打开禅模式不会居中编辑区；禅模式已经打开时修改这项，也不会居中。退出禅模式时用来取消居中的标记，在布局代码里没有被赋过值。

**代码：**

```35:38:src/vs/workbench/browser/workbench.zenMode.contribution.ts
			'zenMode.centerLayout': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.centerLayout', "Controls whether turning on Zen Mode also centers the layout.")
```

```1531:1553:src/vs/workbench/browser/layout.ts
		if (this.isZenModeActive()) {

			toggleMainWindowFullScreen = !this.state.runtime.mainWindowFullscreen && config.fullScreen && !isIOS;

			if (!restoring) {
				zenModeExitInfo.transitionedToFullScreen = toggleMainWindowFullScreen;
				zenModeExitInfo.handleNotificationsDoNotDisturbMode = this.notificationService.getFilter() === NotificationsFilter.OFF;
				zenModeExitInfo.wasVisible.sideBar = this.isVisible(Parts.SIDEBAR_PART);
				zenModeExitInfo.wasVisible.panel = this.isVisible(Parts.PANEL_PART);
				zenModeExitInfo.wasVisible.auxiliaryBar = this.isVisible(Parts.AUXILIARYBAR_PART);
				zenModeExitInfo.wasVisible.editor = this.isVisible(Parts.EDITOR_PART);
				zenModeExitInfo.wasVisible.sources = this.isVisible(Parts.SOURCES_PART);
				zenModeExitInfo.wasVisible.conversation = this.isVisible(Parts.CONVERSATION_PART);
				this.stateModel.setRuntimeValue(LayoutStateKeys.ZEN_MODE_EXIT_INFO, zenModeExitInfo);
			}

			this.setPanelHidden(true, true);
			this.setAuxiliaryBarHidden(true, true);
			this.setSideBarHidden(true);

			this.setConversationHidden(false);
			this.setEditorHidden(true);
			this.setSourcesHidden(true);
```

```1606:1610:src/vs/workbench/browser/layout.ts
				// Center Layout
				if (e.affectsConfiguration(ZenModeSettings.HIDE_LINENUMBERS)) {
					const lineNumbersType = this.configurationService.getValue<boolean>(ZenModeSettings.HIDE_LINENUMBERS) ? 'off' : undefined;
					setLineNumbers(lineNumbersType);
```

```1649:1651:src/vs/workbench/browser/layout.ts
			if (zenModeExitInfo.transitionedToCenteredEditorLayout) {
				this.centerMainEditorLayout(false, true);
			}
```

**为什么是问题：** 进入禅模式时读取了全屏、活动栏、状态栏、行号、标签和通知过滤，没有读取 `config.centerLayout`，也没有调用 `centerMainEditorLayout(true)`。配置监听的注释写着 Center Layout，条件却是 `HIDE_LINENUMBERS`。退出只在 `transitionedToCenteredEditorLayout` 为真时取消居中，本文件只读取该字段、没有赋值。同一次进入会把 Preview 藏起，所以居中要等 Preview 再次显示才看得到。

**方向：** 进入禅模式和该项配置变更都按 `centerLayout` 切换居中，并把是否由禅模式打开居中写入退出信息。

### r09-5

**严重度：** 中

**症状：** Sources 仍可见、Preview 已隐藏时关闭面板，键盘焦点进入隐藏的 Preview，对话输入不再收到按键。

**代码：**

```2358:2366:src/vs/workbench/browser/layout.ts
		let focusEditor = false;
		if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)) {
			this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Panel);
			if (
				!isIOS &&
				!this.isAuxiliaryBarMaximized()
			) {
				focusEditor = true;
			}
		}
```

```2401:2403:src/vs/workbench/browser/layout.ts
		if (focusEditor) {
			this.editorGroupService.mainPart.activeGroup.focus(); // Pass focus to editor group if panel part is now hidden
		}
```

```1124:1131:src/vs/workbench/browser/parts/editor/editorGroupView.ts
	focus(): void {
		// Pass focus to editor panes
		if (this.activeEditorPane) {
			this.activeEditorPane.focus();
		} else {
			this.element.focus();
		}
```

```1445:1446:src/vs/workbench/browser/layout.ts
		} else if (this.isVisible(Parts.CONVERSATION_PART)) {
			this.focusPart(Parts.CONVERSATION_PART);
```

**为什么是问题：** 关闭面板时只要还有活动面板复合体，就把 `focusEditor` 设为 true，然后聚焦主 Preview 的活动组，不看 `EDITOR_PART` 是否可见。组的 `focus()` 会把焦点交给当前编辑器窗格或组元素。末列只藏了 Preview、Sources 仍可见时，`isPanelMaximized()` 为 false，不会先把 Preview 显示出来，焦点仍进入隐藏组。壳的 `focus()` 在对话可见时把焦点交给对话。

**方向：** 面板隐藏后的落点与 `focus()` 一致；Preview 不可见时不要聚焦它。

## 已打开文件

- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/layout.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/conversation/conversationPart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/conversation/partRegionHideControl.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/sources/sourcesPart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/editorParts.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/categorizedMainEditorPart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/conversationEditorPart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/editorPart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/editorGroupView.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/modalEditorPart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/auxiliaryEditorPart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/editorActions.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/editor/editorCommands.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/parts/paneCompositePart.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/workbench.contribution.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/browser/workbench.zenMode.contribution.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/common/editor/filteredEditorGroupModel.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/common/memento.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/electron-browser/window.ts`
