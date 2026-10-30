---
title: "会话订阅生命周期：lease 所有权回收、流级重开与 bind 有界化"
type: plan
status: accepted
phase: M7
updated: 2026-10-28
summary: "S1–S5 代码已落并有定向回归；S5 支持溢出后的同连接、重 acquire 与重连 recovery。D405 真实窗口/引擎手测仍未完成，不升 implemented。"
---

# 会话订阅生命周期
状态：执行中。
覆盖需求：PRD-007。


> **触发：** 2026-09-10 对订阅链路（`IConversationSessionViewLease` → IPC `IUniverseAgentSessionView` → `SessionViewHost` → session-core `SessionActor` → gRPC `SessionEventStream` / `Chat`）的只读审查，三条结构性结论：① 宿主 lease 只能靠渲染端显式 `releaseLease` 释放；② 流级关闭后没有任何重开路径；③ gRPC 无 deadline、渲染端 bind 一次性失败即终生失效。审查其余项（同窗多 lease / 死 ack / 按 lease 广播连接事件 / 宿主状态无回收）**不在本稿**，另立切片。  
> **基线：** 本稿相对 `agent-ide` HEAD `ad9245ca178`。  
> **不推翻：** [ADR-003](../decisions/003-engine-adapter-boundary.md)（`contrib/**` 禁 import `platform/universeAgent/node/**`）；[session-view-frame-fanout](session-view-frame-fanout.md) F1/F2（per-lease 动态事件、首帧缓冲、`postAndDrain` 唯一入口、`hadSubscriber` 闩）；[conversation-stream-timeline §3](conversation-stream-timeline.md)（lease 是显示写源、末 lease 释放后 linger）；**vendored `node/sessionCore/**` 不手改**（[giant-file-split](giant-file-split.md) GFS-4 PIN）；`IUniverseAgentSessionView` 方法集（`acquireLease` / `whenEngineSessionReady` / `releaseLease` / `post` / `requestResync` / `acknowledge` / `requestDetail` + 事件 `onDynamicDidApplyFrame`）**不增不减**（基线已有 `whenEngineSessionReady`，本稿未改 interface 文件）。  
> **槽位：** 平台合同与宿主，归 **P 槽**；S3 渲染端一刀只改 `conversationEngineFrameSource.ts`。  
> **审查记录：** 见文末（规则 16）。

## 实施现状（2026-09-20 回填）

**S1 / S2 / S3a / S3b 代码已落**，四刀一次性合入 `b2211b23fa5`（2026-09-12，「补会话订阅生命周期」），类型修补 `3c07195f6bf`；合入 merge 的提交是 `9f8ca6a236d`（含该 feature）。§7 知识层回填已随实施 commit；本稿自身已入 git（`e460de220e1`，2026-09-14）。§4 单元 Exit 全绿（含 `sessionViewHostReopen.test.ts` / `grpcUnaryDeadline.test.ts` / `universeAgentSessionViewChannel.test.ts`）。**S4a 代码已合入 merge**：electron-main 注入 `createSessionViewDiagnosticsPort(logService)`，生产 `count` 落主进程 `log.info`。**S4b 代码已合入 merge**（`streamReopenSkipReason` 含 `fail_closed`，宿主自记 `mailbox.overflow`）。**2026-09-20 闩修：** `failClosedSessions.clear()` 只走连接 **down** 分支；仍-connected snapshot（generation +1 / `bringUpBoundSession`）不清闩、不取消武装定时器。当时回归测为 snapshot 保持闩；2026-10-27 已由 `still-connected snapshot preserves the armed recovery timer` 取代。**2026-10-07 回填：** G-CORE-2 的第二选项（不开流时不刷 live）已由 `37a13e74d7b` 直接落在 vendored `session-actor.ts` `onConnectionUp`（`allowOpen === false` 不改 `snapshot.sync`、不广播 live、末行仍清 `subscriptionFailed`）。这是对 vendored 文件的本地改动，未见 `SYNC.md` 登记，下次从 Desktop 同步会被盖掉；上游是否已有同样不变量待核。2026-09-14 规则 16 回溯审查已做并改稿；2026-09-20 再审对照当时 HEAD `434ad999580`，当轮已改方案并落地闩修。

**2026-10-27：S5 已实施。** 溢出会取消普通 S2 定时器并武装 recovery；同连接到期、重新 acquire 与断连重连都可补投 `connectionUp`。恢复计时绑定具体 attempt，存活不足 30 秒不归零。`sessionViewHostReopen.test.ts` 17 项通过，覆盖同连接、重 acquire、重连、二次溢出、同步开流异常、一次 Up 和退避边界。相邻 EngineBind 26、Actor 14、ChatClose 12 项通过。

