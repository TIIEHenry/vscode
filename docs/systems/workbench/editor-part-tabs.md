---
title: "EditorPart：组、Tabs、EditorInput"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "EditorPart = EditorGroup + 原生 tabs + EditorInput；打开走 IEditorService。B2 保留同一 Part 挪到 End Preview，与 Desktop File tabs 同构；ChatEditorInput 仍是 EditorInput（INV-TOPO）；多组/分屏与 IA「不是第二 Editor Group」的张力"
---

# EditorPart：组、Tabs、EditorInput

> 导航：[系统索引](INDEX.md)。Part 级网格与显隐见 [parts-and-grid](parts-and-grid.md)。Monaco 托管链见 [editor 概览](../editor/overview.md)。B2 对照：[壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)。  
> Chat 宿主与 INV-TOPO 细节不在本页展开，见 [agent-ui](../chat/agent-ui.md)。  
> 实现：`src/vs/workbench/browser/parts/editor/`（`editorPart.ts`、`editorParts.ts`、`editorGroupView.ts`、`editorTitleControl.ts`、`editorTabsControl.ts`、`multiEditorTabsControl.ts`）。  
> 服务：`src/vs/workbench/services/editor/common/editorService.ts`（`IEditorService`）· `editorGroupsService.ts`（`IEditorGroupsService`）。

本页只写 **默认 Code 窗口**里 `Parts.EDITOR_PART` 的内部模型：组、标签、输入。不写 Layout 如何把 Part 摆进 grid（那是 [parts-and-grid](parts-and-grid.md)）。

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
- 目标组 `PreferredGroup`：`ACTIVE_GROUP`（`-1`）、`SIDE_GROUP`（`-2`）、`AUX_WINDOW_GROUP`（`-3`）、`MODAL_GROUP`（`-4`），或具体 `IEditorGroup` / `GroupIdentifier`
- `IEditorResolverService` 按资源 / `workbench.editorAssociations` 选 pane（默认文本 → `TextFileEditor` + `FileEditorInput`）

`IEditorGroupsService` 管 **组几何**：`addGroup`（从某组向四向切开）、`merge`、`applyLayout`、`sideGroup`。组就绪用 `whenReady` / `whenRestored`。组模型变化经 `IEditorGroup.onDidModelChange`；跨组聚合事件在 `IEditorService.onDidEditorsChange`。

一次打开（与 [editor 概览](../editor/overview.md) 对齐，此处只钉 chrome）：

1. 调用方 `IEditorService.openEditor`。
2. Resolver 选出 pane + 必要时构造 `EditorInput`。
3. 目标 `EditorGroupView` 写入 `EditorGroupModel`，tabs 出现一枚标签。
4. `EditorPanes` `setInput`；文本 pane 再拿 `ITextModel` 交给 `CodeEditorWidget`。

**推论：** 凡是 `EditorInput`，打开后一定落在某 `EditorGroup` 的 tab 栈里。没有第三条「打开到 Conversation」的插入面。

## 3. 与 Desktop Preview File tabs 同构

Desktop IA 的 Preview 是 **File tabs**：打开文件、切 tab、关 tab、脏态。本仓对应物就是本节的三件套，不是另写一套标签栏。

[壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) 的合法同构：

> Preview ⇄ `EDITOR_PART` + 原生 tabs + `IEditorService`

B2 S1 **保留 `EditorPart`，只挪位**：从默认 grid 的中心叶，搬到 Workbench End 上格。文件仍走 `IEditorService.openEditor`，仍出现在同一套 tabs 上。spike 最小证明也要求：中心换成新 Part 之后，文件 URI 出现在 **End 列 tabs**，且不是 `ChatEditorInput`。

因此：

- **不要**为 Preview 新造 tab 控件或第二套 open API。
- **不要**把 Preview 换成 ViewContainer / Custom Editor 外壳。
- 显隐仍是整颗 `EDITOR_PART`（`setEditorHidden`）；约束见 [parts-and-grid](parts-and-grid.md) §4，本页不重复。

## 4. INV-TOPO：ChatEditorInput 仍是 EditorInput

`ChatEditorInput`（`contrib/chat/.../chatEditorInput.ts`）`extends EditorInput`。打开路径与文件相同：`IEditorService` → 某 `EditorGroup` → 一枚 editor tab。

INV-TOPO 禁止的是：**把 Conversation 做成 editor pane / Custom Editor / 普通 EditorGroup tab**。框架插入面锁死了这件事——任何 `EditorInput` 都进 End 列 `EDITOR_PART` 的 tab 模型，**不能**占中心 `CONVERSATION_PART`。S0 因此拒绝 `ChatEditor` 当 Conversation。

本页只钉这条拓扑事实。宿主清单、Copilot 边界、Sessions Part 对照见 [agent-ui](../chat/agent-ui.md)，此处不改写。

## 5. 多组 / 分屏 vs IA「不是第二 Editor Group」

本仓 `EditorPart` **一等支持多组**：`SIDE_GROUP`、`addGroup(location, GroupDirection)`、拖拽拆分、`applyLayout`。一组一张 tabs + 一张激活 pane；两组并排 = 两套 tabs。这是 VS Code 的分屏，**全部发生在同一 `EDITOR_PART` 内部**，不是第二颗 Part。

Desktop IA 的 Preview 是 **一块 File tabs 面**，不是「Conversation 旁边再开一个 Editor Group」。Conversation 是独立中心 Part；Sources 是 End 下格（占位 Part 或临时映射），**都不是** `addGroup` 切出来的第二组。壳映射把「中心继续 `EDITOR_PART`、Conversation 用 `ChatEditor`」标成选项 C，正是因为那会把对话做成 **又一个 editor group / tab**。

张力（知识层只陈述，不在此拍板）：

| | 本仓默认 | Desktop IA |
|--|----------|------------|
| Preview / 文件 | `EDITOR_PART` 内可 N 组、可 split | 一块 File tabs；**不是**相对 Conversation 的「第二 Editor Group」 |
| Conversation | 无独立 Part；若走 `ChatEditorInput` 就变成又一组/又一张 tab | 新 Part，禁止 editor tab |
| Sources | 无独立格；SCM 常在 Sidebar/Panel | End 下格，也不是 editor group |

S1 挪位后，`SIDE_GROUP` 与组内 split **仍然合法地发生在 End 上格 Preview 内部**。那是 Preview 自己的分屏，不是把 Conversation 或 Sources 做成第二组。产品是否收敛「Preview 只保留单组」是 IA/体验问题；框架今天没有禁多组的开关可当合同。

辅助窗（`AUX_WINDOW_GROUP`）同样是配套 `EditorPart`，不要当成第二 Conversation。

## 6. 相关文档

- [Parts / Grid](parts-and-grid.md) · [Workbench 概览](overview.md) · [Editor 系统](../editor/overview.md)
- [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) · [T1–T3](../../reference/code-oss-b2/spike-t1-t3-code-facts.md)
- [agent-ui](../chat/agent-ui.md)（INV-TOPO / ChatEditor 宿主）
