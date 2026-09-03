---
title: "会话视图帧扇出：per-lease 动态事件、首帧缓冲与 intent 归属门禁"
type: plan
status: implemented
phase: M7
updated: 2026-09-04
summary: "F1/F2 已落 @ c37bbc6e / 917a7f8d：onDynamicDidApplyFrame(leaseId) + 宿主首帧缓冲 + postAndDrain；G-CORE-1 已登记；F3 渲染端共享 lease 见 D22"
---

# 会话视图帧扇出

> **触发：** 2026-09-03 用户点名两条「唯一没改的架构约束」：① ProxyChannel 把每一帧广播到所有窗口，渲染端按 leaseId 过滤；② vendored `takeIntents()` 仍是全局队列，归属在宿主侧解析。本稿核实后发现 ① 还带一个正确性问题（§1.2）。  
> **基线：** 本稿相对 **commit HEAD**；工作树另有其他工位未 checkout 的残留，不以工作树为准。  
> **不推翻：** [ADR-003](../decisions/003-engine-adapter-boundary.md)（`contrib/**` 禁 import `platform/universeAgent/node/**`）；[conversation-stream-timeline §3](conversation-stream-timeline.md)（lease 是显示写源、多 lease 共享订阅、末 lease 释放后 linger）；session-core 「注册即 baseline」原子附着（INV-SPC-12）；**vendored `node/sessionCore/**` 不手改**。  
> **槽位：** 平台合同变更，归 **P 槽**（[m7-ui-completion-wave §3](m7-ui-completion-wave.md)）；UI 槽不写本稿文件。  
> **审查记录：** 见文末（规则 16，待起审）。

## 0. 一句话结论

把 `IUniverseAgentSessionView.onDidApplyFrame` 从「全局事件 + 渲染端过滤」改成 ProxyChannel 原生支持的 **`onDynamicDidApplyFrame(leaseId)`** 带参事件，宿主按 lease 过滤并在首个订阅者到来前**缓冲**该 lease 的帧；IPC 从 O(窗口 × 帧) 降到 O(帧)，同时消掉「跨进程首帧 baseline 必丢」。`takeIntents()` 不改 core，改成宿主唯一入口 + 门禁 + 可观察，并登记上游缺口。

## 1. HEAD 事实

### 1.1 帧广播路径

| 事实 | 位置 |
|------|------|
| 主进程 `SessionViewHost._onDidApplyFrame` 是普通 `Emitter`，`onFrameEnqueued` 末尾对所有 lease 的帧统一 `fire`（工作树在途改动在此处加了「fans this to every window」注释；HEAD 无注释，行为相同） | `platform/universeAgent/node/sessionViewHost.ts` `onFrameEnqueued` 末尾 |
| electron-main 服务原样透出 `get onDidApplyFrame()`；`app.ts` 用 `ProxyChannel.fromService` 注册 `universeAgentSessionView` 通道，单例服务对所有窗口共享 | `electron-main/universeAgentSessionViewService.ts` · `code/electron-main/app.ts` |
| 渲染端 `registerMainProcessRemoteService` → `ProxyChannel.toService`；`ConversationEngineFrameSource` 构造时订阅一次，收到后 `this.leases.get(event.leaseId)` 过滤 | `electron-browser/universeAgentSessionViewService.ts` · `contrib/conversation/browser/conversationEngineFrameSource.ts` |
| 帧粒度本就是 **per-lease**：actor 对每个 `LeaseRecord` 各自维护 `generation / frameId / version`，`emitBaseline` / `emitPatches` 逐 lease `sink.enqueue` | `node/sessionCore/session-actor.ts` `emitBaseline` / `emitPatches` |
| ProxyChannel 支持 **dynamic event**：服务上形如 `onDynamicXxx(arg): Event` 的方法，渲染端 `toService` 会把它映射为 `(arg) => channel.listen('onDynamicXxx', arg)`；`fromService` 端调用该方法得到事件 | `base/parts/ipc/common/ipc.ts` `propertyIsDynamicEvent` |
| Web stub：`onDidApplyFrame = Event.None`；`acquireLease` **不拒绝**，返回 `web-empty:${sessionId}`（`universeAgentConnection.test.ts` 断言该前缀）；`post` / `requestDetail` 返回诚实失败 | `browser/universeAgentSessionViewService.ts` |
| HEAD 上 `IUniverseAgentSessionView` 方法集：`onDidApplyFrame` · `acquireLease` · `releaseLease` · `post` · `requestResync` · `requestDetail`（**无** `acknowledge`；宿主 sink 的 `acknowledge` 是空函数） | `common/universeAgentSessionView.ts` |
| HEAD 生产路径上 `IUniverseAgentSessionView.onDidApplyFrame` 唯一消费者是 `ConversationEngineFrameSource`；`conversationLens` / `conversationSessionChatService` / `navigatorSessionLeaseHolder` 订的是 **`IConversationSessionViewLease.onDidApplyFrame`**（本稿不动）。测试侧另有 `conversationEngineRosterService.test.ts` 的 `MockUniverseAgentSessionView` 实现该接口 | grep @ HEAD |
| 同一窗口同一会话可有多个 lease（Conversation Part、Navigator Agents 叶、Team 叶各持 1 个，独立计数） | [navigator-engine-segments §2.2 / §2.4](navigator-engine-segments.md) |

