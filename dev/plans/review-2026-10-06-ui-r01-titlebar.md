---
title: "审查 r01：titlebar"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "读屏标题不跟装饰；命令中心 compact 不跟配置；isPure 不上屏；窄窗裁切窗控；菜单焦点外仍刷新。"
---

# 审查 r01：titlebar

范围：`src/vs/workbench/browser/parts/titlebar`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 与 [r11 workbench-shell](review-2026-10-06-r11-workbench-shell.md)；既有条目未涉及本目录活码，无命中跳过。

## r01-1 中

- 症状：开启读屏优化且未在 `window.title` 模板里写 `${activeEditorState}` 时，标题会拼上编辑器状态，但之后装饰变化（如 Modified）时标题长时间不刷新，读屏读到的窗口名与当前状态不一致。
- 引用：

```144:186:src/vs/workbench/browser/parts/titlebar/windowTitle.ts
	private checkTitleVariables(): void {
		const titleTemplate = this.configurationService.getValue<unknown>(WindowSettingNames.title);
		if (typeof titleTemplate === 'string') {
			this.titleIncludesFocusedView = titleTemplate.includes('${focusedView}');
			this.titleIncludesEditorState = titleTemplate.includes('${activeEditorState}');
		}
	}
	// ...
		if (this.titleIncludesEditorState) {
			this.activeEditorListeners.add(this.decorationsService.onDidChangeDecorations(() => this.titleUpdater.schedule()));
		}
```

```377:379:src/vs/workbench/browser/parts/titlebar/windowTitle.ts
		if (!this.titleIncludesEditorState && this.accessibilityService.isScreenReaderOptimized() && this.configurationService.getValue('accessibility.windowTitleOptimized')) {
			titleTemplate += '${separator}${activeEditorState}';
		}
```

- 为什么是问题：`getWindowTitle` 在读屏优化下会动态追加 `activeEditorState`，但订阅装饰变化的开关只看模板里是否写了该变量。动态追加时 `titleIncludesEditorState` 仍为 false，装饰服务变更不会 `schedule`，标题停留在旧状态。
- 方向：读屏优化追加状态时，把装饰监听与 `titleIncludesEditorState` 一并视为需要。

## r01-2 中

- 症状：改 `chat.agentsControl.enabled`（或相关 AI 关闭项）后，命令中心搜索按钮仍保持旧的 compact/非 compact 布局（有无搜索图标、标签对齐），与当前设置不一致，直到整段标题被重建。
- 引用：

```166:193:src/vs/workbench/browser/parts/titlebar/commandCenterControl.ts
							const aiFeaturesDisabled = that._configurationService.getValue<boolean>(ChatAIDisabledSettingId) === true;
							const aiCustomizationsDisabled = that._configurationService.getValue<boolean>('disableAICustomizations') === true
								|| that._configurationService.getValue<boolean>('workbench.disableAICustomizations') === true;
							const forcedHidden = aiFeaturesDisabled && aiCustomizationsDisabled;
							const agentControlValue = that._configurationService.getValue(AGENT_STATUS_ENABLED_SETTING);
							const isCompactMode = !forcedHidden && (agentControlValue === true || agentControlValue === undefined || agentControlValue === 'compact');
							container.classList.toggle('compact-mode', isCompactMode);
							// ...
							if (isCompactMode) {
								reset(container, labelElement);
							} else {
								reset(container, searchIcon, labelElement);
							}
```

- 为什么是问题：compact 只在 `render` 时读一次配置；同段只监听了窗口标题与标签页选项，没有配置变更监听，也未在配置变化时重摆 DOM。
- 方向：订阅相关配置变更并重算 compact，或触发命令中心该项重建。

## r01-3 中

- 症状：窗口被标成非纯净（`isPure === false`）时，标题栏/原生标题不会出现任何对应提示，看起来仍像普通窗口。
- 引用：

