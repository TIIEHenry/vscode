---
title: "十六路审查 r04：universeAgent 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 4，weaken 0。"
---

# 十六路审查 r04：universeAgent 方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。


核对范围是发现稿里的 4 条。引用都在 `src/vs/platform/universeAgent` 内。行为仍在，行号与发现稿一致或只差在同一函数内。

| 编号 | 判定 | 严重度 |
| --- | --- | --- |
| r04-1 | hold | 高 |
| r04-2 | hold | 中 |
| r04-3 | hold | 中 |
| r04-4 | hold | 低 |

## r04-1

**问题类：** 正式握手得到 `pairing_pending` 时，带证书锚的配置在 `startPairing` 进入可确认状态之前就把 `trust: null` 写入配置存储；失败或拨号作废不写回旧锚。

**不变量：** 传给 `PairingOrchestrator.startPairing` 的内存配置仍须 `trust === null` 且 `state === 'pairingPending'`，否则 `isFirstPairingProfile` 会拒绝。存储里的旧 `EngineTrustRecord` 一直留到这次 `startPairing` 返回可确认快照（`awaiting_sas_confirm` 或 `recover_trust`），并且该拨号的 epoch 仍可改状态。此前任何失败、`dial superseded`，或返回时 epoch 已失效，存储中的 `trust` 与改写前相同。可确认之后再持久化 `trust: null`。用户取消已进入的 SAS / recover 仪式时，按今天的成功路径保持 `trust: null`，不把旧锚写回去。

**要动的符号或文件：**

- `UniverseAgentConnectionService._dialDeviceAuth`：`handshake.kind === 'pairing_pending'` 分支。今天在 `src/vs/platform/universeAgent/node/universeAgentConnectionService.ts` 约 1148–1161 行，`put(cleared)` 发生在 `return this._startProfilePairing(...)` 之前。
- 同文件 `_startProfilePairing`：约 3216、3219、3231、3234–3238、3262–3270、3272–3280 行的失败与 `_staleDial` 返回都不恢复 trust。把持久化挪到 `startPairing` 已经返回 `ok` 且 `_canMutateDial(epoch)` 仍为真之后。失败路径不再 `put`。推迟写入和失败时再写回旧档是两条做法，本条只用推迟，不在失败路径上再 `put` 原来的 profile。

**明确不改什么：**

- `isFirstPairingProfile` / `isPairingOrchestratorProfile` 的资格条件。
- `runDeviceAuthHandshake` 把「有 `pairingNonce`、无 `sessionToken`」判成 `pairing_pending` 的规则。
- `connectionResolver.ts` 里 `!profile.trust && !forPairing` 返回 `pairing_required` 的规则。
- `_prepareGrantRevokedRepair` 在 `grant_revoked` 时清空 trust 的路径。
- `engineTrustStore`。拨号用的是 profile 上的 `trust`，这次 `put(null)` 本来也不写 engine trust store。
- 成功进入可确认状态后，现有测试 `formal pairing_pending clears trust and confirmSas is reachable` 对 `startPairing` 入参 `trust === null`、`state === 'pairingPending'` 的要求。

**怎样本地验证：**

- 保留并通过 `formal pairing_pending clears trust and confirmSas is reachable`（`src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts`）。
- 新增断言：正式握手返回 `pairing_pending`，`startPairing` 抛错或 `ok: false` 后，`connectionProfileStore.get` 的 `trust.engineIdentityId` 与 `trust.leafSha256Hex` 仍是清空前的记录。
- 新增断言：`startPairing` 尚未返回时另一次用户 `connectProfile` 抬高 epoch，旧拨号以 `dial superseded` 结束，存储中的旧 trust 仍在。
- 新增断言：`startPairing` 返回 `awaiting_sas_confirm` 或 `recover_trust` 且 epoch 仍有效时，存储中的 profile 才变成 `trust: null`、`state: 'pairingPending'`。

命令：`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts`。这个入口的 Mocha 选项没有把 `--grep` 传进去，`scripts/test.sh --grep` 也加载不了这份 Node 测试。`scripts/run-unit-custom.sh` 用同一条 `node` 命令跑完列出的 universeAgent 文件。

## r04-2

**问题类：** 配对拨号在等待 `startPairing` 时被更新的 epoch 作废，`_pairingPending` 仍为 true，配对上下文已经被清掉。

