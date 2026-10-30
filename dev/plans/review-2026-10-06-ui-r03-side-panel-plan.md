---
title: "方案 r03：side-panel"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 2，drop 1，weaken 1。次侧栏标题在活动栏非默认位置仍提供隐藏；经典布局左面板扣 1px 边框；搬视图后打开源侧原活动容器。"
---
# 方案 r03：side-panel

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 2，drop 1，weaken 1

## r03-1（drop）

不写改法。`workbench.panel.showLabels` 在 `src/vs/workbench/browser/workbench.contribution.ts` 第 592–596 行注册，类型 boolean，第 594 行 `default: true`。默认模型按该 `default` 写入（`src/vs/platform/configuration/common/configurations.ts` 第 69–76 行）。平台 `Configuration.getWorkspaceConsolidatedConfiguration`（`src/vs/platform/configuration/common/configurationModels.ts` 第 1022–1025 行）把这份默认配置并进 `getValue`。未改这项时读到的是 `true`。`src/vs/workbench/browser/parts/panel/panelPart.ts` 第 180–184 行文案走真值分支，写成 “Show Icons”，`run` 写入 `false`；第 114–117 行监听后 `updateCompositeBar(true)`，第 142 行 `=== false` 成立并切到图标。默认配置下第一次点击有可见变化。

## r03-2（hold）

- 问题类：活动栏不在 `default` 时，次侧栏标题仍有最大化，隐藏按钮被 `when` 拿掉。
- 不变量：`MenuId.AuxiliaryBarTitle` 在 `workbench.activityBar.location` 为 `default`、`top`、`bottom`、`hidden` 时都包含 `ToggleAuxiliaryBarAction.ID`（隐藏）和 `ToggleMaximizedAuxiliaryBar.ID`（最大化）。`default` 时隐藏按钮仍在，组 `navigation`、顺序 2、图标 `closeIcon` 不变。
- 要动的符号或文件：`auxiliaryBarActions.ts` 第 71–80 行挂到 `MenuId.AuxiliaryBarTitle` 的 `MenuRegistry.appendMenuItem`，删掉第 79 行的 `when`。`ActivityBarPosition` 与 `LayoutSettings` 只被这一处使用，从 import 去掉。`ContextKeyExpr` 仍被第 135 行使用，保留。
- 明确不改什么：保持 `ToggleMaximizedAuxiliaryBar` 第 232–236 行的菜单项不动。保持第 126–138 行 `MenuId.ViewContainerTitleContext` 的 `when` 不动。保持 `auxiliaryBarPart.ts` 第 259 行右键「Hide Secondary Side Bar」不动。保持 `ToggleAuxiliaryBarAction` 的命令 id、快捷键、命令面板入口不动。保持 `panelActions.ts` 第 72–80 行面板关闭钮不动。
- 怎样本地验证：没有覆盖该菜单项的测试。新增断言：导入 `auxiliaryBarActions.js` 后，`MenuRegistry.getMenuItems(MenuId.AuxiliaryBarTitle)` 里 `ToggleAuxiliaryBarAction.ID` 那条没有 `when`，`ToggleMaximizedAuxiliaryBar.ID` 仍在同一菜单且没有按活动栏位置过滤的 `when`。用 `scripts/test.sh --run` 跑承载该断言的文件。

## r03-3（weaken）

反证：`.part` 是 `border-box` 且 `overflow: hidden`（`part.css` 第 6–8 行），多出来的 1px 会被裁进部件，不是部件外的一条缝。`workbench.experimental.modernUI` 默认 `false`（`workbench.contribution.ts` 第 859–863 行）。关掉时走 `panelpart.css` 的单边框，左贴面板确实没扣这 1px。打开时 `isFloatingPanelsEnabled()` 为真，`floatingPanels.css` 第 76–78 行用 `border: 1px solid !important` 盖住四边，`AbstractPaneCompositePart.getFloatingInset`（`paneCompositePart.ts` 第 683–694 行）已经按两侧各 1px 再加外边距去缩内容。这条路径上左贴并不缺那 1px；若照发现稿对 `Position.LEFT` 无条件 `width - 1`，浮动开启时左贴会再窄 1px。主编辑区隐藏时容器带 `nomaineditorarea`（`layout.ts` 第 2131 行，条件是主窗口 `Parts.EDITOR_PART` 不可见），`panelpart.css` 第 43–45 行把左边框宽设为 0。降级后的改法只在经典单边框真正画出来时给左侧扣 1px。

