---
title: "连接拨号 generation、非 TLS Connect bytes、snapshot/phase 原子"
type: plan
status: accepted
phase: M7
updated: 2026-09-19
summary: "2026-09-19 用户签收。!tls 禁 this.connect()；失配不写提交集；pairing 第一行闸。不发明字段。不升 PRD-008。"
---

# 连接拨号 generation、非 TLS Connect bytes、snapshot/phase 原子

> **slice_id**：`connection-dial-generation`  
> **冲突域**：`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`（**不**改同文件 `createSession` / recover 臂，那是 [live-stream-bytes-decode](live-stream-bytes-decode.md) S4） · `grpc/grpcClient.ts` `connect` · `grpcHandshakeWire.ts` · `common/universeAgentConnectionChannelClient.ts` · pairing 仅正式 pending Confirm。**不**改 `universeAgentRendererSync.ts` 缓存形状（S4 只给 channel client 加成功包 generation，是 `onDidChangeConnection` 局部 seq，不给 snapshot 加字段）。**不**进 `sessionViewHost.ts`（host `bindGeneration` 属 [live-stream-bytes-decode](live-stream-bytes-decode.md) S5）。  
> **基线：** HEAD `5c910c59a226`  
> **本稿是方案，不是实施。**  
> **不推翻：** [D408](../progress/deferred-gaps.md) 退避重连（只补「用户 Disconnect 取消 **飞行中** 拨号」）；[D81](../progress/deferred-gaps.md)/[D84](../progress/deferred-gaps.md) hydrate catch（只补成功重叠的 generation）；pairing-hold 禁写、断连清 live id（chrome 已落，本稿守主进程/缓存）。  
> **禁止发明：** Connect 新 field、新 pairing RPC、新 capability。  
> **不占：** D405、D24 无号方法、PRD-008 升档。

## Problem class

- **症状：** 点 Disconnect 后活 chrome / live id 自己回来；换 profile 失败后 id 已是 B、transport 仍是 A；Direct Address 无 TLS 时 Connect 走 JSON，能力矩阵变全 `UNSUPPORTED`；断连瞬间渲染端仍 `connected`；已有 trust 再配时 SAS 不能 Confirm。
- **类标签：** **无 generation 的 await** + **有 proto 仍 JSON** + **半应用缓存**。
- **复发机制：** 测只取消 timer（D408），不取消 in-flight；hydrate 测只锁 reject，不锁重叠成功。

## 0. 一句话结论

