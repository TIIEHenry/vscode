---
title: "连接 IPC 白名单与桌面 Team 一元调用"
type: plan
status: draft
phase: M7
updated: 2026-10-05
summary: "ELR-12：连接 IPC 改为白名单，宿主方法、connect 与回调流不对窗口开放；Hub 使用 universeAgentHub 通道并仍打到同一连接实例；宿主 token 用适配器；桌面 Team 三元调用补上嵌套对象过不了 ProxyChannel 的缺口。代码已落，方案仍 draft。不升 PRD。"
---

# 连接 IPC 白名单与桌面 Team 一元调用

> **slice_id**：`connection-ipc-allowlist`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) ELR-12。ELR-14 的 `connect()` 只退出窗口通道，方法本体留在 node。ELR-13 不在本稿。
> **本稿是方案，未签收。** 没有独立只读审查子 agent；审查记录见文末，因此 frontmatter 保持 `draft`。
> **实施（2026-10-05）**：通道外壳、Hub 通道名、宿主适配器、桌面 Team 一元调用与单测已落。方案仍是 `draft`。不升 PRD。
> **冲突域**：`code/electron-main/app.ts` 的 `universeAgentConnection` 通道注册、`platform/universeAgent/common/universeAgentConnectionIpcChannel.ts`、`common/universeAgentNavigatorTeamIpc.ts`、`common/universeAgentConnectionChannelClient.ts`、`common/hub.ts` 的通道名、`common/universeAgentHostConnection.ts` 的 main token、`electron-main/universeAgentHostConnectionAdapter.ts`、`electron-main/universeAgentSessionViewService.ts`。
> **不改**：`node/universeAgentConnectionService.ts`、`browser/universeAgentConnectionService.ts`、`universeAgentRendererSync.ts`、`universeAgentTypes.ts`、`pairingOrchestrator.ts`、`connectionResolver.ts`、`status.md`、`deferred-gaps.md`、协议表面文档、`docs/architecture/engine-link-architecture-review-2026-09-28.md`。
> **不升** PRD。

## 0. 一句话结论

窗口不再拿到整份连接服务对象。连接通道只转发渲染端契约里的一元调用和四个连接事件；宿主方法、`connect()` 和带回调的流在进 `ProxyChannel` 之前拒绝。Hub 改走 `universeAgentHub`，仍调用同一个 main 连接实例上的 Hub 方法。宿主接口单独注册 main token，用适配器委托该实例，不新建第二条引擎链路。桌面 `connection.team` 变成真正的对象，三个方法各走一条一元 IPC。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| main 用 `ProxyChannel.fromService` 把 `IUniverseAgentConnection` 注册到通道名 `universeAgentConnection`。`fromService.call` 对任意函数属性 `apply` | `src/vs/code/electron-main/app.ts`；`src/vs/base/parts/ipc/common/ipc.ts` |
| 同一个类实现连接、宿主、Hub 三个接口。宿主注释写「Not proxied to renderer」，没有自己的 DI token。SessionView 把连接强转成宿主 | `node/universeAgentConnectionService.ts` 类声明；`common/universeAgentHostConnection.ts`；`electron-main/universeAgentSessionViewService.ts` |
| `universeAgentHubChannelName` 与连接通道同名。electron-main 没有单独注册 Hub 通道。渲染端 Hub 客户端打到连接通道。连接服务的 Hub 方法委托内部 `_hub`，`revokeDevice` 成功后可能 `disconnect`。独立的 `UniverseAgentHubService` 类没有装进 electron-main | `common/hub.ts`；`node/universeAgentConnectionService.ts` Hub 段；`electron-browser/universeAgentHubService.ts` |
| `readonly team: IUniverseAgentTeamApi` 不是类方法。node 在构造函数里赋一个对象。`ProxyChannel.toService` 把非事件属性都变成 async 函数，嵌套方法过不去。桌面通道客户端没有 `team` 字段。Navigator 先取 `uaConnection.team` 再调 `teamInfo` / `memberStatus` / `taskList`。Web 桩和测试替身上的 `team` 是真对象 | `common/universeAgentConnection.ts`；`node/universeAgentConnectionService.ts` 构造函数；`common/universeAgentConnectionChannelClient.ts`；`navigatorTeamList.ts` |
| 回调流与 `connect()` 的生产调用在 node 宿主和测试，不在渲染端。Pty 已有单独通道 `universeAgentPty` | `electron-main/universeAgentPtyChannel.ts`；`node/sessionViewHost.ts` |
| SessionView 通道已用显式白名单，未知命令 `ErrorNoTelemetry('Method not found')` | `electron-main/universeAgentSessionViewChannel.ts` |

