---
title: "EditorPart：组、Tabs、EditorInput"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-27
summary: "主 EDITOR_PART = Preview 组+tabs；ChatEditorInput 仍禁止当 Conversation；Conversation 嵌套 IEditorPart 为第四插入面（PRD-016 S1–S6 已落）；Preview 类别隔离（Code/Artifacts/Planning）见 ADR-009 / PRD-027"
---

# EditorPart：组、Tabs、EditorInput

> 导航：[系统索引](INDEX.md)。Part 级网格与显隐见 [parts-and-grid](parts-and-grid.md)。Monaco 托管链见 [editor 概览](../editor/overview.md)。B2 对照：[壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)。  
> Chat 宿主与 INV-TOPO 细节不在本页展开，见 [agent-ui](../chat/agent-ui.md)。  
> 实现：`src/vs/workbench/browser/parts/editor/`（`editorPart.ts`、`editorParts.ts`、`editorGroupView.ts`、`editorTitleControl.ts`、`editorTabsControl.ts`、`multiEditorTabsControl.ts`）。  
> 服务：`src/vs/workbench/services/editor/common/editorService.ts`（`IEditorService`）· `editorGroupsService.ts`（`IEditorGroupsService`）。

本页只写 **默认 Code 窗口**里 `Parts.EDITOR_PART`（Preview）的内部模型：组、标签、输入。不写 Layout 如何把 Part 摆进 grid（那是 [parts-and-grid](parts-and-grid.md)）。Conversation 内嵌的第四类 `IEditorPart` 见 [ADR-002](../../../dev/decisions/002-conversation-session-windows.md)，**不是**本页的 MainEditorPart。

## 1. EditorPart 是什么

`EditorPart`（`editorPart.ts`）是 `Parts.EDITOR_PART` 的 IView。它 **不是** Monaco widget，也不是单张 pane。它是一张 **组网格**：

```text
EDITOR_PART（MainEditorPart / 辅助窗 AuxiliaryEditorPart / 模态 ModalEditorPart）
└── SerializableGrid<EditorGroupView>
    └── EditorGroupView
        ├── EditorTitleControl → IEditorTabsControl（tabs）
        ├── EditorPanes → 当前激活的 EditorPane
        └── EditorGroupModel → 该组打开的 EditorInput 栈
```

三件套：

| 层 | 对象 | 职责 |
|----|------|------|
| 组 | `EditorGroupView` + `IEditorGroup` | 一个可见格子：激活、锁定、打开/关闭、组内顺序 |
| Tabs | `EditorTitleControl` → `MultiEditorTabsControl` 等 | 把组内 `EditorInput` 画成标签；`showTabs` 可选 `multiple` / `single` / `none` |
| 输入 | `EditorInput` | 可打开物（文件、untitled、diff、自定义编辑器…）。**不是** `ITextModel` |

`EditorParts`（`editorParts.ts`）实现 `IEditorGroupsService`：跨主窗 / 辅助窗 / 模态 overlay 的多 Part 容器。`MainEditorPart` 绑 `Parts.EDITOR_PART`。辅助窗复用同一套组+tabs 模型，不是第二套打开 API。

`EditorInput` 的类注释写明：轻量对象，交给 workbench API **在 editor part 里打开**；再由 pane registry 映射到能打开它的 `EditorPane`。

## 2. 打开入口：IEditorService

编码约定：**打开走 `IEditorService.openEditor`**，不要直接 `IEditorGroupsService.activeGroup.openEditor`，以免跳过 `revealIfOpened`、`preserveFocus` 等策略。

`IEditorService`（`editorService.ts`）：

- 入参：资源（untyped）或已有 `EditorInput`
- 目标组 `PreferredGroup`：`ACTIVE_GROUP`（`-1`）、`SIDE_GROUP`（`-2`）、`AUX_WINDOW_GROUP`（`-3`）、`MODAL_GROUP`（`-4`），或具体 `IEditorGroup` / `GroupIdentifier`；以及 `CONVERSATION_GROUP`（`-5`）、`CONVERSATION_SIDE_GROUP`（`-6`）（`editorService.ts`；围栏在 `editorGroupFinder.ts`）。
- `IEditorResolverService` 按资源 / `workbench.editorAssociations` 选 pane（默认文本 → `TextFileEditor` + `FileEditorInput`）

`IEditorGroupsService` 管 **组几何**：`addGroup`（从某组向四向切开）、`merge`、`applyLayout`、`sideGroup`。组就绪用 `whenReady` / `whenRestored`。组模型变化经 `IEditorGroup.onDidModelChange`；跨组聚合事件在 `IEditorService.onDidEditorsChange`。

一次打开（与 [editor 概览](../editor/overview.md) 对齐，此处只钉 chrome）：

