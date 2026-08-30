---
title: "配套 IDE 设施：files / SCM / terminal / debug"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "Explorer、SCM/git、Terminal、Debug 是配套设施不是 Conversation；默认落点与 Desktop Sources/Diff 映射张力"
---

# 配套 IDE 设施：files / SCM / terminal / debug

> 导航：[系统索引](INDEX.md)。布局契约：[overview](overview.md) · [parts-and-grid](parts-and-grid.md)。  
> 产品语义：外仓 [experience-principles §2](../../../../UniverseAgentDesktop/docs/product/experience-principles.md)（配套按完整 IDE 配齐；主流程在 Conversation）。  
> IA Surface：[information-architecture §4](../../../../UniverseAgentDesktop/docs/product/information-architecture.md)。壳投影：[desktop-shell-mapping](../../reference/code-oss-b2/desktop-shell-mapping.md)。

本页只写四块 **companion** 贡献：它们实现「完整 IDE」里用户仍要摸到的导航、变更、终端与调试，**不是**对话主流程，也 **不得** 被 Chat 视图或 `ChatEditor` 偷换成 Conversation。B2 改拓扑时它们留下；搬的是宿主 Part，不是删功能。

不枚举 `contrib/` 全表。Chat / search / output 等另文。

## 1. 产品位置：配套，不是 Conversation

experience-principles §2 把产品拆成两层合同：

| 层 | 本仓对应 |
|----|----------|
| **主工作流程** | Conversation（今天无 Part；禁止用 `ChatEditor` / Copilot 侧栏冒充） |
| **配套设施** | 导航、文件编辑/预览、终端、Changes、Diff、底 Panel、StatusBar |

`files` / `scm`（+ `git`）/ `terminal` / `debug` 落在第二层。它们走与扩展相同的插入面：`ViewContainer` → Sidebar / Panel / AuxiliaryBar；`EditorPane` + `EditorInput` → `EDITOR_PART`。功能代码 **不 new Part**。

Agents Window 可以复用同一套视图（`WindowEnablement`），**不能**当成品壳。默认 Code 窗口才是 B2 手术对象。

## 2. 默认落点（Sidebar / Panel / Editor）

| 贡献 | 入口 | Sidebar | Panel | Editor |
|------|------|---------|-------|--------|
| **files**（Explorer） | `contrib/files/browser/files.contribution.ts` · `explorerViewlet.ts` | **默认** `ViewContainer`（`isDefault: true`）：Folders 树 + Open Editors | 无自有容器；视图可被用户挪走 | `TextFileEditor` / `BinaryFileEditor` + `FileEditorInput` → 打开文件 |
| **scm** | `contrib/scm/browser/scm.contribution.ts` | **默认** Source Control：Repositories / Changes / Graph（`canMoveView`） | 习惯上不默认在此；History 等可拖进 Panel | 点变更走 `IEditorService`：单文件 Diff / multi-diff，**在 `EDITOR_PART`** |
| **git** | `contrib/git` 只注册 `IGitService`；UI/provider 在内置扩展 `extensions/git` | 填 scm 容器，不另开 viewlet | 同 scm | 同 scm（git 资源命令打开 Diff 编辑器） |
| **terminal** | `contrib/terminal/browser/terminal.contribution.ts` | 可拖入 | **默认**（`isDefault: true`）`TERMINAL_VIEW_ID` | 可选：`TerminalEditor` + `TerminalEditorInput`（编辑器组里的终端 tab） |
| **debug** | `contrib/debug/browser/debug.contribution.ts` | Run and Debug：Variables / Watch / Call Stack / Breakpoints | Debug Console（`DEBUG_PANEL_ID` / `REPL_VIEW_ID`） | `DisassemblyView`；源码停在已打开的 `FileEditorInput` |

Activity rail 只切换 Sidebar 容器图标，不是第三套宿主。Auxiliary Bar 今天可被用户或扩展拿去放上述视图；Desktop 合同默认关右缘 rail（`INV-052-NO-RIGHT-RAIL`），S1 不要把这些配套默认打到 `AUXILIARYBAR_PART`。

## 3. 各贡献在本仓做什么

### 3.1 files — 工作区树 + 文件编辑器

`ExplorerViewletViewsContribution` 往 Sidebar 默认容器挂 `ExplorerView`（Folders）与 `OpenEditorsView`。单击/双击经 `IEditorService` 打开 `FileEditorInput`，预览/钉住由 editor 配置决定。

这是 Code 窗口里 **工作区树的事实权威**：树模型在 `explorerModel` / `IExplorerService`，不是 Sources 列表。打开后的缓冲在 `EDITOR_PART`（Desktop 投影为 Preview）。

### 3.2 scm + git — Changes 清单与 Diff 打开习惯

