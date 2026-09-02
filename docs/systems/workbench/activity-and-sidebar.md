---
title: "ActivityBar 与 Sidebar：容器绑定与显隐"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-02
summary: "ACTIVITYBAR_PART 与 SIDEBAR_PART 的从属与 grid 关系、ViewContainer 如何变成图标、显隐 API 与 activityBar.location；对照 Desktop Navigator；§5.1 Navigator 段数据来源（N1–N4）"
---

# ActivityBar 与 Sidebar

> 导航：[系统索引](INDEX.md) · 网格与显隐总表：[parts-and-grid](parts-and-grid.md)。  
> Desktop 对照（只读合同，勿在本页发明）：[desktop-shell-mapping](../../reference/code-oss-b2/desktop-shell-mapping.md)。  
> 实现：`activitybarPart.ts`、`sidebarPart.ts`、`paneCompositeBar.ts`、`layout.ts`；位置枚举 `ViewContainerLocation`（`views.ts`）。

本页只写 **默认 Code 窗口**。Agents Window **省略** Activity（见壳映射 §1）。

## 1. 两个 Part，一层从属

| 枚举 | 字符串 id | 职责 |
|------|-----------|------|
| `Parts.ACTIVITYBAR_PART` | `workbench.parts.activitybar` | 竖向图标 rail；切换 Sidebar 上的 pane composite |
| `Parts.SIDEBAR_PART` | `workbench.parts.sidebar` | Primary Side Bar：承载 `ViewContainerLocation.Sidebar` 的容器 |

`SidebarPart` **构造并持有** `ActivitybarPart`（`createInstance(ActivitybarPart, this.location, this)`），把自身当作 `IPaneCompositePart` 传进去。grid 上二者仍是 middleSection 的 **兄弟叶**（Activity | Sidebar | editor 枝），不是嵌套。Activity 在 middle，上接 TitleBar、下接 StatusBar——几何上已接近 ADR-052「通高」。

`ViewContainerLocation` 只有 `Sidebar` / `Panel` / `AuxiliaryBar`。**Activity 不是容器宿主**：它只画已注册到 Sidebar（以及 AuxiliaryBar 的顶栏形态）的容器图标。

默认宽度：rail 固定 `ActivitybarPart.ACTIVITYBAR_WIDTH = 48`（compact 36）；Sidebar `minimumWidth = 170`，可 snap。

## 2. 容器如何变成 Activity 图标

`IViewDescriptorService` / `ViewsRegistry` 把 `ViewContainer` 登记到某个 `ViewContainerLocation`。`PaneCompositeBar` 在构造时 `onDidRegisterViewContainers(this.getViewContainers())`，为每个容器建 `ViewContainerActivityAction`（图标、pin、badge）。

点击路径（`paneCompositeBar.ts` → `ViewContainerActivityAction.run`）：

1. 打开：`paneCompositePart.openPaneComposite(id)` → Sidebar 切到该 viewlet。
2. 若当前已是该 viewlet 且 Sidebar 可见，且 rail 是竖条（`part === ACTIVITYBAR_PART`）：读 `workbench.activityBar.iconClickBehavior`。
   - `toggle`（默认）：`setPartHidden(true, SIDEBAR_PART)`，再点同一图标收起。
   - `focus`：只聚焦，不藏。
3. 该行为 **仅 default 竖 rail 生效**；`top` / `bottom` 时 setting 被忽略。

Pin / placeholder / 工作区可见性写在 profile storage：`workbench.activity.pinnedViewlets2`、`placeholderViewlets`、`viewletsWorkspaceState`（`ActivitybarPart` 静态 key）。竖 rail `orientation: VERTICAL`、`icon: true`；`top`/`bottom` 时改由 `SidebarPart.createCompositeBar()` 画 **水平** compact 条。

竖 rail 底部另有 `GlobalCompositeBar`（`showGlobalActivities: true`）：**Accounts**（`ACCOUNTS_ACTIVITY_ID`）+ **Manage** 齿轮。这不是产品四钮。

## 3. `workbench.activityBar.location`

`LayoutSettings.ACTIVITY_BAR_LOCATION`，枚举 `ActivityBarPosition`：`default` | `top` | `bottom` | `hidden`（贡献点 `workbench.contribution.ts`）。

| 值 | 竖 rail（`ACTIVITYBAR_PART`） | Sidebar 顶/底 composite bar |
|----|------------------------------|------------------------------|
| `default` | 显示，贴 Primary Side Bar 一侧 | 不画（`shouldShowCompositeBar` 为假） |
| `top` / `bottom` | **藏**（见下） | 画在 Sidebar 顶或底；AuxiliaryBar 同步 |
| `hidden` | 藏 | 不画 |

`LayoutStateModel.isActivityBarHidden()`：`location !== default` 即视为竖 rail hidden（`top`/`bottom` 也把 `ACTIVITYBAR_PART` 从 grid 拿掉）。改 setting 会 `setRuntimeValueAndFire(ACTIVITYBAR_HIDDEN, …)`。反向：`setActivityBarHidden(true)` 会把 setting 写成 `hidden`。

