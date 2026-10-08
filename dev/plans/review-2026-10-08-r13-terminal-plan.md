---
title: "方案 r13：terminal"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 1，drop 0，weaken 0。移出仍存活且有焦点的终端后把焦点还回去。不升 implemented，不升 PRD。"
---

hold 1，drop 0，weaken 0。

## r13-1（hold，中）

问题类：取消拆分、拖到另一组或合并时，仍有键盘焦点的存活终端被摘掉后，焦点没有回到任何终端。

不变量：关掉终端时，只有 `hadFocusOnExit` 为真才对同组下一个调用 `focus(true)`。移出仍存活的实例不写 `hadFocusOnExit`，也不因此聚焦同组留下的实例。第一次 `detachFromElement` 之前 `hasFocus` 为真的那个实例，在最后一次挂回并且所在组已经可见之后，收到 `focus(true)`。`hasFocus` 为假则这次移动不调用 `focus`。

要动的符号或文件：`TerminalGroupService.unsplitInstance`、`TerminalGroupService.moveInstance`、`TerminalGroupService.joinInstances`（`src/vs/workbench/contrib/terminal/browser/terminalGroupService.ts`），以及 `TerminalGroup.moveInstance`（`src/vs/workbench/contrib/terminal/browser/terminalGroup.ts`）。取样用 `ITerminalInstance.hasFocus`，归还用已有的 `focus(true)`。取消拆分后新组要先经已有的 `setActiveInstance` 成为活动组，让 `updateVisibility` 把它设为可见，再 `focus`。

怎么改：在各自第一次摘节点之前把 `hasFocus` 记在这次调用的局部布尔值上。`unsplitInstance` 在 `createGroup` 之后，若为真则 `setActiveInstance` 再 `focus(true)`。跨组 `moveInstance` 的取样在 `sourceGroup.removeInstance` 之前，归还放在随后的 `targetGroup.moveInstance` 返回之后；目标组若还不是活动组，先 `setActiveInstance`。`joinInstances` 对每个被移出的实例分别取样，保留现有的 `setActiveInstance(instances[0])`，在它之后只对取样为真的那个实例 `focus(true)`。`TerminalGroup.moveInstance` 自己还会 `SplitPaneContainer.remove` 再 `split`：同组重排时包装节点仍在，由它在 `remove` 之前取样，`split` 之后归还；跨组时节点已经摘过，这里读到的 `hasFocus` 是假，不得覆盖服务层记下的值。

明确不改：不改 `TerminalInstance.dispose` 里对 `_hadFocusOnExit` 的赋值，也不改构造时的 `false`。不改 `TerminalGroup._removeInstance` 里仅当 `hadFocusOnExit` 才 `activeInstance?.focus(true)` 的条件。不改 `TerminalGroupService._removeGroup` 对 `group.hadFocusOnExit` 的处理。不改 `moveToEditor`、`moveToBackground`、`onDidRequestDetach` 以及编辑器打开前的 `removeInstance`。不改 `moveGroup` 里跨组只重排 `groups`、不摘节点的分支。不把这次取样写入 `hadFocusOnExit`。`hasFocus` 已为假时，不改为聚焦同组下一个，也不无条件聚焦被移动的实例。

怎样本地验证：`src/vs/workbench/contrib/terminal/test/browser/terminalGroup.test.ts` 里 `should not focus next instance when active instance hadFocusOnExit is false` 与 `should focus next instance with force=true when active instance hadFocusOnExit is true` 仍通过。同文件新增：`moveInstance` 移动前 `hasFocus === true` 时，该实例的 `focus` 以 `true` 被调用，另一个实例不被这次移动聚焦；`removeInstance` 在 `hadFocusOnExit === false` 且 `hasFocus === true` 时，留下的实例 `focusCount` 仍为 0。`TerminalGroupService` 没有现成测试。应新增断言：`unsplitInstance`、跨组 `moveInstance`、`joinInstances` 里，第一次 `removeInstance` 前 `hasFocus === true` 的实例在操作结束后收到 `focus(true)`，同组留下的实例没有因此被聚焦；`unsplitInstance` 还要断言 `focus` 发生时该实例所在组已是活动组。用 `scripts/test.sh --grep TerminalGroup` 跑上述浏览器单测。
