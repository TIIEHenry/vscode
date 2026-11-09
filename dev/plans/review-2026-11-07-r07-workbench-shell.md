---
title: "十六路审查 2026-11-07 r07：workbench 壳发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读审查 workbench 壳 10-30 以后的提交与未提交改动（布局与区域开关、聚焦命令、标题栏、会话与分类 Preview、编辑器拖放、状态栏），记录 4 条。"
---

# 十六路审查 2026-11-07 r07：workbench 壳发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

范围是 `src/vs/workbench/browser`、`common`、`electron-browser`、`test` 与根目录的 `*.ts`。本次先读 2026-10-30 以后的提交和工作区未提交改动：`layout.ts` 里 Conversation / Sources 隐藏时的焦点交接，新加的 Focus Conversation / Preview / Sources 命令和区域开关的键盘参数，`navigationActions.ts`，标题栏导航工具栏与去掉应用图标，`conversationEditorPart.ts` 按组模型变化重设部件选项，`categorizedMainEditorPart.ts` 的 `getTargetGroupForInput` 与类别条。然后沿 11-03 至 11-07 的几笔生命周期加固与键盘焦点提交，抽查编辑器拖放、编辑器组与窗格、模态与辅助编辑器部件、状态栏、通知、菜单栏和原生窗口。共 4 条，都来自这次读到的活码。

### r07-1

- 严重度：中
- 症状：从系统文件管理器、Sources 的 Files 树（资源管理器树）或扩展树视图把文件拖进 Preview 编辑区，松手后什么都不打开，也没有提示或日志。拖编辑器页签、拖整个编辑器组仍然正常。
- 代码：`src/vs/workbench/browser/parts/editor/editorDropTarget.ts` 201–211（`onDrop` 先 `dispose()` 再 `handleDrop`）；351–359（树项分支）；383–390（URI 分支）；601–606（`dispose()` 末尾置 `_disposed`）。资源管理器拖动的数据来自 `src/vs/workbench/browser/dnd.ts` 205–383 的 `fillEditorsDragData`；拖放目标由 `src/vs/workbench/browser/parts/editor/editorPart.ts` 1268 为每个编辑器部件装上。

```201:211:src/vs/workbench/browser/parts/editor/editorDropTarget.ts
			onDrop: e => {
				EventHelper.stop(e, true);

				// Dispose overlay
				this.dispose();

				// Handle drop if we have a valid operation
				if (this.currentDropOperation) {
					this.handleDrop(e, this.currentDropOperation.splitDirection).catch(onUnexpectedError);
				}
			}
```

```351:359:src/vs/workbench/browser/parts/editor/editorDropTarget.ts
		// Check for tree items
		else if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
			const data = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype);
			if (Array.isArray(data) && data.length > 0) {
				const editors: IUntypedEditorInput[] = [];
				for (const id of data) {
					if (this.groupView.disposed || this._disposed) {
						return;
					}
```

```383:390:src/vs/workbench/browser/parts/editor/editorDropTarget.ts
		// Check for URI transfer
		else {
			if (this.groupView.disposed || this._disposed) {
				return;
			}
			const dropHandler = this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: !isWeb || isTemporaryWorkspace(this.contextService.getWorkspace()) });
			dropHandler.handleDrop(event, getWindow(this.groupView.element), () => ensureTargetGroup(), targetGroup => targetGroup?.focus());
		}
```

```601:606:src/vs/workbench/browser/parts/editor/editorDropTarget.ts
		this.groupView.element.classList.remove('dragged-over');

		super.dispose();

		this._disposed = true;
	}
```

