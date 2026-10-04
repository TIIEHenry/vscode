---
title: "引擎链接架构审查（2026-09-28）"
type: progress
status: draft
phase: M7
updated: 2026-10-05
summary: "IDE 到 UniverseAgent 引擎的连接链路只读审查，14 条（ELR-1…14）。ELR-1/ELR-2 方案 S1–S4 已落。ELR-3 身份就绪时的新尝试已落，身份未就绪的写信任仍被连接服务测试锁住。2026-10-01 增补 ELR-10…14：本机自动连接绕开拨号状态机、本机信任只靠端口、IPC 全量暴露、能力探测在桌面恒真、旧 connect() 仍在。ELR-10、ELR-11 各有 draft 方案。"
---

# 引擎链接架构审查（2026-09-28）

> **范围**：`src/vs/platform/universeAgent/` 的连接、配对、TLS pin、Hub 会话与 renderer 同步，以及直接消费连接状态的 `SessionViewHost`、roster 持久化和 Connection 面板的确认流程。只读审查，没有改产品代码。
> **基线**：HEAD `1145bce61de`，下文行号以此为准。以 `node/`、`common/`、`electron-main/` 开头的路径都在 `src/vs/platform/universeAgent/` 下；其余路径相对 `src/vs/`。
> **外部依据**：引擎是仓外钉死工位 `vscode-debug-engine/universe-agent`（版本以仓外 `PIN` 为准），引擎路径相对其 `grpc-server/src/jvmMain/kotlin/universe/agentic/grpc/`；Hub 是仓外 `UniverseAgent/connection-hub/`；donor 是仓外 `UniverseAgentDesktop/dev/decisions/031-recover-trust-complete-ui.md`。均只读。
> **对照**：[ADR-003](../decisions/003-engine-adapter-boundary.md) · [connection-hub-client](../plans/connection-hub-client.md) · [connection-dial-generation](../plans/connection-dial-generation.md)（D944）· [bug-hunt 01](bug-hunt-2026-09-24/01-connection-trust.md) / [02](bug-hunt-2026-09-24/02-hub.md) 与[对应方案](../plans/bug-hunt-2026-09-24/INDEX.md) · [钉死引擎调试](../../docs/guides/debug-engine.md)。
> **编号**：ELR-N（Engine Link Review）。字段沿用 bug-hunt：严重度、置信度、位置、现状、影响、已知、方向；依赖仓外证据的条目另加「外部依据」。

## 用词

Hub、Client 设备、SAS、Grant、DirectAddress 见 [glossary](../../docs/glossary.md)。下列说法不在 glossary 里。

| 本文写法 | 代码 / 旧文 | 含义 |
|----------|-------------|------|
| 链路 | `_transport` + `_sessionToken` + `_activeProfileId` | 一次拨号得到的通道、令牌与 profile 的组合 |
| 中继票 | relay ticket、`relayTicketId` | Hub 签发的一次性凭证；客户端以票里的 authority 作 SNI 连中继 |
| 首配阶段 S1–S7 | Desktop ADR-027 的 typestate | S1 观测引擎证书；S2–S4 用观测到的证书临时 pin 并试连；S5 核对 SAS；S6–S7 正式连接并写信任 |
| 试连 | provisional Connect | S2–S4 那次 DeviceAuth Connect，期望拿到 `pairing_nonce` |
| 恢复信任 | recoverTrust | 引擎已认识本机公钥、本地缺信任记录时，只核对身份与指纹、不走 SAS 的写信任流程（Desktop ADR-031） |
| 跳过鉴权 | skip-auth | 引擎对回环且未启用 Hub 的连接不校验 session token |

## 结论

骨架是对的：`node/` 与进程无关，由 electron-main 装配，renderer 只见 `common/` 契约并经 ProxyChannel 调用，与 AHP 隔离（ADR-003）；私钥与 Hub refresh 只在 main、经 safeStorage 加密；握手 transcript 用本地观测到的证书指纹。

问题在实现与外部合同对不上。远程引擎这条主路径（Hub 中继与非回环 DirectAddress）在 HEAD 上走不通：Connect 之后的调用不带 session token，引擎全部拒绝（ELR-1）；Hub 设备首配用一张一次性中继票连三次（ELR-2）。首配还有一条不经 SAS 就写信任的路径（ELR-3），推翻 bug-hunt 01「看过但未立条」的判定。

目前唯一的真引擎证据来自钉死引擎。它绑定回环、不带 `--hub`，引擎跳过鉴权，恰好遮住 ELR-1 与 ELR-2；单测替身也没有表达这两条外部合同。

9 条里，ELR-1、2、4、5、7、8 在既有文档里没有记录；ELR-3 被既有扫描看过但判为不立条；ELR-6、9 与 BH-01-6、D944 S4 局部重叠，重叠处写在各条「已知」里。私网字面量（BH-01-4）、探测烧票（BH-01-5）、握手失败码折叠（BH-01-6）与拨号代际（D944）已有签收方案，本文不重复，只在「对已签收方案的补充」里给增量。

