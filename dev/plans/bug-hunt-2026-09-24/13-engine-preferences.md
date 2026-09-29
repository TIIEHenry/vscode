---
title: "忘记配置与登录不得改掉当前引擎或 Hub"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "忘记未使用的配置、同名直连、设备码和失败登录不得拆掉当前引擎或换掉活动 Hub；触发器成功色只跟已有返回字段走。"
---

# 忘记配置与登录不得改掉当前引擎或 Hub

> **本稿是方案，不是实施。**
>
> **冲突域：** `src/vs/workbench/contrib/conversation/` 下 `engine*` / `connection*` / `uaClientSettings*` / `uaPreferences*` / `engineRootAgentId.ts`。
>
> **不改** `universeAgentConnectionService` 的拨号 / 握手。那是 [connection-dial-generation](../connection-dial-generation.md)。若必须动连接服务，只在下文交叉引用，不另起实施切片。
>
> **已有句子（不重开）：** [connection-dial-generation](../connection-dial-generation.md) 的正式 `pairing_pending` 仍走现有 `startPairing` + `verifyPairingSas`，SAS 确认不在本稿。 [connection-hub-client](../connection-hub-client.md) 的 Hub 登录仍是控制面；本稿只改登录失败时是否提前改活动 URL。 [prd-008-engine-e2e](../prd-008-engine-e2e.md) 仍要求断连用 Disconnect，不要用 Forget this Engine 清 trust。 [engine-preferences-completion](../engine-preferences-completion.md) 与 [customizations-engine](../customizations-engine.md) 的 MCP Add/Update/Remove 合同不在本稿扩写。

## 核查

| id | 判定 | 理由 |
|:---|:-----|:-----|
| BH-13-1 | 成立 | `handleForgetSelectedProfile`（`connectionPreferencesPane.ts` 约 1462 行）先无条件 `disconnect()`，再 `forgetConnectionProfile(this.activeProfileId)`。选中行在约 697–700 行写入 `activeProfileId`。忘记失败只在约 1469 行画原因，断开已经发生。 |
| BH-13-2 | 成立 | `findDirectAddressProfilesForEndpoint`（约 159–170 行）用 `displayName === host:port` 或 `displayName === Name`。`ConnectionProfileProjection`（`hub.ts` 约 57–63 行）没有 host/port。`ensureDirectAddressProfileForConnect`（约 1430–1435 行）对每个命中先 `disconnect()` 再忘记；`!forgot.ok` 直接返回，不再 `addDirectAddressProfile`。 |
| BH-13-3 | 成立 | `connectionDevicePairIds`（`connectionDevicePair.ts` 约 15–22 行）取 `selected?.pairingCode ?? inputPairingCode`。`PendingPairInfo.pairingCode` 是字符串（`universeAgentTypes.ts` 约 3507 行），选中后输入框不会送出。`handleConfirmDeviceCode`（约 1884–1885 行）与 `handleRejectDevicePair`（约 1932 行）都走这个函数。点行只写 `selectedPending`（约 1363–1365 行），不改输入框。 |
| BH-13-4 | 成立 | `handleLogin`（约 1044 行）在 `login` 之前调用 `setActiveHubBaseUrl`。该函数（`universeAgentHubService.ts` 约 134–140 行）立刻改活动 URL，并把目录置为 `idle`。`login` 失败在约 168–169 行返回，不把 URL 改回去；页面只在约 1048 行画失败原因。 |
| BH-13-5 | 驳回 | `updateSelectedServer`（`engineMcpSection.ts` 约 403–409 行）确实不回填 command/args/env/url，按钮约 262 行无表单调用。`encodeStringField`（`grpcProtoCodec.ts` 约 59–62 行）会省略空串。本仓没有「Update 按整份 config 覆盖并清空未带字段」的合同。`decodeMcpServerSummary`（`grpcMcpPluginUnaryWire.ts` 约 67–72 行）写明 list summary 不读其余字段。用户能看见的是 RPC `ok` 之后的「Updated.」，不能从 HEAD 推出命令或 URL 被清空、服务器无法再启动。 |
| BH-13-6 | 成立 | `getProfileStateLabel`（约 2038–2047 行）在全局 `connected` 且 `!snapshot.pairingPending` 时，只要**选中** id 的 `state` 是 `pairingPending`，或 `active` 且 `!hasTrust`，就写成 Paired。比较的是 `activeProfileId`，不是某次接通的 profile。快照类型（`universeAgentTypes.ts` 约 1507 行）没有 profileId。 |
| BH-13-7 | 成立 | `handleSetEnabled`（`engineTriggersSection.ts` 约 370–372 行）返回后固定 `'success'`，不比较请求的 `enabled` 与 `result.trigger.enabled`。`handleFire`（约 387–389 行）把已有的 `status` / `eventId` / `reason` 拼进同一条 `'success'`。抛错才走 error（约 373–376、390–393 行）。 |

