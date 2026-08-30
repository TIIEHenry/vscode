---
title: "窗口模型"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "四种宿主：默认 Code 主窗、辅助编辑器窗、Agents Window、浏览器 embedder；各自装配哪些 Part，以及 main / renderer 开窗面"
---

# 窗口模型

> 导航：[横切索引](INDEX.md)。默认窗口的 Part / Grid / 显隐 **不在此重写**，见 [Parts 与 Grid](../../systems/workbench/parts-and-grid.md)。  
> Agents Window 拓扑以 [`src/vs/sessions/LAYOUT.md`](../../../src/vs/sessions/LAYOUT.md) 为 SSOT。进程入口见 [进程概览](../../systems/processes/overview.md)。  
> 实现锚点：`src/vs/platform/windows/`（`IWindowsMainService`、`CodeWindow`）· `IAuxiliaryWindowService` · `INativeHostService` / `IHostService`。

「窗口」在本仓不是一种 layout。同一套 `Parts` 枚举按 **宿主种类** 装配或省略；开窗与生命周期按进程面拆开。本文只写种类、Part 集合与服务边界。

## 1. 四种宿主

| 种类 | 是不是独立 workbench | 桌面载体 | 典型入口 |
|------|----------------------|----------|----------|
| **默认 Code 主窗** | 是（`WindowEnablement` 默认 Editor） | Electron `ICodeWindow` | `workbench.html` → `workbench.desktop.main` |
| **辅助编辑器窗** | 否：挂在某个主窗上 | 子 `BrowserWindow`（`parentId`） | renderer `IAuxiliaryWindowService.open` |
| **Agents Window** | 是（`isSessionsWindow`） | 仍是 `ICodeWindow`，不是 aux | `sessions.html` → `sessions.desktop.main` |
| **浏览器 embedder** | 是（Web 宿主，不是第四种 Part 装配） | 无 Electron 窗；DOM + `create()` | `code/browser/workbench` → `workbench.web.main.internal` |

桌面 main 只把 **主窗与 Agents 窗** 记成 `ICodeWindow`（`IWindowsMainService.getWindows()`）。辅助窗走 `IAuxiliaryWindowsMainService`，列表类型是 `IOpenedAuxiliaryWindow`（有 `parentId`），不是又一个工作区主窗。

`INativeHostService` 只在 native：本窗 `windowId`、`getWindows({ includeAuxiliaryWindows })`、`openWindow`、`openAgentsWindow`、最大化 / 全屏 / 关窗。Web 与桌面共用的开窗 / 焦点面是 `IHostService`（桌面转调 native，Web 由 `BrowserHostService` 用 `window.open` 等模拟）。Embedder **没有** `INativeHostService`。

## 2. 默认 Code 主窗

`WindowsMainService` 组 `INativeWindowConfiguration` 后 `CodeWindow.load()`。未标 `isSessionsWindow` 时 URL 是 `vs/code/electron-browser/workbench/workbench.html`（源码树 `workbench-dev.html`）。Renderer 再进 `workbench.desktop.main`。

装配 **完整默认 chrome**（`Layout` + `createGridDescriptor`）：

| 有 | 无 |
|----|----|
| `TITLEBAR` · `BANNER` · `ACTIVITYBAR` · `SIDEBAR` · **`CONVERSATION`** · `EDITOR` · `PANEL` · `AUXILIARYBAR` · `STATUSBAR` | `SESSIONS_PART` · `CUSTOM_VIEW_GRID_PART` |

中心叶是 **`CONVERSATION_PART`**（M0）；`EDITOR_PART` 在 End 列（Preview）。Grid 形状、`setPartHidden` 互斥、功能如何挂上 Part，只读 [parts-and-grid](../../systems/workbench/parts-and-grid.md)。

视图容器默认 `WindowEnablement.Editor`：只在这种主窗出现，除非标了 `Sessions` / `Both`。

## 3. 辅助编辑器窗

产品语义是 **配套编辑器**，不是第二套 IDE、也不是第二 Conversation。`IEditorGroupsService.createAuxiliaryEditorPart` → `AuxiliaryEditorPart` → `IAuxiliaryWindowService.open()`；桌面 main 由 `IAuxiliaryWindowsMainService` 登记子窗。

这里 **不跑** 主窗那份 `createGridDescriptor`。容器里手排三块：

| Part | 行为 |
|------|------|
| `EDITOR_PART`（`AuxiliaryEditorPartImpl`） | 唯一内容面；组模型仍挂在父窗 `IEditorGroupsService` |
| `TITLEBAR_PART`（辅助 titlebar） | **仅 native + 自定义标题栏**；否则只建 `WindowTitle` |
| `STATUSBAR_PART`（辅助 statusbar） | 默认可显；`compact` 时藏 |