- 为什么是问题：放下时 `DropOverlay` 先调用自己的 `dispose()`，第 605 行把 `_disposed` 置为真，随后才调 `handleDrop`。`handleDrop` 依次认组拖动、页签拖动、树项、URI 四种传输。前两支不看 `_disposed`，所以拖页签和拖组不受影响。树项分支在取第一项之前、URI 分支在创建 `ResourcesDropHandler` 之前都判断 `this._disposed`，这时它一定为真，于是直接返回。资源管理器的拖动只经 `fillEditorsDragData` 往 `dataTransfer` 写 `DataTransfers.RESOURCES`、`CodeDataTransfers.EDITORS` 和 URI 列表，不设页签或组的本地传输；系统拖进来的文件也只带文件数据。两者都落到第 384 行的 URI 分支。扩展树视图的拖动由 `treeView.ts` 第 2014 行设树项传输，落到第 357 行返回。这几处判断是 2026-11-03 的 `c0e2c6f775c` 加上的，在此之前 `handleDrop` 不看 `_disposed`。会话编辑器部件强制 `allowDropIntoGroup: false`，`onDragEnter` 不建浮层，不受影响；主 Preview 和其它编辑器部件都走这条路。
- 方向：`handleDrop` 里的销毁判断只看目标组是否已销毁，不看浮层自身；或者在 `onDrop` 里先交给 `handleDrop` 再销毁浮层。

### r07-2

- 严重度：中
- 症状：键盘焦点在状态栏时，按 Home 落到第二个条目，按 End 落到第一个条目。在某个条目上按 Escape，焦点回到第一个条目；再按 Escape 也离不开状态栏，回不到编辑器。
- 代码：`src/vs/workbench/browser/parts/statusbar/statusbarPart.ts` 431–439；`src/vs/workbench/browser/parts/statusbar/statusbarActions.ts` 87–97（Home）、99–109（End）、111–125（Escape）；`src/vs/workbench/browser/parts/statusbar/statusbarModel.ts` 162–168 与 178–208（`focusEntry`）。

```431:439:src/vs/workbench/browser/parts/statusbar/statusbarPart.ts
	focus(preserveEntryFocus = true): void {
		this.getContainer()?.focus();
		const lastFocusedEntry = this.viewModel.lastFocusedEntry;
		if (preserveEntryFocus && lastFocusedEntry?.labelContainer.isConnected) {
			setTimeout(() => lastFocusedEntry.labelContainer.focus(), 0); // Need a timeout, for some reason without it the inner label container will not get focused
		} else {
			setTimeout(() => this.focusNextEntry(), 0);
		}
	}
```

```111:125:src/vs/workbench/browser/parts/statusbar/statusbarActions.ts
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'workbench.statusBar.clearFocus',
	weight: KeybindingWeight.WorkbenchContrib,
	primary: KeyCode.Escape,
	when: StatusBarFocused,
	handler: (accessor: ServicesAccessor) => {
		const statusBarService = accessor.get(IStatusbarService);
		const editorService = accessor.get(IEditorService);
		if (statusBarService.isEntryFocused()) {
			statusBarService.focus(false);
		} else if (editorService.activeEditorPane) {
			editorService.activeEditorPane.focus();
		}
	}
});
```

- 为什么是问题：`focus(false)` 的三个调用方都只想把焦点放到状态栏容器上。Home 和 End 随后自己调 `focusNextEntry` / `focusPreviousEntry` 选首尾项；Escape 用它把焦点从条目退回容器，下一次 Escape 才回编辑器。2026-11-07 的 `1dc991f93c7` 给 `focus()` 加了 `else` 分支，`preserveEntryFocus` 为假时也会在下一个任务里再调一次 `focusNextEntry()`。Home 先同步聚焦第一项，延时回调看到焦点在第一项，按 `focusEntry(+1, 0)` 前进到第二项。End 先同步聚焦最后一项，延时回调从最后一项往后找不到可见条目，退回起点 0，落到第一项。Escape 把焦点交给容器后，延时回调因为没有条目持焦而聚焦第一项；下一次 Escape 时 `isEntryFocused()` 又为真，只会重复这一步，`activeEditorPane.focus()` 那一支永远走不到。提交说明要的是「焦点项被移除时转到下一项」，只对应 `preserveEntryFocus` 为真、上次焦点项已不在 DOM 的情形。
- 方向：只在 `preserveEntryFocus` 为真且上次焦点项已不在 DOM 时补 `focusNextEntry()`，`focus(false)` 仍只聚焦容器。

