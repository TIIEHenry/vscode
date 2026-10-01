---
title: "本机引擎链路走拨号提交路径"
type: plan
status: draft
phase: M7
updated: 2026-10-01
summary: "ELR-10：本机自动连接捕获 epoch、在 captured 上跑完探针、经 _applyConnectedCommit 提交；链路订阅随尝试走，提交时才进服务槽；用户拨号取消发现；_liveConnectedPublished 与 isEngineConnected 同判据。不改 IPC，不改信任（ELR-11 另案）。"
---

# 本机引擎链路走拨号提交路径

> **slice_id**：`loopback-link-commit`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) ELR-10。
> **本稿是方案，未签收。**
> **基线**：HEAD `7cf1474419e`，行号以此为准。以 `node/`、`common/`、`test/` 开头的路径在 `src/vs/platform/universeAgent/` 下。
> **冲突域**：`node/universeAgentConnectionService.ts`（**只**改：`AuthenticatedLinkAttempt` 加 `events`、`_armAuthenticatedLink`、`_closeoutAuthenticatedLink` 的订阅释放、新增 `_adoptLinkEvents` 与 `_afterLoopbackProbe`、`_dialDeviceAuth` 提交后接管订阅、`_connectLocalSkipAuth` 全函数、删除 `_afterAuthenticatedAwait`、`_applyConnectedCommit` 加 `skipAuth`、`_dropPublishedTransport` 清旗、`_liveConnectedPublished` 判据、`_canDiscoverLocalEngine`、`connectProfile` 用户拨号臂取消发现定时器），以及 `test/node/localEngineDiscovery.test.ts`、`test/node/universeAgentConnection.test.ts`。
> **依赖**：无前置。[local-engine-trust-anchor](local-engine-trust-anchor.md)（ELR-11）改本机拨号的目标与凭据，须在本稿之后落，或与本稿同一切片。
> **不发明**协议字段、RPC 或失败码。不改 `UniverseAgentConnectionSnapshot`、`ConnectionPhase` 或 IPC。
> **不升** PRD-008。

## Problem class

- **症状：** IDE 启动后马上对某个 profile 点连接，偶尔连上之后断线不换链路；本机引擎在线时，拨号守卫把它当成「没有活链路」。
- **类标签：** **第二条拨号路径不走提交闸** + **全服务单槽订阅被别的尝试拆掉** + **两套「已连接」判据**。
- **复发机制：** [connection-dial-generation](connection-dial-generation.md) 的提交规则只写在 profile 路径上；本机发现（`f26be0d5ccc`）照着旧的「先写指针、再探针」写法加进来，测试只覆盖单独一条拨号。

## 0. 一句话结论

