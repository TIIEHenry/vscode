---
title: "设计审查 2026-11-04 p5：universeAgent 平台层边界"
type: plan
status: accepted
phase: N/A
updated: 2026-11-05
summary: "连接服务不拆类；已连接且 link 未变时宿主不再重复拉起；去掉主进程配对对话框。能力哨兵改用稳定记号 `unsupported_environment`，预设与 harness 导入留在连接服务。"
---

# 设计审查 2026-11-04 p5：universeAgent 平台层边界

状态：执行中。
签收：签。签收人：agent:cursor（用户委托），日期：2026-11-05。待定项的决定见文末「待定项」。
覆盖需求：无（正文未引用需求编号）。

> **本稿是方案，不是实施。**
> **基线：** 本工作区活码。`a4b778cfd18` 已在 HEAD：第一次配对确认在 Connection 窗格出现一次。
> **不推翻：** [ADR-003](../decisions/003-engine-adapter-boundary.md)（传输在 `platform/universeAgent`，renderer 不 import `node/**`，electron-main 是宿主）；[连接 IPC 白名单](../../archive/dev/plans/connection-ipc-allowlist.md)（已实施：白名单外壳、Hub 通道名 `universeAgentHub`、仍打到同一个连接实例、不注册第二份 Hub 服务、不拆连接类）；[拨号 generation](connection-dial-generation.md)；[已发布链路](published-link-identity.md)；[写入闸](engine-write-gate-unification.md) §3.7（同 link 的 `transport_lost` 要拆流，恢复要 `bringUpPublishedLink` 并增加 `connectionGeneration`）；[r04 方案](review-2026-10-30-r04-universe-agent-plan.md) 的 logout 会话代际（本稿不改 `logout`）。
> **禁止发明：** 新 RPC、新连接快照字段、新 IPC 通道。必须用到时只写在「待定项」，不写进切片。
> **分层约束：** 服务依赖写在构造函数里；`Disposable` 创建后立刻登记；用户可见字符串走 `nls.localize`，源字符串用英文双引号，不用拼接。`contrib/**` 继续只依赖 `platform/universeAgent/common`。

## 冲突域与顺序

| 切片 | 条目 | 会碰的文件 | 依赖 |
|:-----|:-----|:-----------|:-----|
| S1 | 2 | `node/sessionViewHost.ts`；`test/node/sessionViewHostReopen.test.ts`；`docs/modules/platform/overview.md` 的 UniverseAgent 段加一段代次表 | 无 |
| S2 | 5 对话框 | `node/universeAgentConnectionService.ts`；`electron-main/universeAgentMainService.ts`；`test/node/universeAgentConnection.test.ts`；`test/node/universeAgentMainDialogWindowScan.test.ts` | 无。不与 S1 抢文件 |
| S3 | 4 | 待定项 1 已选 B，按第 4 节做。`common/universeAgentRendererSync.ts`；`browser/webUnsupported.ts`；`engineSectionChrome.ts`（含横幅 `getUnsupportedEnvironmentCopy`）；`engineCatalog.ts` 的状态文案；`engineOverviewSection.ts`；`engineTriggersSection.ts`；协议面 Web 表那一格；两份 E2-1（`connectionPreferencesPane.test.ts`、`enginePreferencesPane.test.ts`） | 待定项 1。`engineOverviewSection.ts` 与 `engineTriggersSection.ts` 上已有别人的未提交改动，不要 stash / restore |
| S4 | 6 | 先 `common/hub.ts`（别名仍在时）；再按 RPC 只动对应的 `*UnaryWire.ts` 与 `grpcClientMappersSession.ts` / `grpcClientMappersCatalog.ts` | 无。Usage 那片要注意现有 import 方向，见该条 |
| S5 | 3 | 按下面三批提交。每一批含 `common/universeAgentTypes.ts` 里该批接口，以及因此编不过的调用方。不能只交类型文件 | 无。不与 S3 并行改同一文件；S3 选 B 时不改这个文件 |

S2 是本方案里唯一改 `universeAgentConnectionService.ts` 的切片。`hubDirectoryClient.ts` 工作区已有未提交改动，本稿不碰。

条目 1 没有切片。

## 待定项

2026-11-05 用户拍板，两项都按推荐：1 选 B，不加字段，Web 哨兵的 `reason` 改成 `unsupported_environment`，S3 按第 4 节做；2 选 A，预设目录和 harness 导入留在连接服务。下面的选项留作记录。

选 B 的代价：`reason` 里同时有机器记号（Web 哨兵）和给人看的句子（探测失败）。直接显示 `reason` 的地方都要先经过记号映射。

### 1. 能力条目要不要新字段

`UniverseAgentCapabilityEntry` 只有 `support` 和可选 `reason`（`universeAgentTypes.ts` 44–47 行）。它嵌在连接快照里，经 `getCapabilitySnapshot` 和 `onDidChangeConnection` 过 IPC。加上 `code` 就是新快照字段。

| 选项 | 含义 |
|:-----|:-----|
| A | 增加可选 `code`。比较和剥离认 `code`，`reason` 继续放给人看的句子。要改快照形状 |
| B | 不加字段。Web 哨兵的 `reason` 改成稳定记号 `unsupported_environment`（与现有 `ConnectionFailureCode` 同一个词）。`capabilityEntryIsWebUnsupported` 和桌面剥离认这个记号。界面用 `nls` 显示，源字符串为 `"This environment cannot connect to a local Engine."`。探测失败的 `method not advertised`、`UNIMPLEMENTED`、`not probed` 保持原样 |
| C | 保持中文硬编码 |

推荐 B。英文界面不应再显示写死的中文；没有语言包时界面显示英文源字符串。未拍板前不做 S3。选 A 则 S3 取消，改字段要另写一版并先改协议面。选 C 则 S3 不做。

### 2. 预设目录和 harness 导入留不留在连接服务

`listProviderPresetCatalog`（连接服务 2242–2244 行）读的是 node 侧 `loadProviderPresetCatalog`（`node/providerPresetCatalog.ts` 55 行），会访问 models.dev。`previewHarnessProviderImport` / `importHarnessProviders`（2246–2251 行）通过 `readLocalHarnessProviderDrafts`（`node/harnessProviderImport.ts` 38 行）读本机文件。纯预设列表已经在 `common/providerPresetCatalog.ts`，`engineProviderModelSection.ts` 22 行直接引用 `builtinProviderPresets`。磁盘和 HTTP 不能挪到 renderer。

