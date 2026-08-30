---
title: "chat 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "workbench/contrib/chat 虚拟模块导航：ChatWidget、模型/服务、工具、编辑会话、participants"
---

# chat 索引

> **虚拟模块**：chat 是 `workbench/contrib` 功能包，**不是** `src/vs/` 独立分层。分层规则仍走 workbench → sessions；本目录只把最大 contrib 抽成导航入口。

## 模块信息

- **源码**: `src/vs/workbench/contrib/chat/`（另有薄层 `src/vs/platform/chat/`）
- **职责**: 对话 UI、会话模型、participant（代码里常称 agent）、语言模型工具、编辑会话
- **依赖方向**: 作为 workbench contrib，可依赖 `workbench` / `editor` / `platform` / `base`；**不可**被更低层导入。`sessions` 可消费本 contrib；反向禁止
- **文件夹地图 SSOT**: [`chatCodeOrganization.md`](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)（`browser/` / `common/` 职责以该文为准，不在此复制）

## 关键入口

| 入口 | 说明 |
|------|------|
| [overview.md](overview.md) | 虚拟模块职责与边界（系统协作见 systems/chat） |
| `browser/chat.ts` | `IChatWidget`、`IChatWidgetService` 契约 |
| `browser/widget/chatWidget.ts` | `ChatWidget` 实现；列表/输入等须由 Widget 直接引用 |
| `browser/widgetHosts/` | 嵌入宿主：`ChatViewPane`、`ChatEditor`、`chatQuick` |
| `browser/chat.shared.contribution.ts` | 共享 DI 注册：`IChatService`、`IChatAgentService`、`ILanguageModelToolsService`、`IChatEditingService` 等 |
| `common/chatService/` | `IChatService` / `ChatService`：发请求、会话生命周期 |
| `common/model/` | `IChatModel`、`ChatViewModel`、会话存储 |
| `common/participants/` | `IChatAgentService`：participant / agent 注册与调用 |
| `common/tools/` | `ILanguageModelToolsService`；`builtinTools/` 内置工具 |
| `common/editing/` + `browser/chatEditing/` | `IChatEditingService` / `ChatEditingSession` |
| `platform/chat/common/` | 跨层设置与常量（如 `ChatAIDisabledSettingId`、`AI_AGENT`） |

## 所属系统

| 系统 | 链接 |
|------|------|
| Chat | [系统索引](../../systems/chat/INDEX.md) · [概览](../../systems/chat/overview.md) |
| Workbench | [模块](../workbench/INDEX.md)（宿主分层） |
| Sessions | [系统](../../systems/sessions/INDEX.md)（Agents Window 消费 chat，不在此展开） |
| Platform | [模块](../platform/INDEX.md)（`platform/chat` 设置层） |

## 相关文档

- 文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)
- [全局索引](../../INDEX.md)
- [文档规范](../../DOCS-SPEC.md)
