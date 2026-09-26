---
title: "直连按解析后的地址拒私网，中继票交出即离开拨号缓存，握手失败不再一律画成 pin"
type: plan
status: accepted
phase: M7
updated: 2026-09-25
summary: "2026-09-25：链路本地并入同一私网拒绝集。探测不占用拨号票；身份不符与签名器失败不再画成 pin。"
---

# 直连按解析后的地址拒私网，中继票交出即离开拨号缓存，握手失败不再一律画成 pin

> **本稿是方案，不是实施。**
> **冲突域：** 连接 / 配对 / TLS / device grant / 身份。点名文件：`src/vs/platform/universeAgent/node/connectionResolver.ts`、`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`（**只**改私网判定之后的拒绝、中继票缓存交接、握手失败码映射）、`src/vs/platform/universeAgent/electron-main/universeAgentMainService.ts`（**只**注入 `resolveHost`）、`src/vs/platform/universeAgent/common/connectionHubTypes.ts`（失败码闭集补握手已有码）、`src/vs/workbench/contrib/conversation/browser/conversationSessionStatus.ts`（**只**补状态栏文案）、`src/vs/platform/universeAgent/node/grpc/grpcHandshakeWire.ts`、`src/vs/platform/universeAgent/node/grpc/grpcDevicePairUnaryWire.ts`。后两份本波不改。
> **禁止改** [connection-dial-generation](../connection-dial-generation.md) 已占的拨号 epoch、非 TLS Connect bytes、channel client generation。不改 `disconnect` 的代际、`_connectProfileRaw` 的提交集、`this.connect()` 的 JSON Connect、`UniverseAgentConnectionChannelClient` 的成功包 generation。
> **不发明**协议字段。`private_network_denied`、`pin_mismatch`、`transport_failed` 已在 `ConnectionFailureCode`。`identity_mismatch`、`fingerprint_malformed`、`signer_unavailable` 今日只在 `DeviceAuthHandshakeFailureCode`。  
> **2026-09-24 审查：** Critical / Important 已改入本稿。
> **2026-09-25 产品与架构裁定：** 未勾选 `allowPrivateNetwork` 时，IPv4 `169.254/16` 与 IPv6 `fe80::/10` 与 RFC1918 / ULA 走同一个分类器，失败码仍是 `private_network_denied`。直接改本方案拒绝集原文，不另叠小决策，不新增开关。`loopback` 目标形态仍不过这道闸。分类要去掉方括号和 `%zone`，IPv4 映射按内嵌地址判。

## 核查

对照 [扫描文](../../progress/bug-hunt-2026-09-24/01-connection-trust.md) 与 HEAD。

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-01-1 | 已知，见 connection-dial-generation | `disconnect` 约 1000–1020 行仍在结束时清 `_userDisconnecting`；`_connectProfileRaw` 约 748 行在 `resolve` 之前写 `_activeProfileId`；`confirmPairing` 约 918 行仍读 `_activeProfileId`。已由该方案 S1/S2 覆盖。 |
| BH-01-2 | 已知，见 connection-dial-generation | `pairing_pending` 约 854–872 行仍只画 SAS、不进 `_startProfilePairing`；`isFirstPairingProfile` 约 123–127 行仍要求 `trust === null`。已由该方案 S5 覆盖。 |
| BH-01-3 | 已知，见 connection-dial-generation | `!endpoint.tls` 约 791–797 行仍 `this.connect({ clientId, protocolVersion: '1' })`；`GrpcUniverseAgentClient.connect` 约 1163 行仍 JSON `client_id`。已由该方案 S3 覆盖。 |
| BH-01-4 | 成立 | 未勾选时 ULA、主机名落点与链路本地都要得到 `private_network_denied`。2026-09-25 把 `169.254/16` 与 `fe80::/10` 收进同一拒绝集。 |
| BH-01-5 | 成立 | `readCachedTicket` 约 609–618 行在过期前原样返回。`probeConnectionProfile` 约 977 行 `resolve` 不带 `forceNewTicket`。`_probeResolvedEndpoint` 约 2312–2337 行用该 endpoint 建 TLS 并 `getAuthNonce`，约 2351 行关掉探测传输，缓存不删。`_connectProfileRaw` 约 743–750 行只有 reconnect 才 `forceNewTicket`。拨号方案只保留这句重连强制新票，没有覆盖探测把票用掉。 |
| BH-01-6 | 成立 | `runDeviceAuthHandshake` 约 111–116 行 `identity_mismatch`、约 137–141 行 `signer_unavailable`、约 52–57 与 80–85 行 `fingerprint_malformed`。`_connectProfileRaw` 约 847 行除 `transport_failed` 外一律写成 `pin_mismatch`。`_isReconnectHaltCode` 约 2114–2118 行因此停重连。状态栏 `pin_mismatch` 文案是 “Pin mismatch”。叶子指纹不符走 `fingerprint_mismatch` 再画成 pin，这条保持。 |

