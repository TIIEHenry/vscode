---
title: "方案 r10：chrome-status"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 3，drop 0，weaken 0。动作条内容变化后重测溢出，横幅换内容时清掉旧的无障碍名称。不升 implemented，不升 PRD。"
---

hold 3，drop 0，weaken 0。

## r10-1（hold，中）

问题类：标题栏动作条的内容变了，`overflowing` 仍停在上一次测量。

不变量：凡是走 `updateToolBarActions` 的内容变化，在 `setActions` 返回后的同一次调用里，`overflowing` 必须与当时的 `rootContainer` 测量一致。动作变少且 `scrollWidth` 已经不大于 `clientWidth` 时，动作条不得继续带 `overflowing`。动作变多且既有规则会藏动作条时，同一轮就加上 `overflowing`，不等下一次 `layout`。`updateTitleBarToolBarOverflow` 仍先去掉三个工具条的 `overflowing` 再测量。

要动的符号或文件：`BrowserTitlebarPart.createActionToolBarMenus` 里的 `updateToolBarActions`（`src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`）。在 `this.actionToolBar.setActions(...)` 之后调用已有的 `updateTitleBarToolBarOverflow`。编辑器动作的 `onDidChange`、布局菜单、全局菜单、账户可见性都只进这个函数，调用点放在函数末尾，不逐个监听各补一次。

怎么改：内容更新仍只由 `updateToolBarActions` 组装并 `setActions`。`setActions` 同步改完 DOM 后，立刻用现有溢出函数重测。不新写一套测量，也不把重测推迟到下一帧。

明确不改：不改 `layout` 末尾那次调用；不改中间相邻工具条和更新工具条的 `onDidChangeMenuItems`；不改隐藏顺序（先中间相邻，再更新工具条，最后才是动作条）和 `has-no-actions` 的跳过；不改 `titlebarpart.css` 里 `.overflowing` 的 `display: none`，也不改 `.titlebar-container` 的 `overflow: hidden`。

怎样本地验证：现有 `hides the action toolbar when custom window controls would still be clipped`、`action toolbar overflowing does not keep layout width`（`src/vs/workbench/test/browser/parts/titlebar/titlebarOverflow.test.ts`）仍通过。同一文件新增：动作条已带 `overflowing` 时，模拟 `updateToolBarActions` 结尾（`setActions` 之后）再测一次；把根容器收成放得下之后，动作条不再带 `overflowing`。再测相反方向：动作条可见且根容器 `scrollWidth` 大于 `clientWidth`、窗控仍占位时，同一次更新就给动作条加上 `overflowing`，期间不调用 `layout`。`scripts/test.sh --grep "BrowserTitlebarPart overflow"`。

## r10-2（hold，中）

问题类：横幅换成算不出无障碍名称的新内容后，根元素仍留着上一次的 `aria-label`。

不变量：每次 `show` 重建之后，根元素的 `aria-label` 与这次 `getAriaLabel` 的结果相同，并与「这个条目第一次显示」一致。算出非空字符串就设成该字符串；算出 `undefined` 或空字符串就没有该属性。同 id 且展示字段没变的早退路径不改属性。

要动的符号或文件：`BannerPart.show` 里设置横幅 `aria-label` 的分支，以及 `getAriaLabel`（`src/vs/workbench/browser/parts/banner/bannerPart.ts`）。算出的标签为空时 `removeAttribute('aria-label')`，不要只在有值时 `setAttribute`。

怎么改：`clearNode` 之后仍用 `getAriaLabel`。有非空结果就写入；没有就删掉根元素上可能残留的 `aria-label`。字符串消息和显式 `ariaLabel` 继续覆盖旧值。

明确不改：不改 `hasSameDisplayProperties` 的早退；不改 `message-container` 与图标的 `aria-hidden`；不从 Markdown 另造纯文本名称；不改 `close` / `hide` 的显隐。本条只消除「第一次显示没有属性、换内容后却留着旧属性」的差别。

怎样本地验证：现有 `same id with changed message rebuilds DOM and disposes previous Link`、`same id with changed actions updates links in messageActionsContainer`、`same id with identical display properties re-shows without rebuilding DOM`、`changing message when already visible resets focusedActionIndex to -1`（`src/vs/workbench/test/browser/parts/banner/bannerPart.test.ts`）仍通过。同一文件新增：先 `show` 字符串消息，断言根元素 `aria-label` 为该字符串；再以同一 id `show` 一条没有 `ariaLabel` 的 `MarkdownString`，断言根元素没有 `aria-label`，且 `.message-container` 已是新正文。再 `show` 另一条字符串，断言 `aria-label` 换成新字符串。`scripts/test.sh --grep "BannerPart"`。

## r10-3（hold，低）

问题类：全屏把窗控容器收成不占位之后，子节点里的 `.window-icon` 仍会让溢出逻辑藏起右侧动作条。

不变量：动作条只在「去掉中间相邻和更新工具条后根容器仍然溢出，并且窗控容器当前会生成布局盒」时才加 `overflowing`。容器是 `display: none` 时，即使里面还有 `.window-icon`，也不给动作条加 `overflowing`。没有 `.window-icon` 的路径保持现在的结果：残余溢出也不藏动作条。

要动的符号或文件：`BrowserTitlebarPart.updateTitleBarToolBarOverflow` 里决定给 `actionToolBarElement` 加 `overflowing` 的条件（`src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`）。窗控是否算数，改为容器当前不是 `display: none`；不要只凭 `querySelector('.window-icon')`。

怎么改：保留「先卸类、再按 scrollWidth 逐级藏」的顺序。最后一级在现有的残余溢出判断之外，要求 `windowControlsContainer` 的计算样式不是 `display: none`。全屏样式已经把该容器设成 `display: none`，这一级就不再藏动作条。默认窗口控件叠加（不往容器里放 `.window-icon`）本来就不会进这一级，维持不动。

明确不改：不改 `titlebarpart.css` 里全屏对 `.window-controls-container` 的 `display: none`；不改电子端何时创建最小化/最大化/关闭图标；不改 `has-no-actions` 时跳过动作条；不改中间相邻和更新工具条的隐藏条件。

怎样本地验证：现有 `hides the action toolbar when custom window controls would still be clipped` 里「有图标且容器不是 `display: none` 时藏动作条」「去掉图标后不藏动作条」「`has-no-actions` 不藏」「放宽 `clientWidth` 后三类工具条都不带 `overflowing`」仍通过。同一测试新增：容器保持 `.window-icon`，但 `display` 为 `none`，根容器 `scrollWidth` 仍大于 `clientWidth`。断言中间相邻与更新工具条仍可按残余溢出被藏，动作条不得带 `overflowing`。`scripts/test.sh --grep "BrowserTitlebarPart overflow"`。
