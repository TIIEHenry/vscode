---
title: "审查 r04：editor-part"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "分类条 inset 布局 top 少抬 28px；Terminal 空态快捷键与点击命令不一致；对话同组多编辑器无标签；并排最小尺寸不按方向。"
---

# 审查 r04：editor-part

范围：`src/vs/workbench/browser/parts/editor`。已跳过 r11-4（分类拖放源组）：活码 `previewCategorySwitcher.ts` 已传 `groupId`，`moveEditorToCategory` 已按 number 解析。已跳过 r02（editor 层折行 / Unicode，不在本路径）。

## r04-1 中

- 症状：主预览带分类条时，编辑器内部按绝对坐标摆的浮层（查找、小地图相关定位、部分 overlay）相对可见编辑区偏上约 28px，容易顶进分类条或标题一带。
- 位置：`src/vs/workbench/browser/parts/editor/editorPart.ts` 第 1544–1552 行；`categorizedMainEditorPart.ts` 第 89–90 行；`media/previewCategoryBar.css` 第 12–15 行
- 引用：`doLayout` 取 `reserved = Math.max(header, this.gridLayoutInsets().height)`，却把网格放在 `top + header`。`CategorizedMainEditorPart` 的 `showsPreviewCategoryBar()` 为 false，故 `header === 0`，`gridLayoutInsets().height === 28`，高度减了 28，top 不抬。CSS 用 `margin-top: 28px` / `height: calc(100% - 28px)` 只挪 DOM，不改传入各 group / pane 的绝对 `top`。
- 为什么是问题：分类预览是主路径（`editorParts.ts` 建的是 `CategorizedMainEditorPart`）。布局链把错误的 `top` 交给 `editorPane.layout`，可见内容已在条下，坐标仍按条顶算，浮层与点击命中区会错位。
- 方向：inset 与 header 一样，把网格的布局 top 改为 `top + reserved`（或去掉 CSS margin、统一走 header 偏移）。

## r04-2 中

- 症状：预览 Terminal 分类空态上的「New Terminal」按钮旁快捷键是本地 `createTerminalEditor` 的绑定；引擎已连接且 Pty 桥可用时，点击却打开引擎编辑器终端，和键位提示不是同一条命令。
- 位置：`src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts` 第 256–261、306–318、363–369 行
- 引用：`getCategoryActions(Terminal)` 固定 `id: previewTerminalLocalCommandId`；渲染里 `lookupKeybinding(action.id)` 也按该 id；点击却 `if (action.id === previewTerminalLocalCommandId) { void this.runPreviewTerminalAction(); }`，而 `runPreviewTerminalAction` 经 `previewTerminalEmptyStateCommand(connected, bridgeAvailable)` 可能改跑 `previewUniverseAgentPtyEditorCommandId`。
- 为什么是问题：空态是用户能看见的操作入口。显示的快捷键与按钮实际执行命令不一致，属于显示与状态/行为错位。
- 方向：渲染前解析与点击相同的 command id，再查键位；或空态只暴露与当前解析结果一致的那一条。

## r04-3 中

- 症状：对话编辑器 part 里同一个可见组打开了多个非扩展标签编辑器时，标签栏仍被强制成 `none`，界面上看不到、点不到标签切换，只能靠快捷键在「看不见的」栈里切。
- 位置：`src/vs/workbench/browser/parts/editor/conversationEditorPart.ts` 第 104–119 行
- 引用：`extensionTabCount` 只统计 `isConversationExtensionTab`；`showTabs = extensionTabCount > 0 || visibleGroupCount > 1 ? 'multiple' : 'none'`。同组 `group.count > 1` 但扩展标签为 0、且只有一个可见组时，一直是 `none`，并 `enforcePartOptions({ showTabs, ... })`。
- 为什么是问题：`showTabs: 'none'` 走 `NoEditorTabsControl`，多编辑器状态在模型里存在，标题区却不展示可点标签，属于显示与状态不一致、点不到。
- 方向：`showTabs` 条件加上「任一可见组 `count > 1`」，或与扩展标签同一套可见标签策略。

## r04-4 低

- 症状：组内并排编辑器在「左右」布局时最小高度、在「上下」布局时最小宽度被加成两侧之和，窗口或分组被压得很窄/很矮时比单编辑器更早顶死，分栏被多余空白或无法再缩小。
- 位置：`src/vs/workbench/browser/parts/editor/sideBySideEditor.ts` 第 88–91、138、211–216 行
- 引用：`minimumWidth` / `minimumHeight`（及对应 maximum）恒为两侧相加；`orientation` 在 HORIZONTAL（左右）与 VERTICAL（上下）间切换，但约束公式不随方向改成「主轴相加、交叉轴取 max」。
- 为什么是问题：左右并排时高度不应叠加两侧 `minimumHeight`；上下堆叠时宽度不应叠加两侧 `minimumWidth`。约束偏大时，小尺寸下布局更早无法再收，表现为分栏「顶住」或一侧被压得异常。
- 方向：按 `this.orientation` 分别计算主轴 sum、交叉轴 max。