| 选项 | 含义 |
|:-----|:-----|
| A | 留在 `IUniverseAgentConnection`。不新开通道 |
| B | 新 platform 服务和 IPC 通道。本稿禁止发明通道，除非这里改口 |

推荐 A。本方案没有对应切片。

## 1. 一个类三个服务

问题类：一个 3014 行的类同时实现连接、宿主和 Hub，Main 用一份内层通道包出两条窗口通道。窗口侧漏方法已经被白名单挡住，这是有意的单对象双通道。

核实过的证据：

- 文件 `src/vs/platform/universeAgent/node/universeAgentConnectionService.ts` 的类从 612 行到 3625 行结束。
- 612 行：`implements IUniverseAgentConnection, IUniverseAgentHostConnection, IUniverseAgentHubService`。
- 630 行持有内部 `UniverseAgentHubService`。2379–2476 行把 Hub 方法转到 `_hub`。`revokeDevice`（2431–2447 行）在 Hub 成功后，若当前档就是这台设备，会 `disconnect`。
- `src/vs/code/electron-main/app.ts` 1239 行注册 `UniverseAgentHostConnectionAdapter`。1414–1419 行：一份 `ProxyChannel.fromService`，连接外壳和 Hub 外壳各注册一条通道。
- `common/universeAgentConnectionIpcChannel.ts`：`DENIED_CONNECTION_CALLS` 60–75 行，`FORWARDED_CONNECTION_CALLS` 103 行起，`DENIED_HOST_CALLS` 314 行，`FORWARDED_HUB_CALLS` 327 行，`sealIpcContract` 375–411 行。名单和接口键不一致时编译失败。
- 适配器 `electron-main/universeAgentHostConnectionAdapter.ts` 15–16 行写明：再构造一个连接服务会多开一条引擎链路。它用断言把同一个实例当成宿主（24–26 行）。

不变量：

- 全应用一条连接。Hub 通道和连接通道共用这一条，这样 `revokeDevice` 才能断开当前档，Connection 窗格也不会看到另一份空账号。见 [连接 IPC 白名单](../../archive/dev/plans/connection-ipc-allowlist.md) §2.3。
- 宿主方法、`connect` 和回调流不进窗口通道。进程内 `SessionViewHost` 直接调宿主方法。
- 不注册第二个 `UniverseAgentHubService`，也不把连接类再 `SyncDescriptor` 一次。

要动的符号与文件：无。

改法：不做。

收益和成本：

- 再拆一个独立 Hub 实例：账号和 `revokeDevice` 的断线副作用会分开。通道名已经独立，不需要第二个对象。
- 把宿主接口从类上拿掉：适配器今天靠这个类实现宿主接口。拿掉之后要么两套传输，要么留下一个同样大的委托对象。窗口侧已经看不到宿主方法。
- 连接生命周期和 RPC 门面拆成两个类：两边都要读 `_transport`、`_publishedLinkId`、`_connectEpoch`。拆开要改构造、IPC 密封和 `universeAgentConnection.test.ts`（D17，Node 入口没有 `--grep`，整文件跑）。用户可见行为不变。
- 按 catalog 把 `IUniverseAgentConnection`（`common/universeAgentConnection.ts` 426 行起，文件 2305 行）拆成多个被同一接口继承的子接口：`keyof` 不变时密封还能过，但每个测试替身都要改。没有行为收益。

推荐停在当前边界：单对象、双通道、宿主 token 只在 main、白名单密封。不做到类拆分，也不做接口分组。

明确不改什么：

- `app.ts` 的通道注册、`sealIpcContract`、Hub 转发、`revokeDevice` 后的 `disconnect`。
- [ADR-003](../decisions/003-engine-adapter-boundary.md) 的落层。

本地验证：无新测试。回归仍用现有 `scripts/test.sh --run src/vs/platform/universeAgent/test/node/universeAgentConnectionIpcChannel.test.ts`。

风险与回退：没有代码改动。若以后要推翻「不拆类」，先改 [连接 IPC 白名单](../../archive/dev/plans/connection-ipc-allowlist.md) 的合同，再开新方案。

## 2. 四套代次

问题类：拨号、已发布链路、配对、Hub 目录、会话流各有自己的计数。它们取消的不是同一件事，不能收成以 `linkId` 为键的一套。宿主在链路没变时仍会 `bringUpPublishedLink`。

核实过的证据：

- 连接服务 657–662 行：`_connectEpoch`、`_connectedEpoch`、`_publishedLinkSerial`、`_publishedLinkId`。
- `_bumpConnectEpoch` 3028–3030 行：自增并清 `_pairingContextProfileId`。调用点：用户 `connectProfile`（882 行，`reconnect !== true`）、`disconnect`（1362 行）、`dispose`（2479 行）。`cancelPairing`（1327 行）转 `disconnect`，所以取消配对也会加拨号代。重连不加代。
- `_connectedEpoch` 只在已接通提交时写成当时的拨号代（3211 行）。3058 行用它判断同代重连不得拆掉赢家。
- `_publishCommittedLink` 2952–2968 行：同一 transport、同一 profile、同一身份复用 `linkId`；否则 `_publishedLinkSerial` 加一。序号不因清链路而回退。2971–2975 行清掉已发布 id，不清序号。
- `pairingOrchestrator.ts` 157 行 `pairingGeneration`。自增：`dispose` 172、`startPairing` 184、`confirmSas` 328、`confirmRecoverTrust` 481、`abandonRecoverTrust` 726。331–332 行和 484–485 行：`userConfirmed === true` 时不再打开主进程对话框，代次仍先加。
- `universeAgentHubService.ts` 109 行 `_directoryGeneration`。自增：`setActiveHubBaseUrl` 148、`login` 190、`logout` 进入 200 与清理后 209、`refreshDirectory` 264、启动恢复 511、`dispose` 560。275–280 行：代次或活动 Hub 变了就丢掉目录结果。
- `sessionViewHost.ts` 318 行 `connectionGeneration`，322 行 `observedLinkId`。611–631 行：身份或 link 变了走 `applyPublishedLinkChange`；没变时，已连接就 `bringUpPublishedLink`，否则 `releasePublishedLink`。665–668 行每次拉起都 `connectionGeneration += 1`。
- `assertUniverseAgentExpectedOwner` 在 `common/universeAgentExpectedOwner.ts` 33 行。生产调用三处：`universeAgentConnectionIpcChannel.ts` 441 行、连接服务 2508 行、`electron-main/universeAgentPtyChannel.ts` 81 行。