### 1.2 跨进程首帧 baseline 丢失（本稿新发现）

时序（同一 IPC 协议内消息有序）：

1. 渲染端 `sessionView.acquireLease(sessionId)`（IPC call）。
2. 主进程 `host.acquireLease` → `core.post(acquireLease)` → actor **同步** `onAcquireLease` → `emitBaseline` → `sink.enqueue` → `_onDidApplyFrame.fire`。`ChannelServer` 在事件回调里**同步** `sendResponse(EventFire)`（`ipc.ts` `onEventListen`），而方法回复 `PromiseSuccess` 挂在 `promise.then` 微任务上——**同一 protocol 上 EventFire 必先于 PromiseSuccess**。
3. 连接已 Up 时，`acquireLease` 返回前还会 `postConnectionUp(sessionId)` → `core.post(rootAgentBound)` 等，这些 `patches` 帧同样在回复之前发出。**丢的是整个 acquire 同步突发，不只 baseline 一帧。**
4. `acquireLease` 返回 leaseId，**回复消息最后发出。**
5. 渲染端先收到突发帧；此时 `EngineSessionViewLease.leaseId` 仍为空、`ConversationEngineFrameSource.leases` 尚未登记（要等 `acquireLease(...).then(id => onAcquired(id))`）→ `leases.get(leaseId)` 为 `undefined`，**全部丢弃**。
6. 不会自愈：`applyViewFrame` 在 `cursor === null` 时**不校验连续性**（`common/sessionView/apply.ts` `if (cursor) {…}`），突发之后到达的第一帧 `patches`（frameId 不一定是 2，常见是稍后的 `setLiveAgentTree`）直接落在空 replica 上并把 cursor 设为该帧位置，之后一切「连续」，不触发 resync。

影响：对刚 `ensureSession` 的空会话，baseline 是空快照，后续 StreamHello / history 以 patch 补齐，肉眼看不出。对**已有内容的会话再开一个 lease**（Navigator 可见、Conversation 隐藏后再显示、任何后加的 lease），baseline 携带的既有 `timeline` / `liveAgentTree` / `liveTeamId` 全部丢失，只能等后续 patch 恰好覆盖。宿主 `acquireLease` 之后顺手 `scheduleAgentTreeRefresh(sessionId, true)` 会补一帧 `setLiveAgentTree`，所以 Agent 树最终会出现，但 timeline 不会。

