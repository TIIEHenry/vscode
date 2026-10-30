---
title: "方案 r11：workbench-shell"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 4，drop 0，weaken 1。面板占位按隐藏标志预留；Shift+F6 回到 Sources；禅模式恢复对话区；分类拖放用 groupId；空窗口关窗计入对话编辑器。"
---
# 方案 r11：workbench-shell

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 1

## r11-1（weaken）

反证：`SerializableGrid.deserialize` 传入 `proportionalLayout: false`（`layout.ts` 第 1726–1729 行）。`SplitView` 在该模式下不按比例缩放，`layout` 用 `resize` 消化「声明尺寸之和 − 可用长度」。底栏时 `data` 为 `[centerNodes, nodes.panel]`（第 2957 行），负向 delta 先打到面板，面板 `minimumHeight` 为 77（`panelPart.ts` 第 42 行），保存高度大于 77 时面板会被收到 77 附近，对话或预览留在几乎整段高度上。顶栏时数组是 `[nodes.panel, centerNodes]`，delta 先打到中心节点，面板叶子可以保住 `nodes.panel.size`。侧栏时第 2922 行确实少减了面板宽度，但 `ConversationPart.priority` 与编辑器都是 `LayoutPriority.High`（`conversationPart.ts` 第 85 行，`editorPart.ts` 第 1103 行），溢出先从这些高优先级视图扣。发现稿写的「做比例」和「侧栏后面板更窄」与这段布局算法对不上，故降级。仍成立的是第 2913 行：`PANEL_SIZE` 是数字（构造默认 300，第 3220 行；未写入存储时 `load` 会把默认改成高度的 1/3 或宽度的 1/4，第 3410 行），非 0 时局部 `panelSize` 为 0，而 `nodes.panel.size` 仍是该数字（第 3072 行），可见性另看 `PANEL_HIDDEN`（第 3073 行）。

- 问题类：面板占位把已保存的尺寸数字当成隐藏标志，非 0 时预留成 0，底栏首次布局把面板收到最小高度。
- 不变量：`arrangeMiddleSectionNodes` 的局部 `panelSize` 在 `PANEL_HIDDEN` 为 true 时为 0，为 false 时等于 `nodes.panel.size`。活动栏、侧栏、辅助栏继续用各自的 `*_HIDDEN`。叶子的 `size` 仍来自 `PANEL_SIZE`，`visible` 仍是 `!PANEL_HIDDEN`。底栏与顶栏的中心节点高度为 `availableHeight - panelSize`，侧栏时对话宽度减去 `panelSize`，兄弟声明尺寸之和等于该 split 的可用长度。
- 要动的符号或文件：`Layout.arrangeMiddleSectionNodes` 第 2913 行。改成与第 2909–2911 行相同的 `this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN) ? 0 : nodes.panel.size`。
- 明确不改什么：不改第 1729 行的 `proportionalLayout: false`。不改第 3004 行与第 3072 行对 `PANEL_SIZE` 的读取，不改第 3073 行的 `visible`。不改 `PanelPart.minimumHeight`。不改 `SplitView.resize` 的优先级顺序。
- 怎样本地验证：没有覆盖 `arrangeMiddleSectionNodes` 的测试。新增断言：`PANEL_SIZE` 为 300 且 `PANEL_HIDDEN` 为 false 时，局部 `panelSize` 为 300，第 2922 行对话宽度减去 300，第 2945 行与第 2955 行可用高度减去 300；`PANEL_HIDDEN` 为 true 时这三处减 0。用 `scripts/test.sh --run` 跑承载该断言的文件。

## r11-2（hold）

