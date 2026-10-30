---
title: "方案 r08：sessions-browser"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "窄桌面抽屉让开导航、与 Ctrl+B 共用开关，打开时 grid 不再挤主列。"
---

# 方案 r08：sessions-browser
状态：草案。
覆盖需求：无（正文未引用需求编号）。


核查：hold 1（r08-3），weaken 2（r08-1、r08-2），drop 1（r08-4）。drop 只记原因，不写改法。

r08-1、r08-2、r08-3 改同一条开关：`setSideBarHidden` 在 compact 下转入抽屉开关；打开时 grid 侧栏槽宽为 0 且节点保持可见；抽屉盒从导航条下缘开始。三处一起改。

## 核查

### r08-4 drop

`layoutCompactDesktopSidebar` 第 2156–2158 行仍把 `_mainContainerDimension.width` 传给 `sidebarPart.layout`。同一次 `layout()` 里，`_applyCompactDesktopGridVisibility`（约第 1943–1944 行，其末尾第 2062 行会再调 `layoutCompactDesktopSidebar`）发生在 `_layoutGrid`（第 1956、1977 行）之前。grid 随后用槽宽再调用 `sidebarPart.layout`，后一次写入 `.content` 的 inline 宽。compact 视口 &lt; 600，`sessionsPart` / `customViewGridPart` 的 `minimumWidth` 都是 300，splitview 把侧栏槽收到 `available - 300` 或侧栏 `minimumWidth`（Electron 170 / web 270），结算宽低于 CSS 的 320。`.monaco-workbench .part`（`part.css` 第 6–8 行）已有 `overflow: hidden`，溢出内容裁在 part 盒内，不形成抽屉外命中。不改 `layoutCompactDesktopSidebar` 的宽度参数，也不为这条加 `overflow`。

## r08-1（weaken，中 → 低）

反证：`.part.sidebar.compact-desktop-overlay-sidebar` 仍是 `position: fixed; top: 0; z-index: 40`（`compactDesktopShell.css` 第 48–56 行）。`.compact-desktop-nav-host`（同文件第 7–16 行）无定位、无 z-index，汉堡在宿主里（`compactDesktopNavigationHost.ts` 把宿主 `insertBefore` 到 `mainContainer` 首位）。`Part.layout`（`part.ts` 第 202–205 行）只记下 top，不写元素的 `style.top`，因此第 2155–2158 行传入的 `navHeight` 不改变盒子位置。鼠标点不到汉堡，打开/关闭函数（`workbench.ts` 第 1020–1057 行）没有遮罩或 Escape。

「只能拉宽窗口才能关」不成立。`getPartVisibilityDefaults` 对 desktop（compact 仍是 desktop viewport class）给 `sidebar: true`（`layoutPolicy.ts` 第 179–182 行），进入 compact 只快照、不清 `partVisibility.sidebar`（`workbench.ts` 第 2009–2013 行）。抽屉开着且该字段为 true 时，Ctrl/Cmd+B 进入 `setSideBarHidden(true)` 不会在第 2536 行返回，会 `setViewVisible(false)`。`.split-view-view:not(.visible)` 为 `display: none`（`splitview.css` 第 40–41 行），fixed 后代一起不画。导航按钮仍在 Tab 序里。

### 问题类

窄桌面抽屉从视口顶盖住导航条，鼠标无法再点汉堡，也没有点空白或 Escape 关闭。

### 不变量

抽屉打开时，导航宿主整条可点，且位于抽屉之上。抽屉盒的顶边等于导航宿主高度。点抽屉外的主区域，或在没有更高层浮层（quick input、dialog）挡住时按 Escape，调用 `closeCompactDesktopNavDrawer`。Ctrl/Cmd+B 仍能关抽屉（与 r08-2 同一状态）。

### 要动的符号或文件

- `compactDesktopShell.css`：overlay 的 `top` 改为 `var(--compact-desktop-nav-height, 40px)`；`.compact-desktop-nav-host` 设 `position: relative` 且 z-index 高于 overlay 的 40。
- `layoutCompactDesktopSidebar`：用已经算出的 `navHeight` 写到 workbench 根的 `--compact-desktop-nav-height`。不要指望 `sidebarPart.layout` 的第三个参数去挪盒子。
- `openCompactDesktopNavDrawer` / `closeCompactDesktopNavDrawer`：打开时注册、关闭时释放。Escape 走 `closeCompactDesktopNavDrawer`。遮罩只盖 grid 区，不盖导航宿主；点击遮罩关闭。

