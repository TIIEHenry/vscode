---
title: "远程链路：调用带 session token，中继票一次一用"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "S1–S4 已落：调用挂 Bearer；被拒或不可用先摘掉再换链路；Hub 首配逐段签票，已交出的票离开拨号缓存。不升 PRD-024。"
---

# 远程链路：调用带 session token，中继票一次一用

> **slice_id**：`remote-link-auth-relay`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) ELR-1、ELR-2。
> **本稿是方案。** **签收（2026-09-28）：** 规则 16 两轮无 Critical，第二轮 Important 已改入。用户签收。**2026-09-29：** S1、S2、S4 已落。S3 与 bug-hunt 01 方案 S2 同切片已落。不升 PRD-024。
> **基线**：HEAD `32f3e9187c9`，行号以此为准。以 `node/`、`common/`、`test/` 开头的路径在 `src/vs/platform/universeAgent/` 下。仓外引擎路径相对 `vscode-debug-engine/universe-agent/grpc-server/src/jvmMain/kotlin/universe/agentic/grpc/`，Hub 路径相对 `UniverseAgent/connection-hub/`。
> **冲突域**：`node/grpc/grpcTransport.ts`（transport 接口）、`node/grpc/grpcClient.ts`（构造与拦截器）、`node/universeAgentChannel.ts`（pinned 目标加中继标志）、`node/universeAgentConnectionService.ts`（**只**改：握手成功臂装 token 并在装入时订阅、臂末尾对已判失效的尝试不写 connected 提交集、`_withTransport` 成功臂与失败臂都认捕获的 transport、`_fireReconnect` 对宽限收口的返回不再排 D410、编排器装配、新增 `_renewPairingDialEndpoint`、`_startProfilePairing` 的 endpoint 映射多带票号、服务选项加 `nowMs`）、`node/pairingOrchestrator.ts`、`node/connectionResolver.ts`（**只**删 `createIssueRelayTicketHook`），以及对应测试。
> **不发明**协议字段、RPC 或失败码。`authorization: Bearer` 是引擎既有合同；本稿用到的失败码都已在 `ConnectionFailureCode`。
> **依赖**：S3 依赖 [bug-hunt 01 方案](bug-hunt-2026-09-24/01-connection-trust.md) S2 的 `useRelayTicketCache` 与 `consumeRelayTicket`，须在其后落，或与它同一切片。与 [connection-dial-generation](connection-dial-generation.md)（D944）的接缝见 §6。
> **不升** PRD-024：它仍须 H4a 真 Hub 冒烟。

## Problem class

- **症状：** 连 Hub 设备或非回环 DirectAddress 后，状态显示已连接，但会话列表、Chat 全部失败，Engine 页能力全是 `probe status 16`；Hub 设备首配在试连一步失败；中继链路断开后，如果只剩流在重开，会一直失败，不会换票。
- **类标签：** **鉴权头没上线** + **一次性票被复用** + **流失败不进链路层**。
- **复发机制：** 钉死引擎在回环跳过鉴权；transport 替身没有 metadata 和票占用的概念；流 helper 只把错误文字交给关闭门。

## 0. 一句话结论