- 问题类：面板的上一个焦点部分是预览，Shift+F6 在预览可见时停在预览，到不了 Sources。
- 不变量：`getNominalPartFocusNeighbour(Parts.PANEL_PART, false, false)` 返回 `Parts.SOURCES_PART`。正向仍返回 `Parts.AUXILIARYBAR_PART`。`Parts.SOURCES_PART` 的反向仍是 `Parts.EDITOR_PART`（第 97 行）。`resolveVisiblePartFocusNeighbour` 仍在第一个可见邻居返回（第 128–132 行）：Sources 可见时从面板反向落到 Sources；Sources 隐藏且预览可见时落到预览。
- 要动的符号或文件：`getNominalPartFocusNeighbour` 里 `Parts.PANEL_PART` 的分支（`layoutService.ts` 第 100–101 行）。`next` 为 false 时返回 `Parts.SOURCES_PART`。
- 明确不改什么：不改 `MAIN_WINDOW_PART_FOCUS_CYCLE` 第 72–81 行的顺序。不改 `resolveVisiblePartFocusNeighbour`。不改 `workbench.action.focusNextPart` / `focusPreviousPart` 的键位（`navigationActions.ts` 第 299、317 行）和 `focusNextOrPreviousPart` 第 263–284 行的焦点判断。
- 怎样本地验证：`scripts/test.sh --run src/vs/workbench/services/layout/test/browser/layoutService.test.ts`。现有 `nominal neighbours chain Conversation → Preview → Sources forward` 与 `hidden Preview is skipped backward from Sources` 保持通过。在 suite `LayoutService - F6 part focus cycle` 新增断言：`getNominalPartFocusNeighbour(Parts.PANEL_PART, false, false)` 为 `Parts.SOURCES_PART`，正向仍为 `Parts.AUXILIARYBAR_PART`；全部可见时 `resolveVisiblePartFocusNeighbour` 从 `Parts.PANEL_PART` 反向得到 `Parts.SOURCES_PART`；去掉 Sources、保留预览时，同一反向调用得到 `Parts.EDITOR_PART`。

## r11-3（hold）

- 问题类：进入禅模式会强制打开对话区，退出信息没有记下原来是否可见，退出后对话区仍开着。
- 不变量：`IZenModeExitInfoWasVisible` 含 `conversation: boolean`。`restoring` 为 false 时，在第 1544 行 `setConversationHidden(false)` 之前把 `isVisible(Parts.CONVERSATION_PART)` 写入 `wasVisible.conversation`。退出时在预览与 Sources 恢复之后（现第 1628 行之后）按该布尔值调用 `setConversationHidden`。先恢复预览或 Sources，再藏起对话区，使 `setConversationHidden(true)` 里的 `enforceAgentShellVisible` 看到 End 列已经可见。已保存的退出信息没有 `conversation` 字段时不调用 `setConversationHidden`，对话区保持禅模式留下的打开状态。`createDefaultZenModeExitInfo` 里该字段为 false。
- 要动的符号或文件：`IZenModeExitInfoWasVisible` 与 `createDefaultZenModeExitInfo`（`layoutService.ts` 第 163–190 行）。`Layout.toggleZenMode` 的进入快照（`layout.ts` 第 1535–1536 行旁）和退出恢复（第 1626–1628 行之后）。
- 明确不改什么：不改进入时的 `setConversationHidden(false)`、`setEditorHidden(true)`、`setSourcesHidden(true)`。不改 `forceShownAgentShellPart`，不改 `enforceAgentShellVisible` 对最大化辅助栏和最大化面板的跳过。不改侧栏、面板、辅助栏的快照与恢复。
- 怎样本地验证：`scripts/test.sh --run src/vs/workbench/services/layout/test/browser/layoutService.test.ts`。更新 `createDefaultZenModeExitInfo includes End column visibility snapshot defaults`，`wasVisible` 增加 `conversation: false`。`zen mode keeps Conversation visible and hides End column under INV-052` 保持通过。`toggleZenMode` 没有现成测试。新增断言：进入前对话区不可见且预览可见，快照 `conversation` 为 false，退出后对话区隐藏且预览可见；进入前对话区可见，退出后对话区可见；退出信息缺少 `conversation` 时不把对话区藏起来。

## r11-4（hold）

