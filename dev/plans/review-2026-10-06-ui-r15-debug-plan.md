---
title: "方案 r15：debug"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 2，weaken 0。浮动条在 part 显隐后重算纵向区间；断点输入扣掉 Mode 容器实测宽；悬停 setInput 成功后再布局一次。"
---

# 方案 r15：debug
状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 3，drop 2，weaken 0

## r15-1（drop）

不写改法。`Pane.layout`（`paneview.ts` 第 308–315 行）按先高后宽调用 `layoutBody(height, width)`。`VariablesView.layoutBody`（`variablesView.ts` 第 220–223 行）把形参命名成先宽后高，因此局部量 `width` 是真实高度、`height` 是真实宽度。`this.tree.layout(width, height)` 传到 `WorkbenchAsyncDataTree.layout` / `AbstractTree.layout`（`asyncDataTree.ts` 第 766–767 行，`abstractTree.ts` 第 3024–3025 行），签名都是 `(height?, width?)`，树拿到的是真实高宽。`super.layoutBody(height, width)` 会把宽高交给 `ViewPane.layoutBody`（`viewPane.ts` 第 643–645 行）里的欢迎区，但 `ViewWelcomeController.layout`（同文件第 128–131 行）在未启用时直接返回。`VariablesView` 没有覆盖 `shouldShowWelcome`，基类（第 746–748 行）返回 `false`。欢迎文案只注册在 `WelcomeView.ID`（`welcomeView.ts` 第 111–117 行）。侧栏竖条尺寸下变量树不会按对调后的宽高布局。

## r15-2（drop）

不写改法。`DisassemblyView.layout`（`disassemblyView.ts` 第 372–374 行）确实只把 `dimension.height` 传给表。`Table.layout`（`tableWidget.ts` 第 272–278 行）在宽度省略时用 `getContentWidth(this.domNode)`，也就是当前 `offsetWidth` 减去边框和内边距，然后写入 `cachedWidth` 并 `splitview.layout(width)`。回落值不是上一轮的 `cachedWidth`。`.monaco-table` 为 `width: 100%`（`table.css` 第 6–14 行）。编辑组在调用编辑器 `layout` 之前已经把 `editorContainer.style.width` / `height` 写成内容区像素（`editorGroupView.ts` 第 2263–2265 行）。表挂在块级 `.editor-instance` 上（`editorgroupview.css` 第 345–347 行只设了高度），父级宽度已经更新后再读 `offsetWidth`，列宽跟着这次测量走。`loadedScriptsView.layoutBody` 是视图树的 `(height, width)`，不是这张表的宽度回落。

## r15-3（hold）

- 问题类：标题栏显隐之后，浮动调试条仍用缓存的纵向可拖区间。
- 不变量：`onDidChangePartVisibility` 回调先把 `_yRange` 置为 `undefined`，再调用 `setCoordinates()`。下一次读取 `yRange` 时按当时的 `isVisible(Parts.TITLEBAR_PART)`、`LayoutSettings.COMMAND_CENTER` 和 `LayoutSettings.EDITOR_TABS_MODE` 重算。工具条不可见时 `setCoordinates` 仍在第 294–296 行返回，但缓存已经清掉，随后 `show` 里的 `setCoordinates` 使用新区间。`EDITOR_TABS_MODE` / `COMMAND_CENTER` 配置回调和 `onDidChangeActiveContainer` 继续在调用 `setCoordinates` 之前清缓存。
- 要动的符号或文件：`DebugToolBar.registerListeners` 里 `layoutService.onDidChangePartVisibility` 的回调（`debugToolBar.ts` 第 206 行）。标题栏显隐会走到这里：`Layout.onFullscreenChanged` 第 593–598 行、`onMenubarToggled` 第 543–549 行、`updateCustomTitleBarVisibility` 第 2669–2674 行都 `setViewVisible(titleBarPartView, …)`，`layout.ts` 第 1742–1767 行因此发出 `onDidChangePartVisibility`。
- 明确不改什么：保持 `yRange` 里 `0` / `mainContainerOffset.top` / `28` / `35` 的计算公式不动。保持第 154–157 行配置分支和第 208–217 行活动容器分支的清缓存顺序不动。保持 `PixelRatio.onDidChange` 只调用 `setCoordinates` 不动。保持 `--x-position` 的计算和 `debugToolBar.css` 不动。
- 怎样本地验证：没有覆盖 `DebugToolBar` 纵向区间的测试。新增断言：工具条可见且 `_yRange` 已按标题栏可见算过时，把布局桩的标题栏改成不可见并触发 `onDidChangePartVisibility` 后，`setCoordinates` 写入的 `--y-position` 不低于此时的 `mainContainerOffset.top`；再把标题栏改回可见并触发同事件后，`--y-position` 允许为 `0`，且上界包含标题栏那一档高度。工具条不可见时触发该事件，随后 `show` 使用的是新可见性下的区间。用 `scripts/test.sh --run` 跑承载该断言的文件。

