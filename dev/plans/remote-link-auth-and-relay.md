---
title: "远程链路：调用带 session token，中继票一次一用"
type: plan
status: draft
phase: M7
updated: 2026-09-28
summary: "ELR-1 / ELR-2 修复方案。拦截器给链路上的调用挂 Bearer；非握手调用被拒或任意调用不可用，即按既有重连换一条新链路（中继即新票）。Hub 首配每次 TLS 连接前签新票；中继通道不因空闲断开。S3 依赖 bug-hunt 01 方案 S2。不发明字段，不升 PRD-024。"
---

# 远程链路：调用带 session token，中继票一次一用

> **slice_id**：`remote-link-auth-relay`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) ELR-1、ELR-2。
> **本稿是方案，不是实施。**
> **基线**：HEAD `1145bce61de`，行号以此为准。以 `node/`、`common/`、`test/` 开头的路径在 `src/vs/platform/universeAgent/` 下。仓外引擎路径相对 `vscode-debug-engine/universe-agent/grpc-server/src/jvmMain/kotlin/universe/agentic/grpc/`，Hub 路径相对 `UniverseAgent/connection-hub/`。
> **冲突域**：`node/grpc/grpcTransport.ts`（transport 接口）、`node/grpc/grpcClient.ts`（构造与拦截器）、`node/universeAgentChannel.ts`（pinned 目标加中继标志）、`node/universeAgentConnectionService.ts`（**只**改：握手成功臂装 token 与订阅、编排器装配、新增 `_renewPairingDialEndpoint`、`_startProfilePairing` 的 endpoint 映射多带票号、服务选项加 `nowMs`）、`node/pairingOrchestrator.ts`、`node/connectionResolver.ts`（**只**删 `createIssueRelayTicketHook`），以及对应测试。
> **不发明**协议字段、RPC 或失败码。`authorization: Bearer` 是引擎既有合同；本稿用到的失败码都已在 `ConnectionFailureCode`。
> **依赖**：S3 依赖 [bug-hunt 01 方案](bug-hunt-2026-09-24/01-connection-trust.md) S2 的 `useRelayTicketCache` 与 `consumeRelayTicket`，须在其后落，或与它同一切片。与 [connection-dial-generation](connection-dial-generation.md)（D944）的接缝见 §6。
> **不升** PRD-024：它仍须 H4a 真 Hub 冒烟。

## Problem class

- **症状：** 连 Hub 设备或非回环 DirectAddress 后，状态显示已连接，但会话列表、Chat 全部失败，Engine 页能力全是 `probe status 16`；Hub 设备首配在试连一步失败；中继链路断开后，如果只剩流在重开，会一直失败，不会换票。
- **类标签：** **鉴权头没上线** + **一次性票被复用** + **流失败不进链路层**。
- **复发机制：** 钉死引擎在回环跳过鉴权；transport 替身没有 metadata 和票占用的概念；流 helper 只把错误文字交给关闭门。

## 0. 一句话结论