给 `GrpcUniverseAgentClient` 加一个 Client 级拦截器：链路握手成功后装入的 token，挂到之后每个调用的 `authorization: Bearer` 上。装入的同时订阅非握手调用的 `UNAUTHENTICATED` 和任意调用的 `UNAVAILABLE`。探针结束前已被判失效的尝试不写成已连接；已经提交的链路则先摘掉再走既有重连，换一条新链路（中继即新票）。Hub 首配的试连和正式连接各用当次续票返回的 endpoint。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 所有调用经 `channel.make{Unary,ServerStream,ClientStream,BidiStream}Request` 创建，都不传 metadata。path 模板是 `` `/${service}/${method}` ``，grpc-js 把它原样放进 `methodDefinition.path` | `node/grpc/grpcClientCalls.ts` L50-492；`GrpcUniverseAgentClient.probeRpc` L1257-1268；`node_modules/@grpc/grpc-js/build/src/client.js` L128 |
| Client 构造只装默认 deadline 的 `callInvocationTransformer`，没有拦截器，也没有 call credentials。transformer 先于拦截器运行 | `node/grpc/grpcClient.ts` L1135-1150；`client.js` L143-153 |
| `isChannelAlive` 只表示本端还没 `close()` | `grpcClient.ts` L1152-1154 |
| `isEngineConnected()` 只看 token、非配对、`isChannelAlive`，不看 `_transportState` | `node/universeAgentConnectionService.ts` L548-551 |
| 握手成功后 token 只写进服务字段 `_sessionToken`，随后跑能力探针和两次 refresh；相位 connected 写在这些 await 之后 | `universeAgentConnectionService.ts` L875-890 |
| 能力探针和两次 refresh 都走 `probeRpc`；非 OK、非 UNIMPLEMENTED 记为 `UNKNOWN`，不抛错 | `node/grpcCapabilityProbe.ts` L128-137、L151-161；`universeAgentConnectionService.ts` L2371-2393 |
| 引擎对缺 `authorization` 的非豁免调用回 `UNAUTHENTICATED`；豁免是 `SystemService/{HealthCheck,GetAuthNonce,Connect}` 与 `grpc.health.v1.Health/Check`，豁免方法忽略该头；带 `--hub` 或非回环绑定时必须启用；token 默认 12 小时 | 仓外 `interceptor/AuthInterceptor.kt` L46-61、L166-170；`HeadlessServer.kt` L1162-1180；`auth/SessionTokenStore.kt` L8、L93 |
| `ConnectResponse` 没有 token 过期字段 | 仓外 `grpc-api/src/main/proto/common.proto` L222-233 |
| 引擎每次 Connect 分配新的随机 `conn_id`，并登记到当前传输 | 仓外 `SystemGrpcService.kt` L170-173、L196-225 |
| 只有 `UNAVAILABLE`、`DEADLINE_EXCEEDED` 算传输失败；只有经 `_withTransport` 的调用会进 `_markTransportFailed`。成功返回时若状态不是 `ok`，会拉回 `ok`，相位为 `connecting{transport_lost}` 时写回 connected，并 `_resetReconnectBackoff()` | `node/grpc/grpcTransport.ts` L415-418；`universeAgentConnectionService.ts` L2023-2060 |
| 流调用只做 `_assertTransportReady` 就直连 transport；流 helper 出错只把 `message` 交给关闭门，不带状态码 | `universeAgentConnectionService.ts` L1367-1431；`grpcClientCalls.ts` 各流 helper 的 `error` 分支 |
| SessionViewHost 对 remote / error 两类关闭都按退避重开；已连接（`isEngineConnected()`）期间不设上限 | `node/sessionViewHost.ts` L1428-1443、L1472-1518 |
| 配对只在 `_startProfilePairing` 解析一次，得到一张票；交给编排器的 endpoint 不带票号 | `universeAgentConnectionService.ts` L2219-2234 |
| 编排器把传入 endpoint 冻进 `activeContext`，S1 观测、试连、`confirmSas` 正式连接用的都是它；`issueRelayTicket` 只有声明，没有读取 | `node/pairingOrchestrator.ts` L85、L192-196、L214-217、L275-284、L339-342 |
| `createIssueRelayTicketHook` 直接读 access token，不走 `withHubAccessRetry`，不做 DNS | `node/connectionResolver.ts` L151-177 |
| Hub 在窥探 SNI 之后、转发任何字节之前原子 Claim。已 Claim 的票再用即关闭连接。`OpenStream` 之前若 `Begin` / `OpenToClient` 失败，Hub 会 `Release`，nonce 在 TTL 内还能再 Claim；客户端看不出这次 Claim 有没有被放回 | 仓外 `internal/relay/router.go` L255-263、L270-273；`internal/tickets/tickets.go` L221-235、L240-244 |
| resolver 选项只有 `forceNewTicket`、`forPairing`；`forceNewTicket` 仍会 `ticketCache.set`。`useRelayTicketCache`、`consumeRelayTicket` 属于 bug-hunt 01 方案 S2，未实施 | `connectionResolver.ts` L179、L397-398、L448 |
| `_mapPairingFailureCode` 是白名单；不在名单里的码折成 `transport_failed` | `universeAgentConnectionService.ts` L2286-2306 |
| grpc-js 1.14.4：Client 读取 `options.interceptors`。`grpc.client_idle_timeout_ms` 默认 30 分钟、下限 1 秒。idle 只在 `callCount === 0` 且空闲达到该值时 `enterIdle`；有在途调用则整段推迟。`Channel.close()` 对尚未 pick 的调用同步以 `UNAVAILABLE`（「Channel closed before call started」）结束 | `client.js` L45；`internal-channel.js` L45-47、L199、L434-441、L518-529 |
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
   - `GrpcUniverseAgentClient` 在构造时给 Client 传 `interceptors: [this._linkInterceptor]`。拦截器在 `start` 时读取当时已装入的 token 并写进 metadata，然后把 metadata、消息和 status 原样转给下一层。漏转 status 时调用不结束。既有 deadline 的 `callInvocationTransformer` 保留不动，它不改 metadata。所有调用（`probeRpc` 与 `grpcClientCalls.ts` 的全部 helper）都经过这个 Client，不必改调用点。
   - 不维护发送侧豁免清单：引擎对豁免方法忽略这个头（`AuthInterceptor.kt` L46-49）。
   - 装入点只有一处：`_connectProfileRaw` 的 `handshake.kind === 'authenticated'` 臂，与写 `_sessionToken`（L875）同一处、在能力探针（L880）之前，对**跑这次握手的那个 transport** 调用 `installSessionToken(handshake.result.sessionToken)`。探针因此带上 token，拿到真实状态。服务字段 `_sessionToken` 和 `_transportState = 'ok'` 仍写在探针之前（L875–878）。这两笔不是 connected 提交集。失配分支不回滚它们，那笔归 D944。不要把这两个服务字段挪到探针之后。
   - 不装入的地方：正式握手的 `pairing_pending` 臂（L854-872）；`_startProfilePairing`；编排器的试连与正式连接 transport（用完即关，Desktop ADR-031 INV-RCV-TOK-1 要求 S4 拿到的 token 不装入）；`_probeResolvedEndpoint`（只调 `GetAuthNonce`）；公开的 `connect()` 与 `!tls` 分支（生产无调用方，归 D944 S3 或删除，本稿不动）。
   - `_sessionToken` 字段、快照与 `isEngineConnected()` 不变。token 过 IPC 是 ELR-4，另案处理。

