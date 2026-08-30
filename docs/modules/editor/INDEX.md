---
title: "Editor 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "editor 分层导航：Monaco 核心、common/browser/contrib/standalone 入口与入口文件"
---

# Editor 索引

> 返回 [全局索引](../../INDEX.md) · 本层设计见 [分层概览](overview.md) · 跨层协作见 [系统：Editor](../../systems/editor/INDEX.md)

## 模块信息

- **源码**: `src/vs/editor/`
- **职责**: Monaco 编辑器核心：文本模型、视图、光标、语言特征注册表、编辑器 widget 与 contrib
- **依赖方向**: 只能依赖 `base`、`platform`。本层**没有**生产代码的 `node/` 或 `electron-*` 目标环境；运行时只有 `common`（纯 JS）与 `browser`（DOM）
- **对外产品名**: 独立嵌入时称 **Monaco Editor**；从本层抽出 `monaco-editor-core`（`build/gulpfile.editor.ts`，入口 `editor.main.ts`）

## 关键入口

| 入口 | 说明 |
|------|------|
| [`overview.md`](overview.md) | 本层目录、核心类型、contrib 注册、standalone vs workbench 共用 widget |
| `editor.all.ts` | 副作用导入：core commands、`CodeEditorWidget`、全部 `contrib/` |
| `editor.api.ts` | Monaco 全局 API：`createMonacoBaseAPI` + `editor` / `languages` |
| `editor.main.ts` | Monaco 独立包入口：`editor.all` + standalone contrib，再 re-export `editor.api` |
| `editor.worker.start.ts` | Monaco web worker RPC 挂钩（`monaco-editor` 使用） |
| `common/editorCommon.ts` | `IEditor`、`IEditorContribution`、`EditorType`、view state |
| `common/model.ts` | `ITextModel` |
| `common/languages.ts` | 语言特征 provider 契约 |
| `browser/editorBrowser.ts` | `ICodeEditor`、`IDiffEditor`、view zone / widget |
| `browser/editorExtensions.ts` | `registerEditorContribution` / `registerEditorAction` / `registerEditorCommand` |
| `browser/widget/codeEditor/codeEditorWidget.ts` | `CodeEditorWidget`（`ICodeEditor` 实现） |
| `standalone/browser/standaloneEditor.ts` | `create()`：独立 DOM 上实例化 `StandaloneEditor` |

## 所属系统

| 系统 | 链接 |
|------|------|
| Editor | [systems/editor](../../systems/editor/INDEX.md) |
| Workbench | [modules/workbench](../workbench/INDEX.md)（宿主：Editor Part / `EditorPane`） |
| Extension API | [systems/extension-api](../../systems/extension-api/INDEX.md)（`vscode.languages` / 文档与编辑器同步） |

## 相关文档

- [分层概览](overview.md)
- [系统：Editor](../../systems/editor/overview.md)
- [Workbench 模块](../workbench/INDEX.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
- [分层规则](../../architecture/cross-cutting/layers.md)