拨号盖 epoch：只有用户 Disconnect / `dispose` / `cancelPairing` / 用户发起的新 `connectProfile` 加代。await 后对不上就只拆**本拨号捕获的** transport。非 TLS Connect 走与 DeviceAuth **同一 ConnectRequest 字节**（省略 field 12）。渲染端 S4 只给**成功重叠**包 generation（reject 路径保持 D81：snapshot 可留下、phase 不半应用）。正式 `pairing_pending` 走现有 `startPairing` + `verifyPairingSas`，不发明 RPC。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `disconnect()` 置 `_userDisconnecting=true`，清 transport/token/`_activeProfileId`，**结束时立刻 false** | `universeAgentConnectionService.ts` `disconnect` |
| `_connectProfileRaw` 在 `resolve` **之前**写 `_activeProfileId = profileId`；await 后不重读 `_userDisconnecting` / generation | 同文件 L709 一带 |
| `_fireReconnect` 只在进 `connectProfile` **前**看 `_userDisconnecting`；D408 测取消的是 timer | 同文件 `_scheduleReconnect` / `_fireReconnect` |
| 非 TLS：`this.connect({ clientId, protocolVersion:'1' })` | `_connectProfileRaw` `!endpoint.tls` |
| `this.connect()` 不是「await 一次再一次性写」：`await _transport.connect`（约 L654）→ **立刻**写 `_sessionToken`（L655）→ 再 `await probeEngineCapabilities` / `_refreshSessionListCapability` / `_refreshSaveSkillContentBinding`（L661–666）→ 才写 `phase: connected` 并 fire（L668–675） | `universeAgentConnectionService.ts` `connect` |
| TLS `_connectProfileRaw` 同构：handshake await（约 L789）→ 写 token（L829）→ probe await（L834–839）→ connected + fire（L840–844）；handshake 前必须有 `profile.trust.engineIdentityId`（约 L772） | 同文件 |
| 非 TLS `.then` 仍用 `isPairingPending(sessionToken, pairingNonce)`（约 L765） | 同文件 `!endpoint.tls` |
| `GrpcUniverseAgentClient.connect` = `makeUnaryClient` + **`JSON.stringify`**（`client_id` / `protocol_version` / `work_dir`） | `grpcClient.ts` `connect`；`grpcClientCalls.ts` |
| TLS：`connectWithDeviceAuth` → `encodeDeviceAuthConnectRequest` field **1/2/9/10/12** | `grpcHandshakeWire.ts` |
| 引擎 `ConnectRequest`：`min_protocol=1` `max_protocol=2` `work_dir=8` `protocol_major=9` `protocol_minor=10` `device_auth=12`（optional） | 仓外 `common.proto` `ConnectRequest`（只读） |
| `decodeConnectResponse` 已按 proto 解 capabilities / sessionToken / sas | `grpcHandshakeWire.ts` |
| 渲染端 `onDidChangeConnection`：先 `applySnapshot` 再 `void refreshPhaseAndNotify()`；`connected` = `phase.kind==='connected' && !snapshot.pairingPending` | `universeAgentConnectionChannelClient.ts`；`UniverseAgentConnectionSyncCache` |
| D81：IPC **reject** 不 fire 半应用 phase；**不**给重叠成功编号 | `universeAgentRendererSync.test.ts` |
| 正式握手 `pairing_pending`：pane 展示 `sasFromHandshake`（**不** `verifyPairingSas`）；`confirmPairing` 只认 orchestrator `trust===null && state==='pairingPending'` | `_connectProfileRaw`；`PairingOrchestrator.isFirstPairingProfile` |
| Hub revoke 后 profile `state:'revoked'` **保留 trust**；resolver 不看 `revoked` | `universeAgentHubService` / `connectionResolver`（S4 若本波放得下；否则记不做） |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A epoch + 非 TLS 同 Connect bytes + 成功重叠 generation + 正式 pending 走现有配对** | 见 §3 | **选定** |
| B 取消退避重连 | 推翻 D408 | **拒绝** |
| C 非 TLS 继续 JSON | 「insecure 引擎吃 JSON」 | **拒绝。** 方法有 proto；D24 管的是**无号**方法 |
| D 发明无 device_auth 的新 RPC | — | **拒绝** |
| E 正式 pending 只提示 Forget | 用户卡死 | **拒绝。** Confirm 已是合同入口 |
| F 本波做完 Hub revoke 清 trust + resolver 拒 revoked | 扩大冲突域到 hub store | **拒绝本波。** 记相关、不占文件 |

## 3. 选定设计（A）

两本账，禁止混用：

| 账 | 何时写下 | 谁读 |
|:---|:---------|:-----|
| **已接通 id**（今日 `_activeProfileId` 在 transport 成功后的含义） | bytes/DeviceAuth **全部 await 结束且 epoch 通过之后**第一次写入 token/phase | `isEngineConnected`、backoff 目标、revoke 比较 |
| **配对上下文 id**（新字段 `_pairingContextProfileId`，禁止复用 `_activeProfileId`） | `startPairing` / 正式 `pairing_pending` 清资格的当下 | `confirmPairing`：必须先 `confirmSas` / `confirmRecoverTrust`，再 `connectProfile(_pairingContextProfileId)`（闸与拨号同一 id） |

