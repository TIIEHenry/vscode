---
title: "配套 IDE 设施：files / SCM / terminal / debug"
type: architecture
status: accepted
phase: N/A
updated: 2026-10-02
summary: "Explorer、SCM/git、Terminal、Debug 是配套设施不是 Conversation；Sources Files 挂资源管理器同一棵树且不占活动栏；Changes/Review 仍是 SCM 列表投影；Review 无写操作、审阅进度不入 SCM；Diff 归属 ADR-005 已裁决（默认 Preview，可移对话窗口/底部 Panel，F1–F3 已落）"
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
| **主工作流程** | Conversation（`CONVERSATION_PART` + `contrib/conversation` 透镜；禁止用 `ChatEditor` / Copilot 侧栏冒充） |
| **配套设施** | 导航、文件编辑/预览、终端、Changes、Diff、底 Panel、StatusBar |

`files` / `scm`（+ `git`）/ `terminal` / `debug` 落在第二层。它们走与扩展相同的插入面：`ViewContainer` → Sidebar / Panel / AuxiliaryBar；`EditorPane` + `EditorInput` → `EDITOR_PART`。功能代码 **不 new Part**。

Agents Window 可以复用同一套视图（`WindowEnablement`），**不能**当成品壳。默认 Code 窗口才是 B2 手术对象。

## 2. 默认落点（Sidebar / Panel / Editor）

| 贡献 | 入口 | Sidebar | Panel | Editor |
|------|------|---------|-------|--------|
| **files**（Explorer） | `contrib/files/browser/files.contribution.ts` · `explorerViewlet.ts` | **默认** `ViewContainer`（`isDefault: true`）：Folders 树 + Open Editors | 无自有容器；视图可被用户挪走 | `TextFileEditor` / `BinaryFileEditor` + `FileEditorInput` → 打开文件 |
| **scm** | `contrib/scm/browser/scm.contribution.ts` | Source Control 容器仍注册（Repositories / Changes / Graph，`canMoveView`）；**默认 Code 窗口** `IsSessionsWindowContext` 门闩隐藏 Sidebar Activity；Agents Window 保留 | 习惯上不默认在此；History 等可拖进 Panel | 点变更走 `IEditorService`：单文件 Diff / multi-diff，**在 `EDITOR_PART`** |
| **git** | `contrib/git` 只注册 `IGitService`；UI/provider 在内置扩展 `extensions/git` | 填 scm 容器，不另开 viewlet | 同 scm | 同 scm（git 资源命令打开 Diff 编辑器） |
| **terminal** | `contrib/terminal/browser/terminal.contribution.ts` | 可拖入 | **默认**（`isDefault: true`）`TERMINAL_VIEW_ID` | 可选：`TerminalEditor` + `TerminalEditorInput`（编辑器组里的终端 tab） |
| **debug** | `contrib/debug/browser/debug.contribution.ts` | Run and Debug：Variables / Watch / Call Stack / Breakpoints（**默认 Code 窗口** `IsSessionsWindowContext` 门闩隐藏 Sidebar 容器；Agents Window 保留） | Debug Console（`DEBUG_PANEL_ID` / `REPL_VIEW_ID`） | `DisassemblyView`；源码停在已打开的 `FileEditorInput` |

Activity rail 只切换 Sidebar 容器图标，不是第三套宿主。Auxiliary Bar 今天可被用户或扩展拿去放上述视图；Desktop 合同默认关右缘 rail（`INV-052-NO-RIGHT-RAIL`），S1 不要把这些配套默认打到 `AUXILIARYBAR_PART`。

## 3. 各贡献在本仓做什么

### 3.1 files — 工作区树 + 文件编辑器

`ExplorerViewletViewsContribution` 往 Sidebar 默认容器挂 `ExplorerView`（Folders）与 `OpenEditorsView`。单击/双击经 `IEditorService` 打开 `FileEditorInput`，预览/钉住由 editor 配置决定。

这是 Code 窗口里 **工作区树的事实权威**：树模型在 `explorerModel` / `IExplorerService`，不是 Sources 列表。打开后的缓冲在 `EDITOR_PART`（Desktop 投影为 Preview）。

### 3.2 scm + git — Changes 清单与 Diff 打开习惯

`scm` 拥有 Source Control **容器与 Changes 列表**（`SCMViewPane`，视图名 Changes）。`git` contrib 几乎只有 `IGitService`；真正的 `ISCMProvider`、stage/commit、资源命令在 **`extensions/git`**。两边合起来才是用户看到的 Git SCM。

**默认 Code 窗口**：Sidebar SCM Activity 经 `IsSessionsWindowContext` 门闩隐藏；Changes **清单 + stage/unstage/commit** 落在 End **`SOURCES_PART`** 的 Changes tab（`contrib/sources` / `SourcesChangesList`）。接通且 roster 会话非空时，stage 走 `writeGitStagePaths`、commit 走 `writeGitCommit`；否则走 `git.stage` / `git.commit` / `acceptInputCommand`。unstage 始终是 `git.unstage`。列表权威见 [Sources §4](../sources/overview.md)。Sidebar SCM 容器仍注册，Agents Window 可保留 Activity 图标。

现行习惯（与 Desktop 目标对照见 §5）：

- 默认 Code 窗口：Changes 清单与 Git 操作在 **End Sources tab**；Sidebar SCM 仅 Agents Window 或用户显式恢复
- 点文件级变更：**打开 `EDITOR_PART` 里的 Diff / multi-diff**，不是底栏临时 tab
- 编辑器内 gutter 还有 QuickDiff（`quickDiffWidget`），嵌在文本编辑器里，不是独立深查看面

### 3.3 terminal — 底栏默认座

