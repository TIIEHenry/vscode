---
title: "删除连接服务的旧明文 connect()"
type: plan
status: draft
phase: M7
updated: 2026-10-05
summary: "ELR-14：从连接服务和窗口契约去掉明文 connect()，并删掉只为它服务的 127.0.0.1:50051 回环打开路径。窗口命令名 connect 仍拒绝。测试改走无信任的明文 profile 拨号，或本机跳过鉴权。不改身份合同。不升 PRD。"
---

# 删除连接服务的旧明文 connect()

> **slice_id**：`remove-legacy-plaintext-connect`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) ELR-14。
> **本稿是方案，未签收。** 没有独立只读审查子 agent；自审见文末，因此 frontmatter 保持 `draft`。
> **基线**：HEAD `901066fb913`。行号以此为准。以 `node/`、`common/`、`browser/`、`test/` 开头的路径在 `src/vs/platform/universeAgent/` 下。
> **冲突域**：`node/universeAgentConnectionService.ts` 的 `connect()`、`_openLoopbackTransport`、`_loopbackAddress`、`_keepTransportLostOnConnect`、`loopbackAddress` 选项；`common/universeAgentConnection.ts` 的 `connect`；`browser/universeAgentConnectionService.ts` 的同名桩；`common/universeAgentConnectionIpcChannel.ts` 只许改注释，**不许**把 `connect` 放进转发白名单；`test/node/universeAgentConnection.test.ts`、`test/node/connectionIpcSecretBoundary.test.ts`、`test/browser/universeAgentConnection.test.ts`。
> **不改**：`node/grpc/grpcClient.ts` 与 `node/grpc/grpcTransport.ts` 的 `connect(request)`（这是 RPC）；`createTransport` 选项（明文 profile 拨号和探针仍用它，地址来自 resolver，不是写死的回环）；本机发现、`_connectLocalSkipAuth`、home 锚；`listFilesCapability`、`conversationEntryCapability`、`gitWriteCapability` 的合同；roster 分桶；Preview；ADR-003；按窗口连接；ELR-10/11 的本机锚。不升 PRD。

## Problem class

- **症状：** 连接服务上还留着一条明文、写死地址、生产无人调用的 `connect()`。本机自动连接已经走 home 锚之后，它是第二条行为不同的回环路径。
- **类标签：** **死掉的服务入口** + **指针非空就复用当前 transport 的回环打开**。
- **复发机制：** 测试把 `service.connect({ clientId, protocolVersion })` 当成「给我一条已连接的 mock」。方法若留成测试专用入口，窗口契约和 IPC 拒绝名单会再次分叉。

## 0. 一句话结论