2. **S2 token 被拒即链路失效。** 覆盖 ELR-1 的过期与吊销面。与 S4 共用下面的订阅和收口。
   - `IUniverseAgentGrpcTransport` 增加 `readonly onDidRejectSessionToken: Event<void>`。拦截器在 `onReceiveStatus` 看到 `UNAUTHENTICATED`，且这次调用的 metadata 里有本拦截器写上的 token、路径不是 `/agentservice.SystemService/Connect` 或 `/agentservice.SystemService/GetAuthNonce` 时触发。路径是 grpc-js 看到的 `methodDefinition.path`，含前导斜杠。`close()` 时释放 emitter，监听随链路一起消亡。
   - 订阅在装入 token 的同一处、能力探针之前。闭包捕获这次尝试的 `transport`、`installedAtMs = nowMs()`，以及只属于这次尝试的 `condemned: 'rejected' | 'unavailable' | undefined` 和 `committed: boolean`。不新增服务字段。时间来源是可注入的 `nowMs`（缺省 `Date.now`）；比较宽限时调用 `nowMs()`。
   - 监听不要求 `transport === this._transport` 才记 `condemned`。D944 会把 `this._transport` 推迟到提交时才发布，探针打在 captured 上；标记若绑在「已经是当前指针」上，探针窗口的失败会丢掉。`rejected` 覆盖 `unavailable`；`unavailable` 不覆盖 `rejected`。`close()` 同步抛出的 `UNAVAILABLE` 因此不会把一次拒绝改写成换链路。
   - 探针窗口里 `committed === false`。监听只写 `condemned`，不写相位、不清 token、不排重连。臂在探针和两次 `_refresh*` 的每个 await 之后、写 connected 提交集之前检查：
     - 这次尝试已经不是当前拨号（HEAD：`this._transport !== transport`；D944：代际已失配）：只关闭 captured，返回 `{ ok: false }`，不写提交集，也不把收口写到赢家的字段上。
     - `condemned` 已置位：按下面的收口处理这次尝试，返回 `{ ok: false }`。不写 connected 提交集。探针把状态 16 或 14 记成 `UNKNOWN` 也不构成提交理由。
     - 两者都没有：写 connected 提交集，然后把 `committed` 置真，再 `_fireSnapshotChanged`。广播返回后若 `condemned` 已置位，按下面的收口处理并返回失败，不再维持 connected。`committed` 放在广播之前，这样广播期间同步失败的监听能自己收口。
   - 宽限从装入时刻 `installedAtMs` 起算。探针落在这 60 秒里。
   - `committed === true` 之后，监听在 `transport === this._transport`、`_transportState === 'ok'`、不在配对中、不在用户断开中时自己收口。否则忽略。
   - 收口顺序：若 `this._transport === transport`，先把指针置空，再 `transport.close()`。重新进入的事件看到指针已经不是自己，直接返回。然后：
     - `condemned === 'rejected'` 且 `nowMs() - installedAtMs < SESSION_TOKEN_REJECT_GRACE_MS`（60 秒）：视为引擎不接受这条链路刚拿到的 token。清空 `_sessionToken`，`_transportState` 置 `failed`，取消重连定时器，相位写 `failed{ transport_failed, 'session token rejected by engine' }` 并广播，不重连。这次尝试若还在 `_connectProfileRaw` 里，返回 `{ ok: false, code: 'transport_failed', reason: 'session token rejected by engine' }`。用户再点连接即重新拨号。
     - `rejected` 且已过 60 秒，或 `condemned === 'unavailable'`：以一个 `UNAVAILABLE` 的 `UniverseAgentTransportError` 调用既有的 `_markTransportFailed`，走 D408 重连。错误文案用 `transport unavailable`，不得复用宽限那句 reason。`connectProfile({ reconnect: true })` 会新建 channel、重跑 DeviceAuth，中继路径同时签新票。关闭已经在上一步做完；`_markTransportFailed` 本身不关 transport。探针窗口里的这次返回同样是 `{ ok: false, code: 'transport_failed' }`，reason 用传输错误原文。
   - `_connectProfileRaw` 入口会 `_cancelReconnectTimer()`（L732）。宽限分支自己不再排定时器。`_fireReconnect`（L2158–2166）对非 halt 的 `{ok:false}` 会 `_rescheduleReconnectAfterAttempt`，而 `transport_failed` 不在 `_isReconnectHaltCode`（L2114–2119）里。自动重连这一轮若在探针里被拒绝，D410 会把刚取消的定时器排回去。`_fireReconnect` 在 `!result.ok` 且 `result.code === 'transport_failed'` 且 `result.reason === 'session token rejected by engine'` 时，取消定时器并返回，不再排。其他 `{ok:false}` 仍走 D410。不把「相位已是 `failed` 且没有定时器」一律排除：`hub_unreachable` 等失败也是这个形状，它们要靠 D410 继续退避。用户直接点连接时调用栈上没有 `_fireReconnect`，宽限本来就会停住。
   - `_withTransport` 进入时捕获 `const transport = this._transport`。这次调用结束时若 `transport !== this._transport`：成功则原样返回，不把 `_transportState` 拉回 `ok`，不改相位，不 `_resetReconnectBackoff()`；失败则把错误抛回调用方，不调用 `_markTransportFailed`，不再排重连。已摘掉的 transport 上晚到的成功不能取消换票，晚到的 `UNAVAILABLE` 或 `DEADLINE_EXCEEDED` 也打不到新链路。当前 transport 上的 `DEADLINE_EXCEEDED` 仍只走这条失败臂，不经拦截器，也不先摘掉。
   - 重连里的 Connect 若因 Grant 被吊销而回 `UNAUTHENTICATED`，今天归为 `transport_failed` 继续退避（ELR-6，另案）；若回 `pairing_nonce`，走 HEAD 的 L854-872（D944 S5 的范围）。本稿不改这两种分类。

