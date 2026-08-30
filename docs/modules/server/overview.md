---
title: "server 层概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "server 是远程 Agent 服务端：仅 Node，接受连接并按需 fork 远端 extension host / pty"
---

# server 层概览

> 导航见 [INDEX](INDEX.md)。连接与 fork 时序见 [系统：Processes](../../systems/processes/overview.md)。并列入口：[code](../code/overview.md)、[sessions](../sessions/INDEX.md)。工作台本体：[workbench](../workbench/overview.md)。

`src/vs/server/` 是**远程开发 / 远程 Agent 的服务端入口**。实目录只有 `node/`：没有 Electron，没有 renderer，没有 shared UtilityProcess。它接受桌面或 Web 客户端的 management、extension host、tunnel 连接，按需 `fork` 远端 extension host 与 pty host，并在磁盘上存在 Web 壳时可选提供静态 UI。

仓库根 `src/server-main.ts` 解析 argv 后走 `createServer()` 或 `spawnCli()`；`src/server-cli.ts` 直接加载 `server.cli.ts`。开发：`scripts/code-server.sh` → `out/server-main.js`（默认 `VSCODE_SERVER_PORT=9888`）。

## 这一层为什么存在

远程场景下，工作区、扩展和终端必须跑在**另一台机器（或容器）的 Node 进程**里，而 UI 仍在本机 Electron / 浏览器。`workbench` 不能自己监听端口、校验连接 token、按 `ConnectionType` 分发 socket；桌面 `code` 也不该把这些写进 Electron main——远程主机上根本没有 Electron。

因此需要一个与 `code` **并列**的产品入口：同一套 `workbench` 及以下，换一条「无窗口、只 Node」的编排链。本层负责：

1. **准备远端数据目录**（`REMOTE_DATA_FOLDER`：`--server-data-dir` / `VSCODE_AGENT_FOLDER` / `~/${product.serverDataFolderName}`，常为 `~/.vscode-remote`）。
2. **装配服务端 DI**（`setupServerServices()`）：远端文件、扩展、终端、MCP 等 channel 挂到 socket，而不是 Electron IPC。
3. **握手后分发连接**：`RemoteExtensionHostAgentServer` 消费 `ConnectionType`（`platform/remote`）：`Management`、`ExtensionHost`、`Tunnel`。
4. **按需拉起与 UI 同构的宿主**：远端 extension host 的 `VSCODE_ESM_ENTRYPOINT` 仍是 `vs/workbench/api/node/extensionHostProcess`；pty 仍是 `vs/platform/terminal/node/ptyHostMain`，只是 starter 换成 `NodePtyHostStarter` + `bootstrap-fork`。
5. **生命周期**：空闲自动关闭等（`serverLifetimeService`）；连接 token 解析与校验。

`code` 不是本层的上一层。`scripts/code-web.sh` 用 `@vscode/test-web` 喂 browser workbench，**不**进入 `src/vs/server/`。

## 与 code 的对照

| | **server** | **code** |
|--|------------|----------|
| 角色 | 远程 Agent / vscode-server | 桌面组合根 |
| 运行时 | **仅 Node** | Electron main + 沙箱 renderer + utility + 可选纯浏览器 |
| 用户可见面 | 默认无窗口；有 `vs/code/browser/workbench/workbench.html` 才挂 `WebClientServer` | 本机窗口；CLI 可完全不启动工作台 |
| 谁拉 extension host / pty | 本层 `ExtensionHostConnection` / `NodePtyHostStarter` | 桌面 main 的 `ExtensionHostStarter` / `ElectronPtyHostStarter` |
| 客户端怎么连上 | renderer（或 Web）带 `remoteAuthority`，握手后按连接类型复用或新建 | 本机默认不经过本层；连远程时虚线指向 vscode-server |

桌面 renderer 一旦连上远程，远端的 EH / pty **不再**走 main 里的 starter。进程图见 [进程模型概览](../../systems/processes/overview.md) 的「远程 `scripts/code-server.sh`」子图与 `ConnectionType` 表。

## 目标环境拆分

分层规则里 `server` 的目标环境只有 **`node/`**。没有 `common/`、`browser/`、`electron-*`：任何需要 DOM 或 Electron API 的代码都不属于本层。

Web UI 若启用，静态页与 `create()` embedder 来自 [code 的 `browser/workbench`](../code/overview.md)，由 `WebClientServer` 对外提供，源码仍不进 `src/vs/server/browser`。CLI 有两条 Node 路径，都在本层：

- 服务进程内：`server.main.ts` 的 `spawnCli()` → `remoteExtensionHostAgentCli.ts`（扩展安装等，且无 `--start-server` 时可不监听）。
- 独立远端 CLI：`server.cli.ts`，经 `VSCODE_IPC_HOOK_CLI` 管道或 `VSCODE_CLIENT_COMMAND`（Windows 侧客户端命令）。

入口文件清单见 [INDEX](INDEX.md)。

## 本层不拥有什么

工作台 chrome、contrib、`vscode.d.ts` 实现仍在 [workbench](../workbench/overview.md)。本层不实现编辑器，只把远端服务 channel 接到已有的文件 / 扩展 / 终端 / MCP 实现上。桌面单实例、窗口、shared process 属于 `code`。会话窗属于 `sessions`。

## 相关文档

- [server 索引](INDEX.md) · [code 概览](../code/overview.md)
- [进程模型概览](../../systems/processes/overview.md) · [Processes 索引](../../systems/processes/INDEX.md)
- [workbench](../workbench/overview.md) · [Extension API](../../systems/extension-api/INDEX.md)
- [分层规则](../../architecture/cross-cutting/layers.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
