---
title: "Agent Host 系统概览"
type: overview
status: accepted
phase: N/A
updated: 2026-09-02
summary: "AHP 是 vscode 侧宿主进程协议；IAgentHostService 连进程；UA gRPC adapter 在 platform/universeAgent（AHP 仍非会话权威）；Chat 与 Sessions 是两套 facade"
---

# Agent Host 系统概览

> 导航见 [系统索引](INDEX.md)。Sessions 侧适配以 [AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/agentHost/AGENT_HOST_SESSIONS_PROVIDER.md) 为 **SSOT**，下文只定向、不复述 provider 契约。多聊编排就近规格：[platform/agentHost/AGENTS.md](../../../src/vs/platform/agentHost/AGENTS.md)。

Agent Host 是本仓库里的 **vscode 侧进程与协议**：独立宿主跑 `IAgent` harness（Copilot / Claude / Codex），工作台与 Agents Window 经 MessagePort / 远端代理说话。它**不是** B2 的 session-core；UniverseAgent 才是引擎权威。

**UniverseAgent 传输 adapter** 在 `src/vs/platform/universeAgent/`（`IUniverseAgentConnection` + node gRPC 客户端 + electron-main ProxyChannel；见 [ADR-003](../../../dev/decisions/003-engine-adapter-boundary.md)）。Conversation roster 同 token 替换在 `contrib/conversation`。**AHP（`IAgentHostService`）仍非 UA 会话权威**——StatusBar / Engine 页 / roster 活数据只看 UA 连接态，禁止把 AHP 已连接当成引擎已接通。

```text
Chat Widget / Agents Window UI
        │  两套 facade，同一条连接
        ▼
IAgentHostService  ⊃  IAgentConnection   （工作台 ambient）
IRemoteAgentHostService → IAgentConnection   （每条远端）
        │  AHP：subscribe / dispatchAction / 会话命令
        ▼
Agent Host 进程（UtilityProcess 或远端 code agent-host）
        AgentService + AgentHostStateManager
        IAgent harness（copilot / claude / codex）
```

## Agent Host Protocol（AHP）

AHP 是客户端与宿主之间的 **JSON-RPC + 可订阅状态** 协议。VS Code 侧包装在 `src/vs/platform/agentHost/common/state/`：`sessionState.ts` / `sessionActions.ts` / `sessionProtocol.ts` 是面向本仓的包装；`protocol/**` 由兄弟仓库 `agent-host-protocol` 经 `scripts/sync-agent-host-protocol.ts` 生成。版本登记在 `protocol/version/registry.ts` 的 `PROTOCOL_VERSION`。字段与命令以生成类型为准，**本文不枚举 RPC 载荷**。

连接建立后走 `initialize` 握手。客户端把结果挂在 `IAgentConnection.initializeResult`（`InitializeResult`），用它读宿主宣告的能力（例如 `terminalCommandPrefix`、`completionTriggerCharacters`），而不是在 UI 里硬编码协议版本。

之后的协作面在 `IAgentService`（经 `ProxyChannel` 跨 MessagePort）上，而不是工作台自己持有会话树：

| 符号上的能力 | 作用（名称来自接口，不是自造字段） |
|--------------|--------------------------------------|
| `subscribe` / `unsubscribe` / `addSubscriber` | 按资源 URI 订阅；快照为 `IStateSnapshot` |
| `onDidAction` / `onDidNotification` | `ActionEnvelope` 与短暂通知 |
| `dispatchAction` | 客户端动作写回宿主；`channel` 是协议 URI **字符串** |
| `listSessions` / `createSession` / `disposeSession` | 宿主会话目录与生命周期 |
| `createChat` / `disposeChat` | 同一 AH session 内的额外 chat |
| `authenticate` | 对照 root 上宣告的 `protectedResources` |
| `resourceList` / `resourceRead` / … | 宿主文件系统与 watch |

`IAgentConnection` 是消费侧封装：在 `IAgentService` 上加订阅引用计数与 `dispatch`。有状态的数据面走 `AgentHostIpcChannels.Protocol`；本机管理面（重启、inspect、debug logs）走 `AgentHostIpcChannels.Management`（`IAgentHostManagementService`）。不要把管理方法写成 AHP 数据面字段。

协议可见的「session」是宿主编排出的 AH session（默认 chat + peer catalog），与 harness 内部的 SDK conversation / thread 不是同一层。分层用语见 [AGENTS.md](../../../src/vs/platform/agentHost/AGENTS.md)。

## 进程关系

[Processes](../processes/INDEX.md) 的一等表是 main / renderer / shared / extension host / pty host / CLI / vscode-server。Agent Host **不是**那张表里的一等进程：桌面是额外的 Electron `UtilityProcess`，远端是独立的 `code agent-host`（或等价入口）。

桌面编排（源码对得上的启动器）：

1. `CodeApplication`（`src/vs/code/electron-main/app.ts`）构造 `ElectronAgentHostStarter` 与 `AgentHostProcessManager`。
2. Starter 的 `UtilityProcess` `entryPoint` 为 `vs/platform/agentHost/node/agentHostMain`（`VSCODE_ESM_ENTRYPOINT` 同值）。
3. `AgentHostProcessManager` 只做懒启动、崩溃重启、日志转发；**不**中继 `IAgentService` 调用。Renderer 经 MessagePort 直连宿主。
4. 窗口要连时调用 `IAgentHostService.startAgentHost()`。桌面 workbench 的 `AgentHostPrewarmContribution` 在 `IAgentHostEnablementService.enabled` 为真时预热；带 `remoteAuthority` 的窗口改走 `EditorRemoteAgentHostServiceClient`。

`WorkbenchAgentHostService`（`workbench/services/agentHost/electron-browser/agentHostService.ts`）按环境挑选实现：