3. **S3 Hub 首配逐段签票。** 覆盖 ELR-2 主体。依赖 bug-hunt 01 方案 S2。
   - `PairingDialEndpoint` 增加 `readonly relayTicketId?: string | null`。`_startProfilePairing` 映射 endpoint（L2230-2234）时带上 `endpoint.relayTicketId`。带票指非空字符串；`null`、缺省和空串都是直连。
   - 编排器依赖里未被使用的 `issueRelayTicket` 换成 `renewDialEndpoint?: (profile: ConnectionProfile) => Promise<{ ok: true; endpoint: PairingDialEndpoint } | { ok: false; code: string; reason: string }>`。
   - 一张票最多交给一次 TLS。三次拨号各用各的 endpoint：
     - 观测用 `startPairing` 传入的 endpoint（第 1 张票）。
     - 试连前，带票则调用 `renewDialEndpoint`。await 之后检查 `generation` 与 `disposed`；失效则返回既有的 superseded，此时还没有试连 transport。通过则 `createPinnedTransport` 使用**这次返回的 endpoint**。返回值不写入 `activeContext`。
     - `activeContext.endpoint` 仍保存传入的那份。直连时它是两次拨号的目标。带票时只读它的 `relayTicketId` 来判断要不要续票；它的 host / servername 在观测用过之后不再交给 TLS。
     - 正式连接前，`context.endpoint.relayTicketId` 为非空字符串则再续一次票。await 之后调用 `isCurrentConfirmSas`；失效则返回既有的 stale，不建 transport。通过则 `createPinnedTransport` 使用**这次返回的 endpoint**，不用 `context.endpoint`。
   - 带票但依赖缺失时 fail-closed，返回 `{ ok: false, code: 'hub_ticket_failed' }`。续票失败时原样返回 `code`。`_mapPairingFailureCode` 按白名单放过已经列名的 `hub_unreachable`、`hub_ticket_failed` 等；不在名单里的码仍折成 `transport_failed`。
   - 连接服务装配编排器（L520-534）时注入 `renewDialEndpoint: profile => this._renewPairingDialEndpoint(profile)`。新方法调用 `this._connectionResolver.resolve(profile.profileId, { forPairing: true, forceNewTicket: true, useRelayTicketCache: false })`，按 L2230-2234 的同一方式映射。因为走 resolver 全链，自动复用 `withHubAccessRetry`、实时目录判定，以及 bug-hunt 01 S1 的私网分类。
   - 删除 `ConnectionResolver.createIssueRelayTicketHook`（L151-177）及其用例，并删除测试替身里的同名桩。
   - 配对成功后的那次 `connectProfile`（`confirmPairing` L955）不会碰到配对用过的票：第 1 张由 bug-hunt 01 S2 的 `consumeRelayTicket` 移出缓存，第 2、3 张从不进缓存。客户端无法观察 Hub 是否 `Release` 了一张未完成 `OpenStream` 的票，所以仍然每次 TLS 都用新票。