## Problem class

- **症状：** 忘掉另一份配置或用同名直连去连时，已经连上的引擎先断；设备码框里的码批不到；登录失败后活动 Hub 已经换成新 URL，目录变成空闲；另一份未配对配置显示 Paired；触发器返回了未生效的 enabled 或任意 status，状态条仍是成功色。
- **类标签：** **选中 id 被当成已接通 id** + **显示名被当成端点** + **写成功色不看已有返回字段**。
- **复发机制：** `activeProfileId` 既是列表选中又被 Connect / 标签 / Forget 读取。直连替换只看投影上的 `displayName`。

## 0. 一句话结论

忘记与直连替换先改配置、后才断开，而且只断开这一页自己记下的那次接通；设备码以非空输入框为准；Hub URL 只在 `login` 成功落账；Paired 覆盖只打在记下的接通 id 上；触发器成功色跟已有的 `enabled` 比较，Fire 不再把 resolve 涂成成功。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 选中行覆盖 `activeProfileId`；无选中时 `renderProfiles` 把 `activeProfileId` 设成列表第一项 | `connectionPreferencesPane.ts` 约 697–700、2026–2027 行 |
| Forget 先 `disconnect()`，再忘记 `activeProfileId`；失败只画 `result.reason` | 同文件约 1462–1471 行 |
| 直连命中：`targetKind === 'directAddress'` 且显示名等于 `` `${host}:${port}` `` 或 Name | `findDirectAddressProfilesForEndpoint` 约 159–170 行 |
| 每个命中先 `disconnect()` 再 `forgetConnectionProfile`；忘记失败不再添加 | `ensureDirectAddressProfileForConnect` 约 1429–1437 行 |
| `addDirectAddressProfile` 总是 `createDraft` + `put`，不按 host/port 复用 | `universeAgentHubService.ts` 约 376–397 行 |
| 投影只有 `profileId` / `displayName` / `state` / `hasTrust` / `targetKind`；`projectProfile` 丢掉存储里的 host/port | 类型在 `hub.ts` 约 57–63 行；`projectProfile` 在 `universeAgentHubService.ts` 约 56–63 行 |
| 存储里的直连目标有 `host` / `port`，投影丢掉 | `connectionProfileStore.ts` 约 12 行 |
| 设备码：`selected?.pairingCode ?? inputPairingCode ?? ''`；不 trim | `connectionDevicePair.ts` 约 14–22 行 |
| 引擎 Confirm / Reject 使用该函数；Hub `confirmDeviceCode` 分支仍只用输入框 trim 后的码 | `connectionPreferencesPane.ts` 约 1884–1910、1927–1932 行 |
| 登录前 `setActiveHubBaseUrl`；成功路径的 `login` 自己会写 `_activeHubBaseUrl` 并 `refreshDirectory` | pane 约 1044–1046 行；hub 服务约 134–140、162–176 行 |
| 快照无 profileId；`ConnectionPhase` 的 `connected` 只有 `path` | `universeAgentTypes.ts` 约 1507 行；`connectionHubTypes.ts` 约 29–32 行 |
| 全局已连接且快照非 pairingPending 时，选中项 pairingPending 或 active 且无 trust → 文案 Paired | `getProfileStateLabel` 约 2038–2047 行 |
| `SetTriggerEnabled` 结果只有 `trigger`；`FireTrigger` 结果只有 `status` / `eventId` / `reason` 三个字符串 | `universeAgentTypes.ts` 约 3620–3641 行 |
| Update 合并体不带 command/args/env/url；list summary 不读这些字段 | `engineMcpSection.ts` 约 403–409 行；`grpcMcpPluginUnaryWire.ts` 约 67–72、405–414 行 |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 页内记账** | 接通 id 只记在 pane，与选中行分开；忘记与直连按下面切片做；登录不提前改 URL；触发器色调看已有字段 | **选定** |
| B 给快照或 phase 加 profileId，Forget 去读连接服务 | 要改 `universeAgentConnectionService` 的对外形状 | **拒绝。** 拨号 / 握手属 [connection-dial-generation](../connection-dial-generation.md)。快照今天没有该字段，本稿不发明 |
| C 把 host/port 加进 `ConnectionProfileProjection` 再按端点删除 | 去重更准，但要改 hub 投影 | **拒绝本波。** 存储里已有 `target.host` / `port`，投影未露出。不在冲突域里改 hub 服务，也不把存储字段写成新的协议字段 |
| D 直连同名仍先 `disconnect()` 再忘记 | 保留 BH-13-2 | **拒绝** |
| E 给 Fire 的 `status` 规定成功枚举（例如只认某个词） | 本仓注释写明空串原样映射，测试里的 `FIRED` 只是夹具 | **拒绝。** 不发明状态词 |
| F 修 MCP Update：无 command/url 不发送，或先取完整配置 | 依赖「整份覆盖会清空」 | **拒绝。** 见核查 BH-13-5 |