- 本地窗口：`LocalAgentHostServiceClient`，并传入 `editorWindowAgentHostClientInfo` 或 `agentsWindowAgentHostClientInfo`（`AgentHostClientType`）
- 已附着 remote authority：`EditorRemoteAgentHostServiceClient`（Web / `sessions.web.main.ts` 同样注册该实现）

远端连接由 `IRemoteAgentHostService` 按地址持有多条 `IAgentConnection`。形态服务只负责把进程拉起来并注入注册表，不另造一套协议：

| 标识 | 形态 |
|------|------|
| `ISSHRemoteAgentHostService` | SSH 拉起远端宿主 |
| `IWSLRemoteAgentHostService` | WSL2 distro 内 `code agent-host` |
| `ITunnelAgentHostService` | tunnel 转发上的宿主 |
| `ICloudSandboxAgentHostService` | cloud sandbox 的 AHP relay |

Shared process 登记对应的 `*MainService` channel（如 `SSH_REMOTE_AGENT_HOST_CHANNEL`）。`IAgentHostConnectionsService` 只回答「有哪些连接、某 URI 归谁」，不接管 `restartAgentHost` 或远端 add/remove。

## 工作台符号（来自真实 `createDecorator`）

`common/agentService.ts` 把 **编排面** 与 **provider 模型** 分开：`IAgent` / `IAgentChats` 在 `common/agent.ts`；`IAgentService` / `IAgentConnection` / `IAgentHostService` 在 `agentService.ts`。

`IAgentHostService` **扩展** `IAgentConnection`，是窗口的 ambient 连接：

- `startAgentHost` / `restartAgentHost`
- `onAgentHostStart` / `onAgentHostExit`
- `authenticationPending`（`IObservable<boolean>`）
- `startWebSocketServer` / `getInspectInfo`

同目录其它跨层标识（实现按 `common` / `node` / `electron-*` 拆）：`IAgentHostEnablementService`、`IAgentHostConnectionsService`、`IAgentHostFileSystemService`、`IAgentHostResourceService`、`IAgentHostSubscriptionService`。Node 宿主内部还有 `IAgentHostProviderService`、`IAgentHostStateManager`、`IAgentConfigurationService` 等，供 `AgentService` 使用，工作台 UI 不应直接当会话模型。

根目录按目标环境拆：`common/`、`browser/`、`node/`、`electron-browser/`、`electron-main/`、`test/`。

## 两套 facade：Sessions `agentHost` 与 workbench Chat

同一条 ambient `IAgentHostService` 被两套 UI 模型消费。它们是 **投影**，不是第二份宿主。

**workbench Chat**（`workbench/contrib/chat/browser/agentSessions/agentHost/`）：

- `AgentHostContribution` 读 `rootState.agents`，为每个允许的 provider 调用 `IChatSessionsService.registerChatSessionContribution`，session type 形如 `agent-host-<provider>`。
- `AgentHostSessionHandler` 登记为 `IChatSessionContentProvider`，把 AHP 状态推进 `IChatModel` / `sessionResource`。
- 还注册语言模型、customization harness、鉴权。这是编辑器 Chat / Panel / Quick Chat 的路径。

**Sessions `agentHost`**（`src/vs/sessions/contrib/providers/agentHost/`）：

- `LocalAgentHostContribution` **只**把 `LocalAgentHostSessionsProvider` 挂到 `ISessionsProvidersService`。注释写明：发现、handler、模型、customization 仍由上面的 `AgentHostContribution` 经 `IChatSessionsService` 完成。
- Provider 把 AHP session 适配成 provider-neutral 的 `ISession` / `IChat`。身份、草稿、catalog、Automations 以 [AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/agentHost/AGENT_HOST_SESSIONS_PROVIDER.md) 为准。
- 本地 provider id 为 `local-agent-host`。远端每条连接一个 `RemoteAgentHostSessionsProvider`。

不要用 provider 名在共享 UI 里分支；Sessions 比较 resource 身份。Chat 侧继续走 `IChatService` / Widget。两类窗口可以同时连同一宿主，用 `AgentHostClientType` 区分来源。

## B2：不是 session-core

对照 [agent-ui](../chat/agent-ui.md) 与 [code-oss-b2](../../reference/code-oss-b2/INDEX.md)：

| 名称 | Owner | 角色 |
|------|-------|------|
| UniverseAgent session | 外仓 desktop-domain + `platform/universeAgent` adapter | **引擎与 session-core 唯一权威** |
| AHP session / `AgentService` | `platform/agentHost` 进程 | vscode 侧协议实体与编排；**≠ UA session id** |
| `IChatModel` / `sessionResource` | `workbench/contrib/chat` | 编辑器 Chat 持久化投影 |
| `ISession` / `ISessionsService` | `vs/sessions` | Agents Window 目录 facade |

本系统回答「VS Code 如何拉起宿主、如何讲 AHP」。它不回答 Desktop Conversation 的时间线合同，也不替代 UniverseAgent adapter。`copilotChatSessions` 是 Agent Host 不可用时的另一条计算后端，**不可**当 B2 默认真相。

## 相关文档

- [Agent Host 索引](INDEX.md)
- [platform 概览](../../modules/platform/overview.md) · [Sessions](../sessions/INDEX.md) · [Chat](../chat/INDEX.md) · [Processes](../processes/INDEX.md)
- [AGENT_HOST_SESSIONS_PROVIDER.md](../../../src/vs/sessions/contrib/providers/agentHost/AGENT_HOST_SESSIONS_PROVIDER.md)
- [AGENTS.md](../../../src/vs/platform/agentHost/AGENTS.md) · [state/AGENTS.md](../../../src/vs/platform/agentHost/common/state/AGENTS.md)