1. 调用方 `IEditorService.openEditor`。
2. Resolver 选出 pane + 必要时构造 `EditorInput`。
3. 目标 `EditorGroupView` 写入 `EditorGroupModel`，tabs 出现一枚标签。
4. `EditorPanes` `setInput`；文本 pane 再拿 `ITextModel` 交给 `CodeEditorWidget`。

**推论：** 文件 / untitled / `ChatEditorInput` 打开后落在 **主** `EDITOR_PART` 某组的 tab 栈。Conversation 第四面已落：`ConversationChatInput` 与围栏白名单第二类 `ConversationDiffReviewInput`（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) / [sources-changes-diff](../../../dev/plans/sources-changes-diff.md) F1 已落）经 `CONVERSATION_GROUP` / `CONVERSATION_SIDE_GROUP` 或具体 Conversation 组进入嵌套 `ConversationEditorPartImpl`。围栏：未点名 Conversation 组时，即使焦点在 Conversation 区域，文件 / untitled / `ChatEditorInput` 仍进 Preview；`ConversationChatInput` / `ConversationDiffReviewInput` 无点名则拒绝（不静默掉进 Preview）。审阅 input 只读、经 `isConversationExtensionTab` 纳入「关非根」/`closeChildOnBack`/`showTabs` 计数，与 fork 延伸 tab 同姿态。

## 3. 与 Desktop Preview File tabs 同构

Desktop IA 的 Preview 是 **File tabs**：打开文件、切 tab、关 tab、脏态。本仓对应物就是本节的三件套，不是另写一套标签栏。

[壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) 的合法同构：

> Preview ⇄ `EDITOR_PART` + 原生 tabs + `IEditorService`

B2 S1 **保留 `EditorPart`，只挪位**：从默认 grid 的中心叶，搬到 Workbench End 上格。文件仍走 `IEditorService.openEditor`，仍出现在同一套 tabs 上。spike 最小证明也要求：中心换成新 Part 之后，文件 URI 出现在 **End 列 tabs**，且不是 `ChatEditorInput`。

因此：

- **不要**为 Preview 新造 tab 控件或第二套 open API。
- **不要**把 Preview 换成 ViewContainer / Custom Editor 外壳。
- 显隐仍是整颗 `EDITOR_PART`（`setEditorHidden`）；约束见 [parts-and-grid](parts-and-grid.md) §4，本页不重复。

## 4. INV-TOPO：ChatEditorInput 仍禁止当 Conversation

`ChatEditorInput`（`contrib/chat/.../chatEditorInput.ts`）`extends EditorInput`。打开路径与文件相同：`IEditorService` → 某 `EditorGroup` → 一枚 **Preview** editor tab。默认窗不为它注册 resolver（M5）。

INV-TOPO **仍然禁止**：

- 把 Layout 中心叶改成 `Parts.EDITOR_PART`；
- 用 `ChatEditor` / Custom Editor / 主 `EDITOR_PART` 的普通组当产品 Conversation。

