---
title: "Views 与 Composites：容器、视图、插入面"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-31
summary: "ViewContainer / View / PaneComposite 分层与 Sidebar·Panel·AuxiliaryBar 落点；扩展只注册视图、不造 Part；B2 Conversation 是 Part 不是 ViewContainer"
---

# Views 与 Composites

> 导航：[系统索引](INDEX.md)。Part / Grid 框架：[parts-and-grid](parts-and-grid.md)。EH 贡献点落点：[eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md)。  
> Chat 宿主边界：[agent-ui](../chat/agent-ui.md)（本页只引用，不复写 Widget / Copilot 清单）。  
> 实现主文件：`src/vs/workbench/common/views.ts` · `src/vs/workbench/browser/parts/views/viewPane.ts` · `viewPaneContainer.ts` · `src/vs/workbench/browser/parts/paneCompositePart.ts`。

本页回答：**功能如何挂进已有 chrome，而不改 Layout**。默认 Code 窗口的 Part 集合是固定的；视图体系只往其中三个 Part 里填内容。

## 1. 三层名字，不要混用

| 概念 | 是什么 | 代码锚点 | 不是什么 |
|------|--------|----------|----------|
| **ViewContainer** | 一组 view 的注册身份：id、标题、图标、默认 `ViewContainerLocation`、`ctorDescriptor`（`IViewPaneContainer`） | `IViewContainerDescriptor` / `ViewContainer`；`Extensions.ViewContainersRegistry` | 不是 grid 上的 Part；注册一个容器 **不会** `new Part` |
| **View** | 容器里的一叶：可折叠、可移动、可显隐 | `IViewDescriptor` + 运行时 `IView`；`Extensions.ViewsRegistry` | 不是窗口中心面；不是 `EditorInput` |
| **PaneComposite** | 某个 location Part **当前打开**的那一个容器实例 | `PaneComposite`（`panecomposite.ts`）包一层 `ViewPaneContainer` | 不是第四种 location；同一时刻每个 location Part 只活跃一个 composite |

运行时再拆一层 UI：

```text
SidebarPart / PanelPart / AuxiliaryBarPart   ← AbstractPaneCompositePart（已是 Parts 枚举里的叶子）
        │  openPaneComposite(containerId)
        ▼
   PaneComposite                             ← Composite：标题栏、进度、菜单
        │  createViewPaneContainer()
        ▼
   ViewPaneContainer                         ← 按 IViewContainerModel 装配多叶
        │  每叶
        ▼
   ViewPane implements IView                 ← 头（title / toolbar / twistie）+ body
```

`IViewDescriptorService` 是运行时编排：查容器默认/当前位置、把 view 在容器之间搬、把整个容器在 Sidebar / Panel / AuxiliaryBar 之间搬（`moveViewContainerToLocation` / `moveViewToLocation`）。它 **不** 创造新 Part。

`ViewPane` 是 `Pane`（`base` splitview）的工作台子类：每个 view 一张带头的折叠面板。`ViewPaneContainer` 用 `PaneView` 把多张 `ViewPane` 竖排（或在单 view 时与容器标题合并，`mergeViewWithContainerWhenSingleView`）。

## 2. 三个 location，三个已有 Part

`ViewContainerLocation`（`views.ts`）只有三项：

| 枚举 | 字符串（`ViewContainerLocationToString`） | 落到的 Part | 切换 UI |
|------|------------------------------------------|-------------|---------|
| `Sidebar` | `sidebar` | `SIDEBAR_PART` | ActivityBar 图标 rail（`ACTIVITYBAR_PART`） |
| `Panel` | `panel` | `PANEL_PART` | Panel 底（或左右）composite bar |
| `AuxiliaryBar` | `auxiliarybar` | `AUXILIARYBAR_PART` | 对侧栏 composite bar（Secondary Side Bar） |

`SidebarPart` / `PanelPart` / `AuxiliaryBarPart` 都 **继承** `AbstractPaneCompositePart`：同一套 `openPaneComposite` / 钉选 / 可见容器列表，只是 `partId` 与 `location` 不同。

**没有**第四个 location。`EDITOR_PART` 走 `EditorInput`，`STATUSBAR_PART` 走 `IStatusbarService`，`TITLEBAR_PART` / `BANNER_PART` 走各自 chrome。视图 registry **写不进**这些 Part。

`WindowEnablement`（`Editor` / `Sessions` / `Both`）只过滤「这个容器/视图在哪扇窗启用」，仍然落在上述三个 location 之一。Agents Window 可以关掉 ActivityBar，但扩展声明的 `viewsContainers.activitybar` **不会因此变成新 Part**——该窗直接失去这条表面，见 [eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md) §3。

## 3. 扩展如何贡献视图（不创建 Part）

内置 contrib 与扩展走同一组 registry。扩展侧贡献点在 `workbench/api/browser/viewsExtensionPoint.ts`：

| `package.json` | 解析成 | 落点 |
|----------------|--------|------|
| `contributes.viewsContainers.activitybar` | 新 `ViewContainer`，`location = Sidebar` | Activity 多一枚图标 + Sidebar 里一个容器 |
| `contributes.viewsContainers.panel` | 新 `ViewContainer`，`location = Panel` | `PANEL_PART` 多一个 composite |
| `contributes.viewsContainers.secondarySidebar` | 新 `ViewContainer`，`location = AuxiliaryBar` | `AUXILIARYBAR_PART` |
| `contributes.views`（挂到某 container id，或 `explorer` / `debug` 等内置 id） | `IViewDescriptor`（常为 `ICustomViewDescriptor` + `ITreeView`） | **已有**容器内部一叶 |

