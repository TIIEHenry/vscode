---
title: "审查 r15：debug"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "变量视图宽高对调；反汇编只 layout 高度；浮动调试条 y 区间缓存过期；断点区未扣 Mode 宽；悬停树更新后不重排。"
---

# 审查 r15：debug（用户可见 UI）
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`src/vs/workbench/contrib/debug`。已跳过 r09 内存读写/失效区间类问题（活码已按该方向改过）。只报用户能看见的布局/焦点/状态不一致。

## r15-1 中

- 症状：调试侧栏「变量」视图在常见竖条尺寸下树区域宽高颠倒，出现裁切、空白或滚动异常；同侧栏的监视/调用堆栈正常。
- 引用：

```220:222:src/vs/workbench/contrib/debug/browser/variablesView.ts
	protected override layoutBody(width: number, height: number): void {
		super.layoutBody(height, width);
		this.tree.layout(width, height);
```

同目录对照：

```199:201:src/vs/workbench/contrib/debug/browser/watchExpressionsView.ts
	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
```

```410:412:src/vs/workbench/contrib/debug/browser/callStackView.ts
	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
```

- 为什么是问题：框架按「先高后宽」调用 `layoutBody`。变量视图把形参命名对调，再把对调后的值传给 `super` 与 `tree.layout`，树实际拿到的是「高=面板宽、宽=面板高」。侧栏通常远高于宽，表现即错位/裁切。
- 方向：与监视/调用堆栈一致，签名与调用都改为 `(height, width)`，`tree.layout(height, width)`。

## r15-2 中

- 症状：反汇编编辑器横向拉宽或收窄后，指令表列宽不跟编辑器内容区走，出现右侧空白或横向裁切。
- 引用：

```372:374:src/vs/workbench/contrib/debug/browser/disassemblyView.ts
	layout(dimension: Dimension): void {
		this._disassembledInstructions?.layout(dimension.height);
	}
```

同模块其它视图会同时传高宽，例如：

```634:636:src/vs/workbench/contrib/debug/browser/loadedScriptsView.ts
	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
```

- 为什么是问题：`dimension` 已有权威宽度，却只把高度交给表格。表格列靠显式宽度布局；省略宽度时只能回落到当前 DOM 测量，容易沿用旧像素宽，横向缩放后列与内容区不一致。
- 方向：`this._disassembledInstructions?.layout(dimension.height, dimension.width)`。

## r15-3 中

- 症状：浮动调试工具条在标题栏/标签栏显隐变化后（如 Zen、全屏相关 part 显隐），纵向可拖区间仍按旧缓存，条可能叠进标题区或拖不到应有范围。
- 引用：

```154:157:src/vs/workbench/contrib/debug/browser/debugToolBar.ts
			if (e.affectsConfiguration(LayoutSettings.EDITOR_TABS_MODE) || e.affectsConfiguration(LayoutSettings.COMMAND_CENTER)) {
				this._yRange = undefined;
				this.setCoordinates();
			}
```

```206:206:src/vs/workbench/contrib/debug/browser/debugToolBar.ts
		this._register(this.layoutService.onDidChangePartVisibility(() => this.setCoordinates()));
```

```311:331:src/vs/workbench/contrib/debug/browser/debugToolBar.ts
	private _yRange: [number, number] | undefined;
	private get yRange(): [number, number] {
		if (!this._yRange) {
			const isTitleBarVisible = this.layoutService.isVisible(Parts.TITLEBAR_PART, dom.getWindow(this.layoutService.activeContainer));
			const yMin = isTitleBarVisible ? 0 : this.layoutService.mainContainerOffset.top;
			// ...
			this._yRange = [yMin, yMax];
		}
		return this._yRange;
	}
```

- 为什么是问题：配置变更与切窗口会清 `_yRange`，但 `onDidChangePartVisibility` 只 `setCoordinates()`，仍读缓存的 `[yMin, yMax]`。标题栏显隐改变后钳制区间过期，工具条位置与可见壳层不一致。
- 方向：part 显隐回调里先 `_yRange = undefined` 再 `setCoordinates()`。

## r15-4 中

- 症状：适配器提供多个断点 Mode 时，条件/日志断点输入框与 Mode 下拉重叠或输入区被裁切，窄编辑器更明显。
- 引用：

```382:385:src/vs/workbench/contrib/debug/browser/breakpointWidget.ts
	protected override _doLayout(heightInPixel: number, widthInPixel: number): void {
		this.heightInPx = heightInPixel;
		this.input.layout({ height: heightInPixel, width: widthInPixel - 113 });
		this.centerInputVertically();
```

```247:272:src/vs/workbench/contrib/debug/browser/breakpointWidget.ts
	private createModesInput(container: HTMLElement) {
		const modes = this.debugService.getModel().getBreakpointModes('source');
		if (modes.length <= 1) {
			return;
		}
		// ...
		const modeWrapper = $('.select-mode-container');
		// ...
		dom.append(container, modeWrapper);
	}
```

```49:63:src/vs/workbench/contrib/debug/browser/media/breakpointWidget.css
	.select-mode-container .select-box-container  {
		width: 100px;
		margin-right: 10px;
	}
```

- 为什么是问题：`113` 只近似「断点类型」下拉宽度。Mode 下拉另占约 100px+边距，却未从 `widthInPixel` 扣除，输入编辑器按偏大宽度 layout，与 flex 里真实剩余宽度不符，造成重叠或裁切。
- 方向：按实际已渲染控件量测剩余宽度（或类型+Mode 合计常量）再 `input.layout`，并避免负数宽度。

## r15-5 中

- 症状：调试悬停展开复杂值时，树区域高度/宽度常停在更新前尺寸，出现大块空白或内容被裁切，直到再次触发布局。
- 引用：

```173:184:src/vs/workbench/contrib/debug/browser/debugHover.ts
		this.toDispose.push(this.tree.onDidChangeContentHeight(() => {
			if (!this.isUpdatingTree) {
				// Don't do a layout in the middle of the async setInput
				this.layoutTreeAndContainer();
			}
		}));
		this.toDispose.push(this.tree.onDidChangeContentWidth(() => {
			if (!this.isUpdatingTree) {
				// Don't do a layout in the middle of the async setInput
				this.layoutTreeAndContainer();
			}
		}));
```

```383:387:src/vs/workbench/contrib/debug/browser/debugHover.ts
			this.isUpdatingTree = true;
			this.tree.setInput(expression).finally(() => {
				this.isUpdatingTree = false;
			}).catch(onUnexpectedError).catch(onUnexpectedError);
```

- 为什么是问题：`setInput` 期间的内容宽高变化被直接丢弃；`finally` 只清标志、不补一次 `layoutTreeAndContainer()`。最终尺寸事件若都落在抑制窗口内，悬停容器不会按新内容重排。
- 方向：在 `finally`（成功路径）里清标志后调用 `layoutTreeAndContainer()`。
