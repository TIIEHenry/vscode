---
title: "Editor 系统概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "Monaco widget 如何被 workbench 托管，以及文本服务与扩展语言特征如何接到 editor 层"
---

# Editor 系统概览

> 导航见 [INDEX](INDEX.md)。editor **单层**目录与类型见 [modules/editor](../../modules/editor/overview.md)。宿主 chrome 见 [modules/workbench](../../modules/workbench/INDEX.md)。扩展契约见 [systems/extension-api](../extension-api/INDEX.md)。

Workbench 不重新实现文本编辑器。它导入 `editor.all.ts`，用 `CodeEditorWidget` 画文本，自己负责 **谁打开、在哪个组、哪个 pane、如何解析 URI、如何保存**。扩展不直接碰 widget：文档与可见编辑器经 `workbench/api` 镜像到 Extension Host；`vscode.languages.*` 经 RPC 写入 `ILanguageFeaturesService`。

## 加载

`workbench.common.main.ts` 在 workbench 自身之前先：

```ts
import '../editor/editor.all.js';
```

于是 `CodeEditorWidget`、core commands、全部 editor contrib 进入共享依赖图。同一文件还 `registerSingleton` 若干 editor 接口的 **workbench 侧**实现（如 `IMarkerDecorationsService`、`ITextResourceConfigurationService`），并把 `OpenerService`（`editor/browser/services/openerService.ts`）绑到 `IOpenerService`。

独立 Monaco **不**走这条路径：`editor.main.ts` + `StandaloneServices`。两者共用 `common/` / `browser/` / `contrib/`，本层始终没有 `node/`、`electron-*` 生产代码。

## 两套「编辑器」一词

| 词 | 层 | 是什么 |
|----|----|--------|
| `IEditor` / `ICodeEditor` / `IDiffEditor` | editor | Monaco 控件 |
| `EditorPane` / `IEditorPane` | workbench | 组里的一张 pane：对某种 `EditorInput` 负责；生命周期由 workbench 管 |
| `EditorInput` | workbench | 可打开的输入（文件、untitled、diff…），不是 `ITextModel` |

文本 pane 内部再持有 `CodeEditorWidget`。非文本 pane（binary、webview、自定义编辑器）可以完全不用 Monaco。

## Workbench 如何托管 Monaco

宿主链（从外到内）：

1. **`EditorPart` / `EditorParts`**（`workbench/browser/parts/editor/`）  
   工作台 `Parts.EDITOR_PART`。用 `SerializableGrid` 排 `EditorGroupView`。
2. **`IEditorGroupsService` / `EditorGroupView`**  
   组：标签、激活、打开/关闭。打开目标可以是 `ACTIVE_GROUP`、`SIDE_GROUP`、`AUX_WINDOW_GROUP`、`MODAL_GROUP`（`IEditorService` 常量）。
3. **`EditorPane`**  
   基类注释给出的生命周期：`createEditor` → `setEditorVisible` → `layout` → `setInput` → `focus` → `dispose`（组关闭时）。运行中会反复 `clearInput` / `layout` / `focus`，但 `create` / `dispose` 各一次。
4. **`AbstractTextEditor` → `AbstractTextCodeEditor`**  
   `createEditorControl()` 里：

   ```ts
   this.editorControl = this.instantiationService.createInstance(
     CodeEditorWidget, parent, initialOptions, this.getCodeEditorWidgetOptions()
   );
   ```

   `getControl()` 返回 `ICodeEditor`。view state 用 `editorControl.saveViewState()`，且要求 `model.uri` 与资源一致。
5. **具体 pane**  
   - `TextFileEditor`（`contrib/files`）：`FileEditorInput`，经 `IEditorPaneRegistry.registerEditorPane` 注册。  
   - `TextResourceEditor`：untitled / 资源输入。  
   - `textDiffEditor.ts`：diff pane，内部是 `IDiffEditor`。

`IEditorResolverService` 按资源 / 设置（`workbench.editorAssociations` 等）决定用哪个 viewType。`IEditorService.openEditor` 是打开入口；编码约定要求走它，而不是 `IEditorGroupsService.activeGroup.openEditor`，以免跳过 `revealIfOpened`、`preserveFocus` 等。

## 服务如何接上 editor 接口

Editor 层定义接口；IDE 里由 workbench services **覆盖或补全**：

