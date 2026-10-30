---
title: "十六路审查 r09：workbench 壳方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 3，不实施 1，weaken 1。"
---
# 十六路审查 r09：workbench 壳方案

状态：草案。
覆盖需求：无（正文未引用需求编号）。

| 编号 | 判定 | 严重度 |
|:-----|:-----|:-------|
| r09-1 | hold | 中 |
| r09-2 | hold | 中 |
| r09-3 | hold | 中 |
| r09-4 | 不实施 | 低 |
| r09-5 | weaken | 低 |

### r09-1

**问题类：** 末列被用户藏起时，`isPanelMaximized()` 仍为真，至少留一块可见的补回被跳过，关面板还会按最大化快照把末列打开。

**不变量：** 对话、Preview、Sources 至少一块可见（`enforceAgentShellVisible` / `ensureAgentShellMinimumVisible` 上的 INV-052）。用户只把 Preview 和 Sources 都藏起、面板对齐仍是默认 `center`、且不在禅模式时，谓词为假，藏起对话必须把 Preview 补回来。关闭面板只有在 `toggleMaximizedPanel` 写下的活标记为真时才走恢复分支。禅模式藏末列不经过 `toggleMaximizedPanel`。今天 `isPanelMaximized()` 在末列隐藏且对齐为 `center` 时为真，`enforceAgentShellVisible` 因此直接返回，`focus()` 在谓词为真时先聚焦面板。禅模式期间这两处保持现有短路。禅模式藏末列不调用 `toggleMaximizedPanel`。禅模式期间 `isPanelMaximized()` 保持现在的结果，`enforceAgentShellVisible` 继续在该结果为真时返回，`Layout.focus()` 在谓词为真时仍先聚焦面板。新标记不得让禅模式改道。

**要动的符号或文件：**

- `src/vs/workbench/browser/layout.ts`：`Layout.isPanelMaximized`、`Layout.toggleMaximizedPanel`、`Layout.setPanelHidden`、`Layout.enforceAgentShellVisible`、`Layout.ensureAgentShellMinimumVisible`
- 在 `LayoutStateKeys` 旁增加只由 `toggleMaximizedPanel` 写入的当前最大化运行时标记。最大化分支在藏末列之前置真，恢复分支在按快照还原可见性之前置假。`isPanelMaximized()` 读这个标记，并继续要求辅助栏未最大化，以及对齐允许最大化（`center`，或面板不在上下侧）。
- `src/vs/workbench/services/layout/test/browser/layoutService.test.ts` 里本地镜像函数 `isPanelMaximizedEndColumn` 与测试 `maximized when End column hidden, not when only Conversation is hidden`

**明确不改什么：**

- `forceShownAgentShellPart` 的选择顺序。
- `toggleMaximizedPanel` 最大化分支里先藏 Sources、再藏 Preview 的顺序，以及当时写入的 `PANEL_LAST_NON_MAXIMIZED_VISIBILITY`。
- 恢复分支里 `editorVisible ?? true` / `sourcesVisible ?? true` 只服务于真正最大化过的那次快照。
- `PANEL_WAS_LAST_MAXIMIZED` 继续只给 `panelOpensMaximized()` 的 remember-last 用。`setPanelHidden` 在隐藏面板时把「关上前是否最大化」写回这个键的行为保持不变。这个键在关上之后仍可能为真，不能拿来当当前是否最大化。
- 辅助栏最大化路径，以及 `PANEL_ALIGNMENT` 的默认值 `center`。
- 禅模式进入时 `setEditorHidden` / `setSourcesHidden` 的顺序。禅模式期间 `isPanelMaximized`、`enforceAgentShellVisible`、`focus` 的现有结果。

**怎样本地验证：** `scripts/test.sh --grep "maximized when End column hidden"`。该测试今天把「末列隐藏且对齐为 center」期望成最大化；改成：没有当前最大化标记时，末列隐藏期望为假；标记为真且辅助栏未最大化时期望为真；辅助栏已最大化时期望为假。另在 `LayoutService - panel maximize End column` 增加断言：Preview 与 Sources 都已隐藏、当前最大化标记为假时，`setPartHidden(true, Parts.CONVERSATION_PART)` 之后 Preview 可见；接着 `setPartHidden(true, Parts.PANEL_PART)` 不会把 Sources 按默认快照打开。已有 `panel maximize keeps Conversation visible under INV-052` 保持通过。

### r09-2

