---
title: "方案 r01：titlebar"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "读屏标题在动态追加编辑器状态后仍订阅装饰；搜索框重新可见时重算 compact；仅 isPure 不再空刷新标题；custom HTML 窗控溢出时再藏 action toolbar。"
---

# 方案 r01：titlebar

核对范围是发现稿引用的 workbench 标题栏。下面只写仍要改的条目。

## r01-1 读屏标题跟随装饰

问题：模板里没有 `${activeEditorState}` 时，读屏优化会把该变量接到标题末尾，装饰变化却不会再排一次标题更新。

不变量：`getWindowTitle` 会把 `activeEditorState` 写进标题时，`decorationsService.onDidChangeDecorations` 必须 `titleUpdater.schedule()`。模板里写了该变量，以及读屏优化且 `accessibility.windowTitleOptimized` 为真，两条路径用同一个判定。

改动：

- `src/vs/workbench/browser/parts/titlebar/windowTitle.ts`
- `checkTitleVariables`（约 144–150 行）继续只从 `window.title` 模板写 `titleIncludesEditorState`。
- 另用一个私有判定表示标题是否包含编辑器状态：`titleIncludesEditorState` 为真，或 `accessibilityService.isScreenReaderOptimized()` 且 `configurationService.getValue('accessibility.windowTitleOptimized')` 为真。`getWindowTitle` 约 377–379 行的追加条件改用这个判定。
- `onActiveEditorChange` 约 184–186 行的装饰订阅改用这个判定。
- 判定可能变化时重新安装活动编辑器监听，不能只 `schedule()`。入口用现有的 `onActiveEditorChange`（它会清掉 `activeEditorListeners` 再按当前判定订阅，并 `schedule`）。调用点：`accessibilityService.onDidChangeScreenReaderOptimized`、`window.title` 变更之后的 `checkTitleVariables`、以及 `accessibility.windowTitleOptimized` 变更。`onConfigurationChanged` 今天只处理 `WindowSettingNames.title` 与 `titleSeparator`，需要加上 `accessibility.windowTitleOptimized`。

不改：

- 追加片段仍是 `${separator}${activeEditorState}`。
- `onDidChangeDirty`、`onDidChangeLabel` 的订阅。
- `defaultWindowTitle`、`isCustomTitleFormat`。
- 装饰事件仍不按资源过滤，与模板里写了变量时的现有订阅相同。

验证：仓库里没有 `WindowTitle` 测试名。应新增断言：

- 模板不含 `${activeEditorState}`，读屏优化开着，`accessibility.windowTitleOptimized` 为真时，装饰 tooltip 变化后窗口标题含新 tooltip。
- 活动编辑器已经就绪之后才打开读屏优化，随后的装饰变化仍更新标题。
- 模板不含该变量且读屏优化关闭时，装饰变化不改变标题。
- 模板含 `${activeEditorState}` 时，装饰变化仍更新标题。

用 `scripts/test.sh` 跑这条新用例的名字。

## r01-2 命令中心搜索按钮的 compact

问题：搜索按钮的 compact 只在 `CommandCenterQuickPickItem.render` 里算一次；从 compact 回到搜索框可见时，图标和 `compact-mode` 可以停在旧布局。

反证：

- `AgentTitleBarStatusRendering.updateClass`（`agentTitleBarStatusWidget.ts` 约 1433–1452 行）在 `chat.agentsControl.enabled`、`chat.disableAIFeatures`、`disableAICustomizations`、`workbench.disableAICustomizations` 变化时立刻切换 `unified-agents-bar`。`agenttitlebarstatuswidget.css` 第 7–9 行在该模式下把 `.command-center-center` 设为 `display: none`。切到 compact 时搜索框被整段藏起。
- `AgentTitleBarStatusWidget` 约 237–249 行对同一组配置调用 `_render()`。
- Agents 菜单项的 `when` 含 `IsSessionsWindowContext`（`agentSessionsExperiments.contribution.ts` 约 254–264 行）。
- 设置默认值是 `'hidden'`（`chat.shared.contribution.ts` 里 `ChatConfiguration.AgentStatusEnabled`）。`undefined` / `true` 只是旧值兼容。现成测试只锁默认值：`editor window chat.agentsControl.enabled defaults to hidden (no compact command-center chrome)`（`chatConfigurationDefaults.test.ts`）。
- `BrowserTitlebarPart.onConfigurationChanged` 只在 `LayoutSettings.COMMAND_CENTER` 时 `recreateTitle`（`titlebarPart.ts` 约 408–410 行）。`layout.ts` 对 `COMMAND_CENTER_SETTINGS` 的处理不会重建这个 view item。

