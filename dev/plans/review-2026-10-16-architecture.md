---
title: "架构设计审查 2026-10-16"
type: reference
status: draft
phase: M7
updated: 2026-10-16
summary: "六路只读架构审查。根因是派生状态与判断规则没有唯一所有者：链路状态、会话投影、Sources 读模型、本地或引擎判定、异步进行中请求各写一份。另有接口过宽、边界守卫失效、异步原语不用、扫描测试钉实现。具体缺陷 7 条，含换 profile 不复位 agent tree 探测、引擎 diff URI 不分会话、一条扫描测试按文本必挂。发现稿，未切实施，未改代码。"
---

# 架构设计审查 2026-10-16

> **范围：** 以 `agent-ide` 工作区磁盘为准（HEAD `393ccc6e9fd` 加未提交改动）。`agent-ide` 比 `loop/merge`（`fe4402391ba`）少 242 个提交，个别条目在 `loop/merge` 上可能已改，切实施前按 `loop/merge` 复核。六路只读分析：分层与依赖边界、引擎连接与传输、会话工作根与状态作用域、Conversation 模块内聚、Sources 与 Review 数据流、异步生命周期与测试架构。
> **核实口径：** 标 ✓ 的条目由父 agent 在代码里复核过；未标的由子代理核实，本稿未逐条复核。数量是 rg 抽样，按下限理解。2026-10-16 规则 16 只读审查后改过两处 Important（S2 覆盖范围、B1 测试句）和两处 Minor。
> **性质：** 发现稿，不是方案。不切实施，不改 PRD 状态。托管 CI 已关是既定选择，不列为问题。

## 1. 根因

派生状态和判断规则没有唯一所有者。同一件事在多个类里各写一份，靠布尔值、代次计数和读源码文本的测试对齐。2026-10-08、2026-10-11 两轮审查反复修的"失败后缓存拒绝""失败后标志不复位""await 后不查释放"，大多是这一根因在不同模块里的表现。

目标环境分层（`common` / `browser` / `node`）是干净的：没有 `common` 引 `browser` 或 `node`，contrib 不引 `universeAgent/node`。universeAgent 的分层规则在 `eslint.config.js:3056-3060` 是 error，另有 `universeAgentImportBoundaries.test.ts` 守着。

## 2. 共性问题

### A1 状态没有唯一所有者

| # | 位置 | 现象 | 证据 |
|:--|:--|:--|:--|
| A1-1 | 引擎链路 | "已连接"有四套判据。连接服务约 30 个可变字段，`_connectionPhase` 有 21 处写点。`ConnectionPhase` 不含配对态，靠正交布尔补。unary 超时只改相位、不关链路，这时主进程判已连、渲染端判未连。复位清单有两份，已经漂移（见 B1） | `universeAgentConnectionService.ts:594-636`、`:705-713`、`:2348-2359`、`:2371-2387`；`universeAgentRendererSync.ts:267-269`；`sessionViewHost.ts:298-304`；`connectionHubTypes.ts:34-39` |
| A1-2 | 会话投影 | 时间线和轨迹各投一遍。时间线在过滤前从 `pendingActions` 借 agentId，轨迹不借，子代理浮层里同一条 permission 在两页结果不同。投影缓存挂在两处，名册每次调用都无缓存重投 | `conversationSessionView.ts:386-455`；`conversationTrajectoryModel.ts:196-199`；`conversationLensProjection.ts:131`；`conversationTimelineHost.ts:72` |
| A1-3 | Sources | 同一条 `onDidFileMutation` 流上有归因、审阅进度、ReviewNav 三份读模型，上限各不相同。对 `path` 是相对还是绝对有三种理解。平台契约 `IFileMutationRecord.path` 没写基准 | `sourcesReviewAttributionService.ts:31,78`；`sourcesReviewProgressService.ts:42-58,117`；`conversationReviewNavService.ts:73-83`；`sourcesReviewAttribution.ts:108-126`；`universeAgentTypes.ts:1622` |
| A1-4 | 工作根 | `IAgentWorkRoot` 已落地，但 Files、Changes 列表、「查看更改」、Navigator 仍各自判断本地与否。嵌套仓库（窗口 `/a`、会话 `/a/b`）时 Changes 有行而「查看更改」为空。会话没有 workDir 时 Files 不回落到连接 workDir | `conversationReviewEntry.ts:233`；`sourcesFilesExplorer.ts:449-453`；`sourcesChangesList.ts:811-816`；`navigatorProjectsList.ts:601-609` |
| A1-5 | 异步进行中状态 | 绑定状态由三个布尔加一个 Promise 拼成；SessionViewHost 的状态散在近 20 个按会话或租约索引的 Map / Set 里 | `conversationEngineFrameSource.ts:40-57`；`sessionViewHost.ts:265-297` |

