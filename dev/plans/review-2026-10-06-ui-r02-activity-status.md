---
title: "审查 r02：activity-status"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "浮动活动栏徽章裁切；进度条空文藏起；同 id 横幅不刷新；侧栏换边槽宽不更新；关闭钮键盘未可聚焦。"
---

# 审查 r02：activity-status
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`activitybar` / `statusbar` / `banner`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 与 r11 workbench-shell；下列均未在既有发现中出现。

## r02-1 中

- 症状：Modern UI / 浮动面板下（活动栏非 Compact），视图角标数字或图标下半被裁掉，计数看不全。
- 引用：

```54:55:src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
	static readonly FLOATING_ACTION_HEIGHT = 36;
	static readonly FLOATING_ACTIVITYBAR_WIDTH = 36;
```

```244:246:src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
			this.element.style.setProperty('--activity-bar-width', `${this.baseWidth}px`);
			this.element.style.setProperty('--activity-bar-action-height', `${this.actionHeight}px`);
			this.element.style.setProperty('--activity-bar-action-gap', `${this.actionGap}px`);
```

```162:173:src/vs/workbench/browser/parts/activitybar/media/activityaction.css
.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .profile-badge,
.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .active-item-indicator,
.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .badge {
	position: absolute;
	top: 0;
	bottom: 0;
	margin: auto;
	left: 0;
	overflow: hidden;
	width: 100%;
	height: 100%;
}
```

```192:208:src/vs/workbench/browser/parts/activitybar/media/activityaction.css
.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .badge .badge-content {
	position: absolute;
	top: 24px;
	right: 8px;
	font-size: 9px;
	font-weight: 600;
	min-width: 8px;
	height: 16px;
	line-height: 16px;
	padding: 0 4px;
	border-radius: 20px;
	text-align: center;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
```

- 为什么是问题：浮动默认把 `--activity-bar-action-height` 设为 36，而徽章仍按 48 高栏位写死 `top: 24px` + `height: 16px`（需 40px）。父级 `.badge` 又 `overflow: hidden` 且高度 100%，多出的 4px 被裁切。仅 `.activitybar.compact` 有另一套 top/height，浮动非 Compact 走不到。
- 方向：徽章定位随 `--activity-bar-action-height` 缩放，或为浮动默认单独给一套 top/height。

## r02-2 中

- 症状：状态栏条目 `showProgress` 为真且 `text` 为空（或随后被清成空）时，转圈进度不出现；用户以为没有在同步/加载。
- 引用：

```91:105:src/vs/workbench/browser/parts/statusbar/statusbarItem.ts
	update(entry: IStatusbarEntry): void {

		// Update: Progress
		this.label.showProgress = entry.showProgress ?? false;

		// Update: Text
		if (!this.entry || entry.text !== this.entry.text) {
			this.label.text = entry.text;

			if (entry.text) {
				show(this.labelContainer);
			} else {
				hide(this.labelContainer);
			}
		}
```

```313:338:src/vs/workbench/browser/parts/statusbar/statusbarItem.ts
	override set text(text: string) {

		// Progress: insert progress codicon as first element as needed
		// but keep it stable so that the animation does not reset
		if (this.currentShowProgress && this.progressCodicon) {

			// Append as needed
			if (this.container.firstChild !== this.progressCodicon) {
				this.container.appendChild(this.progressCodicon);
			}
			// ...
			append(this.container, ...renderLabelWithIcons(textContent));
```

- 为什么是问题：进度图标画在 `labelContainer` 里，但容器显隐只看 `entry.text` 是否非空，且仅在 text 变化时更新。`text === ''` 且 `showProgress` 会 `hide(labelContainer)`；若先前已是空文再打开进度，text 分支不跑，容器一直 `display: none`，进度状态与画面不一致。
- 方向：`labelContainer` 在 `text` 非空或 `showProgress` 为真时显示。

## r02-3 中

