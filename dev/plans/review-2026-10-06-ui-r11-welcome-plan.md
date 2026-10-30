---
title: "方案 r11：welcome"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 4，drop 0，weaken 1。详情媒体每次 layout 重建；空窗恢复踩 folders[0]；欢迎勾选不认空窗启动值；窄宽 toSide 仍在同组执行。列表早退把 itemCount 写成 0 降为低。"
---

hold 4，drop 0，weaken 1

# 方案 r11：welcome
状态：草案。
覆盖需求：无（正文未引用需求编号）。


r11-1、r11-2、r11-3、r11-4 按读到的行号 hold。r11-5 降为低。没有 drop。

## r11-1（中）

- 问题类：详情步已经有媒体时，每次编辑器 `layout` 都先清空媒体与步骤订阅，再把图片、SVG、Markdown 或视频整段重建。
- 不变量：`layout` 仍依次做 `detailsScrollbar` / `categoriesPageScrollbar` / `detailsPageScrollbar` 的 `scanDomNode`、三条列表的 `layout`、`this.layoutMarkdown?.()`、三档宽度高度 class、以及末尾再扫一遍滚动条。同一步、媒体类型未变时，已挂上的 webview 与 `<img>` 保持原节点；`stepDisposables` 里该步的主题监听、点击监听和 markdown 的 `layoutMarkdown` 回调仍在。换步仍走 `selectStep` 里的 `buildMediaComponent(id, true)`（第 875 行）。主题变化仍走 `buildMediaComponent` 内部的 `onDidColorThemeChange`。`buildMediaComponent` 第 592 行「非强制且 `currentMediaComponent === stepId` 则返回」保持原样。
- 要动的符号或文件：`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` 的 `GettingStartedPage.layout`（第 1303–1328 行）。删掉第 1313–1317 行：在 `selectedStep` 与 `currentMediaType` 为真时调用 `mediaDisposables.clear()`、`stepDisposables.clear()` 和 `buildMediaComponent`。这三行必须一起删。`stepDisposables.clear()` 会跑到第 597–600 行，把 `currentMediaComponent` 置为 `undefined`，第 592 行的早退因此进不去。`mediaDisposables.clear()` 会跑到第 608–610 行，把 `currentMediaType` 置为 `undefined` 并 dispose 第 615、618、621 行登记的 webview，第 603 行于是再建一个 webview。图片分支在第 634–635 行会 `clearNode` 再挂新的 `<img>`。
- 明确不改什么：保留第 1319 行 `this.layoutMarkdown?.()`，并且它发生在不再 `clear` 步骤订阅之后，这样 markdown 已有的 `postMessage({ layoutMeNow: true })`（第 757–760 行）还能发到现有 webview。保留第 1321–1323 行的 `height-constrained` / `width-constrained` / `width-semi-constrained`。保留 `selectStep`、`buildMediaComponent` 的 `forceRebuild` 参数和按媒体类型分支。保留 `media/gettingStarted.css`。
- 怎样本地验证：现有测试没有 `GettingStartedPage.layout`。断言意图：选中步且 `currentMediaType` 已设置时调用 `layout`，`webviewService.createWebviewElement` 的次数不增加，图片节点身份不变，该步登记在 `stepDisposables` 上的监听仍在，markdown 步上 `layoutMarkdown` 在这次 `layout` 里被调用。`selectStep` 换步仍会 `buildMediaComponent(id, true)`。仓库里没有这个页面的测试夹具；断言落在新建的 `src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedMediaLayout.test.ts`（需要页面夹具或可替换的 webview 工厂）。命令：`scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedMediaLayout.test.ts`。

## r11-2（中）