- 问题类：现代 UI 关闭且主编辑区可见时，面板贴左仍按全宽布局，贴右已经为 1px 边框减过宽。
- 不变量：`PanelPart.layout` 在 `!isFloatingPanelsEnabled()` 且 `isVisible(Parts.EDITOR_PART, mainWindow)` 时，`Position.LEFT` 与 `Position.RIGHT` 都把宽度减 1 再交给 `super.layout`。浮动开启，或主编辑区不可见时，`Position.LEFT` 宽度不减。`Position.BOTTOM` 仍用传入的宽高（底边框画在标题上，`panelpart.css` 第 11–14 行）。
- 要动的符号或文件：`PanelPart.layout`（`panelPart.ts` 第 196–208 行）的 `switch`。为 `Position.LEFT` 增加分支：上述条件成立时 `new Dimension(width - 1, height)`，否则 `new Dimension(width, height)`。`Parts.EDITOR_PART` 的 `isVisible` 带上 `mainWindow`（`src/vs/base/browser/window.ts`）。
- 明确不改什么：保持 `Position.RIGHT` 的 `width - 1` 与 `Position.TOP` 的 `height - 1` 现有表达式不动，包括浮动开启或主编辑区隐藏时它们仍多减的 1px。保持 `panelpart.css`、`getFloatingInset`、`PartLayout` 的 `borderWidth` 选项不动。`PanelPart` 构造函数第 88 行不补 `borderWidth`。保持 `src/vs/sessions/browser/parts/panelPart.ts` 的 `layout` 不动。
- 怎样本地验证：没有覆盖 `PanelPart.layout` 的测试。新增断言：浮动关且主编辑区可见时，`Position.LEFT` 与 `Position.RIGHT` 传给 `super.layout` 的宽度都是分配宽度减 1，`Position.TOP` 高度减 1，`Position.BOTTOM` 宽高不变；浮动开，或主编辑区不可见时，`Position.LEFT` 宽度等于分配宽度。用 `scripts/test.sh --run` 跑承载该断言的文件。

## r03-4（hold）

- 问题类：目标侧已经有视图容器时，整组搬迁不打开搬迁前源侧正在看的那个容器。
- 不变量：`MoveViewsBetweenPanelsAction.run` 在源侧有容器时，先记下 `getVisibleViewContainer(this.source)`，再全部 `moveViewContainerToLocation`，再 `setPartHidden(false, …)`。只要记下的容器非空，随后调用 `openViewContainer(该 id, true)`，与目标侧搬迁前是否已有容器无关。源侧没有容器，或记下的容器为空时，不调用 `openViewContainer`。
- 要动的符号或文件：`MoveViewsBetweenPanelsAction.run`（`panelActions.ts` 第 329–340 行）。去掉 `destContainers.length === 0` 这一条件。`destContainers` 不再被读就可以删掉。`ViewsService.onDidChangeContainerLocation`（`viewsService.ts` 第 148–158 行）只在目标侧活动容器数变成 1 时打开刚搬走的那一个，目标侧已经有活动容器时不会打开源侧原来那个；本改动不依赖它。
- 明确不改什么：保持四个子类的源、目标位置和命令 id 不动（`MovePanelToSidePanelAction`、`MovePanelToSecondarySideBarAction`、`MoveSidePanelToPanelAction`、`MoveSecondarySideBarToPanelAction`）。保持 `forEach` 的搬迁顺序和 `this.desc.id` 不动。保持 `openViewContainer` 不 `await` 的调用形状不动。保持 `paneCompositeBar.ts` 第 213–214 行单容器搬迁已有的 `openViewContainer` 不动。保持 `onDidChangeContainerLocation` 的「恰好一个活动容器才打开」不动。不在 `run` 里为 Sessions 加分支。Sessions 窗口 `canMoveViews()` 为假（`viewDescriptorService.ts` 第 351–357 行），`moveViewContainerToLocation` 直接返回；`src/vs/sessions/browser/layoutActions.ts` 第 18 行导入 `panelActions.js` 时会注册这些命令。目标原先为空时，现有代码已经会在这次空操作之后 `openViewContainer`。去掉空目标条件后，Sessions 里目标已有容器时也会打开，容器仍留在原位置。编辑器窗口 `canMoveViews()` 为真，上面的不变量针对那条路径。
- 怎样本地验证：没有覆盖 `MoveViewsBetweenPanelsAction` 的测试。新增断言：目标在搬迁前已有容器且源侧 `getVisibleViewContainer` 返回某容器时，`setPartHidden(false, …)` 之后 `openViewContainer` 以该 id 和 `true` 被调用；目标原先为空时同样调用一次；源侧容器列表为空时既不 `moveViewContainerToLocation` 也不 `openViewContainer`；`getVisibleViewContainer` 返回 `null` 时不 `openViewContainer`。用 `scripts/test.sh --run` 跑承载该断言的文件。