1. **S1 `_connectEpoch`。** 只有 **用户 Disconnect / `dispose` / `cancelPairing` / 用户发起的新 `connectProfile`（`options.reconnect !== true`）** 自增一代，且在方法返回之后仍挡住 in-flight。

   **用户拨号在飞 ≠ reconnect 在飞。** 单独布尔：仅 `options.reconnect !== true` 的 `connectProfile` 置位；reconnect 自身不置位、不加代。**禁止**复用 HEAD L704 派生 `reconnect = options.reconnect === true || this._transportState === 'failed'`：D408 失败后 `_transportState==='failed'`，用户再点 Connect **没有** `{reconnect:true}`，必须置旗、加代。

   旗生命周期写死：该次用户 `connectProfile` 的 `try/finally` **清旗**。`_fireReconnect` 在调用 `connectProfile` **之前**看旗：用户拨号在飞 → reconnect **no-op**。无用户拨号在飞时 D408 必须仍能重拨。禁止用 `phase==='connecting'` 当「用户在飞」。

   **闸住的 reconnect `!ok` 禁止当 `transport_failed` 再走 D410。** HEAD：`_fireReconnect` await 之后非 halt `!ok` 就 `_rescheduleReconnectAfterAttempt()`（约 L2093–2097）；该函数不看 `_activeProfileId`；`_canScheduleReconnect` 不看 `_transportState === 'ok'`。竞态：D408 重拨已进 probe → 用户 Connect 加代置旗并成功提交、`finally` 清旗 → 旧 reconnect 因 epoch 返回 `!ok` → 返回后旗已是 false → D410 再挂 timer → `connectProfile({reconnect:true})` **拆掉刚接通的 transport**。Disconnect 能幸免是因为清了 `_activeProfileId`。须把 `_fireReconnect` 改成：**本轮 reconnect 捕获的 epoch 若已不是当前代，禁止 D410 再调度**（只认旗不够）。

   **L729 `this._transport?.close()` 必须过 epoch 闸，关的是入口钉死的指针。** HEAD `_connectProfileRaw` 在 `resolve`（L711）**之后**才 `this._transport?.close()`（L729），再新建 client（L733–741）。已进入 `_connectProfileRaw`、卡在 L711 的拨号（D408 已过 `_fireReconnect` L2073–2077，或先到的用户拨号）会在后到拨号 **epoch 提交并发布** 之后执行 L729，关掉刚接通的 socket。推迟赋值后，L729 若仍关「当前 `this._transport`」，同样误杀赢家。选定：进入本拨号时钉死 `entryTransport`；L729 只在 `this._transport === entryTransport` 时 close 它；epoch 已变或指针已被后到提交替换 → **禁止**碰 `this._transport`。禁止靠「下一轮 D410」才拆——误杀发生在 **仍停在 L711** 的这一轮，早于 probe。

   **L733–741 禁止给 `this._transport` 赋值，除非本拨号 epoch 仍是当前代。** 只闸 L729 不够：stale 过 L711 后仍执行 L733–741 会把赢家指针换成新 client。HEAD L733 在 identity / handshake / probe **之前**，禁止读成「epoch 未变就先赋」。`isEngineConnected`（L543–547）只看 token 真值、`!_pairingPending`、`_transport?.isChannelAlive`，**不看** phase / `_transportState` / token 是否仍是赢家那份。

   **失配后不得写 connected 提交集任一字段（含探针窗）。** HEAD L711 之后、L733 之前已能不经 `_markTransportFailed` 改 phase：L712–719（`!ok` → `phase:failed` + fire）、L722–727（无 identity store）。TLS 成功臂 L829–839 在 `phase: connected`（L840）**之前**已写 `_sessionToken` / `_workDir` / `_transportState='ok'` / `_capabilities`，并 `_refreshSessionListCapability` / `_refreshSaveSkillContentBinding`（L2303–2314 读 `this._transport`——推迟赋值后这是赢家指针）。自然误读：写完 L829–839 → 失配只跳过 L840 → `{ok:false}`。L711 窗三项锁不覆盖这条。选定：epoch 已变则 **禁止**写 token / workDir / capabilities / session-list / save-skill binding / `phase` / `_lastConnectedPath` / `_transportState` / `_activeProfileId` / `_pairingPending` / fire / `this._transport`；只 close 本拨号 captured。S1 必须**另**锁「D408 已进 probe、用户已提交」：赢家 `sessionToken` / `getConnectionPhase()` / `getTransportState()` / `_capabilities` / **`_sessionListCapability` / save-skill binding** 未变，stale `{ok:false}`。只跳过 `_capabilities = await probe`、仍跑 L838–839（L2307–2314 写 session-list / `_clearSaveSkillContentBinding`）会假绿。禁止用 L543 `isEngineConnected` 代替。

   **`_startProfilePairing` 进函数第一行就闸，不得先写再 await。** HEAD L2144–2148 在 L2150 **之前**已写 `phase: connecting` + `_activeProfileId`；L2167–2173 在 L2178 **之前**已 close / 置空 / 清 token / `_pairingPending=true` / `_transportState='idle'` / fire（`isEngineConnected` L543–546 只看 token、`!_pairingPending`、channel alive——L2170 单独就能把已接通打成未接通）。reconnect **不加代**，入口 epoch 可与赢家同代。选定：**进函数即**看「已发布 connected 指针」与 epoch；已是赢家则 `{ok:false}`，**不得**写 L2144–2191 任一字段（含 L2144–2148）。await 之后再重读，对不上同样不得写。S2/S5 测钉死：**赢家已 connected 提交之后**，同代 reconnect stale 才进入（禁止用加代用户拨号当对家，那条走「对不上」宽闸、同代 L2167/L2170 从未跑到）；基线取在 **L2144 之前**；赢家已在时第一行闸直接 `{ok:false}`、函数体未写账（到不了 L2150）。**禁止**只停 L2178（那时 L2167–2173 已执行完）。L808 改道与 L717–719 同锁。

   I/O（`connect` / handshake / 三组 probe）一律走 **captured** transport。`this._transport` **只在 epoch 提交时赋值**。HEAD `_ensureTransport()`（L1961–1965）：指针为空就新建 **loopback** `127.0.0.1:50051`，非空则复用 **旧 profile** socket——都不会打到本次 `dialAddress`。

   **`!tls` 禁止 `return this.connect()`。** HEAD L751–768 无条件走 `this.connect()`；`connect()` 在任何写入前 `await this._ensureTransport()`（L652）。实施若保留 L751 且遵守「提交前不赋值」，`connect()` 会新建 loopback，epoch 提交时发布**错 socket**；若为了让 `connect()` 工作而提前赋值，则 probe/handshake 打在 `this._transport` 上（R5 已否）。选定：在 `_connectProfileRaw` 对 **captured** 做 bytes connect + 三组 probe。公共 `connect()` 只留给 loopback 单测，**不得**出现在 profile 路径。即便 `connect()` 仍存在，也不得在提交前 `_ensureTransport` 写 `this._transport`。TLS probe 助手改为吃 captured 参数，禁止内部读 `this._transport`。identity 失败 / `handshake.kind === 'failed'` 也须 close captured。

   HEAD 在写 phase 之前还有 probe 段 await。选定 **(a)**：captured 上所有 await 结束之后，才**第一次**写 connected 提交集（见下）。早期写 `phase: connecting` 仍允许。

   **两套提交集，禁止混成一次「epoch 提交」。**
   - **connected 提交集**（`!tls` captured 成功 **且** 有 `sessionToken`；TLS handshake 成功臂 L829 一带）：`_sessionToken` / `_workDir` / `_capabilities` / `_sessionListCapability` / save-skill binding / `phase: connected` / `_lastConnectedPath` / `_fireSnapshotChanged` / 发布 `this._transport` / `_transportState='ok'` / **`_activeProfileId`**。**`connect()` 无 `sessionToken` 不得走此集**（忽略 `pairingNonce` 后 `isPairingPending(undefined, ignored) === false`，HEAD L671–675 仍会 connected + fire）。**禁止**在 `_refreshSessionListCapability` / `_refreshSaveSkillContentBinding` 内部 await 之后再写这些字段（HEAD L2307 / L2314 一进就 `_clearSaveSkillContentBinding`）。探针 I/O 必须打 captured 且 `!==` 赢家指针。
   - **pending 提交集**（仅 TLS / DeviceAuth）：`_pairingContextProfileId`、`pairingPending`、`phase: connecting`、fire。**不得**发布 `this._transport`、**不得**写 `_activeProfileId`。

   **pending fire 替换 HEAD L808–826，不是加法。** HEAD L808 已写 `_pairingPending`、`_transportState='ok'`、fire 并 return（此时 `this._transport` 已在 L734 赋成握手 client）。若 L808 仍提交再进 `_startProfilePairing`，会先发布握手 socket，再被 L2167 关掉并在 L2173 再 fire。选定：拆掉 L808–826 成功返回；pending 只在 `_startProfilePairing` L2173 / L2196 / L2207 三处提交（含 `_pairingContextProfileId`），且过 epoch。进 orchestrator 之前 close **captured** handshake。

   **`connect()` 无 `sessionToken` 不得提交 `connected` / 不得 fire。** 只在 `_connectProfileRaw` 收 `{ok:false}` 收不住这次 fire——所以 `!tls` 不再走 `this.connect()`。

   **闸住的 reconnect 失配不得进 `_markTransportFailed`（因此也不走 D410）。** HEAD `_markTransportFailed`（L2000–2010）在 `_scheduleReconnect()` **之前**就写 `_transportState='failed'`、有 `_activeProfileId` 则 `phase={kind:'connecting', reason:'transport_lost'}` 并 fire。只禁 D410 不够：stale catch 仍会把刚提交的连接标成 failed。HEAD `_fireReconnect` L2093–2097 `!ok` → `_rescheduleReconnectAfterAttempt()`；catch 臂 L2098–2102 同样再调度，只看 `_activeProfileId !== profileId`。`connect()` catch L682–684 与 `_connectProfileRaw` catch L852–855 无条件 `_markTransportFailed`。选定：本轮 reconnect **捕获的 epoch 若已不是当前代**，`!ok` / catch **禁止调用** `_markTransportFailed`，也禁止 `_rescheduleReconnectAfterAttempt`。该竞态测必须断言 `transportState` / `phase` **仍是已接通**（新 transport 仍在）。

   **`!tls` `.then` 禁止无条件 `{ok:true}`。** HEAD L751–768 在 `connect()` resolve 后仍写 `_lastConnectedPath`，若 `phase.kind==='connected'` 则覆盖 path，并返回 `ok:true`。闸住的 Direct Address 拨号会把后到用户连接标成错误 path，且让 `_fireReconnect` 走成功臂。拆掉 `this.connect()` 后这条成功臂一并拆；闸住的 Promise 必须 `{ok:false}`。

   对不上时只能 close **本拨号捕获的** transport；若 `this._transport` 仍是它则置空。禁止 `this._transport?.close()` 误杀后到拨号。闸住的飞行拨号 Promise 必须 **`!ok`**。`dispose` 也必须能挡住。**保留** D408 整组测（含 D410 失败再调度，但 epoch 失配禁止再调度）。epoch 闸在 connection service 的写入点；不必让 `grpcClient.connect` 懂代。