删掉 `UniverseAgentConnectionService.connect()` 和 `IUniverseAgentConnection.connect`。只为这条入口服务的明文回环打开（默认 `127.0.0.1:50051`、不 pin、`_transport` 非空就直接交还）一并删掉。窗口即使接口上已经没有这个方法，收到命令名 `connect` 仍然拒绝。需要一条已连接 mock 的测试改走**没有信任记录的明文 `connectProfile`**；必须保持「没有 active profile」或「活链路不经过这次探针所用的 resolver」的测试改走已经落地的本机跳过鉴权拨号。不改 `engineIdentityId` / `linkId` 的提交规则。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `connect()` 捕获当前 epoch，按请求里的 `workDir` 写 `_sharedFsRootSent`，发布 `connecting`，经 `_openLoopbackTransport` 取 transport，再 `transport.connect(request)`。没有 `sessionToken` 或拨号失配就放弃、不提交。有 token 则探针后 `_applyConnectedCommit`（`profileId: undefined`、`skipAuth: false`、`path: 'loopback'`、不传 `engineIdentityId`） | `node/universeAgentConnectionService.ts` L820-903 |
| `_openLoopbackTransport`：`_transport` 非空就复用；否则 `loadGrpcModule()` 后 `_createTransport(this._loopbackAddress)`。默认地址 `127.0.0.1:50051`，不 pin | L2422-2428；选项与字段 L433、L645、L661 |
| `_loopbackAddress` / `loopbackAddress` 只有这条路径读。全仓没有别的 `loopbackAddress` 赋值 | 同上；`rg loopbackAddress` 只命中本文件 |
| `_createTransport` **不是**这条路径专有。`!endpoint.tls` 的 profile 拨号用 resolver 给出的地址创建明文 transport（L1012-1013）；`_probeResolvedEndpoint` 在没有 tls 时同样用它（L3278-3287）。删掉选项会拆掉明文 profile 与探针 | L646、L662、L1013、L3287 |
| `_keepTransportLostOnConnect` 只被 `connect()` 调用 | L825、L896、L2735-2738 |
| `_sharedFsRootSent = true` 只发生在 `connect()` 读到请求里的 `workDir`。profile 拨号和本机拨号都不写这个旗。夹具请求不带 `workDir`，所以夹具快照今天就是 `false` | L822；清旗在 `disconnect` L1400 |
| 本机自动连接走 `findLocalEngine` + `openLocalEngineTransport` + `connectWithoutDeviceAuth`，再进 `_applyConnectedCommit`。不读 `_loopbackAddress`，不调用 `_openLoopbackTransport` | L2539-2634 |
| 明文 profile 提交带 `profileId`，`engineIdentityId` 只来自 `connectionProfileStore.get(profileId)?.trust?.engineIdentityId`。没有 store 或没有 trust 就不带身份。`linkId` 由 `_publishCommittedLink` 在每次换链路时分配，旧 `connect()` 提交同样会分配 | L1114-1130、L2842-2856 |
| 窗口契约仍声明 `connect(request)`。Web 桩实现它并返回空 methods | `common/universeAgentConnection.ts` L438；`browser/universeAgentConnectionService.ts` L150-152 |
| IPC 拒绝名单里的 `connect: true` 是命令名，不是从接口键推导出来的。`DeniedConnectionCall` 含字面量 `'connect'`。单测断言命令 `connect` 不转发 | `common/universeAgentConnectionIpcChannel.ts` L28-29、L59-60；`test/node/universeAgentConnectionIpcChannel.test.ts` |
| 生产代码里没有第二个 `UniverseAgentConnectionService.connect` 调用方。`rg '.connect({ clientId'` 只落在三份测试：`universeAgentConnection.test.ts` 的 `service.connect(` 200 处、`hidden.connect(` 1 处；IPC 秘密边界 1 处；Web 桩 1 处。审查文「198 处」作废 | 开工时 `rg` |
| 传输层 `async connect(request: UniverseAgentConnectRequest)` 是 Connect RPC，mock 与 `grpcClient` 都要实现。不在删除范围 | `node/grpc/grpcClient.ts` L1166；`test/node/universeAgentConnection.test.ts` 的 `MockUniverseAgentGrpcTransport.connect` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 删服务方法与回环打开；夹具改走无信任的明文 profile，少数不变量改走本机拨号** | 见 §3 | **选定** |
| B 把 `connect()` 留成测试专用、只从接口和 IPC 拿掉 | 生产死路径还在，指针复用也在；下一次窗口白名单核对会把它当成漏网方法 | **拒绝** |
| C 所有夹具都改走本机跳过鉴权 | 本机路径会 `installSessionToken` 并武装链路订阅；旧 `connect()` 和明文 `_dialPlain` 都不会。夹具若突然开始响应 token 拒绝，断言会漂 | **拒绝**作为默认夹具；只用于必须没有 active profile、或活链路不能走该测试自己的 resolver 的用例 |
| D 恢复固定端口扫描，让夹具继续「连 50051」 | 本机锚已落地，父任务禁止 | **拒绝** |

## 3. 选定设计（A）