4. **S4 中继链路断开即链路失效。** 覆盖 ELR-2 的同类问题。
   - `IUniverseAgentGrpcTransport` 增加 `readonly onDidObserveUnavailable: Event<void>`。拦截器在任意调用（含流）以 `UNAVAILABLE` 结束、且路径不是上述两个握手方法时触发。收口、摘掉顺序、成功臂守卫和探针窗口规则都在 S2。流失败从此与 unary 一样进入重连；中继链路因此会换票。
   - `UniverseAgentPinnedTlsTarget` 增加 `readonly relay?: boolean`。`_connectProfileRaw` 创建 pinned transport（L774-778）时传 `relay: endpoint.relayTicketId !== null`（`ResolvedEndpoint.relayTicketId` 的类型是 `string | null`）。为真时通道选项加 `'grpc.client_idle_timeout_ms': 2_147_483_647`。超过 2³¹−1 时 Node 定时器会变成 1 毫秒。这个值是上限，约 24.8 天，而且 grpc-js 只在没有任何在途调用时才真正 idle；有在途流时计时会整段推迟。它管的是「连着但没有任何调用」的空闲。只剩流时的断线靠 `UNAVAILABLE` 收口换票。配对与探测用的短命 transport 不加。

## 4. 不变量

- 一个 transport 上的 token 只来自在同一个 transport 上完成的握手。换链路之后，新 transport 在自己握手成功之前不带任何 token。
- 已提交链路上的非握手调用都带这条链路的 token。
- 装入之后、提交之前，这次尝试一旦 `condemned`，就不得写入 connected 提交集。
- 一张中继票只用于一次 TLS 连接。试连和正式连接拨号用的是当次 `renewDialEndpoint` 的返回值。
- 中继上任何调用以 `UNAVAILABLE` 结束，都先摘掉这条链路，再换新票重建。已经摘掉的 transport 上，晚到的成功不得复活状态或清掉重连定时器，晚到的失败也不得 `_markTransportFailed`。
- 宽限收口的返回 reason 是 `session token rejected by engine`。`_fireReconnect` 见到这句就不再为这一轮排定时器。其他 `{ok:false}` 仍走 D410。
- 来自其他尝试的事件只给那次尝试打标记；失配时不写当前链路的相位、token 或重连定时器。
- 不新增 IPC 字段，不改 renderer。