**2026-10-28 当前自动层复核：** 固定58972组合源码fresh后，四Node suite实际reopen16、EngineBind25、ActorLoop6、ChatClose11，共58 passing；八订阅TS定向语义/lint无诊断。见[本轮证据](../progress/session-closeout-2026-10-28-evidence/README.md#最终组合树验证2026-10-28)。上段数量保留为历史摘要，D405 / V-S5真实窗口与引擎手测仍open；本稿整体保持accepted，不提升真实运行验收。

| 未闭 | 性质 |
|------|------|
| ~~**BH-04-1** 断连清闩后再重连，`allowOpen === false` 仍画成已连接~~ | **Actor 侧已闭（`37a13e74d7b`，2026-09-29）。** 回归测 `sessionActorReconnectHistoryRegen.test.ts` 锁住：溢出 → down → up 后不开流、不画 live、条幅停在 `closed/connection_down` |
| ~~**BH-04-1 衍生：溢出后无自动恢复** | **S5 代码与自动回归已闭（2026-10-27）。** 同连接不再依赖第二次连接翻转；末 lease 后再 acquire 会重新武装 recovery。真实引擎手测仍列下一行，不以单测代替 |
| **§5 手测** V-S1–V-S3 / V-S4b-1 一次未跑（[D405](../progress/deferred-gaps.md) 仍 open） | 升 `implemented` 的门槛；S5 的 V-S5-1–V-S5-3 同待实跑 |

**S4b 闩 vs 仍-connected snapshot：** 2026-09-20 的「停止 reopen 直至 acquire/down」是历史合同。2026-10-27 起，溢出会取消普通 S2 并改武装 recovery；仍-connected snapshot 不取消 recovery，到期开流后可合法回 live。

**§1 行号是基线 `ad9245ca178` 的锚点，HEAD `434ad999580` 相对该基线已漂移 1649 提交**，读表时按符号名定位，勿按行号。被 S1–S3 自己改掉的行已就地标注「**已落地**」。

## 0. 一句话结论

给订阅生命周期补上**宿主侧权威**：lease 记 owner，IPC 连接移除 / 窗口销毁时由宿主批量回收（S1）；SessionEventStream 被远端 / 错误关闭后，宿主在「连接仍 up 且仍有 lease」条件下按指数退避重新 post `connectionUp` 让 Actor 开新 attempt（S2，同时登记上游缺口 G-CORE-2）；gRPC unary 加默认 deadline、渲染端 lease 的 bind 从「构造时一次性」改为「失败可重试」，`post()` 不再无限等待（S3）。

## 1. HEAD 事实

### 1.1 lease 释放只有一条路

| 事实 | 位置 |
|------|------|
| `releaseLease(leaseId)` 是唯一释放入口；`ActiveLease` 无 owner 字段 —— **已落地**：HEAD `ActiveLease.owner?: string`，另有 `releaseLeasesOwnedBy` | `node/sessionViewHost.ts`（HEAD：`acquireLease` L275 / `releaseLease` L308 / `releaseLeasesOwnedBy` L328） |
| orphan 定时器只在 `hadSubscriber === false` 时回收；首个订阅者到来即闩为 true，永不回退 | 同上 L784–815；`test/node/sessionViewHostFanout.test.ts` `unsubscribe after subscribe does not trigger orphan release` 把此锁成合同 |
| 渲染端断连时 `ChannelServer.dispose()` 只 dispose 事件监听器；`ProxyChannel.fromService` 的 `call(_, …)` / `listen(_, …)` **丢弃 ctx**；宿主无任何客户端断连钩子 | `base/parts/ipc/common/ipc.ts` L522–529 · L1170–1216 |
| `IPCServer` 有 `onDidRemoveConnection: Event<Connection<TContext>>`，`connection.ctx` 为客户端 hello 时上送的上下文 | `ipc.ts` L836 · L853–871 |
| 主进程 Electron IPC 客户端的 ctx 字面量为 `` `window:${windowId}` `` | `platform/ipc/electron-browser/mainProcessService.ts` L25 |
| Electron `Server` 的 `onDidClientDisconnect` = `vscode:disconnect` 消息 **或** 同 webContents 再次 hello（reload）；渲染进程崩溃 / 窗口被销毁而未 unload 时**不触发** | `base/parts/ipc/electron-main/ipc.electron.ts` L33–60 |
| `IWindowsMainService.onDidDestroyWindow: Event<ICodeWindow>` 可用；`app.ts` `initChannels` 内 `accessor.get(IWindowsMainService)` 已有先例 | `platform/windows/electron-main/windows.ts` L37 · `code/electron-main/app.ts` L1383 |
| `universeAgentSessionView` 通道以 `ProxyChannel.fromService` 注册 | `app.ts` L1401–1402 |
| 渲染端 `EngineSessionViewLease.dispose` 用 `void releaseLease().catch(() => undefined)`；正常关窗依赖 unload 阶段该消息仍能送达 | `contrib/conversation/browser/conversationEngineFrameSource.ts` L120–123 |

**后果：** 渲染进程崩溃、`render-process-gone` 后关窗、或 unload 期间 IPC 已断，lease 永久留在宿主：Actor `leases.size > 0` 永不 `startLinger` → 该会话 SessionEventStream + 常驻 Chat bidi 永久占用；帧不断入 `pending`，每 64 帧 `view.pending_overflow` 一次；`leaseAttribution` / `leaseDetails` 同步泄漏。

### 1.2 流级关闭无重开

| 事实 | 位置 |
|------|------|
| Actor `onStreamClosed(remote/error)`：`currentAttemptId = null`、`sync: closed(reason)`、emit `closeStream`；**不**再 `openAttempt` | `node/sessionCore/session-actor-stream-fold.ts` L696–715 |
| Actor 只在 `onConnectionUp`（`leases.size > 0 && currentAttemptId === null && !subscriptionFailed`）与 `onAcquireLease`（`connectionUp && currentAttemptId === null && !subscriptionFailed`）两处 `openAttempt` | `session-actor.ts` L407–424 · L477–503 |
| 上游 Desktop `packages/session-core/src/session-actor.ts` L2466 注释明写「No SubscriptionFsm reopen」；Desktop 宿主 `apps/desktop/src/main/session/stream-host.ts` L76 写「No retry, no backoff — SubscriptionFsm owns re-entry」——两边互指，**实际无人重开**。2026-09-14 已按外仓 HEAD `02a2ba350` 逐字复核，两处引用为真 | 外仓 `UniverseAgentDesktop`（只读对照，不改） |
| 宿主 `openStream` 的 `onClosed(remote/error)` post `streamClosed` 后 `streams.delete` 该 attempt，再 `scheduleStreamReopen`；**不**在 onClosed 本地 dispose（Actor `closeStream` 仍关订阅）。同步 throw 同样删键 —— **已落地**（D463） | `sessionViewHost.ts` `openStream` |
| `subscribeSessionEventStream` / `openChatStream` **不走** `_withTransport`，流错误不会 `_markTransportFailed`；连接相位仍 `connected` | `node/universeAgentConnectionService.ts` L1264–1292 · L1901–1927 |
| `GrpcUniverseAgentClient.isChannelAlive` 只是 `_alive` 标志，仅 `close()` 置 false；grpc-js channel 对 TRANSIENT_FAILURE 自动重连，**引擎进程重启后 channel 自愈但所有已开流以 UNAVAILABLE 关闭** | `node/grpc/grpcClient.ts` L1125 · L1252–1257 |
| 渲染端唯一恢复手段 `requestResync` 只让 Actor `emitBaseline`，不重开流 | `conversationEngineFrameSource.ts` L169–173 · `session-actor.ts` L515–520 |
| ~~仓内无自动重连：`connectProfile({ reconnect: true })` 无调用点~~ **已被本稿之外的改动推翻**：[D408](../progress/deferred-gaps.md) closed 后 `_markTransportFailed` → `_scheduleReconnect()` → `_fireReconnect` → `connectProfile(id, { reconnect: true })`（`universeAgentConnectionService.ts` L2005 · L2043–2077），D410 又补了失败后按同一退避重新调度。`transport_lost` 仍仅由 unary 失败写入 | HEAD `815b4ad48e3` |
| `_withTransport` 成功只恢复 `_transportState = 'ok'`，**不**把 `_connectionPhase` 从 `connecting/transport_lost` 恢复为 `connected`；`connected` 仅在 `connect` 成功时写一次 —— **已落地**：HEAD L1980–1992 按 §3.3 恢复相位，path 取自新增 `_lastConnectedPath` | `universeAgentConnectionService.ts` L1901–1915 · L792 |

**后果：** 引擎重启 / 单流被服务端关闭后，会话停在「已断开」直到整条连接翻转或用户切换会话开新 lease。PRD-007 验收 4「会话级已断开（附原因）」诚实，但没有恢复语义。

### 1.3 无 deadline；渲染端 bind 一次性

| 事实 | 位置 |
|------|------|
| `grpc/` 目录无任何 `deadline`；`makeUnaryClient` / `makeUnaryBytesClient` 调 `makeUnaryRequest(path, ser, deser, arg, callback)` 无 `CallOptions` | `node/grpc/grpcClientCalls.ts` L16–66 |
| grpc-js `ClientOptions.callInvocationTransformer` 可对每次调用改写 `callOptions`，`CallProperties.methodDefinition.requestStream / responseStream` 可区分 unary 与流 | `node_modules/@grpc/grpc-js/build/src/client.d.ts` L27–45 |
| `GrpcUniverseAgentClient` 构造 `new grpcModule.Client(address, credentials, options.channelOptions)`，单一构造点 | `grpcClient.ts` L1127–1133 |
| `isTransportFailureCode` 已含 `DEADLINE_EXCEEDED` | `grpcTransport.ts` L403–406 |
| 宿主 `whenEngineSessionReady` → `ensureBroughtUp` → `ensureEngineSession` → `callResumeSession` / `createSession`，无超时 | `sessionViewHost.ts` L248–251 · L414–485 |
| `bindEngineSession` 对缓存 `engineSessionByLocal` 的 Resume 失败直接 throw，不回落到 Resume(localId) → Create → recover —— **已落地**：按 §3.3 回落 | 同上 L454–462 |
| 渲染端 `EngineSessionViewLease.ready` 在构造函数一次性计算：`whenEngineSessionReady` reject / 空 id → `false` 永久；`post()` / `requestDetail()` 先 `await this.ready` —— **已落地**：拆成 `acquired`（HEAD L103）+ 可重臂 `whenBindReady`（L132） | `conversationEngineFrameSource.ts` |
| roster `monitorListedEngineSessionBind` / `monitorPendingEngineSessionBind` 只 await 一次 `whenLeaseBindReady`；bind false 且无其他已绑会话 → `markEngineSessionBindFailed` 占位；恢复只靠下一次 `onUaConnectionChanged` → `doRefreshEngineCatalog` | `conversationEngineRosterService.ts`（HEAD：`monitorListedEngineSessionBind` L1592 / `whenLeaseBindReady` L1593 · L1617） |

**后果：** 引擎接受连接但 Resume / Create 不返回时，`ready` 永不 settle，composer 发送无限等待且无失败提示；一次瞬时 bind 失败让该 lease 终生 `no_such_session`。

## 2. 目标 / 非目标

**目标**

1. 渲染进程任何形式消失（graceful unload、reload、崩溃、窗口销毁）后，宿主在有界时间内回收其全部 lease，Actor 正常进入 linger。
2. SessionEventStream 被远端 / 错误关闭且连接仍 up、仍有 lease 时，宿主按指数退避重开；成功后时间线恢复 live，无需用户切换会话。
3. 所有 unary RPC 有默认 deadline；渲染端 lease 的 bind 失败可重试；`post()` 在有界时间内 settle。
4. 不改 `node/sessionCore/**`；不改 `IUniverseAgentSessionView` 合同；不改 `IConversationSessionViewLease` 合同。

**非目标**

| 不做 | 原因 |
|------|------|
| 连接级自动重连（`connectProfile({reconnect:true})` 调度、`transport_lost` 退避） | 另一层生命周期；本稿 S2 只管「连接 up、流 down」。**已由 [D408](../progress/deferred-gaps.md) 实现并 closed**（D410 补失败后重新调度），参数与 S2 相同（base 1000 / cap 30000 / ±20% jitter）但两层互不知情，见 §6 |
| 给 `CoreMessage` 加 `reopenStream` / Actor 自持重开 FSM | vendored core 不手改；登记 **G-CORE-2** 向上游提，S2 是宿主侧过渡实现 |
| lease TTL / 渲染端续约心跳 | S1 的两条钩子（IPC 连接移除 + 窗口销毁）已覆盖桌面全部消失路径；TTL 只在 Web / remote 宿主出现时再议 |
| 同窗多 lease 合并（D22）、删 `acknowledge` 死流量、`connectionDown` 按 session 广播、宿主 per-session 状态回收 | 审查 4–8 项，另立切片；与本稿无文件冲突时可并行 |
| 流 / bidi 的 deadline | SessionEventStream / 常驻 Chat / ContinueGeneration 是长活流；one-shot `chat()` 的生命周期由引擎决定 |
| 把 `openStream` 未绑 engine id 时的 warn 改为 post `streamClosed` | 审查 Minor 9；当前不可达，不与本稿混 |

## 3. 设计

### 3.1 S1：lease 所有权与客户端断连回收

| 项 | 选定 |
|----|------|
| owner 来源 | IPC `ctx`（`` `window:${windowId}` ``），由宿主侧通道从 `call(ctx, …)` 取得，**不**信任渲染端自报 |
| 通道 | 新增 `platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts`：`class UniverseAgentSessionViewChannel implements IServerChannel<string>`。`call(ctx, 'acquireLease', [sessionId])` → `service.acquireLeaseFor(String(ctx), sessionId)`；其余五方法 + `acknowledge` 白名单转发到同名方法；未知命令 throw `ErrorNoTelemetry('Method not found')`（与 `fromService` 同措辞）。`listen(ctx, 'onDynamicDidApplyFrame', leaseId)` → `service.onDynamicDidApplyFrame(leaseId)`；其它事件名 throw。参数照 `fromService` 走 `revive` |
| 渲染端 | **不变**：仍 `ProxyChannel.toService` 调 `acquireLease(sessionId)`；`IUniverseAgentSessionView` 合同不变 |
| 宿主 | `SessionViewHost.acquireLease(sessionId, owner?: string)`；`ActiveLease.owner?: string`；新增 `releaseLeasesOwnedBy(owner: string): number`（逐个走既有 `releaseLease`，返回释放数，计 `view.lease_released_by_owner`）。`UniverseAgentSessionViewService` 增 electron-main 专用 `acquireLeaseFor(owner, sessionId)` / `releaseLeasesOwnedBy(owner)`，**不**进 common 合同 |
| 钩子 1（graceful / reload） | `app.ts` `initChannels`：`mainProcessElectronServer.onDidRemoveConnection(c => service.releaseLeasesOwnedBy(String(c.ctx)))` |
| 钩子 2（崩溃 / 销毁） | `app.ts`：`accessor.get(IWindowsMainService).onDidDestroyWindow(w => service.releaseLeasesOwnedBy(windowConnectionContext(w.id)))`。字面量 `` `window:${id}` `` 与 `mainProcessService.ts` L25 耦合：抽 `platform/universeAgent/common/universeAgentSessionView.ts` 之外的一个小 helper（建议放 `electron-main/universeAgentSessionViewChannel.ts` 同文件导出 `windowConnectionContext(windowId)`），并在 channel 测试里断言与 `mainProcessService.ts` 字面量一致（源码扫描，与 `sessionViewHostPostDiscipline.test.ts` 同写法） |
| 幂等 | 两条钩子对同一窗口都会触发；`releaseLeasesOwnedBy` 对无 lease 的 owner 返回 0，不计数不 warn |
| 与 orphan / `hadSubscriber` 的关系 | 正交：orphan 定时器仍只管「从未订阅」；owner 回收管「订阅过但客户端消失」。现有 `unsubscribe after subscribe does not trigger orphan release` 测不动 |
| 无 owner 的 lease | 进程内直接调 `acquireLease(sessionId)`（测试 / 未来非 IPC 宿主）owner 为 `undefined`，不受 owner 回收影响 |

### 3.2 S2：SessionEventStream 退避重开（宿主侧）

| 项 | 选定 |
|----|------|
| 触发点 | `openStream` 的 `onClosed` 在 post `streamClosed` 之后 `streams.delete(key)` 再调 `scheduleStreamReopen(sessionId)`；`openStream` 同步 throw 分支同样删键并调（它也 post 了 `streamClosed{error}`） |
| 不触发 | `disposed === true`（本地关：lease 释放 linger 到期、`connectionDown`、`failClosedOverflow` 的 `closeStream` intent 都走 `dispose` → `gate.closeLocal()`，`onClosed` 不会以 remote/error 到达）。**仅当 fail-closed 发生在有流可关时成立**：`failClosedOverflow`（`session-actor.ts` L540–548）在 `currentAttemptId === null` 时**不发** `closeStream` intent，因此「先关流武装定时器 → 退避窗口内溢出」的顺序下 fail-closed 会被本机制绕过 —— 见 **S4b** 与 §6 |
| 调度条件（schedule 时与 fire 时各查一次） | `this.connectionUp && this.connection.isEngineConnected()` · `this.core.leaseCount(sid) > 0` · `this.core.attemptId(sid) === null` · 该 session 无在途 reopen 定时器 |
| 重开动作 | `postAndDrain(sid, { t: 'connectionUp', connectionGeneration: this.connectionGeneration })`（同代号，不 +1）。Actor `onConnectionUp` 在上述条件下 `openAttempt` → `openStream` intent → 宿主开新流。**不**调 `postConnectionUp`（那会重复 `rootAgentBound`），**不**调 `finishBringUp` |
| 退避 | `delay = min(base × 2^n, cap) ± 20% jitter`；`base` 1000 ms、`cap` 30 000 ms；`n` 每次 schedule +1。普通流首个事件到达归零；**S5 recovery 流例外：计时绑定 attempt，存活 ≥30 s 才归零，不足则保留**。无最大次数：lease 在、连接 up 就一直试。`n` 仍是 per lease epoch；末 lease 释放会清零，新 acquire 是新的用户意图。频率有界、次数无界 |
| 定时器 | 宿主自有 `reopenTimers: Map<sessionId, { timer, attempt, kind: 'reopen' \| 'recovery' }>`，用 `setTimeout`（可注入 `setTimeoutFn` / `nowFn` 供测试），不走 Actor `timerOwners` |
| 取消 | down 分支清 fail-closed 闩并 `clearAllReopenTimers()`；末 lease 清该 session timer/attempt/恢复流计时；`dispose` 清全部。recovery 债务在 down/末 lease 后保留，重连或重新 acquire 可恢复。普通 S2 在 fail-closed 时 skip；溢出会取消普通 S2 并改武装 recovery |
| 可观察 | 度量名：`stream.reopen_scheduled` / `stream.reopen_fired` / `stream.reopen_skipped`（`why`：`no_lease` / `connection_down` / `attempt_open` / **`fail_closed`**）。**S4a 前（历史）：** 无 log 的 `createSessionViewDiagnosticsPort()` count/warn 空转，electron-main 未注入。**HEAD：** `UniverseAgentSessionViewService` 注入 `createSessionViewDiagnosticsPort(logService)`；有 log 时 `count` 为 `log.info(\`${metric}${suffix}\`)`，有 labels 则 suffix 是空格 + `JSON.stringify(labels)`，故手测应 grep `stream.reopen_skipped {"why":"fail_closed"}` 与无 labels 的 `view.lease_released_by_owner`，**不是** `stream.reopen_skipped{fail_closed}` |
| sync chrome | 关流 → `closed(reason)`（现状）；重开 post `connectionUp` → Actor 立即 `live`（现状 `onConnectionUp` 语义，与首次接通一致）；失败 → 再 `closed`。**不**发明 `syncing` 写路径（那需要 core 改动，进 G-CORE-2） |
| 上游缺口 **G-CORE-2** | 登记 [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)：`SessionActor.onStreamClosed(remote/error)` 不重开且无 `syncing` 过渡；建议上游在 Actor 内以 `startTimer('reopen:…')` → `openAttempt` 自持退避，并在等待期 `sync: syncing`。闭合后宿主 S2 退化为删除 `scheduleStreamReopen`。**2026-09-14 追加诉求**（S4b 依赖）：`SessionCore` **仍无** `subscriptionFailed` 或 snapshot sync 访问器，宿主无法在 fire 时自查 Actor 是否已 fail-closed（「只暴露 `leaseCount` / `attemptId` / `chatAttemptId`」已过时：HEAD 另有 `streamHelloAnchor` / live agent tree/status 等只读面，与本缺口无关）；且 `onConnectionUp`（`session-actor.ts` `onConnectionUp`）在 `allowOpen === false` 时**曾无条件**把 `sync: live` 广播给每个 lease 并在末行清 `subscriptionFailed`（**2026-10-07：** 画 live 部分已由 `37a13e74d7b` 本地改掉，宿主仍无 `subscriptionFailed` 访问器）。请上游二者取一：暴露只读 `subscriptionFailed(sessionId)`，或让 `onConnectionUp` 在不开流时不刷 live chrome |

### 3.3 S3：unary deadline + bind 可重试

| 项 | 选定 |
|----|------|
| deadline 落点 | `GrpcUniverseAgentClientOptions.unaryDeadlineMs?: number`（默认 30 000；`0` 关闭）。构造 `grpc.Client` 时传 `callInvocationTransformer`：`!methodDefinition.requestStream && !methodDefinition.responseStream` 且 `callOptions.deadline === undefined` 时写 `deadline = Date.now() + unaryDeadlineMs`。抽纯函数 `applyDefaultUnaryDeadline(props, deadlineMs, now)` 便于单测。流 / bidi 不加 |
| failed 态快速失败门 | `_withTransport` 首行的 `_assertTransportReady()` 换成裸 `!this._transport` 检查，**去掉 `_transportState === 'failed'` 的快速失败**。必要：否则 `_markTransportFailed` 一旦置 failed，所有经 `_withTransport` 的 unary 在发请求前就 throw，下面的相位恢复分支永不可达。影响面仅限经 `_withTransport` 的调用；显式先调 `_assertTransportReady()` 的入口（`subscribeSessionEventStream` / `openChatStream` / `openContinuationStream` 等 **13 处调用**；含方法定义共 14 次命中）仍保留快速失败。代价见 §6 |
| 相位恢复 | `_withTransport` 成功路径：若 `_transportState` 由 `failed` 转 `ok` 且 `_connectionPhase.kind === 'connecting' && reason === 'transport_lost'` 且 `isEngineConnected()`，恢复 `_connectionPhase = { kind: 'connected', path }`（path 取自上次 connect 记录）。否则新加的 `DEADLINE_EXCEEDED` 会让状态栏永久停在「连接中」——这是 HEAD 对 UNAVAILABLE 已存在的潜在缺陷，随 S3 一并收 |
| 宿主 bind 回落 | `bindEngineSession`：缓存 id 的 Resume 失败 → `engineSessionByLocal.delete(localId)`、warn 计 `bind.cached_resume_failed`，**回落**到现有 Resume(localId) → Create → `recoverSessionAfterAlreadyExists` 路径，而不是 throw。不改 Create 参数、不碰 `.sessions` |
| 渲染端 lease | `EngineSessionViewLease` 拆两段：`acquired: Promise<string | undefined>`（leaseId，构造时一次）；`bind: Promise<boolean> | undefined`（可重臂）。`whenBindReady()`：无在途 / 上次为 false → 新起一次 `whenEngineSessionReady`；在途 → 复用；成功 → 永久 memo。`post()` / `requestDetail()` 先 `await acquired`，再 `await whenBindReady()`；失败仍映射既有 `no_such_session` / `{ ok:false, reason:'failed' }`，**不**新增 reason 枚举 |
| roster | **源文件不改，但行为会变**：`whenLeaseBindReady`（`conversationEngineFrameSource.ts` L52–55）转调可重臂的 `whenBindReady()`，而 roster 两个监视器每次 `bindSessionView` 都调它（`conversationEngineRosterService.ts` `monitorListedEngineSessionBind` L1592 / pending L1617），所以一次 bind 失败后**roster 刷新本身**就会发起全新 bind，不再是 await 一个已 settle 的 `ready`。`markEngineSessionBindFailed` 语义不变。「重试」只有在上一次 bind 已 reject、宿主 `ensureEngineSession` 的 `engineBindInflight`（`sessionViewHost.ts` L221 · L538–550）在 `finally` 删掉在途条目之后才是真的新尝试 —— 这正是 §4 里 S3b 硬依赖 S3a 的机制 |
| ADR-003 | 渲染端仍只 import `common/**` |

## 4. 切片

| 切片 | 做什么 | 硬依赖 | 测试 / Exit | 冲突域 |
|------|--------|--------|-------------|--------|
| **S1** lease owner 回收 | §3.1 全部 | — | ① `sessionViewHostFanout.test.ts` 新增：owner A/B 各持 lease，`releaseLeasesOwnedBy('A')` 只释放 A 的、返回 1、`core.leaseCount` 减 1、A 的 `onDynamicDidApplyFrame` 返 `Event.None`、`view.lease_orphaned` 不增；无 owner lease 不受影响；未知 owner 返 0。② 新 `universeAgentSessionViewChannel.test.ts`：fake service 记录 `acquireLeaseFor(ctx, …)`；`SessionViewCallName` 白名单（含 `whenEngineSessionReady`）+ `acknowledge` 转发；未知命令 / 事件 throw；`windowConnectionContext(7) === 'window:7'` 且源码扫描 `mainProcessService.ts` 含同字面量。③ 手测：开两窗口各持 lease，`kill -9` 其中一窗渲染进程 → 主进程日志 `view.lease_released_by_owner`，另一窗帧流不受影响 | `node/sessionViewHost.ts` · `electron-main/universeAgentSessionViewService.ts` · 新 `electron-main/universeAgentSessionViewChannel.ts` · `code/electron-main/app.ts` · 上述测试 |
| **S2** 流级退避重开 | §3.2 全部 + G-CORE-2 登记 | — | 新 `sessionViewHostReopen.test.ts`（`TestConnection` 可手动触发 `onClosed`，`setTimeoutFn` 注入、`reopenBaseMs: 1`）：remote 关流 → 退避后 `subscribeSessionEventStream` 再次被调且 attemptId 变化、`stream.reopen_fired` +1；连续失败 3 次 delay 单调递增（断言 `setTimeoutFn` 收到的 delay 序列，jitter 关闭）；首个事件到达后再关流 → `n` 归零；lease 全释放 / `connectionDown` 期间定时器取消、`reopen_skipped{no_lease|connection_down}`；`failClosedOverflow` 路径不触发 reopen；`sessionViewHostChatClose.test.ts` 既有 throw-on-open 测仍绿 | `node/sessionViewHost.ts` · `sessionViewHostTestHelpers.ts` · `engine-protocol-surface.md` §4 |
| **S3a** unary deadline + 相位恢复 | §3.3 前两行 | — | `grpcClientCalls.test.ts`（或新 `grpcUnaryDeadline.test.ts`）：`applyDefaultUnaryDeadline` 对 unary 写 deadline、对 stream 不写、已有 deadline 不覆盖、`0` 关闭；`universeAgentConnectionService` 测：`_markTransportFailed` 后一次成功 unary 使 `getConnectionPhase().kind === 'connected'` | `node/grpc/grpcClient.ts` · `grpcClientCalls.ts` · `universeAgentConnectionService.ts` + 测试 |
| **S3b** 宿主 bind 回落 + 渲染端 bind 可重试 | §3.3 后三行 | S3a（否则重试仍可能挂死） | `sessionViewHostEngineBind.test.ts` 新增：缓存 Resume 失败 → 回落 Create 成功 → `whenEngineSessionReady` resolve 新 id；`conversationEngineFrameSource.test.ts` 新增：fake `whenEngineSessionReady` 先 reject 后 resolve → 第一次 `post` 得 `no_such_session`，第二次转发到 `sessionView.post`；在途 bind 只调一次 `whenEngineSessionReady` | `node/sessionViewHost.ts` · `contrib/conversation/browser/conversationEngineFrameSource.ts` + 测试 |

### 4.1 回溯审查追加的两刀（2026-09-14；**S4a / S4b 代码已合入 merge**）

| 切片 | 做什么 | 硬依赖 | 测试 / Exit | 冲突域 |
|------|--------|--------|-------------|--------|
| **S4a** 诊断口接线 | electron-main 构造 `SessionViewHost` 时注入一个真会落主进程日志的 `DiagnosticsPort`（`count` 打点、`warn` 走 logService），取代 `createSessionViewDiagnosticsPort()` 的空实现。**选定注入而非改验收口径**：一处最小改动同时救活既有埋点（`view.lease_orphaned` / `view.pending_overflow` / `bind.cached_resume_failed` / `intent.unhandled`），且 §5 的计数式验收得以成立 | — | 单测：注入 fake logService，`releaseLeasesOwnedBy` 后日志含 `view.lease_released_by_owner`。手测即 §5 V-S1-1 / V-S2-2 的前置 | `electron-main/universeAgentSessionViewService.ts` · `node/sessionViewHostPorts.ts` |
| **S4b** fail-closed 与退避竞态守卫 | 给 `streamReopenSkipReason` 加第四个 skip 理由（`fail_closed`）。core 未暴露 `subscriptionFailed`（见 §3.2 G-CORE-2 追加诉求），故先用宿主可得信息做**保守近似**：宿主自记「本 session 最近一次 `failClosedOverflow` 的 mailbox 溢出」并在其后停止 reopen，直到下一次 `acquireLease` / **真正的连接 down**。**2026-09-20：** connected 分支不再 `failClosedSessions.clear()`。若上游先闭合 G-CORE-2 则改为直接查 `subscriptionFailed` | S2 | 顺序测：remote 关流武装定时器 → 溢出 → 定时器触发时 `reopen_skipped` `why=fail_closed`，无 `sync: live`。**snapshot 回归：** overflow 与 fire 之间插入仍-connected `onEngineConnectionChanged`：定时器仍在、`reopen_skipped` `fail_closed`、无 `reopen_fired`、无 live。既有 reopen test 保持绿 | `node/sessionViewHost.ts` + 测试 |

**2026-10-27 合同更新：** 上表 S4b 的「停止至 acquire/down」及其无 live 验收是历史合同，已由 S5 取代。普通 S2 仍有 `fail_closed` skip；溢出同时取消普通 S2 并武装 recovery，recovery 到期真开流后允许回 live。

S1 / S2 / S3b / S4a / S4b 都改宿主侧，**P 槽单写者串行**：S1 → S2 → S3a → S3b →（S4a ∥ S4b，无文件交集）。`npm run compile`（或 `compile-client`）作每刀门禁。

**实施纪律未按本节执行（记账）：** S1–S3b 四刀一次性合入 `b2211b23fa5`，每刀门禁被跳过，合入后遗留 12 个 compile-client 类型错，由 `3c07195f6bf` 单独修补（只把泛型签名与 `SessionViewHostSetTimeoutFn` / `UnaryDeadlineCallProperties` 显式化，不改语义）。D405 正文已改为合入且 compile 0；**不要**再把 D405 读成 compile 红。

### 4.2 S5：溢出 fail-closed 后宿主自动恢复（2026-10-27 已实施，手测待做）

**为什么要有：** 旧实现被吞的第一次 `connectionUp` 仍会执行 `ensureChatStreamIfNeeded()`，导致「chat 流开着、订阅流没开、条幅 closed」。S5 将 S4b 的「停止 reopen」反转为「退避后自动恢复」。规则 16 已于 2026-10-07 审查；2026-10-27 又经 `subscription-recovery-closeout.md` 只读审查并补入 fresh/pending、当前代、清债重入和 attempt 计时边界。本次不改 vendored core。

**Actor 事实（HEAD `37a13e74d7b` 之后）：** `subscriptionFailed === true` 时，`onConnectionUp` 不开流且末行清该标志；`onAcquireLease` 与 `openAttempt` 都因该标志不开流。所以恢复需要**两次** `connectionUp`：第一次被吞并清标志，第二次才 `openAttempt`。**不改 `node/sessionCore/**`，不改 `IUniverseAgentSessionView`。**

| 项 | 选定 |
|----|------|
| 状态 | 宿主新增 `failClosedRecovery: Set<sessionId>`（溢出时加入；与现有 `failClosedSessions` 闩并存：闩管「定时器武装的 S2 重开要不要跳过」，recovery 管「是否欠一次恢复」）。`releasePublishedLink` 清闩时**不**清 recovery |
| 状态 | 宿主新增 `failClosedRecovery: Set<sessionId>`（欠一次恢复）。与 `failClosedSessions` 闩分工：闩只管「武装中的 S2 定时器 fire 时要不要跳过」；recovery 管「是否欠恢复」。**溢出回调时机：** `Actor.enqueue` 先 `diagnostics.count('mailbox.overflow')`（宿主 `onMailboxOverflow` 在此刻加闩）、之后才 `failClosedOverflow()`，所以加入 recovery 与武装定时器都发生在 `closeStream` intent **之前**，此时 `core.attemptId(sid)` 仍非 null。`releasePublishedLink` 清闩不清 recovery。实现时可考虑只留 recovery 一个集合，闩由其派生，降低漂移风险 |
| 武装（连接仍 up） | 取消该 session 已武装的 S2 定时器，按 `computeReopenDelay` / `reopenAttemptBySession` 武装 recovery 定时器（复用 `reopenTimers`，值带 `kind: 'reopen' \| 'recovery'`，同一 session 同时只一个）。**调度时只查 `connectionUp` 与 `leaseCount > 0`，不查 `attemptId`**（调度时流还开着；照搬 `streamReopenSkipReason` 会得到 `attempt_open` 永不武装）。`attemptId === null` 只在 fire 时查 |
| fire（`fireFailClosedRecovery`） | 条件：连接 up、`leaseCount > 0`、`attemptId === null`。不满足（`connection_down` / `no_lease`）→ 计 `recovery_skipped{why}`，**保留** recovery 条目、闩照旧。满足则顺序固定：① 先从 `failClosedSessions` 摘闩（②若同步 throw，`openStream` 会立刻 `scheduleStreamReopen`，闩还在会得到 `fail_closed` 而不武装，永久熄火）；② `postAndDrain(connectionUp)`（被 Actor 吞并清标志；同时会 `ensureChatStreamIfNeeded` 开 chat 流，先 chat 后订阅，可接受，测试须断言）；③ 若 `core.attemptId(sid) === null` 再 `postAndDrain(connectionUp)`（开流并画 live）；标志已清时 ② 就开流，③ 因守卫跳过，不重复刷 live；④ 摘 recovery 条目 |
| 溢出后断连再重连 | `releasePublishedLink` 保留 recovery 条目。`finishBringUp` 在 `postConnectionUp` 之后按需补投；只有当前 attempt 真打开且没有重入新 fail-closed 时才清债。`clearAllReopenTimers()` 使此路径 `n` 归零；风暴上界只剩 D408/D410 连接重连节奏，不宣称更多 |
| lease 全释放后再开 | `releaseLease` 在 `leaseCount === 0` 时取消定时器、删 `reopenAttemptBySession` 和该 epoch 的恢复流计时，但 recovery 条目保留。同一 session 再 `acquireLease` 会重新武装 recovery，`n` 从 1 起 |
| 风暴界 | 溢出 → 重开 → baseline 重放 → 再溢出会循环。普通流首事件归零；recovery 流由 `recoveryStreams` 绑定具体 attempt 与首事件时间，**存活 ≥30 s 才归零**，不足则沿用 `n`。`SessionViewHostOptions.nowFn` 可注入。down、末 lease 和 dispose 清理对应计时，旧 attempt 不影响新 epoch。频率有界、次数无界 |
| 终态会话风险 | 溢出时 `mailbox.clear()` 可能丢掉 `sessionClosed` 之类终态事件。对已终止会话，recovery 会反复 `SubscribeSessionEventStream`，每次 NOT_FOUND 后又由 S2 无限重试。本次与 S2 一致不设次数上限，终态节流仍是后续风险 |
| 可观察 | `stream.recovery_scheduled{attempt}` / `stream.recovery_fired` / `stream.recovery_skipped{why}`；`stream.reopen_skipped{why:fail_closed}` 保留给普通 S2 与 fail-closed 的竞态 |
| 被 S5 取代的旧合同 | §3.2 退避/取消、§4.1 S4b、§5 V-S4b-1 已于 2026-10-27 同步改写：退避窗内不得假 live，到期且真开流后允许回 live |
| 受影响既有测 | 旧三条「无 timer / 无 live」期望已改为 recovery；新增同连接、重 acquire、二次溢出、同步 throw 与 30 秒边界。二次溢出顺序测是有意覆盖清债重入，不再禁止嵌套 post。`sessionActorReconnectHistoryRegen.test.ts` 保持 Actor 合同不变 |
| vendored 补丁登记 | `37a13e74d7b` 改了 `sessionCore/` 下 **5 个文件**（`session-actor.ts`、`session-actor-stream-fold.ts`、`session-actor-local-fact.ts`、`session-actor-fold-interface.ts`、`session-actor-chat-outbox.ts`），内容含订阅闩、历史回填、重新生成闩三件事，不止 `onConnectionUp`。这违反 [giant-file-split](giant-file-split.md) GFS-4「vendored 树 `git diff` 须能完整解释为脚本整树覆写」与 AGENTS.md「不手改 sessionCore」，应定性为**待追认或待回退的违规**，不是已合规的 G-CORE-2 落地。`SYNC.md` 由同步脚本每次 `writeFileSync` 重新生成，在其中登记会被覆盖；可行登记位：本稿 + GFS-4 旁注，或脚本不碰的 `sessionCore/LOCAL-PATCHES.md`，或改脚本模板。**下次 re-sync 前必须先确认上游已含同样不变量，否则这 5 个文件的修复与 `sessionActorReconnectHistoryRegen.test.ts`（整个 424 行）都会红** |

**2026-10-27 选定：** ① 与 S2 一致不设恢复次数上限，以 1–30 秒退避限制频率；终态会话节流保留为风险。② 接受退避后真开流再回 live，V-S4b-1 已同步改写。③ 本次不新增 vendored 修改；`37a13e74d7b` 既有补丁仍需在下次 re-sync 前核对上游，不在本刀追认或回退。

**切片：** 单刀，只改 `node/sessionViewHost.ts` + 测试，P 槽。Exit：新增顺序测 ①溢出 → recovery 到期 → 第二次 `connectionUp` 开流、live、先 chat 后订阅；②溢出 → 断连 → 重连 → `finishBringUp` 补投 → 开流；③溢出风暴下 recovery delay 单调递增、流存活 < 30 s 不归零、≥ 30 s 归零（注入 `nowFn`）；④lease 全释放 / 连接 down 取消 recovery 定时器但保留条目；⑤溢出 → 全释放 lease → 再 `acquireLease` 重新武装并最终开流；⑥标志已被清（先翻转后溢出的反序）时不重复刷 live；⑦fire 中 `openStream` 同步 throw 时 S2 reopen 仍能武装。

**手测：** V-S5-1 触发 fail-closed 且连接不翻转；条幅先 `degraded`，退避后回 `live`，引擎侧见新的 `SubscribeSessionEventStream`。**触发方式：** 默认 `mailboxCapacity` 为 256（`session-core.ts`）且溢出只发生在 drain 内嵌套 post，真实窗口里几乎灌不满，须经调试参数或注入点调小 `mailboxCapacity`，实施时一并给出。V-S5-2 同上但退避窗内断连再重连，重连后直接 live、无第二个「已断开」停留。V-S5-3 溢出 → 关 tab（lease 全释放）→ 再开，最终 live。

**风险：** ① 与 D408/D410 连接级重连互不知情（参数同，down 分支清 recovery 定时器但保留条目，两层不同时活）。② recovery 与 S2 共用 `reopenTimers`，取消路径须覆盖两者（靠 `kind` 区分度量）。③ 「待拍板」① 与终态会话无限重试。④ 把 HEAD 的「chat 开、订阅关」状态称为已知更糟现状，S5 之前它一直存在。

## 5. 验收（产品可观察 + 工程可观察）

**前置：** V-S1-1 / V-S1-2 前半 / V-S2-2 依赖 **S4a**（未落则这三条无观察点，跑了也无法判定）。全部七条需隔离 profile + 钉死引擎，见 [debug-engine](../../docs/guides/debug-engine.md)。

| ID | 场景 | 通过标准 |
|----|------|----------|
| V-S1-1 | 已连引擎、窗口 A 打开会话；`kill -9` A 的渲染进程 | ① 主进程日志 ≤ 1 s 内出现 `view.lease_released_by_owner`（S4a 前置）；② 引擎侧 ≤ 35 s（linger 30 s + 余量）内该 engine session 的 `SubscribeSessionEventStream` 断开且不再重新到达；③ 窗口 B 同会话时间线继续增量刷新 |
| V-S1-2 | 窗口 reload（`Developer: Reload Window`） | ① 引擎侧旧 `SubscribeSessionEventStream` 在 reload 后 ≤ 35 s 内断开（不残留）；② reload 后新 lease 首帧仍为 baseline |
| V-S2-1 | 会话 live 中重启引擎进程（gRPC 端口不变） | ① 状态栏连接芯片全程不翻转；② 会话徽标短暂「已断开（reason）」后 **≤ 60 s** 回到「已连接」；③ 全程未切换会话、未点 Connect |
| V-S2-2 | 同上但引擎不再回来 | ① 引擎侧观察 `SubscribeSessionEventStream` 到达间隔递增并稳定在 ~30 s（±20% jitter）；② 主进程出现 `stream.reopen_scheduled`（S4a 前置；labels 为 JSON，如 `stream.reopen_scheduled {"attempt":"1"}`）；③ 断开 Connection 后 60 s 内不再有重开尝试 |
| V-S3-1 | 引擎侧在 `SessionService.Resume` handler 上打断点挂住（`vscode-debug-engine`） | ≤ 30 s（默认 `unaryDeadlineMs`）composer 收到 `no_such_session` 失败提示，而非无限等待 |
| V-S3-2 | 上述断点放开后再发一次 | 第二次发送成功，不需要重连、不需要切换会话 |
| V-S3-3 | 一次 unary DEADLINE_EXCEEDED 后下一次 unary 成功 | 状态栏文案回到 `Engine · Direct`，不停在「连接中」 |
| V-S4b-1 | 先让流被远端关闭，再在退避窗口内灌满 mailbox 触发 fail-closed；窗口内允许仍-connected 连接 snapshot | 普通 S2 不得把会话画回 live；recovery 到期且新 attempt 真打开后可合法回 live。日志应见 `stream.recovery_scheduled` / `stream.recovery_fired`。本条仍须隔离 profile 实跑；V-S5-1–V-S5-3 同列待验 |

## 6. 风险

| 风险 | 缓解 |
|------|------|
| S1 自定义通道绕开 `ProxyChannel.fromService`，将来给 `IUniverseAgentSessionView` 加方法时漏转发 | 通道测试逐方法断言；白名单从 `IUniverseAgentSessionView` 键集派生的类型 `keyof` 校验，新加方法编译红 |
| `window:${id}` 字面量与 `mainProcessService.ts` 漂移 | 源码扫描测锁字面量；`onDidRemoveConnection` 路径不依赖该字面量（直接用 ctx） |
| S2 re-post `connectionUp` 让 Actor 立即 `live`，重开失败前有短暂假 live | 与首次接通语义一致；退避使抖动有界；G-CORE-2 闭合后由 Actor `syncing` 取代 |
| S2 与 `onEngineConnectionChanged` up 分支（每次 snapshot 变化都调）叠加多次 `connectionUp` | Actor `onConnectionUp` 幂等（`currentAttemptId !== null` 不重开）；fire 时再查 `attemptId === null` |
| S3a deadline 让慢引擎的长 unary（List 大会话、GetHistory 大页）失败 | 30 s 默认 + 参数可调；`getHistory` 分页已由 `fillHistoryGap` 控制页大小；观察后再收紧 |
| S3a 相位恢复误判（`connecting/transport_lost` 但 token 已失效） | 附加 `isEngineConnected()` 条件；`unauthenticated` 走既有路径不受影响 |
| S3b 渲染端重试 bind 与 roster `markEngineSessionBindFailed` 占位并存 | 占位仍由 roster 决定；lease 侧成功后 `post` 直接可用，占位在下一次 `doRefreshEngineCatalog` 消失（现状） |
| **（2026-09-14 审查追加）** 退避定时器已武装期间发生 fail-closed → 定时器触发 → `onConnectionUp` 无条件刷 `sync: live` 且清 `subscriptionFailed`，但 `allowOpen === false` 不开流 ⇒ **无订阅的会话被永久画成「已连接」** | **S4b 宿主闩（2026-09-20）：** 仍-connected snapshot 不再清闩。**2026-09-25（已过期，保留记账）：** 断连会 `failClosedSessions.clear()`，重连时 `onConnectionUp` 曾在 `allowOpen === false` 下画 live。**2026-10-07：** 该画 live 的路径已由 `37a13e74d7b` 闭合（见 [04-session-actor](bug-hunt-2026-09-24/04-session-actor.md) BH-04-1）。2026-10-27 起由 S5 同连接/重 acquire/重连 recovery 恢复；嵌套二次溢出的瞬时 live 仍沿用 Actor 顺序，清债防重入由宿主回归锁定 |
| **（追加）** 连接级重连（D408/D410）与 S2 流级重开退避参数相同但互不知情 | 目前不冲突：连接翻转时 `onEngineConnectionChanged` down 分支 `clearAllReopenTimers()`，两层不会同时活。若将来改参数须同步两处 |
| **（追加）** `_withTransport` 摘掉 failed 快速失败后，failed 态下每次 unary 都会真发一次请求 | 代价是一次 deadline 等待（默认 30 s 上限）；这是相位恢复可达性的必要代价，且流 / bidi 入口仍快速失败 |
| **（追加）** `openStream` 在 engine id 未绑时只 warn 并 return，**不** post `streamClosed`（`sessionViewHost.ts` `openStream` ~L1264–1268），Actor `currentAttemptId` 保持非 null ⇒ `streamReopenSkipReason` 永久返回 `attempt_open`，S2 永久哑掉 | 当前该分支不可达（§2 原判 Minor 9），但**它的不可达性现在是 S2 的承重墙**：谁让它可达就必须同时补 post `streamClosed`。已从「非目标」升为本表 |

## 7. 知识层回填（实施 commit 时）

**状态：** 既有 S1–S4b 回填已完成；S5 于 2026-10-27 同步更新本稿与 `engine-protocol-surface`。BH-04-1 衍生的同连接恢复设计洞已由代码和自动回归闭合；升 `implemented` 只剩 §5 / D405 与 V-S5 手测，不以自动测试替代。

fanout §3.1 已补「`acknowledge` 后由订阅流 Actor 回路切片加入合同（HEAD 已有）」。**未消的矛盾：** [session-view-frame-fanout §1](session-view-frame-fanout.md) 事实表仍写六方法且「**无** `acknowledge`」。本稿不改已签收 fanout；不得宣称与 HEAD 的矛盾已全部消除。

- [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)：登记 **G-CORE-2**（Actor 不重开、无 `syncing` 过渡；来源 vendored session-core，非 gRPC）；§5 会话面补「宿主按 owner 回收 lease」与「remote/error 关流后宿主退避重开」两句。
- [conversation-stream-timeline §3.8](conversation-stream-timeline.md)：断连 / 重连段补「流级关闭 → 宿主退避重开」；`closed(reason)` 行补「连接仍 up 时会自动重试」。
- `docs/modules/platform/overview.md`：`IUniverseAgentSessionView` 段（L128–131 两处重复描述择一保留）补 owner 回收与 deadline；顺手改正 L129 漏写 `acknowledge`。
- [docs/product/requirements.md](../../docs/product/requirements.md) PRD-007 验收 4/5：不改状态；在 traceability 「实施方案」列加本稿链接。
- [deferred-gaps](../progress/deferred-gaps.md)：新增「连接级自动重连缺失」D 行（编号实施时分配）；D22 备注「S1–S3 不含 F3」。
- [session-view-frame-fanout §3.1](session-view-frame-fanout.md)：补一句「`acknowledge` 后由订阅流 Actor 回路切片加入合同（HEAD 已有）」，消除该稿与 HEAD 的矛盾。

## 相关

- [session-view-frame-fanout](session-view-frame-fanout.md) · [conversation-stream-timeline](conversation-stream-timeline.md) · [ADR-003](../decisions/003-engine-adapter-boundary.md) · [cross-repo-protocol](cross-repo-protocol.md)
- `src/vs/base/parts/ipc/common/ipc.ts`（`IPCServer.onDidRemoveConnection`）· `src/vs/base/parts/ipc/electron-main/ipc.electron.ts`（`onDidClientDisconnect`）· `node_modules/@grpc/grpc-js/build/src/client.d.ts`（`callInvocationTransformer`）

## 审查记录（规则 16）

**2026-09-14 · 回溯审查（generalPurpose 只读 reviewer，未锁模型）。** 本稿写于 2026-09-10 但规则 16 审查被跳过、实施先行（`b2211b23fa5`），故本次为回溯审查：既审方案质量，也审「方案正文 vs 已落地代码 vs HEAD」三者一致性。父 agent 已逐条核验后改稿。

**Reviewer 认可（核验为真）：** §1.2 两处外仓引用按 `UniverseAgentDesktop` HEAD `02a2ba350` 逐字为真，未发明合同；§3.1 通道设计几乎逐字落地，`SessionViewCallName` 派生白名单使加方法编译红（§6 风险 1 缓解真的生效），源码扫描测锁住 `window:${id}` 字面量；§3.2 退避参数与三条取消路径全部对得上，`releaseLease` 有 `leaseCount === 0` 守卫（不存在多 lease 误清）；§7 六项回填无虚报；§F 六项自我约束全部守住（合同文件自基线字节未变、未碰 `node/sessionCore/**`、渲染端无越层 import）。

**已采纳并改稿：**

| 等级 | 意见 | 落点 |
|------|------|------|
| Critical | 生产 `DiagnosticsPort` 空实现且未注入 ⇒ 计数式验收无观察点 | §3.2 可观察行 + 新 **S4a** + §5 前置 + 实施现状 |
| Critical | 「fail-closed 不会被绕过」在「定时器已武装 → 溢出」顺序下不成立，且造成永久假 live | §3.2 不触发行改条件表述 + 新 **S4b** + §6 + V-S4b-1 + G-CORE-2 追加诉求 |
| Critical | §1.2「仓内无自动重连」与 §2 非目标已被 D408/D410 推翻 | §1.2 该行划除改写 + §2 非目标首行 + §6 两层退避风险 |
| Important | `_withTransport` 摘掉 `_assertTransportReady` 的 failed 快速失败（实现更对，方案未写） | §3.3 新增「failed 态快速失败门」行 + §6 代价行 |
| Important | §3.3「roster 不改」不准确：`whenLeaseBindReady` 现在触发全新 bind | §3.3 roster 行改口，并写明 `engineBindInflight` 是 S3b→S3a 硬依赖的真实机制 |
| Important | §5 七条里只有 V-S3-1/2/3 可判定 | §5 整表操作化（引擎侧 `SubscribeSessionEventStream` 观察 + 60 s 阈值 + 断点位置） |
| Important | §7 缺「commit 本稿」，HEAD 遗留 5 处悬空链接 | §7 状态段 |
| Important | §4 每刀门禁未执行（四刀一次合入 + 12 个类型错事后修补） | §4.1 记账段 |
| Minor | §1 行号漂移；外仓 `stream-host.ts` 路径不全；已落地行未标注；`n` 的 per-lease-epoch 语义；Minor 9 从非目标升为承重墙风险 | 实施现状段 + §1 各行 + §3.2 退避行 + §6 |

**未采纳 / 反驳：** 无实质反驳。Reviewer 主动澄清两点，父 agent 复核同意：① §7 不是虚报而是缺项（性质不同）；② `releaseLease` 取消定时器有 `leaseCount === 0` 守卫，不存在其最初怀疑的多 lease 误清。

**Minor 留待：** 通道 `acquireLease` 在白名单检查前后写了两遍（第二处不可达，无害）；`whenBindReady()` 首个分支的 `bindSucceeded` 不承载判定（冗余）；`view.lease_released_by_owner` 是按批计数而非按 lease 计数（口径已在 §5 V-S1-1 按「出现即通过」钉死）；§6 风险 1 的缓解挡「加方法」但挡不住「改签名」（手写结构类型）；`app.ts` 从 `universeAgentSessionViewMainService.ts` 取类（后者仅一行 re-export）。

**2026-09-20 · 规则 16 再审（generalPurpose 只读 reviewer，未锁模型；HEAD `434ad999580`）。** Assessment **Request changes**。父 agent 已核验后改稿。未重跑 compile / `scripts/test.sh`。用户未签收。

**已闭合、不再重开的 2026-09-14 项：** S4a 生产 logger 已注入；本稿已 commit；D405 不再写 compile-client 红；D408/D410 已入 §2。

**已采纳并改稿：**

| 等级 | 意见 | 落点 |
|------|------|------|
| Critical | S4b 声称闭假 live 洞；HEAD `onEngineConnectionChanged` 对仍-connected snapshot 清闩且不取消武装定时器 | 当轮先改方案。**同日落地：** `failClosedSessions.clear()` 只走 down；snapshot 回归测绿。不另起切片号 |
| Important | §3.2 可观察仍写生产空转 | §3.2 可观察改 HEAD logger / JSON labels |
| Important | §7 仍写本稿未 commit | §7 改「已入 git」；2026-09-14 该项标已闭 |
| Important | 「漂移 366 提交」为假（实为 1649） | 实施现状 |
| Important | 方案仍写 D405 compile-client 1 | §4.1 记账改口 |
| Important | PIN「六方法 + acknowledge」漏 `whenEngineSessionReady` | 文首不推翻 + S1 Exit |
| Important | G-CORE-2「只暴露三个 accessor」过时 | §3.2：仍无 `subscriptionFailed`；其它只读面已变多 |
| Important | 宣称 fanout 与 HEAD 矛盾已消；§1 表仍无 acknowledge | §7 改口；本稿不改已签收 fanout |
| Important | V-S4b-1 日志形态 `skipped{fail_closed}` 对不上 `log.info` JSON | §5 / §3.2 |
| Minor | 通道 dual `acquireLease` / `whenBindReady` 冗余 / re-export / 行号 | 仍留待；§1 若干 HEAD 行号已刷新 |

**未采纳 / 反驳：** 无。不把 S4b 代码合入读成产品闭合。不升 `accepted` / `implemented`。

**2026-09-20 闩修（同会话，用户批准实施）：** `onEngineConnectionChanged` connected 分支不再清闩。`sessionViewHostReopen.test.ts` 11/0（含 snapshot 回归）。`sessionViewHostEngineBind.test.ts` 20/0。升格条件 (1) 的宿主单测已满足；§5 手测仍未跑。

**2026-10-07 · 规则 16 审查 §4.2 S5（generalPurpose 只读 reviewer，未锁模型，仅 1 个；对照 HEAD `f87af803248`）。** Assessment：事实层成立，设计层有三处会导致实现出错，不升 `accepted`。未跑 compile / 测试。父 agent 已逐条核对代码后改稿。

**Reviewer 认可（核验为真）：** Actor 在 `subscriptionFailed` 下 `onConnectionUp` / `onAcquireLease` / `openAttempt` 都不开流，恢复需要两次 `connectionUp`；HEAD 无任何自动恢复路径（`finishBringUp` 被 `engineBroughtUpForGeneration` 挡、`scheduleStreamReopen` 只在 `onClosed` / 同步 throw 武装、溢出走 `closeStream` 不触发 `onClosed`）；没有会话删除路径，不存在 recovery 因删会话泄漏；`SYNC.md` 与 `session-actor.ts` 每次被同步脚本覆盖。

| 等级 | 意见 | 落点 |
|------|------|------|
| Important | 调度时若复用 `streamReopenSkipReason` 会得 `attempt_open` 永不武装（溢出回调在 `closeStream` 之前） | §4.2「状态」「武装」行 |
| Important | fire 里先摘闩再开流；同步 throw 时才不会熄火 | §4.2「fire」行 |
| Important | lease 全释放后再开，recovery 永久休眠，须在 `acquireLease` 补武装 | §4.2 新增「lease 全释放后再开」行 + V-S5-3 |
| Important | 第一次被吞的 `connectionUp` 仍会开 chat 流，HEAD 现状是「chat 开、订阅关」 | §4.2 开头 + 风险 ④ |
| Important | 风暴界缺状态定义；重连路径 `n` 实际归零；「有界」与「无限」并存；终态会话无限重试 | §4.2「风暴界」「终态会话风险」「溢出后断连再重连」行 |
| Important | S4b 旧合同三处（§3.2 取消行 / §4.1 / V-S4b-1）未标取代 | §4.2「被 S5 取代的旧合同」行 + 「待拍板」② |
| Important | 既有测影响列表不完整，V-S5-1 溢出触发方式不可操作 | §4.2「受影响既有测」+ 手测 |
| Important | 上限等产品语义写成了默认 | §4.2「待拍板」三项 |
| Minor | vendored 补丁其实 5 个文件、违反 GFS-4；登记位不止一种 | §4.2「vendored 补丁登记」行 |
| Minor | `engineBroughtUpForGeneration` 口径是「每条已发布链路一次」；`reopenTimers` 值应带 `kind`；两集合漂移风险 | §4.2「状态」「武装」行已吸收 |

**未采纳 / 反驳：** 无。§3.2 退避/取消、§4.1 S4b 与 §5 V-S4b-1 已于 2026-10-27 同步改写。

**升格条件（2026-10-27 更新）：** S5 设计缺口已闭合，方案升 `accepted`。§5 手测与 [D405](../progress/deferred-gaps.md) 是升 `implemented` 的门槛；V-S5-1–V-S5-3 也未实跑，因此保持 accepted，不宣称手测或全产品验收完成。
