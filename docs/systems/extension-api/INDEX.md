---
title: "Extension API 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "跨层系统：vscode.d.ts 契约、extension host 进程、proposed/stable、contribution point"
---

# Extension API

扩展面对的公开契约是 `vscode.d.ts`；运行时由独立的 extension host 执行扩展代码，经 RPC 与 workbench 协作。实现落在虚拟模块 `workbench-api`，进程拓扑见 [Processes](../processes/INDEX.md)。

## 涉及分层

- **契约**: `src/vscode-dts/`（`vscode.d.ts` 与 `vscode.proposed.*.d.ts`）
- **实现**: `src/vs/workbench/api/` — [workbench-api 索引](../../modules/workbench-api/INDEX.md)
- **宿主与调度**: `src/vs/workbench/services/extensions/`（拉起 LocalProcess / LocalWebWorker / Remote host）
- **兑现 UI/服务**: [workbench](../../modules/workbench/INDEX.md) 的 services 与 contrib（`MainThread*` 的注入目标）
- **平台**: `src/vs/platform/extensions/`（扩展描述、`extensionsApiProposals.ts`）

## 设计目标

- 把扩展隔离在独立进程（或 Web Worker）中，崩溃与同步计算不拖垮 renderer。
- 以 `declare module 'vscode'` 为唯一公开类型契约；实现按扩展生成 API 对象，而不是让扩展直接碰 workbench 内部服务。
- 稳定面与 proposed 面分离：后者必须显式启用，且不能随扩展上架发布。
- 声明式 `package.json#contributes` 与命令式 `vscode.*` 并存：contribution point 在 workbench 侧解析，不必激活扩展即可生效。

## 模块协作

| 分层 | 职责 | 关键符号 |
|------|------|----------|
| `src/vscode-dts/` | 稳定 / proposed 类型契约 | `vscode.d.ts`、`vscode.proposed.*.d.ts` |
| `workbench/api/common` | ExtHost 实现、协议、按扩展装配 `vscode` | `createApiFactoryAndRegisterActors`、`ExtensionHostMain`、`MainContext` / `ExtHostContext` |
| `workbench/api/browser` | renderer 侧 RPC customer 与部分 contribution point | `extensionHost.contribution.ts`、`MainThread*`、`extHostNamedCustomer` |
| `workbench/api/node` | Node host 进程与 Node 能力 | `extensionHostProcess.ts`、`extHost.node.services.ts` |
| `workbench/api/worker` | Web Worker host | `extensionHostWorker.ts`、`extHost.worker.services.ts` |
| `workbench/services/extensions` | 选择 host 种类、发 init data、建 RPC | `ExtensionHostKind`、`IExtensionHost`、`RPCProtocol` |
| `workbench` services / contrib | 真正改工作台状态 | 被 `MainThread*` 注入的 `ICommandService` 等 |

## 相关文档

- [概览](overview.md) — 契约、进程、proposed vs stable、contribution point
- [workbench-api 模块](../../modules/workbench-api/INDEX.md)
- [workbench 模块](../../modules/workbench/INDEX.md)
- [Processes](../processes/INDEX.md)
- [vscode-dts README](../../../src/vscode-dts/README.md) — 如何消费 / 新增 proposal
- [术语表](../../glossary.md)
