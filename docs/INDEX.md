---
title: "VS Code 文档索引"
type: concept
status: accepted
phase: N/A
updated: 2026-10-30
summary: "全局文档导航：产品需求、设计原则、文档系统设计、架构、开发规范、决策、分层模块、跨层系统、B2 壳分析与行动层"
---

# 文档索引

> 本文件为人工维护的全局导航入口。结构变更后请同步更新相关索引，并运行 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。[查看文档介绍 →](README.md)

## 什么时候读

| 什么时候 | 读 |
|----------|-----|
| 看产品目标与怎样算成功 | [产品需求](product/INDEX.md) |
| 设计原则 | [文档系统原则](principles/document-system.md) |
| 文档放哪、知识与过程怎么分 | [文档系统设计](design/document-system.md) |
| 了解整体架构 | [架构概览](architecture/overview.md) |
| 开发规范 | [development](standards/development.md) |
| 写法 | [writing](standards/writing.md) |
| 文档系统决策与存量 ADR | [wiki 采用](decisions/wiki-adoption.md) · [dev/decisions](../dev/decisions/INDEX.md) |
| 过程（进度、计划、路线图） | [dev/INDEX.md](../dev/INDEX.md) |
| 看分层与 import 规则 | [分层规则](architecture/cross-cutting/layers.md) |
| 找某一层入口 | [分层列表](#分层模块) |
| B2 改壳 / Agent UI 分析 | [code-oss-b2](reference/code-oss-b2/INDEX.md) |
| 写文档怎么落盘 | [维护规则](DOCUMENTATION.md) · [文档系统设计](design/document-system.md) |

## 两条阅读路径

改默认窗口的会话时间线时，按这个顺序读：

| 要确认的事 | 读 |
|---|---|
| 产品要什么 | [需求](product/requirements.md) 里的 PRD-001、PRD-003 |
| 视觉约束 | [UI 设计原则](architecture/cross-cutting/ui-design-principles.md) |
| 现在怎么接 | [Conversation](systems/conversation/INDEX.md) |
| 代码 | `src/vs/workbench/contrib/conversation/` |
| 测试 | `src/vs/workbench/contrib/conversation/test/` |

文档新建、归档或改维护规则时，按这个顺序读：

| 要确认的事 | 读 |
|---|---|
| 硬规则 | [AGENTS.md](../AGENTS.md) |
| 目录和命令 | [文档系统](design/document-system.md) |
| 维护行为 | [DOCUMENTATION.md](DOCUMENTATION.md) |
| 取舍 | [接入决策](decisions/wiki-adoption.md) |

Diff 的打开位置同时约束 Conversation 和 Sources。先读 [ADR-005](../dev/decisions/005-changes-diff-owner.md) 和 [Sources 概览](systems/sources/overview.md)，再改其中一侧。

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
| **Conversation** | [索引](systems/conversation/INDEX.md) | 产品中心：`CONVERSATION_PART` + `contrib/conversation`；session 窗口、透镜 / 轨迹、Composer / Inbox、stub 契约、命令 |
| **Sources** | [索引](systems/sources/INDEX.md) | End 列下格 Files \| Changes \| Review 列表投影 |
| Sessions | [索引](systems/sessions/INDEX.md) | Agents Window；就近 SSOT 在 `src/vs/sessions/` |
| Chat | [索引](systems/chat/INDEX.md) | Chat 模型、工具、编辑会话 |
| Extension API | [索引](systems/extension-api/INDEX.md) | `vscode.d.ts`、extension host |
| Processes | [索引](systems/processes/INDEX.md) | main / renderer / shared / ext host / server |
| Agent Host | [索引](systems/agent-host/INDEX.md) | `platform/agentHost` 协议与本地 agent 进程 |

## 分类索引

| 类别 | 链接 |
|------|------|
| 产品需求 | [入口](product/INDEX.md) · [愿景](product/vision.md) · [需求](product/requirements.md) · [追踪](product/traceability.md) |
| 架构 | [概览](architecture/overview.md) · [横切](architecture/cross-cutting/INDEX.md) · [分层](architecture/cross-cutting/layers.md) · [IPC](architecture/cross-cutting/ipc.md) · [DI](architecture/cross-cutting/instantiation.md) · [启动](architecture/cross-cutting/startup.md) · [UI 设计规范](architecture/cross-cutting/ui-design-principles.md) · [外部对话界面密度](reference/external-chat-ui-density.md) |
| 指南 | [指南索引](guides/INDEX.md) · [快速开始](guides/getting-started.md) · [文体](guides/doc-style-guide.md) · [壳冒烟验证](guides/shell-smoke-verification.md) · [Agents 测试配置](guides/test-profile.md) · [钉死引擎调试](guides/debug-engine.md) |
| 产品壳系统 | [Conversation](systems/conversation/INDEX.md) · [Sources](systems/sources/INDEX.md) · [命令与快捷键](systems/conversation/commands.md) · [会话数据契约](systems/conversation/stub-and-fixtures.md) |
| B2 / 壳分析 | [索引](reference/code-oss-b2/INDEX.md) · [缺口](reference/code-oss-b2/gap-vs-desktop-shell.md) · [Parts/Grid](systems/workbench/parts-and-grid.md) · [Agent UI](systems/chat/agent-ui.md) · [Settings 接入](reference/code-oss-b2/settings-ua-access.md) · [会话列表](reference/code-oss-b2/session-roster-reuse.md) · [透镜组装](reference/code-oss-b2/conversation-lens-assembly.md) · [Navigator tab](reference/code-oss-b2/navigator-tabs-access.md) |
| 引擎参考 | [UniverseAgent 索引](reference/universe-agent/INDEX.md) · [协议面](reference/universe-agent/engine-protocol-surface.md) · [功能缺口](reference/universe-agent/ide-engine-feature-gaps.md) · [Engine catalog](systems/workbench/engine-catalog.md) · [钉死引擎调试](guides/debug-engine.md) · [外部多 Agent 设计对照](reference/external-multi-agent-design.md) |
| 术语 | [glossary](glossary.md) |
| 行动层 | [dev/INDEX.md](../dev/INDEX.md) · [progress](../dev/progress/INDEX.md) · [plans](../dev/plans/INDEX.md) · [roadmap](../dev/roadmap/INDEX.md) · [ADR](../dev/decisions/INDEX.md) |
| 上游约定 | [Copilot Instructions](../.github/copilot-instructions.md) · [Source organization](../.github/instructions/source-code-organization.instructions.md) |