HEAD 上与此相关的测试只有 `sessionViewHostNavigator.test.ts`（只 `acquireLease`、不订帧）与 `universeAgentConnection.test.ts`（Web stub 契约），**都测不到**这条时序。工作树未跟踪的 `conversationEngineFrameSource.test.ts` 用进程内 fake，`acquireLease` 为 `async` 且不在 resolve 前 fire，同样测不到。

### 1.3 `takeIntents()` 全局队列

| 事实 | 位置 |
|------|------|
| `createSessionCore` 内 `intentQueue: CoreIntent[]` 为所有 actor 共用；`emitIntent` 闭包不带 sessionId；`takeIntents()` 整批取走并清空 | `node/sessionCore/session-core.ts` |
| **HEAD** 宿主 `drainIntents(sessionId)`：`takeIntents()` 整批取走，**全部**按这次 post 传入的 `sessionId` 调 `handleIntent(sessionId, intent)`；没有任何按 intent 内容反查归属的逻辑。`handleIntent` 只处理 `openStream` / `closeStream` / `ensureChatStream` / `closeChatStream` / `chatStreamWrite` / `fillHistoryGap`；`openContinuationStream` / `startTimer` / `cancelTimer` / `unaryCommand` **落到 `default` 被静默丢弃**（actor 会 emit，宿主不执行也不计数） | `node/sessionViewHost.ts` `drainIntents` / `handleIntent` @ HEAD |
| 正确性依赖一条未写下的不变量：**每次 `core.post(sid, …)` 之后立刻 `drainIntents(sid)`，中间不 post 其他 session**。HEAD 全部 **17** 处 `core.post` 均守住（`handleIntent` 内嵌套的 post+drain 也用同一 `sessionId`）；actor `drain` 拒绝重入，单次 post 内不会有别的 actor 入队 | 同上（2026-09-03 逐处核对 `git show HEAD:`） |
| 违反不变量时无任何诊断：B 的意图会被当成 A 的执行（例如为错误会话 `openStream`） | 同上 |
| **工作树在途**（另一工位，未提交）：`drainIntents(hint)` 改为逐条 `resolveIntentSession(intent, hint)`，用 `attemptOwners` / `timerOwners` / `chatOwners` 与 `core.attemptId()` 反查归属、`linger:` / `chat-flush:` 前缀解析 timer；`openContinuationStream` 仍只能 `fallback`；`core.post` 增至 19 处。本稿 §3.5 **以 HEAD 为基线**写；若在途 dispatcher 先合入，F2 按 §3.5 末行的「在途合入后」补充执行 | 工作树 `git diff` |

## 2. 目标 / 非目标

**目标**

1. 每个窗口只收到自己持有 lease 的帧；IPC 发送次数 = 帧数（不乘窗口数）。
2. 任一 lease 的首帧 baseline 在跨进程路径下**必达**，且不依赖额外 `requestResync`。
3. `core.post` → `drainIntents` 的配对由门禁保证，归属落到 `fallback` 时可观察。
4. 不改 `node/sessionCore/**`；不改 actor 的「注册即 baseline」语义；`IUniverseAgentSessionView` 之外的 renderer 面（`IConversationSessionViewLease`）**不变**。

**非目标**

| 不做 | 原因 |
|------|------|
| 每窗独立 IPC 通道 / 窗口身份透传 | dynamic event 按 leaseId 过滤已达到同一效果，且不需要窗口 id；窗口身份留给真正需要「窗口级」语义的需求 |
| 同窗口同会话多 lease 合并为一个宿主 lease（渲染端共享） | 可选优化，收益是去掉同窗重复 baseline/patch；但要在共享层收口 `post` / `acknowledge` / `requestDetail` 语义，另立切片（§6 F3 候选） |
| 给 `CoreIntent` 加 `sessionId` 或 `takeIntents(sessionId)` | vendored core 不手改；登记 **G-CORE-1** 向上游提 |
| 改 `applyViewFrame` 让 `cursor === null` 时拒绝非 baseline 帧 | 这是 vendored `common/sessionView/apply.ts`；且 F1 缓冲后首帧必为 baseline，无需在此加防线。若上游愿改，记入 G-CORE-1 备注 |
| 渲染端 `onAcquired` 后无条件 `requestResync()` 作为长期方案 | 多一帧 baseline 且不解 N 倍广播；只作 F1 合入前的止血选项（§4） |

