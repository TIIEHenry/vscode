---
title: "审查 r13：terminal"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "装饰清 class 迭代残留；隐藏 Chat 终端条出现不重排；杀终端抢焦点；编辑器 mousedown 用错实例；has-text 阈值不一致。"
---

# 审查 r13：terminal

范围：`src/vs/workbench/contrib/terminal/browser`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 与 [r09 terminal-debug](review-2026-10-06-r09-terminal-debug.md)；r09-5（恢复后 cwd 被空串盖掉）活码已改为仅在 `attachCwd` 非空时写入，本轮不报。无其它命中跳过。

## r13-1 中

- 症状：Shell Integration 命令装饰在状态切换（成功/失败/运行中）或主题刷新时，可能留下上一状态的颜色/图标 class，外观与真实退出码不一致。
- 引用：

```373:380:src/vs/workbench/contrib/terminal/browser/xterm/decorationAddon.ts
	private _updateClasses(element?: HTMLElement, command?: ITerminalCommand, markProperties?: IMarkProperties): void {
		if (!element) {
			return;
		}
		for (const classes of element.classList) {
			element.classList.remove(classes);
		}
		element.classList.add(DecorationSelector.CommandDecoration, DecorationsSelector.Codicon, DecorationsSelector.XtermDecoration);
```

- 为什么是问题：在遍历活的 `DOMTokenList` 时边删边走，会跳过元素，旧的 `error` / `success` / `default-color` 等可残留，再叠上新状态 class，用户看到错色或错图标。
- 方向：先拷贝 class 列表再删，或一次性清空后再 `add`。

## r13-2 中

- 症状：侧栏出现「Hidden Terminal(s)」条目后，标签列表仍按旧高度布局，最底部若干终端标签被裁切，点不到或要点滚动才露出来。
- 引用：

```142:145:src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts
		this._register(Event.any(this._terminalChatService.onDidRegisterTerminalInstanceWithToolSession, this._terminalService.onDidChangeInstances, this._terminalService.onDidDisposeInstance)(() => {
			this._refreshShowTabs();
			this._updateChatTerminalsEntry();
		}));
```

```214:216:src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts
	private _updateChatTerminalsEntry(): void {
		this._chatEntry?.update();
	}
```

```349:357:src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts
	layout(width: number, height: number): void {
		const chatItemHeight = this._chatEntry?.element.style.display === 'none' ? 0 : this._chatEntry?.element.clientHeight;
		this._height = height - (chatItemHeight ?? 0);
		this._width = width;
		this._splitView.layout(width);
		if (this._shouldShowTabs()) {
			this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
		}
		this._updateHasText();
	}
```

```119:130:src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts
	update(): void {
		const hiddenChatTerminalCount = this._terminalChatService.getToolSessionTerminalInstances(true).length;
		if (hiddenChatTerminalCount <= 0) {
			this._entry.style.display = 'none';
			this._label.textContent = '';
			this._entry.removeAttribute('aria-label');
			this._entry.removeAttribute('title');

			return;
		}

		this._entry.style.display = '';
```

```311:322:src/vs/workbench/contrib/terminal/browser/media/terminal.css
.monaco-workbench .pane-body.integrated-terminal .tabs-list-container {
	height: 100%;
	overflow: hidden;
	position: relative;
	display: flex;
	flex-direction: column;
}

.monaco-workbench .pane-body.integrated-terminal .tabs-list-container > .tabs-list {
	flex: 1;
	min-height: 0;
}
```

- 为什么是问题：列表高度只在 `layout` 里按 chat 条 `clientHeight` 扣减；注册/显隐 chat 条时只 `update()` 改 `display`，不重排。Flex 会挤出 22px 给条目，但 Monaco 列表仍用旧像素高度，底部标签落在裁切区。
- 方向：`update()` 显隐变化后触发一次与当前面板尺寸相同的 `layout`。

## r13-3 中