## Problem class

- **症状：** 未勾选允许私网时，IPv6 唯一本地地址或尚未解析的主机名仍能直连；Hub 上先测试再连接，或同一进程里第二次普通连接，会拿已经建立过 TLS 的中继票；引擎身份与已存信任不一致，或握手签名失败时，状态栏仍是 Pin mismatch，自动重连停住。
- **类标签：** **拒绝集看字面主机** + **一次性票留在拨号缓存** + **握手失败码被折叠**。
- **复发机制：** 直连测试只锁 RFC1918 字面量；票测试只锁 TTL 过期与 `forceNewTicket: true`；D413 只锁指纹不符被画成 `pin_mismatch` 且不再调度。

## 0. 一句话结论

未勾选 `allowPrivateNetwork` 时，只在**将写入 `resolvedIp` 的地址**上拒绝 RFC1918、IPv6 唯一本地（`fc00::/7`）、链路本地（`169.254/16`、`fe80::/10`）与环回；`loopback` 目标形态不走这道闸。探测签发的中继票不进拨号缓存；拨号缓存里的票一旦交给会打开 TLS 的传输就删掉。`fingerprint_mismatch` 仍映射为 `pin_mismatch` 并停止重连；`identity_mismatch`、`fingerprint_malformed`、`signer_unavailable` 保持原码和各自文案，不进入停止重连集合。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 已签收拒绝集是 directAddress / hubDevice **解析出的** RFC1918 / ULA / 链路本地 / loopback；`loopback` 形态不受约束 | [connection-hub-client](../connection-hub-client.md) §3.3（2026-09-25 已含链路本地） |
| 字面量判定在解析之前；非四段 IPv4 且不是 `localhost` / `::1` 则放行 | `connectionResolver.ts` `isPrivateOrLoopbackHost`；`resolveDirectAddress` |
| 生产不注入 `resolveHost`；拨号地址是 `` `${resolvedIp}:${port}` `` | `universeAgentMainService.ts` `createConnectionResolver`；`_connectProfileRaw` / `_probeResolvedEndpoint` |
| 失败码已是 `private_network_denied`；理由字符串写 “resolves to” | `resolveDirectAddress`；状态栏 “Private network denied” |
| relay ticket 默认 5 分钟、一次性原子 claim；SNI 为一次性 authority | [connection-hub-client](../connection-hub-client.md) 数据面；[hub-control-plane-surface](../../../docs/reference/universe-agent/hub-control-plane-surface.md) |
| 缓存键 `hubBaseUrl::hubDeviceId`；未过期就复用；签发成功就 `ticketCache.set` | `resolveHubDevice` / `resolveHubDeviceWithToken`；`readCachedTicket` |
| 探测 `resolve(profileId)` 不强制新票，然后 `getAuthNonce` | `probeConnectionProfile`；`_probeResolvedEndpoint` |
| 正式拨号只在 `options.reconnect === true \|\| _transportState === 'failed'` 时 `forceNewTicket` | `_connectProfileRaw` |
| 配对解析使用 `forceNewTicket: true`，仍写入同一缓存 | `_startProfilePairing` |
| 握手失败码含 `fingerprint_mismatch` / `fingerprint_malformed` / `identity_mismatch` / `signer_unavailable` / `transport_failed` | `deviceAuthHandshake.ts` `DeviceAuthHandshakeFailureCode` |
| 连接相位把后四者里除 `transport_failed` 外收成 `pin_mismatch` | `_connectProfileRaw` 失败臂 |
| `pin_mismatch` 在停止重连集合里；状态栏不读 `reason` | `_isReconnectHaltCode`；`conversationSessionStatus.ts` |
| 进入握手之前 `createSigner()` 为空已是 `trust_missing`，不是 `pin_mismatch` | `_connectProfileRaw` 约 825–830 行 |
| 渲染失败码闭集没有那三个握手码；`default` 落成 “Connection failed” | `connectionHubTypes.ts` `ConnectionFailureCode` |
| 拨号 epoch、非 TLS Connect bytes、成功重叠 generation 已签收未实施 | [connection-dial-generation](../connection-dial-generation.md) S1 / S3 / S4 |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 解析后按已签收集合拒绝；探测票不进拨号缓存、交出即删；三个握手码不再折叠成 pin** | 见 §3 | **选定** |
| B 把链路本地（IPv4 `169.254/16`、IPv6 `fe80::/10`）加进拒绝集 | 与 RFC1918 同一分类器、同一失败码 | **2026-09-25 选定。** 推翻当日「合同未写故拒绝」。不新增开关 |
| C 只加长字面量列表，仍不注入 `resolveHost` | 主机名的落点仍在 gRPC 拨号时才出现，与「解析出的」不一致 | **拒绝** |
| D 探测改传 `forceNewTicket: true` 但仍 `ticketCache.set` | 会把刚用过的票写成拨号缓存，下一次连接命中它 | **拒绝** |
| E 为这三种失败发明新的 Connect / AuthNonce 字段 | 码已经在握手结果里 | **拒绝** |
| F 把 `identity_mismatch` 收成 `trust_missing`、签名失败收成 `transport_failed` | 文案变成 “Trust not established” / “Connection failed”，签名失败还会进 D408 重试，身份不符的停重连原因仍说不清 | **拒绝** |
| G 在本稿重做拨号 epoch 或非 TLS Connect bytes | 已签收方案占住 | **拒绝** |