## 3. 设计

### 3.1 合同（`common/universeAgentSessionView.ts`）

```ts
export interface IUniverseAgentSessionView {
  readonly _serviceBrand: undefined;
  /** Per-lease frame stream. Frames enqueued before the first listener attaches are buffered host-side and flushed on attach. */
  onDynamicDidApplyFrame(leaseId: string): Event<IUniverseAgentSessionViewFrameEvent>;
  acquireLease(sessionId: string): Promise<string>;
  releaseLease(leaseId: string): Promise<void>;
  post(leaseId: string, msg: ConversationWriteMessage): Promise<PostOutcome>;
  requestResync(leaseId: string): Promise<void>;
  requestDetail(leaseId: string, ref: string): Promise<DetailFetchOutcome>;
}
```

- **删除** `onDidApplyFrame: Event<…>`（不保留双轨；HEAD 生产消费者只有 `ConversationEngineFrameSource`，同刀改；测试侧 `conversationEngineRosterService.test.ts` 的 `MockUniverseAgentSessionView` 同刀改）。
- 方法集**只**在 HEAD 六个方法的基础上把事件换名；**不**顺带加 `acknowledge` 等 HEAD 没有的面（工作树在途的 `acknowledge` / `frameAck` 归订阅流 Actor 回路那条线，不在本稿）。
- 方法名必须以 `onDynamic` 开头（`ipc.ts` 用正则识别），参数只有一个 `leaseId: string`。
- `IUniverseAgentSessionViewFrameEvent` 形状不变（仍含 `leaseId`，便于渲染端断言与日志）。

### 3.2 宿主（`node/sessionViewHost.ts`）

| 项 | 选定 |
|----|------|
| 每 lease 事件 | `ActiveLease` 增 `emitter: Emitter<IUniverseAgentSessionViewFrameEvent>` 与 `pending: IUniverseAgentSessionViewFrameEvent[]`。`onFrameEnqueued(leaseId, …)` 改为：找到 `ActiveLease`；若 `emitter.hasListeners()` 为真 → `fire`；否则 `pending.push` |
| 首帧缓冲 flush | **必须用 `onDidAddFirstListener`**，不能用 `onWillAddFirstListener`：`Emitter.addListener` 的顺序是 `onWillAddFirstListener()` → `this._listeners = contained` → `onDidAddFirstListener()`，而 `fire()` 在 `!this._listeners` 时是 no-op（`base/common/event.ts`）。在 `onWill*` 里 fire 会把 pending **静默清空**。VS Code 自己的 `Event.buffer` 正是把 flush 放在 `onDidAddFirstListener`；实现可直接用 `Event.buffer(emitter.event, /*flushAfterTimeout*/ false, pending)` 或手写 `onDidAddFirstListener: () => { for (e of pending) emitter.fire(e); pending.length = 0; }`。F1 测试必须覆盖「订阅前入队 → 订阅后按序收到」 |
| 缓冲上限 | `pending` 超过 **64** 帧（实现参数，非合同）时丢弃全部 pending 并置 `needsBaseline = true`；首个订阅者到来时改为 `core.post(requestResync)`，保证首帧仍是 baseline。计 `diagnostics.count('view.pending_overflow')`。与 INV-SPC-12 不冲突：不变量是 actor「注册即 baseline」，resync 触发 `emitBaseline`（generation+1、frameId=1），订阅端 cursor 仍为 null，首达帧仍是 baseline |
| 无人订阅的 lease | `ActiveLease.hadSubscriber` **闩**：首个订阅者到来时置 true，之后永不回退。`acquireLease` 后 **5 s**（实现参数）`hadSubscriber` 仍为 false → 视为渲染端已放弃：`releaseLease(leaseId)` 并计 `view.lease_orphaned`。**禁止**把判据写成「当前无 listener 满 5 s」——那会误杀 ProxyChannel 退订后帧再入 pending 的合法态。HEAD `sessionViewHostNavigator.test.ts` 只 acquire 不订阅，测例若 `await` 超过 5 s 会被拆掉：该测显式传 `orphanTimeoutMs: 0`（关闭）或改为订阅 |
| `releaseLease` | 额外 `emitter.dispose()`、清 `pending` |
| `onDynamicDidApplyFrame(leaseId)` | 返回 `this.leases.get(leaseId)?.emitter.event ?? Event.None`。leaseId 未知（已释放 / 伪造）→ `Event.None`，不抛 |
| 时序保证 | actor 在 `acquireLease` 内同步 `emitBaseline` → 进入 `pending`（此时必然无订阅者）→ `acquireLease` 回复 → 渲染端 `listen(leaseId)` → `onDidAddFirstListener` flush baseline → 后续帧直发。**首帧必为 baseline**，与 INV-SPC-12 一致 |
| 与 `ProxyChannel.fromService` 的对接 | electron-main 服务实现 `onDynamicDidApplyFrame(leaseId) { return this.host.onDynamicDidApplyFrame(leaseId); }`；`fromService.listen(_, 'onDynamicDidApplyFrame', leaseId)` 调它取事件。渲染端最后一个 listener 移除时 `ChannelClient` 发 `EventDispose`，服务端 dispose 订阅（`ipc.ts`），宿主侧 `Emitter` 随之回到 `hasListeners() === false`；此后若还有帧进来会再入 `pending`——这是 lease 仍被持有但暂时无人听的合法状态，`hadSubscriber` 已为 true，不触发 orphan |