**不变量：** `_pairingPending === true` 只表示「当前 epoch 上仍有一次配对在等 `startPairing` 或等用户确认」。标志要记下设置它时的 `_connectEpoch`。epoch 被 `_bumpConnectEpoch` 抬高后，旧 epoch 的标志立刻清掉。旧拨号稍后走到 `_staleDial` 时，只有标志上的 epoch 仍等于这次拨号的 epoch 才可以清；更新一次拨号已经为自己写入的标志必须留下。`_connectionPhase.kind === 'failed'` 时快照的 `pairingPending` 为 false，除非失败的就是当前这次仍拥有标志的配对。`confirmPairing` 在 `_pairingContextProfileId` 为空时继续拒绝。标志为 false 之后，`_canScheduleReconnect` 不再因为这个标志拒绝排队。

**要动的符号或文件：**

- `UniverseAgentConnectionService._startProfilePairing`：约 3246–3248 行把 `_pairingPending = true` 的同时记下 epoch。约 3262–3264 行与 3272–3273 行两处 `return this._staleDial()` 按上面的所有权清标志。约 3267、3277 行已经会把标志置 false，清标志时一并丢掉 epoch 记录。
- `_bumpConnectEpoch`（约 2967–2969 行）：递增 epoch 并清 `_pairingContextProfileId` 之后，若标志所属 epoch 不是新 epoch，清掉标志。`disconnect` 与 `dispose` 已经会清标志，再清一次可以。
- 另一处 `_pairingPending = true` 在 `confirmPairing` 的 `grant_pending` 分支（约 1287 行），同样记下当时的 `_connectEpoch`。
- 所有把 `_pairingPending` 置 false 的地方（约 1037、1311、1361、2469、3130、3267、3277 行）同时丢掉 epoch 记录，避免旧 epoch 号以后被误认为仍拥有标志。
- 快照字段就是这个标志：`_buildSnapshot` 约 2872 行 `pairingPending: this._pairingPending`。不要另做一套快照布尔。

**明确不改什么：**

- `_writeDialFailure` 不无条件清 `_pairingPending`。新拨号自己的失败路径会在旧拨号返回之前就把相位写成 `failed`；标志由 epoch 所有权清理，避免误清新拨号已经置上的标志。
- `confirmPairing` 在没有 `_pairingContextProfileId` 时返回 `no pairing awaiting confirmation`。
- `_canScheduleReconnect`、`_rescheduleReconnectAfterAttempt`、`_fireReconnect` 对 `_pairingPending` 的拒绝条件。修的是标志残留，不是放宽这些条件。
- `_liveConnectedPublished` 里 `!this._pairingPending` 的判断。
- 测试 `pairingPending does not schedule reconnect` 与 `connectProfile fires pairingPending snapshot before startPairing resolves`：仍由当前 epoch 持有的标志阻止重连，并在 `startPairing` 返回前让快照看到 `pairingPending: true`。

**怎样本地验证：**

- 保留并通过上述两个现有测试（同一 `universeAgentConnection.test.ts`）。
- 新增断言：`startPairing` 挂起时第二次用户 `connectProfile` 在提交前失败；两次都结束后 `getConnectionSnapshot().pairingPending === false`，`getConnectionPhase().kind === 'failed'`，`confirmPairing` 的 reason 为 `no pairing awaiting confirmation`。随后在具备 `_activeProfileId`、已安装 `this._transport`、没有用户拨号、没有重连定时器的前提下，传输失败能够再次 `_scheduleReconnect`。没有 transport 时 `_withTransport` 直接抛 `UNAVAILABLE`，进不了 `_markTransportFailed`。
- 新增断言：旧拨号仍停在 `startPairing`，新拨号已经把自己的 `_pairingPending` 置上并进入自己的 `startPairing` 后，旧拨号的 `_staleDial` 返回不得把新标志清掉。

命令：`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts`。

## r04-3

**问题类：** 同一 Hub 上，`logout` 在 `logoutHub` 尚未返回时与 `login` 重叠，登出收尾无条件 `clear`，把刚写入的会话和 refresh secret 删掉。