本机发现与 profile 拨号用同一套提交规则：捕获 `_connectEpoch`，在 captured transport 上握手和探针，任一 await 之后过期就只关自己，最后经 `_applyConnectedCommit` 原子提交。链路订阅挂在尝试对象上，只有提交那一刻才进服务槽 `_linkEvents`。跳过鉴权的本机链路在拨号守卫和 `isEngineConnected()` 眼里都是活链路。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 本机发现只在 `_canDiscoverLocalEngine()` 为真时跑：开了自动连接、未压制、未 dispose、相位为 `disconnected`。不看 `_activeProfileId` | `node/universeAgentConnectionService.ts` L2436-2441 |
| `_connectLocalSkipAuth` 不捕获 epoch。`connectWithoutDeviceAuth` 返回后的守卫是 `_reconnectDisposed`、`_suppressLocalEngineDiscovery`、相位不是 `connecting` | L2469-2483 |
| 同一函数在探针前写 `_transport`、`_sessionToken`、`_workDir`、`_pairingPending`、`_loopbackSkipAuth`、`_transportState`、`_lastConnectedPath`；探针后直接写相位 connected 并广播，不经 `_applyConnectedCommit` | L2491-2523 |
| 本机这条的过期判断用 `_afterAuthenticatedAwait`，依据是 `this._transport !== attempt.transport`，只因为指针已提前写入才成立；全仓只有这里调用 | L3270-3283；调用 L2504、L2509、L2514 |
| `_armAuthenticatedLink` 先 `_disposeLinkEvents()` 再把两路订阅写进服务唯一的 `_linkEvents` 槽 | L594、L3187-3204 |
| profile 路径：握手后在 captured 上 arm（L1150），每次探针后 `_afterCapturedProbe`（epoch + 指针），提交前再 `_lostCapturedDial`，`_applyConnectedCommit` 之后 `attempt.committed = true` 并检查 `condemned` | L1149-1186、L2888-2903 |
| `_closeoutAuthenticatedLink` 释放的是服务槽（`_disposeLinkEvents()`），不是这次尝试自己的订阅 | L3231-3258 |
| `_applyConnectedCommit` 不写 `_loopbackSkipAuth`；`_dropPublishedTransport` 也不清它。只有 `disconnect`（L1313）和本机链路的传输失败臂（L2390-2391）清 | L2770-2784、L2841-2876 |
| `_liveConnectedPublished()` 要求非空 `_sessionToken`；`isEngineConnected()` 对 `_loopbackSkipAuth && 相位 connected` 也放行 | L2733-2739；L696-704 |
| 用户 `connectProfile` 会 `_bumpConnectEpoch()` 与 `_beginUserDial()`，不取消本机发现定时器 | L872-881 |
| transport `close()` 释放自己的事件发射器（remote-link-auth-and-relay S2） | `node/grpc/grpcClient.ts` `close()` L1266 起 |
| 本机发现测试只在 `test/node/localEngineDiscovery.test.ts`（3 处 `autoConnectLocalEngine`），没有与用户拨号并发的用例 | `test/node/` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 本机拨号并入既有提交闸，订阅随尝试走** | 见 §3 | **选定** |
| B 只在用户拨号时压制本机发现 | 能挡住启动竞争，但先写指针、单槽订阅、两套判据都还在；下一条新拨号路径会再犯 | **拒绝** |
| C 一次拨号即一个不可变链路对象（审查原文「对已签收方案的补充」） | 方向对，但要改 profile、配对、重连全部写点，冲突域覆盖 D944 与 remote-link 已落代码 | **本稿不做**；A 不阻碍日后迁 C |
| D 本机链路订阅推迟到提交后 | remote-link 方案已拒绝推迟（探针窗口的失败会丢） | **拒绝** |

## 3. 选定设计（A）

1. **S1 链路订阅随尝试走。**
   - `AuthenticatedLinkAttempt` 加 `readonly events: IDisposable`。`_armAuthenticatedLink` 照旧装 token、照旧订阅两路事件，但把订阅放进 `attempt.events`，**不碰** `_linkEvents`。
   - 新增 `_adoptLinkEvents(attempt)`：`_disposeLinkEvents()` 后令 `this._linkEvents = attempt.events`。只在 `_applyConnectedCommit` 之后、`attempt.committed = true` 之前调用。
   - `_closeoutAuthenticatedLink` 把 `_disposeLinkEvents()` 换成：`attempt.events.dispose()`；若 `this._linkEvents === attempt.events` 则置空。未提交尝试的收口因此不再拆掉已提交链路的订阅。
   - `_dialDeviceAuth` 在 L1170 的 `_applyConnectedCommit` 之后调用 `_adoptLinkEvents(attempt)`。其余放弃臂不变：它们都 `close()` captured，订阅随发射器释放。

