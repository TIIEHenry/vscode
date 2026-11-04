---
title: "设计审查 2026-11-04 p4：conversation 大类拆分"
type: plan
status: draft
phase: N/A
updated: 2026-11-04
summary: "名册写路径先收成路由再改组合，连接面板把拨号流程与五分区拆开，Composer 只收镜头内编辑态；代次不并进刷新闸。"
---

# 设计审查 2026-11-04 p4：conversation 大类拆分

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本稿只写拆分顺序。不改产品行为的切片保持现有返回值；已签收、尚未落地的行为变化仍归原来的方案。行号是 2026-11-04 工作区里读到的。`conversationEngineRosterService.ts`、`connectionPreferencesPane.ts`、`conversationLensComposer.ts`、`conversationLensComposerChrome.ts` 不在当日未提交清单里。

分层约束用 [源码组织](../../.github/instructions/source-code-organization.instructions.md) 和仓库根 `.claude/CLAUDE.md`：构造函数注入、`Disposable` / `DisposableStore` 当场注册、用户可见字符串走 `nls.localize`、`contrib` 不引用 `platform/universeAgent/node`、不把只在一处用的类型 export 出去。产品窗口仍是默认编辑器，见 [愿景](../../docs/product/vision.md)。全景分层见 [架构概览](../../docs/architecture/overview.md)。

## 冲突域与切片顺序

| 顺序 | 切片 | 文件 | 依赖 | 行为 |
|:-----|:-----|:-----|:-----|:-----|
| 1 | p4-1a 写路径路由 | `conversationEngineRosterService.ts` | 无 | 不变 |
| 2 | p4-2a 五分区 widget | `connectionPreferencesPane.ts` 与新建分区文件 | 可与 1 并行。不搬 connect / forget / direct 的过程 | 不变 |
| 3 | [r11-1](review-2026-10-30-r11-conversation-plan.md) | 仍是现在的 `ensureDirectAddressProfileForConnect` | 已签收，本稿不重写。必须在 p4-2b 之前落地 | 按 r11-1 变 |
| 4 | p4-2b 拨号流程服务 | `connectionProfileFlow.ts` + 面板里的 connect / forget / direct | r11-1 已在树上 | 不变，搬走的是 r11-1 之后的顺序 |
| 5 | p4-1b 继承改组合 | roster 与 `conversationStubService.ts` 的内部可见性 | p4-1a | 不变 |
| 6 | p4-3a / p4-3b Composer 模型 | 透镜与 composer / chrome / dock | 与 [p3](review-2026-11-04-p3-session-scope-plan.md) 第 2 条串行，本片先。不搬按会话的权限 / 模型 | 不变 |
| 7 | p4-4 | 不改代码 | 见该节与 [p1](review-2026-11-04-p1-capability-write-gate-plan.md) 第 4 条 | 无 |

可以并进同一次提交的只有「无依赖、且不改同一方法」的片。p4-1a 与 p4-2a 可以并行。p4-2b 不要和 r11-1 混在同一次提交里。p4-3 不要和 p3 第 2 条同时改 `sessionConfigBySessionId`、`modelProfileIdBySessionId` 和两套 epoch。

当日工作区里另有未提交改动，包括 `docs/systems/conversation/stub-and-fixtures.md`、`session-windows.md` 和若干 `engine*Section.ts`。实施时只暂存本切片的路径。

## 不推翻，也不新造协议

- [ADR-003](../decisions/003-engine-adapter-boundary.md) 决策 4：公开类型仍是 `IConversationRosterService`，decorator id 仍是 `'conversationStubService'`。`conversation.contribution.ts` 仍 `registerSingleton` 到 `ConversationEngineRosterService`。不注册第二个名册 token。
- [stub-and-fixtures §5.2](../../docs/systems/conversation/stub-and-fixtures.md)：夹具方法留在这份接口上。默认不拆接口，见待定项。
- [stub-and-fixtures §2](../../docs/systems/conversation/stub-and-fixtures.md) 的转发语义：接通后的布尔 `true` 只表示已发出；Enqueue 在接通时拒收且不发 RPC；队列无 GetQueue；断连缓存不把 fixture 当成引擎队列。
- [r11-1 签收](review-2026-10-30-r11-conversation-plan.md)：直连替换在拨号成功之后才 forget。成功看 `connectProfileWithPairing` 返回后 `connectedProfileId === 新 profileId`。不改 `connectProfileWithPairing` 的签名。
- [r11-3](review-2026-10-30-r11-conversation-plan.md) 与 [ADR-012](../decisions/012-leftover-accepted-value-vs-write-affordance.md)：权限 / 模型的已接受值与可写性分开。本稿不改 `drainSessionModel` / `drainSessionPermission`。
- [engine-write-gate S4](engine-write-gate-unification.md) 已落：Test Connection 的闸是 `testGeneration` + 起始 `activeProfileId` + dispose，profile 探测不比当前连接 link。过期只清「Testing…」。同 id 重选不加代。
- [connection-dial-generation](connection-dial-generation.md)：平台 `_connectEpoch` 的加代规则不动。不改 `universeAgentConnectionService.ts`。
- 不新增 RPC，不给连接快照加字段。

## p4-1 名册：重复的后端选择

问题类：`ConversationEngineRosterService` 用继承盖住 stub，二十多个写方法各写一遍「配对保持、列表失败、已连接、曾连接、否则 stub」，但后三段的返回值并不相同。

证据：