方向：每类状态一个所有者，派生值都从所有者读。链路改成"一次拨号产出一个不可变链路对象，提交时整体替换"。每个会话一个 projector，同时产出时间线、轨迹和过程折。Sources 建一个共享的 mutation 索引。本地判定只读 `IAgentWorkRoot.access` / `localRoot`。

已有覆盖：`dev/progress/engine-link-architecture-review-2026-09-28.md` 提过链路对象方向，[loopback-link-commit](loopback-link-commit.md) 写明不做。[session-work-root](session-work-root-and-workbench-scope.md) S2 第 4 项已列入 Changes 与 Review 行根改用 `localRoot`，代码仍走 `resolveSourcesGitResourceRoot`（`sourcesChangesList.ts:811-816`）。S2 未列的是：会话没有 `workDir` 时 Files 不回落连接 `workDir`（`agentSessionContext.ts:107-109`，`sourcesFilesExplorer.ts:449-453`），以及 Navigator 仍读连接快照的 `workDir`（`navigatorProjectsList.ts:608`）。[conversation-timeline-refactor](conversation-timeline-refactor.md) 只管时间线一侧的缓存。

### A2 接口过宽

- ✓ 生产名册 `ConversationEngineRosterService` 直接 `extends ConversationStubService`（`conversationEngineRosterService.ts:69`）。契约放在 stub 文件里，约 60 个成员，混着 `setMessageQueueFixture`、`setEngineConnected` 等 fixture 方法（`conversationStubService.ts:80-291`）。
- `IUniverseAgentConnection` 约 214 个成员，其中 158 个可选（`universeAgentConnection.ts:398-2218`），调用方用 `?.()` 探测能力（`engineRulesSection.ts:147`、`engineHooksSection.ts:125`）。加一个 RPC 要改 Wire、transport、client、接口、服务透传、IPC 白名单 6 处。
- `universeAgentTypes.ts` 有 498 个导出，被 137 个生产文件引用。
- `UniverseAgentConnectionService` 一个类同时实现 Connection、Host、Hub 三个接口（`node/universeAgentConnectionService.ts:571`）。
- ✓ 写操作的放行判断散在 UI 里：生产代码中 `isConversationPairingHold(` 有 173 处调用。`deferred-gaps.md` 的 D305–D312、D449–D457 等批次都是逐个入口补拦截。

方向：连接接口按引擎协议服务域拆。能力判断读能力快照，不靠可选方法。名册拆成读、写、fixture 三个接口，引擎实现组合 stub 而不是继承。写入放行收进服务层。

已有覆盖：[giant-file-split](giant-file-split.md) 不含这两个文件。[sources-architecture](sources-architecture.md) SAR-2 只收了 Sources 一侧的写闸。

### A3 边界守卫名存实亡

