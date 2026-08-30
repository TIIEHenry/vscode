---
title: "code 层概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "code 是桌面产品的组合根：装配 Electron 进程与 CLI，几乎不承载 IDE 业务"
---

# code 层概览

> 导航见 [INDEX](INDEX.md)。进程谁启动谁见 [系统：Processes](../../systems/processes/overview.md)。并列入口：[server](../server/overview.md)、[sessions](../sessions/INDEX.md)。工作台本体：[workbench](../workbench/overview.md)。

`src/vs/code/` 是**桌面产品的组合根（composition root）**。它把 Electron main、renderer、shared utility、Node CLI 和浏览器 embedder 接到 `workbench`，本身几乎不实现编辑器、视图、扩展或 Chat 等 IDE 业务。仓库根 `src/main.ts` / `src/cli.ts` 只做引导，再 `import` 本层。

## 这一层为什么存在

`workbench` 已经是完整工作台，但不能自己变成可发布的桌面应用：它不知道单实例、窗口生命周期、UtilityProcess 拉起、协议 URL，也不知道 CLI 该打印帮助还是 `spawn` Electron。这些必须落在某个**产品入口**上，而入口不能再堆一层业务。

因此 `code` 只做装配：

1. **认领本机实例**：`CodeMain` 用 Node IPC 保证同一用户配置下尽量只有一套 VS Code。
2. **打开宿主进程图**：`CodeApplication` 建 IPC、登记 channel、延后拉起 shared process，再由 `WindowsMainService` 开窗。
3. **把 HTML 壳交给 workbench**：普通窗口加载本层 `workbench.html`，再动态 `import` `workbench.desktop.main.ts`。IDE 框架从这里离开本层。
4. **提供不启动工作台的旁路**：扩展列表 / 安装等走 `cliProcessMain.ts`；Web 开发用 `browser/workbench` embedder，不经过 Electron main。

`code`、`server`、`sessions` 都在 `workbench` 之上，彼此并列。本层**不是** `server` 的上一层，也**不会**在 `configuration.isSessionsWindow` 时接管 Agents 窗口（那扇窗加载 `vs/sessions/electron-browser/sessions.html`）。

## 与 server 的对照

两条产品链共享 `workbench` 及以下，入口不同：

| | **code（桌面）** | **server（远程）** |
|--|------------------|-------------------|
| 产品形态 | Electron 桌面 + 本机 CLI | 无 UI 的 Node 服务（可选挂 Web 静态页） |
| 源码环境 | `electron-main` / `electron-browser` / `electron-utility` / `node` / `browser` | **只有** `node/` |
| 启动脚本 | `scripts/code.sh`、`code-cli.sh`；`code-web.sh` 走 `@vscode/test-web` | `scripts/code-server.sh` → `out/server-main.js` |
| 本机子进程 | main 以 `UtilityProcess` 拉 shared / 本机 extension host / pty host | 无 Electron；远端 EH / pty 由 server `fork` |
| 远程时 | renderer 用 `remoteAuthority` 连 vscode-server；远端宿主**不再**走 main 的 starter | 握手后按 `ConnectionType` 分发 Management / ExtensionHost / Tunnel |

开发 Web 工作台用 `scripts/code-web.sh`，**不**进入 `src/vs/server/`。vscode-server 若要提供浏览器 UI，复用的是本层 `browser/workbench` 的 HTML，而不是再写一套桌面壳。

## 目标环境拆分

本层没有 `common/`：每段代码都贴着一个明确运行时。高环境可依赖更低环境，规则见 [分层规则](../../architecture/cross-cutting/layers.md)。

- **`electron-main/`** — 唯一允许碰完整 Electron main API 的入口。单实例、窗口、协议、把 channel 挂到 main 并转给 shared。开发桌面：`scripts/code.sh` 预编译后 `exec` `.build/electron/...`。
- **`electron-browser/`** — 沙箱 renderer。`workbench.ts` 做 splash 与 `performance.mark`，然后把控制权交给 `IDesktopMain`。这里可以 IPC，不能当 Node 用。
- **`electron-utility/`** — shared process。main 在**第一个窗口要连接时**才 `UtilityProcess.start`，入口 `sharedProcessMain.ts`。跨窗口服务（扩展管理、同步、telemetry 等）住在这里，不是 main，也不是某个 renderer。
- **`node/`** — 桌面 CLI。可 `ELECTRON_RUN_AS_NODE`（`scripts/code-cli.sh`）。帮助 / 版本在本进程结束；扩展操作进 `CliMain`；默认清掉该环境变量再 `spawn(process.execPath)` 进入 main。
- **`browser/`** — 纯浏览器 workbench embedder（`create()` → `workbench.web.main.internal.ts`）。桌面产品不走这条；Web 客户端与 vscode-server 的可选 UI 走这条。

入口文件与类名的清单见 [INDEX](INDEX.md)，进程边见 [进程模型概览](../../systems/processes/overview.md) 的「桌面 `scripts/code.sh`」子图。

## 本层不拥有什么

编辑器组、视图容器、contrib、Extension API 实现都属于 [workbench](../workbench/overview.md)。扩展进程与 pty 的**入口文件**在 `workbench/api` 与 `platform/terminal`；桌面只负责用 `ExtensionHostStarter` / `ElectronPtyHostStarter` 把它们变成 UtilityProcess。跨窗口单例的业务实现大多在 platform / workbench services，本层只提供 shared 进程壳。

## 相关文档

- [code 索引](INDEX.md) · [server 概览](../server/overview.md)
- [进程模型概览](../../systems/processes/overview.md) · [Processes 索引](../../systems/processes/INDEX.md)
- [workbench](../workbench/overview.md) · [分层规则](../../architecture/cross-cutting/layers.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