- 类在 `conversationEngineRosterService.ts:74`，`extends ConversationStubService`。文件 2299 行。`git log` 该路径 120 次提交，其中 subject 以 `fix` 开头的 51 次。
- `override` 这个词出现 51 行：4 行是事件字段（82、84、88、90），其余是方法。
- `IConversationRosterService` 在 `conversationStubService.ts:91`。夹具成员 `setMessageQueueFixture`（278）、`setAutoDriveTaskFixture`（311）、`setEngineConnected`（313）、`appendStubEchoAssistant`（226）都在这个接口上。生产类对前两个和 `appendStubEchoAssistant` 的实现在 679、700、888。`setEngineConnected` 的引擎实现在 239，里面有目录刷新和缓存，不是把 stub 方法再包一层。`super.setEngineConnected` 还有 `onUaConnectionChanged`（1786）里的 1799 与 1806。1806 仅当 `testEngineConnected === undefined`（1805）。`onDidChangeEngineConnection` 的 `fire` 在 stub 的 `setEngineConnected`（`conversationStubService.ts:840`）。
- 引擎直接 `fire` 继承来的 `_onDidChangeSession`（首见 133）、`_onDidChangeActiveSession`（230、409）、`_onDidDeleteSession`（首见 1753）。这三只 Emitter 声明在 stub 上：`_onDidChangeActiveSession` 348，`_onDidChangeSession` 351，`_onDidDeleteSession` 354。
- `hasLeftoverEngineCatalogListFailed`（204）在 24 个写方法里作为第二道拒绝，从 `createSession`（436）到 `deleteSession`（876）。

这 24 个里，下面 16 个布尔方法的后三段相同：已连接调用引擎辅助函数且 `callRemote === true`，曾连接调用同一个函数且 `callRemote === false`，否则 `super`。名单：`renameSession`（457）、`cancelGeneration`（473）、`setSessionGoal`（489）、`cancelSessionGoal`（505）、`forkSubAgent`（528）、`killSubAgent`（544）、`createSnapshot`（560）、`cancelToolCall`（576）、`retryError`（592）、`deleteTurn`（608）、`updateUserTurnText`（624）、`retryMessageQueueItem`（656）、`resolveConfirmation`（824）、`respondClientTool`（840）、`respondQuestion`（856）、`deleteSession`（872）。

另外 8 个不能并进这 16 个：

| 方法 | 已连接 | 曾连接 | stub |
|:-----|:-------|:-------|:-----|
| `createSession`（432） | 异步 `ensureEngineSession`，同步返回 `''` | 返回 `''` | `super` |
| `enqueueMessageQueueItem`（640） | 直接 `false`，不调用 `enqueueEngineQueueItem` | `enqueueEngineQueueItem(..., false)` | `super` |
| `pauseMessageQueue` / `resumeMessageQueue` / `clearMessageQueue`（707、723、739） | `forwardEngineQueueRef(..., true)` | 空返回，不调用 `super`，也不发 RPC | `super` |
| `holdMessageQueueItemWithSettlement`（759）、`releaseMessageQueueItemHoldWithSettlement`（784） | 带 settlement 的转发 | `{ sent: false }` | `super` 后 `{ sent: true }` |
| `updateMessageQueueItemContentWithSettlement`（808） | `editEngineQueueItemWithSettlement(..., true)` | `{ sent: false }`，不调用 edit 的 false 臂 | `{ sent: super... }` |

`holdMessageQueueItem`（755）、`releaseMessageQueueItemHold`（780）、`updateMessageQueueItemContent`（804）只转发到 settlement，梯子在 settlement 上。`updateMessageQueueItemContentWithSettlement` 与 `releaseMessageQueueItemHoldWithSettlement` 没有 `override`：stub 类没有这两个方法体，接口上它们是可选的（`conversationStubService.ts:268` 是 update，`:299` 是 release）。

下面这些不进这把路由：

- `switchSession`（403）：配对保持时仍在引擎会话之间切换。
- `getSessionGoal`（521）、`getMessageQueueState`（672）、`getAutoDriveTasks`（686）、`getAutoDriveTaskCount`（693）：已连接或曾连接走引擎侧空 / 本机表，不先拒绝配对保持。
- `setMessageQueueFixture`（679）、`setAutoDriveTaskFixture`（700）：已连接或曾连接直接返回。
- `appendStubEchoAssistant`（888）：只在 `isEngineConnected()` 时抛错。曾连接仍 `super`。

不变量：

- 上表 16 个布尔方法与 8 个例外的五行返回值保持现状。路由函数只回答走哪一支，不统一返回值。判断顺序固定为 pairingHold、leftoverListFail、connected、cachedDisconnect、stub。三处都不能交换：生产路径上配对保持时 `isConversationEngineLive` 为假（`conversationSessionStatus.ts:45–46`），但 `wasEverConnected` 可以仍为真，所以配对先于曾连接；第一次配对时 `wasEverConnected` 可以为假，配对也必须先于 stub，否则 `createSession` 会走到 `super.createSession()`；`setEngineConnected(true)` 把 `testEngineConnected` 钉上之后，`isEngineConnected`（156–158）可以在配对保持期间仍返回真，所以配对也必须先于 connected。
- 接通时 `enqueueMessageQueueItem` 继续返回 `false` 且不发 RPC。
- 曾连接时 pause / resume / clear 继续既不发 RPC 也不改 stub 队列。
- `appendStubEchoAssistant` 在曾连接、当前未连接时仍进入 stub。
- `onDidChangeEngineConnection` 仍只由 stub 的 `setEngineConnected` 发出，再经引擎转发。生产上的 `super.setEngineConnected` 有三处，组合后都改调 stub 实例：`setEngineConnected` 内的 249，`onUaConnectionChanged` 接通时的 1799，断开时的 1806。1806 仍只在 `testEngineConnected === undefined` 时调用。会话列表（`conversationSessionsView.ts:285`）、透镜（`conversationLens.ts:398`）、身份条（`conversationIdentityStrip.ts:214`）订的是引擎上的这个事件。
- `_onDidChangeSession`、`_onDidChangeActiveSession`、`_onDidDeleteSession` 在丢掉 `extends` 之后仍声明在引擎上。引擎现有的直接 `fire` 继续打这三只。它们不进「改调 stub 实例」的 protected 清单。stub 方法自己 `fire` 的同名事件由构造里的转发投到引擎 Emitter，同一次变化只投递一次。
- 装饰器 id、`registerSingleton` 的类、夹具方法仍在 `IConversationRosterService` 上（待定项未改口之前）。
- `shouldSkipLocalPersistence`（976）在 `wasEverConnected` 时为真：stub 的本地持久化继续跳过。存储键仍是 `conversation.roster.v1`。

要动的符号与文件：

