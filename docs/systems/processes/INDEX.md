---
title: "Processes 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "跨层进程：main、renderer、shared、extension host、pty host、CLI、vscode-server"
---

# Processes

> 返回 [全局索引](../../INDEX.md) · 设计正文见 [进程概览](overview.md) · 桌面入口 [modules/code](../../modules/code/INDEX.md) · 服务端入口 [modules/server](../../modules/server/INDEX.md)

## 涉及分层

- `code` — 桌面 main / renderer / shared / CLI
- `server` — vscode-server 与远端 fork
- `workbench` — renderer 内工作台；extension host 实现在 `workbench/api`
- `platform` — 进程启动器（`UtilityProcess`、`ExtensionHostStarter`、`PtyHostStarter`）与远程连接类型
- `extensions` — 跑在 extension host 内，经 [Extension API](../extension-api/INDEX.md) 接到 workbench

## 设计目标

- 把 UI（renderer）、扩展（extension host）、伪终端（pty host）、跨窗口后台工作（shared）拆开，降低崩溃面
- 桌面用 Electron main 做进程编排；远程把同一套 extension host / pty host 入口放到 vscode-server 侧 fork
- CLI 与 GUI 共用产品参数，但扩展管理等路径不拉起工作台

## 模块协作

| 分层 | 职责 | 关键符号 |
|------|------|----------|
| `code` electron-main | 单实例、窗口、拉起 shared / 暴露 starter channel | `CodeMain`、`CodeApplication`、`SharedProcess` |
| `code` electron-browser | 桌面 renderer 引导 | `workbench.ts` → `workbench.desktop.main.ts` |
| `code` electron-utility | Shared process 服务与清理 contrib | `SharedProcessMain` |
| `code` node | 桌面 CLI | `cli.ts`、`CliMain`（`cliProcessMain.ts`） |
| `platform` | 进程实现与 IPC | `UtilityProcess`、`ExtensionHostStarter`、`ElectronPtyHostStarter`、`NodePtyHostStarter` |
| `workbench` | 工作台与本地 EH 请求 | `IDesktopMain`、`NativeLocalProcessExtensionHost` |
| `workbench/api` | Extension host 进程入口 | `extensionHostProcess.ts` |
| `server` | vscode-server 与远端 fork | `RemoteExtensionHostAgentServer`、`ExtensionHostConnection` |

未列入上表、但源码里存在的其它 utility / worker（例如 main 里的 agent host starter、renderer 内 `LocalWebWorker` extension host）不是本系统的一等进程，详见 [概览](overview.md) 边界说明。

## 相关文档

- [进程概览](overview.md)
- [modules/code](../../modules/code/INDEX.md) · [modules/server](../../modules/server/INDEX.md)
- [modules/workbench](../../modules/workbench/INDEX.md) · [Extension API](../extension-api/INDEX.md)
- [架构概览](../../architecture/overview.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
