---
title: "审查 r12：preferences"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "列表只读未生效、AI 开关误摘、偏好页切 Tab 搜索不同步、禁用 AI 仍可勾选、Clear Filters 漏其它过滤。"
---

# 审查 r12：preferences（UI）

范围：`src/vs/workbench/contrib/preferences`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 及 r01–r16 发现稿；其中无 preferences UI 命中，下列均来自本次活码。

## r12-1 高

- 症状：策略锁定或 Agents 窗口只读的数组 / include-exclude 类设置仍可双击编辑、点铅笔/删除，看起来像只读却能改。
- 代码引用：

```460:464:src/vs/workbench/contrib/preferences/browser/settingsWidgets.ts
	override setValue(listData: TListDataItem[], options?: IListSetValueOptions) {
		this.keyValueSuggester = options?.keySuggester;
		this.isEditable = options?.isReadOnly === undefined ? true : !options.isReadOnly;
		this.showAddButton = this.isEditable ? (options?.showAddButton ?? true) : false;
```

```495:498:src/vs/workbench/contrib/preferences/browser/settingsWidgets.ts
	protected getActionsForItem(item: TListDataItem, idx: number): IAction[] {
		if (this.isReadOnly) {
			return [];
		}
```

```171:173:src/vs/workbench/contrib/preferences/browser/settingsWidgets.ts
	protected get isReadOnly(): boolean {
		return false;
	}
```

```1823:1825:src/vs/workbench/contrib/preferences/browser/settingsTree.ts
	protected renderValue(dataElement: SettingsTreeSettingElement, template: ISettingIncludeExcludeItemTemplate, onChange: (value: string) => void): void {
		const value = getIncludeExcludeDisplayValue(dataElement);
		template.includeExcludeWidget.setValue(value, { isReadOnly: dataElement.hasPolicyValue || dataElement.isAgentsWindowReadOnly });
```

```1494:1497:src/vs/workbench/contrib/preferences/browser/settingsTree.ts
		template.listWidget.setValue(value, {
			showAddButton: getShowAddButtonList(dataElement, value),
			keySuggester
		});
```

- 为什么是问题：`ListSettingWidget` 把只读写进 `isEditable`，但动作栏 / 双击走的是基类 `isReadOnly`（恒为 `false`），不像 `ObjectSettingDropdownWidget` 那样覆写 getter。include/exclude 已传 `isReadOnly: true` 仍只藏「添加」；数组渲染甚至不传只读。`settingsEditor2.onDidChangeSetting` 侧也无 policy / Agents 只读拦截，控件一改就会走写入。
- 方向：让 `ListSettingWidget.isReadOnly` 反映 `!isEditable`，数组 / object / bool-object 渲染与 include-exclude 一样传入只读。

## r12-2 中

- 症状：Sessions 窗口设置搜索里，AI 结果开关在本应继续显示时被摘掉（配置或 chat 权益变更后闪一下或消失）。
- 代码引用：

```533:545:src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts
		const alreadyVisible = this.searchInputActionBar.hasAction(this.showAiResultsAction);
		if (!alreadyVisible && canShowToggle) {
			this.searchInputActionBar.push(this.showAiResultsAction, {
				index: 0,
				label: false,
				icon: true
			});
			this.searchContainer.classList.add('with-ai-toggle');
		} else if (alreadyVisible) {
			this.searchInputActionBar.pull(0);
			this.searchContainer.classList.remove('with-ai-toggle');
			this.showAiResultsAction.checked = false;
		}
```

- 为什么是问题：`else if (alreadyVisible)` 在 `canShowToggle` 仍为 true 时也会 `pull(0)`。`onDidChangeConfiguration` / `onDidChangeSentiment` 再次调用时，已显示且仍该显示的开关被移除并取消勾选。
- 方向：仅在 `alreadyVisible && !canShowToggle` 时移除。

## r12-3 中

- 症状：偏好壳多 Tab 时，搜索框仍显示上次查询，但切换后的面板内容未按该查询过滤（或残留上一面板的过滤态）。
- 代码引用：

```85:89:src/vs/workbench/contrib/preferences/browser/preferencesEditor.ts
		this._register(Event.debounce(this.searchWidget.onDidChange, () => undefined, 300)(() => {
			if (this.isHeaderSearchEnabled()) {
				this.activePreferencesPane?.search(this.searchWidget.getValue());
			}
		}));
```

```196:201:src/vs/workbench/contrib/preferences/browser/preferencesEditor.ts
		this.renderBody(selectedAction?.descriptor);

		if (this.dimension) {
			this.layout(this.dimension);
		}
		this.activePreferencesPane?.onDidShow?.();
```

- 为什么是问题：搜索只在输入变更时下发；`onDidSelectPreferencesEditorPane` 切 Tab 后只改 placeholder / 布局 / `onDidShow`，从不把当前 `searchWidget` 值交给新活跃面板。共享搜索框与缓存面板状态脱节。
- 方向：可搜索 Tab 激活后立刻 `activePreferencesPane.search(当前值)`（或清空并同步）。

## r12-4 中

- 症状：尚无 AI 结果时，禁用态 AI 开关仍可点，勾选态会翻转，列表可能按「已开 AI」重绘。
- 代码引用：

```381:383:src/vs/workbench/contrib/preferences/browser/media/settingsEditor2.css
.settings-editor > .settings-header .search-container .search-container-widgets .monaco-custom-toggle.disabled {
	pointer-events: initial;
}
```

```1037:1043:src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts
	toggleAiSearch(): void {
		if (this.searchInputActionBar && this.showAiResultsAction && this.searchInputActionBar.hasAction(this.showAiResultsAction)) {
			if (!this.showAiResultsAction.enabled) {
				aria.status(localize('noAiResults', "No AI results available at this time."));
			}
			this.showAiResultsAction.checked = !this.showAiResultsAction.checked;
		}
	}
```

- 为什么是问题：CSS 故意让 `.disabled` 仍可点；`toggleAiSearch` 在 `enabled === false` 时只播报，仍翻转 `checked`，触发 `onDidToggleAiSearch`，界面勾选与「无 AI 结果」不一致。
- 方向：禁用时只 aria 提示并 return；或恢复禁用态 `pointer-events: none`。

## r12-5 低

- 症状：仅用 `@ext:` / `@feature:` / `@id:` / 语言过滤搜到 0 条时，空态不出现「Clear Filters」，只显示「No Settings Found」。
- 代码引用：

```2474:2476:src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts
		this.clearFilterLinkContainer.style.display = this.viewState.tagFilters && this.viewState.tagFilters.size > 0
			? 'initial'
			: 'none';
```

（同文件 2203 行：进入过滤模式时会看 `tagFilters`、`extensionFilters`、`featureFilters`、`idFilters`、`languageFilter`。）

- 为什么是问题：空结果链接只认 `tagFilters`，其它过滤维度同样造成无结果，用户在空态缺少一键清过滤。
- 方向：任一过滤集合非空（或存在 languageFilter）时显示 Clear Filters，并清掉对应词元。