2026-09-29：ELR-1 与 ELR-2 的方案 [remote-link-auth-and-relay](../plans/remote-link-auth-and-relay.md) S1–S4 已落，bug-hunt 01 方案 S2 同切片。其余各条仍未开方案。无真 Hub 冒烟。

## 发现

### ELR-1 远程引擎上 Connect 之后的调用不带 session token

- 严重度：high
- 置信度：高
- 位置：`node/grpc/grpcClient.ts` 构造函数 L1135-1150 只装默认 deadline 的 `callInvocationTransformer`，`node/` 全树没有 metadata 或 call credentials；`node/universeAgentConnectionService.ts` L875 只把 token 存进 `_sessionToken`；`node/grpc/grpcTransport.ts` L415-418 的 `isTransportFailureCode` 只认 `UNAVAILABLE`、`DEADLINE_EXCEEDED`。
- 外部依据：`interceptor/AuthInterceptor.kt` L57-61 对缺 `authorization` 头的调用回 `UNAUTHENTICATED`，豁免只有 `Connect`、`GetAuthNonce`、`HealthCheck`（L166-170）。`HeadlessServer.kt` L1162-1180：带 `--hub` 或非回环绑定时必须启用该拦截器，因为 Hub 反向隧道把远端调用方 splice 到回环，不能按对端地址跳过。token 默认 12 小时过期（`auth/SessionTokenStore.kt` L8、L93）。
- 现状：Connect 成功，相位写成 connected；之后的 List、Chat 等调用全部 `UNAUTHENTICATED`。这个码不改相位，也不触发重连。即使补上 header，token 12 小时到期后也没有重新握手的路径。
- 影响：PRD-024 的远程主路径不可用。[connection-hub-client](../plans/connection-hub-client.md) §3.6 要求 session_token 作为 channel metadata，实现漏了。
- 触发：连接任何 Hub 设备（引擎带 `--hub`），或非回环绑定的 DirectAddress，然后打开会话。
- 测试为何没发现：mock transport 没有 metadata 概念。D25/D26 复验与[钉死引擎调试](../../docs/guides/debug-engine.md)都在回环跳过鉴权下进行。
- 已知：[remote-link-auth-and-relay](../plans/remote-link-auth-and-relay.md) S1/S2 已落。调用带 Bearer；非握手 `UNAUTHENTICATED` 或 `UNAVAILABLE` 先摘掉链路再换，不在同一 channel 重跑 Connect。宽限内拒绝停在 failed。
- 方向：token 属于链路，在该链路的 channel 上注入 `authorization: Bearer`。非豁免调用回 `UNAUTHENTICATED` 时，在同一 channel 上重跑一次 DeviceAuth Connect；仍拿不到 token，按 ELR-6 收口。

### ELR-2 Hub 设备首配用一张一次性中继票连三次

- 严重度：high
- 置信度：高
- 位置：`node/universeAgentConnectionService.ts` 的 `_startProfilePairing` L2219-2234 只解析一次，得到一张票；L529 把 `issueRelayTicket` 注入编排器。`node/pairingOrchestrator.ts` L85 声明了 `issueRelayTicket`，全仓没有读取；S1 观测（L192-196）、试连通道（L214-217）、`confirmSas` 的正式通道（L339-342）连的都是同一个 `endpoint`。
- 外部依据：`internal/relay/router.go` L255-263 在窥探 SNI 之后、转发任何字节之前原子 Claim；`internal/tickets/tickets.go` L221-235 对已 Claim 的票再次使用返回失败。
- 现状：S1 观测连上时票已被占用。试连用同一个 SNI，被 Hub 以 `ticket_claim_fail` 关闭。S6 同理，而且发生在用户核对 SAS 之后，可能已过 5 分钟 TTL。
- 影响：Hub 设备首配无法完成。[connection-hub-client](../plans/connection-hub-client.md) §3.4 B 与 Desktop INV-PAIR-TKT-1 都要求三段各用一张票。
- 触发：对未配对的 Hub 设备 profile 点连接。
- 已知：同方案 S3 与 [bug-hunt 01 方案](../plans/bug-hunt-2026-09-24/01-connection-trust.md) S2 已于 2026-09-29 同切片落地。试连与正式连接各续一张不进缓存的票，返回值不写入 `activeContext`；观测用的票在交给编排器前 `consumeRelayTicket`。S4 已落（中继 `UNAVAILABLE` 先摘掉再换票）。无 H4a 真 Hub 冒烟，不升 PRD-024。
- 方向：编排器三段各自调用 `issueRelayTicket`，用新 authority 拨号；S6 在用户确认之后再签票。同类问题：grpc-js 子通道断开后会用同一个 SNI 自动重拨，在中继路径上注定失败；应把通道断开直接视为链路失效，由上层签新票重建。

### ELR-3 首配试连超时即进入恢复信任，不经 SAS 写信任