不变量：

| 计数 | 取消域 | 不做什么 |
|:-----|:-------|:---------|
| `_connectEpoch` | 用户拨号、断开、dispose | 不取消 Hub 目录，不代替 `linkId`。细则见 [拨号 generation](connection-dial-generation.md) |
| `_connectedEpoch` | 不是取消令牌。记下赢家那一代 | 同代重连不得拆赢家 |
| `_publishedLinkSerial` / `_publishedLinkId` | 不是拨号取消令牌。标识已提交链路 | 同 transport / profile / identity 不加号。相位变化不加号。见 [已发布链路](published-link-identity.md) |
| `pairingGeneration` | 编排器里新的配对、确认、放弃、dispose | 与 `_connectEpoch` 各算各的。`userConfirmed` 只跳过对话框 |
| `_directoryGeneration` | 换 Hub、登录、目录刷新、启动恢复、dispose，以及 `logout` | 不表示引擎 link。活码在 `logout` 入口（200 行）和 `await` 之后（209 行）各加一次，并在 211 行把目录收成 `idle`。已签收、未实施的 [r04](review-2026-10-30-r04-universe-agent-plan.md) 收尾条件以该方案为准，活码尚未落地。本稿不改 `logout`。概览的这一行只写「收尾条件以 r04 为准，活码尚未落地」。无条件的第二次递增不是概览里的不变量。r04 签收摘要写入口递增保持不变，但正文 92 行仍写：入口那次递增若会作废另一个 Hub 已开始的 `refreshDirectory`，就不要无条件做。概览沿用 r04 正文的收尾条件，不把入口收成签收摘要里更窄的那句 |
| `connectionGeneration` | 宿主每次把已发布链路拉起 | 不是 `linkId`。同 link 从断开回到已连接必须加一，否则 [写入闸](engine-write-gate-unification.md) §3.7 的同传输恢复不会重开流 |

`connectionGeneration` 不能改成由连接服务的不可变 link 事件驱动。同 link 恢复时 `linkId` 不变，流代次仍要加。新事件或新快照字段都不做。

已经 `connectionUp` 且身份和 link 都没变时，再来一次快照不得再拉起，也不得再加 `connectionGeneration`。今天 625–628 行只要「没变且 `isEngineConnected()`」就拉起。`bringUpPublishedLink` 在异步绑定之前就把 `connectionUp` 设为 true（665–672 行）。绑定失败被 `bringUpBoundSession` 吃掉（723–731 行），`engineBroughtUpForGeneration` 只在成功后写入（748–751 行）。因此一次失败的绑定之后，连接仍是 up，下一次快照会再拉起并重试。生产上这样的快照包括能力更新：`fetchAgentTree` 遇到 `UNIMPLEMENTED` 时会 `_fireSnapshotChanged`（连接服务 810–814 行），会话服务在 `electron-main/universeAgentSessionViewService.ts` 33 行把每次 `onDidChangeConnection` 转给宿主。

`transport_lost` 那条仍要：先 `releasePublishedLink`（`connectionUp` 变为 false，675–677 行），同 link 恢复后再拉起并加代。

本切片把「快照再拉起」拿掉之后，失败的绑定不再由下一次快照重试。`whenEngineSessionReady` 仍直接 `ensureBroughtUp`（410–411 行）。新租约在 `connectionUp` 已为 true 时，`acquireLease` 仍会 `bringUpBoundSession`（402–403 行）。流自己关掉后的重开仍走 `scheduleStreamReopen`。

要动的符号与文件：`SessionViewHost.onEngineConnectionChanged`。文件 `node/sessionViewHost.ts`。文档落到 `docs/modules/platform/overview.md` 现有 UniverseAgent 段，用上表，不把三份旧方案的正文再抄一遍。

改法：

1. 625–628 行的已连接分支改为：仅当 `!this.connectionUp` 时调用 `bringUpPublishedLink`。未连接分支仍 `releasePublishedLink`。`publishedChanged` 分支不动。
2. 在 platform 概览的 UniverseAgent 段写下表，并链到拨号 generation、已发布链路、写入闸 §3.7、r04。写明 [已发布链路](published-link-identity.md) 里「只改相位不制造断开边沿」已被写入闸的 `transport_lost` 拆流覆盖；本切片不把那条拆流退回去。`logout` 一行的正文就是：活码有两次递增，收尾条件以 r04 为准且尚未落地。

明确不改什么：

- 上表各计数的自增位置。`expectedOwner` 的定义和三处调用。
- `releasePublishedLink` 是否在已经断开时再发一次 `connectionDown`。
- `logout` 的 session generation。

本地验证：

- 改 `sessionViewHostReopen.test.ts` 里已有的 `transport_lost with unchanged link releases the published link and same-transport recovery brings it up`：恢复后 `connectionGeneration` 仍大于释放前。
- 同文件新增：已连接且 link 未变时再调用 `onEngineConnectionChanged`，`connectionGeneration` 不变，`subscribeCalls` 不增加。
- 同文件新增：第一次绑定的 `createSession` 失败后，连接仍为 up；再来一次 `onEngineConnectionChanged` 不得再次 `createSession`。随后 `whenEngineSessionReady` 仍会再绑定。
- `scripts/test.sh --grep "transport_lost with unchanged link"`
- `scripts/test.sh --grep "reconnect Resumes the bound engine id"`
- 这两份测试不在 `test/unit/electron/d17-ua-node-unloadable.json`，走 `scripts/test.sh`。

风险与回退：失败绑定不再被下一次能力快照重试，直到 `whenEngineSessionReady`、新租约的 `acquireLease`，或链路先释放再恢复。回退就是去掉 `!this.connectionUp` 判断。

## 3. 结果类型与 Web 降级

问题类：引擎结果、Hub 结果、邮箱 `PostOutcome`、Web 桩用了多套失败形状。Web 的四种控制流已经按返回类型分开，并被协议面和测试钉住。

核实过的证据：