## 2. 合同

### 2.1 连接通道

新增 `UniverseAgentConnectionIpcChannel`。`app.ts` 仍用一份 `ProxyChannel.fromService` 做内层，但注册到 `universeAgentConnection` 的是白名单外壳。拒绝发生在 `inner.call` / `inner.listen` 之前。

转发的调用是 `keyof IUniverseAgentConnection` 去掉 `_serviceBrand`、`team`、四个 `onDid*` 事件，以及下面的拒绝集。类型上多一个、少一个或把拒绝集放进转发集，编译失败。

拒绝的调用（即使以后被加进连接接口，运行时也先拒绝）：

- 宿主：`fetchAgentTree`、`isAgentTreeUnsupported`、`fetchToolDetail`、`notifyFileMutation`、`notifyTurnSettle`、`notifyTeamRuntimeChange`
- 旧入口：`connect`
- 回调流：`subscribeSessionEventStream`、`chat`、`openChatStream`、`openContinuationStream`、`openRegenerateStream`、`openResumeStream`、`openSubscribeToolDetailStream`、`openRebuildMemoryStream`、`openRemoteChatStream`、`openUploadAttachmentStream`、`openDownloadAttachmentStream`、`openPtyStream`、`openWatchConfigStream`

一元方法留在转发集里，包括 `shutdown`、`pairApprove`、`rotateToken`、`disconnect`、`listTeams`、Git 写、记忆、远程代理。它们已经是渲染端契约。本稿不另收一刀。

转发的事件只有：`onDidChangeConnection`、`onDidFileMutation`、`onDidTurnSettle`、`onDidChangeTeamRuntime`。

拒绝的宿主事件：`onRequestAgentTreeRefresh`。

未知命令 `ErrorNoTelemetry('Method not found: …')`。未知事件 `ErrorNoTelemetry('Event not found: …')`。`dispose` 不在契约上，拒绝。node 进程内的服务对象不包这层外壳，测试和 SessionViewHost 继续直接调用 `connect()`、流和宿主方法。

### 2.2 Team

`ProxyChannel` 不能把 `team` 上的三个函数编过去。命令名（common 常量，避免和接口方法重名）：

- `navigatorTeamMemberStatus(sessionId, agentId)`
- `navigatorTeamTaskList(sessionId, agentId)`
- `navigatorTeamInfo(sessionId, agentId, teamId)`

外壳直接调用 `service.team.*`，不经过内层 `call`。非字符串的 session / agent 收成空字符串。`teamId` 不是有限数则 `ErrorNoTelemetry('Invalid team id')`，不调服务。

`UniverseAgentConnectionChannelClient` 持有原始 `IChannel`，构造出 `team` 对象再交给现有的 `createRemoteForwardingProxy`。本地字段优先，桌面 `connection.team` 是对象，三个方法是函数。不改 `universeAgentRendererSync.ts`。Web 桩已有真对象，不改。

### 2.3 Hub 通道名

`universeAgentHubChannelName` 改为 `universeAgentHub`，不得等于 `universeAgentConnection`。

`UniverseAgentHubIpcChannel` 只转发 `IUniverseAgentHubService` 的调用和三个 `onDidChange*` 事件。内层与连接通道共用同一个 `ProxyChannel`，避免事件缓冲订两次。目标对象是 main 里那一个 `IUniverseAgentConnection` 实例（它实现 Hub，并委托 `_hub`）。不注册独立的 `UniverseAgentHubService`，否则 Connection 窗格会看到另一份空账号。