**问题类：** 末列整列不可见时，保存把 Sources 叶子的可见尺寸缓存写成末列宽度。

**不变量：** `EDITOR_SIZE` 只表示末列横向宽度。两块都隐藏时，用第二块藏起之前记下的宽度写它。Sources 缓存缺失时，这项仍写。`SOURCES_SIZE` 继续用现有 Sources 隐藏分支的 `getViewCachedVisibleSize`。先藏 Preview 时这份缓存可以是整列高度。不要把它改成永远等于分割高度，也不要在缓存不是 number 时连 `EDITOR_SIZE` 一起跳过。缓存缺失时不把 `undefined` 写进任一项。

**要动的符号或文件：**

- `src/vs/workbench/browser/layout.ts`：`createWorkbenchLayout` 里 `onWillSaveState` 对 `LayoutStateKeys.EDITOR_SIZE` / `SOURCES_SIZE` 的赋值；`setEditorHidden`、`setSourcesHidden`（末列从「还有一块可见」变成两块都隐藏的那一次）
- 在第二块末列部件隐藏之前，把当时仍可见那一块的 `getViewSize(...).width` 记成末列宽度。`onWillSaveState` 在 `editorHidden && sourcesHidden` 时只把这份宽度写入 `EDITOR_SIZE`；没有数字就不调用 `setInitializationValue`。
- `SOURCES_SIZE` 继续走现有的 Sources 隐藏分支：`getViewCachedVisibleSize(sourcesPartView)` 且 `typeof === 'number'`。

**明确不改什么：**

- 末列仍有一块可见时，用该视图 `getViewSize().width` 写 `EDITOR_SIZE` 的路径。
- Sources 与 Preview 同时可见时，用 `sourcesPartView` 的 height 写 `SOURCES_SIZE`。
- `toggleMaximizedPanel` 里先藏 Sources 以保住分割高度缓存的顺序。
- `capturePanelMaximizeEndColumnSize` / `restorePanelMaximizeEndColumnSize` 的会话内恢复。
- `arrangeEndColumnNode` 把 `EDITOR_SIZE` 当宽度、`SOURCES_SIZE` 当分割高度的读法。

**怎样本地验证：** 现有测试没有覆盖这段保存。在 `src/vs/workbench/services/layout/test/browser/layoutService.test.ts` 增加断言：Preview 与 Sources 都隐藏之后触发与 `onWillSaveState` 相同的尺寸保存，`workbench.editor.size` 等于藏起前记下的末列宽度。`workbench.sources.size` 等于当时的 Sources 缓存。缓存不是 number 时只跳过 `SOURCES_SIZE`，`EDITOR_SIZE` 仍写入。面板最大化（先藏 Sources）与禅模式（先藏 Preview）两条隐藏顺序都要覆盖，禅模式那条不要求 `sources.size` 等于分割高度。`layoutArrangeMiddleSection.test.ts` 的 `a persisted end column width does not starve the conversation` 保持通过。

### r09-3

**问题类：** 启动恢复里，`viewColumn` 超出当前可见分类组时，文件被 `continue` 丢掉，且没有日志。

**不变量：** `restoreParts` 拿到的每个带 `viewColumn` 的启动编辑器都会打开到主 Preview 当前分类里。列号落在可见组内时，仍按从 1 计的视觉顺序放进对应组。列号超出可见组数量时，打开到当前分类的活动组，或先在当前分类补一个组再打开。不得静默跳过。

**要动的符号或文件：**

- `src/vs/workbench/browser/layout.ts`：`restoreParts` 里 `editorGroupsInVisualOrder[(editor.viewColumn ?? 1) - 1]` 以及其后的 `if (!group) continue`
- 主 Preview 已是 `isPreviewCategoryRoutingPart` 时，列号超出可见组数量则打开到当前分类的活动组，或调用 `addGroupInCategory` 再打开。`ensureCategoryGroup` 在该分类已有组时直接返回那个组，不会为 `viewColumn: 2` 再补一组。可见组过滤（`isGroupVisible`）保留。非分类主 Preview 上超出组数的列号同样不得 `continue`。组号落在已有可见组内时的下标映射保持。

**明确不改什么：**

- `CategorizedMainEditorPart.isGroupVisible`：非活动分类的组仍然不可见。
- `installCategories` / `applyVisibility` 的分类显隐。
- 已有组上 `openEditors` 失败时的 `logService.error`。
- 组已经存在时，从 1 计的视觉顺序映射。超出组数的列号不在这条里。
- 未带 `viewColumn` 的启动文件仍进第一列。

