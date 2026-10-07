---
title: "审查 r08：sessions-browser"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "窄桌面侧栏抽屉盖住导航关不掉；可见状态双轨；grid 仍占宽挤主列；layout 宽度与 320px CSS 不一致。"
---

# 审查 r08：sessions-browser

范围：`src/vs/sessions/browser`、`src/vs/sessions/contrib` 用户可见布局/交互。已对照 [review-2026-10-06.md](review-2026-10-06.md) 与 r03 sessions；下列不在既有发现内。

## r08-1 中

- 症状：窄桌面（compact-desktop）点汉堡打开侧栏抽屉后，抽屉盖住顶部导航条，汉堡按钮点不到，也无点空白关闭，抽屉关不掉（只能拉宽窗口退出 compact）。
- 位置：`src/vs/sessions/browser/parts/compactDesktop/compactDesktopShell.css` 第 48–56 行；关闭入口在 `workbench.ts` 第 1020–1026、1045–1057 行。
- 引用：

```48:56:src/vs/sessions/browser/parts/compactDesktop/compactDesktopShell.css
.agent-sessions-workbench.compact-desktop .part.sidebar.compact-desktop-overlay-sidebar {
	position: fixed;
	z-index: 40;
	top: 0;
	left: 0;
	bottom: 0;
	width: min(100%, 320px);
	box-shadow: 0 0 12px var(--vscode-widget-shadow);
}
```

```1020:1026:src/vs/sessions/browser/workbench.ts
	private toggleCompactDesktopNavDrawer(): void {
		if (this._compactDesktopNavDrawerOpen) {
			this.closeCompactDesktopNavDrawer();
		} else {
			this.openCompactDesktopNavDrawer();
		}
	}
```

- 为什么是问题：导航宿主（`compact-desktop-nav-host`，同文件第 7–16 行）无更高 z-index，且与侧栏同属主容器子树；侧栏 `position: fixed; top: 0; z-index: 40` 从视口顶盖住导航。关闭只靠再点汉堡（`toggleCompactDesktopNavDrawer`），没有 backdrop / Escape。对比 phone：顶栏在 grid 外且抽屉只填 grid 区，汉堡仍可点。
- 方向：抽屉从导航条下方起（`top` 对齐 navHeight），或给 nav-host 更高 z-index；并支持点遮罩/Escape 关闭。

## r08-2 中

- 症状：汉堡打开抽屉后按 Ctrl+B（Toggle Side Bar），朗读说侧栏已隐藏，抽屉仍开着；反过来用快捷键「打开」时侧栏进 grid 却不成 overlay，窄屏下主区被挤乱。
- 位置：`workbench.ts` 第 2407–2411、2535–2548、1028–1042 行；`layoutActions.ts` 第 61–71 行。
- 引用：

```2407:2411:src/vs/sessions/browser/workbench.ts
			case Parts.SIDEBAR_PART:
				if (this.layoutPolicy.isCompactDesktop.get()) {
					return this._compactDesktopNavDrawerOpen;
				}
				return this.partVisibility.sidebar;
```

```2535:2548:src/vs/sessions/browser/workbench.ts
	private setSideBarHidden(hidden: boolean): void {
		if (this.partVisibility.sidebar === !hidden) {
			return;
		}
		// ...
		this.partVisibility.sidebar = !hidden;
		this.workbenchGrid.setViewVisible(
			this.sideBarPartView,
			!hidden,
		);
```

```61:71:src/vs/sessions/browser/layoutActions.ts
	run(accessor: ServicesAccessor): void {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const isCurrentlyVisible = layoutService.isVisible(Parts.SIDEBAR_PART);
		layoutService.setPartHidden(isCurrentlyVisible, Parts.SIDEBAR_PART);
		const alertMessage = isCurrentlyVisible
			? localize('sidebarHidden', "Primary Side Bar hidden")
			: localize('sidebarVisible', "Primary Side Bar shown");
		alert(alertMessage);
	}
```

- 为什么是问题：汉堡路径只翻 `_compactDesktopNavDrawerOpen`（第 1032 行），不改 `partVisibility.sidebar`。`isVisible` 读抽屉旗，`setSideBarHidden` 早退条件读 `partVisibility`。抽屉开着时 `isVisible===true` 但 `partVisibility.sidebar===false`，`setSideBarHidden(true)` 立刻 return，UI 不变，action 仍 alert「已隐藏」。快捷键打开则写 `partVisibility`、进 grid，却不置抽屉旗、不跑 `layoutCompactDesktopSidebar`，没有 `compact-desktop-overlay-sidebar`。
- 方向：compact 下 `setPartHidden(SIDEBAR)` 走 open/closeCompactDesktopNavDrawer；两处状态合成一个 SSOT。

## r08-3 中

- 症状：打开窄桌面抽屉时，主会话列变窄被挤，同时左侧还有一层 fixed 抽屉盖住内容。
- 位置：`workbench.ts` 第 1032–1034、2056 行。
- 引用：

```1032:1034:src/vs/sessions/browser/workbench.ts
		this._compactDesktopNavDrawerOpen = true;
		if (this.workbenchGrid) {
			this.workbenchGrid.setViewVisible(this.sideBarPartView, true);
```

```2056:2056:src/vs/sessions/browser/workbench.ts
		this.workbenchGrid.setViewVisible(this.sideBarPartView, this._compactDesktopNavDrawerOpen);
```

- 为什么是问题：抽屉本意是 overlay（CSS fixed），但 grid 仍把 sidebar 标为可见并分配宽度。compact 壳没有像 phone 那样把 `.split-view-view:has(> .part)` 叠满同一格（见 `mobileChatShell.css`），会话列与侧栏并排分宽。视口本就 &lt; 600px，再扣侧栏最小宽后主列明显变窄，与「盖在上面」的视觉不一致。
- 方向：drawer 打开时 grid 侧栏占位为 0（或 absolute 叠满），只保留 overlay 几何。

## r08-4 低

- 症状：窄桌面抽屉视觉宽最多 320px，但内部列表/内容按整窗宽排版，内容可溢出抽屉右缘，点到抽屉外的「幽灵」命中区或裁切错乱。
- 位置：`workbench.ts` 第 2154–2158 行；`compactDesktopShell.css` 第 48–54 行。
- 引用：

```2154:2158:src/vs/sessions/browser/workbench.ts
		sidebarContainer.classList.add('compact-desktop-overlay-sidebar');
		const navHeight = this.compactDesktopNavHost?.element.offsetHeight ?? 40;
		const drawerWidth = this._mainContainerDimension.width;
		const drawerHeight = Math.max(0, this._mainContainerDimension.height - navHeight);
		sidebarPart.layout(drawerWidth, drawerHeight, navHeight, 0);
```

- 为什么是问题：`Part.layout` → `PartLayout` 会对 `.content` 写入传入的 width（`part.ts` 的 `size(contentArea, …)`）。CSS 把 `.part.sidebar` 限制为 `min(100%, 320px)`，且未像 phone 用 `width: 100% !important` 盖住 content 的 inline 宽。父级无 `overflow: hidden` 时，过宽 content 画出 320px 边界仍可接收指针。
- 方向：`layout` 传入 `Math.min(320, containerWidth)`，并为 overlay 侧栏加 `overflow: hidden`。