1. **S1 删入口，不删明文 profile 传输工厂。**
   - 删除 `connect()`、`_openLoopbackTransport`、`_loopbackAddress`、`_keepTransportLostOnConnect`、选项 `loopbackAddress`。
   - `createTransport` 与默认 `createGrpcUniverseAgentClient` 留下。它的地址只来自 resolver 的 `resolvedIp` + `port`，或探针的同一地址。
   - 从 `IUniverseAgentConnection` 和 `WebUniverseAgentConnection` 去掉 `connect`。Web 上「`connect()` 不抛、没有 token」的用例删掉，不改写成另一种空返回。
   - `DENIED_CONNECTION_CALLS.connect` 与 `DeniedConnectionCall` 的 `'connect'` 保留。拒绝发生在内层通道之前。不把这个名字写进 `FORWARDED_CONNECTION_CALLS`。

2. **S2 夹具改拨号，不留半个 `connect()`。**
   - 测试文件增加 `connectPlainFixture(service)`：对固定 profile id 调用 `connectProfile`。resolver 返回 `tls: null` 的 direct 终点；身份 store 就绪；**不**放入带 trust 的 profile store。因此快照可以有 `linkId`（任何提交都有），没有 `engineIdentityId`。这与旧 `connect()` 的身份结果相同，不改 `_publishCommittedLink`。
   - 只给「今天没有 `connectionResolver`、并且调用了旧 `connect()`」的构造补上这对 resolver / identity。已经自带 resolver 的用例不要覆盖。
   - 下列用例**不**走这只夹具：
     - `getAuthNonce success leaves phase and live transport unchanged` 与 `probe does not write transport or phase…`：活链路必须是 `createTransport` 在探针地址之外交回的那只 transport。改为 `autoConnectLocalEngine` + `openLocalEngineTransport` 交回那只 transport，探针仍走原来的 resolver。
     - `no active profile does not schedule reconnect`：断言的是没有 `_activeProfileId` 时传输失败不排重连。`connectProfile` 会写上 profile。改为本机跳过鉴权，提交后仍然没有 profile。
   - 删掉四则只锁旧 `connect()` 的 D420：`direct connect() _createTransport throw` 在有 profile、无 profile、`pairingPending`、用户 disconnect 之后是否排重连。这条打开路径删除后，这些断言不再有主语。profile 拨号自己的 `createTransport` 失败仍由 `_connectProfileRaw` 处理，不在本稿补新用例。
   - `idle connect broadcasts the connecting phase on the snapshot (ELR-9)` 改成明文 profile 拨号：在 `transport.connect` 里挡住，断言快照相位已是 `connecting` / `initial`，放开后提交为 `connected`。不再要求「调用返回前同步发出」，那是旧方法第一行的时序。
   - `profile plaintext dial does not call connect()` 去掉对 `service.connect` 的包裹。留下「打开一只 transport、探针次数大于 0、提交后通道仍活」——这是明文 profile 拨号的不变量，不是旧方法的不变量。
   - IPC 秘密边界里那次 `service.connect` 改成与同文件下一则相同的 `connectProfile`。断言仍是快照有 `authenticated`、没有 `sessionToken` 字段、JSON 不含密文。

3. **不改身份合同。**
   - 不调整 `_applyConnectedCommit` / `_publishCommittedLink` 的字段。
   - 有 trust 的 profile 拨号继续把 `engineIdentityId` 放进快照。夹具故意不用 trust，避免为了迁测试把身份抹掉。

## 4. 不变量

- `UniverseAgentConnectionService` 上不再有 `connect(`。`IUniverseAgentGrpcTransport.connect(request)` 与 `GrpcUniverseAgentClient.connect` / `connectWithoutDeviceAuth` 仍在。
- 窗口通道对命令名 `connect` 抛 `Method not found`，不转发。
- 没有 `127.0.0.1:50051` 的服务默认地址，也没有「指针非空就复用当前 transport」的打开函数。
- 本机自动连接仍只通过注入的 `findLocalEngine` / `openLocalEngineTransport`（生产是 home 锚）。本稿不改这两个函数的生产默认值。
- 无 trust 的明文 profile 提交：`authenticated === !!sessionToken`，快照没有 `engineIdentityId`，有 `linkId`，`_activeProfileId` 为该 profile。
- 本机跳过鉴权提交：没有 `_activeProfileId`，路径 `loopback`，身份规则与今天的 `_connectLocalSkipAuth` 相同。