2. **S2 重叠：后到的用户拨号加新一代，取消先到**（不写「同一 epoch / single-flight」）。**reconnect 不加代**（见 S1）。失败恢复：若已 close 旧 transport，phase/token 收成断开，禁止 `id=A` + `transport=undefined` + `phase=connected`。覆盖预写点：今日 L709 **与** `_startProfilePairing` L2148 预写 `_activeProfileId`。配对中允许写下 **`_pairingContextProfileId`**，不得把未接通当成已接通 id（`_activeProfileId` 仍只在 S1 提交成功后写）。

   HEAD `confirmPairing` L869–874 读 `this._activeProfileId`。去掉预写后必须改成读 `_pairingContextProfileId`。闸与 post-confirm 拨号用 **同一 id**（都用 `_pairingContextProfileId`）。禁止闸用 context、拨号用另一份 `snapshot.profileId`。

   **Disconnect / `dispose` / `cancelPairing` / 用户新拨号加代时清 `_pairingContextProfileId`。** HEAD `confirmPairing` 把 id 捉进局部 `profileId`（L869），await `confirmSas`/`confirmRecoverTrust`（L879–881）后 `this.connectProfile(profileId)`（L907）不带 `{reconnect:true}`，会加新一代当用户拨号。`disconnect` L952–971 置 `_userDisconnecting` 后立刻清回 false，并清 `_activeProfileId`，但局部 `profileId` 仍在——用户 Disconnect 之后 Confirm 仍会重连。选定：await 之后**重读** `_pairingContextProfileId`，空则 `{ok:false}`，禁止再 `connectProfile`。