`scm` 拥有 Source Control **容器与 Changes 列表**（`SCMViewPane`，视图名 Changes）。`git` contrib 几乎只有 `IGitService`；真正的 `ISCMProvider`、stage/commit、资源命令在 **`extensions/git`**。两边合起来才是用户看到的 Git SCM。

现行习惯（与 Desktop 目标对照见 §5）：

- 清单住在 **Sidebar**（可整容器或单视图挪到 Panel）
- 点文件级变更：**打开 `EDITOR_PART` 里的 Diff / multi-diff**，不是底栏临时 tab
- 编辑器内 gutter 还有 QuickDiff（`quickDiffWidget`），嵌在文本编辑器里，不是独立深查看面

### 3.3 terminal — 底栏默认座

`ViewContainerLocation.Panel` 且 `isDefault: true`：空窗口第一次开 Panel，常先看到 Terminal。实例可再 `move` 到 Sidebar / AuxiliaryBar，或 `TerminalEditor` 进编辑器组。

Desktop ADR-047：Terminal **可 Pin 在 Bottom Panel**；默认座也曾写在 End 上格，换座只经拖拽/菜单。本仓今天没有 End 格，默认座 = `PANEL_PART`，与「底栏准入 Terminal」同向，与「默认在 Preview」不同向。

### 3.4 debug — 侧栏会话面 + 底栏 REPL

Run and Debug 是 Sidebar 容器；Debug Console 是独立 Panel 容器。断点/当前行画在已打开的文件编辑器上；反汇编才是单独 `EditorPane`。调试是配套运行时设施，时间线工具卡若「打开落到已有 Terminal / File」，应对到这些既有面，**卡本身不是 L1**。

## 4. Sources Files ↔ Navigator Files（映射张力）

Desktop IA §4：

- **Navigator Files**：工作区树权威
- **Sources Files**：End **列表**投影，不是第二棵权威树

本仓只有一棵树：`contrib/files` 的 Explorer，默认在 `SIDEBAR_PART`。壳映射里 Sidebar ≙ Navigator body，因此 **把 Explorer 留在 Sidebar = 对齐 Navigator Files 权威**。

张力：

| 偷换 | 为什么错 |
|------|----------|
| 把 `ExplorerView` 整棵搬进 End Sources | Sources Files 应是列表投影；树权威离开 Navigator |
| 在 Sources 再挂一棵同步树当「第二 Explorer」 | 双权威；与 IA「权威仍在 Navigator Files」冲突 |
| 用 Open Editors 冒充 Sources Files | Open Editors 是 `EDITOR_PART` 打开集，不是工作区投影 |

S1 合法路径：树继续由 Sidebar Explorer 拥有；若 End 需要 Files tab，做 **只读/点击打开** 的列表投影，打开目标仍是 Preview（`EDITOR_PART`），不复制 `IExplorerService` 真相。

`desktop-shell-mapping`：Sources 今日无独立格，SCM/Changes 常在 Sidebar 或 Panel。占位 Part 解决的是 **槽**，不是把 Explorer 或 SCM 树塞进下格就算 Files。

## 5. Diff 深查看 ↔ Changes 清单（映射张力）

Desktop（IA §4 + ADR-047）：

- **Changes**：Sources **tab** — stage / commit / 扫视清单；**不是**文件级 Diff 深查看，**不是**下格区名
- **Diff 深查看**：路由 **Bottom Panel**（`PANEL_PART`）；默认 transient standard tab；**0× L1 / 不进 Changes 内嵌**（`INV-047-DIFF-OWNER`）

本仓现行习惯：

- Changes **列表** = scm Sidebar（或用户拖到 Panel）
- Diff **深查看** = End 列 `EDITOR_PART`（Preview），外加编辑器内 QuickDiff

| | Desktop 目标 | 本仓今天 |
|--|--------------|----------|
| Changes 清单 | End Sources tab | Sidebar scm |
| 文件级 Diff | `PANEL_PART` 临时 tab | `EDITOR_PART` Diff 编辑器 |
| 开 Diff 是否撑开 Sources | 不得自动撑开已收起的下格 | 无下格；打开 Diff 占用中心编辑器 |

B2 不要把「SCM 已能出 Diff」读成 ADR-047 已满足：出 Diff 的 **槽错了**。Preview 继续承载 File 编辑；Diff 要从 editor 习惯改绑到底栏，才与「Diff 不进 L1、不进 Changes」一致。QuickDiff 可留在 File 编辑器作行内提示，不能替代 Panel 深查看。

## 6. 相关文档

- [Workbench 概览](overview.md) · [Parts / Grid](parts-and-grid.md)
- [Desktop 壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)
- [modules/workbench 贡献规则](../../modules/workbench/overview.md)
- 外仓：experience-principles §2 · IA §4 · ADR-047 · ADR-051