**怎样本地验证：** 现有测试没有覆盖这条映射。为 `restoreParts` 的映射补断言：分类部件 `ready === true`、活动分类只有一个可见组时，`viewColumn: 1` 进入该组，`viewColumn: 2` 的编辑器出现在该活动组（或该分类新建的组）里，而不是被跳过。非分类部件上超出组数的列号也要打开，不得 `continue` 丢掉。

### r09-4

**问题类：** `zenMode.centerLayout` 默认为真，但进入禅模式和该项变更都不会居中。

**不实施：** 不改 `layout.ts`。`docs/systems/workbench/parts-and-grid.md` 写明 Zen Mode 不居中 Preview。进入时 `setEditorHidden(true)` 把 Preview 藏起。`centerMainEditorLayout` 居中的是主 Preview。进入时居中会作用在已隐藏的 Preview 上，退出时若标记为真又会取消居中。发现稿的方向与这份已接受合同相反，不把「进入禅模式必须居中」写成要实施的不变量。若以后要让 `zenMode.centerLayout` 生效，先改合同，并写明居中发生在退出并恢复 Preview 之后。

**怎样本地验证：** 本条没有新测试。已有 `toggleZenMode snapshots conversation visibility and restores it on exit` 保持通过。

### r09-5

**问题类：** 关闭面板时无条件聚焦主 Preview 活动组，Preview 已隐藏时对话输入拿不到按键。

**不变量：** 面板从可见变为隐藏、并且当前有活动面板复合体时，焦点落点与 `Layout.focus()` 在非最大化下的顺序一致：对话可见则 `focusPart(Parts.CONVERSATION_PART)`，否则 Sources 可见则聚焦 Sources，否则才聚焦主 Preview 活动组。`EDITOR_PART` 不可见时不调用 `mainPart.activeGroup.focus()`。

**要动的符号或文件：**

- `src/vs/workbench/browser/layout.ts`：`Layout.setPanelHidden` 里 `focusEditor` 以及其后的 `this.editorGroupService.mainPart.activeGroup.focus()`
- 把该落点改成调用与 `Layout.focus()` 相同的部件选择（对话、Sources、Preview）。Preview 不可见时不要进入编辑器组的 `focus()`。

**明确不改什么：**

- `!isIOS` 与 `!this.isAuxiliaryBarMaximized()` 这两道跳过条件。
- `Layout.focus()` 在面板已最大化、辅助栏已最大化时的优先落点。
- `EditorGroupView.focus()` 本身，包括它在末尾触发 `_onDidFocus`。
- 关闭面板在非最大化下跟随 `focus()`：对话可见就聚焦对话，不论 Preview 是否可见。

**反证与降级后的严重度：** 严重度由中降为低。`src/vs/base/browser/ui/splitview/splitview.css` 中 `.split-view-view:not(.visible)` 为 `display: none`。Preview 已隐藏时，它所在的网格视图不参与渲染，`activeGroup.focus()` 不会把 `document.activeElement` 放进这块隐藏子树。发现稿写的「焦点进入隐藏的 Preview」超出了这段样式。核心仍在：`setPanelHidden` 不看 `EDITOR_PART` 是否可见，也不会改走 `Layout.focus()` 在对话可见时的落点；面板自身变为 `display: none` 之后，焦点不会交给对话输入。

**怎样本地验证：** `scripts/test.sh --grep "hidden Preview is skipped"`。另在 `src/vs/workbench/services/layout/test/browser/layoutService.test.ts` 增加断言：对话可见时，即使 Preview 也可见，`setPartHidden(true, Parts.PANEL_PART)` 聚焦对话，不调用主 Preview 活动组的 `focus()`。对话与 Preview 都不可见、Sources 可见时聚焦 Sources。只剩 Preview 时才聚焦主 Preview 活动组。已有 `hidden Preview is skipped backward from Sources` 与 `default focus target prefers visible agent-shell parts when Conversation is hidden` 保持通过。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r09-4 不实施。`parts-and-grid.md` 写明 Zen Mode 不居中 Preview。Important 已改：r09-1 在禅模式期间保持 `isPanelMaximized` 的现有短路；r09-2 把末列宽度和 Sources 缓存分开写；r09-3 超出组数时用活动组或 `addGroupInCategory`，非分类路径同样不得跳过；r09-5 关闭面板时对话可见就聚焦对话。