给 `GrpcUniverseAgentClient` 加一个 Client 级拦截器：链路握手成功后装入的 token，挂到之后每个调用的 `authorization: Bearer` 上；同时把非握手调用的 `UNAUTHENTICATED` 和任意调用的 `UNAVAILABLE` 报给连接服务，连接服务据此走既有重连，换一条新链路（中继即新票）。Hub 首配每次打开 TLS 之前向 resolver 要一张新票。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 所有调用经 `channel.make{Unary,ServerStream,ClientStream,BidiStream}Request` 创建，都不传 metadata | `node/grpc/grpcClientCalls.ts` L50-492；`GrpcUniverseAgentClient.probeRpc` L1257-1268 |
| Client 构造只装默认 deadline 的 `callInvocationTransformer`，没有拦截器，也没有 call credentials | `node/grpc/grpcClient.ts` L1135-1150 |
| `isChannelAlive` 只表示本端还没 `close()` | `grpcClient.ts` L1152-1154 |
| 握手成功后 token 只写进服务字段 `_sessionToken`，随后跑能力探针 | `node/universeAgentConnectionService.ts` L874-885 |
| 引擎对缺 `authorization` 的非豁免调用回 `UNAUTHENTICATED`；豁免是 `SystemService/{HealthCheck,GetAuthNonce,Connect}` 与 `grpc.health.v1.Health/Check`，豁免方法忽略该头；带 `--hub` 或非回环绑定时必须启用；token 默认 12 小时 | 仓外 `interceptor/AuthInterceptor.kt` L46-61、L166-170；`HeadlessServer.kt` L1162-1180；`auth/SessionTokenStore.kt` L8、L93 |
| `ConnectResponse` 没有 token 过期字段 | 仓外 `grpc-api/src/main/proto/common.proto` L222-233 |
| 引擎每次 Connect 分配新的随机 `conn_id`，并登记到当前传输 | 仓外 `SystemGrpcService.kt` L170-173、L196-225 |
| 能力探针把非 OK、非 UNIMPLEMENTED 的状态记为 `UNKNOWN` | `node/grpcCapabilityProbe.ts` L128-137、L151-161 |
| 只有 `UNAVAILABLE`、`DEADLINE_EXCEEDED` 算传输失败；只有经 `_withTransport` 的调用会进 `_markTransportFailed` | `node/grpc/grpcTransport.ts` L415-418；`universeAgentConnectionService.ts` L2023-2060 |
| 流调用只做 `_assertTransportReady` 就直连 transport；流 helper 出错只把 `message` 交给关闭门，不带状态码 | `universeAgentConnectionService.ts` L1367-1431；`grpcClientCalls.ts` 各流 helper 的 `error` 分支 |
| SessionViewHost 对 remote / error 两类关闭都按退避重开，已连接期间不设上限 | `node/sessionViewHost.ts` L1429-1443、L1472-1518 |
| 配对只在 `_startProfilePairing` 解析一次，得到一张票；交给编排器的 endpoint 不带票号 | `universeAgentConnectionService.ts` L2219-2234 |
| 编排器的 S1 观测、试连、`confirmSas` 正式连接用同一个 endpoint；`issueRelayTicket` 只有声明，没有读取 | `node/pairingOrchestrator.ts` L85、L192-196、L214-217、L339-342 |
| `createIssueRelayTicketHook` 直接读 access token，不走 `withHubAccessRetry`，不做 DNS | `node/connectionResolver.ts` L151-177 |
| Hub 在窥探 SNI 之后、转发任何字节之前原子 Claim；已 Claim 的票再用即关闭连接 | 仓外 `internal/relay/router.go` L255-263；`internal/tickets/tickets.go` L221-235 |
| resolver 选项只有 `forceNewTicket`、`forPairing`；`useRelayTicketCache`、`consumeRelayTicket` 属于 bug-hunt 01 方案 S2，未实施 | `connectionResolver.ts` L179 |
| grpc-js 1.14.4：Client 读取 `options.interceptors`；`grpc.client_idle_timeout_ms` 默认 30 分钟、下限 1 秒 | `node_modules/@grpc/grpc-js/build/src/client.js` L45；`internal-channel.js` L45-47、L199 |
| 真服务端测试只有 `test/node/universeAgentChannel.test.ts`（裸 `tls.createServer`）；transport 替身分布在 `test/node/` 下 `pairingOrchestrator`、`deviceAuthHandshake`、`universeAgentConnection` 三个测试文件 | `test/node/` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 拦截器挂 token 并上报状态；被拒或不可用即换链路；配对逐段向 resolver 要票** | 见 §3 | **选定** |
| B `CallCredentials`（`combineChannelCredentials`）挂 token | grpc-js 只允许与安全通道组合，进程内明文测试服务端用不了；也看不到调用结束的状态，S2、S4 仍要拦截器 | **拒绝** |
| C 在各调用点传 `Metadata` | `grpcClient.ts` 约 190 处 helper 调用，容易漏；流 helper 的签名都要改 | **拒绝** |
| D token 被拒后在同一 channel 重跑 Connect | 每次 Connect 都在同一传输上登记一个新 `conn_id`，这不是引擎和其他客户端走过的路径；中继本来就要新票 | **拒绝** |
| E 在 TTL 到期前主动续期 | `ConnectResponse` 没有过期字段，12 小时只是引擎默认值；不发明字段 | **拒绝** |
| F 配对沿用 `issueRelayTicket` 钩子签票 | 钩子不走 `withHubAccessRetry`（access 15 分钟过期即失败），不做 DNS，也绕过 bug-hunt 01 S1 的私网分类 | **拒绝**；改走 resolver 全链，并删除钩子 |
| G 只靠 grpc-js 子通道自动重连 | 在中继上，每次重连都拿已占用的票，注定失败；流失败今天又不进链路层 | **拒绝**；由 S4 上报为链路失效 |
| H token 被拒后一律重连，不设宽限 | 引擎若每次都拒绝新 token，重连成功会重置退避，形成约 1 秒一轮的热循环 | **拒绝**；S2 设 60 秒宽限 |