- 严重度：high（安全）
- 置信度：高
- 位置：`node/pairingOrchestrator.ts` L531-539：`runProvisionalConnect` 超时（默认 8 秒，L94）即返回 `recoverTrust: true`；L226-247 把 S1 观测到的叶证书放进恢复上下文；`confirmRecoverTrust`（L422-462）据此写 `EngineTrustRecord` 与 profile。`node/universeAgentConnectionService.ts` L530-534 的两个确认钩子恒为 `true`；批准实际发生在 `workbench/contrib/conversation/browser/connectionPreferencesPane.ts` L1673-1713 的 renderer 对话框，之后调用 `confirmPairing()`。
- 外部依据：`auth/EngineDeviceAuthService.kt` L115-124 对未知客户端立即 `beginPairing` 并返回；`SystemGrpcService.kt` L72-82、L186-193 随即回 `pairing_nonce + sas_code`。引擎不会挂住 Connect。Desktop ADR-031 只在 S4 意外拿到 token 时进入恢复；恢复要新开一次尝试，重走 S1–S3 并用三张新票（INV-RCV-ATT-1）；批准只来自 main 的原生对话框，IPC 不带批准（PA-1、PA-2、INV-RCV-IPC-1）。
- 现状：试连 8 秒没有返回时，界面只弹身份与指纹对话框（0 次 SAS）；用户确认后，用 S1 观测到的叶证书写信任，之后正式拨号 pin 的就是这张证书。`confirmPairing()` 这次 IPC 调用本身就等于批准，任何窗口调用都会提交信任。
- 影响：超时不能证明已有 Grant，只说明网络慢或有人拖延。恶意 Hub 或局域网中间人用自己的证书，回一个指纹自洽的 AuthNonce 再拖住 Connect，用户就只剩「逐位核对 64 位十六进制指纹」一道防线；确认后对端再回一个 token，IDE 即认为已连接。连接远程引擎时文件与 Shell 在本机执行，后果是本机工具被对端驱动（仍受权限确认约束）。这也与 PRD-024 验收 3「SAS 无跳过」相悖。
- 触发：首配时试连超过 8 秒未返回。
- 已知：[bug-hunt 01](bug-hunt-2026-09-24/01-connection-trust.md)「看过但未立条」第一条看过这段，以「注释与代码一致、窗格先确认」判为不立条。本条以上面的引擎行为与 donor 约束推翻该判定。
- 方向：删掉「超时进入恢复信任」，超时按 `transport_failed` 处理。恢复信任只在意外拿到 token 时进入，并作为新尝试重新观测、重新签票。SAS 与恢复两个确认框移到 main（`IDialogMainService`），renderer 只发起请求。
- 超时半边已按 transport_failed 改。SAS 与恢复信任的生产确认改走 main 的 `IDialogMainService`；拒绝、关闭或抛错都不批准。`dispose` 在相位变为 disconnected 后、`super.dispose()` 之前广播一次。偏好设置窗格不再先画确认，直接 `confirmPairing()`。
- 2026-10-05：身份就绪时 `confirmRecoverTrust` 不再把试连叶直接写入信任。批准后按 [recover-trust-new-attempt](../plans/recover-trust-new-attempt.md) 重新观测；新叶指纹与用户确认的不一致则 `fingerprint_mismatch` 且不写信任。中继 endpoint 在重新观测前和重新握手前各续一次票。新握手拿到 `session_token` 才写入刚观测到的叶并返回该 token；若改回 `pairing_nonce`，不写信任，快照改为带 SAS 的 `grant_pending`，下一次确认走 `confirmSas`。客户端身份未就绪时仍按批准即写信任——`universeAgentConnection.test.ts` 的生产夹具锁着这条，且 `startPairing` 在身份未就绪时进不了 recoverTrust。不改连接服务。不升 PRD-024。

### ELR-4 session token 经 IPC 发给每个窗口

- 严重度：medium（安全）
- 置信度：高
- 位置：`node/universeAgentConnectionService.ts` 的 `_buildSnapshot` L2175-2186 把 `sessionToken` 放进每次 `onDidChangeConnection` 快照；`common/connectProfileResult.ts` L48-55 把它原样回传给 renderer。renderer 唯一的用法是当布尔判断（`workbench/contrib/sources/browser/sourcesReviewAttributionService.ts` L89）。
- 现状：连接期间，每个窗口的 renderer 都持有 token 原文。
- 影响：[connection-hub-client](../plans/connection-hub-client.md) §3.6 写明 session_token 不过 IPC，§6 秘密边界测试的字段清单漏了它。token 是 12 小时有效的 bearer 凭证，DirectAddress 场景下持有它即可冒充 IDE 调用引擎。
- 已知：否。
- 方向：快照改为 `authenticated: boolean`，`connectProfile` 的结果不再带 token，契约测试把 `sessionToken` 列入禁止字段。
- 快照已改为 authenticated，确认框迁 main 与 ELR-5/6 未做。

### ELR-5 测试连接结束时回写旧 transport 与相位