INV-TOPO **不再禁止**（[ADR-002](../../../dev/decisions/002-conversation-session-windows.md) / [PRD-016](../../product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)）：在 `CONVERSATION_PART` **内部**挂独立 Conversation `IEditorPart`（`ConversationEditorPartImpl`），用 `ConversationChatInput` + `ConversationEditorPane` 画 chat tab，以及经显式动作带入的只读 `ConversationDiffReviewInput` 延伸 tab（[PRD-009](../../product/requirements.md#prd-009-changes-与-diff) F1 已落）。这不是把中心变成 Preview。**已落**（S1–S6；Diff 审阅 tab F1）。

**聚合豁免（已落，S1a）：** 嵌套 part 注册进 `IEditorGroupsService.parts` 只为复用组 / tab / pane 机制，**不参与面向用户的全局 editor 语义**。`ConversationEditorPartImpl.excludeFromGlobalEditorAggregation = true`；`EditorParts` 经 `isExcludedFromGlobalEditorAggregation` 过滤：`getGroups` / `activePart` MRU / `findGroup` FIRST-LAST / `applyState` 跳过 Conversation part；`getScopedInstantiationService` **按 part 索引**（共享主窗 `windowId` 的多 Conversation part 各得独立 scoped `IEditorService`）。Conversation 自有导航栈与 `IHistoryService` 隔离（S2）。合同见 [conversation-session-windows](../../../dev/plans/conversation-session-windows.md) §3.8。

宿主清单、Copilot 边界、Sessions Part 对照见 [agent-ui](../chat/agent-ui.md)，此处不改写。

## 5. 多组 / 分屏 vs IA「不是第二 Editor Group」

本仓 `EditorPart` **一等支持多组**：`SIDE_GROUP`、`addGroup(location, GroupDirection)`、拖拽拆分、`applyLayout`。一组一张 tabs + 一张激活 pane；两组并排 = 两套 tabs。这是 VS Code 的分屏，**全部发生在同一 `EDITOR_PART` 内部**，不是第二颗 Part。

Desktop IA 的 Preview 是 **一块 File tabs 面**，不是「Conversation 旁边再开一个 Editor Group」。Conversation 是独立中心 Part；Sources 是 End 下格（占位 Part 或临时映射），**都不是** `addGroup` 切出来的第二组。壳映射把「中心继续 `EDITOR_PART`、Conversation 用 `ChatEditor`」标成选项 C，正是因为那会把对话做成 **又一个 editor group / tab**。

张力（知识层只陈述，不在此拍板）：

| | 本仓默认 | Desktop IA |
|--|----------|------------|
| Preview / 文件 | `EDITOR_PART` 内可 N 组、可 split | 一块 File tabs；**不是**相对 Conversation 的「第二 Editor Group」 |
| Conversation | Part 内嵌 Conversation `IEditorPart` 画 chat tab（`ConversationChatInput`，非 `ChatEditorInput`）；最多两叶 session 窗口并列 | 新 Part，禁止用 Preview ChatEditor 当对话 |
| Sources | 无独立格；SCM 常在 Sidebar/Panel | End 下格，也不是 editor group |

M0 把 `EDITOR_PART` 挪到 End 后，文件的 `SIDE_GROUP` 与组内 split **仍然只发生在 End 上格 Preview 内部**。Conversation 内 split 走 `CONVERSATION_SIDE_GROUP`（**已落**，S4）；藏列 = `ConversationEditorPartImpl.setGroupHidden`（模型保留），不是 Preview `SIDE_GROUP`。

辅助窗（`AUX_WINDOW_GROUP`）同样是配套 `EditorPart`，不要当成第二 Conversation。

## 6. Preview 类别隔离（Scoped L1 Categories）与制品宿主

为贯彻「用分类避免混乱」的原则并防范后续 `Canvas`（ADR-309 制品）、`Planning`（任务看板）与 `Project Context`（规则与记忆）接入时对代码 Tab 的污染，[ADR-009](../../../dev/decisions/009-preview-category-isolation.md) 与 [PRD-027](../../product/requirements.md#prd-027-preview-类别隔离与-surface-宿主) 裁决在 Preview（`Parts.EDITOR_PART`）内部引入受控类别隔离：

1. **三大类目划分**：
   - **`Code`（默认）**：文本、代码文件、Preview Diff。
   - **`Artifacts`**：Canvas 画板、React 交互制品、富媒体组件。
   - **`Planning`**：任务看板、Todo、架构记忆概览。
2. **呈现与切换**：Preview 标题栏顶部增加轻量级切换条（`[ Code | Artifacts | Planning ]`），各类别拥有独立 EditorGroup / 视图上下文，切换时不互相污染、不丢失光标与打开状态。
3. **路由围栏**：代码类 Input 只能进 `Code` 组；制品类 Input 强制路由至 `Artifacts` 组，严禁非代码 Tab 混入代码标签栏。

## 8. PC 桌面端交互模型与按压零形变规范（Desktop Tactile & Zero Misalignment）

遵循 [UI 设计原则与规范 §2 原则七](../../architecture/cross-cutting/ui-design-principles.md#原则七pc-桌面端按压零形变与-ui-错位治理desktop-tactile--zero-layout-shift)：
- **PC 端交互模型界定**：PC 桌面端依托高精度光标点选，所有交互元素（标签页 Tab、关闭按钮、面包屑 Breadcrumb、类别切换项）在按压（`:active`）时绝对不需要、且严禁使用任何 `transform: scale(...)` 缩放效果。
- **主要修复 UI 错位视觉问题**：
  1. 彻底根除标签页切换与拖拽时的亚像素边缘模糊与文字抗锯齿漂移（Subpixel Blur）；
  2. 保持标签栏与操作图标的绝对几何稳定，杜绝按压瞬间造成的相邻标签位置抖动或关闭图标与标题中心线错位（1px 垂直偏离）；
  3. 杜绝快速连击关闭标签时的点击热区边缘缩入导致误关相邻 Tab；
  4. 保持多标签页在包裹与水平滚动时的像素网格严密对齐。
- **信息密度与触感反馈**：标签关闭按钮统一显式声明 `box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;`，`:active` 采用背景着色（`var(--vscode-toolbar-activeBackground)`），确保桌面 IDE 高密度排版下的清脆反馈与几何稳定。

## 9. 相关文档

- [ADR-009 Preview 类别隔离与 Surface 宿主决策](../../../dev/decisions/009-preview-category-isolation.md) · [PRD-027](../../product/requirements.md#prd-027-preview-类别隔离与-surface-宿主)
- [实施方案 preview-category-isolation](../../../dev/plans/preview-category-isolation.md)


- [Parts / Grid](parts-and-grid.md) · [Workbench 概览](overview.md) · [Editor 系统](../editor/overview.md)
- [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) · [T1–T3](../../reference/code-oss-b2/spike-t1-t3-code-facts.md)
- [agent-ui](../chat/agent-ui.md)（INV-TOPO / ChatEditor 宿主）