- ✓ chat 边界测试的白名单分支永远不会触发。`extractImportPaths` 返回原始相对路径 `../../chat/...`（`test/node/conversationImportBoundaryScan.ts:52-59`），判断却找 `contrib/chat/`（`test/node/conversationImportBoundaries.test.ts:28-31`），实际只剩黑名单子串在起作用。所以 `conversationForkActions.contribution.ts:12-15` 引 `chatForkActions`、`IChatSessionsService` 也能通过。
- ✓ vendored `sessionCore/` 的 `SYNC.md` 写明不得手改，但上次同步 `a4ab1a3e754` 之后有 24 个提交改了该目录。其中 `51dff2c0a3c` 在 `stream-event-to-view-patch.ts:139-140` 加了两个进程级 Map，注释写明生产环境在整个进程生命周期内保留。这段代码托管在 electron-main，Map 按工具调用 id 做键，没有会话维度，也不回收。
- navigator 有 7 个生产文件、14 处 import 直接指向 conversation 的 `browser/` 内部文件（`navigatorAgentsView.ts:35-37`、`navigatorReveal.ts:10-12`），而需要的成员大半已在 `IAgentSessionContext` 里。ESLint 允许 `vs/workbench/contrib/*/~`（`eslint.config.js:1938`），没有工具能拦。conversation 与 sources 互相 import。
- 工作台核心反向引用 conversation（`editorParts.ts:38`、`editorGroupFinder.ts:14`），在 `eslint.config.js:1866-1873`、`:1907-1913` 显式豁免。`workbench/common/editor/conversationDiffReviewInput.ts` 只把类型 id 与 scheme 下沉到核心，是可以照做的先例。
- 引擎首选项约 39 个文件、1.45 万行，占 conversation 非测试代码约 31%。它和 Conversation 主流程只在 `connectionPreferencesPane.ts:1542-1553` 用到名册。

方向：边界扫描先把路径解析成绝对路径再判断。conversation 补一个公共 common 文件，navigator 改走 `IAgentSessionContext`。sessionCore 的本地补丁要么在 `SYNC.md` 里列明，要么先改上游再同步。引擎首选项迁成独立 contrib。

已有覆盖：见 §4 D3、D5。

### A4 异步生命周期全靠手写

- 自研区 408 个生产文件从 `async.js` 只导入了 `RunOnceScheduler` 和 `timeout`。`Throttler`、`Sequencer`、`CancelablePromise`、`Lazy` 一处未用，`CancellationTokenSource` 只用了 4 处。取而代之的是 62 个代次计数字段、166 处手写 disposed 检查、至少 8 个手动清理的进行中 Promise 字段。
- ✓ `base` 缺一个"失败就丢弃缓存"的单飞原语。`Lazy` 会永久缓存异常（`lazy.ts:33-49`），`LazyStatefulPromise` 建在它上面。上游有两份私有的 `CachedPromise`（`extHostChatAgents2.ts:1561`、`promptsServiceImpl.ts:1593`）正是这个语义。
- 同一请求的陈旧判定形状已经漂移：`conversationEngineRosterService.ts:1908` 用四个条件，`:1953` 少了 `isEngineConnected()`。`engineAgentsSection.ts:839-850` 在 await 之后只查 `canWrite()`，catch 分支仍往已释放的 DOM 写状态。
- `sourcesChangesReadModel.ts:97-111` 的 `refreshRunning` 加 `refreshAgain`，以及 `conversationEngineFrameSource.ts:231-256`，都是手写的 `Throttler`。
- 全仓约 2127 处 `.catch(onUnexpectedError).catch(onUnexpectedError)`，其中自研区约 254 处。`errors.ts:23-35` 是未被替换前的默认 handler，在 `setTimeout` 里抛错。工作台启动后换成只记日志、不抛（`workbench.ts:109-128`），electron-main 换成 `console.error`（`src/vs/code/electron-main/main.ts:106`）。第二层 catch 对不上 `setTimeout` 里的抛出；它实际对付的是测试里"第一次抛、第二次不抛"的 handler（`navigatorProjectsList.test.ts:701-706`）。这个写法的理由来自 D480，已经扩散进上游的 chat、notebook、debug 文件，加大了合并冲突面。

方向：把 `CachedPromise` 提成共享原语。每次请求开一个 `CancellationTokenSource`，用 `MutableDisposable` 持有。把连接、身份、代次、释放四个条件打包成一个 `isStale()` 捕获对象。手写的忙标志换成 `Throttler`。绑定状态改成判别联合（idle / binding / bound / failed）。fire-and-forget 收口成一个 helper，或者让测试 handler 不再同步抛。

