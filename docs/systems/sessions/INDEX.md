---
title: "Sessions 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "Agents Window 跨层协作导航：分层方向、共享服务与三类 provider"
---

# Sessions

Agents Window 是跨 `sessions` / `workbench` / `platform` 的运行时系统：窗口与编排在 `vs/sessions`，可复用的 workbench 能力向下依赖，计算后端由 provider 适配。契约正文见 [src/vs/sessions/README.md](../../../src/vs/sessions/README.md)，本页只标协作边界。

## 涉及分层

- **sessions**（`src/vs/sessions/`）：窗口层；**可以** import `vs/workbench` 及更低层
- **workbench**：被 sessions 复用（parts、services、部分 `contrib`）；**不得** import `vs/sessions`
- **platform**：`IAgentHostService`、remote agent host 等连接与协议基础
- **chat**（虚拟模块，`workbench/contrib/chat`）：编辑器侧 Chat / customizations 共享面；见 [Chat 系统](../chat/INDEX.md)
- **processes**：桌面 renderer（`electron-browser/sessions.ts`）、web 引导、Agent Host 进程；见 [Processes 系统](../processes/INDEX.md)

层内 `core` / `services` / `contrib` / `contrib/providers` 的 import 图以 [LAYERS.md](../../../src/vs/sessions/LAYERS.md) 为 SSOT。

## 设计目标

- 用 provider-neutral 的 `ISession` / `IChat` 聚合多种计算后端，共享 UI 不绑定 provider 标识
- 服务分层：注册表、模型编排、可见/激活态分开持有（见 [SESSIONS.md](../../../src/vs/sessions/SESSIONS.md)）
- 布局与列表是 Sessions 自有呈现，不把 workbench 默认 Activity Bar / Status Bar 拓扑照搬进来
- Provider 实现隔离：非 provider contribution 不得依赖 `contrib/providers/*`

## 模块协作

| 分层 | 职责 | 关键符号 |
|------|------|----------|
| sessions core | 窗口壳、主题/尺寸、desktop/web 引导 | `sessions.*.main.ts`、`electron-browser/sessions.ts` |
| sessions services | 注册表、模型编排、可见态 | `ISessionsProvidersService`、`ISessionsManagementService`、`ISessionsService` |
| sessions contrib | 列表、layout、changes、chat 呈现等 | `SessionsView`、layout controllers |
| sessions providers | 把后端 session 适配成共享契约 | `ISessionsProvider`：`agentHost`、`copilotChatSessions`、`remoteAgentHost` |
| workbench | 被复用的 parts / services / 部分 contrib | 禁止反向 import |
| platform | Agent Host 连接与 remote 条目 | `IAgentHostService`、`IRemoteAgentHostService` |
| chat | 编辑器 Chat 与 AI customizations 共享实现 | 见 [Chat](../chat/INDEX.md)；Agents Window 侧贡献见 [AI_CUSTOMIZATIONS.md](../../../src/vs/sessions/AI_CUSTOMIZATIONS.md) |

## Provider

| Provider | 目录 | 权威规格 |
|----------|------|----------|
| Agent Host（本地） | `contrib/providers/agentHost/` | [AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/agentHost/AGENT_HOST_SESSIONS_PROVIDER.md) |
| Copilot Chat | `contrib/providers/copilotChatSessions/` | [COPILOT_CHAT_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/copilotChatSessions/COPILOT_CHAT_SESSIONS_PROVIDER.md) |
| Remote Agent Host | `contrib/providers/remoteAgentHost/` | [REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/remoteAgentHost/REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md) |

共享契约是 `ISessionsProvider`；后端 URI、传输、鉴权留在各自 contribution。

## 相关文档

- [系统概览](overview.md) — 一页定向
- [Sessions 模块索引](../../modules/sessions/INDEX.md) — 权威规格全表
- [SESSIONS.md](../../../src/vs/sessions/SESSIONS.md) · [LAYERS.md](../../../src/vs/sessions/LAYERS.md) · [LAYOUT.md](../../../src/vs/sessions/LAYOUT.md)
- [Chat 系统](../chat/INDEX.md)
- [Processes 系统](../processes/INDEX.md)
- [Workbench 系统](../workbench/INDEX.md)
