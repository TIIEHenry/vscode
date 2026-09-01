---
title: "Workbench UI 框架：Parts、Grid、显隐"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-01
summary: "默认 Code 窗口的 Part 枚举、SerializableGrid、Conversation∨(Editor∨Sources)；INV-TOPO：中心叶仍是 CONVERSATION_PART；对话 tab 走嵌套 IEditorPart（ADR-002 选定）"
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
| `CONVERSATION_PART` | `workbench.parts.conversation` | **中心锚点**（Part 只做槽：SessionBar / timeline / dock；透镜在 `contrib/conversation`，非 `EditorInput`） |
| `EDITOR_PART` | `workbench.parts.editor` | **End 列上格**：EditorGroup + tabs + `EditorInput`（`IEditorService.openEditor` 仍落这里） |
| `SOURCES_PART` | `workbench.parts.sources` | **End 列下格**：`contrib/sources` **Files \| Changes \| Review** tab strip（Files = 只读列表投影，空工作区 copy 诚实：Explorer 列表投影、非 file tree、非 Chat；Changes = SCM 变更资源列表 + **stage/unstage/commit** 列表操作 → Preview；Review = SCM 变更资源只读列表 → Preview（`SourcesReviewList`）；树权威仍在 Sidebar Explorer） |
| `PANEL_PART` | `workbench.parts.panel` | 底（可左右）面板：终端、问题、输出 |
| `AUXILIARYBAR_PART` | `workbench.parts.auxiliarybar` | 对侧栏（Secondary Side Bar）；默认仍可关 |
| `STATUSBAR_PART` | `workbench.parts.statusbar` | 底栏 |
| `SESSIONS_PART` | `workbench.parts.sessions` | **Agents Window 才装配**；默认 Code 窗口 grid **不出现** |
| `CUSTOM_VIEW_GRID_PART` | `workbench.parts.customViewGrid` | Agents Window 全幅自定义视图 |

`ConversationPart` 实现：`src/vs/workbench/browser/parts/conversation/conversationPart.ts`。它 **不是** `EditorInput` / Custom Editor / Sidebar ViewPane。产品透镜（SessionBar、stub 时间线、stub dock）由 `src/vs/workbench/contrib/conversation/` 填槽，`browser/parts` 不 import contrib。

## 2. 默认 grid 拓扑（M0）

`Layout.createGridDescriptor()` 生成垂直根：

```text
VERTICAL
├── TITLEBAR
├── BANNER（常 hidden）
├── middleSection（水平串：Activity | Sidebar | conversation+panel 枝 | EditorPart | AuxiliaryBar）
└── STATUSBAR
```

水平 Panel（默认底栏）时：中心枝是纵向 `[ ConversationPart, PANEL ]`；End 列是纵向 `[ EDITOR_PART, SOURCES_PART ]`（auxiliary bar 同侧、更靠内）。Aux 仍是最外侧叶，默认可关。

**锚点事实：** 中间枝的「主面积」叶子是 `{ type: Parts.CONVERSATION_PART }`。Editor 仍走 `IEditorService.openEditor`，出现在 End 列上格原生 tabs；Sources 占 End 下格，`contrib/sources` 提供 **Files \| Changes \| Review** tab strip（Files 为只读列表投影；Changes = SCM 变更资源列表 + **stage/unstage/commit** 列表操作 → Preview；Review = SCM 变更资源只读列表 → Preview）。

`arrangeCenterSectionNodes` 在 Conversation 没有水平兄弟时直接返回 conversation 叶。Sidebar / Editor / Aux 是 Conversation 的水平兄弟或更外层邻居，取决于 panel alignment。

## 3. 几何 vs ADR-052「Activity 通高」

- Activity 在 **middleSection**，上接 TitleBar、下接 StatusBar → **rail 碰到 StatusBar**，与 ADR-052「通高到 StatusBar」同几何量级。
- 默认 **底 Panel 与 Conversation 同枝**，不钻到 Activity 底下（Activity 是更外层水平邻居）。这与 ADR-052「Bottom Panel 不钻 Activity」一致。
- Activity **不是** 第四 root；它仍是 middle 的一个叶。
- Activity **默认没有**「底栏四钮」。四钮是 Desktop chrome，宿主在 titlebar 右上 `LayoutControlMenu`（**Navigator / Conversation / Preview / Sources** 产品名；Panel / Aux 仅在 submenu）。

`workbench.activityBar.location` 可把 Activity 藏进 Sidebar 顶或关：改壳时这是 EH/`viewsContainers` 的冲突面，见 [eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md)。

## 4. 显隐 API（T2 / T3）