```234:266:src/vs/workbench/browser/parts/titlebar/windowTitle.ts
	getTitleDecorations() {
		let prefix: string | undefined;
		let suffix: string | undefined;
		// ... 只用 prefix / extensionDevelopment / isAdmin
		if (this.properties.isAdmin) {
			suffix = WindowTitle.NLS_USER_IS_ADMIN;
		}
		return { prefix, suffix };
	}

	updateProperties(properties: ITitleProperties): void {
		const isAdmin = typeof properties.isAdmin === 'boolean' ? properties.isAdmin : this.properties.isAdmin;
		const isPure = typeof properties.isPure === 'boolean' ? properties.isPure : this.properties.isPure;
		// ...
		if (isAdmin !== this.properties.isAdmin || isPure !== this.properties.isPure || prefix !== this.properties.prefix) {
			this.properties.isPure = isPure;
			this.titleUpdater.schedule();
		}
	}
```

- 为什么是问题：`isPure` 变化会写入并触发标题刷新，但 `getTitleDecorations` / `getWindowTitle` 从不读取它；若仅 `isPure` 变化，算出的标题字符串不变，用户看不到状态差异。
- 方向：在装饰前缀/后缀中体现非纯净，或不再把 `isPure` 当作会改变标题的条件。

## r01-4 中

- 症状：标题栏较窄且右侧动作较多时，最小化/最大化/关闭被裁切，点不到；可选工具条已藏起后仍可能发生。
- 引用：

```961:975:src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
	private updateTitleBarToolBarOverflow(): void {
		const centerAdjacentToolBarElement = this.centerAdjacentToolBarElement?.classList.contains('has-no-actions') ? undefined : this.centerAdjacentToolBarElement;
		const updateToolBarElement = this.updateToolBarElement?.classList.contains('has-no-actions') ? undefined : this.updateToolBarElement;

		this.centerAdjacentToolBarElement?.classList.remove('overflowing');
		this.updateToolBarElement?.classList.remove('overflowing');

		if (this.rootContainer.scrollWidth <= this.rootContainer.clientWidth) {
			return;
		}

		centerAdjacentToolBarElement?.classList.add('overflowing');
		if (this.rootContainer.scrollWidth > this.rootContainer.clientWidth) {
			updateToolBarElement?.classList.add('overflowing');
		}
	}
```

```18:20:src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
.monaco-workbench .part.titlebar > .titlebar-container {
	box-sizing: border-box;
	overflow: hidden;
```

```101:106:src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css
.monaco-workbench .part.titlebar > .titlebar-container.has-center > .titlebar-right {
	order: 2;
	width: 20%;
	min-width: min-content;
	flex-grow: 2;
	justify-content: flex-end;
}
```

- 为什么是问题：注释写明要避免窗控被挤出屏外，但溢出时只给 center-adjacent / update 打 `overflowing`，`action-toolbar-container` 不参与收缩；右侧 `min-width: min-content` 且容器 `overflow: hidden`，多余宽度直接裁切窗控命中区。
- 方向：溢出时继续收敛 action toolbar（或允许右侧收缩），保证窗控始终在可点区域内。

## r01-5 中

- 症状：自定义菜单打开且焦点落到菜单浮层后，菜单项仍可能被后台刷新打乱（条目跳动、焦点丢失、点空）。
- 引用：

```551:558:src/vs/workbench/browser/parts/titlebar/menubarControl.ts
			// Before we focus the menubar, stop updates to it so that focus-related context keys will work
			this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_IN, () => {
				this.focusInsideMenubar = true;
			}));

			this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_OUT, () => {
				this.focusInsideMenubar = false;
			}));
```

```617:623:src/vs/workbench/browser/parts/titlebar/menubarControl.ts
				this.reinstallDisposables.add(menu.onDidChange(() => {
					if (!this.focusInsideMenubar) {
						const actions: IAction[] = [];
						menuChangedDisposable.clear();
						updateActions(this.toActionsArray(menu), actions, title, menuChangedDisposable);
						this.menubar?.updateMenu({ actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
					}
				}));
```

- 为什么是问题：停更依赖 `focusInsideMenubar`。下拉菜单在 container 外的浮层里，焦点一进浮层就 `FOCUS_OUT`，标志被清掉；而 `MenuBar` 仍视为菜单打开。此时 `onDidChange` 会 `updateMenu`，活菜单被重写。
- 方向：停更应对齐 `menubar` 的 focus/open 状态，而不是 container 的 `FOCUS_OUT`。
