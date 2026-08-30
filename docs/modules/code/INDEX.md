---
title: "code 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "Electron 桌面入口：main、renderer、shared process、CLI 与 Web embedder"
---

# code 索引

> 返回 [全局索引](../../INDEX.md) · 进程协作见 [系统：Processes](../../systems/processes/INDEX.md) · 工作台本体见 [modules/workbench](../workbench/INDEX.md)

## 模块信息

- **源码**: `src/vs/code/`
- **职责**: 桌面产品入口。把 Electron main / renderer / utility 进程和 Node CLI 接到 `workbench`，本身几乎不承载 IDE 业务
- **依赖方向**: 可依赖 `workbench` 及以下。与 `server`、`sessions` 并列，不是互相堆叠的下一层

仓库根 `src/main.ts`、`src/cli.ts` 只做引导，再 `import` 本层。开发脚本：`scripts/code.sh`（桌面）、`scripts/code-cli.sh`（`ELECTRON_RUN_AS_NODE` + `out/cli.js`）、`scripts/code-web.sh`（`@vscode/test-web`，走 browser workbench，不是 vscode-server）。

## 关键入口

| 入口 | 说明 |
|------|------|
| [overview.md](overview.md) | 桌面入口层职责与进程装配 |
| `electron-main/main.ts` | `CodeMain`：单实例 IPC、服务初始化，再 `CodeApplication.startup()` |
| `electron-main/app.ts` | `CodeApplication`：窗口、shared process、IPC channel、协议 URL |
| `electron-browser/workbench/workbench.html` | Renderer 壳；dev 用 `workbench-dev.html` |
| `electron-browser/workbench/workbench.ts` | Renderer 引导：splash → `import` `workbench.desktop.main.ts` → `IDesktopMain.main()` |
| `electron-utility/sharedProcess/sharedProcessMain.ts` | Shared process：`SharedProcessMain`，由 main 以 Electron `UtilityProcess` 拉起 |
| `node/cli.ts` | 桌面 CLI：帮助 / 版本、扩展管理、或 `spawn` Electron |
| `node/cliProcessMain.ts` | CLI 子路径：`--list-extensions` 等，不启动工作台 |
| `browser/workbench/workbench.ts` | Web embedder：`create()` → `workbench.web.main.internal.ts`；vscode-server 有 web client 时也用这里的 HTML |

`CodeWindow.load()`（`platform/windows/electron-main/windowImpl.ts`）默认加载本层 `workbench.html`。`configuration.isSessionsWindow` 时改加载 `vs/sessions/electron-browser/sessions.html`，那是 sessions 窗口，不是本层。

## 目标环境子目录

| 子目录 | 运行时 |
|--------|--------|
| `electron-main/` | Electron main |
| `electron-browser/` | 桌面 renderer（沙箱 + 有限 IPC） |
| `electron-utility/` | Shared process（utility process） |
| `node/` | CLI（可 `ELECTRON_RUN_AS_NODE`） |
| `browser/` | 纯浏览器 workbench embedder |

## 所属系统

| 系统 | 链接 |
|------|------|
| Processes | [systems/processes](../../systems/processes/INDEX.md) |
| Workbench | [systems/workbench](../../systems/workbench/INDEX.md) |
| Extension API | [systems/extension-api](../../systems/extension-api/INDEX.md) |

## 相关文档

- [server 模块](../server/INDEX.md)（远程服务端入口，不是桌面）
- [workbench 模块](../workbench/INDEX.md)
- [进程概览](../../systems/processes/overview.md)
- [分层规则](../../architecture/cross-cutting/layers.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