已有覆盖：无。`docs/architecture` 没有讲异步生命周期的页面。

### A5 测试钉实现而不是行为

- `*Scan*.test.ts` 约 302 个，其中 CatchScan 约 281 个。自研区 360 个测试里约 90 个读源码文本。
- `conversationEngineFrameSourceScan.test.ts:58-66,157-163` 逐字匹配带制表符的源码；`:166-203` 把 `requestResync` 抄进测试，测的是抄本。同一行为在 `test/browser/conversationEngineFrameSource.test.ts:540` 已有注入假依赖的行为测试。
- `test/node/conversationLensCssScan.test.ts:528` 把 `querySelector('.conversation-timeline')` 钉成合同。三处代码靠 MutationObserver 或手动 reparent 往别的组件 DOM 里插节点（`conversationNavigation.contribution.ts:111-133`、`conversationSessionChat.contribution.ts:98-113`、`conversationEditorPane.ts:175-187`），缺具名挂载槽。
- 已经出现一例按文本必挂的测试，见 B6。
- ✓ [testing.md](../../docs/architecture/cross-cutting/testing.md) 没有关于源码扫描测试的规定。[traceability.md](../../docs/product/traceability.md) 第 46 行把 `conversationLensCssScan.test.ts` 等扫描测试当作 PRD-028 的证据。

方向：行为改动配行为测试；扫描测试只留给导入边界和 CSS 规则是否存在。叶级 SessionBar 和会话窗口提供具名扩展槽，参照 `IConversationLensSlots`。

## 3. 具体缺陷

| # | 缺陷 | 证据 |
|:--|:--|:--|
| B1 ✓ | 换 profile 后 agent tree 被误判为不支持。`_agentTreeProbeUnsupported` 只在 `disconnect` 复位（`:1312`），`connectProfile` 走 `_dropPublishedTransport`（`:2872`）与 `_applyConnectedCommit`（`:2984`），都不清这个标志。引擎 A 回过一次 UNIMPLEMENTED，切到 B 仍当不支持。现有测试只断言 UNIMPLEMENTED 后 `isAgentTreeUnsupported()` 为 true（`universeAgentConnection.test.ts:10948-10969`，随后 `dispose()`）；名为 disconnect 的用例（`:10972-10995`）只清 `isAgentTreeFetchFailed`。没有「换 profile 后仍为 unsupported」的用例，也没有「disconnect 清掉 unsupported」的用例。与 [feature-gaps G17](review-2026-10-16-feature-gaps.md)（condemn 后不清 `_capabilities`）同类 | `universeAgentConnectionService.ts:603,745,754,769,1312` |
| B2 ✓ | 引擎根 diff 的虚拟 URI 不带会话或项目，形如 `sources-git-diff:/side/path/state`，背后是模块级 store。两个工作根不同的会话打开相同相对路径时，会共用 diff 模型并互相覆盖（推断，未复现） | `sourcesGitDiffContent.ts:71-78` |
| B3 ✓ | 引擎设置的项目作用域不随切会话刷新。MCP 节只在 `onDidChangeConnection` 时刷新，写操作在写的那一刻才读根；列表是项目 A 时写操作可能落到 B（推断）。并排会话时非焦点侧 Composer 读焦点会话的 Agent 配置（Composer 部分未复核） | `engineMcpSection.ts:290-296`、`:415`、`:785`；`conversationLensComposer.ts:85`、`:210` |
| B4 ✓ | 路径键大小写不一致。`normalizeAgentWorkDirKey` 不转小写，`fsPath` 会把盘符转小写。Windows 上归因与「查看更改」可能静默对不上（推断） | `agentWorkRoot.ts:26-32`；`sourcesReviewAttribution.ts:77-83,97` |
| B5 ✓ | 窗口通道不按调用方区分权限。`connectProfile`、`disconnect`、`shutdown` 在转发白名单里，`call` 不用调用方上下文做判断，任何窗口都能调。换链路时 SessionViewHost 给所有窗口的会话发 connectionDown，窗口 B 换引擎会打断窗口 A 且不提示（SessionViewHost 部分未复核） | `universeAgentConnectionIpcChannel.ts:91,96,252,391-399`；`sessionViewHost.ts:645-674` |
| B6 ✓ | 扫描测试按文本必挂：断言源码含 `reparent(newParent: HTMLElement): void`，实现已是 `reparent(parent: HTMLElement)`。不在 `test-baseline-failures.txt` 里 | `conversationEngineFrameSourceScan.test.ts:328`；`conversationSubAgentOverlay.ts:90` |
| B7 ✓ | chat 边界测试的白名单分支不触发，见 A3 | `conversationImportBoundaries.test.ts:28-31` |

