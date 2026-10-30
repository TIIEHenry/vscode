---
title: "审查 r10：chrome-status"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "3 条，最重是标题栏动作条内容变化后溢出标记不重算，按钮会一直隐藏或窗控继续被裁切。"
---

# 审查 r10：chrome-status
状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r10-1 中

- 症状：窄标题栏里动作条一旦被标成 `overflowing` 藏起来，编辑器动作或全局动作变少后它仍保持隐藏；动作变多时要等下一次标题栏 `layout` 才重新测量，这段时间窗控继续被裁切。
- 位置：`src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` 第 761–793 行
- 引用：`editorActions.onDidChange(() => updateToolBarActions())`；末尾只有 `this.actionToolBar.setActions(...)`
- 为什么是问题：`overflowing` 的清除和重加只发生在 `updateTitleBarToolBarOverflow`（第 966–980 行）。调用点是 `layout`（第 955 行），以及 center-adjacent / update 工具条的 `onDidChangeMenuItems`（第 520、537 行）。动作条自己的宽度变化走 `updateToolBarActions`：编辑器动作 `onDidChange`（第 761 行）和菜单更新都会 `setActions`（第 793 行），DOM 宽度已经变，类名仍停在上一次测量。该出现时样式仍是 `display: none`（`titlebarpart.css` 第 488–489 行）；该让位时动作条继续占宽，窗控被 `overflow: hidden` 裁掉。
- 方向：`setActions` 之后再跑一次 `updateTitleBarToolBarOverflow`。

## r10-2 中

- 症状：同一条横幅换成没有可计算无障碍名称的新内容后，读屏仍朗读上一次的 `aria-label`，和画面上的新消息不一致。
- 位置：`src/vs/workbench/browser/parts/banner/bannerPart.ts` 第 250–254 行
- 引用：`if (ariaLabel) { this.element.setAttribute('aria-label', ariaLabel); }`
- 为什么是问题：同 id 且展示字段有变时，`show` 会 `clearNode(this.element)`（第 248 行）再重建子节点。`clearNode` 只拆子节点，根元素上的 `aria-label` 还在。`getAriaLabel`（第 128–136 行）在没有 `ariaLabel`、且 `message` 不是字符串时返回 `undefined`，上面的分支不会改写属性。可见正文已经是新的 markdown，读屏名称仍是旧字符串。
- 方向：算出的标签为空时去掉元素上的 `aria-label`。

## r10-3 低

- 症状：全屏且标题栏溢出时，右侧动作条被藏掉，最小化/最大化/关闭当时并不占位。
- 位置：`src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` 第 978–980 行
- 引用：`this.windowControlsContainer?.querySelector('.window-icon')`
- 为什么是问题：全屏把 `.window-controls-container` 设为 `display: none`（`titlebarpart.css` 第 351–354 行），这段宽度不再进入 `scrollWidth`。`querySelector` 仍能找到容器里的 `.window-icon`。溢出判断因此成立，`action-toolbar-container` 被加上 `overflowing` 后 `display: none`（同文件第 488–489 行）。全屏窄窗口里标题栏动作消失，窗控按钮当时不可见。
- 方向：窗控容器已经不占位时，不要因为子节点还在 DOM 里就藏动作条。