- p4-1a：在 `conversationEngineRosterService.ts` 增加私有 `routeRosterWrite()`，返回 `'pairingHold' | 'leftoverListFail' | 'connected' | 'cachedDisconnect' | 'stub'`。24 个写方法的 if 梯子改成对这个结果的分支。引擎辅助函数（`cancelEngineGeneration`、`enqueueEngineQueueItem`、`forwardEngineQueueRef` 等）不动。
- p4-1b：`ConversationEngineRosterService` 不再 `extends ConversationStubService`。内部 `_register(new ConversationStubService(...))`。对外事件仍是引擎自己的 Emitter。`_onDidChangeSession`、`_onDidChangeActiveSession`、`_onDidDeleteSession` 改在引擎类上声明；引擎现有的直接 `fire`（133，230 与 409，1753）继续打这三只，不改成调用 stub 上的 protected 字段，也不只靠订 stub 的公开事件。stub 方法自己 `fire` 的 `onDidChangeSession`、`onDidChangeActiveSession`、`onDidDeleteSession`、`onDidChangeEngineConnection` 由构造里的转发投到引擎 Emitter，不把 stub 的 Emitter 字段公开。同一次变化只投递一次：引擎自己的 `fire` 不再进 stub。stub 路径改为调用这个实例。引擎今天经继承用到、组合后要变成显式调用的是：`model`（999、2190、2213、2244、2266）、`loadedStorage`（140、2124）、`storageService`（2124、2195、2256）、`configurationService`（2183）、`rewriteTrajectoryMessageLinks`（356）、`projectSnapshotToLegacyTurns`（387、2202、2285）、`saveRosterStorage`（2261）。这些成员现在是 `protected`，另一个类的实例调不到。改成同一目录内可调用，不放进 `IConversationRosterService`。上面三只 Emitter 不在这份显式调用清单里。引擎文件不直接调用 `frameSource` 或 `persistLocalRoster`。
- `setEngineConnected`（239）留在引擎类。它先写 `testEngineConnected`，断开时增加 `connectionGeneration` 并在原先已连接时 `captureEngineCache`，然后才调用 stub 的同名方法；接通时可能置 `wasEverConnected`、刷新目录，并重新绑定 live tree。`super.setEngineConnected` 有三处换成对 stub 实例的调用：本方法里的 249，以及 `onUaConnectionChanged` 接通时的 1799、断开时的 1806。1806 仍包在 `testEngineConnected === undefined`（1805–1807）里，这个条件不放宽。这三处是 `onDidChangeEngineConnection` 的生产来源。方法体不搬进 stub。

切片：

1. p4-1a。每个方法保留自己的返回。`connected` 对 enqueue 仍是 `return false`。pause / resume / clear 在 `cachedDisconnect` 仍是空返回。`createSession` 在 `connected` 仍是启动 `ensureEngineSession` 并返回 `''`。行为不变。
2. p4-1b。引擎服务仍是唯一 singleton，也是 UI 订阅的唯一事件源。三只会话 Emitter 留在引擎上；stub 实例的 Emitter 只在引擎转发时被看见：转发函数挂在构造里，`_register` 到引擎上。引擎自己 `fire` 的目录事件和这三只会话事件不要再经 stub 转一圈。249、1799、1806 三处都改调 stub 实例，1805 的条件保留。`shouldSkipLocalPersistence`（976）今天挡住的是 stub 的 `persistLocalRoster`（`conversationStubService.ts:611`）。`appendStubEchoAssistant` 在写出回合后经 `notifySessionChanged`（639）走进这次持久化。组合之后引擎上的 override 不再作用在 stub 实例上。stub 构造函数在现有两个可选参数之后再加一个可选的 `shouldSkipLocalPersistence` 回调，缺省仍返回假；引擎传入 `() => this.wasEverConnected`。不改存储键，也不改对外接口。行为不变。

`setMessageQueueFixture`、`setAutoDriveTaskFixture`、`appendStubEchoAssistant` 的方法体可以随 stub 实例走，生产类按现有条件委托或拒绝。`setEngineConnected` 不在这三份里。这是搬家，不是从接口删除。

明确不改什么：

- `IConversationRosterService` 的成员列表、decorator id、`conversation.contribution.ts` 的注册类。
- 读路径：`getSessions`、`getTurns`、`getTrajectoryRecords`、`acquireSessionView`、`switchSession`、就绪度。
- 平台连接服务、快照字段、任何 RPC。
- [p3](review-2026-11-04-p3-session-scope-plan.md) 的会话作用域。本条不引入 `ISessionScope`。

本地验证（行为不变，不改断言）：

```bash
./scripts/test.sh --glob '**/vs/workbench/contrib/conversation/test/**/*.test.js' --grep 'KEEP leftover list-fail renameSession|leftover-looks-live cancelGeneration|leftover-looks-live queue mutates|appendStubEchoAssistant is rejected|unconnected path still uses stub|connected MessageQueue mutations forward|disconnected after engine MessageQueue|connected AutoDrive ignores fixture|never-connected retryMessageQueueItem|hold settlement is explicit'
```

文件：`src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`。p4-1b 再加 `conversationEngineRosterLiveTree.test.ts` 里现有的绑定用例。队列 hold / release 也在这份名册测试里，不在 `conversationStubService.test.ts`（该文件没有 `holdMessageQueueItem`）。`KEEP leftover list-fail renameSession deleteSession and mutators reject and skip unary` 的 hold / release 在 1715、1716，已由上面的 grep 覆盖。`hold settlement is explicit and does not release the item`（4588）里，4599 是 `holdMessageQueueItemWithSettlement` 调用，不 release 的断言在 4602（`releaseQueueCalls` 仍为空）。靠新增的那段 grep 跑到这个测试。切片同时跑改动文件的 `npx eslint` 和 `npm run compile-client`。

风险与回退：p4-1a 的风险是把 8 个例外收成 16 个布尔方法的形状，接通 enqueue 就会发出不该发的 RPC。回退只还原该文件。p4-1b 的风险是事件双发、stub 在曾连接后仍写本地桶、dispose 漏掉 stub、`onUaConnectionChanged` 少调 stub 导致连接事件不再冒出、或把三只 Emitter 挪到 stub 上导致引擎自己的 `fire` 丢失。回退 p4-1b 时保留 p4-1a。

## p4-2 连接面板：流程与分区