3. **S3 非 TLS Connect bytes。** field **1/2/9/10** = `CONNECT_WIRE_PROTOCOL`（值 2/2/2.0，**不是** JSON `'1'`）。**禁止**编 3/5/6/7/11（本仓无 `ClientInfo` encoder；`clientId` **不映射**）。有调用方传入的 `workDir` 才编 **8**；今日 `this.connect({clientId, protocolVersion:'1'})` **不传** workDir，本波 +8 测可为「缺席合法」。**不发 12**。`makeUnaryBytesClient` + `decodeConnectResponse`。测：有 1/2/9/10、无 3、无 5、无 6、无 7、无 11、无 12、无 JSON 键 `client_id`；`encodeDeviceAuthConnectRequest` 仍含 12。§1「min_protocol=1」是 **字段号**，不是 wire 值 1。
4. **S4 只补成功重叠 generation。** D81/D84 **保持 closed**：refresh **reject** 测断言一字不改（新 snapshot 可留下、phase 不半应用）。S4 只保证：后到的**成功**旧包不覆盖新包。**不**写「refresh 失败回滚 snapshot」（与 D81 冲突）。「断连瞬间假 live」本波 **不做**（不修订 D81、不加 last-focused 式 live 门）。
5. **S5 正式 pairing_pending（仅 TLS / DeviceAuth 枝）。** TLS 枝在清 trust **之前**必须先有 `profile.trust.engineIdentityId` 才能 `runDeviceAuthHandshake`（HEAD 约 L772–798）；禁止在读 identity 之前清。`handshake.kind === 'pairing_pending'` **之后**才 `trust=null` + `state:'pairingPending'`，再把 **store.put 之后的新 profile** 交给 **`_startProfilePairing`**。推迟 `this._transport` 发布后，S5 **不能**靠 `_startProfilePairing` 的 `this._transport?.close()`（HEAD L2167）关握手 socket——那根还在 captured。进 orchestrator 之前必须 close **captured** handshake transport。禁止只调裸 `startPairing`。禁止先发 `sasFromHandshake` 再异步 `startPairing`。`_startProfilePairing` 可写 `_pairingContextProfileId`，已接通 id 仍不得预写。

   `!tls`：**忽略** `pairingNonce`。HEAD L657–670：`pairingPending = isPairingPending(token, nonce)`；**非 pending 就 `phase: connected` 并 fire**。渲染端 `cache.connected` = `phase.kind==='connected' && !pairingPending`（**不看 token**）。选定：`!tls` 且无 `sessionToken` → **失败收口**（非 `connected`、非 pending、`connectProfile` 返回 `{ok:false}`）。**不能**做成 `connect()` throw：`connect()` catch（L682–684）会 `_markTransportFailed`；`!tls` 枝（L751–768）无 `.catch`。throw 会绕过 L765，让 `connectProfile` reject，`_fireReconnect` catch 走 D410 再调度，Pane 也看不到 `!ok`。必须在 `_connectProfileRaw` 收成 `{ok:false}`，且这条路径不进 `_markTransportFailed`。L765 与 L657 一起改。DeviceAuth 无 token 无 nonce 已是 `failed`，非 TLS 对齐。不准 `startPairing`。

   点名改锚、禁止为保绿测留 `isPairingPending`：`pairing-pending => isEngineConnected === false`（`universeAgentConnection.test.ts`）与 D408 `pairingPending does not schedule reconnect` 今日用 `this.connect()` + `pairingNonce` 锁 `pairingPending===true`。pending 不重连这条不变量改挂到 TLS/orchestrator pending。

   `confirmPairing` **必须先** `confirmSas`/`confirmRecoverTrust`，禁止改成只 `connectProfile`。未清 trust 时 `isFirstPairingProfile` 仍拒。退出条件含 `no pairing awaiting confirmation` 与 `sas_mismatch`，不只写 `no_active_pairing`。HEAD L906 在 `connectProfile` 之前先写 `_pairingPending=false`；选定 **先重读** `_pairingContextProfileId`，空则 `{ok:false}` **且不改** pending 位，再决定是否清 pending / 拨号。