- `universeAgentTypes.ts` 有 56 处 `readonly ok: boolean`。其中 44 个接口带可选 `message`（如 `UniverseAgentResumeSessionResult` 182–186 行），8 个带可选 `reason`（如 `UniverseAgentSetSkillEnabledResult` 1883–1886 行），另外 4 个是 `UniverseAgentSyncPermissionRuleResult`（带 `ruleId`）、`UniverseAgentPromotePermissionRuleResult`（只有 `ok`）、`UniverseAgentSetClientToolProfileResult`（可选 `error`）、`UniverseAgentQueueMutationResult`（可选 `error` / `opId` / `itemId`）。
- Hub 失败是 `{ ok: false, code, reason }`（`common/hub.ts` 41–51 行）。
- `DetailFetchOutcome` 在 `conversationViewFrame.ts` 103–105 行：`ok` 加 `reason: 'unavailable' | 'failed'`。`PostOutcome` 在 286–291 行：`accepted` 加四个 reason。
- Web 连接桩 `browser/universeAgentConnectionService.ts`：`connectProfile` / `confirmPairing` / `probeConnectionProfile` 返回 `{ ok: false, code, reason }`（148–161 行）；`cancelPairing` 157 行 reject；`disconnect` 169 行 reject；目录方法从 `listSkills` 240 行起 reject；`subscribeSessionEventStream` 同步抛（233 行）；`requestAgentTreeRefresh` 空操作（136–137 行）；`probeEngine` 只有 `reason`（348–349 行），因为 `UniverseAgentProbeEngineResult`（`universeAgentConnection.ts` 2303–2305 行）没有 `code`。
- Web 会话桩 `browser/universeAgentSessionViewService.ts` 27 行返回 `web-empty:`，39 行 `post` 为 `{ accepted: false, reason: 'not_authenticated' }`，50–51 行 `requestDetail` 为 `{ ok: false, reason: 'unavailable' }`。
- 协议面 Web 表（`docs/reference/universe-agent/engine-protocol-surface.md`「1b」）要求：`connectProfile` 带 `unsupported_environment`；空 lease；`whenEngineSessionReady` 拒绝；不得把 `web-empty:` 当绑定成功；`requestDetail` 恒为 unavailable。`platform/overview.md` 同样写了 `web-empty:`。browser 测试 `session view lease is empty`、`confirmPairing and cancelPairing use unsupported_environment` 把拒绝和空 lease 钉住。

不变量：

- 不改 protobuf，不改 IPC 方法名，不给 `probeEngine` 增加 `code`（那是结果形状变化，见待定项以外的禁止项；本条不做）。
- 有 `code` 的 Web 方法继续 resolve `{ ok: false, code: 'unsupported_environment', reason }`。
- 没有失败对象的 Promise 继续 reject `UniverseAgentUnsupportedEnvironmentError`。`Promise<void>` 的 `cancelPairing` / `disconnect` 也保持 reject。空列表假装成功会让 Web 看起来像已接通。
- 非 Promise 的流句柄继续同步抛。`void` 通知继续空操作。
- `PostOutcome` 与连接结果不合并。`web-empty:`、`not_authenticated`、`unavailable` 保持。

要动的符号与文件：`universeAgentTypes.ts` 里上述接口，以及每一批里因此编不过的调用方。不能只提交类型文件。字段名和可选性不变，运行时字段值不变。

改法：分三批，每批一次提交，类型声明和调用方在同一批。收成 `{ ok: true, ... } | { ok: false, ... }`。该接口今天已有的字段留在它今天会出现的那一臂；两臂都会出现的字段两臂都留（有的 `message?` 结果还带 `reasonCode` 或 `errorCode`）。`message` / `reason` / `error` 不改名。调用方只改类型分支：

- 返回处：`ok` 若是布尔表达式（`wire.success === true`、`lastVarint(...) === 1n`），改成 `condition ? { ok: true, ... } : { ok: false, ... }`。两臂带上今天这个对象已经填写的字段。
- 读取处：未先按 `ok` 分支就读取只存在于一臂的字段时，先 `if (result.ok)` 或 `if (!result.ok)` 再读原来的字段。`assert.strictEqual(result.ok, true)` 不会收窄，不能靠它代替分支。字面量 `{ ok: true }` / `{ ok: false }` 且字段仍在对应一臂的，不必改。

未列入的同形返回由这一批的编译错误收齐，并进同一提交。

1. 44 个带可选 `message` 的接口。已核对、必须进这一批的构造点：
   - `grpcClientMappersSession.ts`：`mapShelveSessionResponse`、`mapCreateSnapshotResponse`、`mapResumeSessionResponse`、`mapUnshelveSessionResponse`、`mapPurgeSessionResponse`、`mapFetchToolUsageDetailResponse`、`mapCompactResponse`、`mapRestoreSnapshotResponse`、`mapDeleteSnapshotResponse`、`mapPruneResponse`、`mapBranchResponse`、`mapBackResponse`。
   - `grpcClient.ts`：`pauseAgent`、`resetAgent`、`suspendLoop`、`resumeLoop`、`stopLoop`、`runToolInBackground`、`stopShellTask`、`sendShellSessionClientControl`、`installSessionDemoFake`、`clearSessionDemoFake`、`switchWorkDir`、`testModelProfile`、`setPermissionPolicy`、`setConfig`。
   - `grpcTeamUnaryWire.ts`：`decodeAbortTeamResponse`、`decodeMessageMemberResponse`（经 `decodeSuccessMessage`）。
   - `grpcSessionAttachWire.ts`：`decodeForkAgentResponse`、`decodeDeleteMessageResponse`、`decodeResumeSessionResponse`。
2. 8 个带可选 `reason` 的接口（Skills、Agent profile 删除/重置、MCP 写）。已核对的构造点：`grpcClientMappersCatalog.ts` 的 `mapSetSkillEnabledResponse`、`mapSaveSkillContentResponse`、`mapDeleteAgentProfileResponse`、`mapResetAgentProfileResponse`、`mapAddMcpServerResponse`、`mapUpdateMcpServerResponse`、`mapRemoveMcpServerResponse`、`mapToggleMcpServerResponse`；`grpcQueueSkillWire.ts` 的 `decodeSaveSkillContentResponse`。`grpcClient.ts` 里只是 `return mapX(...)` 或 `return unary(...)` 的，构造点在 mapper / decode，不在客户端再写一份。
3. 其余 4 个（`ruleId`、只有 `ok`、`error`、队列变更）。已核对的构造点：`grpcCatalogUnaryWire.ts` 的 `decodeSyncPermissionRuleResponse`、`decodePromotePermissionRuleResponse`、`decodeQueueMutationResponse`；`grpcConfigPermissionUnaryWire.ts` 的 `decodeSetClientToolProfileResponse`。`grpcClient.ts` 的 `syncPermissionRule`、`promotePermissionRule`、`setClientToolProfile`、`_queueMutation` 直接返回这些 decode。