2. **S2 本机拨号走提交闸。**
   - `_canDiscoverLocalEngine()` 加 `&& !this._activeProfileId`。用户选过 profile 之后，直到 `disconnect` 清掉它之前，不再自动发现。
   - `connectProfile` 的用户拨号臂在 `_bumpConnectEpoch()` 之后调用 `_cancelLocalEngineDiscoveryTimer()`。
   - `_connectLocalSkipAuth(port)` 改写为：
     1. 入口 `_canDiscoverLocalEngine()` 不过即返回；捕获 `const epoch = this._connectEpoch`；`_publishConnectionPhase({ kind: 'connecting', reason: 'initial' })`。
     2. 建 captured transport，`connectWithoutDeviceAuth()`。之后若 `!this._localDialCurrent(epoch)`：关 captured，返回，不写任何服务字段。
     3. `pairing_pending` 臂不变（关闭、压制发现、相位 `disconnected` 并广播）。
     4. `const attempt = this._armAuthenticatedLink(captured, result.sessionToken ?? '')`。之后三次探针都打 captured；每次 await 之后调 `_afterLoopbackProbe(attempt, epoch)`，返回 `'stale'` 或 `'condemned'` 即结束。
     5. 提交前最后一次 `_localDialCurrent(epoch)`。通过则 `_applyConnectedCommit({ epoch, transport: captured, profileId: undefined, token: result.sessionToken ?? '', skipAuth: !result.sessionToken, workDir, methods, capabilities, sessionList, saveSkill, path: 'loopback' })`，接着 `_adoptLinkEvents(attempt)`，`_localEngineDiscoveryAttempt = 0`，`attempt.committed = true`；若此时 `attempt.condemned` 且 `_canCloseoutAuthenticatedLink(attempt)`，走既有 `_closeoutAuthenticatedLink`。
     6. `catch`：关 captured。只有 `_localDialCurrent(epoch)` 仍为真时，才把相位写回 `disconnected`、递增 `_localEngineDiscoveryAttempt` 并按退避重排发现。非 `UniverseAgentTransportError` 仍 `onUnexpectedError`。
   - `_localDialCurrent(epoch)` = `_epochCurrent(epoch) && !this._suppressLocalEngineDiscovery && !this._activeProfileId && this._connectionPhase.kind === 'connecting'`。用户拨号、`disconnect`、`dispose` 都会使 epoch 失配；相位条件保留，挡住其他写相位的路径。
   - `_afterLoopbackProbe(attempt, epoch)`：
     - `attempt.settled` 已置：返回 `'condemned'`（只可能在提交后发生，这里防御）。
     - `!_localDialCurrent(epoch)`：关 captured，返回 `'stale'`，不写服务字段。
     - `attempt.condemned` 已置：关 captured，相位写 `disconnected` 并广播，递增 `_localEngineDiscoveryAttempt`，按退避重排发现，返回 `'condemned'`。跳过鉴权的链路没有 token，没有宽限分支；`rejected` 与 `unavailable` 同样处理。
     - 否则返回 `undefined`。
   - 删除 `_afterAuthenticatedAwait`（S2 之后无调用方）。

3. **S3 一套「活链路」判据，跳过鉴权的旗随链路走。**
   - `_applyConnectedCommit` 输入加 `readonly skipAuth: boolean`，写 `this._loopbackSkipAuth = input.skipAuth`。profile 两处提交（L1065 的 `_dialPlain`、L1170 的 `_dialDeviceAuth`）与旧 `connect()`（L844）传 `false`。
   - `_dropPublishedTransport` 清 `_loopbackSkipAuth = false`。
   - `_liveConnectedPublished()` 的 `!!this._sessionToken` 改为 `(!!this._sessionToken || this._loopbackSkipAuth)`。其余条件不变。这样本机链路在线时，profile 拨号在 `_takeOverEntry`（L964）之前的守卫把它当活链路，与已连 profile 链路时的行为一致；`_abandonCaptured` 也不会关掉在线的本机链路。
   - `isEngineConnected()` 不改：它已经是「非配对、channel 活、token 或跳过鉴权且相位 connected」。S3 之后两者只差 `_transportState === 'ok'` 与相位，这是 `_liveConnectedPublished` 既有的额外约束。

## 4. 不变量

- `this._transport` 只在 `_applyConnectedCommit`、`_closeoutUnpublishedLink` 的既有临时借用、`_dropPublishedTransport` / `disconnect` / 收口置空这几处被写。本机发现不再直接写。
- 一次尝试的订阅只在它提交时进入 `_linkEvents`。未提交尝试的收口与放弃不释放服务槽。
- 本机拨号在任一 await 之后，epoch 失配、被压制、已有 active profile 或相位不再是 `connecting`，都只关自己的 captured，不写相位、指针或旗。
- `_loopbackSkipAuth` 为真当且仅当当前已提交链路是跳过鉴权的本机链路。
- 用户拨号开始后，本机发现定时器不再触发；在飞的本机尝试在下一次 await 后自行放弃。
- 不改 IPC、快照字段或相位枚举。

## 5. 切片

顺序：S1 → S2 → S3。S1 单独可落；S2 依赖 S1 的 `_adoptLinkEvents`；S3 依赖 S2 的提交入口。