### r07-3

- 严重度：中
- 症状：辅助栏最大化期间，用新加的 Focus Sources（Ctrl+Alt+Shift+3）或 Toggle Sources 打开 Sources 后，辅助栏仍标着最大化。若 Sources 在最大化之前是隐藏的，之后打开 Preview，或还原辅助栏（最大化期间 Ctrl+W 也绑在还原上），刚打开的 Sources 会被重新藏起，焦点跳到辅助栏。
- 代码：`src/vs/workbench/browser/layout.ts` 2102–2128（`setSourcesHidden` 显示时不退出辅助栏最大化）；2049–2052、2201、2373（`setEditorHidden`、`setSideBarHidden`、`setPanelHidden` 都先退出）；2472–2480 与 2508（进入最大化时存可见性快照）；2512–2533（还原时按快照重设 Sources 并聚焦辅助栏）。`src/vs/workbench/browser/actions/layoutActions.ts` 296–301 与 539–541（Focus Sources）；`src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts` 198–203（还原的 Ctrl+W）。

```2049:2052:src/vs/workbench/browser/layout.ts
	private setEditorHidden(hidden: boolean): void {
		if (!hidden && this.setAuxiliaryBarMaximized(false) && this.isVisible(Parts.EDITOR_PART)) {
			return; // return: leaving maximised auxiliary bar made this part visible
		}
```

```2102:2110:src/vs/workbench/browser/layout.ts
	private setSourcesHidden(hidden: boolean): void {
		if (!this.workbenchGrid) {
			return;
		}

		const beforeHide = hidden ? this.getAgentShellVisibility() : undefined;
		const handOffFocus = hidden && this.hasFocus(Parts.SOURCES_PART);

		this.stateModel.setRuntimeValue(LayoutStateKeys.SOURCES_HIDDEN, hidden);
```

```2512:2521:src/vs/workbench/browser/layout.ts
		} else {
			const state = assertReturnsDefined(this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_LAST_NON_MAXIMIZED_VISIBILITY));
			this.stateModel.setRuntimeValue(LayoutStateKeys.AUXILIARYBAR_WAS_LAST_MAXIMIZED, false);

			this.inMaximizedAuxiliaryBarTransition = true;
			try {
				this.setEditorHidden(!state?.editorVisible);	// this order of updating view visibility
				this.setSourcesHidden(!(state?.sourcesVisible ?? true));
				this.setPanelHidden(!state?.panelVisible);		// helps in restoring the previous view
				this.setSideBarHidden(!state?.sideBarVisible);	// sizes we had
```

```296:301:src/vs/workbench/browser/actions/layoutActions.ts
function showAndFocusAgentShellPart(layoutService: IWorkbenchLayoutService, part: Parts.CONVERSATION_PART | Parts.EDITOR_PART | Parts.SOURCES_PART): void {
	if (!layoutService.isVisible(part, mainWindow)) {
		layoutService.setPartHidden(false, part);
	}
	layoutService.focusPart(part, mainWindow);
}
```

