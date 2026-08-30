---
title: "Editor 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "编辑器跨层协作：Monaco widget、workbench Editor Part、文本服务与扩展语言特征"
---

# Editor 系统

> 返回 [全局索引](../../INDEX.md) · 本层导航见 [modules/editor](../../modules/editor/INDEX.md) · 协作正文见 [概览](overview.md)

## 涉及分层

- `editor`（`src/vs/editor/`）：Monaco 模型、widget、语言特征注册表
- `workbench`（`src/vs/workbench/`）：Editor Part、组、pane、打开/保存路径
- `workbench/api`：把 `ITextModel` / `ICodeEditor` 同步到 Extension Host，并把 `vscode.languages` 接到 `ILanguageFeaturesService`
- `platform`：`IMarkerService`、undo/redo、命令与键位等被 editor 消费的基础服务

## 设计目标

1. **同一套 Monaco widget** 既能独立嵌入（`standalone` / `monaco-editor-core`），也能嵌进 workbench 的 `EditorPane`。
2. **打开编辑器走 workbench**：`ICodeEditorService.openCodeEditor` 在 IDE 里转到 `IEditorService`，不绕过组、pin、focus 规则。
3. **模型解析在宿主**：`ITextModelService` 接口在 editor，文件 / untitled / 虚拟 scheme 的实现在 workbench。
4. **语言特征跨进程**：扩展在 Ext Host 注册 provider，主线程写入 `ILanguageFeaturesService`，editor contrib 只读注册表。

## 模块协作

| 分层 | 职责 | 关键符号 |
|------|------|----------|
| editor | 文本模型、渲染、contrib、语言特征表 | `ITextModel`、`CodeEditorWidget`、`ILanguageFeaturesService` |
| workbench 核心 | 组网格、pane 生命周期、打开策略 | `EditorPart`、`EditorPane`、`IEditorService`、`IEditorGroupsService` |
| workbench services | 覆盖/实现 editor 接口 | `CodeEditorService`、`WorkbenchModelService`、`TextModelResolverService`、`WorkbenchLanguageService` |
| workbench contrib/files | 文件系统文本编辑器 | `TextFileEditor`、`FileEditorInput` |
| workbench/api | 扩展文档/编辑器/语言特征 | `MainThreadDocumentsAndEditors`、`MainThreadLanguageFeatures`、`ExtHostLanguageFeatures` |

## 相关文档

- [协作概览](overview.md)
- [modules/editor](../../modules/editor/INDEX.md)
- [modules/workbench](../../modules/workbench/INDEX.md)
- [systems/extension-api](../extension-api/INDEX.md)
