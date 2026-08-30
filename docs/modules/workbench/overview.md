---
title: "Workbench 分层概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "workbench 核心、parts/layout、services 与 contrib 边界、贡献规则与入口加载"
---

# Workbench 分层概览

> 导航见 [INDEX](INDEX.md)。跨层协作见 [systems/workbench](../../systems/workbench/overview.md)。  
> Chat / Extension Host 深规格分别在 [modules/chat](../chat/INDEX.md)、[modules/workbench-api](../workbench-api/INDEX.md)。

`src/vs/workbench/` 是 IDE 工作台层：在 Monaco（`editor`）之上提供窗口 chrome、编辑器组、视图容器、核心服务，以及按需加载的功能贡献。约定见 [source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md)。

## 目录角色

| 路径 | 角色 |
|------|------|
| `{common,browser,electron-browser}/` | **最小核心**：`Workbench` / `Layout`、`Part`、`Composite`、editor 模型、贡献注册表 |
| `services/` | **核心服务**（非某一 contrib 专属）：编辑器组、视图、文件、扩展宿主、生命周期等 |
| `contrib/` | **功能贡献**：资源管理器、搜索、调试、终端、Chat… |
| `api/` | Extension Host / `vscode.d.ts` 实现（虚拟模块 [workbench-api](../workbench-api/INDEX.md)） |
| `test/` | 工作台层测试与 fixture |

目标环境子目录规则与全仓库一致：`common` ⊂ `browser` ⊂ `electron-browser`。Web 路径走 `browser/`；桌面再叠 `electron-browser/`（如 `desktop.main.ts`、`NativeWindow`）。

## Parts 与 layout

`Workbench`（`browser/workbench.ts`）继承 `Layout`（`browser/layout.ts`）。`Layout` 实现 `IWorkbenchLayoutService`，用 `SerializableGrid` 排列各 `Part`。

`Part`（`browser/part.ts`）是可序列化的 grid view：可选 title + 必填 content。默认 Code 窗口在 `renderWorkbench()` 里创建这些 part：

| `Parts` | DOM / 职责 |
|---------|------------|
| `TITLEBAR_PART` | 标题栏、菜单、Command Center |
| `BANNER_PART` | 顶栏横幅 |
| `ACTIVITYBAR_PART` | 活动栏（切换 sidebar / auxiliarybar 容器） |
| `SIDEBAR_PART` | 主侧栏（Explorer、Search 等 pane composite） |
| `EDITOR_PART` | 编辑器组（`role="main"`） |
| `PANEL_PART` | 底栏 / 可移动面板（Terminal、Problems、Output…） |
| `AUXILIARYBAR_PART` | 对侧栏（默认 Chat 等） |
| `STATUSBAR_PART` | 状态栏（`<footer>`） |

`Parts` 枚举里还有 `SESSIONS_PART`、`CUSTOM_VIEW_GRID_PART`，供 Agents Window 等非默认 chrome 使用；默认 `Workbench.renderWorkbench()` **不会**创建它们。通知中心 / toast 在 `browser/parts/notifications/`，是叠加层，不是 `Parts` 成员。

侧栏与面板里同时只显示一个 **composite**。带视图的容器是 `PaneComposite`（`ViewPaneContainer`），位置由 `ViewContainerLocation`：`Sidebar` / `Panel` / `AuxiliaryBar`。视图还可用 `WindowEnablement`（`Editor` / `Sessions` / `Both`）限制出现在哪种窗口。

启动顺序（`Workbench.startup()`）：

1. `initServices()`：把 `registerSingleton()` 描述符装进 `ServiceCollection`，`IWorkbenchLayoutService` 绑到 `this`
2. `initLayout()` → 贡献表 `start()` → 渲染 parts → `createWorkbenchLayout()` → `layout()`
3. `restore()`：`LifecyclePhase.Ready` → `Restored` → 空闲后 `Eventually`

`WorkbenchPhase`（`BlockStartup` / `BlockRestore` / `AfterRestored` / `Eventually`）控制 `IWorkbenchContribution` 的实例化时机；会挡住首屏编辑器的工作应尽量放到 `Lazy` 或更后的 phase。

## Services vs contrib

- **`services/`**：跨功能的工作台服务。用 `registerSingleton(IFoo, FooImpl, InstantiationType.Delayed)` 注册；**不要**在 `Workbench.initServices()` / `desktop.main` / `web.main` 里手写 `serviceCollection.set`（源码注释反复强调这一点）。
- **`contrib/`**：产品功能。通过 `*.contribution.ts` 注册命令、视图、编辑器 pane、配置、`IWorkbenchContribution`。contrib 可以 **消费** services，但不应把「只有自己用的实现」塞进 `services/`。

