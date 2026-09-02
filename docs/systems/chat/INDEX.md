---
title: "Chat 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "跨层 Chat：contrib 模型/UI、宿主清单、Copilot 边界、sessions 窗口消费；产品 Conversation 系统正文另见 systems/conversation"
---

# Chat

对话与 agent 工具链：workbench contrib 持有模型与 Widget，platform 只放跨层设置，sessions（Agents Window）在更高层复用同一套服务。

## 涉及分层

- **platform**：`src/vs/platform/chat/` — 设置键与进程环境约定，无会话模型
- **workbench**：`src/vs/workbench/contrib/chat/` — 虚拟模块本体；`workbench/services/chat` 仅 entitlement
- **sessions**：消费 `IChatService` / `IChatWidgetService`；窗口侧 UI 在 `src/vs/sessions/contrib/chat/`。契约 SSOT 仍在 `src/vs/sessions/`，见 [Sessions 系统](../sessions/INDEX.md)

chat **不是** `vs/` 层；import 方向仍是 workbench contrib ← sessions。

## 设计目标

- 一次会话模型（`IChatModel`）可被多个宿主 Widget 打开
- participant、工具、编辑会话与 UI 解耦，经 `IChatService` 编排
- 文件夹职责以 [chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md) 为 SSOT

## 模块协作

| 分层 | 职责 | 关键符号 |
|------|------|----------|
| platform | 禁用 AI、编辑自动批准、`AI_AGENT` 环境变量、归档文案 | `ChatAIDisabledSettingId`、`AiAgentEnvValue` |
| workbench services | 账号/额度门闩 | `IChatEntitlementService` |
| workbench contrib `common/` | 会话、participant、工具、编辑契约 | `IChatService`、`IChatAgentService`、`ILanguageModelToolsService`、`IChatEditingService` |
| workbench contrib `browser/` | Widget、宿主、编辑会话实现 | `ChatWidget`、`ChatViewPane`、`ChatEditingSession` |
| sessions | Agents Window 编排与窗口特有 chat contrib | `ISessionsService`（详见 sessions 就近规格） |

## 分析（B2）

- [Agent UI 清单](agent-ui.md) — Widget / 宿主 / Sessions Part / INV-TOPO / Copilot 边界
- [Widget 零件](widget-parts.md) — 列表、输入、content parts（Input Dock donor）
- [工具与编辑会话](tools-and-editing.md) — tools / ChatEditingSession
- [会话列表复用](../../reference/code-oss-b2/session-roster-reuse.md) · [透镜组装](../../reference/code-oss-b2/conversation-lens-assembly.md) — 页面接入分析（对照参考；系统正文在 [Conversation 系统](../conversation/INDEX.md)）
- 空会话 / 输入面：[conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)（implemented · PRD-015）
- session 窗口 / chat tab：[conversation-session-windows](../../../dev/plans/conversation-session-windows.md)（S1–S6 implemented · PRD-016 · [ADR-002](../../../dev/decisions/002-conversation-session-windows.md)）

## 产品 Conversation（不在本系统）

默认窗中心 `CONVERSATION_PART` 与 `contrib/conversation` 是**独立系统**，不是 Chat contrib 的宿主之一：见 [Conversation 系统](../conversation/INDEX.md)。本系统只回答 Copilot Chat 的模型、Widget 与宿主，以及它们在默认窗被藏或转的边界（[agent-ui §3 / §5](agent-ui.md)）。

## 相关文档

- [概览](overview.md)
- [chat 模块索引](../../modules/chat/INDEX.md)
- [workbench 模块](../../modules/workbench/INDEX.md) · [platform 模块](../../modules/platform/INDEX.md)
- [Sessions 系统](../sessions/INDEX.md)
- 文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)