## 3. 选定设计（A）

1. **S1 私网判定看将要拨号的地址。** 覆盖 BH-01-4，含链路本地。不变量在 `resolveDirectAddress` 与 hub 中继 authority 写入 `resolvedIp` 之前：`allowPrivateNetwork === true` 时不拒绝；`target.kind === 'loopback'` 不进入这道闸。否则对**这一次要放进 `resolvedIp` 的地址**分类，命中则 `private_network_denied`，且不返回带该地址的 endpoint。
   分类与今日 IPv4 四段相同，并加上：IPv6 环回（已有 `::1`）、IPv6 唯一本地 `fc00::/7`、IPv4 映射的 IPv6（按内嵌的 IPv4 用同一套 10/8、172.16/12、192.168/16、169.254/16、127/8）。不新增失败码。链路本地（`169.254/16`、`fe80::/10`，含去 `%zone` 与 IPv4 映射）进同一集合（2026-09-25）。
   **解析合同改签名，不沿用今日单字符串。** `ConnectionResolverDeps.resolveHost` 从 `(host: string) => Promise<string>` 改为 `(host: string) => Promise<readonly string[]>`。缺省实现（今日约 147 行原样返回主机）改为返回 `[host]`。生产 `createConnectionResolver` 注入的查找返回该名字的全部 A/AAAA，禁止在注入函数里先挑一个公网地址。列表里**只要有一个**地址落在拒绝集，整次拒绝，`resolvedIp` 不写。列表为空，或该函数 reject：在 `resolveDirectAddress`、`resolveLoopback`（约 215 行）、`resolveHubDevice`（约 452 行）和 `resolveHubDeviceWithToken`（约 562 行；`!this.http` 时由约 329 行进入）里 catch，返回 `{ ok: false, code: 'transport_failed', reason, allowRelayFallback: false }`。禁止让异常逃到 `connectProfile`（约 716–727 行）：那里只按 `transport_failed` 考虑重连然后重新抛出，相位停在约 744 行的 `connecting`，没有这条失败返回。
   全部地址都放行时，`resolvedIp` 取列表第一项（注入函数不得先挑公网地址，所以第一项不是「挑出来的公网」）。拨号字符串今日是 `` `${resolvedIp}:${port}` ``（约 772、2311 行）。选出的地址含冒号时必须写成 `[ip]:port`，禁止把端口吃进地址。
   **解析前**用同一套分类，函数仍是 `isPrivateOrLoopbackHost`（先去掉一对首尾方括号，使 `[fd00::1]` 与 `fd00::1` 同一类）。字面私网在 `resolveDirectAddress` 约 244 行、调用 `resolveHost` 之前拒绝。`fd00::1` 不得先进入 `resolveHost`。
   hub 中继只对 `resolveHost(authority)` 的结果做同一分类；目录里的设备地址字段不单独再判。分类若发生在 `ticketCache.set` 之后且结果是拒绝，同一臂删除该缓存键。

