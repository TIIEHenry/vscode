---
title: "Sessions 模块索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "vs/sessions（Agents Window）分层导航：入口、依赖方向与权威规格路由"
---

# Sessions 索引

> 设计正文以就近 SSOT 为准，本页只做导航。子系统索引：[src/vs/sessions/README.md](../../../src/vs/sessions/README.md)

## 模块信息

- **源码**: `src/vs/sessions/`
- **职责**: Agents Window 顶层实现：provider-neutral 的 session/chat 模型、窗口布局、侧栏列表，以及 `contrib/providers/` 下的计算后端适配
- **依赖方向**: 可依赖 `vs/workbench` 及更低层；`vs/workbench` **不得** import `vs/sessions`。层内规则见 [LAYERS.md](../../../src/vs/sessions/LAYERS.md)

## 关键入口

| 入口 | 说明 |
|------|------|
| [overview.md](overview.md) | 本层职责、目录与依赖（规格正文仍以就近 SSOT 为准） |
| `sessions.common.main.ts` | 全平台共享 contribution 装配 |
| `sessions.desktop.main.ts` | 桌面（`electron-browser`），import common |
| `sessions.web.main.ts` | Web，import common |
| `sessions.web.main.internal.ts` | Web 内部变体，import `sessions.web.main` |
| `electron-browser/sessions.ts` | 桌面 renderer 引导；import 约束比 core 更严 |
| `browser/`、`common/` | Sessions core（`sessions/~`） |
| `services/` | 共享服务接口与实现 |
| `contrib/` | 非 provider 功能（chat、list、layout、changes 等） |
| `contrib/providers/` | `agentHost`、`copilotChatSessions`、`remoteAgentHost` |

Contribution 必须由对应的 `sessions.*.main.ts` 引用才会加载。非 provider contribution **不得** import provider 实现。

## 权威规格

| 领域 | 权威文档 |
|------|----------|
| 层内层级与 import 规则 | [LAYERS.md](../../../src/vs/sessions/LAYERS.md) |
| Session/chat 模型、服务、provider 契约与主数据流 | [SESSIONS.md](../../../src/vs/sessions/SESSIONS.md) |
| Workbench parts、grid、title bar、editor 呈现 | [LAYOUT.md](../../../src/vs/sessions/LAYOUT.md) |
| 按 session 捕获与恢复布局 | [LAYOUT_CONTROLLER.md](../../../src/vs/sessions/LAYOUT_CONTROLLER.md) |
| Single-pane 行为场景 | [SINGLE_PANE_SCENARIOS.md](../../../src/vs/sessions/SINGLE_PANE_SCENARIOS.md) |
| Sessions 侧栏列表 | [SESSIONS_LIST.md](../../../src/vs/sessions/SESSIONS_LIST.md) |
| Phone 布局与移动组件 | [MOBILE.md](../../../src/vs/sessions/MOBILE.md) |
| AI customizations | [AI_CUSTOMIZATIONS.md](../../../src/vs/sessions/AI_CUSTOMIZATIONS.md) |
| Copilot customizations | [copilot-customizations-spec.md](../../../src/vs/sessions/copilot-customizations-spec.md) |
| Copilot Chat provider | [COPILOT_CHAT_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/copilotChatSessions/COPILOT_CHAT_SESSIONS_PROVIDER.md) |
| Agent Host provider | [AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/agentHost/AGENT_HOST_SESSIONS_PROVIDER.md) |
| Remote Agent Host provider | [REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/remoteAgentHost/REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md) |

其它本目录 Markdown（`skills/*/SKILL.md`、`test/**/*.md`、代码旁状态机说明）不是子系统架构规格，不要当成通用 Sessions 指南。开发原则与路由见 [.github/skills/sessions/SKILL.md](../../../.github/skills/sessions/SKILL.md)。

## 所属系统

| 系统 | 链接 |
|------|------|
| Sessions | [系统索引](../../systems/sessions/INDEX.md) · [概览](../../systems/sessions/overview.md) |
| Chat | [系统索引](../../systems/chat/INDEX.md) |
| Processes | [系统索引](../../systems/processes/INDEX.md) |

## 相关文档

- [全局索引](../../INDEX.md)
- [源码分层约定](../../../.github/instructions/source-code-organization.instructions.md)
- [横切分层规则](../../architecture/cross-cutting/layers.md)
- [Workbench 模块](../workbench/INDEX.md)