## 3. 选定设计（A）

1. **S1 链路上的调用带 token。** 覆盖 ELR-1 主体。
   - `IUniverseAgentGrpcTransport` 增加 `installSessionToken(token: string): void`。之后在这个 transport 上**新建**的调用都带 `authorization: Bearer <token>`；已经在飞的调用不变。空串不装。
   - `GrpcUniverseAgentClient` 在构造时给 Client 传 `interceptors: [this._linkInterceptor]`。拦截器在 `start` 时读取当时已装入的 token 并写进 metadata。既有 deadline 的 `callInvocationTransformer` 保留不动。所有调用（`probeRpc` 与 `grpcClientCalls.ts` 的全部 helper）都经过这个 Client，不必改调用点。
   - 不维护豁免清单：引擎对豁免方法忽略这个头（`AuthInterceptor.kt` L46-49）。
   - 装入点只有一处：`_connectProfileRaw` 的 `handshake.kind === 'authenticated'` 臂，与写 `_sessionToken`（L875）同一处、在能力探针（L880）之前，对**跑这次握手的那个 transport** 调用 `installSessionToken(handshake.result.sessionToken)`。探针因此带上 token，拿到真实状态。
   - 不装入的地方：正式握手的 `pairing_pending` 臂（L854-872）；`_startProfilePairing`；编排器的试连与正式连接 transport（用完即关，Desktop ADR-031 INV-RCV-TOK-1 要求 S4 拿到的 token 不装入）；`_probeResolvedEndpoint`（只调 `GetAuthNonce`）；公开的 `connect()` 与 `!tls` 分支（生产无调用方，归 D944 S3 或删除，本稿不动）。
   - `_sessionToken` 字段、快照与 `isEngineConnected()` 不变。token 过 IPC 是 ELR-4，另案处理。

2. **S2 token 被拒即链路失效。** 覆盖 ELR-1 的过期与吊销面。
   - `IUniverseAgentGrpcTransport` 增加 `readonly onDidRejectSessionToken: Event<void>`。拦截器在 `onReceiveStatus` 看到 `UNAUTHENTICATED`，且这次调用带了 token、路径不是 `agentservice.SystemService/Connect` 或 `agentservice.SystemService/GetAuthNonce` 时触发。`close()` 时释放 emitter，监听随链路一起消亡。
   - 连接服务在 S1 装入点所在臂的末尾（相位写成 connected 之后）订阅这个事件，闭包捕获 `transport` 与提交时刻 `committedAtMs`，不新增服务字段。时间来源新增可注入的选项 `nowMs`（缺省 `Date.now`），供测试使用。
   - 触发时先确认 `transport === this._transport`、`_transportState === 'ok'`、不在配对中、不在用户断开中，否则忽略。
     - 距提交不足 `SESSION_TOKEN_REJECT_GRACE_MS`（60 秒）：视为引擎不接受这条链路刚拿到的 token。关闭该 transport 并置空，清空 `_sessionToken`，`_transportState` 置 `failed`，取消重连定时器，相位写 `failed{ transport_failed, 'session token rejected by engine' }` 并广播，不重连。这样即使引擎每次都拒绝新 token，也不会形成热循环；用户再点连接即重新拨号。
     - 否则（常见于 12 小时到期）：以一个 `UNAVAILABLE` 的 `UniverseAgentTransportError` 调用既有的 `_markTransportFailed`，走 D408 重连。`connectProfile({ reconnect: true })` 会新建 channel、重跑 DeviceAuth，中继路径同时签新票。
   - 重连里的 Connect 若因 Grant 被吊销而回 `UNAUTHENTICATED`，今天归为 `transport_failed` 继续退避（ELR-6，另案）；若回 `pairing_nonce`，走 HEAD 的 L854-872（D944 S5 的范围）。本稿不改这两种分类。

