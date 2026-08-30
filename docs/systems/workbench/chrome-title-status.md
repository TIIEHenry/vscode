---
title: "Titlebar / Statusbar：窗口 chrome 与条目 API"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "默认窗口 TITLEBAR_PART / STATUSBAR_PART 的宿主内容与 IStatusbarService 条目面；与 Desktop AppTabBar / StatusBar 只做松映射，chrome 内部不是 ADR-052 合同"
---

# Titlebar / Statusbar：窗口 chrome 与条目 API

> 导航：[系统索引](INDEX.md)。Parts 拓扑：[parts-and-grid](parts-and-grid.md)。B2 对照：[壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)。  
> 实现：`src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`（`BrowserTitlebarPart`、`CommandCenterControl`）· `src/vs/workbench/browser/parts/statusbar/statusbarPart.ts` / `statusbarItem.ts` · `src/vs/workbench/services/statusbar/browser/statusbar.ts`（`IStatusbarService`）。

本页只写 **默认 Code 窗口** 的顶栏 / 底栏 chrome。Agents Window 的装配差异（省略标准 Status Bar 等）见 [sessions LAYOUT](../../../src/vs/sessions/LAYOUT.md)，此处不抄拓扑。

## 1. 两套窗口里的 chrome

| | 默认 Code 窗口 | Agents Window |
|--|----------------|---------------|
| `TITLEBAR_PART` | 有：菜单、窗口标题或 Command Center、layout control | 有，但职责是窗口导航与窗口级动作（见 LAYOUT） |
| `STATUSBAR_PART` | 有：`IStatusbarService` 条目槽 | **省略** |
| Desktop `AppTabBar` / `SessionBar` | 本仓没有对等产品条 | 不定 VS Code 子布局 |

S1 手术对象是默认窗口。Agents Window 是样例宿主，**禁止**把其省略底栏或自研标题条当成成品壳。

## 2. `TITLEBAR_PART` 宿主什么

`BrowserTitlebarPart.createContentArea` 把自定义标题条分成 `titlebar-left` / `titlebar-center` / `titlebar-right`。功能代码 **不 new 标题条**；它们往已有槽位注册 menu / toolbar。

左（`titlebar-left`）：

- **App icon**（Windows / Linux 且非 native titlebar）
- **自定义菜单栏** `CustomMenubarControl`：非 auxiliary、非 native menu、非 compact 时 `installMenubar()`。macOS native 通常走系统菜单。显隐跟 `window.menuBarVisibility`。

中（`titlebar-center`）：

- **窗口标题文本**（`WindowTitle`）——当 `window.commandCenter` 关
- **Command Center**（`CommandCenterControl`）——当 `LayoutSettings.COMMAND_CENTER`（`window.commandCenter`）开且非 compact。见 §3。

右（`titlebar-right`，自定义 titlebar 时）：

- `MenuId.TitleBarAdjacentCenter`、`MenuId.TitleBarUpdate` 两个 toolbar
- **主 action toolbar**：按顺序拼
  - `MenuId.TitleBar` 的 leading 组（`TitleBarLeadingActionsGroup`）
  - 可选 **editor actions**（`editorActionsLocation === titlebar`，或 tabs 关时的 default）
  - **Layout control**：`MenuId.LayoutControlMenu` 的 `navigation` 组，开关是 `LayoutSettings.LAYOUT_ACTIONS`（`workbench.layoutControl.enabled`）
  - `MenuId.TitleBar` 的其余全局动作（注释写明：通知铃在 layout control 右侧）
  - Activity 账户 / 管理（仅当 Activity 在 TOP/BOTTOM）
- **窗口控件**（关 / 最大化 / 关闭），位置随平台与 WCO

`ITitleService`（`BrowserTitleService`）是多窗口 `MultiWindowParts<BrowserTitlebarPart>`：改标题属性、注册 `windowTitle` 变量、`workbench.action.focusTitleBar`。标题条 **不是** 会话条，也不是 App tab 宿主。

## 3. Command Center

`CommandCenterControl` 挂在中心 `div.window-title` 内，根节点 class `command-center`。它是 `MenuId.CommandCenter` 的 `MenuWorkbenchToolBar`：

- 子菜单 `MenuId.CommandCenterCenter` 渲染为搜索 / Quick Open 胶囊（`workbench.action.quickOpenWithModes`），并容纳 debug toolbar 等中心贡献
- Quick Input 对齐到顶时会把中心控件藏起来，避免叠层
- 开关：`window.commandCenter`；改配置走 `recreateTitle()`