- 严重度：medium
- 置信度：高
- 位置：`node/universeAgentConnectionService.ts` 的 `probeConnectionProfile` L964-998，`finally`（L993-997）把 `_transport`、`_connectionPhase` 恢复成探测前的值；`_probeResolvedEndpoint`（L2309-2353）只用自己的探测 transport，从不写这两个字段。
- 现状：探测期间（目录查询加最长 10 秒）发生 Disconnect、断线重连或配对开始时，探测结束会把已关闭的 transport 指针和旧的 connected 相位静默写回，不广播；下一次快照把它发给所有窗口，之后的调用打到已关闭的 transport 上。
- 影响：这道「护栏」保护的是探测根本不写的字段，实际只会覆盖并发写入。
- 触发：点 Test Connection，结果返回前点断开，或此时连接恰好断开重连。
- 已知：否。D944 与 BH-01 未覆盖；BH-01-5 讲的是同一函数烧中继票。
- 方向：删掉这段恢复。要防回归，就断言探测本身不写这两个字段。
- 探测结束已不再把 `_transport`、`_connectionPhase` 恢复成探测前的值；测试锁住探测本身不写这两个字段，以及探测结束不盖掉探测期间别人写下的指针和相位。

### ELR-6 真正的 pin 失败与 Grant 吊销都按传输失败无限重连

- 严重度：medium
- 置信度：高
- 位置：`node/deviceAuthHandshake.ts` L92-103（GetAuthNonce 抛错）与 L155-163（Connect 抛错）一律返回 `transport_failed`；`node/universeAgentConnectionService.ts` L846-851 据此写相位并调度重连，L2114-2120 的停止重连集合碰不到这两种情况。pin 校验在 TLS 层（`node/universeAgentChannel.ts` L37-49 的 `checkServerIdentity`），失败时 grpc-js 报 `UNAVAILABLE`。
- 外部依据：`auth/EngineDeviceAuthService.kt` L126-128 对已吊销的 Grant 抛 `UNAUTHENTICATED`，L149-150 验签失败同样抛出。
- 现状：已配对引擎换了证书（重新生成或中间人），或 Grant 被吊销后，相位只显示连接失败，退避重连最长 30 秒一轮，永不停止。`grant_revoked` 在生产代码里从未产生。
- 影响：[glossary](../../docs/glossary.md) 的 Grant 条与 [connection-hub-client](../plans/connection-hub-client.md) §3.1 I6 要求吊销后 `failed(grant_revoked)`、不自动重配；证书变化这一安全信号被藏进了普通网络错误。
- 触发：对已配对 profile，在引擎侧吊销 Grant 或更换 TLS 证书之后连接，或等待自动重连。
- 已知：部分。BH-01-6 管的是反方向：身份不符与签名器失败被画成 pin，由 bug-hunt 01 方案 S3 处理。
- 方向：按 gRPC 状态码与 TLS 错误原因分类。证书校验失败写 `pin_mismatch` 并停止重连；Connect 回 `UNAUTHENTICATED` 写 `grant_revoked` 并停止，给出重新配对入口；只有 `UNAVAILABLE` 才重连。
- GetAuthNonce / Connect 抛错已按 gRPC 状态码与 TLS 原因分类：证书校验失败写 `pin_mismatch` 并停止重连；Connect 的 `UNAUTHENTICATED` 写 `grant_revoked` 并停止重连，profile 留成现有 `pairingPending`（trust 清空）以便下次用户连接走 `pairing_required`，不自动 startPairing；只有 `UNAVAILABLE` 仍按 `transport_failed` 重连，其余抛错写 `engine_not_serving` 且不再当成传输失败重连。

### ELR-7 Hub 不可达时报成登录过期

- 严重度：medium
- 置信度：高
- 位置：`node/hubAuthAccess.ts` 的 `resolveAccessToken` L34-52：refresh 以非 401/403 原因失败时不返回该失败；接着 `getAccessTokenForHub` 取不到已过期的 access（桶在 `node/hubSessionStore.ts` 的 `readBucket` L492-500 已被删），于是 L48-49 返回 `authExpired`。
- 现状：access（15 分钟）已过期且 Hub 网络不可达时，刷新目录与连接 Hub 设备都报 `hub_auth_expired`。
- 影响：PRD-024 验收 1 要求登录过期与不可达的文案互不混用。用户会被引导重新登录，而 refresh token 仍然有效。
- 触发：空闲 15 分钟以上后断网或 Hub 宕机，再刷新设备或连接 Hub 设备。
- 已知：否。BH-02-4 是另一条路径：刷新成功但目录失败时，过期标志不清。
- 方向：refresh 以非鉴权原因失败时原样上报并映射为 `hub_unreachable`，只有 401/403 才算过期。
- refresh 非 401/403 失败已由 `resolveAccessToken` 原样保留原因并映射为 `hub_unreachable`（401/403 仍是 `authExpired` / `hub_auth_expired`），测试锁住过期 access 遇网络失败或 HTTP 500 时拨号与目录刷新都报不可达而不是登录过期，且 401 与 403 仍是登录过期。

