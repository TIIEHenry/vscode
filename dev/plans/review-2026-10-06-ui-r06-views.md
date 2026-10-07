---
title: "审查 r06：views"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "清空消息后仍按旧 _messageValue 藏树；欢迎态焦点被藏起的树抢走；空欢迎仍抢焦点；过滤容器下标错位崩溃。"
---

# 审查 r06：views

范围：`src/vs/workbench/browser/parts/views`。只报用户可见行为错误。已有 `review-2026-10-06-r01`–`r16`（含 r11 workbench-shell）未覆盖本目录。

## r06-1 中

- 症状：自定义树视图先出现过「无数据提供方」或扩展消息，随后消息被清掉且树仍为空时，消息区与树都被藏起，整块视图空白。
- 位置：`src/vs/workbench/browser/parts/views/treeView.ts` 第 986–989、1154–1161 行
- 引用：

```986:989:src/vs/workbench/browser/parts/views/treeView.ts
	private hideMessage(): void {
		this.resetMessageElement();
		this.messageElement?.classList.add('hide');
		this.layout(this._height, this._width);
```

```1154:1161:src/vs/workbench/browser/parts/views/treeView.ts
	private updateContentAreas(): void {
		const isTreeEmpty = !this.root.children || this.root.children.length === 0;
		// Hide tree container only when there is a message and tree is empty and not refreshing
		if (this._messageValue && isTreeEmpty && !this.refreshing && this.treeContainer) {
			// If there's a dnd controller then hiding the tree prevents it from being dragged into.
			if (!this.dragAndDropController) {
				this.treeContainer.classList.add('hide');
```

- 为什么是问题：`hideMessage` 只给消息节点加 `hide`，从不把 `_messageValue` 置空。`updateMessage` 在已有 `dataProvider` 且 `_message` 为空时走 `hideMessage`（约 903–904 行），随后 `updateContentAreas` 仍把旧的 `_messageValue` 当成「有消息」。树空且无 DnD 时给 `treeContainer` 加 `hide`。消息 DOM 已隐藏，树也被隐藏，用户看到空白。常见路径：先无 provider 显示 `noDataProviderMessage`（写入 `_messageValue`），再挂上 provider 且根仍为空。
- 方向：`hideMessage` 时清除 `_messageValue`（并释放渲染用 disposables）；`updateContentAreas` 以当前是否真正展示消息为准。

## r06-2 中

- 症状：空树显示欢迎页时，把焦点交给该视图会落不到欢迎区按钮/链接，焦点像丢失或落在不可见树上。
- 位置：`src/vs/workbench/browser/parts/views/treeView.ts` 第 125–128、663–677 行
- 引用：

```125:128:src/vs/workbench/browser/parts/views/treeView.ts
	override focus(): void {
		super.focus();
		this.treeView.focus();
	}
```

```663:677:src/vs/workbench/browser/parts/views/treeView.ts
	focus(reveal: boolean = true, revealItem?: ITreeItem): void {
		if (this.tree && this.root.children && this.root.children.length > 0) {
			// Make sure the current selected element is revealed
			const element = revealItem ?? this.tree.getSelection()[0];
			if (element && reveal) {
				this.tree.reveal(element, 0.5);
			}

			// Pass Focus to Viewer
			this.tree.domFocus();
		} else if (this.tree && this.treeContainer && !this.treeContainer.classList.contains('hide')) {
			this.tree.domFocus();
		} else {
			this.domNode.focus();
		}
	}
```

- 为什么是问题：`shouldShowWelcome()` 为真时（约 136–138 行）`ViewPane.focus` 会先聚焦欢迎区。欢迎态下 CSS（`views.css` 第 104–106 行）把非 `.welcome-view` 整段 `display: none`，树被藏起。欢迎且无 message 时 `treeContainer` 通常没有 `hide`，`treeView.focus` 走 `tree.domFocus()`，把焦点从欢迎区抢到不可见的树上。键盘无法落到欢迎按钮。
- 方向：欢迎启用时不要再调 `treeView.focus()`，或让 `treeView.focus` 在树被欢迎 CSS 藏起时落到 `domNode`/欢迎区。

## r06-3 中

- 症状：视图处于「应显示欢迎」但没有任何欢迎文案时，聚焦该视图会落到被 `display: none` 的欢迎节点上，树或正文反而拿不到焦点。
- 位置：`src/vs/workbench/browser/parts/views/viewPane.ts` 第 225–234、677–679 行
- 引用：

```225:234:src/vs/workbench/browser/parts/views/viewPane.ts
	private render(): void {
		this.renderDisposables.clear();
		this.element!.textContent = '';

		const contents = this.getContentDescriptors();

		if (contents.length === 0) {
			this.container.classList.remove('welcome');
			this.scrollableElement!.scanDomNode();
			return;
		}
```

```677:679:src/vs/workbench/browser/parts/views/viewPane.ts
	focus(): void {
		if (this.viewWelcomeController?.enabled) {
			this.viewWelcomeController.focus();
```

- 为什么是问题：`onDidChangeViewWelcomeState` 一旦 `shouldShowWelcome()` 为真就把 `_enabled` 设为 true 并挂上欢迎 DOM。若没有可见描述且没有 `default` 项，`render` 去掉 `welcome` 类（正文重新显示），但 `_enabled` 仍为 true。`ViewPane.focus` 只看 `enabled`，继续 `welcome-view-content.focus()`；该节点在 `:not(.welcome) > .welcome-view` 下为 `display: none`（`views.css` 第 104–105 行）。焦点进入不可见节点，表现为焦点丢失。
- 方向：无欢迎内容时视为未启用（清 `_enabled` 或拆掉欢迎 DOM）；`focus` 以实际是否展示欢迎为准。

## r06-4 中

- 症状：调试/过滤类侧栏里某个视图 `render` 失败后，再添加常量视图（默认折叠）时可能直接抛错，整块容器加视图中断。
- 位置：`src/vs/workbench/browser/parts/views/viewsViewlet.ts` 第 121–126 行；对照 `viewPaneContainer.ts` 第 797–801 行
- 引用：

```121:126:src/vs/workbench/browser/parts/views/viewsViewlet.ts
	protected override onDidAddViewDescriptors(added: IAddedViewDescriptorRef[]): ViewPane[] {
		const panes: ViewPane[] = super.onDidAddViewDescriptors(added);
		for (let i = 0; i < added.length; i++) {
			if (this.constantViewDescriptors.has(added[i].viewDescriptor.id)) {
				panes[i].setExpanded(false);
			}
		}
```

```797:801:src/vs/workbench/browser/parts/views/viewPaneContainer.ts
			try {
				pane.render();
			} catch (error) {
				this.logService.error(`Fail to render view ${viewDescriptor.id}`, error);
				continue;
```

- 为什么是问题：父类在 `render` 失败时 `continue`，返回的 `panes` 比 `added` 短且下标错位。子类仍用 `added[i]` 去取 `panes[i]`：失败项之后的常量视图会碰到 `undefined.setExpanded`，或折叠错视图。用户侧是加视图过程崩溃或折叠状态与预期不一致。
- 方向：按 `pane.id` / `viewDescriptor.id` 查找再 `setExpanded`，不要假定与 `added` 等长同序。