## r15-4（hold）

- 问题类：存在多个断点 Mode 时，条件输入的布局宽度没有扣掉 Mode 容器，窄编辑器里输入区被裁切。
- 不变量：`selectModeBox` 已创建时，`_doLayout` 传给 `input.layout` 的宽度为 `max(0, widthInPixel - 113 - modeContainer.offsetWidth)`。`createModesInput` 因 `modes.length <= 1` 提前返回、没有 Mode 容器时，宽度仍是 `widthInPixel - 113`。Mode 容器用 `.select-mode-container` 本身：`breakpointWidget.css` 第 49–55 行把它放进 `width: 300px` 的规则，第 61–64 行只把内部 `.select-box-container` 设成 `100px` 加 `margin-right: 10px`。扣的是外层容器的 `offsetWidth`。
- 要动的符号或文件：`BreakpointWidget.createModesInput`（`breakpointWidget.ts` 第 247–272 行）保存 `modeWrapper`。`BreakpointWidget._doLayout`（第 382–385 行）按上面的公式改 `input.layout` 的 `width`。`_onWidth`（第 388–391 行）继续转调 `_doLayout`，不必再写一遍公式。
- 明确不改什么：保持无 Mode 时的 `113` 不动。保持 `createModesInput` 的提前返回、`SelectBox` 选项和 `context` 切换不动。保持触发断点列表 `selectBreakpointContainer` 的显隐和宽度不动。保持 `zoneWidget.ts` 第 455 行 `overflow: hidden` 和第 276–278 行 `_getWidth` 不动。
- 怎样本地验证：没有覆盖 `_doLayout` 的测试。`debugLeftoverPromiseCatchScanD744.test.ts` 与 `debugLeftoverPromiseCatchScanD755.test.ts` 只扫描 `createModelReference` 的双 catch，本改动不碰那段。新增断言：有 Mode 容器且其 `offsetWidth` 为 300 时，`input.layout` 的宽度等于 `max(0, widthInPixel - 113 - 300)`；`widthInPixel` 小于 `113 + offsetWidth` 时宽度为 `0`；未创建 Mode 容器时宽度仍是 `widthInPixel - 113`。用 `scripts/test.sh --run` 跑承载该断言的文件。

## r15-5（hold）

- 问题类：复杂值悬停在 `setInput` 期间丢掉树的内容宽高事件，结束后悬停不再按新内容布局。
- 不变量：`beforeRender` 每次开始 `setInput` 使用新的序号。只有序号仍是最新且 promise 兑现时，才把 `isUpdatingTree` 设为 `false` 并调用 `layoutTreeAndContainer()`。失败或被更新的 `setInput` 盖掉时，旧回调不把标志清掉，也不布局。布局时悬停仍可见（`_isVisible` 有值）。`onDidChangeContentHeight` / `onDidChangeContentWidth` 在 `isUpdatingTree` 为真时继续不布局。`ListView.splice`（`listView.ts` 第 624–636 行）在 `setInput` → `render` → `setChildren`（`asyncDataTree.ts` 第 780–787、1316–1336 行）里同步发出内容高度，这些事件仍落在标志为真的窗口内，由兑现后的那一次布局补上。
- 要动的符号或文件：`DebugHoverWidget.beforeRender`（`debugHover.ts` 第 377–387 行）的 `setInput` 回调。`layoutTreeAndContainer`（第 352–355 行）保持为补布局的入口。
- 明确不改什么：保持第 173–184 行两个监听的 `isUpdatingTree` 判断和注释不动。保持 `doShow` 第 338–344 行先 `layoutContentWidget` 再等 `beforeRender` 的顺序不动。保持 `onDidEvaluateLazyExpression` 里的 `updateChildren` / `expand` 不动。保持 `layoutTree` 的 266、`0.55`、400、550 钳制不动。兑现路径末尾仍是 `.catch(onUnexpectedError).catch(onUnexpectedError)`。
- 怎样本地验证：`debugHover.test.ts` 的 `find expression in stack frame` 只覆盖 `findExpressionInStackFrame`，不断言布局。`debugLeftoverPromiseCatchScanD744.test.ts` 的 `tree leftover setInput / updateChildren are Promise double-chain` 用整段 `hoverThen` 匹配 `setInput(expression).finally`，同文件 `this knife covers thirty-eight leftover Promise double-chain sites` 把这一处算进 38。改回调后同步更新 `hoverThen` 的期望文本，双 catch 仍算 1 处，总数仍是 38。另增断言：`setInput` 兑现前把内容高度事件丢掉；兑现且悬停仍可见时 `layoutTreeAndContainer` 被调用一次，调用时 `isUpdatingTree` 已为 `false`；promise 拒绝时不调用；更新的 `setInput` 已开始时，旧 promise 的回调不调用。用 `scripts/test.sh --run` 跑 `debugLeftoverPromiseCatchScanD744.test.ts` 和承载新断言的文件。
