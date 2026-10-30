---
title: "方案 r14：debug"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 3，drop 0，weaken 0。悬停树加载失败后清掉更新标志，Mode 外层不再按 300px 扣除。不升 implemented，不升 PRD。"
---
# 方案 r14：debug

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 3，drop 0，weaken 0。

## r14-1（hold，中）

问题类：复杂值悬停的树 `setInput` 被拒绝后 `isUpdatingTree` 一直为真，同一次悬停里随后的内容变高不再撑开。

不变量：`setInput` 进行中，内容宽高变化不调用 `layoutTreeAndContainer`。当前序号兑现且 `_isVisible` 有值时，把 `isUpdatingTree` 置回 false 并布局一次。当前序号被拒绝时，把标志置回 false，这次不布局；之后同一次悬停的内容宽高变化可以再布局。过期序号结束时不改标志、不布局，更新的那次仍在进行则标志保持 true。悬停已不可见时的兑现不布局；若这次仍是当前序号，标志仍置回 false。拒绝继续由双 `catch(onUnexpectedError)` 吞掉。

要动的符号或文件：`DebugHoverWidget.beforeRender` 里 `this.tree.setInput` 那条链（`src/vs/workbench/contrib/debug/browser/debugHover.ts`）。标志今天只在兑现回调里、并且要同时满足当前序号和可见才写成 false。

怎么改：兑现回调保持「当前序号且可见才布局」。同一次序号无论兑现还是拒绝，结束时都把 `isUpdatingTree` 置回 false。拒绝不到达布局。过期序号的结束不写这个标志。双 catch 仍紧跟现有 `then` 回调。清标志的拒绝路径放在双 catch 之后的结束步骤里，这样 `debugLeftoverPromiseCatchScanD744.test.ts` 的 `hoverThen` 原文和 38 个站点可以不动。

明确不改：第 174–184 行内容宽高监听里「`isUpdatingTree` 为真就跳过布局」的条件。`layoutTree` 的高度与宽度钳制。`hide` 与 `getPosition`。`AsyncDataTree.setInput` 的拒绝方式。

怎样本地验证：`Debug - Hover` 的 `complex value hover setInput completion updates layout and sequence handling`。进行中的内容高度仍使布局次数为 0；兑现且可见仍布局一次且标志为 false；过期序号完成仍不布局且标志保持 true（`stale sequence promise completion should not trigger layout`）；不可见的兑现仍不布局（`hidden hover fulfillment should not trigger layout`），并断言这次当前序号结束后标志为 false。拒绝路径的断言改由 r14-3 写。扫描测试 `tree leftover setInput / updateChildren are Promise double-chain` 与 `this knife covers thirty-eight leftover Promise double-chain sites; D686/D688/D690/D662 stay skipped` 在 `then` 回调原文不动时仍通过。

## r14-2（hold，中）

问题类：多个断点 Mode 时外层 `.select-mode-container` 按 300px 占位，条件输入按这块宽度被扣窄，外层仍是 300px 且区域窄于 113 加该宽度时输入被钳成 0。

不变量：`modes.length <= 1` 时不创建 Mode 容器，`computeBreakpointInputWidth` 只减 113。有 Mode 时，`_doLayout` 扣掉的是收缩后的 `selectModeContainer.offsetWidth`，外层占位与这个宽度一致。触发断点选择框仍是 300px。内部 Mode 选择框仍是 100px 加 `margin-right: 10px`。结果仍用 `Math.max(0, …)` 钳住，避免负宽度。

要动的符号或文件：`src/vs/workbench/contrib/debug/browser/media/breakpointWidget.css` 里与 `.select-breakpoint-container .select-box-container` 写在一起的 `.select-mode-container { width: 300px }`。`BreakpointWidget.createModesInput` 仍把外层存进 `selectModeContainer`，`_doLayout` 仍把 `offsetWidth` 交给 `computeBreakpointInputWidth`（`src/vs/workbench/contrib/debug/browser/breakpointWidget.ts`、`src/vs/workbench/contrib/debug/common/breakpointInputLayout.ts`）。

怎么改：Mode 外层从这条 300px 规则里拆出来，按内部 `.select-box-container` 收缩（含它的右侧 margin）。扣减继续用收缩后的 `offsetWidth`，不在函数里写死 110。外层自己变窄，输入区左边那截空档一起消失。

明确不改：`computeBreakpointInputWidth` 的三分支（无容器减 113、有容器再减测到的宽度、负数钳成 0）。触发断点容器的 300px。内部 Mode 选择框的 100px 与 `margin-right: 10px`。只改测量目标、把外层留在 300px 的做法留在原样之外：空隙仍在输入框左侧，扣减却用更小的数，和 flex 剩余空间对不齐。

怎样本地验证：`breakpointInputLayout` 的 `no mode container uses legacy width`、`mode container width is subtracted when space allows`、`mode container clamps to zero when too narrow`、`mode container width zero still subtracts fixed offset` 仍通过。现有测试不渲染这张样式表。应新增的断言：多个 Mode 时参与扣减的宽度是内部选择框的外边距盒，不是 300；区域宽 500 时 `input.layout` 的宽度等于 `computeBreakpointInputWidth(500, 收缩后的宽度)`（约 277，现为 87）；区域宽 400 时，不因为外层仍占 300 而得到 0。

## r14-3（hold，低）

问题类：悬停测试把「树加载拒绝后 `isUpdatingTree` 仍为 true」写成必须成立，按 r14-1 清标志会先撞上这句。

不变量：拒绝且这次仍是当前序号时，标志为 false，`layoutTreeAndContainer` 的调用次数仍是 0。随后一次内容高度变化要能布局。过期序号完成时期望标志为 true 的断言保持。第 174 行那句手工把标志改回 false 不再充当失败路径的复位。

要动的符号或文件：`src/vs/workbench/contrib/debug/test/browser/debugHover.test.ts` 里 `complex value hover setInput completion updates layout and sequence handling` 的拒绝断言（现为 `isUpdatingTree should not be cleared on rejection`）以及紧随其后的 `(hover as any).isUpdatingTree = false`。

怎么改：拒绝断言改为标志已清掉，且这次布局次数为 0。再发一次内容高度事件，断言布局发生一次。断言必须排空到 r14-1 的结束步骤已经跑完。现有写法是 `await rejectDeferred.p.catch(() => {}); await Promise.resolve();`。同样形状下，双 catch 之后的结束回调要再等一轮微任务才执行；只停在现有这一轮时，标志看起来仍是 true。清标志若写在 `then` 的拒绝回调里，现有这一轮就会看到 false，这句旧断言会失败。序号用例里过期完成仍断言标志为 true、不布局；最新一次兑现仍断言布局一次且标志为 false。

明确不改：进行中抑制布局、兑现且可见布局一次、过期序号不布局、不可见不布局这几段的期望方向。生产代码的监听条件（由 r14-1 保持）。`hoverThen` 扫描原文在 `then` 回调不动时不改。

怎样本地验证：同上，测试名 `complex value hover setInput completion updates layout and sequence handling`。拒绝后的新断言：`isUpdatingTree === false`，布局次数为 0；紧接着的内容高度事件使布局次数变为 1。`stale sequence promise completion should not trigger layout` 与 `latest sequence promise completion should trigger layout` 仍在。