连接通道的转发集与 Hub 调用集、宿主调用集不得重叠；重叠则编译失败。渲染端 Hub 客户端继续用 `universeAgentHubChannelName`，不改它的 hydrate 行为。

### 2.4 宿主 token

`IUniverseAgentHostConnection` 增加 `createDecorator`。`UniverseAgentHostConnectionAdapter` 注入 `IUniverseAgentConnection`，把宿主成员委托给该实例。`app.ts` 注册这个适配器，不把连接服务类再 `SyncDescriptor` 一次（那会造出第二个连接）。

`UniverseAgentSessionViewService` 改为注入 `IUniverseAgentHostConnection`，去掉 `as unknown as` 强转。进程内行为不变：适配器背后仍是同一个服务对象。

## 3. 明确不做

- 不删除 `connect()`，不改 node 测试里对它的直接调用。那是 ELR-14 的后半，审查写明在白名单之后。
- 不改 `typeof conn.x === 'function'`。那是 ELR-13，修它要动禁止修改的转发代理和连接服务。
- 不把渲染端一元 RPC 从契约里拿掉。
- 不拆连接服务类，不改配对编排器和地址分类器。
- 不改 `status.md`、`deferred-gaps.md`、协议表面文档。
- 不升 PRD，不把本方案标成 `accepted` 或 `implemented`。

## 4. 验证

`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentConnectionIpcChannel.test.ts`，以及既有 `universeAgentSessionViewChannel.test.ts`。需要时先 `flock /tmp/vscode-loop-compile.lock npm run compile-client`。锁被占用则只记录编译进行中。

断言：

- 内层是真的 `ProxyChannel.fromService`。`notifyFileMutation`、`fetchAgentTree`、`connect`、`openChatStream`、`openPtyStream`、`dispose`、自造方法在连接通道上拒绝，且服务计数不增加。
- `disconnect`、`isEngineConnected`、`probeEngine` 到达服务。`onDidChangeConnection` 能收到。`onRequestAgentTreeRefresh` 拒绝。
- 三个 Team 命令到达 `service.team`，返回值原样回来。非法 `teamId` 不调用服务。
- 通道客户端的 `team` 是对象，`memberStatus` / `taskList` / `teamInfo` 以约定命令名和参数调用 `IChannel`。
- Hub 通道放行 `login` 与 `onDidChangeAuthStatus`，拒绝 `notifyFileMutation` 与 `onDidFileMutation`。
- 源码扫描：`app.ts` 注册的是两个外壳和宿主适配器；Hub 通道名常量是 `universeAgentHub`；SessionView 不再强转。

## 5. 只读自审

本次没有可派的独立只读 reviewer。下面按规则 16 的 Critical / Important 自己核过，并写进合同。未签收。

- **Critical：Hub 若换成新的 `UniverseAgentHubService` 实例，桌面账号和 `revokeDevice` 的断线副作用会丢。** 合同规定外壳打到已注册的那一个连接实例。
- **Critical：宿主 token 若再构造一个 `UniverseAgentConnectionService`，会多开一条引擎链路。** 合同规定适配器只委托现有实例。
- **Critical：只做白名单而不补 `team`，Navigator 团队段在桌面仍是 `team` 为函数、`memberStatus` 为 undefined。** 三个一元命令写进同一通道外壳，因为它们本来就属于这条 IPC 契约，不是另一块产品。
- **Important：两份 `fromService` 会把同一事件缓冲两次。** 连接与 Hub 共用一个内层。
- **Important：拒绝集若把 `shutdown` / `pairApprove` 等一元契约一并拿掉，就是审查方向之外的收窄。** 转发集按接口键减拒绝集，编译钉死。
- **不采纳**：把 Hub 继续留在连接通道上。审查方向写了独立通道名；白名单已经能挡住宿主方法，独立通道名仍然要做，避免渲染端 Hub 客户端依赖「连接通道也暴露 Hub」。
- **残留**：ELR-13 的 `typeof` 恒真、ELR-14 的 `connect()` 方法本体、连接服务仍同时实现三个接口。都不在本稿。