### 3.3 渲染端（`contrib/conversation/browser/conversationEngineFrameSource.ts`）

| 项 | 选定 |
|----|------|
| 订阅点 | `ConversationEngineFrameSource` 构造函数**不再**全局订阅。`EngineSessionViewLease` 在 `acquireLease(...).then(id => …)` 内：`this.leaseId = id; this.lifetime.add(sessionView.onDynamicDidApplyFrame(id)(e => this.onHostFrame(e.frame, e.applied)))` |
| `leases` map | 保留（供 `getCachedProjection` 断连缓存），但不再用于分发 |
| 释放顺序 | `dispose` 时先解除事件订阅再 `releaseLease`（避免 flush 到已释放 replica） |
| 断连缓存 | 不变 |
| ADR-003 | 渲染端仍只 import `common/**` 与 electron-browser 代理，不碰 `node/**` |

### 3.4 Web stub（`browser/universeAgentSessionViewService.ts`）

`onDynamicDidApplyFrame(_leaseId) { return Event.None; }`；`acquireLease` 仍返回 `web-empty:${sessionId}`（HEAD 行为与测试断言不变），其余不变。`universeAgentConnection.test.ts` 契约测试补该方法存在性与返回 `Event.None`。

### 3.5 intent 归属门禁（`node/sessionViewHost.ts`）