不变量：`.command-center-quick-pick` 可见时，`compact-mode` 以及有没有 `.search-icon`，与 render 里那条公式的当前结果一致。公式保持：`forcedHidden` 为「`chat.disableAIFeatures` 与（`disableAICustomizations` 或 `workbench.disableAICustomizations`）同时为真」；`isCompactMode` 为「非 forcedHidden，且值是 `true`、`undefined` 或 `'compact'`」。

改动：

- `src/vs/workbench/browser/parts/titlebar/commandCenterControl.ts` 里匿名类 `CommandCenterQuickPickItem.render`（compact 计算约 166–193 行）。
- 把这段计算和 `reset(container, …)` 收成 render 内可再调用的步骤。
- 用该 view item 的 `_store` 订阅 `configurationService.onDidChangeConfiguration`。命中 `chat.agentsControl.enabled`、`ChatAIDisabledSettingId`（`chat.disableAIFeatures`）、`disableAICustomizations`、`workbench.disableAICustomizations` 时重跑该步骤，更新 `compact-mode`，并按同一分支摆回 `searchIcon` 与 `labelElement`。

不改：

- `AgentTitleBarStatusWidget`、`AgentTitleBarStatusRendering`、body 上的 `unified-agents-bar` / `agent-status-enabled`。
- 菜单 `when`、设置默认值 `'hidden'`。
- `recreateTitle` 的触发条件。
- 窗口标题与 `showTabs` 两条既有监听（它们只更新文案）。

验证：上面的默认值测试不覆盖 render 之后的配置变化。应新增断言：以 `compact` 完成 render 后，容器有 `compact-mode` 且没有 `.search-icon`；不销毁该 view item，把配置改为 `hidden` 或 `badge`，或让两个 AI 关闭项同时为真，之后 `compact-mode` 去掉且 `.search-icon` 回到容器里。用 `scripts/test.sh` 跑这条新用例的名字。

## r01-3 isPure 不再单独刷新标题

问题：`isPure` 会写入并 `schedule()`，标题字符串不读它，这次刷新不改变标题。

反证：非纯净时 `IntegrityService._compute`（`integrityService.ts` 约 83–102 行）会 `_showNotification()`，文案是安装损坏、请重装；有 `checksumFailMoreInfoUrl` 时可以「Don't Show Again」。标题栏本身没有另一套提示。`getTitleDecorations`（`windowTitle.ts` 约 234–252 行）只用 `prefix`、扩展开发宿主和 `isAdmin`。

不变量：仅 `isPure` 变化时，`getTitleDecorations()` 的 `prefix` / `suffix` 不变，并且不因此 `titleUpdater.schedule()`。`isAdmin` 或 `prefix` 变化时仍刷新，管理员后缀仍是 `WindowTitle.NLS_USER_IS_ADMIN`。

改动：

- `WindowTitle.updateProperties`（约 255–266 行）。
- 每次调用都把 `isPure` 写入 `this.properties`。
- `titleUpdater.schedule()` 只在 `isAdmin` 或 `prefix` 与当前值不同时调用，并在那时写入这两项。

不改：

- `getTitleDecorations` / `getWindowTitle` 不读 `isPure`，不新增标题后缀。
- `IntegrityService` 的通知。
- `src/vs/workbench/electron-browser/window.ts` 里 `titleService.updateProperties({ isPure, isAdmin })` 的调用。
- `ITitleProperties.isPure` 字段保留。

