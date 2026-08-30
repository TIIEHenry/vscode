---
title: "Workbench UI 框架：Parts、Grid、显隐"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "默认 Code 窗口的 Part 枚举、SerializableGrid 描述符、Conversation∨Editor 显隐不变量；B2 S1 M0 拓扑锚点"
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
| `CONVERSATION_PART` | `workbench.parts.conversation` | **中心锚点**（M0 占位 Part：标题 + 假时间线 + 假输入 dock） |
| `EDITOR_PART` | `workbench.parts.editor` | **End 列**：EditorGroup + tabs + `EditorInput`（`IEditorService.openEditor` 仍落这里） |
| `PANEL_PART` | `workbench.parts.panel` | 底（可左右）面板：终端、问题、输出 |
| `AUXILIARYBAR_PART` | `workbench.parts.auxiliarybar` | 对侧栏（Secondary Side Bar）；默认仍可关 |
| `STATUSBAR_PART` | `workbench.parts.statusbar` | 底栏 |
| `SESSIONS_PART` | `workbench.parts.sessions` | **Agents Window 才装配**；默认 Code 窗口 grid **不出现** |
| `CUSTOM_VIEW_GRID_PART` | `workbench.parts.customViewGrid` | Agents Window 全幅自定义视图 |

`ConversationPart` 实现：`src/vs/workbench/browser/parts/conversation/conversationPart.ts`。它 **不是** `EditorInput` / Custom Editor / Sidebar ViewPane。

## 2. 默认 grid 拓扑（M0）

`Layout.createGridDescriptor()` 生成垂直根：

```text
VERTICAL
├── TITLEBAR
├── BANNER（常 hidden）
├── middleSection（水平串：Activity | Sidebar | conversation+panel 枝 | EditorPart | AuxiliaryBar）
└── STATUSBAR
```

水平 Panel（默认底栏）时：中心枝是纵向 `[ ConversationPart, PANEL ]`；`EDITOR_PART` 在 End 列（auxiliary bar 同侧、更靠内）。Aux 仍是最外侧叶，默认可关。

**锚点事实：** 中间枝的「主面积」叶子是 `{ type: Parts.CONVERSATION_PART }`。Editor 仍走 `IEditorService.openEditor`，出现在 End 列原生 tabs。

`arrangeCenterSectionNodes` 在 Conversation 没有水平兄弟时直接返回 conversation 叶。Sidebar / Editor / Aux 是 Conversation 的水平兄弟或更外层邻居，取决于 panel alignment。

## 3. 几何 vs ADR-052「Activity 通高」

- Activity 在 **middleSection**，上接 TitleBar、下接 StatusBar → **rail 碰到 StatusBar**，与 ADR-052「通高到 StatusBar」同几何量级。
- 默认 **底 Panel 与 Conversation 同枝**，不钻到 Activity 底下（Activity 是更外层水平邻居）。这与 ADR-052「Bottom Panel 不钻 Activity」一致。
- Activity **不是** 第四 root；它仍是 middle 的一个叶。
- Activity **默认没有**「底栏四钮」。四钮是 Desktop chrome，本仓只有 ViewContainer 图标 + 账户/管理齿轮（`activitybarPart` / `globalCompositeBar`）。

`workbench.activityBar.location` 可把 Activity 藏进 Sidebar 顶或关：改壳时这是 EH/`viewsContainers` 的冲突面，见 [eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md)。

## 4. 显隐 API（T2 / T3）

`IWorkbenchLayoutService.setPartHidden(hidden, part)` → `Layout` 分发：

| Part | 私有实现 | 关键约束（读自 `layout.ts`） |
|------|----------|------------------------------|
| `CONVERSATION_PART` | `setConversationHidden` | 写入 `conversation.hidden`；CSS `noconversation`。**若隐藏 Conversation 且 Editor 也不可见且 aux 未 maximize → 强制显示 Editor** |
| `EDITOR_PART` | `setEditorHidden` | 写入 `EDITOR_HIDDEN`。**不再**强制弹出 Panel。**若隐藏 Editor 且 Conversation 也不可见且 aux 未 maximize → 强制显示 Conversation** |
| `PANEL_PART` | `setPanelHidden` | 可独立藏；maximize panel = 藏 Conversation（中心叶） |
| `SIDEBAR_PART` | `setSideBarHidden` | 可独立藏 |
| `AUXILIARYBAR_PART` | `setAuxiliaryBarMaximized` / `setAuxiliaryBarHidden` | 可独立藏；maximize aux 会挤掉 Conversation + Editor + Panel + Sidebar |
| `ACTIVITYBAR_PART` | `setActivityBarHidden` | 可独立藏 |
| `STATUSBAR_PART` | 对应 hidden key | 可独立藏 |

不变量是 **Conversation ∨ Editor**（INV-052-NO-DUAL-HIDE）。命令：`workbench.action.toggleConversation`、`workbench.action.toggleEditorVisibility`。

CSS class：`LayoutClasses.MAIN_EDITOR_AREA_HIDDEN` / `CONVERSATION_HIDDEN` 等，随 `getLayoutClasses()` 打在 `mainContainer`。

## 5. 功能如何挂上 Part（不是改 Layout）

| 插入面 | 落到 | API |
|--------|------|-----|
| View container | Sidebar / Panel / AuxiliaryBar | `ViewContainerLocation` + `IViewDescriptorService` |
| 单个 view | 上述容器内 | `ViewsRegistry` / `views` 贡献点 |
| 编辑器 | **仅** `EDITOR_PART` | `EditorInput` + `IEditorService` / `IEditorGroupsService` |
| Status | StatusBar | `IStatusbarService` |
| Activity 图标 | ActivityBar | 与 Sidebar 容器绑定 |

**推论（INV-TOPO）：** 任何 `EditorInput`（含 `ChatEditorInput`、Custom Editor）都落在 `EDITOR_PART` 的 tab 模型里。把 Conversation 做成 editor pane = 中心仍是 EditorPart。S0 在框架层就被这条插入面锁死。

## 6. M0 已落地的代码面

1. **`createGridDescriptor` / `arrangeMiddleSectionNodes` / `arrangeCenterSectionNodes`** — 中心叶 = `CONVERSATION_PART`，End 列 = `EDITOR_PART`。Sources 下格仍未做。
2. **`getVisibleNeighborPart`** — 白名单已含 `CONVERSATION_PART`。
3. **互斥** — `setEditorHidden` / `setConversationHidden` / `LayoutStateModel.applyOverrides`：Conversation ∨ Editor。Panel 不再被强制弹出。
4. **注册** — `Parts.CONVERSATION_PART`；`ConversationPart` eager singleton（`IConversationPartService`）；`createWorkbenchLayout` view map；`workbench.ts` `createPart` 循环。
5. **storage keys** — `workbench.conversation.hidden`（runtime）、`workbench.editor.size`（End 列宽）。Workbench grid 每次启动从描述符重建，不读旧 grid JSON。
6. **辅助窗口** — 仍复用 `EDITOR_PART`；Conversation 只在主窗口。

## 7. Modern UI / floating panels

`LayoutSettings.MODERN_UI`（`workbench.experimental.modernUI`）给 part 加 margin/card（`FLOATING_PANEL_MARGIN`）。这是视觉实验，**不是**拓扑。B2 壳合同走 Desktop token（ADR-003），不要把 Modern UI 当文档壳。

## 8. 相关文档

- [Workbench 概览](overview.md) · [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) · [T1–T3](../../reference/code-oss-b2/spike-t1-t3-code-facts.md)
- `src/vs/workbench/browser/parts/{activitybar,sidebar,conversation,editor,panel,statusbar}/`