问题类：`ConnectionPreferencesPane` 同时拥有五个分区的 DOM、六套代次，以及 connect / forget / direct 的多步过程；面板上的「已落定 profile」和平台拨号时写下的 profile 不是同一份状态。

证据：

- 文件 2734 行。`ConnectionPreferencesPane` 从 425 行到 2734 行。分区 id 在 98 行：`hub | devices | direct | profiles | test`。导航表在 100–106 行。
- 构造前的 `private` 字段 80 个（427–512）。
- 六套代次：`engineDevicesRefreshGeneration`（486）、`hubDirectoryRefreshGeneration`（487）、`enginePendingRefreshGeneration`（488）、`testGeneration`（493）、`latestTestRunGeneration`（495）、`_forgetProfileGeneration`（500）。
- `activeProfileId`（492）是列表选中，选择变化时写入（793）。直接赋值还有五处，都不经过这个回调：1634（`handleAddDirectAddress`）、1731（直连确保成功）、1822（`handleForgetSelectedProfile` 清成 `undefined`）、1931（`connectProfileWithPairing` 在入口检查和可选确认之后；1918–1919 与 1922–1926 的返回都不写它）、2663（`renderProfiles` 在 `syncingProfiles` 为真时选中第一项）。`syncingProfiles` 声明在 476，置真在 2653；选择回调在 786 见到它就返回。`connectedProfileId`（497）唯一被写成具体 id 的地方是 `rememberSettledConnect`（2037–2041）：`result.ok` 且不是配对挂起、也不是 recoverTrust。1757、1779、1809 只把它清成 `undefined`。
- 平台 `_activeProfileId` 在 `universeAgentConnectionService.ts:655`。拨号接管时、尚未处于已发布连接就写（3122，`_takeOverEntry`）。提交成功且带 `profileId` 时写（3209）。未发表链路收尾时，仅在当前为空才写（3249）。断开时清掉（1378）。配对开始且 id 相同则清掉（3306）。这些清除不拿来和面板的落定 id 对齐。`_publishedProfileId`（664）在 `_publishCommittedLink` 里与已发布链路一起写（2968），在 `_clearPublishedLink` 里清掉（2975）。
- `isConnectWriteHeld`（1219）是四件事的或：`connectInFlight`、`engineSwitchPromptOpen`、设备配对保持、面板内配对确认还在。`connectProfileWithPairing` 入口 1918–1919 在它为真时直接 return，随后才在 1928 置 `connectInFlight`。直连调用带 `skipEngineSwitchConfirm`（1732），确认用的 await 不会插在这次入口检查和置锁之间。`writeHoldReason`（2101）的文案顺序是另一套：先设备配对保持，再 in-flight，再切换确认，再面板内配对确认。后面还有列表未就绪（2114）和兜底句（2117），设备按钮在列表失败时也用这两句（2125）。
- 直连现状仍是先 forget、必要时 disconnect、再 add（1736–1761）。这和 r11-1 签收的顺序相反。r11-1 还没落地。

不变量：

- `connectedProfileId`、`activeProfileId`、`_activeProfileId`、`_publishedProfileId` 继续各写各的时机。服务对外只暴露面板这份「成功落定后的 id」，不读取、不改写平台那两个字段，也不把这份 id 放进连接快照。
- `rememberSettledConnect` 的三个早退条件保留：失败、配对仍挂起、recoverTrust 都不记 id。
- `writeHoldReason` 整段原样搬家，文案顺序不按 `isConnectWriteHeld` 里或表达式的书写顺序重排。列表未就绪和兜底句留在这段里，不收进那四个锁原因。锁的文案和四个原因只有一个主人。这不是把确保档占用和 `connectInFlight` 收成进入拨号时仍为真的同一布尔。
- [r11-1](review-2026-10-30-r11-conversation-plan.md) 的占用交接保持两段。确保档期间的写入占用在调用 `connectProfileWithPairing` 之前同步放下；放下和该方法置上 `connectInFlight` 之间没有 await。该方法入口若 `isConnectWriteHeld()` 就 return（1918–1919）。确保占用若在入口仍为真，直连在入口返回，拨号不会发生。`connectInFlight` 仍由该方法在自己的第一个 await 之前置上。服务可以同时拥有这两段状态，但不能让确保占用在进入拨号时仍为真。
- Test 分区继续按 [S4](engine-write-gate-unification.md) 使用两支判断。有 profile 的 `profileProbeCurrent`（2172）只比 `testGeneration`、起始 `activeProfileId` 和 dispose。无 profile 的 `engineProbeCurrent`（2175）在这之上再比已发布 identity 和 link。选中变化加的是 `testGeneration`（792–794），不是 `latestTestRunGeneration`。1634、1731、1822、1931、2663 对 `activeProfileId` 的赋值都不经过列表选择回调，因此不加 `testGeneration`。1634 在 `handleAddDirectAddress`，这个方法留在面板。1822 在要搬走的 `handleForgetSelectedProfile` 里把 id 清成 `undefined`，清法仍是直接赋值。2663 在 `syncingProfiles`（2653；标志在 476）为真时选中第一项；搬 Profiles 时这个标志和选择回调（786）一起走。服务不拥有选择 id；它通知面板写入，面板用和现在一样的直接赋值。
- 列表刷新代次仍只丢掉过期的列表结果。forget 代次仍只决定状态行归谁：更新一次 forget 已经发出时，这次调用在 `result.ok` 且 id 仍是 `connectedProfileId` 时仍会 `disconnect`（1797–1810），即使状态行已经属于下一次。
- r11-1 的成功判据不变：不改 `connectProfileWithPairing` 的签名；返回之后用落定 id 是否等于新 `profileId` 判断要不要 forget。

要动的符号与文件：