明确不改什么：

- Web 桩的 resolve / reject / throw / 空操作。`probeEngine` 不加 `code`。
- Hub 的 `{ code, reason }`、`DetailFetchOutcome`、`PostOutcome`。
- 不把 `message` 改名为 `reason`，不把 `error` 改名为 `message`。这些名字会过 IPC。

本地验证：类型收窄由编译检查，范围含该批列出的调用方，不能只编 `universeAgentTypes.ts`。每批之后 `scripts/test.sh --grep "connectProfile uses unsupported_environment"` 与 `scripts/test.sh --grep "session view lease is empty"`，确认 Web 行为没被顺手改掉。改动的 ts 跑 `npx eslint`。

风险与回退：判别联合会让「`ok` 为布尔表达式的返回」和「先当成功再读只存在于一臂的字段」编译失败。这些调用方在对应那一批里改分支，不改运行时字段和字段名。回退是把该批接口和调用方一起改回 `ok: boolean`。

## 4. Web 哨兵

问题类：Web 不支持本机 Engine 这件事写在能力 `reason` 的中文句子里。桌面用字符串相等来识别并剥掉它。工作台把 `reason` 直接显示出来。

核实过的证据：

- `WEB_UNSUPPORTED_LOCAL_ENGINE_REASON` 在 `common/universeAgentRendererSync.ts` 26 行，值是 `Web 不支持本机 Engine 连接`，没有走 `nls`。
- 85–86 行 `capabilityEntryIsWebUnsupported` 用 `reason ===` 这个常量。93–100 行 `sanitizeDesktopCapabilitySnapshot` 据此把桌面快照里的哨兵换成 `UNKNOWN`。
- `browser/webUnsupported.ts` 14–24 行把同一句子放进错误；27–30 行放进能力条目。
- `engineSectionChrome.ts` 16 行又写了一份同样的中文字面量，29 行用它判断是否藏起桌面连接控件。同文件 41–42 行已经能凭 `phase.code === 'unsupported_environment'` 判断。54–56 行 `getUnsupportedEnvironmentCopy` 的 nls 源字符串已是 `"此环境不支持本机 Engine 连接"`（键 `ua.unsupportedLocalEngineEnvironment`）。用户看见的环境横幅走这个函数：`connectionPreferencesPane.ts` 531 行、`enginePreferencesPane.ts` 557 行。E2-1 把这句钉死：`connectionPreferencesPane.test.ts` 2088 行、`enginePreferencesPane.test.ts` 1167 行。
- `WEB_UNSUPPORTED_REASON`（`browser/webUnsupported.ts` 14 行）就是 `WEB_UNSUPPORTED_LOCAL_ENGINE_REASON`。22 行把它放进 `UniverseAgentUnsupportedEnvironmentError.message`，29 行放进能力 `reason`。`connectProfile` / `probeConnectionProfile` / `probeEngine` 的 `reason` 也是这个常量。浏览器测试 `src/vs/platform/universeAgent/test/browser/universeAgentConnection.test.ts` 56、62、78、101、112、121 行对照的是常量本身。
- 分区把 `entry.reason` 交给共享状态文案：`getCatalogUnsupportedCopy` / `getCatalogFailedCopy`（`engineCatalog.ts` 81–88 行、113 行起）把 reason 填进句子。`engineSkillsSection.ts` 787 行的 `renderStatus({ reason })` 走这条。Overview 另有直接显示：`resolveModelRow` 192 行把 reason 放进 title，341–342 行把 reason 放进 tooltip。`engineTriggersSection.ts` 529 行把 reason 放进按钮 title。
- 探测原因是另一套英文记号，不进本片翻译：`method not advertised` 与 `UNIMPLEMENTED` 在 `grpcCapabilityProbe.ts` 196、206 行，`probe status …` 在 213 行，`not probed` 在 `common/universeAgentCapabilities.ts` 8 行。

不变量：

- 桌面快照不得带上 Web 哨兵。空闲快照也不得带。
- `phase.code === 'unsupported_environment'` 继续表示环境不支持，不依赖能力句子。
- 不新增快照字段（待定项 1 已选 B）。

要动的符号与文件：见 S3。

改法（待定项 1 已选 B）：

1. 常量改为记号 `unsupported_environment`。比较和剥离认记号，不认中文句子，也不认本地化后的句子。`WEB_UNSUPPORTED_REASON` 与能力哨兵是同一个常量，所以 `connectProfile` / `probeConnectionProfile` / `probeEngine` 的 `reason`，以及 `UniverseAgentUnsupportedEnvironmentError.message`，一起变成记号。它们不再是中文句子，也不是界面那句英文。
2. `engineSectionChrome.ts` 删掉第二份中文字面量，改用这个常量。`phase.code` 判断保留。
3. 用户看见的环境横幅改 `getUnsupportedEnvironmentCopy` 的源字符串，与目录映射共用一句英文。源字符串为 `"This environment cannot connect to a local Engine."`，只保留一次 `nls.localize`（现有键 `ua.unsupportedLocalEngineEnvironment` 可以留着）。目录、Overview、Triggers 不再各写一句。
4. 显示映射放在 `engineCatalog.ts` 的一个函数里：记号换成 `getUnsupportedEnvironmentCopy()`，其它 reason 原样返回。`getCatalogUnsupportedCopy` 和 `getCatalogFailedCopy` 在把 reason 填进句子之前先过这个函数。因此各分区 `renderStatus({ reason: entry.reason })` 不用逐个改，包括 `engineProviderModelSection.ts`。Overview 的 `resolveModelRow` title、341 行 tooltip，以及 `engineTriggersSection.updateButtonCapabilityHover`，改为调用同一函数。
5. 协议面 Web 表里那句中文 reason 改成「记号 `unsupported_environment`，界面本地化」。这是行为变化：快照 `reason`、连接结果 `reason` 和错误 `message` 是记号；没有语言包时横幅、tooltip 和状态行显示上面那句英文源字符串。

明确不改什么：

- 探测失败的英文记号。不把 `UNIMPLEMENTED` 翻译掉。
- `support: 'UNSUPPORTED'` 单独不表示 Web。桌面未实现的方法也是 `UNSUPPORTED`。
- 不改 `UniverseAgentCapabilityEntry` 的字段集合。