`ViewContainerLocation.Panel` 且 `isDefault: true`：空窗口第一次开 Panel，常先看到 Terminal。实例可再 `move` 到 Sidebar / AuxiliaryBar，或 `TerminalEditor` 进编辑器组。

Desktop ADR-047：Terminal **可 Pin 在 Bottom Panel**；默认座也曾写在 End 上格，换座只经拖拽/菜单。本仓今天没有 End 格，默认座 = `PANEL_PART`，与「底栏准入 Terminal」同向，与「默认在 Preview」不同向。

### 3.4 debug — 侧栏会话面 + 底栏 REPL

Run and Debug 是 Sidebar 容器；Debug Console 是独立 Panel 容器。断点/当前行画在已打开的文件编辑器上；反汇编才是单独 `EditorPane`。调试是配套运行时设施，时间线工具卡若「打开落到已有 Terminal / File」，应对到这些既有面，**卡本身不是 L1**。

## 4. Sources Files ↔ Navigator Files（映射张力）

Desktop IA §4 把 Navigator Files 写成工作区树、把 Sources Files 写成列表投影。本仓现在的 Files 页和侧栏同一套操作：仍是一份 `IExplorerService` 模型，侧栏 Explorer 留在 `SIDEBAR_PART`，Sources 再挂一个 `ExplorerView`。列表模式只把这一页的树换成当前目录的一级，面包屑和标题操作仍在。打开或新建文件不带动侧栏定位。活动栏不因此多一个图标。

张力：

| 偷换 | 为什么错 |
|------|----------|
| 卸掉侧栏 Explorer，只留 Sources 里的树 | Navigator Files 没有了，活动栏的 Files 容器空掉 |
| 再注册一个可见的视图容器来放这棵树 | 活动栏多一个图标，并且会抢走 `ExplorerService` 的主视图 |
| 用 Open Editors 冒充 Sources Files | Open Editors 是 `EDITOR_PART` 打开集，不是工作区树 |

**现在的挂法：** `SourcesFilesExplorerHost` 在 `#sources-panel-files` 里用 `PaneView` 放 `SourcesFilesExplorer`。侧栏先注册，仍是主视图。Changes / Review 仍是 **SCM 资源列表投影**。**Review 无写操作**：无 stage/commit/Discard；审阅进度为窗口内存 own-data（`ISourcesReviewProgressService`，R1 @ HEAD），**不入** SCM 状态、不参与 commit 门禁；引擎接通后归因 chip（R3）与 Conversation `reviewNav` 行（R4）只导航回 Sources / 对话轨迹。Diff 深查看默认 **EDITOR_PART** Preview；经显式动作可移 Conversation 只读审阅 tab 或 Panel 产品 Diff 视图（§5；F1–F3 已落）。

## 5. Diff 深查看 ↔ Changes 清单（映射张力）

Desktop（IA §4 + ADR-047）：

- **Changes**：Sources **tab** — stage / commit / 扫视清单；**不是**文件级 Diff 深查看，**不是**下格区名
- **Diff 深查看**：路由 **Bottom Panel**（`PANEL_PART`）；默认 transient standard tab；**0× L1 / 不进 Changes 内嵌**（`INV-047-DIFF-OWNER`）

本仓现行习惯：

- Changes **列表 + stage/unstage/commit** = End **`SOURCES_PART`** Changes tab（默认 Code 窗口）；Sidebar scm 容器仍注册，Agents Window 保留 Activity
- Diff **深查看** = End 列 `EDITOR_PART`（Preview），外加编辑器内 QuickDiff

| | Desktop 目标 | 本仓今天 |
|--|--------------|----------|
| Changes 清单 | End Sources tab | End Sources tab（默认 Code 窗口；Sidebar scm 门闩隐藏） |
| 文件级 Diff | `PANEL_PART` 临时 tab | 默认 `EDITOR_PART` Preview Diff（`openSourcesChangeEntry` / `ISCMResource.open()`）；显式动作或 `sources.diff.defaultOwner` 可进 Conversation 只读审阅 tab（`ConversationDiffReviewInput`）或 Panel 产品 Diff 视图（`SourcesDiffPanelView`，重宿主）；`sources.diff.moveToConversation` / `moveToPanel` / `moveToPreview` 三宿主往返（F1–F3 已落） |
| 开 Diff 是否撑开 Sources | 不得自动撑开已收起的下格 | 不自动撑开已收起的 Sources 下格（ADR-047 保留） |

**本仓裁决（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) @2026-09-02，[PRD-009](../../product/requirements.md#prd-009-changes-与-diff) `accepted`）：** 上表「Desktop 目标」列的 `PANEL_PART` 单一归属 **不再是本仓目标**。Diff 默认 Preview（`EDITOR_PART`）；用户显式动作或默认归属设置可把它 **移入 Conversation 延伸 tab（只读审阅 input，围栏白名单第二类）** 或 **移到底部 Panel 产品 Diff 视图（重宿主，不是第三个 EditorPart）**。ADR-047 保留两条：不做 Changes 内嵌 inline diff；开 Diff 不自动撑开已收起的 Sources 下格。QuickDiff 仍留在 File 编辑器作行内提示。实施方案 [sources-changes-diff](../../../dev/plans/sources-changes-diff.md) F1–F3 已落；F4 隔离 profile 冒烟待验。

## 6. 相关文档

- [Workbench 概览](overview.md) · [Parts / Grid](parts-and-grid.md)
- [Desktop 壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)
- [Navigator tab 适配](../../reference/code-oss-b2/navigator-tabs-access.md) — Files 留 Explorer，不搬进 Sources
- [modules/workbench 贡献规则](../../modules/workbench/overview.md)
- 外仓：experience-principles §2 · IA §4 · ADR-047 · ADR-051