- 为什么是问题：`setEditorHidden`、`setSideBarHidden` 和 `setPanelHidden` 在显示自己之前都先调 `setAuxiliaryBarMaximized(false)`，`setSourcesHidden` 没有这一步。进入最大化时，第 2472–2479 行记下进入前的可见性，第 2508 行写进 `AUXILIARYBAR_LAST_NON_MAXIMIZED_VISIBILITY`；Sources 进入前隐藏，快照里 `sourcesVisible` 就是 false。最大化期间打开 Sources 只改 `SOURCES_HIDDEN`，`AUXILIARYBAR_WAS_LAST_MAXIMIZED` 仍为真，快照也不更新。之后切出 Preview 时，`setEditorHidden(false)` 先走还原分支，第 2519 行按旧快照执行 `setSourcesHidden(true)`，第 2533 行再把焦点给辅助栏；直接还原辅助栏走的是同一分支。最大化标记一直为真期间，`enforceAgentShellVisible`（第 2147 行）和 `ensureAgentShellMinimumVisible`（第 2163 行）也一直跳过。2026-11-01 UI 适配审查 a04-4 的签收按 D17 写定最大化时辅助栏占满 Conversation 之外的宽度，Sources 出现后这一点已不成立。新加的 Focus Sources 命令让这条路径只需一个快捷键就能走到。
- 方向：`setSourcesHidden(false)` 与另外三个 setter 一样，先退出辅助栏最大化再显示。

### r07-4

- 严重度：低
- 症状：设置里仍有 `window.doubleClickIconToClose`，说明写着双击标题栏应用图标即关闭窗口。自定义标题栏已经不再画应用图标，打开这项没有任何效果。
- 代码：`src/vs/workbench/electron-browser/desktop.contribution.ts` 237–242；`src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` 475–484（`createContentArea` 已不建 `a.window-appicon`）；`src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts`（未提交改动删去读这项设置的 `onConfigurationChanged` 分支、`onUpdateAppIconDragBehavior` 和双击关闭监听）；`src/vs/workbench/test/node/titlebarNavigationContract.test.ts` 33–34。

```237:242:src/vs/workbench/electron-browser/desktop.contribution.ts
			'window.doubleClickIconToClose': {
				'type': 'boolean',
				'default': false,
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('window.doubleClickIconToClose', "If enabled, this setting will close the window when the application icon in the title bar is double-clicked. The window will not be able to be dragged by the icon. This setting is effective only if {0} is set to `custom`.", '`#window.titleBarStyle#`')
			},