| 项 | 选定 |
|----|------|
| 唯一入口 | 新增私有 `postAndDrain(sessionId: string, msg: CoreMessage): PostOutcome`：`core.post` → 若 accepted 则 `drainIntents(sessionId)` → 返回 outcome。HEAD **17** 处 `core.post` 全部改走它（含 `handleIntent` 内嵌套的两处；嵌套 drain 取到的队列已被外层 `slice` 清空，无重复执行）；「同 session 连 post 再 drain」改为两次 `postAndDrain`（intent 队列为空时 `takeIntents` 返回 `[]`，无额外成本）。在 HEAD 的「post 后立刻 drain、sessionId 已知」模型下，归属就是 `postAndDrain` 的参数，**不需要** owner 表 |
| 门禁 | 新测 `sessionViewHostPostDiscipline.test.ts`：用 `import.meta.url` + `fs.readFileSync` 读取 `sessionViewHost.ts` 源码（与 `universeAgentImportBoundaries.test.ts` 同写法），断言 `this.core.post(` 与 `this.core.takeIntents(` 各出现 **1** 次且都在 `postAndDrain` / `drainIntents` 内；**不**写死总数。性质与 boundary 测同级：挡漏改，不挡 `const { post } = this.core` 式绕过 |
| 可观察（HEAD 基线） | `handleIntent` 的 `default` 分支对 `openContinuationStream` / `startTimer` / `cancelTimer` / `unaryCommand` 等未实现 intent **计数** `diagnostics.count('intent.unhandled', { do })`，不再静默丢弃。是否实现这些 intent 属订阅流 Actor 回路那条线，本稿只要求可观察 |
| 可观察（在途 dispatcher 合入后） | 若 `resolveIntentSession` 先合入，则每个分支真正落到 `fallback` 时 `diagnostics.count('intent.owner_fallback', { do })`；`openContinuationStream` 在 `postAndDrain` 模型下由参数归属，不另建 owner 表 |
| 上游缺口 | **G-CORE-1**：`CoreIntent` 不带 `sessionId`、`takeIntents()` 无按会话取用；建议上游在 `emitIntent` 处由 core 盖 `sessionId`（actor 已知自身 id），或提供 `takeIntents(sessionId)`。闭合后宿主归属退化为只读 `intent.sessionId`。回填 [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)（该表虽名「协议缺口」，vendored 依赖缺口也在此登记，注明来源为 session-core 而非 gRPC） |

## 4. 切片

| 切片 | 做什么 | 硬依赖 | 测试 / Exit | 冲突域 |
|------|--------|--------|-------------|--------|
| **F0** 止血（可选，仅当 F1 不能在本轮合入） | `EngineSessionViewLease` 在 `onAcquired` 后调一次 `requestResync()` | — | 新 `conversationEngineFrameSource.test.ts`（HEAD 无此文件；工作树有同名未跟踪文件，以先合入者为准）：fake 在 `acquireLease` resolve **前**同步 fire baseline + 若干 patches（模拟 §1.2 的整个突发），断言 replica 最终含 baseline 内容 | `conversationEngineFrameSource.ts` |
| **F1** per-lease 动态事件 + 首帧缓冲 | §3.1–§3.4 全部 | — | ① 新 `sessionViewHostFanout.test.ts`：两个 lease 各订阅，A 的帧不到 B；订阅前入队的**整个突发**（baseline + patches）在订阅时按序 flush 且首帧 kind 为 `baseline`；pending 超限后首帧仍为 baseline（经 resync）；`hadSubscriber` 为 false 满 5 s 自动 release 并计数，退订后再入 pending 不触发；已释放 leaseId 返回 `Event.None`。② `conversationEngineFrameSource.test.ts`（同 F0 说明）：fake 改为「resolve 前同步 fire 突发」时序，断言不丢；dispose 先退订再 release。③ `universeAgentConnection.test.ts`：Web stub 契约 + `web-empty:` 前缀不变。④ HEAD 现有 `sessionViewHostNavigator.test.ts` 不回归（按 §3.2 关闭 orphan 计时或改为订阅）；`conversationEngineRosterService.test.ts` mock 改名后绿。⑤ 手测：两窗口各开不同会话，DevTools 网络/IPC 记录只见自身 lease 的帧 | `common/universeAgentSessionView.ts` · `node/sessionViewHost.ts` · `electron-main/universeAgentSessionViewService.ts` · `browser/universeAgentSessionViewService.ts` · `contrib/conversation/browser/conversationEngineFrameSource.ts` · 上述测试 |
| **F2** intent 归属门禁 | §3.5（HEAD 基线） | — | `sessionViewHostPostDiscipline.test.ts` 绿；新 `sessionViewHostIntentOwner.test.ts`：两个会话交替 `acquireLease` / `post`，各自 `openStream` 用各自 sessionId 打开（fake transport 记录 sessionId）；`startTimer` 等未实现 intent 触发 `intent.unhandled` 计数而非静默 | `node/sessionViewHost.ts` + 测试 |
| **F3**（候选，不在本稿 Exit） | 同窗口同会话多 lease 渲染端共享 | F1 | 另立切片时补 | `conversationEngineFrameSource.ts` |