本地验证：

- 更新 `desktop idle snapshot never uses the Web unsupported reason`、`sanitizeDesktopCapabilitySnapshot strips Web stub pollution`、`connection cache drops Web stub capability reasons from IPC snapshots`：剥离认记号。
- 更新两份 `E2-1`（`connectionPreferencesPane.test.ts` 的 `omits desktop controls and shows named copy`，`enginePreferencesPane.test.ts` 的 `omits Test Engine and shows named copy`）：控件仍省略；横幅 `textContent` 仍等于 `getUnsupportedEnvironmentCopy()`；该函数在没有语言包时等于 `"This environment cannot connect to a local Engine."`。快照和连接结果的 `reason` 是记号 `unsupported_environment`，横幅不显示记号，也不再期望 `"此环境不支持本机 Engine 连接"`。
- 浏览器测试 `universeAgentConnection.test.ts` 56、62、78、101、112、121 行继续对照 `WEB_UNSUPPORTED_REASON`。常量改成记号后，`error.message` 与 `result.reason` 的期望就是记号，不要改成英文句子。
- `scripts/test.sh --grep "sanitizeDesktopCapabilitySnapshot strips Web stub"`
- `scripts/test.sh --grep "E2-1: Web unsupported_environment"`
- 改动的 ts 跑 `npx eslint`。

风险与回退：漏调用映射函数的显示点会把记号直接画出来。共享文案函数盖住 `renderStatus` 那一路。回退是把常量改回中文句子。`engineOverviewSection.ts` 与 `engineTriggersSection.ts` 上的其它未提交改动必须留下。

## 5. 配对对话框与预设 / harness

问题类：第一次确认已经在 Connection 窗格完成，平台仍保留主进程对话框文案和注入。预设与 harness 导入是连接服务上的 node 能力，窗格同时直接引用 common 预设。

核实过的证据：

- 对话框文案的 `localize` 从连接服务 533 行到 597 行。519–521 行是 `pairingIdentityPrefix`，没有文案。SAS 字符串整理从 523 行到 529 行。构造器 719–720 行把 `confirmSas` / `confirmRecoverTrust` 接到 `options.dialogMainService`。缺对话框时 531–536 行抛 `Pairing confirmation dialog is not available`。
- `electron-main/universeAgentMainService.ts` 39–40 行注入 `IDialogMainService` 和 `IWindowsMainService`，64–82 行包 `showMessageBox`。无窗口时 reject，不把取消按钮的返回值当成用户取消。
- `pairingOrchestrator.ts` 331–339 行、484–490 行：`userConfirmed === true` 时不再调用对话框。
- 窗格 `connectionPreferencesPane.ts` 1897–1909 行：窗格内确认调用 `confirmPairing({ userConfirmed: true })`，取消走 `cancelPairing`。生产调用只有这一处。
- 预设与导入见待定项 2。`engine-catalog.md` 写明本地导入预览和云端预设不选择引擎 transport。

不变量：

- 用户看见的确认仍是窗格里的那一次。平台不再打开 `showMessageBox`。
- 不传 `userConfirmed` 时视为未批准，返回编排器现有的 `sas_cancelled` 或 `recover_cancelled`，不打开对话框。这是行为变化：以前省略标志会弹出主进程框。
- `pairingPending` 仍在现有快照上。不新增状态字段，不改 `confirmPairing` / `cancelPairing` 的方法名。
- 预设和 harness 本方案不搬（待定项 2 已选 A）。

要动的符号与文件：

- 删除连接服务里的 `askPairingMainDialog`、两份 confirm 文案、`PairingMainDialog`、选项上的 `dialogMainService`，以及 719–720 行的接线。这些是文件里仅有的 `localize` 调用，import 一并去掉。
- `UniverseAgentConnectionService`（electron-main 子类）去掉对话框和窗口服务参数。构造函数里剩下的依赖仍是服务参数。
- 编排器的 `confirmSas` 回调类型可以留着给测试注入。生产不再传入。

改法：

1. 生产确认只认 `userConfirmed: true`。回调缺省时维持编排器里已有的 `async () => false`。
2. 扫描测试 `pairing showMessageBox passes the focused or last active window` 改为断言 electron-main 子类源码不再出现 `showMessageBox`、`IDialogMainService`、`IWindowsMainService`。
3. 改写套件 `UniverseAgentConnectionService pairing main dialog`（`universeAgentConnection.test.ts` 17161 行起）。这些用例走 `productionPairingService`，经连接服务把对话框接进编排器。该文件在 D17 名单（`test/unit/electron/d17-ua-node-unloadable.json` 的 `universeAgentConnection`），整文件跑，不能 `--grep`。下面每条都要改写或删除，留下今天的期望会让这次规定测试失败：
   - `confirmSas asks the stubbed dialog and cancel is not approval`、`confirmSas treats only the first dialog button as approval`、`confirmRecoverTrust writes trust only when the stubbed dialog approves`：删掉。按钮文案和按钮序号不再属于平台。
   - `confirmSas without a dialog does not auto-approve`（17202 行）、`a thrown pairing dialog is not user cancellation`：删掉或改写。生产不再有「缺对话框就抛」和「对话框抛错」。改写时不 reject，`confirmSas` 得到 `sas_cancelled`。
   - `confirmRecoverTrust without a dialog does not auto-approve`（17252 行）：改写或删除。今天期望缺对话框就 reject。改完后不 reject，结果是 `recover_cancelled`，`trustPuts()` 仍为 0。
   - `confirmPairing without in-pane approval still opens the main dialog`（17264 行）：改写。这与「不传 `userConfirmed` 视为未批准」相反。改完后对话框调用次数为 0，不 reject，结果是 `sas_cancelled`。
   - `productionPairingService` 去掉 `dialogMainService` 参数，否则编不过。
   - `confirmPairing userConfirmed skips the main SAS dialog` 与 `confirmPairing userConfirmed writes recover trust without the main dialog` 保留，并改为不再构造对话框替身。
   - 17264 改写后即覆盖 SAS 的 `confirmPairing()` 不传 `userConfirmed`。若 recover 还没有对应的 `confirmPairing()` 用例，补一条：不传 `userConfirmed` 时得到 `recover_cancelled`，不 reject。
   编排器自己的测试若直接注入 `confirmSas` 回调，仍可覆盖「回调返回 false」。那不在连接服务里。