### ELR-8 连接模型里没有「当前是哪台引擎」

- 严重度：medium
- 置信度：高
- 位置：`code/electron-main/app.ts` L1231-1232、L1407-1408：连接服务是 main 单例，经 `ProxyChannel.fromService` 给所有窗口。快照（`node/universeAgentConnectionService.ts` L2175-2186）没有 engineIdentityId、profileId 或链路代号；换 profile 时替换 transport（L769-781）不广播。`node/sessionViewHost.ts` 的 `onEngineConnectionChanged` L485-526 只看 `isEngineConnected()` 这个布尔。持久化的 `conversation.roster.v1` 里，`engineCache`（`workbench/contrib/conversation/browser/conversationRosterStorage.ts` L22-34）没有引擎键。
- 现状：已连引擎 A 时在任一窗口连 B，所有窗口一起改指 B。中间没有「断开」边沿，`SessionViewHost` 把 A 的 session id 拿到 B 上恢复并重开流；断连缓存跨引擎串用。
- 影响：「全应用只连一台引擎」是隐含不变量，ADR-003 与连接方案都没写（Decision 3 只讲一窗一 session），Connection 面板却按窗口呈现。
- 触发：连着 A 且有打开的会话时，连接另一个 profile。
- 已知：否。
- 方向：快照带链路 id 与 engineIdentityId，任何变化都按断开再连接处理（清流、清缓存）；roster 缓存按 engineIdentityId 分桶；在 ADR-003 写明单引擎不变量，或改为按窗口连接。

### ELR-9 相位不随快照走，多处变化不广播

- 严重度：low
- 置信度：高
- 位置：`node/universeAgentConnectionService.ts` 的 `connect` L654-658、`_connectProfileRaw` L743-748 改相位但不广播；`_fireSnapshotChanged`（L2196-2198）发出的快照不含相位；`common/universeAgentConnectionChannelClient.ts` L60-63、L137-149 收到快照后再发一次 IPC 取相位。
- 现状：`connectProfile` 进入 connecting 后要到握手结束才广播，状态栏的「Connecting…」除配对路径外基本看不到。两次 IPC 重叠时会乱序。
- 已知：部分。乱序是 D944 的 S4；不广播未见记录。
- 方向：相位与 agentTreeFetchFailed 放进同一个快照，每次相位变化都广播。这样 S4 的成功包序号也不再需要（见下节）。
- 相位与 agentTreeFetchFailed 已放进同一份快照：transport 仍为 idle、相位从 disconnected 进入 connecting 时就广播，快照里就是新相位；渲染端据此更新，不再为这次变化调用 getConnectionPhase。条目仍开。

## 增补（2026-10-01）

> **基线**：HEAD `7cf1474419e`，本节行号以此为准，路径约定同文首。本机免 SAS 自动连接由 `f26be0d5ccc`（2026-09-29）引入，晚于本文原基线 `1145bce61de`，原 9 条没有覆盖。
> **外部依据**：钉死引擎 `vscode-debug-engine/universe-agent`（PIN `748e7698e6`），路径相对 `grpc-server/src/jvmMain/kotlin/universe/agentic/grpc/`。只读。

### ELR-10 本机自动连接绕开拨号状态机

- 严重度：high
- 置信度：高（竞争与订阅丢失由代码路径推出，未写测试复现）
- 位置：`node/universeAgentConnectionService.ts` 的 `_connectLocalSkipAuth` L2469-2542；守卫 L2480；提前写指针 L2491；`_armAuthenticatedLink` L3187-3204 与单槽 `_linkEvents` L594、L3198-3201；`_applyConnectedCommit` L2841-2876；`_dropPublishedTransport` L2770-2784；`_liveConnectedPublished` L2733-2739；`connectProfile` L872-902；`_canDiscoverLocalEngine` L2436-2441。
- 现状：
  - 本机这条拨号不捕获 `_connectEpoch`，也不经 `_applyConnectedCommit`。`connectWithoutDeviceAuth` 返回后，它在能力探针之前就写 `this._transport`、`_sessionToken`、`_loopbackSkipAuth`。[connection-dial-generation](../plans/connection-dial-generation.md) 规定 `this._transport` 只在提交时赋值。
  - await 之后的守卫只看相位是不是 `connecting`。用户 `connectProfile` 走 `_markDialConnecting` 也写 `connecting`，守卫分不出两者。`connectProfile` 既不取消本机发现的定时器，也不压制发现。
  - `_linkEvents` 是全服务一个槽。`_armAuthenticatedLink` 先 `_disposeLinkEvents()` 再装自己的订阅。本机这条在用户拨号的 `_dialDeviceAuth` 装订阅之后再 arm，就会把用户那条链路的 `onDidRejectSessionToken` / `onDidObserveUnavailable` 订阅拆掉。之后提交的 profile 链路没有 [remote-link-auth-and-relay](../plans/remote-link-auth-and-relay.md) S2/S4 的收口。
  - 拨号机制判断「已有活链路」用 `_liveConnectedPublished()`，它要求非空 token。跳过鉴权的本机链路没有 token，在这些守卫眼里永远不是赢家。`isEngineConnected()` 却认它已连接（L700-703）。同一服务里有两套「已连接」判据。
  - `_loopbackSkipAuth` 只在 `disconnect` 和本机链路的传输失败臂清。`_takeOverEntry` → `_dropPublishedTransport` 与 `_applyConnectedCommit` 都不清。从本机切到 profile 之后，这个旗还是真。今天其他守卫恰好把它遮住，但它是 `isEngineConnected()` 的第二个放行条件。
