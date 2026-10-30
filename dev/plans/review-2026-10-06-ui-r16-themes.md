---
title: "审查 r16：themes"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "卸载暗色主题闪白；启动 INITIAL 色板与产品默认不一致；默认主题失焦标签与暗色禁用/占位对比度过低；换默认主题提示在无焦点时永久漏出。"
---

# 审查 r16：themes
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`extensions/theme-*` 与 `src/vs/workbench/services/themes`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 及 r01–r16 发现稿（原 r16 为 tooling，与主题无关）；既有条目未命中本目录活码，无跳过项。

## r16-1 中

- 症状：当前在用的颜色主题随扩展被卸掉或贡献被移除时，界面会切到「UniverseAgentStudio Light」；若原先是暗色主题，整窗突然变亮。扩展恢复后，也只有当时仍停在 Light 默认上才会自动切回。
- 引用：

```396:400:src/vs/workbench/services/themes/browser/workbenchThemeService.ts
			} else if (event.removed.some(t => t.settingsId === this.currentColorTheme.settingsId)) {
				// current theme is no longer available
				prevColorId = this.currentColorTheme.id;
				const defaultTheme = this.colorThemeRegistry.findThemeBySettingsId(ThemeSettingDefaults.COLOR_THEME_LIGHT);
				await this.setColorTheme(defaultTheme, 'auto');
			}
```

```390:392:src/vs/workbench/services/themes/browser/workbenchThemeService.ts
				if (this.currentColorTheme.settingsId === ThemeSettingDefaults.COLOR_THEME_LIGHT && !types.isUndefined(prevColorId) && await this.colorThemeRegistry.findThemeById(prevColorId)) {
					await this.setColorTheme(prevColorId, 'auto');
					prevColorId = undefined;
```

- 为什么是问题：同文件 `initializeColorTheme`（约 213 行）会按 `currentColorTheme.type` 在 Light/Dark 默认间回退，注册表变更路径却写死 Light。暗色用户会看到显示与预期主题类型不一致；若回退期间又换过主题，392 行的还原条件也不再成立。
- 方向：按被移除主题的 `type`（或当前配色方案）选择 Light/Dark/HC 默认，还原时不要只认 Light。

## r16-2 中

- 症状：首次启动、清过主题缓存，或设置里的主题 ID 与 storage 不一致时，工作台会先刷出旧版 Light/Dark Modern 色（如侧栏 `#F8F8F8` / `#181818`、强调色 `#005FB8` / `#0078D4`），等产品默认主题加载完再跳到 Universe/2026 色板，壳层颜色闪一下。
- 引用：

```154:166:src/vs/workbench/services/themes/browser/workbenchThemeService.ts
		const defaultColorMap = colorThemeSetting === ThemeSettingDefaults.COLOR_THEME_LIGHT ? COLOR_THEME_LIGHT_INITIAL_COLORS : colorThemeSetting === ThemeSettingDefaults.COLOR_THEME_DARK ? COLOR_THEME_DARK_INITIAL_COLORS : undefined;
		if (!themeData) {
			const initialColorTheme = environmentService.options?.initialColorTheme;
			if (initialColorTheme) {
				themeData = ColorThemeData.createUnloadedThemeForThemeType(initialColorTheme.themeType, initialColorTheme.colors ?? defaultColorMap);
			}
		}
		if (!themeData) {
			const colorScheme = this.settings.getPreferredColorScheme() ?? ColorScheme.LIGHT;
			themeData = ColorThemeData.createUnloadedThemeForThemeType(colorScheme, defaultColorMap);
		}
		themeData.setCustomizations(this.settings);
		this.applyTheme(themeData, undefined, true);
```

```214:217:src/vs/workbench/services/themes/common/workbenchThemeService.ts
export const COLOR_THEME_LIGHT_INITIAL_COLORS = {
	'actionBar.toggledBackground': '#dddddd',
	'activityBar.activeBorder': '#005FB8',
	'activityBar.background': '#F8F8F8',
```

```72:75:src/vs/workbench/services/themes/common/workbenchThemeService.ts
export const COLOR_THEME_DARK_INITIAL_COLORS = {
	'actionBar.toggledBackground': '#383a49',
	'activityBar.activeBorder': '#0078D4',
	'activityBar.background': '#181818',
```

```3:11:extensions/theme-defaults/themes/universe-agent-studio-light.json
	"include": "./2026-light.json",
	"type": "light",
	"colors": {
		"widget.border": "#E2E2E2",
		"editorStickyScrollHover.background": "#F0F0F0",
		"activityBar.background": "#F3F3F3",
```

```3:5:extensions/theme-defaults/themes/universe-agent-studio-dark.json
	"include": "./2026-dark.json",
	"type": "dark",
```