## 4. 不变量

- 用户 Disconnect 之后不得被 D408 飞行中成功写回 live。
- 失败的换 profile 不得留下「id=B + transport=A」。
- `System.Connect` 只要本仓已有 encoder，禁止 JSON。
- 渲染端：**不**为断连瞬间假 live 修订 D81。S4 只保证成功包 generation。
- 正式再配必须经校验 SAS；不得跳过 pairing 用旧 pin。
- 不升 PRD-008；不关 D405。

## 5. 切片

| Slice | Goal | Files | Tests | Exit |
|:------|:-----|:------|:------|:-----|
| **S1** epoch | 全部 await 后才发布 connected 提交集；用户在飞旗；`!tls` 禁 `this.connect()`；L729 只关入口指针；失配不写提交集 | `universeAgentConnectionService.ts` | D408 重拨已进入 probe 窗口时 `disconnect`/`dispose` → 最终非 connected、无新 token；用户拨号飞行中 reconnect **no-op 且不加代**；无用户拨号时 D408 仍重拨；闸住的 Promise `!ok`；**用户已提交、stale 停在 L711 → 赢家指针 + token/phase/transportState/`_pairingPending` 未变、stale `{ok:false}`**；**用户已提交、stale 已进 probe → 同上且 `_capabilities` / `_sessionListCapability` / save-skill 未变，且 `_refresh*` 未再对赢家指针调用**（探针 transport 是 captured 且 `!==` 赢家）；**profile `!tls` 不调用 `connect()`、不经 `_ensureTransport`、bytes/probe 只打 captured**；D408/D410 **整组**保留 | 失配不写提交集任一字段（含 workDir / lastPath / session-list / save-skill / `_pairingPending`）、只关 captured；不进 `_markTransportFailed`；`!tls` 不走 `_ensureTransport` |
| **S2** 两本账 + 用户后到加代 | 失败不偷已接通 id；Confirm 读 `_pairingContextProfileId` | 同上（含 `_startProfilePairing` / `confirmPairing`） | 连 A 再连 B 失败 → 已接通 id 仍 A（**禁止**用「双方断开」当用户刚提交成功后的绿）；无 `id=A`+空 transport+connected；去掉预写后 Confirm 仍通；**pending 期间 `this._transport` 未发布、`_activeProfileId` 不是 pending profile**；**`confirmSas` 期间 Disconnect → 不得再 `connectProfile`**；**赢家已提交后，同代 reconnect stale 进 `_startProfilePairing`：基线在 L2144 前，停在未写账的入口，赢家指针/token/phase/transportState/`_pairingPending` 未变（禁加代对家、禁只停 L2178）** | reconnect 不加代 |
| **S3** Connect bytes | 非 TLS 走 proto；禁 field 3/5/6/7/11 | `grpcClient.ts` · `grpcHandshakeWire.ts` | 1/2/9/10、无 3/5/6/7/11、无 12、无 `client_id` JSON；DeviceAuth 仍有 12 | |
| **S4** 成功重叠 generation | 后到旧成功包不赢 | `universeAgentConnectionChannelClient.ts` | 新测：两包成功乱序；**D81 reject 测一字不改** | 不回滚 snapshot；不加 snapshot 字段 |
| **S5** 正式 pending | handshake 后再清 trust；走 `_startProfilePairing`；`!tls` 无 token 失败 | connection + orchestrator | 有 trust 的 formal pending → Confirm 不再因无 snapshot 失败；`verifyPairingSas` 失败 `sas_mismatch`；`!tls` 无 token → `!ok` 非 connected 非 pending；pairingNonce 测改挂 TLS pending；**L808–826 不再提交**；**L808 改道后的 stale 测与 S2 同配方**：赢家已提交 + 同代 reconnect stale、基线在 L2144 前、未写账即 `{ok:false}`、禁加代对家、禁只停 L2178 | 不发明 RPC |