- 影响：本机发现进行中时用户点连接，两条拨号争写 `_transport`；赢的若是 profile 链路，可能没有 token 被拒与中继断开的收口，断线后不换链路。
- 触发：IDE 启动后约 0–1 秒内，或引擎晚起、发现按退避重试时，用户对任一 profile 点连接。
- 测试为何没发现：本机发现的测试只覆盖单独一条拨号；没有「发现在飞时用户拨号」的用例。
- 已知：否。原文对已签收方案的补充里提过链路对象，但那时还没有本机发现。
- 方向：本机拨号捕获 epoch、在 captured 上跑完探针、经 `_applyConnectedCommit` 提交；链路订阅随尝试走，提交时才进服务槽；用户拨号取消发现；`_liveConnectedPublished` 与 `isEngineConnected` 用同一判据。方案：[loopback-link-commit](../plans/loopback-link-commit.md)。

### ELR-11 本机引擎的信任只靠端口号

- 严重度：medium（安全）
- 置信度：高
- 位置：`electron-main/universeAgentMainService.ts` L49 硬编码 `autoConnectLocalEngine: true`；`node/localEngineDiscovery.ts` L12 探 `[50061, 50051]`；`node/universeAgentChannel.ts` L46-51 `rejectUnauthorized: false`、`checkServerIdentity` 恒放行；`isEngineConnected` L696-704；`common/universeAgentRendererSync.ts` L229-231。
- 外部依据：
  - `HeadlessServer.kt` L1061-1073：Linux / macOS 默认只听 UDS，`--no-uds` 才走 TCP；L1086-1096 把 socket 所在目录设为 0700；UDS 服务端装 `AuthInterceptor.skipAuth()`。
  - `ServerLockfile.kt` L67、L125 起：监听前在 agent-home 写 `server.lock`（JSON 含 `pid`、`port`、`bind`），权限仅 owner。
  - `auth/EngineTlsMaterial.kt` L126-133、L254-258：TLS 叶证书持久化为 agent-home 下 `engine-tls.crt`，仅 owner 可读写。钉死工位实测 `-rw-------`。
- 现状：
  - 生产构建无条件开启自动连接。本机任何进程只要先占住 50061 或 50051、实现 UA 的 `SystemService/HealthCheck` 与 `Connect`，就被当成引擎，不经 SAS，也不 pin 证书。
  - 引擎按默认参数在 Linux / macOS 上只听 UDS，IDE 不探 UDS，所以默认启动的引擎反而发现不了。
  - 不带 `device_auth` 的 `Connect` 无论引擎是否强制鉴权都成功返回、不带 token（仓外 `SystemGrpcService.kt` L72-73）。本机带 `--hub` 的引擎仍绑回环、强制鉴权，IDE 却按跳过鉴权提交 connected，之后调用全部 `UNAUTHENTICATED`；没有 token 时拦截器不上报拒绝，链路不收口。
  - [ADR-003](../decisions/003-engine-adapter-boundary.md) Decision 7 写「已连接 = 非空 session_token + 活 channel」。本机跳过鉴权的链路没有 token 也算已连接，ADR 没有修订。renderer 缓存的「已连接」只看相位与非配对，不看 channel 是否存活，与 main 的判据不同。
- 影响：被冒充的「引擎」获得与远程引擎相同的面：本机文件与 Shell 工具由对端驱动（仍受权限确认约束）。多用户机器或本机已有恶意进程时可利用。
- 触发：IDE 启动前，另一个进程先监听 `127.0.0.1:50061` 或 `:50051` 并回应 HealthCheck。
- 已知：否。[connection-hub-client](../plans/connection-hub-client.md) 写了「skip-auth 只允许 loopback / UDS」，但没写本机目标怎样被确认是本用户的引擎。
- 方向：信任锚改为只有同一系统用户可读的引擎 home 文件（UDS 目录 0700，或 `engine-tls.crt` 加 `server.lock`）；没有锚就不自动连接；用新 ADR 修订 Decision 7。方案：[local-engine-trust-anchor](../plans/local-engine-trust-anchor.md)。

### ELR-12 连接 channel 把整个服务对象暴露给每个窗口

