---
title: "Editor 分层概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "src/vs/editor 单层结构：common/browser/contrib/standalone、Monaco 入口与核心类型"
---

# Editor 分层概览

> 导航见 [INDEX](INDEX.md)。本层如何被 workbench 托管、如何接到扩展，见 [systems/editor](../../systems/editor/overview.md)。

`src/vs/editor/` 是 **Monaco** 核心：可独立嵌入（`standalone/` + `editor.main.ts`），也可被 [workbench](../workbench/INDEX.md) 装进 IDE chrome。约定见 [source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md)：本层**不得**依赖 `node` 或 `electron-*`。

生产目录只有 `common/`、`browser/`、`contrib/`、`standalone/`。没有 `node/`、`electron-browser/` 等目标环境文件夹；`test/node/` 仅测 diff 等，不是本层运行时分区。

## 目录角色

| 路径 | 角色 |
|------|------|
| `common/` | 纯 JS：`ITextModel`、`IEditor`、`Position` / `Range` / `Selection`、语言特征、view model、cursor、diff、服务接口 |
| `browser/` | DOM：`ICodeEditor` / `IDiffEditor`、`View`、`viewParts`、controller、`editorExtensions`、widget |
| `contrib/` | 编辑器内功能：find、suggest、hover、folding、format、goto… 各子目录再按 `browser/`（偶有 `common/`）拆 |
| `standalone/` | 独立嵌入：`create()`、`StandaloneServices`、standalone theme / languages API |
| `test/` | 本层测试与 fixture |

`contrib/` 与 workbench 的 `contrib/` 不是同一套规则：editor contrib 绑在 **单个** `ICodeEditor` / `IDiffEditor` 实例上（`IEditorContribution`），由 `editor.all.ts` 副作用加载。

## 入口文件

Workbench 与 Monaco 独立包共用同一套 widget，入口不同：

| 文件 | 用途 |
|------|------|
| `editor.all.ts` | 导入 `coreCommands`、`CodeEditorWidget`、`diffEditor.contribution`，以及全部 editor contrib。`workbench.common.main.ts` **第一行**就 `import '../editor/editor.all.js'` |
| `editor.api.ts` | 组装 `monaco` 对象：`createMonacoBaseAPI()` + `createMonacoEditorAPI()` + `createMonacoLanguagesAPI()`；可选挂到 `globalThis.monaco` |
| `editor.main.ts` | Monaco 包入口：`editor.all` + standalone 专用 contrib（quick access、inspect tokens 等），再 `export * from './editor.api.js'` |
| `editor.worker.start.ts` | 注释写明：供 `monaco-editor` 挂钩 web worker RPC；内部 `initialize` + `EditorWorker` |

独立包抽出由 `build/gulpfile.editor.ts` 完成：entry 为 `editor.main.ts`、`editor.worker.start.ts`、`common/services/editorWebWorkerMain.ts`，产物目录 `out-monaco-editor-core`。

## 核心类型（本层）

文档与编辑器是两条线：模型可无视图存在；widget 通过 `setModel()` 挂上 `ITextModel`。

| 符号 | 文件 | 含义 |
|------|------|------|
| `ITextModel` | `common/model.ts` | 文本文档：内容、语言、decorations、tokenization |
| `IModelService` | `common/services/model.ts` | `createModel` / `getModel` / 模型生命周期 |
| `IEditor` | `common/editorCommon.ts` | 编辑器公共面：`updateOptions`、`layout`、`getModel`、`saveViewState` |
| `ICodeEditor` | `browser/editorBrowser.ts` | 「富文本」编辑器：光标、decorations、content/overlay widget、view zone |
| `IDiffEditor` | 同上 | 左右（或 inline）两个 `ICodeEditor` + diff 模型 |
| `EditorType` | `common/editorCommon.ts` | `ICodeEditor` / `IDiffEditor` 字符串判别（避免 `instanceof`） |
| `CodeEditorWidget` | `browser/widget/codeEditor/codeEditorWidget.ts` | `ICodeEditor` 的主实现 |
| `IEditorContribution` | `common/editorCommon.ts` | 随某个 editor 实例创建/销毁；可选 `saveViewState` |
| `ILanguageFeaturesService` | `common/services/languageFeatures.ts` | hover / complete / definition 等 `LanguageFeatureRegistry` |
| `ILanguageService` | `common/languages/language.ts` | 语言 id、扩展名关联 |
| `ITextModelService` | `common/services/resolverService.ts` | 按 `URI` 解析模型引用（接口在本层，workbench 给实现） |
| `ICodeEditorService` | `browser/services/codeEditorService.ts` | 已创建的 code/diff editor 清单、`openCodeEditor` |
| `IEditorWorkerService` | `common/services/editorWorker.ts` | worker 上算 diff、最小 edits、unicode highlight 等 |