3. **S3 Hub 首配逐段签票。** 覆盖 ELR-2 主体。依赖 bug-hunt 01 方案 S2。
   - `PairingDialEndpoint` 增加 `readonly relayTicketId?: string | null`。`_startProfilePairing` 映射 endpoint（L2230-2234）时带上 `endpoint.relayTicketId`。
   - 编排器依赖里未被使用的 `issueRelayTicket` 换成 `renewDialEndpoint?: (profile: ConnectionProfile) => Promise<{ ok: true; endpoint: PairingDialEndpoint } | { ok: false; code: string; reason: string }>`。
   - 规则：带票的 endpoint 最多交给一次 TLS 连接。S1 观测用传入的 endpoint（第 1 张票）；试连之前（L214 之前）与 `confirmSas` 的正式连接之前（L339 之前）各调用一次 `renewDialEndpoint`，拿第 2、3 张票。不带票（DirectAddress）时沿用原 endpoint，不调用。带票但依赖缺失时 fail-closed，返回 `{ ok: false, code: 'hub_ticket_failed' }`。
   - 两次续票之后都要重做既有的代际检查：`startPairing` 检查 `generation` 与 `disposed`，`confirmSas` 调用 `isCurrentConfirmSas`。续票放在建 transport 之前，所以代际失效时没有要关闭的 transport，直接返回既有的 superseded / stale 结果。续票失败时原样返回 `code`，由 `_mapPairingFailureCode` 透传 `hub_*`。
   - 连接服务装配编排器（L520-534）时注入 `renewDialEndpoint: profile => this._renewPairingDialEndpoint(profile)`。新方法调用 `this._connectionResolver.resolve(profile.profileId, { forPairing: true, forceNewTicket: true, useRelayTicketCache: false })`，按 L2230-2234 的同一方式映射。因为走 resolver 全链，自动复用 `withHubAccessRetry`、实时目录判定，以及 bug-hunt 01 S1 的私网分类。
   - 删除 `ConnectionResolver.createIssueRelayTicketHook`（L151-177）及其用例，并删除测试替身里的同名桩。
   - 配对成功后的那次 `connectProfile`（`confirmPairing` L955）不会碰到配对用过的票：第 1 张由 bug-hunt 01 S2 的 `consumeRelayTicket` 移出缓存，第 2、3 张从不进缓存。

4. **S4 中继链路断开即链路失效。** 覆盖 ELR-2 的同类问题。
   - `IUniverseAgentGrpcTransport` 增加 `readonly onDidObserveUnavailable: Event<void>`。拦截器在任意调用（含流）以 `UNAVAILABLE` 结束、且路径不是上述两个握手方法时触发。
   - 连接服务与 S2 在同一处订阅；触发时满足与 S2 相同的身份和状态前提，就以一个 `UNAVAILABLE` 错误调用 `_markTransportFailed`。流失败从此与 unary 一样进入重连；中继链路因此会换票，不再依赖 grpc-js 子通道拿已占用的票重拨。
   - `UniverseAgentPinnedTlsTarget` 增加 `readonly relay?: boolean`。`_connectProfileRaw` 创建 pinned transport（L774-778）时传 `relay: endpoint.relayTicketId !== null`；为真时通道选项加 `'grpc.client_idle_timeout_ms': 2_147_483_647`。这个值不能超过 2³¹−1，否则 Node 定时器会退化为 1 毫秒。配对与探测用的短命 transport 不加。