- 严重度：medium
- 置信度：高
- 位置：`code/electron-main/app.ts` L1407-1408 `ProxyChannel.fromService(connection)`；`base/parts/ipc/common/ipc.ts` L1198-1199 对任意函数属性放行；`common/universeAgentHostConnection.ts` L16-17 注释「Not proxied to renderer」；`node/universeAgentConnectionService.ts` L568 一个类实现 `IUniverseAgentConnection`、`IUniverseAgentHostConnection`、`IUniverseAgentHubService`；`common/hub.ts` L10 与 `common/universeAgentConnection.ts` L374 是同一个 channel 名 `'universeAgentConnection'`；`electron-main/universeAgentSessionViewService.ts` L28 `connection as unknown as IUniverseAgentHostConnection`。
- 现状：宿主专用的 `fetchAgentTree`、`fetchToolDetail`、`notifyFileMutation`、`notifyTurnSettle`、`notifyTeamRuntimeChange`、`openChatStream` 等，以及旧 `connect()`，都能被任一窗口经 IPC 调用。`notifyFileMutation` 可伪造广播到所有窗口的文件变更。宿主接口没有自己的 DI token，只能靠双重强转拿到。
- 对照：`electron-main/universeAgentSessionViewChannel.ts` 已用显式白名单 `FORWARDED_CALLS`，并以 IPC `ctx` 校验 lease 所有者。
- 影响：「宿主专用」只是注释，不是边界。renderer 契约与 main 实现越长越难对齐。
- 已知：原文「看过但未立条」记过结构问题；本条补上可伪造事件与假注释两条具体证据，升为立条。
- 方向：连接 channel 改为显式白名单的 `IServerChannel`（仿 SessionView channel）；`IUniverseAgentHostConnection` 单独注册 main 侧 token；Hub 用自己的 channel 名。未开方案。

### ELR-13 能力探测在桌面端恒为真

- 严重度：medium
- 置信度：高
- 位置：`IUniverseAgentConnection` 有 158 个可选方法、51 个必需方法；`workbench/` 生产代码中 38 处 `typeof conn.x === 'function'`，例如 `workbench/contrib/sources/browser/sourcesChangesList.ts` L549、L585，`workbench/contrib/sources/common/sourcesChangesReadModel.ts` L233、L238。`common/universeAgentConnectionChannelClient.ts` L117-121 的注释已承认 ProxyChannel 让每个成员都成为函数。
- 现状：桌面 renderer 拿到的是 `createRemoteForwardingProxy` 包着的 `ProxyChannel.toService`，任何属性都是函数，这些判断恒真。只有 Web 桩和测试替身会让它们为假。
- 影响：同一按钮的可用性在测试里和生产里不一样。引擎没提供某个 RPC 时，桌面端仍显示入口，点了才失败。
- 已知：否。
- 方向：能力判断统一读能力快照或 `Connect` 返回的方法表；可选方法改为必需并由 Web 桩显式拒绝。未开方案。

### ELR-14 旧 `connect()` 仍在且暴露给窗口

- 严重度：low
- 置信度：高
- 位置：`node/universeAgentConnectionService.ts` L806-870；`_openLoopbackTransport` L2337-2343 指针非空即复用当前 transport；`node/grpc/grpcClient.ts` L1119 缺省 `createInsecure()`；默认地址 L647 `127.0.0.1:50051`。生产无调用方；`test/node/universeAgentConnection.test.ts` 有 198 处调用。
- 现状：明文、硬编码地址，经 ELR-12 的全量暴露对每个窗口可调。本机自动连接上线后，它成了第二条行为不同的 loopback 路径；本机链路在线时调用它会复用那条 TLS transport，失败臂可能把它关掉。
- 已知：原文「对已签收方案的补充」建议删除，未做。
- 方向：先随 ELR-12 的白名单退出 IPC 面，再把测试迁到 `connectProfile` 或本机拨号后删除。未开方案。

## 与既有记录的关系

| 本文 | 既有记录 | 关系 |
|------|----------|------|
| ELR-1 | connection-hub-client §3.6 | 设计已写，实现漏了；新增 |
| ELR-2 | BH-01-5，bug-hunt 01 方案 S2 | S2 只管拨号缓存；配对一票三用为新增 |
| ELR-3 | BH-01「看过但未立条」第一条 | 推翻不立条的判定 |
| ELR-4 | connection-hub-client §3.6、§6 | 新增 |
| ELR-5 | BH-01-5（同一函数的另一问题） | 新增 |
| ELR-6 | BH-01-6，bug-hunt 01 方案 S3 | 方向相反；新增 |
| ELR-7 | BH-02-4 | 另一条路径；新增 |
| ELR-8 | ADR-003 Decision 3 | 新增 |
| ELR-9 | D944 S4 | 不广播为新增 |
| ELR-10 | connection-dial-generation、remote-link-auth-and-relay S2/S4 | 新增；本机拨号违反前者的提交规则，并能拆掉后者的订阅 |
| ELR-11 | ADR-003 Decision 7、connection-hub-client §3 | 新增；ADR 未随本机跳过鉴权修订 |
| ELR-12 | 本文「看过但未立条」第 5 条 | 由不立条升为立条 |
| ELR-13 | — | 新增 |
| ELR-14 | 本文「对已签收方案的补充」S3 | 建议未执行 |
| — | BH-01-1…3（D944）、BH-01-4、D24 | 已有记录或方案，本文不重复 |