| 接口（editor） | Workbench 实现 | 协作点 |
|----------------|----------------|--------|
| `ICodeEditorService` | `workbench/services/editor/browser/codeEditorService.ts` 的 `CodeEditorService` | `getActiveCodeEditor()` 读 `IEditorService.activeTextEditorControl`（code / diff 的 modified / composite）。`openCodeEditor` 注册 handler，最终 `IEditorService.openEditor` |
| `IModelService` | `WorkbenchModelService`（extends `ModelService`） | 默认 URI scheme 也保留 undo/redo 元素 |
| `ITextModelService` | `TextModelResolverService` | `createModelReference(uri)`：`untitled` → `ITextFileService.untitled`；有 file provider → `textFileService.files.resolve`；否则 `ITextModelContentProvider`（scheme） |
| `ILanguageService` | `WorkbenchLanguageService`（Eager） | `ExtensionsRegistry` 的 `languages` 扩展点 + `files.associations` |
| `ILanguageFeaturesService` | **仍用 editor 的 `LanguageFeaturesService`** | 扩展经 Main 线程 `register` 进同一张表；editor contrib（hover、suggest…）只消费 registry |

`ITextFileService` / `TextFileEditorModel` 在 workbench，不在 editor。它们持有或创建 `ITextModel`，负责脏状态、编码、保存。Editor 层不知道文件系统。

## 扩展如何接到编辑器

实现落在 `src/vs/workbench/api/`，系统说明见 [extension-api](../extension-api/INDEX.md)。与 editor 相关的主路径：

**文档与可见编辑器**

- `MainThreadDocumentsAndEditors` 监听 `IModelService`、`ICodeEditorService`、`IEditorService` / `IEditorGroupsService`。
- 算出 `IDocumentsAndEditorsDelta`（增删 `ITextModel`、增删带模型的 `IActiveCodeEditor`、当前激活编辑器），发给 `ExtHostDocumentsAndEditors`。
- 每个可见 code editor 包成 `MainThreadTextEditor`（`mainThreadEditor.ts`）：把 selection / options / visible ranges 从 `ICodeEditor` 读出，扩展侧的编辑、snippet、reveal 再打回 widget。
- `shouldSynchronizeModel`（`editor/common/model.ts`）决定模型是否同步到 Ext Host。

**语言特征**

- 扩展调用 `vscode.languages.registerHoverProvider` 等（`extHost.api.impl.ts` → `ExtHostLanguageFeatures`）。
- 协议如 `$registerHoverProvider`；`MainThreadLanguageFeatures` 注入 `ILanguageFeaturesService`，把 adapter 登记到对应 `LanguageFeatureRegistry`。
- Editor contrib（`contrib/hover`、`suggest`、`gotoSymbol`、`codeAction`…）只问 `ILanguageFeaturesService`，不区分 provider 来自内置还是扩展。

**语言声明**

- `WorkbenchLanguageService` 注册 `languages` 扩展点（id、extensions、filenames、configuration…），再写入 editor 的 `ILanguageService` / 关联表。

## 打开一次文本文件（端到端）

1. 调用方 `IEditorService.openEditor`（资源或 `EditorInput`）。
2. `IEditorResolverService` 选 pane（默认文本 → `TextFileEditor` + `FileEditorInput`）。
3. 目标 `EditorGroupView` 显示 pane，`setInput`。
4. `TextModelResolverService` / `ITextFileService` 解析出 `ITextModel`。
5. `AbstractTextCodeEditor` 的 `CodeEditorWidget.setModel(model)`。
6. `ICodeEditorService` 发出 `onCodeEditorAdd`；`MainThreadDocumentsAndEditors` 若需同步则通知 Ext Host。
7. 已注册的 `IEditorContribution` 按 `EditorContributionInstantiation` 挂上；语言 contrib 查询 `ILanguageFeaturesService`。

反向：editor 内「转到定义」等若要 **打开另一资源**，经 `ICodeEditorService.openCodeEditor` → workbench `CodeEditorService` → 再走步骤 1，而不是在 widget 里自己 new 一个顶层编辑器。

## 相关文档

- [系统索引](INDEX.md)
- [modules/editor](../../modules/editor/INDEX.md) · [分层概览](../../modules/editor/overview.md)
- [modules/workbench](../../modules/workbench/INDEX.md)
- [systems/extension-api](../extension-api/INDEX.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
