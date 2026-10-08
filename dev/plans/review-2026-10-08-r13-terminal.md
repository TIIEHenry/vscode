---
title: "审查 r13：terminal"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "1 条，最重为中：把仍有焦点的活动终端移出分组后，键盘焦点丢失。"
---

## r13-1 中
- 症状：取消拆分、拖到另一组或合并时，当前正在输入的终端被移出原组后，键盘焦点落到页面上，接下来的按键进不了任何终端。
- 位置：`src/vs/workbench/contrib/terminal/browser/terminalGroup.ts` 第 388–399 行
- 引用：`if (instance.hadFocusOnExit) { this.activeInstance?.focus(true); }`，随后 `this._splitPaneContainer?.remove(instance);`
- 为什么是问题：`hadFocusOnExit` 只在 `TerminalInstance.dispose` 里、且 `xterm.raw.element` 存在时写成当时的 `hasFocus`，构造时是 `false`。跨组移动、取消拆分、合并走的是 `removeInstance`，实例还活着，这个标志仍是 `false`，于是不会 `focus` 下一个。紧接着 `SplitPaneContainer.remove` 调用 `detachFromElement`，把仍挂着焦点的包装节点从 DOM 摘掉。被移走的实例重新挂上时没有 `focus`，同组留下的实例也没有。关掉终端的那条 `onDisposed` 路径不受影响，因为 dispose 会先写上标志。
- 方向：退出仍用 `hadFocusOnExit` 决定是否聚焦同组下一个；移出仍存活的实例时，在摘 DOM 之前记下 `hasFocus`，重新挂上后若原先有焦点则把焦点还给该实例。