（`2026-light.json` / `2026-dark.json` 中侧栏为 `#F3F3F6` / `#191A1B`，强调色为 `#0069CC` / `#297AA0` 一带，与 INITIAL 不一致。）

- 为什么是问题：产品默认已是 `UniverseAgentStudio Light/Dark`（`ThemeSettingDefaults` + `theme-defaults/package.json`），启动占位色仍停留在旧 Modern 调色板。设置与 storage 的 `settingsId` 不一致时（150–152 行）会丢掉缓存并走 INITIAL，升级换默认主题时闪错尤其明显。
- 方向：把 `COLOR_THEME_*_INITIAL_COLORS` 同步成当前产品默认（Universe → 2026）的壳层色。

## r16-3 中

- 症状：默认主题（Universe → include 2026）下，失焦编辑器组里未激活标签的标题几乎看不清，难靠颜色辨认打开了哪些文件。
- 引用：

```209:212:extensions/theme-defaults/themes/2026-light.json
		"tab.unfocusedActiveForeground": "#606060",
		"tab.unfocusedInactiveBackground": "#FAFAFD",
		"tab.unfocusedInactiveForeground": "#BBBBBB",
		"editorGroupHeader.tabsBackground": "#FAFAFD",
```

```203:205:extensions/theme-defaults/themes/2026-dark.json
		"tab.unfocusedActiveForeground": "#8C8C8C",
		"tab.unfocusedInactiveBackground": "#191A1B",
		"tab.unfocusedInactiveForeground": "#444444",
```

- 为什么是问题：`#BBBBBB` 在 `#FAFAFD` 上对比度约 1.84:1，`#444444` 在 `#191A1B` 上约 1.79:1，远低于常规正文可读阈值；产品默认链经 `universe-agent-studio-*.json` 的 `include` 原样继承，默认用户必中。
- 方向：把失焦未激活标签前景至少抬到与 `tab.inactiveForeground` 同级或可辨的对比度。

## r16-4 中

- 症状：默认暗色主题下，禁用文案、输入占位符、列表无效项颜色过暗，贴在侧栏/输入底上难以辨认。
- 引用：

```7:9:extensions/theme-defaults/themes/2026-dark.json
		"disabledForeground": "#555555",
		"errorForeground": "#f48771",
		"descriptionForeground": "#8C8C8C",
```

```38:38:extensions/theme-defaults/themes/2026-dark.json
		"input.placeholderForeground": "#555555",
```

```70:70:extensions/theme-defaults/themes/2026-dark.json
		"list.invalidItemForeground": "#444444",
```

```83:83:extensions/theme-defaults/themes/2026-dark.json
		"sideBar.background": "#191A1B",
```

- 为什么是问题：`#555555` / `#444444` 相对 `#191A1B` 对比度约 2.34:1 / 1.79:1。Universe Dark 只改 badge 色（`universe-agent-studio-dark.json`），这些前景色仍来自 2026-dark，默认暗色用户会看不清禁用态与占位提示。
- 方向：提高 `disabledForeground`、`input.placeholderForeground`、`list.invalidItemForeground` 相对侧栏/输入背景的对比度。

## r16-5 低

- 症状：从旧默认（Dark/Light Modern）升到 Universe 默认时，本应出现的「新默认主题」提示在启动当时窗口没有 last focus 时会永久不再出现，用户无法从提示里一键回到 Modern。
- 引用：

```256:262:src/vs/workbench/services/themes/browser/workbenchThemeService.ts
	private async showNewDefaultThemeNotification(previousSettingsId: string | undefined): Promise<void> {
		if (this.storageService.getBoolean(WorkbenchThemeService.NEW_THEME_NOTIFICATION_KEY, StorageScope.APPLICATION)) {
			return; // already shown
		}
		if (!(await this.hostService.hadLastFocus()) || this.environmentService.isSessionsWindow) {
			return;
		}
```

```248:250:src/vs/workbench/services/themes/browser/workbenchThemeService.ts
		this.migrateColorThemeSettings();
		const result = await Promise.all([initializeColorTheme(), initializeFileIconTheme(), initializeProductIconTheme()]);
		await this.showNewDefaultThemeNotification(themePreviousSettingsId);
```

- 为什么是问题：无焦点时在写入 `NEW_THEME_NOTIFICATION_KEY` 之前就 return，但 `initialize` 只在扩展注册后跑一次，之后不会因获得焦点再调。符合「storage 仍是 Modern、设置已是 Universe 默认」的升级用户会永远看不到 282–300 行的提示。
- 方向：无焦点时不要结束流程，改为获得焦点后再提示，或把「待提示」与「已提示」分开存。