2. **S2 拨号缓存不保留已 claim 的票。** 覆盖 BH-01-5。HEAD 不把 `relayTicketId` 交给传输；拨号用的是 `` `${resolvedIp}:${port}` `` 和 `servername`。一次性 claim 发生在打开 TLS 并 `getAuthNonce` 时。
   `ConnectionResolveOptions` 增加 `useRelayTicketCache?: boolean`，缺省 `true`。为假时 `resolveHubDevice`（约 397–398 行）和 `resolveHubDeviceWithToken`（约 534–535 行）既不 `readCachedTicket`，也不 `ticketCache.set`，只签发一张不进缓存的票。
   `probeConnectionProfile` 的两次 `resolve`（约 977 行，以及约 984 行 `forPairing: true`）都传 `useRelayTicketCache: false`。探测因此不会读出并在 `_probeResolvedEndpoint` 里烧掉拨号缓存里的票。禁止改成「探测成功才删」。
   正式 `resolve` 仍可在 claim 前命中未使用的缓存。`forceNewTicket` 语义保持。新增 `ConnectionResolver.consumeRelayTicket(profileId)`，按现有键 `hubBaseUrl::hubDeviceId` 删除。调用点在 claim 之前、且在本冲突域内：`_connectProfileRaw` 在即将打开 TLS / `getAuthNonce` 之前；`_startProfilePairing` 在 `resolve` 返回 endpoint 之后、把 endpoint 交给 `PairingOrchestrator` 之前。不改 `pairingOrchestrator.ts` 的 `createPinnedTransport`。不改 epoch，不改 `this.connect()`，不改 channel client。

