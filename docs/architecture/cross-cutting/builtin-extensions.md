---
title: "内置扩展"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "extensions/ 是随产品发布的一等扩展，不是 src/vs 层；只经 vscode API 与 workbench 对话"
---

# 内置扩展

> 导航：[横切索引](INDEX.md) · 全景：[架构概览](../overview.md)。  
> 扩展契约与进程：[Extension API](../../systems/extension-api/overview.md) · 实现：[workbench-api](../../modules/workbench-api/INDEX.md)。  
> 权威短述：[.github/copilot-instructions.md](../../../.github/copilot-instructions.md) 的 Built-in Extensions 段。

`extensions/` 存放**随 VS Code 发布的第一方扩展**。它**不是** `src/vs/` 的一层：有序分层只有 `base` → `platform` → `editor` → `workbench`，之上并列 `code` / `server` / `sessions`。见 [分层规则](layers.md)。

内置扩展与 Marketplace 扩展走同一套契约：`package.json` + TypeScript + contribution points，经 **Extension API**（`vscode.d.ts`）接入工作台。它们**不得** import `vs/workbench`、`vs/platform` 或其他 `src/vs/` 实现。

## 与 workbench 的边界

```
extensions/<id>/     只看见 vscode.* 与自己的 contributes
        │
        │  声明式：package.json#contributes
        │  命令式：激活后 vscode.commands / languages / window …
        ▼
workbench/api        ExtHost 兑现 vscode.d.ts；RPC → MainThread*
        │
        ▼
workbench/services   例如 IExtensionService 拉起 host
workbench/contrib    消费注册表（命令、视图、SCM…），不反向依赖某个扩展目录
```

要点：

1. **只经 API 对话。** 扩展代码跑在 Extension Host（独立 Node 进程或 Web Worker），不进 renderer。Host 与工作台之间是 `extHost.protocol` RPC，不是直接函数调用。
2. **不是 `vs/` 层。** `valid-layers-check` / import patterns 管的是 `src/vs/*`。改内置扩展不会、也不应变成「又一层 workbench」。
3. **贡献点在工作台登记。** 清单由 `ExtensionsRegistry` 解析；handler 在 `workbench/api`、`workbench/services` 或各 contrib。扩展目录里不要假设能碰到 `IEditorService` 这类内部服务。
4. **编译入口不同。** 核心走 `src/` 的 client compile；内置扩展走 `npm run gulp compile-extensions`（见 copilot-instructions）。

工作台侧宿主与激活在 `src/vs/workbench/services/extensions/`，见 [Workbench 服务](../../modules/workbench/services.md)。API 形状见 [Extension API 概览](../../systems/extension-api/overview.md)。

## 目录怎么分组（不要枚举）

`extensions/` 下一目录即一个扩展（另有共享构建脚本与 `package.json`）。**按角色分组，不要把整棵树抄进文档**——以仓库实列为准。copilot-instructions 的分组仍然成立：

| 组 | 典型目录 | 做什么 |
|----|----------|--------|
| **Language features** | `typescript-language-features`、`html-language-features`、`css-language-features`、`json-language-features`、`php-language-features`、`markdown-language-features` 等 | 语言服务、补全、诊断、格式化；经 `vscode.languages` |
| **Language basics / 语法** | `typescript-basics`、`javascript`、`python`、`go`、`cpp`、`yaml`…（大量单语言目录） | 语法、language-configuration、snippets；多数无重型 TS 运行时 |
| **核心功能** | `git`、`git-base`、`emmet`、`debug-auto-launch`、`debug-server-ready`、`merge-conflict`、`ipynb`、`npm`、`simple-browser`、`terminal-suggest`… | SCM、调试辅助、Notebook、任务/包管理等产品功能 |
| **Themes** | `theme-defaults`、`theme-abyss`、`theme-*`、`theme-seti`、`theme-modern-icons` | 默认颜色主题与图标主题 |
| **认证** | `github-authentication`、`microsoft-authentication` | 账号 session provider |
| **开发 / 测试夹具** | `extension-editing`、`vscode-api-tests`、`vscode-colorize-tests`、`vscode-test-resolver` | 扩展清单编辑、API 集成测、着色测、测试用 resolver |

`markdown-language-features` 在 copilot-instructions 里归在 Core features，因为它同时是语言扩展和产品功能；分组交叉时以「是否提供 language server / provider」判断即可，不必争论归属。

每个扩展标准结构：`package.json`（`engines.vscode`、`contributes`、可选 `enabledApiProposals`）、源码、语法/主题资源。它们扩展工作台，**不**构成工作台。

## 相关文档

- [分层规则](layers.md) · [架构概览](../overview.md)
- [Extension API](../../systems/extension-api/overview.md) · [workbench-api](../../modules/workbench-api/INDEX.md)
- [Workbench 服务](../../modules/workbench/services.md)（`services/extensions`）
- [编码约定 · Built-in Extensions](../../../.github/copilot-instructions.md)