contrib 可往 `MenuId.CommandCenter` / `CommandCenterCenter` 插项（Share、Agent Status badge、debug toolbar）。这些是 **标题条内部贡献点**，不是产品壳区域。

## 4. `STATUSBAR_PART` 与 `IStatusbarService`

`StatusbarPart` 是 grid 底叶，固定高度约 22px（floating panels 实验会加一点底 padding）。条目不改 Layout；contrib / 扩展调用 `IStatusbarService.addEntry`。

`IStatusbarService` 继承 `IStatusbarEntryContainer`，主面：

| API | 作用 |
|-----|------|
| `addEntry(entry, id, alignment, priority?)` | 声明一条目；返回 `IStatusbarEntryAccessor`（`update` / `dispose`） |
| `alignment` | `StatusbarAlignment.LEFT` / `RIGHT` |
| `priority` | 同槽内从高到低；也可 `IStatusbarEntryLocation` 相对另一 id（`compact` 会贴邻） |
| `isEntryVisible` / `updateEntryVisibility` | 用户可经设置藏条目 |
| `overrideEntry` / `overrideStyle` | 临时改外观 |
| `focus` / `focusNextEntry` / `focusPreviousEntry` | 键盘在条目间走 |
| `getPart` / `createAuxiliaryStatusbarPart` / `createScoped` | 多窗口：主 part + auxiliary 窗各一条 statusbar |

`IStatusbarEntry` 是声明式描述：`name`、`text`（可 `$(icon)`）、`ariaLabel`、`tooltip`、`command`、`kind`（`standard` \| `warning` \| `error` \| `prominent` \| `remote` \| `offline`）、`showProgress`、`showBeak`、`showInAllWindows`、`extensionId`。渲染落在 `StatusbarEntryItem`：label + 可选 beak；点击 / 触控 / Space·Enter 执行 `command`（或 `ShowTooltipCommand`）。

`StatusbarService` 是 `MultiWindowParts<StatusbarPart>`。`showInAllWindows` 的条目会自动跟到新 auxiliary statusbar。

## 5. 与 Desktop AppTabBar / StatusBar：只松映射

壳映射把 Desktop 底栏 **StatusBar** 投影到本仓 `STATUSBAR_PART`（合法同构、S1 **保留**）。把 Desktop **AppTabBar / SessionBar** 松对照到 Titlebar / Chat 标题条，并标 **ADR-052 `NO-SUBLAYOUT`**：产品壳自研 chrome，**不定** VS Code 子布局。

因此：

- `CustomMenubarControl`、`CommandCenterControl`、`LayoutControlMenu`、`IStatusbarService` 条目槽，都是 **Code OSS chrome 内部**。它们解释「默认窗口今天长什么样」，**不是** ADR-052 四钮或 AppTabBar 合同。
- 不要把 Command Center 当 SessionBar，不要把 layout control 当四钮，不要把 status item 当产品底栏契约。
- 改壳时：保留 `STATUSBAR_PART` 作为底栏几何；App tab / session chrome 另做，不往 `TITLEBAR_PART` 里塞产品子布局。

## 6. 通知 toast 与 status

通知 **不是** grid Part。`Workbench.createNotificationsHandlers` 在 `mainContainer` 上装配：`NotificationService.model` 为源；`NotificationsToasts` 画瞬时 toast（最多 3 条）；`NotificationsCenter` 画面板；`NotificationsAlerts` 管屏幕阅读。`NotificationsStatus` 是唯一接到 `IStatusbarService` 的桥：未读 / 进行中时在底栏挂 `status.notifications` 铃（`SHOW_NOTIFICATIONS_CENTER`），以及 `INotificationService` 的短 status message（左对齐、`status.message`）。通知位置为 `TOP_RIGHT` 时铃改走标题条 menu，底栏条目卸掉。Toast / Center 与 status 条目是同一 model 的不同投影，不要把 toast 当成 StatusBar 合同。

## 7. 相关文档

- [Parts、Grid、显隐](parts-and-grid.md) · [Workbench 概览](overview.md)
- [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)（§2 AppTabBar 行、§5 StatusBar 同构）
- [sessions LAYOUT](../../../src/vs/sessions/LAYOUT.md)（Agents Window 省略标准 Status Bar）