**不出现：** ActivityBar、Sidebar、Panel、AuxiliaryBar、Banner、`SESSIONS_PART`、`CUSTOM_VIEW_GRID_PART`。

关窗时编辑器迁回主窗对应组；`canMove` 可 veto。`compact` 假定单编辑器，加组或多编辑器会退出 compact。B2 挪中心叶之后，aux 仍应是配套编辑器，不要变成第二 Conversation（parts-and-grid §6）。

## 4. Agents Window

判定：工作区 `configPath` 等于 `environmentMainService.agentSessionsWorkspace` → `configuration.isSessionsWindow`。`CodeWindow.load()` 改走 `vs/sessions/electron-browser/sessions.html`（仍是 renderer，入口在 `sessions` 层，不在 `code`）。档案用 Agents Window profile，不跟普通工作区绑同一 user profile。

`IWindowsMainService.openAgentsWindow` / `INativeHostService.openAgentsWindow` 开这种窗。从 Agents 窗再开文件夹会 `forceNewWindow`，避免把 Agents 窗换成普通 Code 窗。

LAYOUT 对 chrome 的合同（此处只记省略，不抄拓扑）：**不装标准 Activity Bar、Status Bar、Banner**；Part 位置由 Agents Window 固定，不跟用户 `sideBar.location` 等走。有的是 Title bar、Sidebar、Sessions Part、Editor、Auxiliary Bar、Panel、Custom View Grid。

| 有 | 故意省略 |
|----|----------|
| `TITLEBAR` · `SIDEBAR` · `SESSIONS_PART` · `EDITOR` · `AUXILIARYBAR` · `PANEL` · `CUSTOM_VIEW_GRID_PART` | `ACTIVITYBAR` · `STATUSBAR` · `BANNER` |

`SESSIONS_PART` / `CUSTOM_VIEW_GRID_PART` **只在这种窗装配**。Editor 仍是 `EDITOR_PART`，但是侧/详情面，不是默认窗的中心锚点。Web 侧可用 payload `isSessionsWindow=true` 走 `sessions.web.main`，Part 集合与桌面 Agents 窗同一合同。

## 5. 浏览器 embedder

Embedder 是 **宿主**，不是第四种 Part 拓扑。`src/vs/code/browser/workbench/workbench.ts` 调稳定 `create(domElement, options)`（`workbench.web.main.internal` / `IWorkbenchConstructionOptions`）。vscode-server 在磁盘上有该 `workbench.html` 时挂 `WebClientServer`；`scripts/code-web.sh` 用 `@vscode/test-web` 喂同一入口，不经 `src/vs/server/`。

默认 Web 工作台与 §2 **同一套 Part**（Title → Status，中心 **Conversation**、End **Editor**）。没有 Electron `ICodeWindow`，也没有 `INativeHostService`。辅助编辑器窗仍可开（浏览器弹窗 + 同一套 `IAuxiliaryWindowService`），Part 仍是 Editor ± Title / Status。产品用 `productService.embedderIdentifier`（context key `embedderIdentifier`）区分 vscode.dev 等壳，**不**另开一套 grid。

远程桌面窗是「桌面主窗 + `remoteAuthority`」，不是 embedder。

## 6. 服务面（开谁、谁记账）

```text
electron-main
  IWindowsMainService        → ICodeWindow（默认主窗 | Agents 窗）
  IAuxiliaryWindowsMainService → 子 BrowserWindow（parentId）

renderer / web
  IAuxiliaryWindowService    → 开辅助窗、按 windowId 取 IAuxiliaryWindow
  IEditorGroupsService.createAuxiliaryEditorPart → 往辅助窗塞 Editor/Title/Status

跨平台
  IHostService               → openWindow / 焦点 / getWindows（Web + 桌面）
  INativeHostService         → 上者的 native 超集 + openAgentsWindow 等
```

`platform/windows` 只管 **主进程 `ICodeWindow` 生命周期与 load URL**。辅助窗的 Part 装配在 workbench renderer。Agents 窗的 Part 所有权在 `vs/sessions`，workbench **不得** import sessions。

## 7. 相关文档

- [Parts / Grid](../../systems/workbench/parts-and-grid.md) · [Workbench 概览](../../systems/workbench/overview.md)
- [进程概览](../../systems/processes/overview.md) · [code 索引](../../modules/code/INDEX.md)
- [Sessions 索引](../../modules/sessions/INDEX.md) · [`LAYOUT.md`](../../../src/vs/sessions/LAYOUT.md)
