---
title: "server 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "远程开发服务端入口：vscode-server、连接握手、远端 extension host / pty host"
---

# server 索引

> 返回 [全局索引](../../INDEX.md) · 进程协作见 [系统：Processes](../../systems/processes/INDEX.md) · 工作台本体见 [modules/workbench](../workbench/INDEX.md)

## 模块信息

- **源码**: `src/vs/server/`（实目录只有 `node/`）
- **职责**: 远程开发服务端。接受桌面 / Web 客户端的 management、extension host、tunnel 连接；按需 fork 远端 extension host 与 pty host；可选提供 Web UI
- **依赖方向**: 可依赖 `workbench` 及以下。与 `code`、`sessions` 并列产品入口，不是 `code` 的下一层

仓库根 `src/server-main.ts` 引导 `createServer` / `spawnCli`；`src/server-cli.ts` 直接加载 `server.cli.ts`。开发脚本：`scripts/code-server.sh` → `out/server-main.js`（默认端口环境变量 `VSCODE_SERVER_PORT=9888`）。`scripts/code-web.sh` 走 `@vscode/test-web`，**不**进入本层。

## 关键入口

| 入口 | 说明 |
|------|------|
| [overview.md](overview.md) | 远程服务端职责与连接类型 |
| `node/server.main.ts` | `createServer()` / `spawnCli()`；准备 `REMOTE_DATA_FOLDER`（默认 `~/.vscode-remote` 或 `product.serverDataFolderName`） |
| `node/remoteExtensionHostAgentServer.ts` | `RemoteExtensionHostAgentServer`：握手后按 `ConnectionType` 分发 |
| `node/serverServices.ts` | 服务端 DI：`setupServerServices()`，注册远端文件、扩展、终端、MCP 等 channel |
| `node/webClientServer.ts` | `WebClientServer`：静态资源与 Web workbench（存在 `vs/code/browser/workbench/workbench.html` 时才启用） |
| `node/extensionHostConnection.ts` | 远端 extension host：`child_process`，`VSCODE_ESM_ENTRYPOINT=vs/workbench/api/node/extensionHostProcess` |
| `node/remoteTerminalChannel.ts` | 远端终端 IPC；pty 由 `NodePtyHostStarter` fork |
| `node/remoteExtensionManagement.ts` | `ManagementConnection`：客户端管理通道 |
| `node/remoteExtensionHostAgentCli.ts` | 服务进程内 CLI（扩展安装等） |
| `node/server.cli.ts` | 独立远端 CLI：管道 `VSCODE_IPC_HOOK_CLI` 或 `VSCODE_CLIENT_COMMAND` |
| `node/serverEnvironmentService.ts` | `IServerEnvironmentService`、`serverOptions` |
| `node/serverConnectionToken.ts` | 连接 token 解析与校验 |
| `node/serverLifetimeService.ts` | 空闲自动关闭等生命周期 |

`ConnectionType`（`platform/remote/common/remoteAgentConnection.ts`）在本层被消费：`Management`、`ExtensionHost`、`Tunnel`。

## 所属系统

| 系统 | 链接 |
|------|------|
| Processes | [systems/processes](../../systems/processes/INDEX.md) |
| Extension API | [systems/extension-api](../../systems/extension-api/INDEX.md) |
| Workbench | [systems/workbench](../../systems/workbench/INDEX.md) |

## 相关文档

- [code 模块](../code/INDEX.md)（桌面入口；Web embedder 在 `code/browser/workbench`）
- [workbench 模块](../workbench/INDEX.md)
- [进程概览](../../systems/processes/overview.md)
- [分层规则](../../architecture/cross-cutting/layers.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
