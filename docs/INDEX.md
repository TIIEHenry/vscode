---
title: "VS Code 文档索引"
type: concept
status: accepted
phase: N/A
updated: 2026-08-30
summary: "全局文档导航入口：分层模块、跨层系统、B2 壳/Agent UI 分析、行动层"
---

# 文档索引

> 本文件为人工维护的全局导航入口。结构变更后请同步更新相关索引，并运行 `python3 scripts/check-docs-health.py`。[查看文档介绍 →](README.md)

## 快速入口

| 我想... | 去这里 |
|----------|--------|
| 了解整体架构 | [架构概览](architecture/overview.md) |
| 看分层与 import 规则 | [分层规则](architecture/cross-cutting/layers.md) |
| 找某一层入口 | [分层列表](#分层模块) |
| 看架构决策 | [ADR](../dev/decisions/INDEX.md) |
| 看当前进度 | [status](../dev/progress/status.md) |
| B2 改壳 / Agent UI 分析 | [code-oss-b2](reference/code-oss-b2/INDEX.md) |
| 写文档怎么落盘 | [维护规则](DOCUMENTATION.md) |

## 分层模块

| 模块 | 职责 | 源码 | 索引 |
|------|------|------|------|
| **base** | 无服务依赖的工具与 UI 积木 | `src/vs/base/` | [INDEX](modules/base/INDEX.md) |
| **platform** | DI 与跨层基础服务 | `src/vs/platform/` | [INDEX](modules/platform/INDEX.md) |
| **editor** | Monaco 编辑器核心 | `src/vs/editor/` | [INDEX](modules/editor/INDEX.md) |
| **workbench** | 工作台框架、services、contrib | `src/vs/workbench/` | [INDEX](modules/workbench/INDEX.md) |
| **sessions** | Agents Window（高于 workbench） | `src/vs/sessions/` | [INDEX](modules/sessions/INDEX.md) |
| **code** | Electron 桌面入口 | `src/vs/code/` | [INDEX](modules/code/INDEX.md) |
| **server** | 远程开发服务端入口 | `src/vs/server/` | [INDEX](modules/server/INDEX.md) |
| **chat** | Chat contrib（虚拟模块） | `src/vs/workbench/contrib/chat/` | [INDEX](modules/chat/INDEX.md) |
| **workbench-api** | Extension API 实现（虚拟模块） | `src/vs/workbench/api/` | [INDEX](modules/workbench-api/INDEX.md) |

## 系统文档

| 系统 | 索引 | 说明 |
|------|------|------|
| Editor | [索引](systems/editor/INDEX.md) | 编辑器核心与语言服务协作 |
| Workbench | [索引](systems/workbench/INDEX.md) | 布局、parts、services、contrib |
| Sessions | [索引](systems/sessions/INDEX.md) | Agents Window；就近 SSOT 在 `src/vs/sessions/` |
| Chat | [索引](systems/chat/INDEX.md) | Chat 模型、工具、编辑会话 |
| Extension API | [索引](systems/extension-api/INDEX.md) | `vscode.d.ts`、extension host |
| Processes | [索引](systems/processes/INDEX.md) | main / renderer / shared / ext host / server |
| Agent Host | [索引](systems/agent-host/INDEX.md) | `platform/agentHost` 协议与本地 agent 进程 |

## 分类索引

| 类别 | 链接 |
|------|------|
| 架构 | [概览](architecture/overview.md) · [横切](architecture/cross-cutting/INDEX.md) · [分层](architecture/cross-cutting/layers.md) · [IPC](architecture/cross-cutting/ipc.md) · [DI](architecture/cross-cutting/instantiation.md) · [启动](architecture/cross-cutting/startup.md) |
| 指南 | [指南索引](guides/INDEX.md) · [快速开始](guides/getting-started.md) · [文体](guides/doc-style-guide.md) |
| B2 / 壳分析 | [索引](reference/code-oss-b2/INDEX.md) · [缺口](reference/code-oss-b2/gap-vs-desktop-shell.md) · [Parts/Grid](systems/workbench/parts-and-grid.md) · [Agent UI](systems/chat/agent-ui.md) |
| 术语 | [glossary](glossary.md) |
| 行动层 | [dev/](../dev/README.md) · [progress](../dev/progress/INDEX.md) · [plans](../dev/plans/INDEX.md) · [ADR](../dev/decisions/INDEX.md) |
| 上游约定 | [Copilot Instructions](../.github/copilot-instructions.md) · [Source organization](../.github/instructions/source-code-organization.instructions.md) |
