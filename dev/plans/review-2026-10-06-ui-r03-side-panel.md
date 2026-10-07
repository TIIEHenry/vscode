---
title: "审查 r03：side-panel"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "面板标签切换首次空点；辅助栏关闭钮按活动栏位置消失；左面板少减 1px；搬视图不激活目标。"
---

# 审查 r03：side-panel

范围：`sidebar` / `auxiliarybar` / `panel` 三目录活码。已跳过 [review-2026-10-06.md](review-2026-10-06.md) 索引及 r01–r16（尤其 r11 workbench-shell）中已报项。

## r03-1 中

- 症状：面板标题栏右键「Show Labels / Show Icons」在默认配置下文案反了，第一次点击无可见变化。
- 位置：`src/vs/workbench/browser/parts/panel/panelPart.ts` 第 180–184 行
- 引用：

```180:184:src/vs/workbench/browser/parts/panel/panelPart.ts
		const panelShowLabels = this.configurationService.getValue<boolean | undefined>('workbench.panel.showLabels');
		const toggleShowLabelsAction = toAction({
			id: 'workbench.action.panel.toggleShowLabels',
			label: panelShowLabels ? localize('showIcons', "Show Icons") : localize('showLabels', "Show Labels"),
			run: () => this.configurationService.updateValue('workbench.panel.showLabels', !panelShowLabels)
```

- 为什么是问题：同文件第 142 行用 `=== false` 才切图标，`undefined` 仍显示文字标签。菜单却把 falsy 的 `undefined` 当成「未显示标签」，文案写成「Show Labels」，`!undefined` 写成 `true`，界面仍是标签——第一次点击等于空操作。辅助栏同场景用 `!== false` 归一化后再决定文案（`auxiliaryBarPart.ts` 第 167、249–251 行），面板没有。
- 方向：与辅助栏一致，先把「当前是否显示标签」归一成布尔再决定文案与取反。

## r03-2 中

- 症状：活动栏不在默认侧边位置时，次侧栏标题仍有最大化，却点不到关闭（隐藏）按钮。
- 位置：`src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts` 第 71–80 行
- 引用：

```71:80:src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarActions.ts
MenuRegistry.appendMenuItem(MenuId.AuxiliaryBarTitle, {
	command: {
		id: ToggleAuxiliaryBarAction.ID,
		title: localize('closeSecondarySideBar', 'Hide Secondary Side Bar'),
		icon: closeIcon
	},
	group: 'navigation',
	order: 2,
	when: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.DEFAULT)
});
```

- 为什么是问题：`when` 把关闭钮锁死在 `ActivityBarPosition.DEFAULT`。同文件第 232–236 行的最大化入口挂在同一 `MenuId.AuxiliaryBarTitle` 且无此限制。活动栏在 top / bottom / hidden 时，标题区仍可最大化，关闭只能靠快捷键或别处菜单。面板关闭钮（`panelActions.ts` 第 72–80 行）无同类限制。
- 方向：关闭入口与最大化同条件挂到标题，或至少在 top/bottom/hidden 时仍提供可点的隐藏控件。

## r03-3 低

- 症状：面板贴左侧时，内容区比分配宽度多用 1px，边缘可能被裁切或出现细缝错位。
- 位置：`src/vs/workbench/browser/parts/panel/panelPart.ts` 第 196–208 行；边框见 `media/panelpart.css` 第 29–45 行
- 引用：

```196:208:src/vs/workbench/browser/parts/panel/panelPart.ts
	override layout(width: number, height: number, top: number, left: number): void {
		let dimensions: Dimension;
		switch (this.layoutService.getPanelPosition()) {
			case Position.RIGHT:
				dimensions = new Dimension(width - 1, height); // Take into account the 1px border when layouting
				break;
			case Position.TOP:
				dimensions = new Dimension(width, height - 1); // Take into account the 1px border when layouting
				break;
			default:
				dimensions = new Dimension(width, height);
				break;
		}
```

```38:45:src/vs/workbench/browser/parts/panel/media/panelpart.css
.monaco-workbench .part.panel.left {
	border-right-width: 1px;
	border-right-style: solid;
}

.monaco-workbench.nomaineditorarea .part.panel.left {
	border-right-width: 0; /* no border when main editor area is hiden */
}
```

- 为什么是问题：RIGHT / TOP 为部件自身 1px 边框主动减尺寸；LEFT 在 CSS 上同样有 `border-right` 1px，却走 `default` 用满宽。BOTTOM 边框画在 title 上（`panelpart.css` 第 11–14 行），不减高度合理；LEFT 与 RIGHT 不对称。
- 方向：`Position.LEFT` 与 RIGHT 一样传入 `width - 1`（无主编辑区、边框为 0 时除外，若需与 CSS 同步再分支）。

## r03-4 中

- 症状：「把面板视图移到次侧栏 / 把次侧栏视图移到面板」时，若目标侧已有视图容器，搬过去后仍停在目标原来的活动页，刚在看的那组视图不会被激活，像没搬走。
- 位置：`src/vs/workbench/browser/parts/panel/panelActions.ts` 第 329–340 行
- 引用：

```329:340:src/vs/workbench/browser/parts/panel/panelActions.ts
		const srcContainers = viewDescriptorService.getViewContainersByLocation(this.source);
		const destContainers = viewDescriptorService.getViewContainersByLocation(this.destination);

		if (srcContainers.length) {
			const activeViewContainer = viewsService.getVisibleViewContainer(this.source);

			srcContainers.forEach(viewContainer => viewDescriptorService.moveViewContainerToLocation(viewContainer, this.destination, undefined, this.desc.id));
			layoutService.setPartHidden(false, this.destination === ViewContainerLocation.Panel ? Parts.PANEL_PART : Parts.AUXILIARYBAR_PART);

			if (activeViewContainer && destContainers.length === 0) {
				viewsService.openViewContainer(activeViewContainer.id, true);
			}
		}
```

- 为什么是问题：`destContainers` 在搬迁前取样；只有目标原先为空才 `openViewContainer`。目标已有容器时，源侧活动容器被挪走但不打开，目标继续显示旧活动页。用户所见与「我刚在看的那组视图」不一致。
- 方向：搬迁后始终打开搬迁前源侧的活动容器（或至少在目标侧选中它）。