- p4-2a 新建五个分区 widget，都 `extends Disposable`，由面板 `_register`。构造函数注入它们用到的服务，不从面板私有字段里掏。建议文件：`connectionPreferencesHub.ts`、`connectionPreferencesDevices.ts`、`connectionPreferencesDirect.ts`、`connectionPreferencesProfiles.ts`、`connectionPreferencesTest.ts`，与面板同目录。面板留下导航、`activeZoneId`、布局、`layoutLists` 的尺寸分配。
- p4-2b 新建 `IConnectionProfileFlow` / `ConnectionProfileFlow`。文件放 `src/vs/workbench/contrib/conversation/browser/connectionProfileFlow.ts`，在 `conversation.contribution.ts` 里 `registerSingleton`。这是给面板和分区注入的工作台服务。类不放进 `workbench/services`：[ADR-003](../decisions/003-engine-adapter-boundary.md) 决策 6 允许放在那一层的是窗口生命周期装配，并禁止在那一层定义 roster 接口。本流程要读名册上的待确认座（`engineSwitchPendingAttentionCount`，1648）。放进 `workbench/services` 就要么把名册引进那一层，要么把「取消切换则不 forget」从流程里拿掉。类留在 contrib，继续注入现有的 `IConversationRosterService`，与面板今天的依赖相同。不持有 DOM。配对确认 UI 仍由面板挂上，服务在需要确认时调用面板传入的回调。服务拥有 `rememberSettledConnect` 的条件、`getSettledProfileId()` / `onDidChangeSettledProfile`，以及确保占用和 `connectInFlight` 这两段状态。两段不合成一把在进入 `connectProfileWithPairing` 时仍为真的锁：确保占用在调用该方法之前同步放下，其间没有 await；该方法仍在入口看到占用就 return，并在自己的第一个 await 之前置上 `connectInFlight`。`_forgetProfileGeneration` 跟 forget 走。`activeProfileId` 的写入留在面板，包括 1822 把选中 id 清成 `undefined`。`handleAddDirectAddress` 不进这个服务，1634 留在面板。

切片：

1. p4-2a。把各分区的 DOM 字段和只服务该分区的渲染、刷新代次搬进 widget。connect / forget / direct / `connectedProfileId` 先留在面板，通过很小的回调或只读访问让分区刷新。行为不变。Hub、Devices、Test 可以先搬；Direct 与 Profiles 的按钮仍调用面板上的现有方法。搬 Profiles 时 `syncingProfiles`（476、2653）和选择回调（786）一起走，2663 对第一项的赋值仍是直接赋值。
2. r11-1 按已签收方案改当前方法。本稿不重复它的工序。这一步是行为变化，提交独立。
3. p4-2b。把 r11-1 之后的 `handleConnectDirectAddress`、`ensureDirectAddressProfileForConnect`、`handleConnectSelectedProfile`、`handleDisconnect`、`handleForgetSelectedProfile`、`connectProfileWithPairing`、`engineSwitchPendingAttentionCount`、`writeHoldReason` 的顺序搬进服务。有待确认座位时用户取消切换，仍然在 forget 和 disconnect 之前返回。搬走时保留 r11-1 的占用交接，不把确保占用和 `connectInFlight` 收成一把锁。面板和分区收集输入、挂配对 UI、写状态行，并按服务给出的原因显示现有文案。行为相对 r11-1 落地之后不变。

明确不改什么：

- `universeAgentConnectionService.ts` 的 `_activeProfileId`、`_publishedProfileId`、`_connectEpoch`。
- S4 的 Test 闸、`probeConnectionProfile`、同 id 重选不加 `testGeneration`。
- 五个分区的可见文案、导航项、窄宽时的列表 / 详情切换。
- 设备列表、Hub 目录、pending 列表的刷新代次语义。它们留在对应 widget，不进拨号服务，也不换用 `EngineRefreshGate`（见 p4-4）。

本地验证：

p4-2a 不改断言，跑：

```bash
./scripts/test.sh --glob '**/vs/workbench/contrib/conversation/test/**/*.test.js' --grep 'Direct Connect forgets|profile Test Connection|older profile Test Connection|re-selecting the same profile keeps an in-flight|disconnecting pairing host cancels SAS'
```

文件：`connectionPreferencesPane.test.ts`（同 id 重选用例在 1738 行）、`connectionPreferencesPaneSas.test.ts`（`disconnecting pairing host cancels SAS and releases document focus trap`）。无 profile 的探测还要带着 `engine Test Connection link change mid-probe`。

p4-2b 在 r11-1 的断言已经按新顺序改完之后，再跑同一 glob 里 r11-1 点名的两个测试名：`Direct Connect forgets a host:port profile and disconnects only after that forget succeeds`，`Direct Connect forget failure does not add or disconnect`。拨号失败时不 forget、不 disconnect，是前一个测试里的断言（r11 方案对该测试的改写），不是独立标题。add 失败不调用 forget / disconnect，以及 add 成功之后 forget 失败则不 disconnect，是后一个测试改写后的断言，也不是另外的标题。服务没有把落定 id 写进快照的断言：拨号进行中 `getSettledProfileId()` 仍是旧值，只有 `rememberSettledConnect` 的成功条件成立才变成新 id。

风险与回退：p4-2a 回退就是把 widget 合回面板。p4-2b 若在 r11-1 之前搬走，会把「先 forget 再 add」固化成服务合同，随后还要再改一次顺序。所以 p4-2b 以 r11-1 已落地为前提。把 `writeHoldReason` 按或表达式的顺序重排，配对保持和 in-flight 重叠时禁用句会变，这是行为变化，不允许进「不变」切片。若确保占用在进入 `connectProfileWithPairing` 时仍为真，入口直接返回，拨号不会发生。服务若改用列表选择回调去写 `activeProfileId`，或搬走 Profiles 时把 `syncingProfiles` 和选择回调拆开，会误加 `testGeneration`，把正在进行的 Test 作废。

## p4-3 Composer：自由函数改模型

问题类：Composer 的可变编辑态放在宿主字段上，由 chrome 自由函数直接赋值；同一组字段在透镜类和两份 host 接口上各声明一次。按会话的权限 / 模型归属不在本条。

证据：

