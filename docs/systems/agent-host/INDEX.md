---
title: "Agent Host 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "跨层 Agent Host：AHP 协议、宿主进程、IAgentHostService，以及 Chat / Sessions 两套 facade"
---

# Agent Host

VS Code 侧的 Agent Host 是独立进程加上 **Agent Host Protocol（AHP）**：renderer / Agents Window 经 platform 服务连上宿主，再由 Chat 与 Sessions 各自投影成自己的会话 facade。它**不是** B2 的 session-core；引擎权威是 UniverseAgent。

## 涉及分层

- **platform**（`src/vs/platform/agentHost/`）：协议包装、连接契约、按宿主形态拆分的服务标识；就近规格 [AGENTS.md](../../../src/vs/platform/agentHost/AGENTS.md)
- **code** electron-main：`ElectronAgentHostStarter` + `AgentHostProcessManager` 拉起本地 UtilityProcess
- **workbench**：`IAgentHostService` 单例装配；Chat contrib 把 AHP 接到 `IChatSessionsService`
- **sessions**：`LocalAgentHostSessionsProvider` 把同一条连接接到 `ISessionsProvider`；规格 SSOT 见下表
- **processes**：本宿主是额外的 utility / remote 进程，不是 Processes 一等表里的 main / EH / pty；见 [Processes](../processes/INDEX.md)

## 设计目标

- 用 AHP（JSON-RPC + `subscribe` / `dispatchAction` 状态同步）把编排放进宿主进程，崩溃面与 renderer 分开
- 工作台只持有连接与生命周期（`IAgentHostService`），不在 UI 层实现 harness
- 同一条 `IAgentConnection` 供 Chat 与 Sessions **两套 facade** 消费，互不替代对方的模型
- 远端（SSH / WSL / tunnel / cloud sandbox）复用 `IAgentConnection`，注册表在 `IRemoteAgentHostService`

## 模块协作

| 分层 | 职责 | 关键符号 |
|------|------|----------|
| `platform/agentHost/common` | 契约、IPC 通道名、生成协议包装 | `IAgentService`、`IAgentConnection`、`IAgentHostService`、`AgentHostIpcChannels` |
| `platform/agentHost/node` | 宿主进程编排与 `IAgent` harness | `AgentService`、`agentHostMain`、`IAgent` |
| `platform/agentHost/electron-main` | 桌面 UtilityProcess 启动 | `ElectronAgentHostStarter`、`AgentHostProcessManager` |
| workbench services | 窗口 ambient 连接装配 | `WorkbenchAgentHostService`、`LocalAgentHostServiceClient`、`EditorRemoteAgentHostServiceClient` |
| workbench Chat facade | `IChatSessionsService` 投影 | `AgentHostContribution`、`AgentHostSessionHandler` |
| sessions facade | `ISessionsProvider` 投影 | `LocalAgentHostSessionsProvider`、`BaseAgentHostSessionsProvider` |
| 远端形态 | 每连接一条 `IAgentConnection` | `IRemoteAgentHostService`、`ISSHRemoteAgentHostService`、`IWSLRemoteAgentHostService`、`ITunnelAgentHostService`、`ICloudSandboxAgentHostService` |

## 两套 facade

| Facade | 注册到 | 权威规格 |
|--------|--------|----------|
| workbench Chat | `IChatSessionsService`（`agent-host-<provider>` session type） | [Chat 系统](../chat/INDEX.md) · [agent-ui](../chat/agent-ui.md) |
| Sessions `agentHost` | `ISessionsProvidersService`（provider id `local-agent-host`） | [AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/agentHost/AGENT_HOST_SESSIONS_PROVIDER.md)（**SSOT，勿复制**） |

远端 Sessions 变体见 [REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/remoteAgentHost/REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md)。

## 分析（B2）

UniverseAgent 是引擎与 session-core 权威。本系统只描述 **vscode 侧进程 / AHP**。`IChatModel` 与 `ISession` 都是投影，**禁止**当 UA session-core。对照 [agent-ui](../chat/agent-ui.md) 与 [code-oss-b2](../../reference/code-oss-b2/INDEX.md)。

## 相关文档

- [系统概览](overview.md)
- [platform 模块](../../modules/platform/INDEX.md) · [platform 概览](../../modules/platform/overview.md)
- [Sessions 系统](../sessions/INDEX.md) · [Chat 系统](../chat/INDEX.md) · [Processes](../processes/INDEX.md)
- 宿主多聊编排：[AGENTS.md](../../../src/vs/platform/agentHost/AGENTS.md)
- 协议包装与同步：[common/state/AGENTS.md](../../../src/vs/platform/agentHost/common/state/AGENTS.md)