| Slice | Goal | Files | Tests | Exit |
|:------|:-----|:------|:------|:-----|
| **S1** | 订阅随尝试走 | `universeAgentConnectionService.ts`（attempt、arm、adopt、closeout、`_dialDeviceAuth`） | §8 S1 | 未提交尝试的 arm 与收口不影响已提交链路的订阅 |
| **S2** | 本机拨号走提交闸 | 同上（`_connectLocalSkipAuth`、`_afterLoopbackProbe`、`_localDialCurrent`、`_canDiscoverLocalEngine`、`connectProfile`、删 `_afterAuthenticatedAwait`） | §8 S2 | 发现在飞时用户拨号，只剩用户链路且带完整订阅 |
| **S3** | 一套活链路判据 | 同上（`_applyConnectedCommit`、`_dropPublishedTransport`、`_liveConnectedPublished`） | §8 S3 | 从本机切到 profile 后旗为假；本机在线时 `_liveConnectedPublished()` 为真 |

## 6. 与已签收方案的接缝

- **connection-dial-generation（D944）。** 本稿把本机拨号纳入它的提交规则，不改 profile 路径的 epoch、`_lostCapturedDial`、`_canMutateDial` 语义。S3 改 `_liveConnectedPublished` 判据后，D944 在 `_takeOverEntry` 之前的「已有活链路即视为别人赢」守卫（L924、L934、L943、L956）对本机链路同样生效。这与已连 profile 时一致；`_takeOverEntry` 之后的守卫不受影响，因为在线链路此时已被摘掉。
- **remote-link-auth-and-relay。** S2/S4 的 `condemned`、宽限、`committed` 时序不变。S1 只改订阅归属：探针窗口的事件仍记在尝试上；提交后服务槽持有的就是这次尝试的订阅。
- **local-engine-trust-anchor（ELR-11）。** 那份方案替换 `_findLocalEnginePort` 与 `_openLocalEngineTransport` 的实现（目标与凭据），沿用本稿的提交路径。

## 7. 不做

- 链路对象重构（Options C）。
- 本机信任锚、UDS、端口来源（ELR-11）。
- 旧 `connect()` 删除与 IPC 白名单（ELR-14、ELR-12）。
- renderer 缓存的「已连接」判据（随 ELR-11 的 ADR 处理）。
- 重开托管 CI。

## 8. 验证

本地，点名文件跑 `scripts/test.sh --run`；门禁沿用 [health-gates](../progress/health-gates.md)。

| 切片 | 测试 | 断言 |
|:-----|:-----|:-----|
| S1 | `test/node/universeAgentConnection.test.ts` | 已提交 profile 链路 A 在线时，另一次未提交尝试 arm 后被收口（探针窗口 `condemned`），A 的 transport 随后发出 `onDidObserveUnavailable` 仍触发 A 的收口与重连。提交后服务槽的订阅就是这次尝试的订阅 |
| S2 | `test/node/localEngineDiscovery.test.ts`（注入假定时器、可控的 `connectWithoutDeviceAuth` 与探针） | 发现停在 `connectWithoutDeviceAuth` 时用户 `connectProfile` 成功：最终 `_transport` 是用户链路，本机 captured 已关闭，相位为用户路径，`_loopbackSkipAuth` 为假，用户链路的 transport 发 `UNAVAILABLE` 仍触发重连。发现停在探针时用户拨号：同样结果。用户拨号开始后发现定时器不再触发。发现在探针前不写 `_transport`（探针期间读快照：`channelAlive` 为假、相位 `connecting`）。探针窗口 `UNAVAILABLE`：不写 connected，相位回 `disconnected` 并排下一次发现。`disconnect` 期间在飞的发现结束后不写任何字段 |
| S3 | 同上两个文件 | 本机链路在线时 `_liveConnectedPublished()` 为真；之后用户拨 profile 成功，`_loopbackSkipAuth` 为假。profile 链路 token 被宽限收口后 `isEngineConnected()` 为假。既有 D944 与 remote-link 用例全绿 |

真引擎冒烟不是退出条件。

## 9. 知识层回填（实施 commit 时，不在本稿）

- [钉死引擎调试](../../docs/guides/debug-engine.md) §3：用户点 Connect 会取消本机自动发现，直到 Disconnect。
- [审查文](../progress/engine-link-architecture-review-2026-09-28.md) ELR-10 的「已知」指向本稿。

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