## 4. 不变量

- 一个 transport 上的 token 只来自在同一个 transport 上完成的握手。换链路之后，新 transport 在自己握手成功之前不带任何 token。
- 已提交链路上的非握手调用都带这条链路的 token。
- 一张中继票只用于一次 TLS 连接：观测、试连、正式连接和每次拨号各用一张。
- 中继链路上任何调用出现 `UNAVAILABLE`，都换新票重建链路，不依赖 grpc-js 的内部重连。
- 来自非当前 transport 的事件一律忽略。
- 不新增 IPC 字段，不改 renderer。

## 5. 切片

顺序：S1 → S2 → S4 共用同一个拦截器，按此顺序落；S3 与它们无依赖，但必须在 bug-hunt 01 方案 S2 之后，或与之同一切片。

| Slice | Goal | Files | Tests | Exit |
|:------|:-----|:------|:------|:-----|
| **S1** | 链路上的调用带 token | `grpcTransport.ts`、`grpcClient.ts`、`universeAgentConnectionService.ts`（握手成功臂）、三个替身文件 | §8 S1 | 强制鉴权的引擎上，List、Chat 与能力探针不再因缺头失败 |
| **S2** | token 被拒即换链路 | 同上，加服务选项 `nowMs` | §8 S2 | 过期后自动恢复；引擎持续拒绝时停在 failed，不热循环 |
| **S3** | Hub 首配逐段签票 | `pairingOrchestrator.ts`、`universeAgentConnectionService.ts`（装配、新方法、endpoint 映射）、`connectionResolver.ts`（删钩子） | §8 S3 | 一次性票的假中继下，Hub 首配能走完 |
| **S4** | 中继断开即换票 | `grpcClient.ts`、`universeAgentChannel.ts`、`universeAgentConnectionService.ts`（订阅、`relay` 参数） | §8 S4 | 只剩流时中继断开也能恢复 |

## 6. 与已签收方案的接缝

- **connection-dial-generation（D944）。** S1 的装入和 S2、S4 的订阅都落在 `_connectProfileRaw` 的握手成功臂。
  - 若 D944 S1 先落：装入在它的 captured transport 上、探针之前完成，属于链路准备，不属于它的 connected 提交集；订阅并入它的 connected 提交集，代际失配时不订阅。
  - 若本稿先落：D944 实施时把这两处搬进它的 captured / 提交模型。
  - S2、S4 的处理函数先比对 `transport === this._transport`，与 D944「失配不写」同义，不另设代际。S4 的 `relay` 只是多传一个参数，不改变 D944 对 transport 赋值时机的约束。
- **bug-hunt 01 方案。** 它的 S2 是本稿 S3 的前置。它的 S1（按解析后的地址拒私网）经本稿 S3 的 resolver 路径，自动作用于配对的每一张票。它的 S3（握手失败码）与本稿 S2 不重叠：本稿只处理已提交链路上调用被拒，不改握手失败臂的码映射。
- **审查文的其余各条。** ELR-3（试连超时进恢复信任）、ELR-4（token 过 IPC）、ELR-6（吊销与真 pin 失败的分类）各自另案。本稿不改这些行为，也不让它们变得更糟。

## 7. 不做

- 按 TTL 主动续期（`ConnectResponse` 没有过期字段）。
- 在同一 channel 上重跑 Connect（见 Options D）。
- keepalive ping：引擎对 ping 频率的容忍度未知，配错会被 GOAWAY。
- 修改公开 `connect()` 与 `!tls` 分支；ELR-3、ELR-4、ELR-6；D944 的代际与提交集。
- 重开托管 CI。