**不变量：** `logout` 在 `await logoutHub` 之前记下该 Hub 的 session generation。`await` 之后只有 generation 仍是那一代才 `clear`。检查和删除放在同一次同步存储操作里。同 Hub 的 `login`、`refresh` 或 `changePassword` 已 `applyAuthSession` 则保留新桶和新 refresh secret。别的 Hub 的登录不改这个 Hub 的 session generation，所以不挡住对登出开始时那个 URL 的 `clear`。没有任何 `applyAuthSession` 插入、且 `_activeHubBaseUrl` 仍是这个 Hub 时，登出仍清掉当时的会话，并把目录状态收成 `idle`。跨 Hub 时，若 `_activeHubBaseUrl` 已经换成另一个 Hub，登出收尾不得再 `++_directoryGeneration`，也不得把 `_directoryStatus` 写成 `idle`。`refreshDirectory` 用目录代际和当前 Hub 丢掉过期结果。按 session generation 未变就收成 idle，会把另一个 Hub 正在进行的目录刷新作废。进入 `logout` 时约 200 行那次目录代际递增发生在 `await` 之前；无 token 时仍会 `clear`。这两处要和上面的条件放在一起看，不能只改 `await` 之后的 clear。

**要动的符号或文件：**

- `UniverseAgentHubService.logout`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 约 199–213 行）。在 `await logoutHub` 前读取该 Hub 的 session generation。之后只有 generation 未变才 `clear`。同 Hub 的 generation 已变时，不要再写 `idle`，也不要在 `await` 之后再递增目录代际。跨 Hub 且 `_activeHubBaseUrl` 已不是正在登出的 URL 时，仍 `clear` 那个 URL 的会话，但不要递增目录代际，也不要把目录收成 `idle`。只有当前活动 Hub 仍是正在登出的那个、且 session generation 未变时，才保持今天的目录 `idle` 和末尾递增。进入时约 200 行那次递增若会作废另一个 Hub 已经开始的 `refreshDirectory`，就不要无条件做。
- `IHubSessionStore`、`HubSessionStore`、`InMemoryHubSessionStore`（`hubSessionStore.ts`）。`getSessionGeneration` 目前是两个类的私有方法。增加按 Hub 读取 generation 的方法，以及 `clear` 的代际条件形式：generation 不符则不动桶、不动 secret、不 `bumpSessionGeneration`。两套实现一起改。服务默认用的是 `InMemoryHubSessionStore`，持久化实现是 `HubSessionStore`。
- `login` 约 190–193 行的 `applyAuthSession` 已经会 `bumpSessionGeneration`，当作代际来源，不要在 `login` 里再加互斥锁。

**明确不改什么：**

- `login` 成功后的 `applyAuthSession`、`_activeHubBaseUrl` 赋值和 `refreshDirectory`。
- `refreshDirectory` 用 `_directoryGeneration` 丢弃过期目录结果的逻辑。会话代际是 `sessionGenerationByHubKey`，不是 `_directoryGeneration`。
- `applyAuthSession` 在加密前后对照 generation、避免写回被取代的 refresh secret 的逻辑。
- `browser/universeAgentHubService.ts` 的空 `logout`。
- 无重叠登录时的登出结果：该 Hub 的 access bucket 与 refresh secret 都没有，`getAuthStatus().kind === 'signedOut'`。
- `logout` 今天不把 `_activeHubBaseUrl` 置空；这次也不改这个字段的赋值。

**怎样本地验证：**

- 现有 Hub 套件没有覆盖「logout 未返回时再 login」。在 `src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts` 新增：
  - `logout` 已取到 access token 并停在 `logoutHub` 的 `fetch` 上时，同 Hub `login` 成功并写入新的 refresh token；放行 `logoutHub` 后 `getAuthStatus().kind === 'signedIn'`，store 里仍是登录写入的 refresh token，不是登出前的那一枚。
  - 没有重叠 `login` 时，`logout` 结束后 status 为 `signedOut`，`listPersistedHubBaseUrls` 不再包含该 Hub，内存 bucket 也没有 access token。
  - 登出停在 Hub A 的 `logoutHub` 时，登录发生在 Hub B：A 的会话被清掉，B 的新会话还在。B 在登出收尾之前开始的 `refreshDirectory` 不被这次收尾作废，目录结果仍被采纳。
- `src/vs/platform/universeAgent/test/node/hubSessionStore.test.ts` 已有 `applyAuthSession` 代际用例。新增或扩展一条：`clear` 的代际条件在 generation 已变时不删除 bucket，也不删除 refresh secret。

命令：`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts`，以及 `--run src/vs/platform/universeAgent/test/node/hubSessionStore.test.ts`。Node 入口不接受 `--grep`。

## r04-4