3. **S3 握手失败码按种类留下。** 覆盖 BH-01-6。三个码的赋值落在 [connection-dial-generation](../connection-dial-generation.md) 的 epoch 通过之后，仍写在 `_connectProfileRaw` 的 `handshake.kind === 'failed'` 臂（今日约 846–851 行）。本稿只改这一臂的码映射，不改该函数的提交集与关闭。`transport_failed` 仍是 `transport_failed`；`fingerprint_mismatch` 仍写成 `pin_mismatch`，并仍在 `_isReconnectHaltCode`（约 2114–2118 行）里。`identity_mismatch`、`fingerprint_malformed`、`signer_unavailable` 原样写入 `ConnectionPhase` 与 `{ok:false}` 的 `code`，**不**加入 `_isReconnectHaltCode`。不另写一条停重连。这三码同时补进 [connection-hub-client](../connection-hub-client.md) §3.3 的失败码闭集，避免 renderer 合同仍停在 `transport_failed`。
   首次连接失败不会因此新开定时器：`_maybeScheduleReconnectAfterTransportFailedReturn`（约 2122–2124 行）只在码为 `transport_failed` 时调度。已经在 `_fireReconnect` 里的非 halt `!ok` 仍走既有 D410。这三个码不是 D408 的 halt。
   `ConnectionFailureCode` 补上这三个已有握手码。状态栏 `localize` 源串用英文，与今日 “Pin mismatch” 相同风格：`identity_mismatch` → `"Engine identity mismatch"`；`fingerprint_malformed` → `"Engine fingerprint invalid"`；`signer_unavailable` → `"Engine signer unavailable"`。renderer 仍只按码画，不解析 `reason`。进入 `runDeviceAuthHandshake` 之前 `createSigner()` 为空仍是 `trust_missing`，本切片不改。

## 4. 不做

- BH-01-1 / BH-01-2 / BH-01-3 的实施切片（见 [connection-dial-generation](../connection-dial-generation.md)）
- 拨号 epoch、非 TLS Connect bytes、channel client generation
- 另写一套链路本地判定或 `allowLinkLocal`。2026-09-25 已把链路本地收进 S1 的同一拒绝集。
- Hub revoke 清 trust、resolver 看 `profile.state`
- `grpcHandshakeWire.ts` / `grpcDevicePairUnaryWire.ts` 的字段与编码
- 重开 GitHub Actions

## 5. 验证

本地、点名现有文件。不跑托管 CI。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| S1 | `src/vs/platform/universeAgent/test/node/connectionResolver.test.ts`（`direct address rejects RFC1918 host by default`、`direct address allows private host when allowPrivateNetwork is true`） | `fd00::1` 与 `[fd00::1]` 在调用 `resolveHost` 之前就是 `private_network_denied`。注入的 `resolveHost` 若返回 `['1.1.1.1','10.0.0.1']`，整次拒绝，endpoint 不带其中任一地址。`resolveHost` reject 时 `resolve` 返回 `{ ok: false, code: 'transport_failed' }`，不抛到 `connectProfile`。`allowPrivateNetwork: true` 时 `fd00::1` 仍成功。`loopback` 目标不因 `127.0.0.1` 被这道闸拒绝。`169.254.1.1` 与 `fe80::1` 未勾选时为 `private_network_denied`，勾选后放行。既有 RFC1918 字面量用例保持拒绝 |
| S2 | 同文件 `reconnect forces a new relay ticket`、`expired ticket TTL is not reused`；`src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts` 套件 `probeConnectionProfile (GC-3)` | 探测使用的 `ticketId` 不在随后一次不带 `forceNewTicket` 的 `resolve` 里。正式 resolve 返回票并标记已交出后，下一次 resolve 是新 `ticketId`。`forceNewTicket: true` 仍与上一次不同。过期仍不复用 |
| S3 | `universeAgentConnection.test.ts` 的 `user reconnect handshake pin_mismatch does not reschedule (D413)`；`src/vs/workbench/contrib/conversation/test/browser/conversationSessionStatusBar.test.ts` | 叶子指纹不符仍是 `pin_mismatch`，且不再调度（D413 断言不改语义）。`engineIdentityId` 与信任记录不同 → `identity_mismatch`，状态栏源串是 `"Engine identity mismatch"`，且不进 `_isReconnectHaltCode`，也不新开 D408 定时器。`createSigner` 在握手签名处抛错 → `signer_unavailable`，源串 `"Engine signer unavailable"`。畸形指纹 → `fingerprint_malformed`，源串 `"Engine fingerprint invalid"`。握手前 `createSigner()` 返回空仍是 `trust_missing` |

门禁命令沿用 [health-gates](../../progress/health-gates.md)：`scripts/test.sh` 点名上表文件。