## 8. 验证

本地，点名文件跑 `scripts/test.sh --run`；门禁沿用 [health-gates](../progress/health-gates.md)。

| 切片 | 测试 | 断言 |
|:-----|:-----|:-----|
| S1 | 新增 `test/node/grpcClientSessionToken.test.ts`：进程内 grpc-js 明文服务端绑 `127.0.0.1:0`，用通用 handler 注册一个 unary、一个 server stream、一个 bidi 方法；`test/node/universeAgentConnection.test.ts` | 未装 token 时服务端收不到 `authorization`；装入 `t1` 后三类调用都收到 `Bearer t1`；同一服务端上另一个未装 token 的 client 仍收不到（链路隔离）。连接服务：TLS 握手成功后 `installSessionToken` 恰好调用一次，参数是握手拿到的 token，且早于第一次 `probeRpc`；`pairing_pending` 臂与 `_startProfilePairing` 不调用；连 A 再连 B，B 的 transport 只收到 B 的 token |
| S2 | 同上两个文件 | 服务端对 unary 回 `UNAUTHENTICATED` 时 `onDidRejectSessionToken` 触发；同样的状态出现在 `agentservice.SystemService/Connect` 上，或者未装 token 时，不触发。连接服务（注入 `nowMs` 与假定时器）：提交超过 60 秒后触发，相位变为 `connecting{transport_lost}` 并排上重连，重连以 `forceNewTicket` 解析；60 秒内触发，transport 已关闭、`_sessionToken` 为空、相位为 `failed{transport_failed}`、没有重连定时器；旧 transport 的事件不改变任何状态 |
| S3 | `test/node/pairingOrchestrator.test.ts`；`test/node/universeAgentConnection.test.ts`；`test/node/connectionResolver.test.ts` | 带票 endpoint：`renewDialEndpoint` 恰好调用两次（试连前、正式连接前），观测与两次 `createPinnedTransport` 一共用到 3 个互不相同的 servername；用「同一 servername 第二次连接即失败」的假中继跑完整的 `startPairing` 加 `confirmSas` 能成功（HEAD 上同一用例失败）；不带票时从不调用；续票返回 `hub_unreachable` 时结果就是这个码，且不再建 transport；续票期间被新配对取代，返回既有的 superseded / stale 结果。连接服务：`_renewPairingDialEndpoint` 以 `{ forPairing: true, forceNewTicket: true, useRelayTicketCache: false }` 调 resolver。`createIssueRelayTicketHook` 的用例随删除移除 |
| S4 | 同 S1 的两个文件；`test/node/universeAgentChannel.test.ts` | server stream 以 `UNAVAILABLE` 结束时 `onDidObserveUnavailable` 触发；连接服务据此进入 `connecting{transport_lost}`，并以 `forceNewTicket` 重连；旧 transport 的事件被忽略。`relay: true` 的 pinned 目标，通道选项含 `grpc.client_idle_timeout_ms: 2147483647`；`relay` 缺省时不含 |

真引擎冒烟不是本稿的退出条件。PRD-024 的证据仍来自 connection-hub-client 的 H4a（引擎带 `--hub` 并配本地 `connection-hub`，或非回环绑定）。

## 9. 知识层回填（实施 commit 时，不在本稿）

- `docs/reference/universe-agent/engine-protocol-surface.md` 的 `SystemService` 行：非豁免调用须带 `authorization: Bearer <session_token>`（引擎带 `--hub` 或非回环绑定时强制）、豁免清单、token 默认 12 小时。
- [connection-hub-client](connection-hub-client.md) Q3 改口：token 有 TTL，过期与被拒都按重连换链路。
- [钉死引擎调试](../../docs/guides/debug-engine.md) 的提醒随实施状态更新。
- `docs/product/traceability.md` PRD-024 行的「实施方案」列补上本稿。
- [审查文](../progress/engine-link-architecture-review-2026-09-28.md) ELR-1、ELR-2 的「已知」指向本稿。

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
