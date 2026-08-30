---
title: "Workbench UI 框架：Parts、Grid、显隐"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "默认 Code 窗口的 Part 枚举、SerializableGrid 描述符、setPartHidden/setEditorHidden 约束；B2 S1 手术的代码锚点"
---

# Workbench UI 框架：Parts、Grid、显隐

> 导航：[系统索引](INDEX.md)。B2 对照：[code-oss-b2](../../reference/code-oss-b2/INDEX.md)。  
> 实现主文件：`src/vs/workbench/browser/layout.ts`（`Layout`）· `src/vs/workbench/services/layout/browser/layoutService.ts`（`Parts`、`IWorkbenchLayoutService`）· `src/vs/workbench/browser/part.ts`（`Part`）。  
> Grid 积木：`src/vs/base/browser/ui/grid/grid.ts`（`SerializableGrid`）。

本页只写 **默认 Code 窗口**（`WindowEnablement` 默认工作台）。Agents Window 另有一套 parts 装配，见 [sessions LAYOUT](../../../src/vs/sessions/LAYOUT.md) 与 [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)。

## 1. Part 是什么

每个 `Part` 是 grid 上的一个 **IView**：有 min/max 尺寸、`element`、可被 `workbenchGrid.setViewVisible` 显隐。功能代码 **不 new Part**；它们往已有 Part 里注册 view / editor / status item。

`Parts` 枚举（`layoutService.ts`）：

| 枚举 | 字符串 id | 默认窗口职责 |
|------|-----------|--------------|
| `TITLEBAR_PART` | `workbench.parts.titlebar` | 标题 / 菜单 / Command Center |
| `BANNER_PART` | `workbench.parts.banner` | 横幅 |
| `ACTIVITYBAR_PART` | `workbench.parts.activitybar` | 左（或右）图标 rail；切换 Sidebar 容器 |
| `SIDEBAR_PART` | `workbench.parts.sidebar` | 主侧栏 ViewContainer（资源管理器等） |
| `EDITOR_PART` | `workbench.parts.editor` | **中心锚点**：EditorGroup + tabs + `EditorInput` |
| `PANEL_PART` | `workbench.parts.panel` | 底（可左右）面板：终端、问题、输出 |
| `AUXILIARYBAR_PART` | `workbench.parts.auxiliarybar` | 对侧栏（Secondary Side Bar） |
| `STATUSBAR_PART` | `workbench.parts.statusbar` | 底栏 |
| `SESSIONS_PART` | `workbench.parts.sessions` | **Agents Window 才装配**；默认 Code 窗口 grid **不出现** |
| `CUSTOM_VIEW_GRID_PART` | `workbench.parts.customViewGrid` | Agents Window 全幅自定义视图 |

B2 要新增的 `ConversationPart` **今天不存在**。最接近的现成非 editor 中心面是 `SESSIONS_PART`，但只挂在 Sessions 窗口。

## 2. 默认 grid 拓扑（T1 的现状）

`Layout.createGridDescriptor()` 生成垂直根：

```text
VERTICAL
├── TITLEBAR
├── BANNER（常 hidden）
├── middleSection（水平串：Activity | Sidebar | editor+panel 枝 | AuxiliaryBar）
└── STATUSBAR
```

`arrangeMiddleSectionNodes` 在 **水平 Panel**（默认底栏）时：

- 中间一枝是 **纵向** `[ editorNodes, PANEL ]`（或 panel 在上）
- `editorNodes` 再水平切 Sidebar / Editor / AuxiliaryBar（视 panel alignment）
- ActivityBar 插在最左或最右（跟 `sideBar.location`）

**锚点事实：** 中间枝的「主面积」叶子是 `{ type: Parts.EDITOR_PART }`。没有第三种中心叶子。这就是 spike T1：「布局默认 editor 是 grid 锚点」。

`arrangeEditorNodes` 在只有 editor 时直接返回 editor 叶，`size = availableHeight`。Sidebar / Aux 是 editor 的兄弟，不是替代中心。

## 3. 几何 vs ADR-052「Activity 通高」

- Activity 在 **middleSection**，上接 TitleBar、下接 StatusBar → **rail 碰到 StatusBar**，与 ADR-052「通高到 StatusBar」同几何量级。
- 默认 **底 Panel 与 Editor 同枝**，不钻到 Activity 底下（Activity 是更外层水平邻居）。这与 ADR-052「Bottom Panel 不钻 Activity」一致。
- Activity **不是** 第四 root；它仍是 middle 的一个叶。
- Activity **默认没有**「底栏四钮」。四钮是 Desktop chrome，本仓只有 ViewContainer 图标 + 账户/管理齿轮（`activitybarPart` / `globalCompositeBar`）。

`workbench.activityBar.location` 可把 Activity 藏进 Sidebar 顶或关：改壳时这是 EH/`viewsContainers` 的冲突面，见 [eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md)。

## 4. 显隐 API（T2 / T3 相关）

`IWorkbenchLayoutService.setPartHidden(hidden, part)` → `Layout` 分发：