## 5. 切片

顺序：S1 → S2 → S4 共用同一个拦截器，按此顺序落；S3 与它们无依赖，但必须在 bug-hunt 01 方案 S2 之后，或与之同一切片。

| Slice | Goal | Files | Tests | Exit |
|:------|:-----|:------|:------|:-----|
| **S1** | 链路上的调用带 token | `grpcTransport.ts`、`grpcClient.ts`、`universeAgentConnectionService.ts`（握手成功臂）、三个替身文件 | §8 S1 | 强制鉴权的引擎上，List、Chat 与能力探针不再因缺头失败 |
| **S2** | token 被拒即换链路 | 同上，加服务选项 `nowMs`、臂末尾的 `condemned` 检查、`_fireReconnect` 的宽限返回 | §8 S2 | 装入超过 60 秒后的拒绝会换链路；探针或 60 秒内的拒绝停在 failed，不提交 connected。自动重连这一轮的宽限返回不再排定时器 |
| **S3** | Hub 首配逐段签票 | `pairingOrchestrator.ts`、`universeAgentConnectionService.ts`（装配、新方法、endpoint 映射）、`connectionResolver.ts`（删钩子） | §8 S3 | 一次性票的假中继下，Hub 首配能走完；正式连接不用观测那张票的 servername |
| **S4** | 中继断开即换票 | `grpcClient.ts`、`universeAgentChannel.ts`、`universeAgentConnectionService.ts`（订阅、摘掉、`_withTransport` 成功臂与失败臂、`relay` 参数） | §8 S4 | 探针窗口或只剩流时，中继断开都会换票；旧 transport 上晚到的成功或失败都打不到新链路 |

## 6. 与已签收方案的接缝

- **connection-dial-generation（D944）。** 装入和 S2、S4 的订阅都在探针之前，打在这次尝试的 transport 上，属于链路准备，不属于 connected 提交集。
  - 若 D944 S1 先落：装入和订阅仍在 captured 上、探针之前完成。监听在探针窗口只写这次尝试的 `condemned`。臂末尾同时看代际失配和 `condemned`：任一成立都不写 connected 提交集。失配时只关闭 captured。订阅不推迟到提交之后。
  - 若本稿先落：D944 实施时把装入和订阅留在探针之前的 captured 上，不搬进提交集。提交集增加的是「失配或 `condemned` 则不写」。
  - 已提交之后的收口先比对 `transport === this._transport`；摘掉之后自然对不上。这与 D944「失配不写」同义，不另设代际。S4 的 `relay` 只多传一个参数，不改变 D944 对 transport 赋值时机的约束。本稿不把 L875 的 `_sessionToken` 早写搬进提交集；D944 实施时自己搬服务字段，装入仍留在探针之前。