`IWorkbenchLayoutService.setPartHidden(hidden, part)` → `Layout` 分发：

| Part | 私有实现 | 关键约束（读自 `layout.ts`） |
|------|----------|------------------------------|
| `CONVERSATION_PART` | `setConversationHidden` | 写入 `conversation.hidden`；CSS `noconversation`。**若隐藏 Conversation 且 Editor 与 Sources 均不可见且 aux 未 maximize → 强制显示 Editor** |
| `EDITOR_PART` | `setEditorHidden` | 写入 `EDITOR_HIDDEN`。**不再**强制弹出 Panel。**若隐藏 Editor 且 Conversation 与 Sources 均不可见且 aux 未 maximize → 强制显示 Conversation** |
| `SOURCES_PART` | `setSourcesHidden` | 写入 `SOURCES_HIDDEN`；CSS `nosources`。**若隐藏 Sources 且 Conversation 与 Editor 均不可见且 aux 未 maximize → 强制显示 Conversation** |
| `PANEL_PART` | `setPanelHidden` | 可独立藏；maximize panel = 藏 End 列（Editor + Sources），Conversation 保持可见 |
| `SIDEBAR_PART` | `setSideBarHidden` | 可独立藏 |
| `AUXILIARYBAR_PART` | `setAuxiliaryBarMaximized` / `setAuxiliaryBarHidden` | 可独立藏；maximize aux 藏 End 列（Editor + Sources）与 Sidebar/Panel，Conversation 保持可见 |
| `ACTIVITYBAR_PART` | `setActivityBarHidden` | 可独立藏 |
| `STATUSBAR_PART` | 对应 hidden key | 可独立藏 |

不变量是 **Conversation ∨ (Editor ∨ Sources)**（INV-052-NO-DUAL-HIDE；`forceShownAgentShellPart`）。Panel maximize 藏 End 列（Editor + Sources）而非 Conversation，un-maximize 时从 `PANEL_LAST_NON_MAXIMIZED_VISIBILITY` 恢复 End 显隐。**Zen Mode** 同样藏 End 列、强制 Conversation 可见（`ZEN_MODE_EXIT_INFO.wasVisible` 快照 editor/sources 供退出恢复）；不居中 Preview、不把 Zen 偷换成 `pureEditor`。命令：`workbench.action.toggleConversation`、`workbench.action.toggleEditorVisibility`、`workbench.action.toggleSources`；四钮经 `LayoutControlMenu` 注册。各 Agent shell 区域另有本地 **hide (−)**：Conversation / Sources 为 part 内 − 控件；Preview（`EDITOR_PART`）无原生 part chrome，本地 hide 为 editor title 上的 `MenuId.EditorTitle` / `EditorTitleContext` 动作（`Hide Preview` / `Show Preview`），均经 `setPartHidden` 走同一 layout 路径。

CSS class：`LayoutClasses.MAIN_EDITOR_AREA_HIDDEN` / `CONVERSATION_HIDDEN` 等，随 `getLayoutClasses()` 打在 `mainContainer`。

## 5. 功能如何挂上 Part（不是改 Layout）

| 插入面 | 落到 | API |
|--------|------|-----|
| View container | Sidebar / Panel / AuxiliaryBar | `ViewContainerLocation` + `IViewDescriptorService` |
| 单个 view | 上述容器内 | `ViewsRegistry` / `views` 贡献点 |
| 文件 / untitled / diff / `ChatEditorInput` | **仅**主 `EDITOR_PART`（Preview） | `EditorInput` + `IEditorService`；`ACTIVE_GROUP` / `SIDE_GROUP` |
| Conversation chat tab（[ADR-002](../../../dev/decisions/002-conversation-session-windows.md) **选定，未实施**） | `CONVERSATION_PART` 内嵌的 Conversation `IEditorPart`（非 Layout `Parts` 枚举） | `ConversationChatInput` + `CONVERSATION_GROUP` / `CONVERSATION_SIDE_GROUP`；**禁止** `ChatEditorInput` |
| Status | StatusBar | `IStatusbarService` |
| Activity 图标 | ActivityBar | 与 Sidebar 容器绑定 |

**推论（INV-TOPO）：** Layout 中心叶 **必须**是 `CONVERSATION_PART`，禁止把中心改回 `Parts.EDITOR_PART` 或用 `ChatEditor` / Custom Editor 当产品对话。文件永远进 End 列 Preview。ADR-002 增加 **第四类 editor 容器**：Conversation `IEditorPart` 挂在 ConversationPart 的 session 叶内（Modal 同款注册、共用 `windowId`），只接受 conversation 类 input，且**须从 `EditorParts` 的全局聚合中豁免**（枚举、MRU `activePart`、`applyState` 工作集恢复、editor 历史；见 [editor-part-tabs](editor-part-tabs.md) §4 与 [conversation-session-windows](../../../dev/plans/conversation-session-windows.md) §3.8）。HEAD 代码仍是 Part 三槽透镜，尚未工厂该嵌套 Part。S0 拒绝的是 **ChatEditor 占中心**，不是「Conversation 内部永远不能有 EditorGroup」。

