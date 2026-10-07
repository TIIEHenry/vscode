---
title: "审查 r11：workbench-shell"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "面板初始尺寸被当成隐藏；Shift+F6 跳过 Sources；禅模式不恢复对话区；分类拖放关错标签；空窗口关闭忽略对话编辑器。"
---

## r11-1 中
- 症状：面板开着时重启，面板比上次保存的尺寸更窄或更矮，对话或预览多占了本该留给面板的那一截。
- 位置：`src/vs/workbench/browser/layout.ts` 第 2909–2955 行
- 引用：`const panelSize = this.stateModel.getInitializationValue(LayoutStateKeys.PANEL_SIZE) ? 0 : nodes.panel.size;`
- 为什么是问题：同一函数里活动栏、侧栏、辅助栏用的是「是否隐藏」。面板这一行把已保存的尺寸数字当成布尔值。`PANEL_SIZE` 默认 300，只要存过非 0 尺寸，局部变量就是 0。面板叶子自己的 `size` 仍是该尺寸，可见性另看 `PANEL_HIDDEN`。底栏时中部按整段高度去排，再和面板尺寸做比例，面板分到的高度小于保存值。侧栏时对话宽度少减了面板宽度。面板隐藏时减 0，碰巧和「不占位」一致。
- 方向：用 `PANEL_HIDDEN` 决定占位，可见时减去 `nodes.panel.size`。

## r11-2 中
- 症状：Sources 可见时，焦点在面板上按 Shift+F6 会落到预览，到不了 Sources。
- 位置：`src/vs/workbench/services/layout/browser/layoutService.ts` 第 96–101 行
- 引用：`case Parts.PANEL_PART: return next ? Parts.AUXILIARYBAR_PART : Parts.EDITOR_PART;`
- 为什么是问题：`MAIN_WINDOW_PART_FOCUS_CYCLE` 的顺序是对话、预览、Sources、面板。正向邻居是 Sources → 面板。反向从面板直接到预览。`resolveVisiblePartFocusNeighbour` 在邻居可见时立刻返回，预览可见就不会继续走到 Sources。F6 / Shift+F6 走的就是这个函数。
- 方向：面板的上一个焦点改为 Sources。

## r11-3 中
- 症状：事先藏起对话区再进入禅模式，退出后对话区仍然开着。
- 位置：`src/vs/workbench/browser/layout.ts` 第 1535–1546 行
- 引用：快照只写 `wasVisible.editor` 和 `wasVisible.sources`；接着 `this.setConversationHidden(false)`。退出段第 1622–1628 行只恢复预览和 Sources。
- 为什么是问题：进入禅模式会把对话区强制打开，退出信息里没有对话区原来是否可见。退出时按快照把预览和 Sources 设回去，没有对应的 `setConversationHidden`。
- 方向：进入前记下对话区可见性，退出时按该值恢复。

## r11-4 中
- 症状：同一文件在两个预览组里都打开时，把后打开的那个标签拖到分类条，会关掉更早那一组里的标签。
- 位置：`src/vs/workbench/browser/parts/editor/categorizedMainEditorPart.ts` 第 343–348 行
- 引用：`const sourceGroup = source ?? this.groupContaining(editor) ?? this.activeGroup;` 然后 `sourceGroup.moveEditor(editor, target)`。分类条第 154 行只传入 `dragged.identifier.editor`。
- 为什么是问题：拖放标识里有 `groupId`，分类条没把它交给 `moveEditorToCategory`。`groupContaining` 按组的创建顺序找第一个 `matches` 命中的组。`moveEditor` 跨组时调用 `doCloseEditor`（`editorGroupView.ts` 第 1512 行），不走保存确认，关掉的是这个源组里匹配到的编辑器，不一定是被拖的那一个。
- 方向：拖放时用 `dragged.identifier.groupId` 作为源组。

## r11-5 中
- 症状：没有打开文件夹的空窗口里，只要打开了 `window.closeWhenEmpty` 或带 `--wait`，预览区没有编辑器就会关掉整个窗口，对话区里的编辑器不算。
- 位置：`src/vs/workbench/electron-browser/window.ts` 第 633–647 行
- 引用：某个 part 里还有编辑器就 `continue`；主 part 全空则 `this.nativeHostService.closeWindow()`。挡住关闭的条件含 `this.editorService.visibleEditors.length > 0`。
- 为什么是问题：`visibleEditors` 来自全局聚合，对话 editor part 被 `excludeFromGlobalEditorAggregation` 排除。循环里对话 part 非空只跳过该 part，不会阻止后面的主 part 关窗。分类预览的根组可以全部没有编辑器，对话组里仍有编辑器。
- 方向：关窗前把对话 part 中未关闭的编辑器算进非空。