- **bug-hunt 01 方案。** 它的 S2 是本稿 S3 的前置。它的 S1（按解析后的地址拒私网）经本稿 S3 的 resolver 路径，自动作用于配对的每一张票。它的 S3（握手失败码）与本稿 S2 不重叠：本稿处理的是装入 token 之后的调用被拒，含探针窗口，不改握手失败臂的码映射。
- **审查文的其余各条。** ELR-3（试连超时进恢复信任）、ELR-4（token 过 IPC）、ELR-6（吊销与真 pin 失败的分类）各自另案。本稿不改这些行为，也不让它们变得更糟。

## 7. 不做

- 按 TTL 主动续期（`ConnectResponse` 没有过期字段）。
- 在同一 channel 上重跑 Connect（见 Options D）。
- 把装入或订阅推迟到 connected 提交集。
- 把「相位已是 `failed` 且没有定时器」一律排除出 D410。
- keepalive ping：引擎对 ping 频率的容忍度未知，配错会被 GOAWAY。
- 修改公开 `connect()` 与 `!tls` 分支；ELR-3、ELR-4、ELR-6；D944 的代际与提交集。
- 重开托管 CI。

## 8. 验证

本地，点名文件跑 `scripts/test.sh --run`；门禁沿用 [health-gates](../progress/health-gates.md)。