## 3. 选定设计（A）

页内两本账，禁止混用：

| 账 | 何时写下 | 谁读 |
|:---|:---------|:-----|
| **选中 id**（今日 `activeProfileId`） | 列表选中、无选中时第一项、添加成功；`connectProfileWithPairing` 一进函数就写成这次 `profileId`（约 1552 行） | Connect / Test / 列表焦点；Forget 用它决定忘记哪一份 |
| **接通 id**（pane 私有字段，不是快照字段，不是协议字段） | 只在 `connectProfileWithPairing` 落到末尾 `setConnectTestStatus(finalResult)` 时：`finalResult.ok` 且不是 pairing / recoverTrust 等待（现有 `isConnectPairingPending` / `isRecoverTrustConnectResult` 为假） | Forget 是否断开、直连替换是否断开、Paired 覆盖 |

接通 id 的清除：`handleDisconnect` 在 `disconnect()` 成功之后清；忘记的就是这份 id 且忘记成功之后清。下列情况不写、也不改已记下的接通 id：`connectProfile` 返回 `!ok`；仍在配对或 recoverTrust；对话框取消；约 1580–1587 行提前返回（`result.ok`、没有 pairing/SAS，但 profile `state === 'pairingPending'`，文案 “This profile still needs pairing confirmation.”）。那次返回还没接通。服务端自己重连（[connection-dial-generation](../connection-dial-generation.md) 的 reconnect）不会通知这份页内账——见 §4。

1. **S1 Forget。** `handleForgetSelectedProfile` 的不变量：没有选中 id 则返回（保持今日）。**禁止**在 `forgetConnectionProfile` 之前调用 `disconnect()`。忘记返回 `!ok` 或抛错：只画已有的 `reason` / 错误文本，接通 id 与连接都不动。忘记 `ok` 且选中 id 等于接通 id：再 `disconnect()`，然后清两本账里的这份 id。忘记 `ok` 但选中 id 不是接通 id：不调用 `disconnect()`。

2. **S2 直连替换。** `findDirectAddressProfilesForEndpoint` 的不变量：只保留 `targetKind === 'directAddress'` 且 `displayName === directAddressEndpointLabel(host, port)`。Name 与这条标签不同时，不得因为 Name 相等而命中。`ensureDirectAddressProfileForConnect`：对每个命中先 `forgetConnectionProfile`；`!ok` 立即返回该结果，不添加、不 `disconnect()`。忘记 `ok` 且该 id 等于接通 id 时，才 `disconnect()` 并清接通 id。全部命中处理完再 `addDirectAddressProfile`（仍是今日的 `createDraft`，不在本稿改 hub 服务）。同名不同地址的旧配置留下来；同一 `host:port` 标签的旧配置仍会被换成新的一份。

3. **S3 设备码。** `connectionDevicePairIds` 的不变量：`inputPairingCode` 为非空字符串（不 trim，空串仍算空）时，`pairingCode` 用输入框；否则用 `selected?.pairingCode ?? ''`。`displayName` / `role` 仍只来自选中行，空则 `''`。`handleConfirmDeviceCode` 的引擎分支与 `handleRejectDevicePair` 继续调用该函数，不另写一套拼接。Hub `confirmDeviceCode(code)` 分支保持只用输入框 trim 后的码。

4. **S4 Hub 登录。** `handleLogin` 在调用 `login` 之前不得调用 `setActiveHubBaseUrl`。失败与抛错只画约 1048 / 1059 行的原因；活动 URL 与目录保持调用前的值。成功仍靠 `login` 内部在 `ok` 之后写 `_activeHubBaseUrl` 并 `refreshDirectory`（`universeAgentHubService.ts` 约 171–175 行）。`mustChangePassword` 仍走 `handleChangePassword`，不改 URL。不改 `setActiveHubBaseUrl` 本身。

5. **S5 配置标签。** `getProfileStateLabel` 里今日「改写成 Paired」的条件，把 `profile.profileId === this.activeProfileId` 换成 `profile.profileId === 接通 id`。其余分支（Pairing pending / Revoked / Disabled / 有信任则 Paired / 否则 Unpaired）不动。全局已连接但接通 id 为空（打开页时引擎已经连着、这份账还没记下）时，不把别人的 pairingPending 改写成 Paired。

