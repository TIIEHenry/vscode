---
title: "审查 r14：debug"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "3 条，最重是复杂值悬停在树加载失败后不再按内容重排。"
---

# 审查 r14：debug
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`src/vs/workbench/contrib/debug` 这一路已改文件。已跳过 2026-10-06 审查里记过、且活码已按该方向改过的项（浮动条纵向区间缓存、悬停成功路径补布局、内存区间读写）。

## r14-1 中

- 症状：调试悬停展开复杂值时，如果树加载失败，悬停停在更新前的尺寸；之后展开子项或内容变高，区域也不再撑开。
- 位置：`src/vs/workbench/contrib/debug/browser/debugHover.ts` 第 385–392 行
- 引用：`if (currentSequence === this.setInputSequence && this._isVisible) { this.isUpdatingTree = false; this.layoutTreeAndContainer(); }`
- 为什么是问题：`isUpdatingTree` 置回 `false` 只写在 `setInput` 的 `then` 里。拒绝时走的是后面的 `.catch(onUnexpectedError).catch(onUnexpectedError)`，`then` 不跑，标志保持 `true`。第 174–184 行的内容宽高监听看到标志为真就跳过 `layoutTreeAndContainer()`。同一次悬停里随后的子树更新因此不再重排。全文件只有第 389 行会把该标志写成 `false`。
- 方向：最新一次 `setInput` 结束时都把 `isUpdatingTree` 清掉，只有这次仍是当前可见悬停才补一次布局。

## r14-2 中

- 症状：适配器提供多个断点 Mode 时，条件输入框和 Mode 下拉之间空出一大段，输入区偏窄；外层盒子仍按 300px 占位时，窄编辑器上输入宽度会被收成 0。
- 位置：`src/vs/workbench/contrib/debug/browser/breakpointWidget.ts` 第 385–389 行
- 引用：`const modeContainerWidth = this.selectModeContainer?.offsetWidth;`
- 为什么是问题：第 270–271 行把 `.select-mode-container` 存进 `selectModeContainer`。`breakpointWidget.css` 第 49–54 行给这个外层写了 `width: 300px`，第 61–63 行只把内部 `.select-box-container` 设成 `width: 100px` 加 `margin-right: 10px`。行够宽时量到的就是 300。`computeBreakpointInputWidth`（`breakpointInputLayout.ts` 第 10 行）再减固定的 113，条件编辑器少掉内部没用到的大约 190px。区域窄到小于 113 加这块宽度时，同一行把结果钳成 0。
- 方向：让 Mode 外层按内部选择框收缩，再扣收缩后的 `offsetWidth`。

## r14-3 低

- 症状：悬停测试把「树加载失败后 `isUpdatingTree` 保持为真」写成必须成立，修正失败路径会先被这条断言挡住。
- 位置：`src/vs/workbench/contrib/debug/test/browser/debugHover.test.ts` 第 166–167 行
- 引用：`assert.strictEqual((hover as any).isUpdatingTree, true, 'isUpdatingTree should not be cleared on rejection');`
- 为什么是问题：这句把 r14-1 的失败路径锁成期望结果。同文件第 174 行还要手工把标志改回 `false`，后面的序号用例才能继续。
- 方向：失败时期望标志被清掉，并且这次不调用布局。