- `IConversationLensComposerHost`（`conversationLensComposer.ts:40–82`）38 个成员。其中 5 个是注入服务：`stubService`、`instantiationService`、`configurationService`、`storageService`、`uaConnection`。
- `conversationLensComposerChrome.ts` 1643 行。顶层函数 63 个，其中 `export function` 40 个；另有非导出类 `ComposerSelectBox`（951）。
- chrome 自由函数对 `host.<字段> =` 的赋值：12 个字段、30 处、14 个函数。核查稿的 13 个函数少计了一个。字段是 `tuneContextView`、`moreContextView`、`composeDraftSnapshot`、`composerPolicy`、`editingTurnId`、`editingQueueItemId`、`queueEditSettlementItemId`、`modelSelectedIndex`、`inputHistoryBrowse`、`postFailureVisible`、`sendFailureTimeout`、`modelProfileIdBySessionId`。这 10 个进模型的字段不全是 chrome 在写：`conversationLensDock.ts:449` 在输入时重置 `inputHistoryBrowse`；`conversationLensComposer.ts:549` 与 `:552` 写 `queueEditSettlementItemId`。
- `host.composerPolicy =` 只有三处：434 `turnEdit`、466 `queueEdit`、508 `compose`。
- 存储在 `ConversationLens`：`composerPolicy`（`conversationLens.ts:285`）、编辑 id 与 `composeDraftSnapshot`（286–289）、`modelProfileIdBySessionId`（293）。接口上再声明一遍：`conversationLensComposer.ts:42` 与 `:49`，`conversationLensComposerChrome.ts:121` 与 `:142`。`conversationLensDock.ts:98`、`conversationLensProjection.ts:65`、`conversationLensSessionBar.ts:65`、`conversationComposerAt.ts:46` 也声明 `composerPolicy`。`editingQueueItemId` 与 `queueEditSettlementItemId` 还出现在 `conversationLensProjection.ts:98–99`、`conversationLensSessionBinding.ts:52–53`。`conversationSessionAvailability.ts:100` 只声明 `queueEditSettlementItemId`，这个文件没有 `editingQueueItemId`。透镜自己在 419–420 关掉 `tuneContextView` / `moreContextView`，在 441、476 读 `composerPolicy`。`conversationSessionAvailability.ts:110` 读 `queueEditSettlementItemId`。`conversationLensSessionBinding.ts:248` 读 `editingQueueItemId`。`conversationEditorPane.ts:272–277` 与 `conversationLeafSessionBar.ts:43–44`、213–218 读 `composerPolicy` / `composeDraftSnapshot`。`conversationTimelineHost.ts` 的 `editingTurnId` 是时间线自己的字段，不是这 10 个模型字段。
- 权限 / 模型 epoch 在 chrome 文件 1138–1163 行，按 host 放在模块级 `WeakMap`。这是 [p3 第 2 条](review-2026-11-04-p3-session-scope-plan.md) 要搬的会话配置，不是本条的模型字段。

不变量：

- `composerPolicy` 仍只有这三处赋值，转移进模型方法之后次数和取值不变。
- `submitDraft` 继续读现有的目录下标和 `modelProfileId`。发送公式不动。
- `drainSessionPermission`、`drainSessionModel`、`applySessionModelIndex` 里对 rollback / confirmed 的写入不动。r11-3 落地前，在飞时仍会把 rollback 写成当时的下标；落地后再遵守 r11-3。本条两种情况下都不改这段。
- 同一透镜上的编辑态仍只属于该透镜。不把两份透镜的 `composerPolicy` 合成一份。那是另一个问题和 p3 的范围。
- 队列编辑的 settlement、Exit 是否 release，保持 [composer-and-inbox §2](../../docs/systems/conversation/composer-and-inbox.md) 的现行为。

要动的符号与文件：

- 新类 `ConversationComposerModel`，文件 `conversationComposerModel.ts`，与透镜同目录。`ConversationLens` 构造时 `_register`。私有字段先收这 10 个：`composerPolicy`、`editingTurnId`、`editingQueueItemId`、`queueEditSettlementItemId`、`composeDraftSnapshot`、`inputHistoryBrowse`、`tuneContextView`、`moreContextView`、`postFailureVisible`、`sendFailureTimeout`。写入方法包括 chrome 的 `beginTurnEdit`、`beginQueueEdit`、`exitComposerEdit`、`cancelQueueEdit`、`resetInputHistoryBrowse`、`navigateInputHistory`、`exitInputHistoryBrowse`、`showGateNotice`、`toggleTuneContextView`、`toggleMoreContextView`，以及 dock 对输入历史的重置、`conversationLensComposer.ts` 对 `queueEditSettlementItemId` 的两处赋值。变化用一个 `onDidChange`。
- `modelSelectedIndex` 与 `modelProfileIdBySessionId` 不进这个类。p3 第 2 条拿走的是两张 map 和两套 epoch；宿主继续把下拉画在自己的 `modelSelectedIndex` 上（p3 写明 host 只负责画下拉，`submitDraft` 仍读这个下标）。p4 不把下标收成两个视图共用的一份。p3 落地前，chrome 仍写宿主上的这两项。
- p4-3b 删掉已经进模型的字段。`composerPolicy` 的重复声明在 `conversationLensComposer.ts:42`、`conversationLensComposerChrome.ts:121`、`conversationLensDock.ts:98`、`conversationLensProjection.ts:65`、`conversationLensSessionBar.ts:65`、`conversationComposerAt.ts:46`、`conversationLeafSessionBar.ts:43`。`composeDraftSnapshot` 在 chrome host（130）、`conversationLensSessionBar.ts:66`、`conversationLeafSessionBar.ts:44`，不在 `IConversationLensComposerHost`。`editingQueueItemId` / `queueEditSettlementItemId` 的重复声明在 `conversationLensProjection.ts:98–99`、`conversationLensSessionBinding.ts:52–53`。`conversationSessionAvailability.ts:100` 只声明 `queueEditSettlementItemId`。改为读模型的还有：`conversationLens.ts:419–420`、`:441`、`:476`，`conversationLensProjection.ts`（含 238–239），`conversationLensSessionBinding.ts:248`，`conversationSessionAvailability.ts:110`，`conversationLensDock.ts`，`conversationLensSessionBar.ts`，`conversationComposerAt.ts`，`conversationLensComposer.ts`，`conversationEditorPane.ts:272–277`，`conversationLeafSessionBar.ts:213–218`。按这份清单改。DOM 字段（textarea、按钮、gate）仍留在宿主上。`conversationTimelineHost.ts` 的 `editingTurnId` 不动。

切片：