- 问题类：分类条拖放只提交编辑器，源组按创建顺序取第一个 `matches`，关掉的是更早那一组里的标签。
- 不变量：拖放把 `dragged.identifier.groupId` 交给 `moveEditorToCategory`。第三参为 `GroupIdentifier` 时用本 part 的 `getGroup`（`editorPart.ts` 第 375–376 行，只查 `groupViews`）；为 `IEditorGroup` 时直接用该组；两者都没有再 `groupContaining`，最后才 `activeGroup`。命令路径继续传组对象。跨组移动仍走 `doMoveOrCopyEditorAcrossGroups`，关闭仍是第 1512 行的 `doCloseEditor`。
- 要动的符号或文件：`IPreviewCategoryBarHost.moveEditorToCategory`（`previewCategorySwitcher.ts` 第 18 行）增加可选 `GroupIdentifier`。第 154 行传入 `dragged.identifier.groupId`。`CategorizedMainEditorPart.moveEditorToCategory`（第 343–344 行）的第三参改为 `IEditorGroup | GroupIdentifier | undefined`，按上面的顺序解析源组。
- 明确不改什么：不改 `groupContaining`（第 528–530 行）。不改 `editorGroupView.ts` 第 1512 行的 `doCloseEditor`，不把这次关闭改到第 1567 行的 `doCloseEditorWithConfirmationHandling`。不改 `editorCommands.ts` 第 1727 行已经传入 group 的调用。不改 `DraggedEditorIdentifier` 与 `IEditorIdentifier.groupId`。
- 怎样本地验证：`scripts/test.sh --run src/vs/workbench/test/browser/parts/editor/previewCategoryIsolation.test.ts` 与 `scripts/test.sh --run src/vs/workbench/test/browser/parts/editor/previewCategoryPart.test.ts`。现有 `Drop dragged editor onto category switcher tab moves editor` 的夹具已带 `groupId: 0`，断言第三参就是这个 `groupId`。现有 `move editor lands in the target category group` 保持通过。新增断言：同一资源在两个组里都 `matches` 时，传入后创建那组的 id，该组编辑器减少，先创建组的编辑器还在。

## r11-5（hold）

- 问题类：空窗口打开 `window.closeWhenEmpty` 或带 `--wait` 时，主 part 各组为空就关窗，对话 part 里的编辑器不算。
- 不变量：`maybeCloseWindow` 处理主 part 时，若 `editorGroupService.conversationParts` 里任一 part 的 `groups` 存在 `!group.isEmpty`，则 `continue`，不调用 `closeWindow`。`EditorService.visibleEditors` 与 `EditorParts.getGroups` 的全局聚合仍排除 `excludeFromGlobalEditorAggregation`。工作区不是 `WorkbenchState.EMPTY`、扩展开发、`visibleEditors.length > 0` 这三道挡板保持。非主 part 且自身各组为空时，仍 `removeGroup(activeGroup)`，不关窗。
- 要动的符号或文件：`NativeWindow.maybeCloseWindow`（`window.ts` 第 638–644 行）的主 part 条件，加上对话 part 非空。
- 明确不改什么：不改第 396 行对 `onDidVisibleEditorsChange` 的监听。不改 `visibleEditors`（`editorService.ts` 第 527–528 行）、`getGloballyAggregatedParts`（`editorParts.ts` 第 488–489 行）、`ConversationEditorPartImpl.excludeFromGlobalEditorAggregation`（`conversationEditorPart.ts` 第 28 行）。不改第 627 行 `window.closeWhenEmpty` 与 `args.wait` 的或条件。不改第 633–636 行「该 part 自身非空则跳过该 part」。
- 怎样本地验证：没有 `maybeCloseWindow` 的测试。`scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEditorAggregation.test.ts`。现有 `global editor enumeration excludes conversation chat tabs`、`getGroups for global navigation excludes conversation groups`、`conversation parts declare aggregation exclusion and do not implement auxiliary close()` 保持通过。新增断言：工作区为 `EMPTY`、`window.closeWhenEmpty` 为 true、主 part 各组为空、某个对话 part 的组非空时不调用 `closeWindow`；对话组也都空时调用 `closeWindow`；工作区不是 `EMPTY` 时不调用。