明确不改什么：

- 窗格文案和 `connectionPreferencesPaneSas.ts`。不把平台句子再搬一遍。
- `pairingGeneration`、trust 写入、`confirmPairing` 在 `grant_pending` 时留在配对的分支。
- `listProviderPresetCatalog`、`previewHarnessProviderImport`、`importHarnessProviders`、`builtinProviderPresets`。
- [ui-gap-closeout](ui-gap-closeout-2026-10-01.md) 里给对话框补窗口参数的那段，随本切片删除。窗格路径以 `a4b778cfd18` 为准。

本地验证：

- `node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts`（该文件在 D17 名单，Node 入口没有 `--grep`）。
- `scripts/test.sh --grep "pairing showMessageBox passes"`
- `scripts/test.sh --grep "SAS confirm calls confirmPairing once"`
- `scripts/test.sh --grep "recoverTrust confirm shows the in-pane prompt"`
- `scripts/test.sh --grep "pairing confirm completes inside Preferences modal block"`
- 改动的 ts 跑 `npx eslint`。

风险与回退：忘记传 `userConfirmed` 的新调用方会得到取消，而不是对话框。生产窗格已经传入。回退是恢复 main 服务的 `showMessageBox` 接线。

## 6. PostOutcome 与 Wire 重复

问题类：邮箱结果有两份类型，相关 id 的形状不同，reason 字面量相同。gRPC mapper 与 `*UnaryWire.ts` 有 27 个同名 `*Wire` 接口，嵌套名字不完全一样，不能一起删。Hub 的一个别名还在。

核实过的证据：

- `conversationViewFrame.ts` 286–291 行：`correlation: { id: string }`，reason 为 `mailbox_full` | `no_such_session` | `not_authenticated` | `chat_stream_closed`。
- `node/sessionCore/messages.ts` 9 行 `CorrelationRef` 是品牌字符串；98–103 行 `PostOutcome` 用这个品牌，reason 四个字面量与上面相同。`sessionCore/SYNC.md` 写明不得手改，要上游再同步。
- `sessionViewHost.ts` 515–519 行把核心的 `correlation` 转成 `{ id }`。
- 同名接口 27 个，分布在 `grpcClientMappersSession.ts` 与 `grpcClientMappersCatalog.ts`，各自又在某个 `*UnaryWire.ts` 里出现。例子：`UsageResponseWire` 在 mapper 534 行和 `grpcUsageUnaryWire.ts` 46 行。`GetRemoteSessionStatusResponseWire` 在 mapper 1751 行用 `RemotePendingPermissionWire`，在 `grpcGetRemoteSessionStatusUnaryWire.ts` 24–31 行用 `RemotePendingPermissionJsonWire`。
- `grpcUsageUnaryWire.ts` 7–19 行已经从 mapper 引入部分嵌套类型，同时又自己声明 `AgentUsageWire`（33 行）。mapper 405 行也有 `AgentUsageWire`。mapper 今天不引用 `*UnaryWire.ts`。若让 mapper 再引用 unary 文件，而 unary 文件仍引用 mapper，两个文件会成环。
- `common/hub.ts` 54 行 `HubDirectAddressResult` 仍是 `HubProfileResult` 的别名。111–116 行与 117–121 行是两份相同参数的 `addHubDeviceProfile`，第二份返回这个别名。工作区没有未提交的 `hub.ts` 改动。全仓只有这两处用到该别名。

不变量：

- 不手改 `sessionCore/**`。两份 `PostOutcome` 的 reason 字面量保持一致。`correlation` 不要求同型；宿主边界转换保留。
- 每个 RPC 最终只留一份 Wire 类型，放在对应的 `*UnaryWire.ts`。mapper 引用那一份。嵌套名不同的 RPC 不删。
- 不改解码字段号，不改 `mapUsageResponse` 的输出形状。

要动的符号与文件：见改法。别名切片动 `hub.ts`，并加一条不进 D17 的类型断言测试。

改法：

1. 别名：删除第二份 `addHubDeviceProfile` 和 `HubDirectAddressResult`。返回类型仍是 `HubProfileResult`。若实施时这两处已经不在，跳过。行为不变。
2. 在 `test/node` 新增一份不进 D17 名单的测试，用类型断言锁住两份 `PostOutcome` 的 reason 联合相等。不要断言 `correlation` 同型。不要 import 进 renderer 的 `common` 文件去引用 `sessionCore`。
3. Wire 按 RPC 迁移，一片一个提交。`AgentUsageWire` 不能当第一片：`grpcUsageUnaryWire.ts` 7–19 行仍从 mapper 引入 `AgentUsageDetailWire`、`CacheInfoWire`、`CompactInfoWire`、`ContextWindowInfoWire`、`FixedOverheadInfoWire`、`MessageBreakdownInfoWire`、`ModelUsageWire`、`ProfileUsageWire`、`RecentRequestSpanWire`、`SessionUsageInfoWire`、`SystemPromptPartInfoWire`，33 行又自己声明 `AgentUsageWire`。mapper 一引用这份 unary，而 unary 仍引用 mapper，两个文件成环。先搬这一组 unary 已经从 mapper 引入的类型：声明改放到 `grpcUsageUnaryWire.ts`，mapper 改为从 unary 引用，unary 删掉对 mapper 的这些 import。`grpcClientMappers.ts` 若经 `export *` 转出这些名字，mapper 再从 unary 转出。搬完后 unary 不得再 import mapper。某一型双向 `extends` 失败，或一搬就成环，则停在断言，不删 mapper 副本。
4. `AgentUsageWire` 放在上一步之后，此时 unary 不再引用 mapper。先写双向 `extends` 断言；断言失败或仍会成环就停，留下 mapper 405 行那份，禁止 `as` 强转。断言通过才让 mapper 改为从 unary 引用，并删 mapper 副本。
5. `UsageResponseWire` 放在 `AgentUsageWire` 之后。先写双向 `extends` 断言；断言失败就停，留下字段差，禁止 `as` 强转。断言通过才让 `mapUsageResponse` 使用 unary 文件里的接口，并删 mapper 534 行那份。若一搬就和仍在的反向 import 成环，本片停在断言，不删副本。
6. `GetRemoteSessionStatusResponseWire` 这类嵌套名不同的，不进批量删除。要迁时单独一片，把嵌套类型改成同一名字后再删 mapper 副本。