| 切片 | 测试 | 断言 |
|:-----|:-----|:-----|
| S1 | 新增 `test/node/grpcClientSessionToken.test.ts`：进程内 grpc-js 明文服务端绑 `127.0.0.1:0`，用通用 handler 注册一个 unary、一个 server stream、一个 bidi 方法；`test/node/universeAgentConnection.test.ts` | 未装 token 时服务端收不到 `authorization`；装入 `t1` 后三类调用都收到 `Bearer t1`，并且都能以服务端返回的 status 结束（拦截器把 status 转下去了）。同一服务端上另一个未装 token 的 client 仍收不到（链路隔离）。连接服务：TLS 握手成功后 `installSessionToken` 恰好调用一次，参数是握手拿到的 token，且早于第一次 `probeRpc`；`pairing_pending` 臂与 `_startProfilePairing` 不调用；连 A 再连 B，B 的 transport 只收到 B 的 token |
| S2 | 同上两个文件 | 服务端对 unary 回 `UNAUTHENTICATED` 时 `onDidRejectSessionToken` 触发；同样的状态出现在路径 `/agentservice.SystemService/Connect` 上，或者未装 token 时，不触发。连接服务（注入 `nowMs` 与假定时器）：订阅早于第一次 `probeRpc`。探针回 `UNAUTHENTICATED` 时不写相位 connected，transport 已关闭，`_sessionToken` 为空，返回 `{ ok: false, code: 'transport_failed', reason: 'session token rejected by engine' }`，没有重连定时器。这次返回若落在 `_fireReconnect` 正在等待的那一轮，函数返回后仍然没有重连定时器，相位保持 `failed`。同一轮若是普通 `transport_failed`（reason 不是这句），D410 仍会排定时器。装入超过 60 秒后触发：先摘掉并关闭该 transport，相位变为 `connecting{transport_lost}`，重连以 `forceNewTicket` 解析。60 秒内触发，即便 close 使其他调用以 `UNAVAILABLE` 结束，相位仍为 `failed{transport_failed}`，没有重连定时器。其他尝试的事件不改变当前链路的状态 |
| S3 | `test/node/pairingOrchestrator.test.ts`；`test/node/universeAgentConnection.test.ts`；`test/node/connectionResolver.test.ts` | 带票 endpoint：`renewDialEndpoint` 恰好调用两次（试连前、正式连接前）。观测、试连、正式连接一共用到 3 个互不相同的 servername。试连用第一次续票的返回值，且该返回值不写入 `activeContext`。正式连接用第二次续票的返回值，不用 `activeContext.endpoint` 的 servername。用「同一 servername 第二次连接即失败」的假中继跑完整的 `startPairing` 加 `confirmSas` 能成功（HEAD 上同一用例失败）。不带票时从不调用。续票返回 `hub_unreachable` 时结果就是这个码，且不再建 transport。续票期间被新配对取代，返回既有的 superseded / stale 结果。连接服务：`_renewPairingDialEndpoint` 以 `{ forPairing: true, forceNewTicket: true, useRelayTicketCache: false }` 调 resolver。`createIssueRelayTicketHook` 的用例随删除移除 |
| S4 | 同 S1 的两个文件；`test/node/universeAgentChannel.test.ts` | server stream 以 `UNAVAILABLE` 结束时 `onDidObserveUnavailable` 触发。探针窗口的 `UNAVAILABLE` 不写 connected，并进入 `connecting{transport_lost}`、以 `forceNewTicket` 重连；这次返回的 reason 不是宽限那句。已提交链路上的 `UNAVAILABLE` 同样摘掉旧 transport 再排这次重连。随后旧 transport 上一个晚到的 unary 成功不得把 `_transportState` 拉回 `ok`，不得取消定时器，不得写回 connected。旧 transport 上晚到的 `UNAVAILABLE` 在新链路已经提交之后，不得把新链路标成 `failed`，不得再排重连。其他尝试的事件被忽略。`relay: true` 的 pinned 目标，通道选项含 `grpc.client_idle_timeout_ms: 2147483647`；`relay` 缺省时不含 |

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
| 2026-09-28 规则 16 第一轮 | Approve with changes | 无 Critical。已改入 4 条 Important：订阅改到装入时，探针窗口 `condemned` 的尝试不写 connected；§6 把装入和订阅留在探针之前，不搬进提交集；收口先摘掉再 `close`，`_withTransport` 成功臂不复活已摘掉的 transport；试连与正式连接拨号用当次续票返回值，不复用 `activeContext.endpoint`。Minor 已写入：豁免 path 带前导 `/`；close 同步 `UNAVAILABLE` 时宽限路径仍无重连定时器；基线改为 `32f3e9187c9`；Claim 在 `OpenStream` 前可能 `Release`；idle 只在无在途调用时生效；`_mapPairingFailureCode` 按白名单放过；拦截器必须转发 status。 |
| 2026-09-28 规则 16 第二轮 | Approve with changes | 无 Critical。已改入 2 条 Important：宽限返回 `{ code: 'transport_failed', reason: 'session token rejected by engine' }` 时 `_fireReconnect` 不再排 D410；`_withTransport` 失败臂在捕获的 transport 已不是当前指针时不 `_markTransportFailed`。不采纳「凡相位 `failed` 且没有定时器就不再排」：那会停掉 `hub_unreachable` 等仍要退避的失败。Minor 已写入：L875 的服务字段早写不挪到探针之后；`committed` 在广播前置真，返回前再看 `condemned`；当前链路上的 `DEADLINE_EXCEEDED` 仍只走 `_withTransport`。 |
| 2026-09-28 签收 | accepted | 用户签收。 |
| 2026-09-29 实施 | S1/S2/S4 | 拦截器、宽限收口、探针窗口 `condemned`、`_withTransport` 失配、中继 idle 已落。 |
| 2026-09-29 实施 | S3 + bug-hunt 01 S2 | Hub 首配在试连与正式连接前各续一张不进缓存的票，返回值不写入 `activeContext`。`useRelayTicketCache` 为假时不读写拨号缓存；`consumeRelayTicket` 在打开 TLS 或把票交给编排器之前删缓存。删除 `createIssueRelayTicketHook`。状态仍 `accepted`：无 H4a 真 Hub 冒烟。 |
