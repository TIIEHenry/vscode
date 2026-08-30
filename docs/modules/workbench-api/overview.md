---
title: "workbench-api 概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "按 common / browser / node / worker 拆分；factory 按扩展装配 vscode，MainThread 在 renderer 兑现；proposed 与 stable 的模块边界"
---

# workbench-api 概览

> 导航见 [INDEX](INDEX.md)。契约、进程种类与 contribution point 见 [Extension API 系统](../../systems/extension-api/overview.md)。  
> 就近 SSOT：[src/vscode-dts/README.md](../../../src/vscode-dts/README.md)。

`src/vs/workbench/api/` 是文档上的**虚拟模块**：属于 [workbench](../workbench/INDEX.md) 层，不是独立 layer。职责是兑现 `src/vscode-dts/vscode.d.ts`（`declare module 'vscode'`），而不是再定义一套扩展契约。

层内依赖与全仓库一致：可 import `editor` / `platform` / `base`，**不得** import `sessions`，也不得伸进某个 `contrib/` 内部。目录按 **target environment** 拆，而不是按功能域拆——同一能力通常成对出现：`ExtHost*` 在 host 侧，`MainThread*` 在 renderer 侧。

## `common` / `browser` / `node` / `worker`

四个子目录的运行方不同。`browser/` **不在** extension host 里跑。

| 目录 | 谁在跑 | 放什么 | 可依赖 |
|------|--------|--------|--------|
| `api/common` | 所有 host | 协议、`ExtensionHostMain`、API factory、大多数 `ExtHost*`、`extHostTypes`、`extHost.common.services.ts` | 仅基本 JS |
| `api/browser` | **renderer** | `mainThread*.ts`、`extensionHost.contribution.ts`、本模块登记的若干 contribution point | `common` + DOM |
| `api/node` | LocalProcess / Remote host | `extensionHostProcess.ts`；覆盖 terminal / debug / search / task / tunnel / 磁盘 FS 等 | `common` + Node |
| `api/worker` | LocalWebWorker host | `extensionHostWorker.ts` 与精简 singleton | `common`；无 Node |

`common` 里不要出现 DOM 或 Node API。能共享的 import 写进 `extHost.common.services.ts`；`extHost.node.services.ts` / `extHost.worker.services.ts` 只覆盖必须分叉的实现（源码注释要求不要把可共享的只写进 node/worker）。

`common` 对 debug / task / terminal 注册的是 **Worker stub**（`WorkerExtHostDebugService` 等）。Node host 再换成完整实现。Worker host 几乎不新增服务，只绑 `ExtHostExtensionService`、log / telemetry / auth / storage paths。

本模块没有 `electron-browser/`：renderer customer 走 `browser/`；桌面 / 远程进程入口走 `node/`。Host 种类与拉起方式见 [Processes](../../systems/processes/INDEX.md) 与 `workbench/services/extensions/`。

## Factory 与 MainThread

兑现一条 `vscode.*` 调用需要两端对齐，协议在 `common/extHost.protocol.ts`：

- `MainContext` — ExtHost 调 workbench（`MainThreadCommands`、`MainThreadDocuments`、…）
- `ExtHostContext` — workbench 调 ExtHost（`ExtHostCommands`、`ExtHostDocuments`、…）

### Host：`createApiFactoryAndRegisterActors`

`common/extHost.api.impl.ts` 的 `createApiFactoryAndRegisterActors` 做两件事：

1. **登记 actor**：从 DI 取出（或 `new`）`ExtHost*`，`rpcProtocol.set(ExtHostContext.…, actor)`。同一 host 进程里的扩展**共享**这些 actor。
2. **返回 factory**：`IExtensionApiFactory`，对每个 `IExtensionDescription` 产出一份 `typeof vscode`。表面按扩展切开，便于 proposed 检查、遥测与弃用报告。