- 症状：在拆分组里关掉当前活动终端时，焦点被强制拉到同组下一个终端；若用户当时在编辑器或其它面板操作，输入焦点被抢走。
- 引用：

```387:392:src/vs/workbench/contrib/terminal/browser/terminalGroup.ts
		// Adjust focus if the instance was active
		if (wasActiveInstance && this._terminalInstances.length > 0) {
			const newIndex = index < this._terminalInstances.length ? index : this._terminalInstances.length - 1;
			this.setActiveInstanceByIndex(newIndex);
			// TODO: Only focus the new instance if the group had focus?
			this.activeInstance?.focus(true);
```

- 为什么是问题：无论组内是否原先持有焦点，都 `focus(true)`。从标签栏杀终端、或其它视图触发 dispose 时，工作台焦点会跳进终端。
- 方向：仅当该组（或被杀实例）当时有焦点时再 `focus`。

## r13-4 中

- 症状：并排两个终端编辑器时，在非活动那一侧按下鼠标，右键/中键相关处理落到「编辑器服务当前活动实例」上，与本页正在显示的终端不一致。
- 引用：

```131:138:src/vs/workbench/contrib/terminal/browser/terminalEditor.ts
		this._register(dom.addDisposableListener(this._editorInstanceElement, 'mousedown', async (event: MouseEvent) => {
			const terminal = this._terminalEditorService.activeInstance;
			if (this._terminalEditorService.instances.length > 0 && terminal) {
				const result = await terminal.handleMouseEvent(event, this._instanceMenu);
				if (typeof result === 'object' && result.cancelContextMenu) {
					this._cancelContextMenu = true;
				}
			}
		}));
```

```149:152:src/vs/workbench/contrib/terminal/browser/terminalEditor.ts
				else
				if (!this._cancelContextMenu && rightClickBehavior !== 'copyPaste' && rightClickBehavior !== 'paste') {
					if (!this._cancelContextMenu) {
						openContextMenu(this.window, event, this._editorInput?.terminalInstance, this._instanceMenu, this._contextMenuService);
```

- 为什么是问题：`mousedown` 用全局 `activeInstance`，同文件的 `contextmenu` 却用本页 `_editorInput.terminalInstance`。未聚焦的那一页先收到 mousedown 时，取消菜单等逻辑作用在另一实例上，表现成点了 A、状态却按 B 处理。
- 方向：`mousedown` 与菜单统一使用本编辑器的 `terminalInstance`。

## r13-5 低

- 症状：标签侧栏宽度刚好落在窄/宽分界时，容器 CSS 仍是窄模式（图标居中、无 `has-text` 内边距），列表却按「有文字」渲染标题，标题被挤、裁切，与窄条样式不一致。
- 引用：

```342:346:src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts
	private _updateHasText() {
		const hasText = this._tabListElement.clientWidth > TerminalTabsListSizes.MidpointViewWidth;
		this._tabContainer.classList.toggle('has-text', hasText);
		this._terminalIsTabsNarrowContextKey.set(!hasText);
		this._updateChatTerminalsEntry();
	}
```

```265:273:src/vs/workbench/contrib/terminal/browser/terminalTabsList.ts
	override layout(height?: number, width?: number): void {
		super.layout(height, width);
		const actualWidth = width ?? this.getHTMLElement().clientWidth;
		const newHasText = actualWidth >= TerminalTabsListSizes.MidpointViewWidth;
		const newHasActionBar = actualWidth > TerminalTabsListSizes.ActionbarMinimumWidth;
		if (this._hasText !== newHasText || this._hasActionBar !== newHasActionBar) {
			this._hasText = newHasText;
			this._hasActionBar = newHasActionBar;
			this.refresh();
```

- 为什么是问题：同一分界 `MidpointViewWidth`，容器用 `>`，列表用 `>=`；且 `rerenderTabs` 只改 CSS class、不推列表的 `_hasText`。宽度等于分界时一边出标题、一边仍按窄条排版。
- 方向：两侧共用同一比较与同一状态源（列表 layout 结果驱动容器 class）。
