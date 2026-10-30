---
title: "审查 r11：editor-panel"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "1 条，最重为中：引擎已连接时 Terminal 空态在桥探测结束前仍执行本地新建终端。"
---

# 审查 r11：editor-panel
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：本路 editor / panel / auxiliaryBar diff。10-06 已记且活码已按该方向改过的项不再报：分类条原点、空态键位与点击不是同一条命令、并排尺寸不随方向、经典左面板少扣 1px、整组搬视图后不打开源侧容器。

## r11-1 中

- 症状：引擎已经连上、Pty 桥其实可用时，预览 Terminal 空态的「New Terminal」仍打开本地编辑器终端；桥探测抛错后，同一次连接里会一直这样，直到连接状态再变一次。
- 位置：`src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts` 第 147–151、162–189、201–208、314–317、374–376 行
- 引用：`this.queryBridgeAvailable();` 之后立刻 `this.render();`。已连接分支只有 `this.queryBridgeAvailable();`。`const id = previewTerminalEmptyStateCommand(connected, this.bridgeAvailable);` 点击是 `void this.commandService.executeCommand(action.id);`。`catch` 里 `result = false`，随后 `this.bridgeAvailable = result`。
- 为什么是问题：`bridgeAvailable` 初始是 false，构造时先画出按钮再等 `isBridgeAvailable()`。连上引擎时也不先重绘，探测返回前按钮和快捷键都按本地命令绑死。分类切换或快捷键更新触发的 `render()` 会把这个未完成结果再写一遍。探测 reject 时把 false 当成最终结果留下，同一次连接不会再查。用户点到的是本地 `createTerminalEditor`，而不是引擎编辑器终端。
- 方向：点击时按当前连接再查一次桥，或探测未完成、失败时不要把本地命令留在按钮上。