### 明确不改

phone 顶栏、`layoutMobileSidebar`、`sidebarPart.css` 里 phone 抽屉规则、`mobileChatShell.css`。`ToggleSidebarVisibilityAction` 的文案和快捷键。

### 本地验证

新增 node 测试，用与 `src/vs/sessions/test/node/sessionsFocusRingScan.test.ts` 的 `readRepoFile` 相同方式读 `compactDesktopShell.css`（去掉注释后再断言）：overlay 规则的 `top` 使用 `--compact-desktop-nav-height`，不再是 `top: 0`；`.compact-desktop-nav-host` 的 z-index 大于 overlay 的 40。

在套件 `Sessions - Workbench`（`src/vs/sessions/test/browser/workbench.test.ts`）新增：调用 `layoutCompactDesktopSidebar` 后，根元素上 `--compact-desktop-nav-height` 等于导航宿主的 `offsetHeight`（没有宿主时为现有回退 40）。

```bash
scripts/test.sh --grep "compact desktop"
scripts/test.sh --grep "CompactDesktopNavigationHost"
```

既有 `CompactDesktopNavigationHost` 与 `compact desktop hides side-pane parts without treating host as phone` 保持通过。

## r08-2（weaken，中 → 低）

反证：`isVisible(SIDEBAR)` 在 compact 下仍只读 `_compactDesktopNavDrawerOpen`（第 2407–2411 行）。`setSideBarHidden` 的早退仍比较 `partVisibility.sidebar`（第 2535–2538 行），随后写入该字段和 grid（第 2542–2548 行）。`ToggleSidebarVisibilityAction.run`（`layoutActions.ts` 第 61–71 行）仍按调用前的 `isVisible` 朗读。两套状态都在。

发现稿写的「抽屉开着且 `partVisibility.sidebar === false`，第一次 Ctrl+B 早退、抽屉仍开」只在该字段已经是 false 时发生（例如宽桌面时侧栏已隐藏，再缩进 compact）。默认字段是 true。这时第一次 Ctrl+B 会把 grid 视图藏掉（抽屉跟着 `display: none` 消失），但 `_compactDesktopNavDrawerOpen` 仍为 true，于是 `isVisible` 仍为 true，下一次快捷键再次走隐藏并在早退处停下。反向的「快捷键打开、侧栏进 grid、没有 overlay」也只在 `partVisibility.sidebar === false` 且抽屉旗为 false 时发生；并且下一次 `layout()` 会走 `_applyCompactDesktopGridVisibility`，按抽屉旗再把槽藏起来。挤主列会维持到下一次 `layout()`，不会跨过 resize。

### 问题类

compact 下汉堡只翻抽屉旗，Ctrl/Cmd+B 只读写 `partVisibility.sidebar`，朗读与画面会分开。

### 不变量

compact 下侧栏是否打开只有 `_compactDesktopNavDrawerOpen`。`isVisible(SIDEBAR)`、`setPartHidden(SIDEBAR)`、grid 上侧栏节点是否 `.visible`、是否带 `compact-desktop-overlay-sidebar`，都跟这个旗。`partVisibility.sidebar` 在 compact 期间保持进入前的值，离开 compact 时仍由 `_compactDesktopTransitionSnapshot` 或 `_desktopPartVisibilityPendingRestore` 恢复。`isVisible` 与 `setPartHidden` 一致之后，现有 alert 文案不用改。

### 要动的符号或文件

`setSideBarHidden`：在第 2536 行早退之前，若 `layoutPolicy.isCompactDesktop.get()`，`hidden` 则 `closeCompactDesktopNavDrawer()`，否则 `openCompactDesktopNavDrawer()`，然后 return。phone 的 `isCompactDesktop` 为 false，仍走现有正文（含 `layoutMobileSidebar` 与 `_savePartVisibility`）。

`isVisible` 的 compact 分支保持读抽屉旗。

### 明确不改

`layoutActions.ts`。`getPartVisibilityDefaults`。`_savePartVisibility` 的 phone 短路和 `_partVisibilityPersistenceSuppression`。`toggleMobileSidebarDrawer` / `openMobileSidebarDrawer` / `closeMobileSidebarDrawer`。