配套：

- `workbench.activityBar.autoHide`：仅 `top`/`bottom`；可见容器 ≤ 1 时不画水平条（`VisibleViewContainersTracker`）。
- `workbench.activityBar.compact`：仅 `default`，缩图标与宽度。
- 命令：`workbench.action.activityBarLocation.{default,top,bottom,hide}`；`ToggleActivityBarVisibilityActionId` 在 `hidden` 与 **上次非 hidden 位置** 间切换（`SidebarPart.rememberActivityBarVisiblePosition`）。

`SidebarPart.onDidChangeActivityBarLocation`：先 `activityBarPart.hide()`（拆掉 composite bar DOM），再 `updateCompositeBar()`；`shouldShowActivityBar()` 为真时 `activityBarPart.show()`。`show`/`hide` 管的是 **内容创建**，grid 显隐仍走 `Layout`。

## 4. 显隐 API

对外入口：`IWorkbenchLayoutService.setPartHidden(hidden, part)`（`layout.ts`）。

| Part | 私有实现 | 行为 |
|------|----------|------|
| `SIDEBAR_PART` | `setSideBarHidden` | 写 `SIDEBAR_HIDDEN`、CSS `SIDEBAR_HIDDEN`、`workbenchGrid.setViewVisible`。藏：`hideActivePaneComposite(Sidebar)`。显：打开 last/default viewlet。可独立于 Activity。 |
| `ACTIVITYBAR_PART` | `setActivityBarHidden` | 写 `ACTIVITYBAR_HIDDEN`、CSS `noactivitybar`、grid 显隐。可独立藏。 |

产品动作：`ToggleSidebarVisibilityAction`（`workbench.action.toggleSidebarVisibility`，默认 Ctrl/Cmd+B）对 Sidebar 做 toggle。`workbench.action.focusActivityBar` → `focusPart(ACTIVITYBAR_PART)` → `SidebarPart.focusActivityBar()`：若 setting 为 `hidden` 先恢复上次位置；水平条则 `focusCompositeBar()`，否则保证 part 可见并 `activityBarPart.show(true)`。

Sidebar 显隐 **不** 自动藏 Activity；点已激活图标收起的是 Sidebar，rail 仍在。

## 5. Desktop Navigator 对照（不发明合同）

壳映射 §2–§3 的既有投影：

| Desktop | 本仓今天 |
|---------|----------|
| Activity rail | `ACTIVITYBAR_PART`（左边图标 tab，不搬 IDEA 竖排字） |
| Navigator body | `SIDEBAR_PART` |
| `toggleRegion('navigatorBody')` | **近** `setPartHidden(…, SIDEBAR_PART)` + 记宽；**没有** 单一 persist 宽的 `toggleRegion` |

**默认 Activity 没有四钮 chrome。** 竖 rail 只有 ViewContainer 图标 + 账户/管理齿轮。Nav / Conv / Prev / Src 是 Desktop 产品壳；S1 目标是「保留 rail，底加四钮」，不是把 Accounts/Manage 改名为四钮。Agents Window 省略整条 Activity，不能当成品壳。

相关不变量仍以 [desktop-shell-mapping](../../reference/code-oss-b2/desktop-shell-mapping.md) 为准：`INV-052-NO-DUAL-HIDE` 对象是 Conversation ∨ Workbench，与本仓 Editor ∨ Panel 不是同一条。

### 5.1 Navigator 段数据来源（N1–N4 @ HEAD）

与 [navigator-tabs-access](../../reference/code-oss-b2/navigator-tabs-access.md) · [navigator-engine-segments](../../../dev/plans/navigator-engine-segments.md) 对齐。无引擎时 Projects 仅本地文件夹组，Agents / Team 诚实空；**不**用 stub 冒充 UA 数据。

| Activity 段 | 无引擎 | 有引擎（已接通 PRD-008） |
|-------------|--------|--------------------------|
| Projects | 本地 folders + Recent（`openWindow`） | `WorkbenchObjectTree`：引擎根 → connection `workDir` → `IConversationRosterService.getSessions()`（同 Sessions roster）；+ 本地文件夹组 |
| Agents · Hierarchy | 空态 | 当前会话 lease → `snapshot.liveAgentTree`（M6-A2 host `AgentService.Tree` → `agentTreeBound`） |
| Agents · Activity | 空态（不读 stub tool） | 同一 lease → `timeline[] ∪ overlay.blocks[]` 中 tool 项 |
| Team | 空态 | 独立 lease → 同树发现 manager → `IUniverseAgentConnection.team.*` unary；`onDidChangeTeamRuntime` 刷新 |
| Inspect（Panel） | 空 target | `IAgentInspectService` 四模板；v1 单叶 |

## 6. 相关文档

- [parts-and-grid](parts-and-grid.md) · [Workbench 概览](overview.md) · [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)
- [navigator-tabs-access](../../reference/code-oss-b2/navigator-tabs-access.md) — 各 tab 子页与 N1–N4 数据源
- `src/vs/workbench/browser/parts/{activitybar,sidebar,globalCompositeBar.ts}` · `common/views.ts`