6. **S6 触发器色调。** `handleSetEnabled`：`result.trigger.enabled === enabled` 时才 `'success'`，文案仍是今日的 `formatEngineTriggerListLabel(result.trigger)` 加 `result.trigger.enabled`。不等时 `'error'`，文案用同一串，不新造协议字段。`handleFire`：resolve 不得传 `'success'`。三字段原文照拼，色调一律 `'neutral'`（含三者皆空）。空串按现有类型注释原样映射，不把空串或任何一个 status 词收成失败枚举。抛错路径保持 `'error'`。

## 4. 不做

- 不改 `universeAgentConnectionService` 的拨号、握手、`disconnect` 实现、快照形状。接通 id 与服务里的 `_activeProfileId` 可能在服务端重连后不一致；要对齐只能改连接服务，留给 [connection-dial-generation](../connection-dial-generation.md)，本稿不切片。
- 不把 host/port 加进投影，不改 `addDirectAddressProfile` 的 `createDraft`。同名不同端点会多一份配置，这是 S2 的代价。
- 不改 SAS / `verifyPairingSas` / `confirmPairing`。设备码是 `pairApprove` / `pairReject` 与 Hub `confirmDeviceCode`。
- 不改 MCP Update / Add 的合并与编码（BH-13-5）。
- 不发明 Fire `status` 词表，不改 `engineTriggerFireRequest` / `engineTriggerSetEnabledRequest` 的空字段透传。
- 不改 `uaClientSettings*` / `uaPreferences*` / `engineRootAgentId.ts`（本次没有对应成立条目）。

## 5. 验证

本地、只跑已有浏览器测试文件，不要重开 GitHub Actions。

| 断言 | 落点 |
|:-----|:-----|
| 已接通 A，选中 B，Forget：`disconnect` 调用次数为 0，`forgetConnectionProfile` 收到 B；忘记 `!ok` 时 `disconnect` 仍为 0 | `src/vs/workbench/contrib/conversation/test/browser/connectionPreferencesPane.test.ts` |
| 接通 id 就是被忘记的 id 且忘记 `ok`：`disconnect` 在忘记成功之后恰好一次 | 同上 |
| Name=`office`、另一条 directAddress 的显示名也是 `office` 但标签不是这次的 `host:port`：不忘记、不 `disconnect`，仍会 `addDirectAddressProfile` | 同上；纯函数断言改 `findDirectAddressProfilesForEndpoint` 今日「Name 也命中」那一条 |
| 显示名等于 `host:port` 的 directAddress 仍被忘记；忘记 `!ok` 时不添加、不 `disconnect` | 同上，接在现有 “Direct Connect forgets existing endpoint profile” |
| `connectionDevicePairIds('typed', { pairingCode: 'sel', ... })` 的 `pairingCode` 为 `typed`；输入 `''` 时仍为 `sel`；无选中时不 trim | `src/vs/workbench/contrib/conversation/test/browser/connectionDevicePair.test.ts` |
| 登录 `!ok`：`setActiveHubBaseUrl` 调用次数为 0 | `connectionPreferencesPane.test.ts` |
| 全局 connected、选中另一份 `pairingPending`、接通 id 是别的 id：标签仍是 Pairing pending。接通 id 等于该行时仍为 Paired（保住今日 “drops pairing pending when connection phase is connected” 的单行情形，但接通账要先写上） | 同上 |
| `setTriggerEnabled` 返回的 `enabled` 与请求不一致：状态节点不是 `is-success`。一致时仍是成功色 | `src/vs/workbench/contrib/conversation/test/browser/engineTriggersSection.test.ts` |
| `fireTrigger` resolve（含 `status` / `eventId` / `reason` 皆空）：状态节点不是 `is-success`，色调 neutral，三字段原文仍在。抛错仍是 error | 同上 |

门禁命令用仓库已有的 `scripts/test.sh` 点名上述浏览器测试，或对应的 `run-unit-custom.sh` 路径。不跑托管 CI。

2026-09-24 只读审查：接通账排除约 1580–1587 行仍待配对的提前返回；Fire 空结果保持 neutral，不把空串收成 error。

2026-09-29 实施：S1–S6 落在 `connectionPreferencesPane.ts`、`connectionDevicePair.ts`、`engineTriggersSection.ts` 及对应浏览器单测。登录失败与抛错不调用 `setActiveHubBaseUrl`；成功仍由 `login` 在 ok 之后写活动 URL，未改 `universeAgentHubService.ts`。