### 本地验证

套件 `Sessions - Workbench` 新增三条，宿主 `layoutPolicy.isCompactDesktop.get()` 为 true，调用真实 `setSideBarHidden`：

- `partVisibility.sidebar === false` 且抽屉旗为 true 时，`setSideBarHidden(true)` 把旗清掉，并调用关闭路径（grid 侧栏 `setViewVisible` 的结果与 r08-3 的零槽约定一致），不在第 2536 行返回。
- `partVisibility.sidebar === true` 且抽屉旗为 false 时，`setSideBarHidden(false)` 把旗设为 true 并走打开路径。
- 上述两次调用之后 `partVisibility.sidebar` 与调用前相同。

既有 `skips persisting part visibility while compact-desktop transition suppression is active` 保持通过。

```bash
scripts/test.sh --grep "compact desktop"
```

## r08-3（hold，中）

`openCompactDesktopNavDrawer` 第 1032–1034 行和 `_applyCompactDesktopGridVisibility` 第 2056 行在抽屉打开时 `setViewVisible(sideBarPartView, true)`。compact 样式没有 phone 那种把 `.split-view-view:has(> .part)` 叠进同一格的规则（`mobileChatShell.css` 第 198–205 行）。侧栏 `minimumWidth` 为 `SESSIONS_LIST_MINIMUM_WIDTH`（`sidebarPart.ts` 第 74 行）。会话列 `minimumWidth` 为 300（`sessionsPart.ts` 第 44 行），`layout` 把这个数字交给内部 `_gridWidget.layout`（第 397–410 行）。抽屉打开后主列按「总宽减去侧栏槽」排，同时 `.part.sidebar` 又以 fixed 盖在上面。

### 问题类

打开窄桌面抽屉时，侧栏在 grid 里占一条水平槽，主会话列变窄，同时又有一层 fixed 抽屉盖在内容上。

### 不变量

抽屉打开时，会话 part 的 `layout` 宽度等于 compact grid 的内容宽（扣掉现有 gutter 和导航条高度之后的那一档），不扣侧栏 `minimumWidth`。侧栏 DOM 仍带 `.visible`：`.split-view-view:not(.visible)` 的 `display: none` 会把 fixed 的 `.part.sidebar` 一起藏掉，零槽不能靠 `setViewVisible(false)`。`SessionsSidebarPart.snap` 现为 true；槽宽为 0 时不得因此摘掉 `.visible`。

`layout()` 里 `_layoutGrid` 在 `layoutCompactDesktopSidebar` 之后执行。槽宽变成 0 后，grid 会再调用 `sidebarPart.layout(0, …)`，把抽屉内容量成 0。抽屉几何必须在这次 grid layout 之后再写一次。

### 要动的符号或文件

- `openCompactDesktopNavDrawer` / `closeCompactDesktopNavDrawer` / `_applyCompactDesktopGridVisibility`：打开时网格节点保持可见，槽的最小宽和最大宽为 0；关闭时恢复 `SESSIONS_LIST_MINIMUM_WIDTH` 与 `Number.POSITIVE_INFINITY`，并恢复原来的 `snap`。
- `SessionsSidebarPart`：上述最小/最大宽不要改成对所有布局生效的字段。由 workbench 在开关抽屉时切换（例如 `setOverlayGridSlotCollapsed`），切换后触发该 part 已有的 `onDidChange`，让 GridView 重算。
- `layout`：`_layoutGrid()` 返回后，若抽屉仍开，再调用 `layoutCompactDesktopSidebar()`。

### 明确不改

`SESSIONS_LIST_MINIMUM_WIDTH` 的数值。非 compact、以及 compact 但抽屉关闭时的侧栏最小宽。phone 的叠层 CSS。不把「给 sessions `.content` 写 `width: 100% !important`」当作本条的修法：内部 grid 用的是 `layout` 传入的数字。

### 本地验证

套件 `Sessions - Workbench` 新增：`isCompactDesktop` 且抽屉打开后，会话视图的 layout 宽等于 grid 内容宽；侧栏视图的 `minimumWidth` 为 0，且对应 `.split-view-view` 仍有 `visible`。抽屉关闭后 `minimumWidth` 回到 `SESSIONS_LIST_MINIMUM_WIDTH`。

```bash
scripts/test.sh --grep "compact desktop"
```