F1 与 F2 同文件（`sessionViewHost.ts`），**P 槽单写者串行**：F1 → F2。F0 只在 F1 排不进本轮时做，F1 合入后删除 F0 的 resync。

## 5. 验收（产品可观察 + 工程可观察）

| ID | 场景 | 通过标准 |
|----|------|----------|
| V-F1 | 已连引擎、会话已有 20+ 回合；隐藏 Conversation Part 再显示 | 时间线立即完整（不空白、不等下一条消息才出现）；无 `view.resync` 计数增加 |
| V-F2 | 同上；打开 Navigator Agents 叶 | 树与 Inspect 数据首帧即有，不需要点 Refresh |
| V-F3 | 两个窗口分别连同一引擎、打开不同会话 | 主进程每帧只发一次；关闭其中一窗，另一窗帧流不受影响 |
| V-F4 | 渲染端 `acquireLease` 后立刻关窗 | 5 s 内宿主 lease 释放并进入 linger；`view.lease_orphaned` +1 |
| V-F5 | F2 门禁测 | 源码扫描 `core.post` / `takeIntents` 各 1 处；交替 post 场景 `owner_fallback` = 0 |

## 6. 风险

| 风险 | 缓解 |
|------|------|
| ProxyChannel dynamic event 在渲染端最后一个 listener 移除时会 `dispose` 服务器侧订阅；若消费者频繁订阅 / 退订，帧会反复进 `pending` | 渲染端 lease 生命周期内只订阅一次；`pending` 上限 + resync 兜底 |
| `pending` 缓冲期间 lease 已被 `releaseLease` | release 时清缓冲并 dispose emitter；`onDynamicDidApplyFrame` 对未知 id 返回 `Event.None` |
| 5 s orphan 计时误杀慢启动窗口 | 计时只在「从未有过订阅者」时生效；正常路径 `acquireLease` 回复到 `listen` 是同一 tick 内的连续 IPC，远小于 5 s。参数可调，不进合同 |
| F1 删除 `onDidApplyFrame` 造成其他隐藏消费者编译红 | HEAD grep 生产唯一消费者是 `ConversationEngineFrameSource`，测试侧 `conversationEngineRosterService.test.ts` mock 同刀改；`npm run compile` 作门禁 |
| F1 必须改 `contrib/conversation/browser/conversationEngineFrameSource.ts`，而 [m7 §3](m7-ui-completion-wave.md) 写「P 槽不写任何 UI」、该目录归 B 槽 | 这是删事件带来的编译必改，不是 UI；[m7-gap-closeout §5](m7-gap-closeout.md) 已把该文件划给 F1；实施前与 B 槽写者打招呼即可 |
| F2 的源码扫描门禁被「换个变量名调用 core.post」绕过 | 与 boundary 测同一性质——挡误用不挡恶意；配合 `owner_fallback` 计数在运行时兜底 |

## 7. 知识层回填（实施 commit 时）

- [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)：登记 **G-CORE-1**；§5 会话面补 `onDynamicDidApplyFrame` 与首帧缓冲语义。**已回填** @ 2026-09-04。
- [conversation-stream-timeline §3.2](conversation-stream-timeline.md)：lease 生命周期段补「宿主侧 per-lease 事件 + 订阅前缓冲」一句，并改掉「渲染端按 leaseId 过滤」的描述。**已回填** @ 2026-09-04。
- `docs/modules/platform/overview.md`：`universeAgent` 段 IPC 描述改口。**已回填** @ 2026-09-04。
- [deferred-gaps](../progress/deferred-gaps.md)：F3 渲染端共享 lease 若不做，登记为 D 项。**已登记 D22**。

