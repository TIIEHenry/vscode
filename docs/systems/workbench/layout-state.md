---
title: "Workbench Layout 状态"
type: concept
status: accepted
phase: N/A
updated: 2026-08-30
summary: "LayoutStateKeys 持久化显隐、尺寸与 Panel 位置；存储 scope；新 ConversationPart 必须自带 hidden key"
---

# Workbench Layout 状态

> 导航：[系统索引](INDEX.md)。拓扑与显隐 API 见 [Parts / Grid](parts-and-grid.md)。  
> 实现：`src/vs/workbench/browser/layout.ts`（`LayoutStateKeys`、`LayoutStateModel`）。存储走 `IStorageService`。

`Layout` 把窗口几何记在 `LayoutStateModel`：运行时改 hidden / 位置，关机前把 grid 实测尺寸写回。功能代码应走 `IWorkbenchLayoutService.setPartHidden` 等 API，不要自己 invent storage key。

## 1. 键模型

每个键是 `WorkbenchLayoutStateKey`：`name` + `StorageScope` + `StorageTarget` + 默认值。

| 子类 | 含义 |
|------|------|
| `RuntimeStateKey` | 运行中读写（显隐、位置、Zen Mode）。`scope === PROFILE` 时 `setRuntimeValue` **立刻** `store` |
| `InitializationStateKey` | 启动时用于拼 grid 的尺寸/空栏标记；关机时从 `workbenchGrid` 回写 |

落盘名：`LayoutStateModel.STORAGE_PREFIX`（`workbench.`）+ `name`。例：`EDITOR_HIDDEN` → `workbench.editor.hidden`。

`save(workspace, global)` 在 `IStorageService.onWillSaveState` 里以 `save(true, true)` 调用：按键的 `scope` 分别写入 **WORKSPACE** 与 **PROFILE**。Zen Mode 期间带 `zenModeIgnore` 的 runtime 键（Activity / StatusBar 显隐）**不写出**，避免把禅模式的临时藏栏当成用户偏好。

## 2. 持久化了什么

### 显隐（均 `RuntimeStateKey`，`StorageScope.WORKSPACE`，`StorageTarget.MACHINE`）

| 键 | storage `name` | 默认 | 对应 Part |
|----|----------------|------|-----------|
| `ACTIVITYBAR_HIDDEN` | `activityBar.hidden` | `false`（`zenModeIgnore`） | `ACTIVITYBAR_PART` |
| `SIDEBAR_HIDDEN` | `sideBar.hidden` | `false`（空工作区可改默认） | `SIDEBAR_PART` |
| `EDITOR_HIDDEN` | `editor.hidden` | `false` | `EDITOR_PART` |
| `CONVERSATION_HIDDEN` | `conversation.hidden` | `false` | `CONVERSATION_PART` |
| `PANEL_HIDDEN` | `panel.hidden` | `true` | `PANEL_PART` |
| `AUXILIARYBAR_HIDDEN` | `auxiliaryBar.hidden` | `true` | `AUXILIARYBAR_PART` |
| `STATUSBAR_HIDDEN` | `statusBar.hidden` | `false`（`zenModeIgnore`） | `STATUSBAR_PART` |

`setEditorHidden` / `setConversationHidden` / `setPanelHidden` 写入对应 hidden 键，再 `workbenchGrid.setViewVisible`。加载时若 **Conversation 与 Editor 都 hidden** 且 aux 未 maximize，模型会 **强制显示其一**（与 [parts-and-grid](parts-and-grid.md) 的 Conversation ∨ Editor 不变量一致）。

Activity / StatusBar 仍与遗留配置双向同步：`workbench.activityBar.location`、`workbench.statusBar.visible`。

### 尺寸（`InitializationStateKey`，`StorageScope.PROFILE`，`MACHINE`）

| 键 | `name` | 关机时取自 |
|----|--------|------------|
| `SIDEBAR_SIZE` | `sideBar.size` | Sidebar 当前宽，或 hidden 时的 cached visible size |
| `PANEL_SIZE` | `panel.size` | 水平 Panel 用高，竖直 Panel 用宽 |
| `AUXILIARYBAR_SIZE` | `auxiliaryBar.size` | Aux 当前宽或 cached |

默认约 300，新工作区会按窗口宽裁到 `width / 4`。另有 restore 用的 last-non-maximized 宽高（Panel：`PROFILE`；Aux 是否曾 maximize：`WORKSPACE`）。

### 位置与对齐

| 键 | scope / target | 含义 |
|----|----------------|------|
| `SIDEBAR_POSITON` | WORKSPACE / MACHINE | Sidebar 左或右（与遗留 `workbench.sideBar.location` 同步） |
| `PANEL_POSITION` | WORKSPACE / MACHINE | Panel 底/左/右/上；默认来自 `workbench.panel.defaultLocation` |
| `PANEL_ALIGNMENT` | **PROFILE / USER** | 底栏相对 editor 的对齐（`center` 等），可随用户配置漫游 |

另有 `MAIN_EDITOR_CENTERED`、`ZEN_MODE_ACTIVE` / `ZEN_MODE_EXIT_INFO`（均 WORKSPACE / MACHINE）。`AUXILIARYBAR_EMPTY`（PROFILE）记对侧栏是否无 composite，影响默认显隐。

**没有** TitleBar / Banner / `SESSIONS_PART` 的 hidden key；默认 Code 窗口 grid 也不装配 Sessions。`CONVERSATION_HIDDEN` 已登记（M0）；End 列 `EDITOR_HIDDEN` 与中心 Conversation 显隐 **独立**。

## 3. Scope 含义（对新 Part 的推论）

- **WORKSPACE**：这个工作区窗口的显隐与 Panel/Sidebar 方位。换文件夹不带走「我把 editor 藏了」。
- **PROFILE**：跨工作区的分割尺寸（以及可漫游的 `PANEL_ALIGNMENT`）。
- **MACHINE**：本机 UI 几何，不按用户设置同步（`PANEL_ALIGNMENT` 除外）。

新 Part 若只改 grid 描述符、不登记 `LayoutStateKeys`，重启后 `load()` 无法恢复 hidden / size——拓扑会丢。M0 已为 Conversation 登记 `CONVERSATION_HIDDEN`；Sources 占位（slot A）合入时须同样登记。

## 4. ConversationPart hidden key（M0 已落地）

B2 S1 的 `ConversationPart` 已是一等 runtime 状态（`fc6089a3`）：

1. `RuntimeStateKey<boolean>` `CONVERSATION_HIDDEN`（`StorageScope.WORKSPACE`、`MACHINE`），在 `setPartHidden` 分发里读写。
2. `createGridDescriptor` 的 `visible` 读该键；**不**复用 `EDITOR_HIDDEN`（Preview 在 End 后两叶显隐独立）。
3. End 列宽走 `workbench.editor.size`（`InitializationStateKey`）。
4. 互斥公式为 **Conversation ∨ Editor**（不再 Editor ∨ Panel）。

四钮 `toggleRegion('conversation')` 可走 `workbench.action.toggleConversation`；titlebar 四钮 UI **slot A 未合入**。

## 5. 相关文档

- [Parts / Grid](parts-and-grid.md) · [Workbench 概览](overview.md)
- [壳映射 · 四钮](../../reference/code-oss-b2/desktop-shell-mapping.md) · [T1–T3](../../reference/code-oss-b2/spike-t1-t3-code-facts.md)