## 对已签收方案的补充

改方案正文前要用户裁定，本文不直接改。

| 方案 | 建议 |
|------|------|
| [connection-dial-generation](../plans/connection-dial-generation.md) S1、S2、S5 | 该稿审了 16 轮、逐行加闸，说明字段级 epoch 很难守住。替代做法：一次拨号即一个不可变的链路对象（transport、token、profileId、engineIdentityId、代号），鉴权与探针全部完成后原子替换当前链路；调用时捕获链路；过期的尝试只能关闭自己的链路。ELR-8 需要的链路 id 也由它提供 |
| 同上 S3 | 公开的 `connect()`（硬编码 `127.0.0.1:50051`、明文、JSON 编码的 Connect）与 `!tls` 分支在生产中没有调用方，也没有代码会产生 `loopback` profile。直接删除，比给这条死路径补 proto 编码更省 |
| 同上 S4 | 相位进快照（ELR-9）之后不再需要成功包序号。与该稿「不给 snapshot 加字段」冲突，需要裁定 |
| 同上 S5 | 后台重连遇到正式 `pairing_pending` 时，不宜自动清信任并进入配对；应停在需要用户重新配对的状态，信任由用户动作清除 |
| [bug-hunt 01 方案](../plans/bug-hunt-2026-09-24/01-connection-trust.md) S1 | `0.0.0.0/8` 与 `::` 已并进同一分类器，见 [unspecified-address-private-denial](../plans/unspecified-address-private-denial.md)。方案仍 draft。BH-01 正文不改 |
| 同上 S2 | 已与远程链路 S3 同切片落地：探测不读写拨号缓存，票交出后离开缓存。逐段签票由该方案 S3 覆盖 |

## 建议顺序

进入实施前，每一项都要先写方案并走[规则 16](../../docs/DOCUMENTATION.md)。

1. ELR-1 与 ELR-2：方案 [remote-link-auth-and-relay](../plans/remote-link-auth-and-relay.md) 的 S1–S4 已落，bug-hunt 01 方案 S2 同切片。节点测试能走完只能 Claim 一次的票。真 Hub 冒烟仍未做。
2. ELR-3 与 ELR-4：安全面，应在 PRD-024 升为 implemented 之前落。
3. 拨号代际（D944）先按上节裁定是否改用链路对象，再实施；ELR-5、ELR-8、ELR-9 并入同一冲突域。
4. ELR-6、ELR-7 与 bug-hunt 01 方案 S3、bug-hunt 02 方案 S4 同冲突域，可以一起做。
5. 真引擎证据改在强制鉴权模式下取（非回环绑定，或 `--hub` 配本地 `connection-hub`），即 connection-hub-client 的 H4a 冒烟。
6. 2026-10-01 增补：ELR-10 先于 ELR-11 落（后者改本机拨号的目标与凭据，前者改它的提交方式，同一冲突域）。ELR-12 在 ELR-14 之前；ELR-13 与二者无依赖。

## 看过但未立条

- 分层：`node/` 不 import electron，由 electron-main 装配；renderer 只经 `common/` 契约，与 AHP 隔离，符合 ADR-003。
- 私钥与 Hub refresh 只在 main、经 safeStorage 加密；加密不可用时 fail-closed。
- 握手 transcript 用本地观测指纹，并与 AuthNonce 自报值交叉校验（SEC-3）。
- resolver 每次查实时目录，已吊销、离线、引擎未就绪都拒拨，不拿快照拨号；refresh 单飞。
- `UniverseAgentConnectionService` 约 2.4k 行，同时承担连接状态机、Host 连接、Hub 账号与约 200 个 RPC；`ProxyChannel.fromService` 把 `connect()`、`shutdown`、`pairApprove`、`rotateToken`、`confirmPairing` 等全部暴露给每个窗口。这是结构问题，不单独立条；拆分方向是链路管理（单写者）、RPC 门面、Hub 服务三块，renderer 只拿窄契约。2026-10-01 已升为 ELR-12（文件已长到 3284 行）。
- connection-hub-client R2 承诺的 main 事件循环延迟采样（`monitorEventLoopDelay`）未落地。所有窗口的流解码与会话折叠都在 main 线程，「不迁 UtilityProcess」目前没有数据支撑。未测量，不立条。
- 仍用 JSON 编码的调用还有 5 处（`node/grpc/grpcClient.ts` 里 4 个 unary、1 个流），归 D24。

## 验证

- 全部结论来自代码阅读。引擎与 Hub 的行为以上述仓外源码为准，没有对真引擎或真 Hub 复现。
- 没有运行测试。

## 未读完

- `node/sessionCore/` 的折叠与重连，以及逐个 RPC 的编解码（D24）。
- Hub 登录、改密与设备管理界面；Web 形态（`browser/`）。
- `SessionViewHost` 只读了连接变化的回调，没有读流重开的全部分支。