- 问题类：profile 里存的是某个文件夹 URI 时，空工作台启动恢复会读 `folders[0].uri` 并抛出 `TypeError`，`run()` 在这次比较之后的欢迎页逻辑不再执行，恢复键留在 profile 里。
- 不变量：`restoreData.folder === UNKNOWN_EMPTY_WINDOW_WORKSPACE.id`（`src/vs/platform/workspace/common/workspace.ts` 第 156 行，值为 `'empty-window'`）时仍打开欢迎步并 `remove` 该键。当前窗口第一个文件夹的 `uri.toString()` 与 `restoreData.folder` 相同时同样打开并删除。没有文件夹，或第一个文件夹 URI 与存储值不同时，比较结果为假，函数落到现有的 `return false`（第 197 行），键保留。`JSON.parse` 之后才比较。比较为真之后，非 Sessions 窗口跳过 Copilot walkthrough 并删键（第 184–186 行）保持原样。
- 要动的符号或文件：`src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts` 的 `tryOpenWalkthroughForFolder` 第 183 行。先取出 `currentWorkspace.folders[0]`，导出纯函数 `walkthroughRestoreFolderMatches(restoreFolder: string, folders: readonly { uri: URI }[]): boolean`，用它替换这一行的 `||` 表达式。空数组时不得读 `.uri`。
- 明确不改什么：关机时写入 `'empty-window'` 的路径（`gettingStarted.ts` 第 317–335 行）保持原样；那条左侧已经相等，今天不会读 `folders[0]`。打开文件夹成功后把真实 URI 写入同一 key 的路径（第 1462–1466 行）保持原样。文件夹 URI 与当前窗口不一致时保持不 `remove`，留给稍后打开该文件夹的窗口。保持 `JSON.parse` 的位置。保持 `run()` 第 123 行的 `catch(onUnexpectedError)`。
- 怎样本地验证：在已有文件 `src/vs/workbench/contrib/welcomeGettingStarted/test/browser/startupPage.test.ts` 为 `walkthroughRestoreFolderMatches` 增加断言：空文件夹列表加上 `'empty-window'` 为真且不抛；空文件夹列表加上任意文件夹 URI 字符串为假且不抛；一个文件夹且 URI 字符串相同为真；URI 字符串不同为假。再在 suite `StartupPageRunnerContribution - walkthrough restore (INV-NO-COPILOT)` 增加一条：`TestContextService.setWorkspace` 设成零文件夹（`workbenchInstantiationService` 默认的 `TestWorkspace` 有一个文件夹，空列表必须显式设上，否则现有代码也不会抛），存储里的 `folder` 是另一个 URI，`workbench.startupEditor` 为 `welcomePage`。断言 `openEditor` 被调用（`run()` 在比较之后仍打开欢迎页），且 `restoreWalkthroughsConfigurationKey` 仍在。命令：`scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/startupPage.test.ts`。

## r11-3（中）

- 问题类：`workbench.startupEditor` 为 `welcomePageInEmptyWorkbench` 时空工作台仍会打开 Welcome，页脚「启动时显示欢迎页」的初始勾选只认精确等于 `welcomePage`，因此显示为未勾选。
- 不变量：勾选框初始为勾选，当且仅当有效值为 `welcomePage` 或 `welcomePageInEmptyWorkbench`。值为 `none`、`readme`、`newUntitledFile`、`terminal`、`agentSessionsWelcomePage` 或读不到值时，初始为未勾选。用户勾上仍 `updateValue(..., 'welcomePage')`（第 940 行）。用户取消仍 `updateValue(..., 'none')`（第 943 行）。初次渲染不写配置；值为 `welcomePageInEmptyWorkbench` 且用户没有拨动勾选框时，存储值保持 `welcomePageInEmptyWorkbench`。空工作台且该值时，`isStartupPageEnabled`（`startupPage.ts` 第 311–313 行）与 `run()` 第 166–167 行仍打开 Welcome。贡献默认值仍是 `'none'`（`gettingStarted.contribution.ts` 第 338 行）。
- 要动的符号或文件：在 `startupPage.ts` 导出 `isShowWelcomeOnStartupChecked(startupEditor: string | undefined): boolean`。`gettingStarted.ts` 第 931 行 `Toggle` 的 `isChecked` 改为调用它，替换 `getValue(configurationKey) === 'welcomePage'`。`gettingStarted.ts` 已经从 `startupPage.ts` 引入恢复键，沿这条 import 即可。
- 明确不改什么：`onShowOnStartupChanged` 的两个写入值保持原样。不给勾选框加 `onDidChangeConfiguration`。不改 `isStartupPageEnabled` 的返回式，不改 `run()` 里 readme / terminal / `openGettingStarted` 的分支，不改 `openReadme` 在找不到 README 时回退欢迎页的路径（第 221–223 行）。
- 怎样本地验证：`startupPage.test.ts` 已 import 该模块。为 `isShowWelcomeOnStartupChecked` 增加断言：`welcomePage` 与 `welcomePageInEmptyWorkbench` 为真；`none`、`readme`、`newUntitledFile`、`terminal`、`agentSessionsWelcomePage`、`undefined` 为假。命令：`scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/startupPage.test.ts`。

## r11-4（中）