- 症状：同一横幅 id 再次 `show` 且文案/操作已变时，界面仍是旧消息和旧链接。
- 引用：

```181:185:src/vs/workbench/browser/parts/banner/bannerPart.ts
	show(item: IBannerItem): void {
		if (item.id === this.item?.id) {
			this.setVisibility(true);
			return;
		}
```

- 为什么是问题：同 id 只保证可见，不重建 DOM、不替换 `this.item` 的展示字段。调用方用同一 id 更新提示时，用户看到的仍是第一次的内容，显示与传入状态不一致。
- 方向：同 id 时若 message/actions/icon 有变则重建；或文档约定同 id 不可变并另提供 update。

## r02-4 中

- 症状：浮动面板开启、主侧栏隐藏时，把侧栏从左侧改到右侧（或反向），活动栏多出一条空白边，或图标列贴边被挤/裁切。
- 引用：

```170:174:src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
	private get needsFloatingLeadingGap(): boolean {
		return !this.layoutService.isModernUICompact()
			&& this.layoutService.getSideBarPosition() === Position.RIGHT
			&& !this.layoutService.isVisible(Parts.SIDEBAR_PART);
	}
```

```219:225:src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
		this._register(this.layoutService.onDidChangePartVisibility(e => {
			if (e.partId === Parts.SIDEBAR_PART && this.layoutService.isFloatingPanelsEnabled()) {
				this._onDidChange.fire(undefined);
			}
		}));
```

```99:100:src/vs/workbench/browser/parts/activitybar/activitybarPart.ts
	get minimumWidth(): number { return this.baseWidth + this.floatingHorizontalGutter; }
	get maximumWidth(): number { return this.baseWidth + this.floatingHorizontalGutter; }
```

- 为什么是问题：`floatingHorizontalGutter` 依赖 `needsFloatingLeadingGap`，后者同时看侧栏位置与可见性。可见性变化会 `_onDidChange` 让网格重读宽约束；位置变化没有对应订阅。侧栏隐藏时只改左右位置，槽宽仍按旧 gutter，出现多余空隙或宽度不够导致裁切。
- 方向：侧栏位置变更时同样 `fire` 尺寸变更（或听布局/配置里侧栏位置项）。

## r02-5 中

- 症状：焦点在横幅上用方向键走到关闭钮时，关闭钮拿不到可聚焦状态，键盘无法可靠落到关闭并激活。
- 引用：

```109:120:src/vs/workbench/browser/parts/banner/bannerPart.ts
	private focusActionLink(): void {
		const length = this.item?.actions?.length ?? 0;

		if (this.focusedActionIndex < length) {
			const actionLink = this.messageActionsContainer?.children[this.focusedActionIndex];
			if (isHTMLElement(actionLink)) {
				this.actionBar?.setFocusable(false);
				actionLink.focus();
			}
		} else {
			this.actionBar?.focus(0);
		}
	}
```

```223:229:src/vs/workbench/browser/parts/banner/bannerPart.ts
		const actionBarContainer = append(this.element, $('div.action-container'));
		this.actionBar = this._register(new ActionBar(actionBarContainer));
		const label = item.closeLabel ?? localize('closeBanner', "Close Banner");
		const closeAction = this._register(new Action('banner.close', label, ThemeIcon.asClassName(widgetClose), true, () => this.close(item)));
		this.actionBar.push(closeAction, { icon: true, label: false });
		this.actionBar.setFocusable(false);
```

- 为什么是问题：创建时与切到消息链接时都把 ActionBar 设为不可聚焦；切到关闭钮的分支只 `focus(0)`，从未 `setFocusable(true)`。与链接分支显式关聚焦不对称，关闭项保持不可聚焦，方向键闭环在链接与关闭之间时关闭侧失效或焦点丢失。
- 方向：进入关闭钮分支时先 `setFocusable(true)` 再 `focus(0)`。