工作台启动时 `Layout` 已经把 Sidebar / Panel / AuxiliaryBar **三个 Part 放进 grid**。扩展 handler 只做 `registerViewContainer` / `ViewsRegistry.registerViews`。`IViewContainerDescriptor.ctorDescriptor` 指向一个 `IViewPaneContainer` 实现（扩展容器一般是通用 `ViewPaneContainer`）；`PaneComposite` 再把它包成可被 `AbstractPaneCompositePart` 打开的 composite。

因此：

- 扩展 **不能**、也 **不必** 新增 `Parts` 枚举项。
- 多出来的是 Activity 图标、Panel tab、Aux 容器，不是新的 grid 叶子。
- 改壳后这些贡献仍只会挤进三个 location。Activity 槽与四钮抢位、Aux 默认关时视图无处去——这是 EH 表面冲突，不是「缺一个 Conversation 容器」。矩阵见 [eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md)。

拖拽搬家（`IViewDescriptorService.moveView*`）只在三个 location 之间循环。用户把「聊天」从 Sidebar 拖到 Panel，仍然是 View，不是中心 Part。

## 4. 为何 B2 不得为 Conversation 发明 ViewContainer

[parts-and-grid](parts-and-grid.md) 的插入面已经锁死：**ViewContainer 只能进 Sidebar / Panel / AuxiliaryBar**。B2 的 Conversation 合同是 **窗口中心 Part**（M0 为 `CONVERSATION_PART`；Agents Window 为 `SESSIONS_PART`），不是这三个槽里的又一个容器。

若把 Conversation 做成新 `ViewContainer`：

1. **拓扑错位。** 中心叶须为 `CONVERSATION_PART`（M0 已改）；若仍走 ViewContainer，对话面变成侧栏/底栏插件，与 INV-TOPO 相反。
2. **EH 表面被污染。** 新产品容器会进 Activity roster 或 Panel bar，和 Navigator / 四钮、扩展 `viewsContainers.activitybar` 抢同一槽。布局类贡献默认 **不承诺**（eh-surface-notes）；自己再占一个容器等于把冲突写进产品。
3. **搬家语义错误。** 用户或 `moveViewContainerToLocation` 可以把容器拖到 Panel / Aux。中心透镜不能被拖成底栏 tab。
4. **已有反例就在树上。** 本仓已经用 View 体系装过对话——那就是下一节的 `ChatViewPane`。再注册一个「产品 Conversation」容器，只是重复这条侧栏路径。

`ConversationPart` **已在 M0 落地**（[parts-and-grid](parts-and-grid.md) §1）。正确手术是：Part 进 `Layout` 的 part 表与 grid 描述符，对话 UI **嵌进该 Part**，而不是 `registerViewContainer(..., ViewContainerLocation.Sidebar)`。

Sessions 窗口的 `SESSIONS_PART` 证明「非 Editor 中心 Part」可行，但它内部是 `SerializableGrid<SessionView>`，**不是** `ViewContainerLocation`。不要把 Sessions 的透镜误读成「再挂一个 view container」。

## 5. ChatViewPane 是 ViewPane（引用，不复写）

`ChatViewPane`（`contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts`）**继承 `ViewPane`**，落在 Sidebar / Panel 的视图体系里。它是 workbench 把 `ChatWidget` 装进已有 location 的宿主之一，**不是** Part，也不是 B2 中心透镜。

分层、与 `ChatEditor` / Sessions 宿主的对比、Copilot 边界，以 [agent-ui](../chat/agent-ui.md) 为准。本页只固定一条框架事实：

> `ChatViewPane extends ViewPane` → 它吃的是 §1–§3 的插入面。把它（或任何新 `ViewContainer`）当 Conversation，等于把对话留在插件位，而非中心 `CONVERSATION_PART`。

改造期可以对照现有 `ChatViewPane` 看 Widget 怎么嵌；产品壳必须走新 Part。整块搬进 `ConversationPart` 会把 entitlement / setup 一并带入，见 agent-ui §3、§5。

**Auxiliary Bar 默认（2026-08-31，M2 切片 2）**：默认编辑器窗口出厂 `workbench.secondarySideBar.defaultVisibility = 'hidden'`，Chat 容器（`workbench.panel.chat`）仍挂在 `ViewContainerLocation.AuxiliaryBar` 作 donor，但 **`isDefault: false`**，不再是该 location 的默认 composite。Command Palette / Views 仍可打开 `ChatViewPane` 对照 Copilot 行为。Agents Window 的 `agentsWindow` 覆盖仍为 `visibleInWorkspace`（只读），与产品壳默认无关。

## 6. 相关文档

- [Parts、Grid、显隐](parts-and-grid.md) · [Workbench 概览](overview.md)
- [Agent UI 清单](../chat/agent-ui.md) · [EH 表面](../../reference/code-oss-b2/eh-surface-notes.md)
- `src/vs/workbench/browser/parts/{sidebar,panel,auxiliarybar}/`
- `src/vs/workbench/api/browser/viewsExtensionPoint.ts`