## 4. 文档与代码偏差

| # | 文档写法 | 代码事实 |
|:--|:--|:--|
| D1 ✓ | [giant-file-split](giant-file-split.md) 摘要写 GFS-1–3 已落、门面 `conversationLens.ts` 783 行、每文件 ≤800 硬上限 | `conversationLens.ts` 954 行，`conversationLensComposerChrome.ts` 1067 行，`grpcClient.ts` 3404 行，`grpcClientMappersCatalog.ts` 2773 行 |
| D2 ✓ | [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md) 第 79 行写对话页、overlay、座位与轨迹页用同一条子代理过滤 | 时间线过滤前先借 agentId，轨迹不借（A1-2） |
| D3 ✓ | [conversation overview](../../docs/systems/conversation/overview.md) 第 74 行写 Chat 只经 `IConversationTurnContentAdapter` 单点入参 | fork action 直接引 chat 内部 action 与服务（A3） |
| D4 ✓ | [session-work-root](session-work-root-and-workbench-scope.md) §1 现状表按实施前描述，列出 `sourcesGitNormalizedRoot` 等五份规范化 | `sourcesGitNormalizedRoot` 已删；归因、进度已读工作根 |
| D5 ✓ | `sessionCore/SYNC.md` 写不得手改；[engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) 只登记了一次手改 | 上次同步后有 24 个提交手改（A3） |

## 5. 做得好的地方

- 目标环境方向干净，有 ESLint error 级规则和边界测试守着。
- 窗口通道白名单带编译期穷举证明（`universeAgentConnectionIpcChannel.ts:342-378`）。SessionView 通道从调用方上下文取会话归属，窗口关闭时回收。
- 快照权威清楚：contrib 不 fold 引擎事件，投影函数是纯函数。Changes 与 Review 共用一份带代数的 git 快照，打开 diff 只有 `openSourcesChangeEntry` 一个入口。
- `sessionCore/` 是显式 actor，有端口、mailbox 和注入的调度器。

## 6. 待拍板

| # | 问题 |
|:--|:--|
| Q1 | 链路状态是否改成不可变链路对象、整体替换？这会重写已落地的 epoch 写点（D944、remote-link） |
| Q2 | "全应用一条连接"定为产品不变量（写进 `windows.md`、`ipc.md` 与 ADR），还是改成按窗口连接？ |
| Q3 | 共享异步原语放进 `base/common/async.ts`（改上游、合并成本高），还是只放自研层？双链 catch 与 CatchScan 是退役还是只冻结新增？ |
| Q4 | 源码扫描测试还算不算合入证据？退役会让若干已关闭的 D 行失去证据 |
| Q5 | 引擎首选项是否迁成独立 contrib？`sessionCore` 是正式承认分叉，还是强制先改上游？ |
| Q6 | 工作根相关状态存 `WORKSPACE` 还是 `PROFILE` / `APPLICATION`？这决定"同引擎同目录共用"能否跨窗口 |
| Q7 | 本地判定是否以 SCM 根优先为唯一定义、Files 也改读 `localRoot`？引擎设置与 Composer 的项目作用域锚在活动会话还是绑定会话？ |

## 7. 方案

B1–B4、B6、B7 与 §4 的文档偏差见 [architecture-2026-10-16-concrete](architecture-2026-10-16-concrete.md)，`draft`，未实施。G17 与 B1 同收在该稿第一节。Q1–Q7、A1–A5、B5 仍不在该稿里选定。