## 相关

- [ADR-003](../decisions/003-engine-adapter-boundary.md) · [conversation-stream-timeline](conversation-stream-timeline.md) · [navigator-engine-segments](navigator-engine-segments.md) · [m7-ui-completion-wave](m7-ui-completion-wave.md)
- `src/vs/base/parts/ipc/common/ipc.ts`（`ProxyChannel` dynamic event）· `src/vs/base/common/event.ts`（`EmitterOptions.onWillAddFirstListener`）

## 审查记录（规则 16）

**2026-09-03 第一轮：** Cursor CLI `agent -p --mode ask`（默认模型；`cursor-grok-4.6-high` 四次因 API `resource_exhausted` 失败后改用）。**Approve with changes**（2 Critical + 5 Important + 4 Minor）。§1.2「跨进程首帧 baseline 必丢且不自愈」经 reviewer 按 `ChannelServer.onEventListen` 同步 `EventFire` vs `PromiseSuccess` 微任务顺序复核 **成立**。处理：

| 意见 | 处理 |
|------|------|
| C1 `onWillAddFirstListener` 在 `_listeners` 赋值前触发，flush 会被 `fire()` no-op 静默清空 | §3.2 改为 **`onDidAddFirstListener`** 或直接 `Event.buffer`，并要求 F1 测试覆盖「订阅前入队 → 订阅后按序收到」 |
| C2 §1.3 / §3.5 写的是工作树的 `resolveIntentSession` dispatcher，HEAD 没有；`core.post` 是 17 处不是 19；HEAD 未实现的 intent 落 `default` 静默丢弃 | §1.3 重写为 HEAD 事实 + 「在途」行；§3.5 以 HEAD 为基线（`postAndDrain` 参数即归属，不建 owner 表；未实现 intent 计 `intent.unhandled`），dispatcher 合入后才有 `owner_fallback` |
| I1 丢的是整个 acquire 突发（含 `postConnectionUp` 的 patches），不只 baseline；「下一帧 frameId 2」不成立 | §1.2 步骤 3/6 改写；F0/F1 测试改为 fire 整个突发 |
| I2 §3.1 合同塞进 HEAD 没有的 `acknowledge` | 删除；明确方法集只在 HEAD 六方法上换事件名 |
| I3 「现有测试」指向未跟踪文件 | §1.2 末与 §4 改指 HEAD 的 `sessionViewHostNavigator.test.ts` / `universeAgentConnection.test.ts`；新测标「HEAD 无此文件」 |
| I4 boundary 测用的是 `import.meta.url` + `fs.readFileSync` 不是 `FileAccess`；不要写死 19 | §3.5 门禁行改写 |
| I5 5 s orphan 须用「从未有过订阅者」闩；64 → resync 不与 INV-SPC-12 冲突 | §3.2 加 `hadSubscriber` 闩并禁止「当前无 listener 满 5 s」写法；`sessionViewHostNavigator.test.ts` 处置写明 |
| Minor：Web stub `acquireLease` 不拒绝（返回 `web-empty:`）；宿主「fans this to every window」注释在工作树不在 HEAD；`conversationEngineRosterService.test.ts` mock 会编译红；P 槽改 `conversationEngineFrameSource.ts` 与 m7 §3 措辞 | §1.1 / §3.4 / §6 均改入 |

改稿后 `status` 仍为 `review`，待用户签收。

**2026-09-03 签收：** 用户签收。复核 HEAD：`core.post` 17 处、`Emitter.addListener` 顺序与 `Event.buffer` 一致、§1.2 IPC 时序成立；§3.2 时序行 `onWill*` 笔误已改 `onDidAddFirstListener`。`status` → `accepted`，可开 F0（可选）/ F1 → F2。