验证：没有 `WindowTitle` 测试名。应新增断言：`updateProperties({ isPure: false })` 之后 `getTitleDecorations()` 与调用前相同；`updateProperties({ isAdmin: true })` 的 `suffix` 仍是管理员文案。用 `scripts/test.sh` 跑这条新用例的名字。

## r01-4 custom HTML 窗控不被裁切

问题：`window.controlsStyle` 为 custom、标题栏溢出且可选工具条已经藏起时，HTML 最小化/最大化/关闭仍可能被裁出可点区域。

反证：

- `getWindowControlsStyle` 默认 `WindowControlsStyle.NATIVE`（`window.ts` 约 317–328 行）。非 Mac 桌面、自定义标题栏、且未把控件设成 custom/hidden 时，`useWindowControlsOverlay` 为真（约 333–349 行）。
- HTML 按钮只在 `src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts` 的 `createContentArea`（约 186–214 行）里创建，条件是不用 overlay。默认路径的窗控是原生 overlay，不在被 `overflow: hidden` 裁切的 `.window-icon` 上。
- macOS 原生且主控件在左时，workbench `titlebarPart.ts` 约 562–566 行不创建 `windowControlsContainer`。
- 仍成立的布局：`updateTitleBarToolBarOverflow`（约 961–976 行）只给 center-adjacent 与 update 加 `overflowing`。`action-toolbar-container` 是 `flex-shrink: 0`（`titlebarpart.css` 约 492–496 行），`.titlebar-right` 是 `min-width: min-content`（约 101–106 行），`.titlebar-container` 是 `overflow: hidden`（约 18–20 行）。custom 路径下窗控是 `rightContent` 末尾的 `.window-icon`。
- sessions 的 `TitlebarPart.updateTitleBarToolBarOverflow` 已按列表逐个加 `overflowing`，测试名是 `hides optional toolbar groups when a titlebar section overflows`（`src/vs/sessions/test/browser/titlebarPart.test.ts`）。那是另一套标题栏。

不变量：`windowControlsContainer` 里存在 `.window-icon` 时，center-adjacent 与 update 都已按溢出藏起之后若仍溢出，`action-toolbar-container` 也进入 `overflowing` 并不再占宽，窗控容器本身不加 `overflowing`。没有 `.window-icon` 时，action toolbar 不因这条逻辑被藏。

改动：

- `BrowserTitlebarPart.updateTitleBarToolBarOverflow`。函数开头同时去掉 `actionToolBarElement` 的 `overflowing`。现有两步之后，若 `rootContainer.scrollWidth > rootContainer.clientWidth`，且 `windowControlsContainer` 含 `.window-icon`，并且 action toolbar 没有 `has-no-actions`，则给 `actionToolBarElement` 加上 `overflowing`。
- `src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css`：在约 486–488 行那组 `display: none` 规则中加入 `.action-toolbar-container.overflowing`。

不改：

- 没有 `.window-icon` 时的溢出顺序（默认 overlay、mac 不建控件容器）。
- 窗控宽度（含桌面非 web 非 mac 的 `138px`）、`overflowBehavior.maxItems`。
- `src/vs/sessions/browser/parts/titlebarPart.ts` 与 sessions 测试 `hides optional toolbar groups when a titlebar section overflows`。

验证：没有 workbench `BrowserTitlebarPart.updateTitleBarToolBarOverflow` 的测试名。应新增断言：用可切换的 `clientWidth` / `scrollWidth` 替身调用该方法；溢出且容器内有 `.window-icon` 时，center-adjacent 与 update 之后 `action-toolbar-container` 带 `overflowing`，`window-controls-container` 不带 `overflowing`；同一溢出下没有 `.window-icon` 时，action toolbar 不带 `overflowing`。用 `scripts/test.sh` 跑这条新用例的名字。sessions 那条测试通过不能代替本条。