明确不改什么：

- `sessionViewHost.ts` 515–519 行的转换。
- 其余 25 个同名接口，直到各自那一片证明可赋值。
- 条目 1 的通道和类结构。

本地验证：

- 别名片：`npx eslint src/vs/platform/universeAgent/common/hub.ts`，并且类型编译要能过。两份 `addHubDeviceProfile` 都留下时这两项仍过：参数相同，`HubDirectAddressResult` 展开后就是 `HubProfileResult`，只断言返回类型也会过。在不进 D17 的测试里加一条会在两份都留下时失败的检查：读 `hub.ts`，`addHubDeviceProfile` 的方法声明只有一处，文件里不再出现 `HubDirectAddressResult`；再用类型断言把剩下的那一份收成 `(input: { readonly hubDeviceId: string; readonly displayName?: string }) => Promise<HubProfileResult>`。
- reason 断言：`scripts/test.sh --run src/vs/platform/universeAgent/test/node/postOutcomeMirror.test.ts`（文件名以实施时为准；不要写进 D17 名单）。
- Usage 片：`scripts/test.sh --grep "decodeUsageResponse reads"`（`grpcUsageUnaryWire.test.ts` 不在 D17 名单）。
- 每个 RPC 片跑它已经有的 `*UnaryWire.test.ts`。没有测试的 RPC 不靠新行为测试充数，至少 `npx eslint` 加该文件能被现有编译任务编过。

风险与回退：互相引用会把编译环带进 mapper。回退是恢复 mapper 里的接口副本。别名片没有运行时变化，回退是把别名和重载加回去。

## 审查

2026-11-04 只读审查的结论是须改稿。Critical 无。Important 已改：S1 写明失败绑定不再由下一次快照重试，并补测试；S2 改写整组 `pairing main dialog`，不只改一条 `confirmPairing()`；S3 的显示映射放进 `getCatalogUnsupportedCopy` / `getCatalogFailedCopy`，并点名 Overview 与 Triggers 的旁路；目录代次表不再把 r04 尚未落地的条件收尾写成活码不变量。Minor 已改：Web 能力条目行号、对话框 `localize` 起点、`disconnect` 与目录 reject 的分界、`message?` 结果上的其它字段、窗格回归测试名。类结束行仍是 3625，审查说的 3626 与当前文件不符。

## 审查处理

本轮对照活码改稿。`status` 仍是 `draft`。待定项 1、2 未代选。

| 意见 | 处理 | 原因 |
|:-----|:-----|:-----|
| Critical：无 | 采纳 | 核验没有新的 Critical |
| Important 1：S2 对话框套件漏 `confirmRecoverTrust without a dialog does not auto-approve`（17252）和 `confirmPairing without in-pane approval still opens the main dialog`（17264） | 采纳 | 两处都在 `universeAgentConnection.test.ts`。17252 今天 `assert.rejects`，期望缺对话框。17264 今天期望仍打开主进程框，与本稿「不传 `userConfirmed` 则 `sas_cancelled`、不打开框」相反。该文件在 D17 名单，整文件跑。改法已把两条写进改写名单：改完后不 reject，分别是 `recover_cancelled` 与 `sas_cancelled` |
| Important 2：S3 横幅文案与 E2-1 对不上，共享常量会把错误 `message` 和连接 `reason` 一起变成记号 | 采纳 | `getUnsupportedEnvironmentCopy`（`engineSectionChrome.ts` 54–56）源字符串已是 `"此环境不支持本机 Engine 连接"`。E2-1 钉在 `connectionPreferencesPane.test.ts` 2088 与 `enginePreferencesPane.test.ts` 1167。`WEB_UNSUPPORTED_REASON` 与能力哨兵是同一个常量（`webUnsupported.ts` 14、22、29）。改法改为：横幅改这一句英文源字符串并与目录映射共用；`reason` 和错误 `message` 变成记号 `unsupported_environment`；两份 E2-1 期望这句英文；浏览器测试 56、62、78、101、112、121 行继续对照常量，期望是记号 |
| Important 3：S4 把 `AgentUsageWire` 当第一片会成环 | 采纳 | `grpcUsageUnaryWire.ts` 7–19 行从 mapper 引入 11 个嵌套类型，33 行自己声明 `AgentUsageWire`。先搬那 11 个，unary 不再引用 mapper 之后才搬 `AgentUsageWire`。断言失败或成环则停，不删副本。`UsageResponseWire` 仍在其后，并保留同样的停步 |
| Important 4：S5 只改 `universeAgentTypes.ts` 时调用方编不过，不能单独提交 | 采纳 | 活码里多处用布尔表达式填 `ok`（如 `mapShelveSessionResponse`、`pauseAgent`、`decodeSyncPermissionRuleResponse`、`decodeSaveSkillContentResponse`）。判别联合不能接受 `ok: boolean`。三批都写进对应构造点；调用方只拆 `ok: true` / `ok: false` 分支，或先按 `ok` 再读字段。字段名和运行时值不动 |
| Minor：概览若写「入口保持」会比 r04 正文更窄 | 采纳 | r04 签收摘要写入口递增保持不变；正文 92 行仍写入口那次递增若会作废另一个 Hub 已开始的 `refreshDirectory` 就不要无条件做。本稿不改 `logout`。代次表和概览的 logout 一行只写「收尾条件以 r04 为准，活码尚未落地」 |
| Minor：519–529 行不全是 SAS 字符串整理 | 采纳 | 519–521 行是 `pairingIdentityPrefix`，没有文案。SAS 整理从 523 行起 |
| Minor：别名片只跑 eslint，两份 `addHubDeviceProfile` 都留下时仍过 | 采纳 | 两份参数相同，别名展开后返回类型仍是 `HubProfileResult`。验证改为：方法声明只有一处，文件不再出现 `HubDirectAddressResult`，剩下的签名返回 `Promise<HubProfileResult>` |
| Strengths 中的行号与计数 | 采纳为仍成立 | 抽查与审查一致：类 612–3625、`implements` 三个接口、`app.ts` 1239 与 1414–1419、代次自增点、`readonly ok: boolean` 的分组、`HubDirectAddressResult` 只在 `hub.ts`、同名 Wire 的前提未发现反例。未发现新 RPC。待定项不代选 |
| Assessment：须改稿后再签 | 采纳 | 上面四条 Important 已写入切片。本稿仍是草案 |
