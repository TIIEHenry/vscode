---
title: "术语表"
type: concept
status: accepted
phase: N/A
updated: 2026-08-31
summary: "本仓库核心术语的单一事实源：分层、Parts、Agent UI 宿主与文档约定；长规格用链接，不在此复述"
---

# 术语表

每个术语只在本文件给**一条**定义。分层规则、测试入口、文档结构见对应规格，这里不复制正文。

| 术语 | 定义 | 详见 |
|------|------|------|
| **Code - OSS** | 本仓库开发的开源编辑器产品；Visual Studio Code 是带 Microsoft 定制的发行版。 | [README.md](../README.md) |
| **layer** | `src/vs/` 下按依赖方向排序的源码层。低层不得依赖高层。 | [分层规则](architecture/cross-cutting/layers.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **base** | 最底层：无服务依赖的工具与 UI 积木，路径 `src/vs/base/`。 | [modules/base](modules/base/INDEX.md) |
| **platform** | DI 基础设施与跨层基础服务，路径 `src/vs/platform/`。 | [modules/platform](modules/platform/INDEX.md) |
| **editor** | Monaco 编辑器核心（无 `node` / `electron-*` 依赖），路径 `src/vs/editor/`。 | [架构概览](architecture/overview.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **workbench** | 工作台框架：布局、parts、`services/`、`contrib/`、`api/`，路径 `src/vs/workbench/`。 | [modules/workbench](modules/workbench/INDEX.md) |
| **sessions** | Agents Window 所在层，高于 `workbench`：可依赖 workbench，反向禁止。路径 `src/vs/sessions/`。 | [modules/sessions](modules/sessions/INDEX.md) · 就近 SSOT [`LAYERS.md`](../src/vs/sessions/LAYERS.md) |
| **code** | Electron 桌面入口层（main / shared / CLI），路径 `src/vs/code/`。 | [架构概览](architecture/overview.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **server** | 远程开发服务端入口，路径 `src/vs/server/`。 | [架构概览](architecture/overview.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **target environment** | 层内按运行时分子目录：`common`、`browser`、`node`、`electron-browser`、`electron-utility`、`electron-main`。只能使用该环境允许的 API，并依赖更低环境。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **contrib** | 功能贡献：注册到工作台或 sessions 的特性包（如 git、debug、chat）。外部不得依赖某个 contrib 的内部实现。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **chat** | 文档上的**虚拟模块**，源码在 `src/vs/workbench/contrib/chat/`，不是独立 layer。 | [modules/chat](modules/chat/INDEX.md) |
| **workbench-api** | 文档上的**虚拟模块**：Extension Host 与 `vscode.d.ts` 的实现，路径 `src/vs/workbench/api/`。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) · [DOCS-SPEC §3.1](DOCS-SPEC.md) |
| **service** | 通过构造函数注入的跨组件依赖。非服务参数必须排在服务参数之前；生产代码不得在构造之外用 `IInstantiationService` 取服务。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **instantiation** | 由 `IInstantiationService` 创建带 DI 的对象。服务用 `registerSingleton(IMyService, Impl, InstantiationType.…)` 注册。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **disposable** | 实现 `IDisposable` 的资源。创建后必须立刻登记以便释放；重复调用的方法应返回 `IDisposable` 给调用方登记，避免挂到会泄漏的宿主。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **extension host** | 运行扩展的独立进程；工作台通过 `workbench/api` 暴露 `vscode` API。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) · [全局索引](INDEX.md) |
| **Extension API** | 扩展面对的公开契约，类型定义在 `vscode.d.ts`（及 proposed 变体）。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **main / renderer / shared** | 桌面多进程：Electron main、工作台 renderer、共享进程；再加上 extension host 与 remote server。 | [架构概览](architecture/overview.md) · [How to Contribute · Debugging](https://github.com/microsoft/vscode/wiki/How-to-Contribute#debugging) |
| **Agents Window** | `sessions` 层承载的智能体会话工作台，与主 workbench 并列，不反向依赖。 | [SESSIONS.md](../src/vs/sessions/SESSIONS.md) |
| **unit test** | 核心单测，主要在 `src/vs/*/test/`；Electron 下用 `scripts/test.sh` 跑。 | [测试与校验](architecture/cross-cutting/testing.md) |
| **integration test** | API / 端到端集成测，入口在 `test/integration/`，用 `scripts/test-integration.sh`。 | [test/README.md](../test/README.md) |
| **valid-layers-check** | `npm run valid-layers-check`：检查模块分层与层类型。仅在改动可能影响分层时运行。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **就近 SSOT** | 已存在于源码旁的规格（如 `src/vs/sessions/*.md`）保持权威；`docs/` 只导航，不复制正文。 | [DOCS-SPEC.md](DOCS-SPEC.md) |
| **知识层 / 行动层** | `docs/` 是相对稳定的设计与导航；`dev/` 是 status、plan、ADR、iteration。 | [DOCUMENTATION.md](DOCUMENTATION.md) |
| **ADR** | 架构决策记录，统一放在 `dev/decisions/`。accepted 后不改正文；推翻则写新 ADR。 | [DOCUMENTATION.md](DOCUMENTATION.md) |
| **nls** | 用户可见字符串的本地化模块 `vs/nls`；禁止拼接，用 `{0}` 占位。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **INDEX** | 导航入口：链接、表格、一句话上下文；不承载大段设计正文。 | [文体指南](guides/doc-style-guide.md) |
| **Part** | workbench grid 上的一个视图单元（`Parts` 枚举）。功能往 Part 里注册，不直接 new 布局。 | [Parts/Grid](systems/workbench/parts-and-grid.md) |
| **CONVERSATION_PART** | 默认 Code 窗口 grid 的 **中心锚点**；由 `contrib/conversation` 透镜填充（非 `EditorInput` / `ChatEditorInput`）。 | [Parts/Grid](systems/workbench/parts-and-grid.md) · [agent-ui](systems/chat/agent-ui.md) |
| **EDITOR_PART** | End 列 Preview：`EditorGroup` + tabs + `EditorInput`（M0 已从中心叶挪到 End）。 | [Parts/Grid](systems/workbench/parts-and-grid.md) |
| **SESSIONS_PART** | Agents Window 的非 editor 中心 Part；默认 Code 窗口 grid 不装配。 | [agent-ui](systems/chat/agent-ui.md) · [LAYOUT.md](../src/vs/sessions/LAYOUT.md) |
| **ChatWidget** | contrib/chat 的对话列表+输入零件；可被多种宿主嵌套。 | [agent-ui](systems/chat/agent-ui.md) |
| **ChatEditor / ChatEditorInput** | 把对话做成 `EDITOR_PART` 的 tab。B2 **INV-TOPO 禁止**以此当 Conversation 中心。 | [agent-ui](systems/chat/agent-ui.md) |
| **INV-TOPO** | Desktop B2：Conversation 不是 `EditorInput` / Custom Editor / 普通 EditorGroup tab。 | [code-oss-b2](reference/code-oss-b2/INDEX.md) |

上游产品与贡献流程不在本表展开，见 [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) 与 [快速开始](guides/getting-started.md)。