## 6. M0 拓扑 + M1 内容（已落地代码面）

1. **`createGridDescriptor` / `arrangeMiddleSectionNodes` / `arrangeCenterSectionNodes` / `arrangeEndColumnNode`** — 中心叶 = `CONVERSATION_PART`，End 列 = `EDITOR_PART`（上）+ `SOURCES_PART`（下）。
2. **`getVisibleNeighborPart`** — 白名单已含 `CONVERSATION_PART`。
3. **互斥** — `setEditorHidden` / `setConversationHidden` / `setSourcesHidden` / `enforceAgentShellVisible`：Conversation ∨ (Editor ∨ Sources)。Panel 不再被强制弹出。
4. **注册** — `Parts.CONVERSATION_PART` / `SOURCES_PART`；`ConversationPart` / `SourcesPart` eager singleton；`createWorkbenchLayout` view map；`workbench.ts` `createPart` 循环。
5. **四钮（D7）** — `layoutActions.ts`：主簇 `LayoutControlMenu` 仅 **Navigator / Conversation / Preview / Sources**（产品名标签）；Panel / Aux 退到 `LayoutControlMenuSubmenu`。
6. **Conversation 透镜** — HEAD：`contrib/conversation` 填 SessionBar / stub 时间线 / stub dock 槽；非 `ChatEditor` / `ChatViewPane`。[PRD-016](../../product/requirements.md#prd-016-conversation-session-窗口与-chat-tab) 选定：timeline/dock 迁入 `ConversationEditorPane`，窗口 chrome 留在 Part/叶；未实施。
7. **Sources tabs** — `contrib/sources`：title 区 **Files \| Changes \| Review** tab strip；各 tab 面板顶有紧凑 **filter** 输入（`filterSourcesEntries` 按文件名/路径子串筛选可见行；空结果 copy 诚实，如 Files 无工作区文件时 `Flat Explorer list projection—not a file tree or Chat.`、筛选无匹配时 `No matching files.` / `No matching changes.`）；Files = `SourcesFilesList` 只读列表投影（点击 `IEditorService.openEditor` 落 End 上格 Preview）；Changes = `SourcesChangesList` SCM 变更资源列表（点击 `openEditor` 打开文件；行内/选中 **stage/unstage** 经 `git.stage` / `git.unstage` + `ISCMResource`，底部 **commit** 行写 SCM input 并跑 `acceptInputCommand` / `git.commit`；**不**走 Diff / `openDiff` / `ISCMResource.open`）；Review = `SourcesReviewList` SCM 变更资源只读列表（同样 `openEditor` 打开 Preview，**不**走 Diff；面板顶 **header hint** 标明只读、Preview≠Diff FORK、review engine 未接线——无假 review comment）；Diff 深查看仍 **EDITOR_PART** FORK。
8. **storage keys** — `workbench.conversation.hidden`、`workbench.sources.hidden`（runtime）、`workbench.editor.size` / `workbench.sources.size`（End 列）。Workbench grid 每次启动从描述符重建，不读旧 grid JSON。
9. **辅助窗口** — 仍复用 `EDITOR_PART`；Conversation / Sources 只在主窗口。

**仍 deferred（非代码）：** compile、启动 T1–T3 演示、EH 探针 → [deferred-gaps](../../../dev/progress/deferred-gaps.md) D3–D5。代码面见 [diff-footprint](../../reference/code-oss-b2/diff-footprint.md) 与 [m1-shell-followon](../../../dev/plans/m1-shell-followon.md)。

## 7. Modern UI / floating panels

`LayoutSettings.MODERN_UI`（`workbench.experimental.modernUI`）给 part 加 margin/card（`FLOATING_PANEL_MARGIN`）。这是视觉实验，**不是**拓扑。B2 壳合同走 Desktop token（ADR-003），不要把 Modern UI 当文档壳。

## 8. 相关文档

- [Workbench 概览](overview.md) · [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) · [T1–T3](../../reference/code-oss-b2/spike-t1-t3-code-facts.md) · [footprint](../../reference/code-oss-b2/diff-footprint.md)
- `src/vs/workbench/browser/parts/{activitybar,sidebar,conversation,editor,panel,statusbar}/`
