---
title: "审查 r11：welcome"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "Welcome 详情媒体在每次 layout 被拆掉重建；空窗恢复 walkthrough 可能读 folders[0] 崩；启动勾选与 welcomePageInEmptyWorkbench 不一致；窄宽下 toSide 静默不拆分；列表 itemCount 早退成 0。"
---

# 审查 r11：welcome

范围：`welcomeGettingStarted` / `welcomeViews` / `welcomeWalkthrough` / `welcomeBanner`。已有 r01–r16 发现稿未命中本路 Welcome UI。下列均来自本次读到的活码。

## r11-1 中

- 症状：Walkthrough 详情页里，拖动窗口、开关侧栏等触发编辑器 `layout` 时，右侧图片 / SVG / Markdown / 视频会闪空白或整段重载；视频从头播，Webview 内焦点丢失。
- 位置：`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` 第 1303–1317 行
- 引用：

```1303:1317:src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
	layout(size: Dimension) {
		this.detailsScrollbar.value?.scanDomNode();
		// ...
		if (this.editorInput?.selectedStep && this.currentMediaType) {
			this.mediaDisposables.clear();
			this.stepDisposables.clear();
			this.buildMediaComponent(this.editorInput.selectedStep);
		}
```

- 为什么是问题：只要当前步已有媒体类型，每次尺寸变化都清空媒体与步骤订阅再异步重建。这不是「换步」，用户只是改布局，却看到媒体区短暂空白、视频中断、焦点被拽走。
- 方向：layout 只做尺寸与 `scanDomNode` / `layoutMarkdown`；换步或主题变更时再重建媒体。

## r11-2 中

- 症状：profile 里残留「按文件夹恢复」的 walkthrough 状态时，若当前是空工作台（无 folder），启动恢复路径抛错，欢迎步无法按预期打开，恢复键也可能清不掉。
- 位置：`src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts` 第 181–183 行
- 引用：

```181:183:src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts
			const restoreData: RestoreWalkthroughsConfigurationValue = JSON.parse(toRestore);
			const currentWorkspace = this.contextService.getWorkspace();
			if (restoreData.folder === UNKNOWN_EMPTY_WINDOW_WORKSPACE.id || restoreData.folder === currentWorkspace.folders[0].uri.toString()) {
```

- 为什么是问题：`||` 右侧在左侧不成立时仍会求值。`folders` 为空时 `folders[0]` 为 `undefined`，读 `.uri` 即 `TypeError`。写入侧会把真实 folder URI 存进同一 key（`gettingStarted.ts` 约 1462–1466 行）；多窗或打开文件夹失败后，空窗启动就会踩到。异常被 `run()` 的 catch 吃掉后，恢复逻辑中断。
- 方向：先取 `folders[0]`，没有文件夹则只与 `UNKNOWN_EMPTY_WINDOW_WORKSPACE.id` 比较，或直接跳过并清理无效恢复项。

## r11-3 中

- 症状：`workbench.startupEditor` 为 `welcomePageInEmptyWorkbench`（空窗仍会出 Welcome）时，页脚「启动时显示欢迎页」勾选框显示为未勾选；用户以为已关掉，空窗再开仍出现 Welcome。勾一下再取消才会写成 `none`。
- 位置：`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` 第 928–943 行
- 引用：

```928:943:src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
		const showOnStartupCheckbox = new Toggle({
			// ...
			isChecked: this.configurationService.getValue(configurationKey) === 'welcomePage',
			// ...
		});
		const onShowOnStartupChanged = () => {
			if (showOnStartupCheckbox.checked) {
				this.configurationService.updateValue(configurationKey, 'welcomePage');
			} else {
				this.configurationService.updateValue(configurationKey, 'none');
			}
		};
```

- 为什么是问题：启动是否打开 Welcome 在 `startupPage.ts` 的 `isStartupPageEnabled` 里把 `welcomePageInEmptyWorkbench`（空工作台）也算启用，勾选框却只认精确等于 `welcomePage`。界面状态与真实启动行为不一致。
- 方向：把「会打开 Welcome 的配置值」都算作已勾选；取消时再写 `none`。

## r11-4 中

- 症状：Walkthrough 步骤里带 `command:toSide:` 的按钮，在编辑器宽度 ≤950px（已打上 `width-semi-constrained`）时点下去不会拆出侧栏；命令仍在同一组执行，Welcome 常被新内容顶掉，用户看不到「一边引导一边操作」。
- 位置：`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` 第 1389–1414 行
- 引用：

```1389:1414:src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
	private focusSideEditorGroup() {
		const fullSize = this.groupsService.getPart(this.group).contentDimension;
		if (!fullSize || fullSize.width <= 700 || this.container.classList.contains('width-constrained') || this.container.classList.contains('width-semi-constrained')) { return; }
		// ... addGroup / activateGroup ...
	}
	private runStepCommand(href: string) {
		// ...
		if (toSide) {
			this.focusSideEditorGroup();
		}
```

- 为什么是问题：`layout` 在宽度 ≤950 时加上 `width-semi-constrained`（约 1323 行）。`toSide` 依赖先 `focusSideEditorGroup` 再跑命令；该函数在常见宽度下直接 return，却不取消后续 `executeCommand`。媒体区此时已被 CSS 隐藏，侧栏拆分也没有，表现成「点了像开侧栏，结果当前 Welcome 被替换」。
- 方向：窄宽下要么仍拆分（可接受更窄侧栏），要么在无法 `toSide` 时改交互（提示 / 先保留 Welcome），不要静默退化成同组顶替。

## r11-5 中

- 症状：Welcome 列表在上下文未改变可见项时被 `rerender` / `setLimit` 后，内部 `itemCount` 变成 0；之后从详情「返回」会误判列表与分类数不一致，整页分类滑页被拆掉重建，焦点和滚动位置丢，偶发像闪一下空白。
- 位置：`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedList.ts` 第 96–112 行；触发读点 `gettingStarted.ts` 第 1744–1747 行
- 引用：

```96:112:src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedList.ts
	setEntries(entries: undefined | T[]) {
		let entryList = entries ?? [];

		this.itemCount = 0;
		// ... filter / limit → toRender ...
		if (this.entries === entries && equals(toRender, this.lastRendered)) { return; }
```

```1744:1747:src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
				if (this.gettingStartedCategories.length !== this.gettingStartedList.value?.itemCount) {
					// extensions may have changed in the time since we last displayed the walkthrough list
					this.buildCategoriesSlide();
				}
```

- 为什么是问题：早退前已经把 `itemCount` 置 0，且未恢复。上下文键变化但限长列表内容不变时，`rerender` 走早退，DOM 仍在，计数却是 0。`scrollPrev` 用 `categories.length !== itemCount` 判断是否重建，几乎总会重建，造成可见闪烁与焦点丢失。
- 方向：早退前不要改 `itemCount`，或早退时写回 `limitedEntries.length`。