```

```475:484:src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
	protected override createContentArea(parent: HTMLElement): HTMLElement {
		this.element = parent;
		this.rootContainer = append(parent, $('.titlebar-container'));

		this.leftContent = append(this.rootContainer, $('.titlebar-left'));
		this.centerContent = append(this.rootContainer, $('.titlebar-center'));
		this.rightContent = append(this.rootContainer, $('.titlebar-right'));

		// Draggable region that we can manipulate for #52522
		this.dragRegion = prepend(this.rootContainer, $('div.titlebar-drag-region'));
```

- 为什么是问题：工作区未提交改动去掉了 `BrowserTitlebarPart` 在 Windows / Linux 自定义标题栏左侧建的 `a.window-appicon`，也去掉了 `NativeTitlebarPart` 里唯一读 `window.doubleClickIconToClose` 的代码；新测试第 33–34 行断言两个标题栏文件不再出现 `appIcon` / `window-appicon`，说明去掉图标是有意的。`rg doubleClickIconToClose src` 只剩注册处，注册与说明照旧，设置编辑器继续展示这一项。打开过它的用户会失去双击关闭，界面不提示。
- 方向：随应用图标一起撤下这项设置，或在说明里写明已不生效。

## 打开过的文件

- `src/vs/workbench/browser/layout.ts`
- `src/vs/workbench/browser/actions/layoutActions.ts`
- `src/vs/workbench/browser/actions/navigationActions.ts`
- `src/vs/workbench/browser/dnd.ts`
- `src/vs/workbench/browser/parts/editor/editorDropTarget.ts`
- `src/vs/workbench/browser/parts/editor/categorizedMainEditorPart.ts`
- `src/vs/workbench/browser/parts/editor/conversationEditorPart.ts`
- `src/vs/workbench/browser/parts/editor/editorParts.ts`
- `src/vs/workbench/browser/parts/editor/editorPart.ts`
- `src/vs/workbench/browser/parts/editor/editorGroupView.ts`
- `src/vs/workbench/browser/parts/editor/editorTitleControl.ts`
- `src/vs/workbench/browser/parts/editor/editorTabsControl.ts`
- `src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts`
- `src/vs/workbench/browser/parts/editor/previewCategorySwitcher.ts`
- `src/vs/workbench/browser/parts/editor/modalEditorPart.ts`
- `src/vs/workbench/browser/parts/conversation/conversationPart.ts`
- `src/vs/workbench/browser/parts/conversation/partRegionHideControl.ts`
- `src/vs/workbench/browser/parts/sources/sourcesPart.ts`
- `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`
- `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts`
- `src/vs/workbench/browser/parts/statusbar/statusbarPart.ts`
- `src/vs/workbench/browser/parts/statusbar/statusbarActions.ts`
- `src/vs/workbench/browser/parts/statusbar/statusbarModel.ts`
- `src/vs/workbench/electron-browser/desktop.contribution.ts`
- `src/vs/workbench/test/browser/navigationActions.test.ts`
- `src/vs/workbench/test/node/titlebarNavigationContract.test.ts`
- 只看 `git diff` / `git show` 或 `rg` 的文件：`src/vs/workbench/electron-browser/window.ts`、`src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts`、`src/vs/workbench/electron-browser/parts/titlebar/menubarControl.ts`、`src/vs/workbench/electron-browser/parts/dialogs/dialog.contribution.ts`、`src/vs/workbench/browser/parts/dialogs/dialog.web.contribution.ts`、`src/vs/workbench/browser/parts/titlebar/menubarControl.ts`、`src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css`、`src/vs/workbench/browser/parts/notifications/notificationsToasts.ts`、`src/vs/workbench/browser/parts/compositeBar.ts`、`src/vs/workbench/browser/parts/paneCompositeBar.ts`、`src/vs/workbench/browser/parts/paneCompositePart.ts`、`src/vs/workbench/browser/parts/globalCompositeBar.ts`、`src/vs/workbench/browser/parts/statusbar/statusbarItem.ts`、`src/vs/workbench/browser/parts/editor/editorPanes.ts`、`src/vs/workbench/browser/parts/editor/editorPlaceholder.ts`、`src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts`、`src/vs/workbench/browser/parts/editor/auxiliaryEditorPart.ts`、`src/vs/workbench/browser/parts/editor/editorActions.ts`、`src/vs/workbench/browser/parts/editor/editorCommands.ts`、`src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts`、`src/vs/workbench/browser/parts/views/treeView.ts`、`src/vs/workbench/browser/parts/views/viewPaneContainer.ts`、`src/vs/workbench/browser/contextkeys.ts`、`src/vs/workbench/browser/workbench.ts`、`src/vs/workbench/common/configuration.ts`、`src/vs/workbench/test/browser/layoutControlMenu.test.ts`、`src/vs/workbench/test/browser/parts/editor/previewEditorGroupHeader.test.ts`
- 为核对接口只读打开的块外文件：`src/vs/workbench/services/editor/browser/editorOpenSlot.ts`、`src/vs/workbench/services/editor/common/editorGroupFinder.ts`、`src/vs/workbench/services/layout/browser/layoutService.ts`、`src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts`、`src/vs/workbench/contrib/files/browser/views/explorerViewer.ts`
- 查重读过的旧稿：`dev/plans/review-2026-10-30-r09-workbench-shell.md`、`dev/plans/review-2026-10-24-r13-workbench-shell.md`、`dev/plans/review-2026-10-11-r07-workbench-shell.md`、`dev/plans/ui-interaction-visual-review-2026-11-07.md`、`dev/plans/interaction-review-2026-11-06.md`、`dev/plans/review-2026-10-30-r11-conversation.md`、`dev/reviews/2026-11-01-ui-adaptation/a04-window-shell.md`