1. p4-3a。透镜持有模型。上述写入改成模型方法。宿主字段若暂时留下，必须是 getter / setter，写的是模型里的同一份值。dock 的输入重置和 composer 的 settlement 赋值不能只改宿主、不改模型。行为不变。
2. p4-3b。删除转发字段和接口上的重复声明。按上面的声明和读者清单改为读模型、调用方法，不再写这 10 个宿主字段。行为不变。

明确不改什么：

- p3 第 2 条的归属：不把 `sessionConfigBySessionId` / `modelProfileIdBySessionId` / epoch `WeakMap` 收进名册或新的会话配置服务，也不改「两个视图各有一份」的现状。
- r11-3 的工序、空模型槽、`sentModelId` 与 `resolvedModelId` 的取舍。
- `IConversationLensComposerHost` 上的 5 个服务成员和发送、目录刷新函数的门闩。
- 底栏 DOM 结构和文案。

本地验证（不改断言）：

```bash
./scripts/test.sh --glob '**/vs/workbench/contrib/conversation/test/**/*.test.js' --grep 'overlapping switchModel|leftover model keeps the accepted|selecting the empty model|turnEdit|queueEdit'
```

`conversationLensDisposeGate.test.ts` 在这个 glob 里。与源码并排的 `browser/conversationLensComposerChrome.test.ts` 不在 `**/test/**/*.test.js` 里；p4-3 再跑：

```bash
./scripts/test.sh --glob '**/conversationLensComposerChrome.test.js' --grep 'turnEdit|queueEdit'
```

风险与回退：模型若顺手收走 `modelProfileIdBySessionId` 或 `modelSelectedIndex`，会和 p3 抢状态，或把每个视图自己的下标收成一份。p4-3 的回退还原透镜、chrome、dock、composer，以及上面读者清单里的文件，不动 epoch。p4-3a 的转发若不是 getter / setter，输入历史会在宿主和模型上各有一份。p4-3b 要在转发被测试覆盖之后再删字段。读者清单是改动范围。`compile-client` 能抓住「从共享接口删了字段、引用还在」；抓不住清单之外、自带一份同名字段的结构类型（`conversationSessionAvailability.ts`、`conversationLensSessionBinding.ts`、`conversationLensProjection.ts` 的队列编辑 id）。先按清单改这些文件，再跑 `compile-client`。

## p4-4 代次：不抽通用原语

问题类：Composer 的按会话选择器、连接面板的六套计数、目录分区的刷新闸，外形都像「代次」，语义不是同一种。

证据：

- Composer：`SessionChoiceEpochWait`（1138）加上 `SessionPermissionEpoch`（1143）和 `SessionModelEpoch`（1150）。权限有 `confirmedIndex`。模型另外有 `targetModelId`、`rollbackIndex`、`rollbackId`、`confirmedId`。按 `sessionId` 放在 host 的 `WeakMap`（1162–1163）。在飞时后一次点击只更新目标和乐观下拉，完成时按 confirmed 恢复。这是 r11-3 和 ADR-012 的机器。
- 面板六套计数见 p4-2。三套列表刷新（486–488）是「更新的请求作废旧结果」。`testGeneration` 还要等于起始时的 `activeProfileId`（S4，比较在 2164–2173 一带）。`latestTestRunGeneration` 只拥有「Testing…」这行，选中变化不碰它。`_forgetProfileGeneration` 只拥有 forget 的状态行，不取消已经决定要做的 disconnect。
- 目录刷新闸是 `EngineRefreshGate`（`engineWriteGate.ts:88`）。`begin` 记下 generation 和当时的引擎 link，`isCurrent` 同时看 dispose、generation、identity、link。这是写结果 / 列表刷新用的，不是选择器。
- 平台拨号另有 `_connectEpoch`（`universeAgentConnectionService.ts:657`），规则在 [connection-dial-generation](connection-dial-generation.md)。与面板计数无关。

和 [p1 第 4 条](review-2026-11-04-p1-capability-write-gate-plan.md) 的边界：

p1 第 4 条负责还没接上 `EngineRefreshGate` 的目录分区（Skills、Agents、Tools、Hooks、ProviderModel、TokenUsage、MCP runtime），并评估这些分区要不要一个 LatestRequest。该条写明 Composer 的两套 epoch 和连接面板的六套代次不在它的范围，交给本稿。

本稿的结论：

- 不把 Composer epoch 或面板六套代次迁到 `EngineRefreshGate`。那会让 Hub 目录刷新开始比较引擎 link，也会让模型回滚去看 dispose 和 link。两边都是行为变化。
- 不在 `base` 或 `platform` 新增 `LatestRequest`、带 confirmed / rollback 的选择器。权限 / 模型选择器的家在 p3 要引入的会话配置旁边；在那之前抽一层，等于先搬一次、p3 再搬一次。
- 面板三套列表计数（设备、Hub 目录、pending）只有「递增、比较、过期丢弃」，没有 link。若 p1 最后做出一个不含 link 的计数小对象，这三套可以在 p1 落地后再换。那一次换算作后续切片，不在本稿的提交顺序里，而且过期时仍是静默丢弃。Test 的两套代次和 forget 代次不适合那个小对象：它们还有 profile id，或者把「状态行归谁」和「disconnect 是否仍执行」拆开。
- p1 不得为了「统一代次」修改 `conversationLensComposerChrome.ts` 或 `connectionPreferencesPane.ts`。本稿不修改 `engineWriteGate.ts`。

本条不改代码。没有行为变化。不新增测试。现有锁住这些代次的测试留在 p4-2 和 p4-3 的验证里，外加 p1 自己的分区测试。

风险：若实施时仍抽一个共用类型，回退就是删掉该类型、调用方回到现在的字段。不要为了这个类型改 r11-3 或 S4 的断言。

## 待定项

无。核查方向里「夹具接口移出生产类」与已经收口的合同冲突：[stub-and-fixtures §5.2](../../docs/systems/conversation/stub-and-fixtures.md) 写明接口保留不拆，[ADR-003](../decisions/003-engine-adapter-boundary.md) 决策 4 保持同一 token 和公开类型。本波不重开。p4-1 不删除这些成员。`setEngineConnected` 的方法体留在引擎类；其余三份夹具方法可以委托给 stub 实例。另立夹具接口要先改那份系统文档和 ADR 的审查记录，再单独立项。