**问题类：** 无 token 的本地 skip-auth 链路上，RPC 以 `DEADLINE_EXCEEDED` 失败后会预约下一次发现，但旧 gRPC 通道不 `close`；新链接提交时直接盖住 `this._transport`。

**不变量：** `_loopbackSkipAuth` 分支判定传输失败并预约本地发现时，若 `this._transport` 仍指向当前客户端，先 `close` 它、丢掉引用、并 dispose 这条链路的事件订阅，然后再 `_scheduleLocalEngineDiscovery`。`UNAVAILABLE` 已经由 `_closeoutAuthenticatedLink` 关掉并把 `this._transport` 置空，随后才进入 `_markTransportFailed`；skip-auth 分支看到引用已空就不再 close。带 `_activeProfileId` 的 `DEADLINE_EXCEEDED` 仍只把相位设为 `connecting` / `transport_lost` 并 `_scheduleReconnect`，不关闭当前通道，同一次 unary 成功后仍能回到 `connected`。`_reportLinkStatus` 继续只对 `UNAVAILABLE` 触发 `onDidObserveUnavailable`。

**要动的符号或文件：**

- `UniverseAgentConnectionService._markTransportFailed`（约 2524–2535 行）的 `else if (this._loopbackSkipAuth)` 分支：在改相位和 `_scheduleLocalEngineDiscovery` 之前关闭仍被引用的通道。
- 同文件 `_connectLocalSkipAuth` 调用 `_applyConnectedCommit` 之前（约 2674 行）：若 `this._transport` 存在且不是即将提交的那一个客户端，先 close 旧的。失败分支已经关过并置空时，这里不再碰到它。
- 关闭动作只包含 `close`、解引用、dispose 链路订阅。可以抽一个小函数给上面两处用。

**明确不改什么：**

- `isTransportFailureCode` 继续把 `DEADLINE_EXCEEDED` 和 `UNAVAILABLE` 都当成传输失败。
- `GrpcUniverseAgentClient._reportLinkStatus`：`DEADLINE_EXCEEDED` 不触发 `onDidObserveUnavailable`。测试 `server stream UNAVAILABLE fires onDidObserveUnavailable and DEADLINE_EXCEEDED does not` 保持这个区分。
- `_markTransportFailed` 的 `_activeProfileId` 分支，以及测试 `successful unary after DEADLINE_EXCEEDED restores connected phase`：同一个 transport 在 deadline 之后仍可成功 unary，相位回到 `connected`。
- `_closeoutAuthenticatedLink` 对 `UNAVAILABLE` 的 close 顺序。
- `_applyConnectedCommit` 对已安装通道的字段赋值；提交前的关闭放在调用方，避免带 profile 的拨号路径被改成「每次提交都先关掉当前通道」以外的行为。profile 拨号今天走 `_takeOverEntry` / `_dropPublishedTransport`。
- `_dropPublishedTransport` 会把 `_transportState` 设回 `idle` 并清 `_loopbackSkipAuth`。skip-auth 失败分支继续使用自己的相位（`disconnected`）和发现调度，不要整段换成 `_dropPublishedTransport`。

**怎样本地验证：**

- 保留并通过：
  - `successful unary after DEADLINE_EXCEEDED restores connected phase`
  - `loopback skip-auth without a token restores connected after transport_lost`
  - `server stream UNAVAILABLE fires onDidObserveUnavailable and DEADLINE_EXCEEDED does not`（`src/vs/platform/universeAgent/test/node/grpcClientSessionToken.test.ts`）
- 新增断言：已提交的 loopback skip-auth（无 `_activeProfileId`）上，unary 抛 `UniverseAgentTransportError(DEADLINE_EXCEEDED)` 后，旧客户端的 `close` 被调用一次；随后一次成功的 `_connectLocalSkipAuth` 提交的是新客户端，服务上的 `this._transport` 是新对象，旧对象不会在提交时第二次 close。

命令：连接服务的断言用 `node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts`。gRPC 那则用 `--run src/vs/platform/universeAgent/test/node/grpcClientSessionToken.test.ts`。

## 审查

2026-10-30 只读审查的结论是须改稿，Critical 无。Important 已改：r04-3 的 session generation 只挡住同一 Hub 的 `clear`。另一个 Hub 已经占用目录时，登出收尾不再递增目录代际，也不把目录收成 `idle`。这四份测试走 `node test/unit/node/index.js --run`，不走 `scripts/test.sh --grep`。r04-1 只用推迟写入，失败路径不再 `put`。