`common/core/` 放几何与编辑原语：`position.ts`、`range.ts`、`selection.ts`、`editOperation.ts`。`common/viewModel/` + `browser/view.ts` / `viewParts/` 把模型投影成可见行并绘制。

## 注册面

`browser/editorExtensions.ts`：

| API | 生命周期 |
|-----|----------|
| `registerEditorContribution(id, ctor, instantiation)` | 绑到单个 `ICodeEditor`。`EditorContributionInstantiation`：`Eager` / `AfterFirstRender` / `BeforeFirstInteraction` / `Eventually` / `Lazy`。只有 `Eager` 能参与 view state 存取 |
| `registerDiffEditorContribution` | 绑到单个 `IDiffEditor` |
| `registerEditorAction` / `registerEditorCommand` | 写入 `CommandsRegistry` / 键位 / 菜单 |
| `registerEditorFeature`（`common/editorFeatures.ts`） | 第一个 code editor 构造时实例化一次，进程结束才销毁 |

`editor.all.ts` 用副作用 import 触发上述注册。未从入口引用的 contrib **不会**进包。

`ILanguageFeaturesService` 的默认实现在本层 `registerSingleton`（`LanguageFeaturesService`）。`IEditorWorkerService` 在 `browser/services/contribution.ts` 以 `InstantiationType.Eager` 注册。

## Widget

`browser/widget/`：

| 实现 | 角色 |
|------|------|
| `codeEditor/codeEditorWidget.ts` | 单文档编辑器；`embeddedCodeEditorWidget.ts` 嵌在 peek 等内部 |
| `diffEditor/diffEditorWidget.ts` | 双文档 diff |
| `multiDiffEditor/multiDiffEditorWidget.ts` | 多文件 diff 列表 |

Standalone 的 `create(domElement, options, override?)`（`standalone/browser/standaloneEditor.ts`）经 `StandaloneServices.initialize` 后 `createInstance(StandaloneEditor, …)`。Workbench **不走**这条路径，而是 `instantiationService.createInstance(CodeEditorWidget, parent, options, widgetOptions)`（见系统文档）。

## 本层服务 vs 宿主覆盖

下列接口定义在 editor，**默认或 standalone 实现也在 editor**；workbench 会换实现或补宿主逻辑（细节在 [systems/editor](../../systems/editor/overview.md)）：

- `IModelService`：本层 `ModelService`；standalone 直接用它；workbench 用 `WorkbenchModelService`
- `ILanguageService`：本层 `LanguageService`；standalone 用 `StandaloneLanguageService`；workbench 用 `WorkbenchLanguageService`（接 `languages` 扩展点）
- `ITextModelService`：standalone `StandaloneTextModelService`；workbench `TextModelResolverService`
- `ICodeEditorService`：`AbstractCodeEditorService`；standalone `StandaloneCodeEditorService`；workbench `CodeEditorService`（`openCodeEditor` 转到 `IEditorService`）

## 相关文档

- [INDEX](INDEX.md)
- [系统：Editor](../../systems/editor/overview.md)
- [Workbench 模块](../workbench/INDEX.md)
- [Extension API 系统](../../systems/extension-api/INDEX.md)
