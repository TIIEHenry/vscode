---
title: "workbench-api 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "虚拟模块导航：src/vs/workbench/api 实现 vscode.d.ts，分 common / browser / node / worker"
---

# workbench-api 索引

> 设计正文见 [Extension API 概览](../../systems/extension-api/overview.md)。就近 SSOT：[src/vscode-dts/README.md](../../../src/vscode-dts/README.md)。

## 模块信息

- **源码**: `src/vs/workbench/api/`
- **职责**: 在 extension host 侧装配 `vscode` 模块，并在 workbench（renderer）侧用 `MainThread*` 兑现 RPC；这是 `vscode.d.ts` 的实现，不是独立 layer。
- **依赖方向**: 属于 workbench 层。可依赖 `editor` / `platform` / `base`；不得依赖 `sessions`。层内按 target environment 拆分：`common` 无 DOM/Node；`browser` 可走 DOM；`node` 可走 Node；`worker` 面向 Web Worker。

## 关键入口

| 入口 | 说明 |
|------|------|
| [overview.md](overview.md) | 本虚拟模块如何兑现 `vscode.d.ts` |
| `src/vscode-dts/vscode.d.ts` | 稳定 API 契约：`declare module 'vscode'` |
| `src/vscode-dts/vscode.proposed.*.d.ts` | Proposed API 声明；目录约定见 [vscode-dts README](../../../src/vscode-dts/README.md) |
| `common/extHost.api.impl.ts` | `createApiFactoryAndRegisterActors`：按扩展实例化 `typeof vscode`，并向 `ExtHostContext` 登记 actor |
| `common/extHost.protocol.ts` | `MainContext` / `ExtHostContext` 与 RPC shape |
| `common/extensionHostMain.ts` | `ExtensionHostMain`：协议、DI、`IExtHostExtensionService.initialize()` |
| `common/extHost.common.services.ts` | 跨环境 ExtHost singleton |
| `common/extHostTypes.ts` | 扩展可见类型（`Position`、`Range`、`Diagnostic` 等）的实现 |
| `browser/extensionHost.contribution.ts` | renderer 侧：导入 `mainThread*.ts`，注册部分 contribution point |
| `browser/mainThread*.ts` | workbench 侧 customer；`@extHostNamedCustomer(MainContext.…)` |
| `node/extensionHostProcess.ts` | 桌面 / 远程 Node extension host 进程入口 |
| `node/extHost.node.services.ts` | Node 专用 singleton（terminal / debug / search / task / tunnel 等） |
| `worker/extensionHostWorker.ts` | Web Worker extension host 入口 |
| `worker/extHost.worker.services.ts` | Worker 专用 singleton |

## 所属系统

| 系统 | 链接 |
|------|------|
| Extension API | [索引](../../systems/extension-api/INDEX.md) · [概览](../../systems/extension-api/overview.md) |
| Processes | [索引](../../systems/processes/INDEX.md)（main / renderer / shared / ext host / server） |
| Workbench | [模块索引](../workbench/INDEX.md)（`services/extensions` 拉起 host；`MainThread*` 调工作台服务） |

## 相关文档

- [源码组织](../../../.github/instructions/source-code-organization.instructions.md) — `vs/workbench/api` 为 `vscode.d.ts` API provider
- [术语表](../../glossary.md) — **extension host**、**Extension API**、**workbench-api**
