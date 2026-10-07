---
title: "审查 r10：chat-widget"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "主题切换残留隐式附件芯片；工具确认 JSON「See more」失败后无法再展开；窄宽度下输入编辑器宽度可为负；诊断/命令附件点击后焦点被抢回输入框。"
---

# 审查 r10：chat-widget

范围：`widget/`、`attachments/`。已跳过 r07-4（排队消息编辑失败原文丢失）及索引中其它非 UI 路发现。

## r10-1 中

- 症状：隐式上下文芯片带 light/dark 双路径图标时，切换颜色主题后，附件区出现重复或半残的「当前文件」芯片，旧芯片监听已卸、点切换无效。
- 位置：`src/vs/workbench/contrib/chat/browser/attachments/implicitContextAttachment.ts` 第 74–100、108–110 行
- 引用：

```74:110:src/vs/workbench/contrib/chat/browser/attachments/implicitContextAttachment.ts
		this._register(this.themeService.onDidColorThemeChange(() => {
			if (this._hasDualPathIcon()) {
				this.render();
			}
		}));
	}
	// ...
	private render() {
		this.renderDisposables.clear();
		this.renderedCount = 0;

		for (const context of this.attachment.values) {
			// ...
			if (!currentlyAttached) {
				this.renderMainContext(context, context.isSelection);
				this.renderedCount++;
			}
		}
	}
	// ...
	private renderMainContext(context: ChatImplicitContext, isSelection?: boolean) {
		const contextNode = dom.$('.chat-attached-context-attachment.show-file-icons.implicit');
		this.domNode.appendChild(contextNode);
```

- 为什么是问题：`render()` 只 `clear` 了 disposables，没有清空 `domNode` 上已 append 的 `contextNode`。主题变化再次 `appendChild`，旧节点残留在 DOM。在下次 `renderAttachedContext` 整表重建前，用户一直看到重复/失灵芯片。
- 方向：重绘前 `dom.clearNode(this.domNode)`（或先卸掉旧节点），再渲染。

## r10-2 中

- 症状：工具确认里 JSON 输入处于「See more」折叠态时，若用户已改成非法 JSON，再点「See more」，链接消失，内容仍是单行折叠，再也无法展开。
- 位置：`src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatToolConfirmationSubPart.ts` 第 281–295 行
- 引用：

```281:295:src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatToolConfirmationSubPart.ts
				if (canSeeMore) {
					const seeMore = dom.h('div.see-more', [dom.h('a@link')]);
					seeMore.link.textContent = localize('seeMore', "See more");
					this._register(dom.addDisposableGenericMouseDownListener(seeMore.link, () => {
						try {
							const parsed = JSON.parse(model.getValue());
							model.setValue(JSON.stringify(parsed, null, 2));
							editor.object.editor.updateOptions({ tabFocusMode: false });
							editor.object.editor.updateOptions({ wordWrap: 'on' });
						} catch {
							// ignored
						}
						seeMore.root.remove();
					}));
					elements.editor.append(seeMore.root);
				}
```

- 为什么是问题：`seeMore.root.remove()` 在 `catch` 之后无条件执行。解析失败时既不展开，又拆掉唯一入口，UI 卡在压缩单行。
- 方向：仅在成功 pretty-print 后再移除入口；失败时保留按钮并提示 JSON 无效。

## r10-3 中

- 症状：聊天输入区被拖得很窄（compact 工具条较宽，或 sessions 窗口左右各 32px 边距）时，输入 Monaco 宽度算成负数，编辑区被裁没或布局异常。
- 位置：`src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts` 第 5107–5121 行
- 引用：

```5107:5121:src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts
		const initialEditorScrollWidth = this._inputEditor.getScrollWidth();
		const newEditorWidth = width - data.inputPartHorizontalPadding - data.editorBorder - data.inputPartHorizontalPaddingInside - data.toolbarsWidth - data.sideToolbarWidth;
		const effectiveMaxHeight = this._effectiveInputEditorMaxHeight;
		const contentHeight = preserveInputEditorHeight && this.previousInputEditorDimension
			? this.previousInputEditorDimension.height
			: this._inputEditor.getContentHeight();
		const clampedContentHeight = Math.min(contentHeight, effectiveMaxHeight);
		const inputEditorHeight = this.inputEditorMinHeight ? Math.min(Math.max(this.inputEditorMinHeight, clampedContentHeight), effectiveMaxHeight) : clampedContentHeight;
		const newDimension = { width: newEditorWidth, height: inputEditorHeight };
		if (!this.previousInputEditorDimension || (this.previousInputEditorDimension.width !== newDimension.width || this.previousInputEditorDimension.height !== newDimension.height)) {
			this.ignoreInputEditorContentSizeChanges = preserveInputEditorHeight;
			try {
				this._inputEditor.layout(newDimension);
```

- 为什么是问题：`newEditorWidth` 未下限钳制。`getLayoutData` 在 sessions 下 `inputPartHorizontalPadding` 可为 64，compact 还会再减整条工具栏宽度；外层 `layout` 只限制最大宽度 950、不保最小宽度。窄侧栏时宽度 ≤0 仍交给 `layout`。
- 方向：对编辑器宽度做 `Math.max(最小可用宽度, newEditorWidth)`，必要时先让工具栏进溢出菜单。

## r10-4 中

- 症状：点击诊断附件（应聚焦 Problems）或带 `commandId` 的字符串上下文芯片后，焦点立刻被抢回聊天输入框，目标面板/命令 UI 拿不住焦点。
- 位置：`src/vs/workbench/contrib/chat/browser/attachments/chatAttachmentWidgets.ts` 第 920–938 行；`src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts` 第 3542 行
- 引用：

```920:938:src/vs/workbench/contrib/chat/browser/attachments/chatAttachmentWidgets.ts
				this.element.style.cursor = 'pointer';
				this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, () => {
					this.commandService.executeCommand('workbench.panel.markers.view.focus');
				}));
			}
		}
		// ...
		if (isStringVariableEntry(attachment) && attachment.commandId) {
			this.element.style.cursor = 'pointer';
			const contextItemHandle = attachment.handle;
			this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, async () => {
				const chatContextService = this.instantiationService.invokeFunction(accessor => accessor.get(IChatContextService));
				await chatContextService.executeChatContextItemCommand(contextItemHandle);
			}));
		}
```

```3542:3542:src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts
		this._register(dom.addStandardDisposableListener(this.attachmentsContainer, dom.EventType.CLICK, e => this.inputEditor.focus()));
```

- 为什么是问题：上述芯片点击未 `stopPropagation`。冒泡到 `attachmentsContainer` 的监听器无条件 `inputEditor.focus()`。文件类附件走 `registerOpenEditorListeners` 会停冒泡，这两类不会，焦点与点击意图相反。
- 方向：芯片自身点击停冒泡；或容器监听仅在点空白（非 `.chat-attached-context-attachment`）时聚焦输入。