按角色抽样（不是完整清单）：

**Services**

| 角色 | 示例目录 |
|------|----------|
| 布局与 chrome | `layout`、`panecomposite`、`views`、`activity`、`title`、`statusbar`、`banner`、`auxiliaryWindow` |
| 编辑器与文档 | `editor`、`textfile`、`untitled`、`workingCopy`、`history`、`model` |
| 扩展 | `extensions`、`extensionManagement`、`extensionRecommendations` |
| 工作区与配置 | `files`、`filesConfiguration`、`workspaces`、`configuration` |
| 命令与 UI 输入 | `commands`、`keybinding`、`quickinput`、`dialogs`、`notification` |
| 宿主与生命周期 | `lifecycle`、`host`、`environment`、`timer`、`telemetry` |
| Chat / Agent（不展开） | `chat`、`agentHost`、`mcp` — 见 [chat](../chat/INDEX.md) |

**Contrib**（`contrib/` 下一目录即一贡献；名称以仓库实列为准）

| 角色 | 示例 |
|------|------|
| 编辑器 / 语言 chrome | `codeEditor`、`comments`、`snippets`、`format`、`folding`、`notebook`、`mergeEditor`、`customEditor` |
| 文件 / 工作区 / SCM | `files`、`search`、`scm`、`git`、`localHistory`、`bulkEdit`、`workspace` |
| 调试 / 测试 / 任务 / 终端 | `debug`、`testing`、`tasks`、`output`、`terminal` |
| 扩展 / 远程 / 同步 | `extensions`、`remote`、`userDataSync`、`userDataProfile`、`authentication`、`mcp` |
| Chat / Agent | `chat`、`inlineChat`、`agentsVoice`、`welcomeAgentSessions` — [chat 模块](../chat/INDEX.md) |
| Webview / Welcome / 无障碍 | `webview`、`webviewPanel`、`welcomeGettingStarted`、`accessibility`、`themes`、`preferences` |

## 贡献规则

来自源码组织约定，写代码时必须遵守：

1. **`contrib/` 外部不得 import `contrib/` 内部。** `browser/`、`services/`、`api/`、其他层都不能伸进某个 contrib 的实现。
2. 每个贡献一个 **`.contribution.ts`** 入口（由 `workbench.*.main.ts` side-import）。
3. 对外 API 收在 **一个 common 文件**（例如 `contrib/files/browser/files.ts` 的 `IExplorerService`）。
4. **跨 contrib 只走该 common API**，禁止深入对方 `browser/` 内部模块。

注册手段：`registerWorkbenchContribution2` / `IWorkbenchContribution`、`EditorExtensions`（EditorPane / EditorFactory）、views / commands / configuration registry。未从入口文件引用的模块不会进包。

## 入口文件

只有被入口引用的代码会加载。共享的加到 `workbench.common.main.ts`；平台特有的加到 desktop / web。

```
workbench.common.main.ts
  ├─ editor/editor.all + api contribution + workbench.contribution
  ├─ browser/parts/*（editor、statusbar、banner、pane composites…）
  ├─ services/*（桌面与 Web 共用实现）
  └─ contrib/*/*.contribution.ts
        │
        ├─ workbench.desktop.main.ts
        │     electron-browser/desktop.main.ts  → DesktopMain → Workbench
        │     桌面 services（native textfile、menubar、shared process…）
        │
        └─ workbench.web.main.ts
              browser/web.main.ts → Workbench
              workbench.web.main.internal.ts → embedder `create`
```

桌面由 `src/vs/code/electron-browser/workbench/workbench.ts` 加载 `workbench.desktop.main.js`；Web 由 `src/vs/code/browser/workbench/workbench.ts` 加载 `workbench.web.main.internal.js`。

## 关键符号（本层）

| 符号 | 位置 |
|------|------|
| `Workbench` | `browser/workbench.ts` |
| `Layout` / `IWorkbenchLayoutService` / `Parts` | `browser/layout.ts`、`services/layout/browser/layoutService.ts` |
| `Part` / `Composite` / `PaneComposite` | `browser/part.ts`、`browser/composite.ts`、`browser/panecomposite.ts` |
| `IEditorService` / `IEditorGroupsService` | `services/editor/common/` |
| `EditorInput` | `common/editor/editorInput.ts` |
| `IWorkbenchContribution` / `WorkbenchPhase` | `common/contributions.ts` |
| `ViewContainerLocation` / `WindowEnablement` | `common/views.ts` |

## 相关文档

- [Workbench 系统概览](../../systems/workbench/overview.md)
- [chat](../chat/INDEX.md) · [workbench-api](../workbench-api/INDEX.md) · [sessions](../sessions/INDEX.md)
- [分层规则](../../architecture/cross-cutting/layers.md)