## 5. 切片

S1 与 S2 同一代码提交。S1 单独留下会让现有单测无法编译，不能拆开落地。

| Slice | Goal | Files | Exit |
|:------|:-----|:------|:-----|
| **S1** | 删服务方法、回环打开、契约与 Web 桩；IPC 继续拒绝命令名 | 服务、`common/universeAgentConnection.ts`、Web 桩、IPC 注释 | `rg` 生产代码没有 `UniverseAgentConnectionService` 的 `.connect(`；拒绝名单仍有 `connect` |
| **S2** | 测试迁到明文 profile 或本机拨号；删只锁旧方法的用例 | 三份测试 | 改过的连接单测与 IPC 边界单测通过；没有半个 `connect()` 留在服务上 |

## 6. 与已签收方案的接缝

- **connection-dial-generation S3。** 已签收稿建议删掉公开 `connect()` 和没有调用方的 `!tls` 分支。本稿只删公开 `connect()` 和写死回环打开。`!tls` 的 `_dialPlain` 仍是明文 profile 的生产路径，测试和 IPC 秘密边界都还在用。不改那份已签收正文。
- **connection-ipc-allowlist。** 那份稿把 `connect()` 留在 node、只退出窗口。本稿接在它后面删 node 方法。拒绝名单不收回。
- **loopback-link-commit / local-engine-trust-anchor。** 本机提交闸和 home 锚不动。
- **published-link-identity。** 身份与 `linkId` 的合同不动。旧 `connect()` 本来不写身份；迁到无 trust 的 profile 之后仍然不写。

## 7. 不做

- 改能力探测合同、roster 分桶、Preview、ADR-003、按窗口一条连接。
- 重做本机锚或固定端口扫描。
- 删 `createTransport`、`_dialPlain`、传输层 `connect(request)`。
- 为 D420 的四则旧用例在 profile 路径上另写一套。
- 升 PRD。改 `status.md`、`deferred-gaps.md`、`dev/loop/**`、协议表面文档。

## 8. 验证

- `rg` 生产与测试：`UniverseAgentConnectionService` 不再出现 `.connect(`。传输层与 mock 的 `connect(request)` 除外。
- 连接单测与 IPC 边界单测（实现时写明命令）。
- 编译只有一路：槽 A `flock /tmp/vscode-loop-compile.lock npm run compile-client`。锁被占用则不抢，输出写明编译进行中。

## 9. 自审

没有第二个只读审查子 agent。下面是对照 HEAD `901066fb913` 的自审，Critical / Important 已写进 §1 与 §3，因此本稿保持 `draft`，不算签收。

- **Strengths：** 把「服务方法」和「传输工厂」分开；夹具默认走与旧提交最接近的明文 `_dialPlain`（不武装链路订阅）；身份合同不为测试让路。
- **Critical：** 无。曾误以为 `createTransport` 只服务旧 `connect()`。HEAD 上 profile 明文拨号和探针也用它，方案已拒绝连它一起删。
- **Important：** `connectProfile` 会写 `_activeProfileId`，不能拿来顶「没有 profile 就不重连」。探针用例的活链路若改走同一个 resolver，`createTransport` 的地址分支会把探针 transport 当成活链路。这两类已改走本机拨号。
- **Minor：** ELR-9 不再锁「调用返回前同步发相位」。相位进快照的不变量仍在，时序改到 `transport.connect` 在飞的窗口。
- **Assessment：** 可以按本稿实施。未签收。不宣布引擎链接审查全部完成。