`common/extensionHostMain.ts` 的 `ExtensionHostMain` 接到 `IMessagePassingProtocol` 与 `IExtensionHostInitData` 后建 `RPCProtocol`、灌入 singleton（先 common，再 node 或 worker），再 `IExtHostExtensionService.initialize()`。扩展可见类型（`Position`、`Range`、`Diagnostic` 等）在 `extHostTypes`；RPC 边界用 `extHostTypeConverters` 与内部 editor / workbench 类型互转。

### Renderer：`MainThread*` customer

`browser/mainThread*.ts` 用 `@extHostNamedCustomer(MainContext.…)` 登记到 `ExtHostCustomersRegistry`（定义在 `workbench/services/extensions`，不在本模块）。构造时注入 workbench 服务；扩展调用 `vscode.commands.registerCommand` 时，改命令注册表的是 renderer 上的 `MainThreadCommands`。

`browser/extensionHost.contribution.ts` 在 `WorkbenchPhase.BlockStartup` 实例化本模块负责的若干 extension point，并 **side-effect import 全部** `mainThread*.ts`，保证第一条 RPC 到达前 customer 已登记。未从该入口引用的 `MainThread*` 不会进包。

配对约定：改协议 shape → 同时改 `ExtHost*` 与对应 `MainThread*`；不要只改一端。

## Proposed 与 stable

契约文件在 `src/vscode-dts/`，不在 `workbench/api/`。本模块只实现与门控。

| | Stable | Proposed |
|---|--------|----------|
| 声明 | `vscode.d.ts` | `vscode.proposed.<name>.d.ts`（`<name>` 匹配 `[a-zA-Z]+`） |
| 本模块 | factory 始终挂上对应成员 | 进入实现前调用 `checkProposedApiEnabled` / `isProposedApiEnabled`，名字与生成表一致 |
| 扩展 | 无需声明即可用 | `package.json#enabledApiProposals` 列出名字；未启用则抛错或当 false |
| 发布 | 可发布 | 使用 proposed 的扩展**不能**发布到 Marketplace |

新增 proposed 文件会生成 `src/vs/platform/extensions/common/extensionsApiProposals.ts`（需 `npm run watch`）。工作台侧 `ExtensionsProposedApi` 再按 `product.json#extensionEnabledApiProposals`、`--enable-proposed-api` 以及是否从源码 / 扩展开发模式启动，过滤或放宽列表。

稳定化：类型搬进 `vscode.d.ts`，本模块去掉检查。废弃：删除 proposed 文件与生成表项。步骤以 [vscode-dts README](../../../src/vscode-dts/README.md) 为准。

## 关键符号（本模块）

| 符号 | 位置 |
|------|------|
| `createApiFactoryAndRegisterActors` | `common/extHost.api.impl.ts` |
| `ExtensionHostMain` | `common/extensionHostMain.ts` |
| `MainContext` / `ExtHostContext` | `common/extHost.protocol.ts` |
| `extHostTypes` / converters | `common/extHostTypes.ts`、`common/extHostTypeConverters.ts` |
| `@extHostNamedCustomer` | `workbench/services/extensions/common/extHostCustomers.ts`（登记处）；本模块 `browser/mainThread*.ts` 使用 |
| `ExtensionPoints` | `browser/extensionHost.contribution.ts` |
| Node / Worker 入口 | `node/extensionHostProcess.ts`、`worker/extensionHostWorker.ts` |

## 相关文档

- [INDEX](INDEX.md) — 本虚拟模块入口与关键路径
- [Extension API 系统](../../systems/extension-api/overview.md) — 契约、host 种类、contribution 与 `vscode.*` 的分工
- [Workbench 模块](../workbench/INDEX.md) — `services/extensions` 拉起 host；`MainThread*` 调工作台服务
- [Processes](../../systems/processes/INDEX.md) — main / renderer / shared / ext host / server
- [分层规则](../../architecture/cross-cutting/layers.md)