- 问题类：Walkthrough 步骤按钮的 `command:toSide:` 在欢迎页容器已是 `width-semi-constrained`（`layout` 第 1323 行，宽度 ≤950）或更窄时，`focusSideEditorGroup` 直接返回，命令仍由 `executeCommand` 在当前组执行。
- 不变量：并排焦点的守卫条件保持为「没有 part 尺寸，或 part 宽度 ≤700，或容器带 `width-constrained`，或容器带 `width-semi-constrained`」时不新建、不激活侧组。守卫通过时，仍按现有顺序 `addGroup`（仅当 `groupsService.count === 1`）、`activateGroup`，并聚焦最近的非 `GettingStartedInput` 组，然后执行命令。`toSide` 为假时，命令仍在当前组执行。守卫未通过且 `toSide` 为真时，不调用 `executeCommand`，也不调用 `openerService.open`；用已注入的 `notificationService.info` 加一条 `localize` 提示，说明当前宽度无法在旁边打开，Welcome 仍是当前编辑器。第 1410 行的 telemetry 仍在这次返回之前打点。
- 要动的符号或文件：`gettingStarted.ts` 的 `focusSideEditorGroup`（第 1389–1403 行）改为返回布尔：守卫失败为 `false`，守卫通过并走完现有分组逻辑为 `true`。导出纯函数 `canFocusWalkthroughSideGroup(partWidth: number | undefined, widthConstrained: boolean, widthSemiConstrained: boolean): boolean` 承接第 1391 行的条件。`runStepCommand`（第 1404 行起）在第 1412–1414 行：`toSide` 且返回值为假时提示并 `return`。
- 明确不改什么：第 1321–1323 行的 class 阈值保持 600 / 400 / 950，第 1391 行的 700 保持 700。`media/gettingStarted.css` 第 707–710 行在半窄宽度隐藏媒体保持原样。媒体 webview 里 `onDidClickLink` 已把 `openToSide` 传给 `openerService.open`（第 733–740 行）保持原样。不改 `preferredSideBySideGroupDirection`。不改步骤文案里的 `command:toSide:`（`gettingStartedContent.ts`）。
- 怎样本地验证：新建 `src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedToSide.test.ts`，断言 `canFocusWalkthroughSideGroup`：宽度 951 且两个 class 都没有为真；宽度 800 且 `widthSemiConstrained` 为假；宽度 701 且两个 class 都没有为真；宽度 700 为假；宽度 `undefined` 为假；`widthConstrained` 为真时为假。再导出 `shouldExecuteWalkthroughStepCommand(toSide: boolean, sideGroupFocused: boolean): boolean`，由 `runStepCommand` 在执行前调用：`toSide` 为假时执行；`toSide` 为真且已聚焦侧组时执行；`toSide` 为真且未聚焦侧组时不执行。命令：`scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedToSide.test.ts`。

## r11-5（降为低）

- 问题类：`GettingStartedIndexList.setEntries` 在判定「条目引用与要画的 id 都没变」之前把 `itemCount` 写成 0，早退时不再写回。
- 反证：第 99 行确是 `this.itemCount = 0`，第 112 行早退，第 122 与 129 行的 `limitedEntries.length` 写不回去。早退也不走到第 145 行的 `_onDidChangeEntries.fire()`，DOM 保持上一轮。`scrollPrev` 第 1744 行比较的是 `gettingStartedCategories.length` 与 `itemCount`。`length` 来自 `getWalkthroughs()`（`gettingStartedService.ts` 第 512–529 行），含 `when` 未命中的分类。`itemCount` 在成功路径上是 `contextMatchesRules` 之后再 `slice(0, limit)` 的长度；walkthrough 列表的 `limit` 是 5（`gettingStarted.ts` 第 1281 行）。本仓内置分类里，`Setup` 的 `when` 是 `!isWeb`（`gettingStartedContent.ts` 第 260 行），`SetupWeb` 是 `isWeb`（第 296 行），`SetupAccessibility` 绑在无障碍上下文（第 382 行），`notebooks` 还要配置和打开过笔记本（第 604 行）。桌面全量长度与可见条数在 `setEntries` 正常走完时就已经不相等，`scrollPrev` 仍会 `buildCategoriesSlide()`。`itemCount` 被写成 0，只在全量长度恰好等于限长后的可见数时多一次重建。隐藏分类用 `rank` 置 `null` 滤出列表，仍留在 `gettingStartedCategories` 里，同样会让第 1744 行不相等。上下文早退不触发 `onDidChange`，第 1293 行的 `allWalkthroughsHiddenContext` 和第 988 行的 `layoutLists` 不会因为这次写成 0 把右列收掉。
- 不变量：早退时 `itemCount` 仍是进入 `setEntries` 之前的值。内容有变化时，`itemCount` 仍等于 `limitedEntries.length`（第 122 行那次写入保留）。`rerender` 与 `setLimit` 仍调用 `setEntries(this.entries)`。早退时仍不改 DOM、不 `fire`。
- 要动的符号或文件：`src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedList.ts` 的 `setEntries`。删掉第 99 行在过滤和比较之前的 `this.itemCount = 0`。早退保持调用前的 `itemCount`。成功路径继续在通过第 112 行之后写成 `limitedEntries.length`。
- 明确不改什么：不改 `scrollPrev` 第 1744 行用全量 `length` 对比 `itemCount` 的条件。不改 walkthrough 列表的 `limit: 5`。不改第 61–64 行上下文变化时调用 `rerender`。不改第 145 行只在真正重画时 `fire`。
- 怎样本地验证：`GettingStartedIndexList` 没有现成测试。新建 `src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedList.test.ts`。断言：同一 `entries` 引用且渲染 id 不变时再 `setEntries`（或 `rerender`），`itemCount` 仍为上一轮的 `limitedEntries.length`，值不是因为早退变成 0；渲染 id 变化时 `itemCount` 等于新的限长后长度；`setLimit` 把上限改到仍画出同一批 id 时，`itemCount` 保持上一轮长度。命令：`scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedList.test.ts`。