| Part | 私有实现 | 关键约束（读自 `layout.ts`） |
|------|----------|------------------------------|
| `EDITOR_PART` | `setEditorHidden` | 写入 `EDITOR_HIDDEN`；`workbenchGrid.setViewVisible(editorPartView, !hidden)`。**若隐藏 editor 且 panel 也不可见且 aux 未 maximize → 强制 `setPanelHidden(false)`**（「editor 与 panel 不能同时藏」） |
| `PANEL_PART` | `setPanelHidden` | 对称：藏 panel 时若 editor 已藏会顶开 editor（aux maximize 例外） |
| `SIDEBAR_PART` | `setSideBarHidden` | 可独立藏 |
| `AUXILIARYBAR_PART` | `setAuxiliaryBarHidden` | 可独立藏；maximize aux 会挤掉 editor |
| `ACTIVITYBAR_PART` | `setActivityBarHidden` | 可独立藏 |
| `STATUSBAR_PART` | 对应 hidden key | 可独立藏 |

**对 spike 的纠正：** 「vscode 传统上 editor part 不可藏」**不成立**。`EDITOR_HIDDEN` 与 `setEditorHidden` 是一等运行时状态；Zen Mode 只是常见「只留 editor」的产品预设，不是 API 禁藏。T2（整体隐藏 EditorPart）在 **默认窗口已经能做**，但必须接受 **「Preview 关且 Sources/Panel 也关」时框架会把 Panel 顶开**——这正好撞上 INV-052-NO-DUAL-HIDE 的另一面：本仓不变量是 **Editor ∨ Panel**，Desktop 是 **Conversation ∨ Workbench**。映射时不能直接复用这条。

CSS class：`LayoutClasses.MAIN_EDITOR_AREA_HIDDEN` 等，随 `getLayoutClasses()` 打在 `mainContainer`。

## 5. 功能如何挂上 Part（不是改 Layout）

| 插入面 | 落到 | API |
|--------|------|-----|
| View container | Sidebar / Panel / AuxiliaryBar | `ViewContainerLocation` + `IViewDescriptorService` |
| 单个 view | 上述容器内 | `ViewsRegistry` / `views` 贡献点 |
| 编辑器 | **仅** `EDITOR_PART` | `EditorInput` + `IEditorService` / `IEditorGroupsService` |
| Status | StatusBar | `IStatusbarService` |
| Activity 图标 | ActivityBar | 与 Sidebar 容器绑定 |

**推论（INV-TOPO）：** 任何 `EditorInput`（含 `ChatEditorInput`、Custom Editor）都落在 `EDITOR_PART` 的 tab 模型里。把 Conversation 做成 editor pane = 中心仍是 EditorPart。S0 在框架层就被这条插入面锁死。

## 6. S1 手术会碰到的代码面

按风险（与 spike §4.1 一致）：

1. **`createGridDescriptor` / `arrangeMiddleSectionNodes` / `arrangeEditorNodes`**  
   必须能描述：中心叶 = 新 Part，End 列 = `EDITOR_PART`（可再竖切占位 Sources）。  
   `SerializableGrid` 本身支持任意排列；**硬的是**所有假定「中间 = editor」的邻居计算、focus、maximize、panel alignment。
2. **`getVisibleNeighborPart`**  
   邻居白名单目前是 Activity/Editor/Panel/Aux/Sidebar/Status/Title，**不含** `SESSIONS_PART`，将来也不含未登记的 ConversationPart。
3. **`setEditorHidden` 与 panel 互斥**  
   End 列 Preview 关闭时，若 Sources 不是 Panel、又不能同时藏 editor+panel，会和四钮「只关 Preview」打架。S1 必须改这条互斥，或把 Sources 做成独立 Part（spike 已倾向占位 Part）。
4. **Part 注册与 `getPart`**  
   新 Part 要进 `Layout` 的 part 表、`createWorkbenchLayout` 的 view map（约 `layout.ts` 1668 行附近 `[Parts.EDITOR_PART]: this.editorPartView`）。
5. **序列化 / 工作区 layout 状态**  
   `LayoutStateKeys.EDITOR_HIDDEN` 等；新中心叶要有自己的 hidden key，否则重启丢拓扑。
6. **辅助窗口**  
   `IAuxiliaryWindowService` 复用 editor part；挪位后 aux window 仍应是「配套编辑器」，不要变成第二 Conversation。

## 7. Modern UI / floating panels

`LayoutSettings.MODERN_UI`（`workbench.experimental.modernUI`）给 part 加 margin/card（`FLOATING_PANEL_MARGIN`）。这是视觉实验，**不是**拓扑。B2 壳合同走 Desktop token（ADR-003），不要把 Modern UI 当文档壳。

## 8. 相关文档

- [Workbench 概览](overview.md) · [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) · [T1–T3](../../reference/code-oss-b2/spike-t1-t3-code-facts.md)
- `src/vs/workbench/browser/parts/{activitybar,sidebar,editor,panel,statusbar}/`