本地门禁：`scripts/test.sh --run` 点名 pairing / connection / rendererSync。不跑托管 CI。

## 6. 不做

- Hub revoke 复用 / `cancelPairing` 清全部 SAS context（审查 #5）——另刀，避免与 S5 抢 orchestrator
- D405 DiagnosticsPort / fail-closed 定时器
- listTools 等无号 JSON（D24）
- 透镜绑定叶、Sources 已审

## 7. 相关

- [connection-hub-client](connection-hub-client.md) · [D408](../progress/deferred-gaps.md) · [D81](../progress/deferred-gaps.md)
- [live-stream-bytes-decode](live-stream-bytes-decode.md)（流解码，文件不交）
- chrome pairing-hold / 断连清 live id：HEAD `5c910c59a226` 已落 UI；本稿守主进程与缓存

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
| 2026-09-18 规则 16 | Reject → 改入后可再核 | Critical：epoch 闸在 `this.connect` 写入前；Confirm 保留 `confirmSas` + 两本账；S4 不与 D81 reject 三句并存。Important：后到加代；禁 field 3；S5 先清资格；D408 整组锚。Minor：Hub revoke 写清是 `profile.state`；field 8 本波可缺席。不采纳：本波做断连瞬间假 live（会修订 D81）。 |
| 2026-09-18 规则 16 第二轮 | Approve with changes | 父核 HEAD 后改入 Critical：S1 闸必须覆盖 probe 段第二段 await（选定全部 await 后再第一次写 token/phase；对不上只关本拨号 transport）。Important：reconnect 不得对用户飞行拨号加代；S5 清 trust 必须在 DeviceAuth handshake 的 `pairing_pending` **之后**；`!tls` 忽略 pairingNonce、不成可 Confirm pending；§0 与 S4/D81 对齐（不做成功才一起提交的原子缓存）。Minor：配对上下文字段名 `_pairingContextProfileId`；S3 测禁 5/6/7/11；epoch 不进 grpcClient。 |
| 2026-09-18 规则 16 第三轮 | Approve with changes | 父核 HEAD 后改入 Critical：用户拨号在飞旗与 reconnect 分家（`phase===connecting` 不能当谓词）；`!tls` 无 token 失败收口（不只关 pending 位）。Important：epoch 通过才发布 `this._transport`；失配不进 `_markTransportFailed`；Promise `!ok`；`confirmPairing` 改读 `_pairingContextProfileId`；正式 pending 走 `_startProfilePairing`；pairingNonce 测改挂 TLS pending。Minor：S4 是 channel client 局部 seq；不改同文件 createSession。 |
| 2026-09-18 规则 16 第四轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：在飞旗 try/finally 清、返回后 `_canScheduleReconnect`/`_rescheduleReconnectAfterAttempt` 也认旗；禁止复用 L704 派生 `reconnect`；S5 close **captured** handshake；`!tls` 无 token 在 `_connectProfileRaw` 收 `{ok:false}` 不 throw；pending fire 也过 epoch。Minor：Confirm 以 `_pairingContextProfileId` 为准；闸 `connect()` 与 TLS 两写入点。 |
| 2026-09-18 规则 16 第五轮 | Reject → 已改入 | 父核 HEAD 后改入 Critical：I/O 走 captured，禁止 `_ensureTransport()` 隐式 loopback；闸住 reconnect 的 `!ok` 若 epoch 已变 **禁止 D410 再调度**（finally 清旗后会拆新连接）。Important：pending fire 点名 `_startProfilePairing` L2173/L2196/L2207；`connect()` 无 token 不得提交 connected。Minor：Confirm 闸与拨号同一 id。 |
| 2026-09-18 规则 16 第六轮 | Reject → 已改入 | 父核 HEAD 后改入 Critical：`!tls` **禁止** `return this.connect()`（L751+L652 `_ensureTransport` loopback）。Important：S1 单列 D410 epoch 失配测；catch / `_markTransportFailed` 同闸；pending **替换** L808–826、不得发布 transport/已接通 id；Confirm await 后重读 context；拆 `!tls` `.then` 无条件 `{ok:true}`；connected 与 pending 提交集分家。Minor：dispose 清 live 字段；S4 不给 snapshot 加字段。 |
| 2026-09-18 规则 16 第七轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：失配统一成 **不进** `_markTransportFailed`（测锁 phase 仍已接通）；S1 测锁 `!tls` 不调 `connect()`/`_ensureTransport`；S2/S5 测锁 pending 未发布 transport、未预写已接通 id、L808 不再提交；Confirm–Disconnect 测锁不得再拨号。Minor：probe 助手吃 captured；identity 失败 close captured。 |
| 2026-09-18 规则 16 第八轮 | Reject → 已改入 | 父核 HEAD 后改入 Critical：L729 只关入口钉死的指针，epoch 已变不得碰 `this._transport`；S1/S2 锁赢家 socket 仍活 / `isEngineConnected`。Minor：Confirm 先重读再改 pending 位。 |
| 2026-09-18 规则 16 第九轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：L733–741 失配禁止赋 `this._transport`；S1 测锁 `this._transport ===` 赢家指针且 stale `{ok:false}`。Minor：失配关 captured 不是 entry；Confirm 测锁不先清 pending。 |
| 2026-09-18 规则 16 第十轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：失配不得写提交集任一字段；S1 测锁赢家 `sessionToken` / `getConnectionPhase()` / `getTransportState()`，禁止用 `isEngineConnected` 代替。Minor：L733「即将提交」口吻已删。 |
| 2026-09-18 规则 16 第十一轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：探针窗失配不得写 L829–839（token/capabilities/binding）；S1 另锁「已进 probe」三项+capabilities；L715→`_startProfilePairing` 过 epoch，L2167 不得关赢家；S2 禁止「双方断开」当刚提交后的绿。 |
| 2026-09-18 规则 16 第十二轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：`_startProfilePairing` **整函数**过闸（含 L2144–2172 / L808 改道 / L717–719），S2/S5 同级锁 `_pairingPending`；探针测锁 session-list / save-skill，不能只锁 `_capabilities`。 |
| 2026-09-18 规则 16 第十三轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：connected 提交集补 workDir/lastPath/session-list/save-skill；探针锁 `_refresh*` 不得打赢家；pairing 每处 await 后重读 epoch，已发布赢家即便同代也不得拆；S2/S5 测停在 L2150/L2178。 |
| 2026-09-18 规则 16 第十四轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：进 `_startProfilePairing` 第一行就闸，不得先写 L2144–2148；同代测必须「赢家已提交 + reconnect stale」，基线在 L2144 前，禁只停 L2178。 |
| 2026-09-18 规则 16 第十五轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：S5 测与 S2 同配方（赢家已提交 + 同代 reconnect stale）；§3 改口为第一行闸直接 `{ok:false}`。 |
| 2026-09-18 规则 16 第十六轮 | **Approve（无 Critical、无 Important）** | HEAD 与 R15 配方对齐。可以签收。 |
| 2026-09-19 用户签收 | **accepted** | 无 Critical/Important。转入实施。 |
