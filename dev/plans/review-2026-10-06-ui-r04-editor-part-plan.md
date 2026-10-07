---
title: "方案 r04：editor-part"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "分类条布局原点改为 top+reserved；Terminal 空态键位与点击同一命令；并排约束按方向分主轴与交叉轴。"
---

# 方案 r04：editor-part

核查保留 r04-1（降级）、r04-2、r04-4。只写改法。

## r04-1（降级）分类条布局原点

问题类：`CategorizedMainEditorPart` 把分类条高度放进 `gridLayoutInsets()`，`EditorPart.doLayout` 用它减网格高度，传给网格的 top 仍是 `top + header`，而这条路径上 `showsPreviewCategoryBar()` 为 false，`header` 为 0，原点比 CSS `margin-top: 28px` 之后的网格顶边少 28px。

反证：查找框（`findWidget.ts` 的 `getDomNodePagePosition`）、小地图（`minimap.ts` 的 `getDomNodePagePosition`）、overflow overlay（`overlayWidgets.ts` 的 `prepareRender`）都量 DOM，不读这个 top。`browserEditor.layout` 丢掉 `_position`，`layoutBrowserContainer` 用 `getBoundingClientRect`。不能把验收写成这些浮层或点击偏上 28px。

不变量：传给 `centeredLayoutWidget.layout` 的 top 等于内容区 top 加上实际预留高度；预留高度 `reserved = max(header, gridLayoutInsets().height)` 只减一次，header 与 inset 不叠两次。

要动：`EditorPart.doLayout`。`centeredLayoutWidget.layout` 的第三个参数从 `top + header` 改为 `top + reserved`。同函数上方注释改成：inset 与 header 一样，原点用 `reserved`；CSS 只负责把条钉在网格上方，不代替这个原点。

不改：`previewCategoryBar.css` 的 `margin-top` / `height: calc(100% - 28px)`，`CategorizedMainEditorPart.showsPreviewCategoryBar`、`gridLayoutInsets`、`CATEGORY_BAR_HEIGHT`，`MainEditorPart.showsPreviewCategoryBar`。不要改成去掉 CSS margin 再抬 top。

验证：没有现成测试。在 editor part 布局测试里断言：`showsPreviewCategoryBar()` 为 false 且 `gridLayoutInsets().height` 为 28 时，网格 layout 的 top 比传入 content top 大 28、height 少 28；header 为 28 且 inset 为 0 时，top 与 height 与改前相同。用 `scripts/test.sh` 加对应 `--grep`。不要用查找框或小地图的屏幕坐标当验收。

## r04-2 Terminal 空态键位与点击

问题类：Terminal 分类空态按钮旁的快捷键按 `previewTerminalLocalCommandId` 查，点击却进 `runPreviewTerminalAction`，经 `previewTerminalEmptyStateCommand` 在引擎已连接且 Pty 桥可用时改跑 `previewUniverseAgentPtyEditorCommandId`。

不变量：空态画出的键位与点击执行的 command id 是同一个；该 id 仍只由 `previewTerminalEmptyStateCommand(connected, bridgeAvailable)` 决定。

要动：`EditorGroupWatermark.render` 里 Terminal 动作（`getCategoryActions` 现在写死本地 id）。渲染前用与点击相同的解析得到 id，再 `lookupKeybinding`。点击执行这个 id，去掉 `action.id === previewTerminalLocalCommandId` 时改走另一条命令的分支。`IUniverseAgentConnection.onDidChangeConnection` 时重新 render，并在当时再查 `IUniverseAgentPty.isBridgeAvailable()`（桥只有这个 Promise，没有变更事件）。空态分支在 return 前补上 `keybindingService.onDidUpdateKeybindings` 时重绘；这条订阅今天只挂在普通水印快捷键路径上。

不改：`previewTerminalEmptyStateCommand` 的选择条件，`previewTerminalLocalCommandId` / `previewUniverseAgentPtyEditorCommandId` 的定义，Code / Web 空态动作，`filterEntries`。

验证：现有 `Editor Group Watermark` / `renders category empty state tailored to active category` 只查标题和图标。在该套件新增断言：`connected && bridgeAvailable` 时，键位查询 id 与 `executeCommand` 的 id 都是 `previewUniverseAgentPtyEditorCommandId`；否则两者都是 `previewTerminalLocalCommandId`。`scripts/test.sh --grep "Editor Group Watermark"`。

## r04-4 并排最小尺寸随方向

问题类：`SideBySideEditor` 的 `minimumWidth` / `minimumHeight` / `maximumWidth` / `maximumHeight` 始终两侧相加；`orientation` 在左右（`Orientation.HORIZONTAL`）与上下（`Orientation.VERTICAL`）之间切换，约束公式不跟着变。

不变量：左右时宽度相加，高度的最小值取两侧较大者，高度的最大值取两侧较小者。上下时高度相加，宽度的最小值取较大者，宽度的最大值取较小者。发现稿写的「交叉轴取 max」只适用于最小值；最大值的交叉轴取较小者，否则一侧的上限会被加宽。

要动：`SideBySideEditor` 的上述四个 getter，按 `this.orientation` 分支。`onConfigurationUpdated` 改完 `orientation` 并 `recreateSplitview` 之后，让 `onDidChangeSizeConstraints` 再通知一次。现有 `_onDidChangeSizeConstraints` 只转发两侧 pane 的约束事件，切换 `workbench.editor.splitInGroupLayout` 不会发，外层组会继续用旧的最小尺寸。

不改：`createSplitView` 里两侧 `minimumSize`（仍是 `DEFAULT_EDITOR_MIN_DIMENSIONS`，分割条内部下限），`layout` / `layoutPane` 的尺寸分配，设置项取值与 `Orientation` 的对应关系。

验证：`sideBySideEditorInput.test.ts` 只测 input，没有尺寸约束测试。新增断言：两侧最小尺寸为 `(w1,h1)`、`(w2,h2)` 时，HORIZONTAL 的 `minimumWidth` 为 `w1+w2`、`minimumHeight` 为 `max(h1,h2)`；VERTICAL 相反。maximum 同理，交叉轴为 `min`。`scripts/test.sh` 加对应 `--grep`。
