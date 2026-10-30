---
title: "方案 r16：themes"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "卸载主题按色板回退；启动占位色对齐 Universe 默认；暗色禁用/占位/无效项提高对比度；无焦点时延后新默认主题提示。"
---

# 方案 r16：themes
状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r16-1 卸载当前颜色主题时按色板回退

问题类：当前颜色主题从注册表消失时，回退写死 `ThemeSettingDefaults.COLOR_THEME_LIGHT`，主题重新出现时也只在仍停在 Light 默认时才还原。

不变量：

- 进入移除分支时，用移除前的 `currentColorTheme.type` 选择回退 settingsId：`ColorScheme.LIGHT` → `COLOR_THEME_LIGHT`，`ColorScheme.DARK` → `COLOR_THEME_DARK`，`ColorScheme.HIGH_CONTRAST_DARK` → `COLOR_THEME_HC_DARK`，`ColorScheme.HIGH_CONTRAST_LIGHT` → `COLOR_THEME_HC_LIGHT`。
- 仅当 `colorThemeRegistry.findThemeBySettingsId` 找到该默认主题时才 `setColorTheme(..., 'auto')`，并记下这次写入的 settingsId 与 `prevColorId`。
- 之后 `restoreColorTheme()` 成功且当前 `settingsId` 仍等于这次写下的回退 id、且 `prevColorId` 已回到注册表时，才 `setColorTheme(prevColorId, 'auto')` 并清掉这两份记录。
- 当前 `settingsId` 已离开这次回退 id 时，清掉 `prevColorId` 与回退 id，避免用户以后自己选回该默认主题时被误还原。

要动的符号或文件：

- `src/vs/workbench/services/themes/common/workbenchThemeService.ts`：在 `ThemeSettingDefaults` 旁新增纯函数，把 `ColorScheme` 映射到上述四个 settingsId。
- `src/vs/workbench/services/themes/browser/workbenchThemeService.ts` 的 `installRegistryListeners` 内 `onColorThemeRegistryChangeNow`：移除分支（现为写死 `COLOR_THEME_LIGHT` 的 `setColorTheme`）与紧挨着的还原条件（现为只比较 `COLOR_THEME_LIGHT`）。

保持不动：

- `initialize` 里的 `initializeColorTheme`（约 213 行，仍只在 Light 与 Dark 之间回退）。
- `onFileIconThemeRegistryChangeNow`、`onProductIconThemeRegistryChangeNow`。
- `restoreColorTheme()` 本身，以及 `event.added` 时 `reloadCurrentColorTheme()` 那条分支。

本地验证：没有覆盖该路径的现成测试。在 `src/vs/workbench/services/themes/test/common/workbenchThemeService.test.ts` 的 suite `WorkbenchThemeService` 为新纯函数加上四色板映射断言。浏览器侧断言意图：暗色主题被移除且 `restoreColorTheme()` 为 false 时，`setColorTheme` 的目标 settingsId 为 `ThemeSettingDefaults.COLOR_THEME_DARK`；主题加回且当前仍是该回退 id 时还原 `prevColorId`；当前已改到别的 settingsId 时不还原。本地跑 `scripts/test.sh --grep WorkbenchThemeService`。

## r16-2 启动占位色对齐产品默认主题

问题类：设置已是 `UniverseAgentStudio Light/Dark` 但没有可用主题缓存时，首帧仍刷旧版 Light/Dark Modern 壳层色，主题 JSON 加载完再跳到 Universe 色板。

不变量：

- `settings.colorTheme` 等于 `ThemeSettingDefaults.COLOR_THEME_LIGHT` 或 `COLOR_THEME_DARK`，且构造函数里因无缓存或 settingsId 与 storage 不一致而走 `createUnloadedThemeForThemeType(..., defaultColorMap)` 时，`defaultColorMap` 里凡是产品默认主题能解析到的键，都等于该主题的最终色。
- 最终色的覆盖顺序与主题文件一致：`light_modern.json` / `dark_modern.json` 被 `2026-light.json` / `2026-dark.json` 覆盖，再被 `universe-agent-studio-light.json` / `universe-agent-studio-dark.json` 覆盖。亮色侧栏、活动栏、状态栏因此是 Universe 的 `#F3F3F3`，暗色侧栏与活动栏是 2026 的 `#191A1B`；强调色离开 `#005FB8` / `#0078D4`。

要动的符号或文件：

- `src/vs/workbench/services/themes/common/workbenchThemeService.ts` 的 `COLOR_THEME_LIGHT_INITIAL_COLORS`、`COLOR_THEME_DARK_INITIAL_COLORS`。

保持不动：

- `workbenchThemeService.ts` 构造函数里选择 `defaultColorMap` 的条件（只有产品默认 Light/Dark 才用这两份表；其它主题仍为 `undefined`）。
- `environmentService.options.initialColorTheme` 优先于 `defaultColorMap` 的分支。
- `extensions/theme-defaults/themes/` 下的主题 JSON（本条只改启动占位表）。
- 现有测试 `product default themes are registered and are not Light 2026` 对 Universe JSON 键集合的断言。

本地验证：同一 suite `WorkbenchThemeService`、文件 `workbenchThemeService.test.ts` 新增断言：按上述三层 `colors` 合并后，两份 `COLOR_THEME_*_INITIAL_COLORS` 中每个也出现在合并结果里的键与合并结果相等。至少覆盖 `activityBar.background`、`activityBar.activeBorder`、`sideBar.background`、`button.background`，并确认它们不再是 `#F8F8F8`、`#005FB8`、`#181818`、`#0078D4`。本地跑 `scripts/test.sh --grep WorkbenchThemeService`。