流程服务的文件位置也按决策 6 定了，不另请拍板。见 p4-2。

## 改法约束

- 新 widget 与 `ConversationComposerModel`、流程服务都用构造函数注入。面板用 `IInstantiationService.createInstance` 创建 widget。
- widget、模型和 stub 实例创建后立刻 `_register`。不要在每次渲染时向面板重复注册同一个子树。
- 重构切片不新增用户可见字符串。现有 `nls.localize` 调用随代码搬家，键保持不变。
- 流程服务的类文件在 `contrib/conversation/browser`，用 `registerSingleton` 注入。分区 DOM 留在同目录的 widget 里。服务不放进 `workbench/services`。
- 名册仍是一个 token。测试里的 `ConversationStubService` 直接构造可以继续，那是测试替身，不新增生产用的局部 `Pick` 接口。stub 新增的跳过持久化回调是构造参数，缺省行为与今天的 `shouldSkipLocalPersistence` 基类实现相同。

## 审查记录

2026-11-04 只读审查后改入：`setEngineConnected` 留在引擎类；待确认切换取消仍在 forget 之前返回，服务留在 contrib 并继续注入名册；`writeHoldReason` 按活码顺序整段搬，列表失败句不并进四个锁原因；路由顺序补上「先于 stub」和「先于 connected」；组合清单改为引擎实际用到的 protected 成员，并用回调保住 `wasEverConnected` 时跳过本地桶；Composer 的 dock / composer 写入进文件清单，转发必须是 getter / setter；`modelSelectedIndex` 留在视图上画下拉，不交给 p3；Test 的无 profile 分支继续比 link，选择 id 的直接赋值不加 `testGeneration`。

未采纳的 Minor：chrome 文件行数。`splitlines` 计为 1643。差一行不影响函数名单。

## 审查处理

本轮对照活码核验。没有不采纳的意见。`status` 仍是 `draft`。

优点八条都对得上活码和已签收合同（r11、ADR-003、ADR-012、S4、connection-dial-generation）。正文已有对应句子，本轮不另改。Critical 无。

- Important，p4-1b 的生产连接路径与 Emitter。采纳。`super.setEngineConnected` 有三处：249，以及 `onUaConnectionChanged` 的 1799、1806；1806 仍只在 `testEngineConnected === undefined` 时调用。`onDidChangeEngineConnection` 只在 stub 的 `setEngineConnected`（`conversationStubService.ts:840`）里 `fire`。会话列表（`conversationSessionsView.ts:285`）、透镜（`conversationLens.ts:398`）、身份条（`conversationIdentityStrip.ts:214`）订的是引擎上的这个事件。引擎直接 `fire` 继承来的 `_onDidChangeSession`（133）、`_onDidChangeActiveSession`（230、409）、`_onDidDeleteSession`（1753）。这三只 Emitter 留在引擎上，不进「改调 stub 实例」的清单。已写入证据、不变量、p4-1b 的符号与切片、风险。
- Important，p4-2b 的 r11-1 占用交接。采纳。与已签收合同一致，不是冲突。r11 要求确保占用在调用 `connectProfileWithPairing` 之前同步放下，两段之间没有 await；该方法入口 1918–1919 在 `isConnectWriteHeld()` 时 return。收成一把在入口仍为真的锁，直连不会拨号。已把「服务拥有在途锁」改成两段状态，并写入不变量、切片和风险。「锁只有一个主人」仍指文案和四个原因不拆开，不指这两段合成一个布尔。
- Important，p4-1b 的 hold 验证文件。采纳。`conversationStubService.test.ts` 没有 `holdMessageQueueItem`。hold / release 在 `conversationEngineRosterService.test.ts`：1715 与 1716 属于已在 grep 里的 `KEEP leftover list-fail renameSession deleteSession and mutators reject and skip unary`。`hold settlement is explicit and does not release the item` 已补进 grep：4599 是 hold 调用，不 release 的断言在 4602。
- Important，p4-3b 的声明和读者。采纳。`composerPolicy` 补上 `conversationComposerAt.ts:46`。读者补上 `conversationLens.ts:419–420`、`:441`、`:476`，`conversationLensProjection.ts:98–99`（读取在 238–239），`conversationLensSessionBinding.ts:52–53`（读取在 248），`conversationSessionAvailability.ts:110`（声明在 100）。核验时另外两处生产代码也在读同一组字段，一并写入清单：`conversationEditorPane.ts:272–277`，`conversationLeafSessionBar.ts:43–44`、213–218。`conversationTimelineHost.ts` 的 `editingTurnId` 不是这 10 个模型字段，不纳入。`compile-client` 改为清单之后的类型回退，不再当作这份清单的替代。
- Minor，`activeProfileId` 的另外三处直接赋值。采纳。1634 留在面板的 `handleAddDirectAddress`；1822 在要搬走的 `handleForgetSelectedProfile` 里清成 `undefined`；2663 在 `syncingProfiles`（476、2653）为真时选中第一项，搬 Profiles 时该标志与选择回调（786）一起走。1731、1931 仍保留。
- Minor，p4-2b 后半段验证不是测试名。采纳。点名的是 r11 的两个标题：`Direct Connect forgets a host:port profile and disconnects only after that forget succeeds`，`Direct Connect forget failure does not add or disconnect`。拨号失败不 forget 是前一个测试里的断言；add 失败与 forget 失败是后一个测试改写后的断言。
- Minor，「核查稿 59 / 38」。采纳。含 `async function` 时就是 63 / 40，该句已删。
- Minor，release 与 update 的行号对调。采纳。`conversationStubService.ts:268` 是 `updateMessageQueueItemContentWithSettlement`，`:299` 是 `releaseMessageQueueItemHoldWithSettlement`。两处都可选，stub 类都没有方法体，结论不变。

改入上述意见后再做一次只读核对。没有 Critical、Important。三条 Minor 已改正：4599 是 hold 调用、不 release 的断言在 4602；`conversationSessionAvailability.ts:100` 只声明 `queueEditSettlementItemId`；1931 的赋值在入口检查和可选确认之后，那两条返回不写 `activeProfileId`。