## r16-4 默认暗色的禁用、占位与无效项

问题类：Universe Dark 经 `include` 用上 2026 Dark 的 `disabledForeground`、`input.placeholderForeground`、`list.invalidItemForeground` 后，这三色贴在 `#191A1B` 上过暗。

不变量：

- 这三项仍定义在 `2026-dark.json`，`universe-agent-studio-dark.json` 继续不覆盖它们。
- `disabledForeground` 与 `input.placeholderForeground` 改为 `#8C8C8C`（与同文件 `descriptionForeground` 相同）。对照同文件 `sideBar.background` / `input.background` 的 `#191A1B`，对比度与 `#8C8C8C` 相同。
- `list.invalidItemForeground` 改回颜色注册表默认 `#B89500`（`listInvalidItemForeground`，供 `provideDecorations` 里无法解析的工作区根上的 `!` 使用），保持警告色相，不改成灰。

要动的符号或文件：

- `extensions/theme-defaults/themes/2026-dark.json` 的 `disabledForeground`、`input.placeholderForeground`、`list.invalidItemForeground`。

保持不动：

- `universe-agent-studio-dark.json` 与 `universe-agent-studio-light.json`。
- `2026-light.json`。
- `src/vs/platform/theme/common/colors/baseColors.ts`、`inputColors.ts`、`listColors.ts` 里的注册默认值。
- 同文件的 `descriptionForeground`、`errorForeground`、`list.warningForeground`。
- 现有测试锁定的 Universe Dark `colors` 键集合（仅四枚 badge）。

本地验证：没有对比度测试。在 suite `WorkbenchThemeService` 新增断言：读入 `2026-dark.json`，上述两项为 `#8C8C8C`，`list.invalidItemForeground` 为 `#B89500`；`universe-agent-studio-dark.json` 的 `colors` 不含这三键。本地跑 `scripts/test.sh --grep WorkbenchThemeService`。

## r16-5 无焦点时延后「新默认主题」提示

问题类：启动时窗口没有 last focus，新默认主题提示被跳过；同一次 `initialize` 里主题写入 storage 之后，下次启动不再带着 Dark/Light Modern 的 `previousSettingsId`，有焦点的那次还会把已提示键写成 true。

不变量：

- storage 中旧 settingsId 为 `Dark Modern` 或 `Light Modern`（先经 `migrateThemeSettingsId`），当前 `isDefaultColorTheme()` 为 true，且 `settings.colorTheme` 为 `COLOR_THEME_DARK` 或 `COLOR_THEME_LIGHT` 时，该窗口最终仍弹出现有提示一次。
- `hadLastFocus()` 为 false 时不写 `WorkbenchThemeService.NEW_THEME_NOTIFICATION_KEY`（`workbench.newDefaultThemeNotification`）。把当时的 previousSettingsId 写入同为 `StorageScope.APPLICATION`、`StorageTarget.USER` 的待提示键，并在 `IHostService.onDidChangeFocus` 变为 true 时再走弹出路径。`initialize` 在登记监听后立即返回，不把启动堵在焦点上。
- 决定弹出时（现有 `try/finally` 在 `await` 提示之前写已提示键的时机）写已提示键并清掉待提示键。提示正文、`themeUpdated.tryItOut` / `themeUpdated.noThanks` 与取消后切回 Modern 的行为保持原样。
- 下次 `initialize` 从颜色主题 storage 读到的 settingsId 已是产品默认时，只要待提示键仍在且本窗口有 last focus，仍然弹出，而不是因 previous 参数已不是 Modern 就在 `finally` 里把已提示键写成 true。
- `environmentService.isSessionsWindow` 为 true：不弹出、不写已提示键、不清待提示键；若本次参数仍是 Modern 且资格成立，只把待提示键写上，留给非 Sessions 窗口。
- 已提示键为 true：直接返回。
- 资格不成立且不是 Sessions 窗口：写已提示键并清待提示键（与现在 `finally` 对「不是默认主题 / previous 不是 Modern」的落键相同）。

要动的符号或文件：

- `src/vs/workbench/services/themes/browser/workbenchThemeService.ts` 的 `showNewDefaultThemeNotification`，以及 `initialize` 里在 `initializeColorTheme()` 之后调用它的那一行所依赖的 previousSettingsId。弹出路径读取「本次参数，否则待提示键」。
- `src/vs/workbench/services/themes/common/workbenchThemeService.ts`：把「是否弹出 / 是否延后 / 是否写已提示键 / 待提示键写或清」抽成纯函数，供上面的方法调用。

保持不动：

- `applyTheme` 里 `toStorage` 的时机与 `ColorThemeData.toStorage`。
- `migrateColorThemeSettings`。
- 提示文案键 `themeUpdatedNotification` 与两个 action 的 id。
- 浏览器宿主 `hadLastFocus()` 恒为 true 的实现。
- 文件图标与产品图标的初始化。

本地验证：没有 `showNewDefaultThemeNotification` 的现成测试。在 suite `WorkbenchThemeService` 对纯函数断言：

- previous 为 `Dark Modern` 或 `Light Modern`、当前为产品默认、`hadLastFocus` 为 false、非 Sessions：不标记已提示，待提示键写入该 id，动作为等到焦点。
- 同上但 `hadLastFocus` 为 true：动作为弹出，并标记已提示、清待提示键。
- 颜色主题 storage 的 settingsId 已是产品默认、待提示键仍为 `Light Modern`、有焦点：动作为弹出。
- `isSessionsWindow` 为 true 且资格成立：不弹出、不标记已提示、写入待提示键。
- 已提示键为 true：空操作。

本地跑 `scripts/test.sh --grep WorkbenchThemeService`。
