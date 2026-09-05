---
title: "巨型文件按状态机 / 投影 / IO 拆分"
type: plan
status: accepted
phase: N/A
updated: 2026-09-05
summary: "四份巨型文件按状态机/投影/IO 拆（不改对外契约）；GFS-1/GFS-2/GFS-3 已在 HEAD 落地（含 GFS-3 residue @ 533fc6c42d5：readingColumn + sessionBinding，门面 783 行）；GFS-4 已 sync 本仓 @ a4ab1a3e754（PIN Desktop 0dd3146cd）；每文件 ≤800 硬上限；sessionCore/sessionView 仿既有 SYNC.md 回同步，禁止手改 vendored"
---

# 巨型文件按状态机 / 投影 / IO 拆分

> **触发：** 复杂度集中在 `session-actor.ts`（2933）、`conversationLens.ts`（1984）、`grpcClient.ts`（1659）、`conversationTimelineTree.ts`（1255）。`node/sessionCore/` 与 `common/sessionView/` 是 vendored 树，已有 SYNC.md，但拆分与回同步纪律未写成可实施合同。  
> **不推翻：** [ADR-003](../decisions/003-engine-adapter-boundary.md)（`sessionView` ∈ `common`，Actor ∈ `node`；contrib 禁 import `platform/universeAgent/node/**`）；[conversation-stream-timeline](conversation-stream-timeline.md)「禁止手改 vendored、改动回上游再同步」；[session-view-frame-fanout](session-view-frame-fanout.md)「`node/sessionCore/**` 不手改」。  
> **文档：** 不在 `src/vs/` 新建 docs 树（[DOCUMENTATION.md](../../docs/DOCUMENTATION.md)）。既有 `SYNC.md` 由同步脚本覆写，本方案**不**另建 SYNC.md。  
> **本稿地位：** `accepted`（2026-09-04 两轮审查后签收，见文末）。  
> **审查记录：** 见文末（规则 16）。  
> **落地（HEAD @ `40d61319677` · 2026-09-05）：** **GFS-1 已落** @ `32f71812`/`32198d0b`（`grpcClientMappers.test.ts` + facade / Session·Catalog·Team mappers / `grpcClientCalls.ts`）。**GFS-2 已落** @ `78bc8bbc`（`conversationTimelineTypes.ts` + `conversationTimelineRenderer.ts` + 门面 `conversationTimelineTree.ts`）。**GFS-3 已落** @ `c5d791c7`（`conversationLensProjection.ts` + `conversationLensSessionBar.ts` + `conversationLensDock.ts` + `conversationLensComposer.ts` + `conversationLensComposerChrome.ts` + 门面 `conversationLens.ts`）。**GFS-3 residue 已落** @ `533fc6c42d5`（`conversationLensReadingColumn.ts` + `conversationLensSessionBinding.ts`；门面 `conversationLens.ts` **783** 行；仍 `export class ConversationLens`）。**G6 已在 Desktop 闭合** @ `48cd90952`（上游删四处 dead `private`；session-core vitest 1419 绿）。**Desktop GFS-4 已拆** @ `0dd3146cd`（同 class 文件搬迁；`session-actor.ts` 736 + `session-actor-stream-fold.ts` 733 + `session-actor-overlay-fold.ts` 288 + `session-actor-local-fact.ts` 659 + `session-actor-timeline-items.ts` 138 + `session-actor-chat-outbox.ts` 220；另有 `session-actor-fold-interface.ts` / `session-actor-production-source.ts`；均 ≤800；方法挂 `SessionActor.prototype`；上游 barrel 仍不 re-export `SessionActor`）。**GFS-4 已 sync 本仓** @ `a4ab1a3e754`（vendored PIN `0dd3146cd05efdcce118d0c3c7e19eb28b615f5c`；`sessionView/index.ts` 未手改）。

## 0. 目标 / 非目标

**目标：**

1. 把四份巨型文件按 **状态机 / 投影 / IO** 切开，使单文件可读、可互斥、可单测定位。
2. 钉死 `sessionCore` / `sessionView` 的来源 SHA、同步脚本与「禁止手改后不回源」。
3. 切片可并行，但高冲突文件同一时刻只允许一个写者。

**非目标：**

| 不做 | 理由 |
|------|------|
| 改对外契约 | `ConversationLens` / `ConversationTimelineTree` / `IUniverseAgentGrpcTransport` / `createSessionCore` 公开形状不变；测试继续按原符号 import |
| 本波重写协议 | 不改 gRPC 方法、wire JSON、session-core mailbox / `ViewFrame` / lease 语义 |
| 为拆而拆测试 | 不重写 `conversationLens.test.ts`（约 2270 行）或把现有测迁到新文件名；允许 **加** 定位测，禁止减断言 / 删测。**例外（签收裁定）：GFS-1 必须先加 mapper 特征测**（§2.3），因为该文件今天零单测，没有机器真值的搬迁不允许 |
| 在 vscode 手改 vendored 源再「就地拆」 | 拆 `session-actor` 必须先在 Desktop `packages/session-core` 落地，再跑同步脚本 |
| 把 `sessionView/index.ts` 换成上游 `view/index.ts` | vscode 自写 barrel 有意不 re-export Actor 侧 `pending-actions-bound`（stream-timeline §3.1） |
| 本仓手改 `sessionCore/index.ts` | 该 barrel **会被 sync 覆写**；新 fold 的 re-export 在 Desktop `index.ts` 改完再 sync。本仓只手维护 `sessionView/index.ts` |
| 借拆分改投影 / mailbox / intent 语义 | 拆分是同 class 文件搬迁；字段仍归门面。GFS-4 默认不改 mailbox / `CoreIntent` |

## 1. HEAD 事实锚点（写入时核对）

行数 `wc -l` @ 2026-09-04。

| 事实 | 位置 |
|------|------|
| `session-actor.ts` **2933** 行。头注释：「Per-session serial Actor: single FIFO mailbox, sync drain, no re-entry (ADR-009 §2). Side effects are intents only」。导出：`SessionActorDeps`、`syncReasonFromConnectionDown`、`export class SessionActor`。`handle` 按 `CoreMessage.t` 分发；`onLocalFact` / `onStreamEvent` 是两大投影入口；尾部 `enqueueOrWriteChat` / `flushPendingChatWrites` 是写出 | `node/sessionCore/session-actor.ts` |
| `sessionCore/index.ts` 是 Host-side barrel（ports / intents / fold helpers / `createSessionCore`）。**不** re-export `SessionActor`。头写 renderer 须走 `@universe-agent/session-core/view`。脚本 **会覆写** 此文件（只跳过 `view/index.ts`） | `node/sessionCore/index.ts` · `scripts/sync-universe-agent-session-core.ts` `EXCLUDE_RELATIVE_FILES` |
| `sessionView/index.ts` 是 **vscode 自写** barrel：「does NOT mirror upstream `view/index.ts`」。只 re-export 本目录 types / apply / empty-snapshot / client-tool-call / question-ask / overlay-view-helpers | `common/sessionView/index.ts` |
| 两棵树已有 SYNC.md，文案与 deviceGrant / hub 同构。Source：`UniverseAgentDesktop/packages/session-core/src`。Commit：`0dd3146cd05efdcce118d0c3c7e19eb28b615f5c`（GFS-4 sync @ `a4ab1a3e754`）。Regenerate：`npx tsx scripts/sync-universe-agent-session-core.ts`。禁止手改 | `node/sessionCore/SYNC.md` · `common/sessionView/SYNC.md` |
| 同步脚本：来源 `../UniverseAgentDesktop`（或 `UA_DESKTOP_REPO`）；`view/**` → `common/sessionView/`（跳过 `view/index.ts`）；其余 → `node/sessionCore/`；2 空格→tab；`./view/*.js` → `../../common/sessionView/*.js`；写回两份 SYNC.md 的 Commit | `scripts/sync-universe-agent-session-core.ts` |
| 本机兄弟仓 `UniverseAgentDesktop` `git rev-parse HEAD` = **`0dd3146cd05efdcce118d0c3c7e19eb28b615f5c`**（与 SYNC.md 一致，非编造）。上游 `session-actor.ts` 已拆为 fold 模块（门面 736 行等，均 ≤800） | 仓外核对 @ 2026-09-05；G6 @ `48cd90952` 删四处 dead `private` |
| deviceGrant / hub 先例同一 SHA、同一「Do not hand-edit… change upstream and re-sync」 | `node/deviceGrant/SYNC.md` · `node/hub/SYNC.md` |
| `ConversationLens`：产品透镜，SessionBar + timeline + local dock，挂 `IConversationLensSlots`。状态字段已含 `lensId`（约 `:177`）/ `composerPolicy` / `conversationPhase` / `sessionViewLease` / `submitInFlight`。投影入口 `applySessionViewTimeline`（`projectSnapshotToEntries` 已在 `conversationSessionView.ts`）。IO：`bindSessionView` / `postBound` / `submitDraft` / roster / catalog | `conversationLens.ts`（`export class` 约 `:160`，字段 `:177+`）· `:1563-1607` · `:1917+`；行号按 2026-09-04 复核，实施时以符号为准 |
| `GrpcUniverseAgentClient implements IUniverseAgentGrpcTransport`。前 ~1100 行是 Wire + `map*` + `makeUnaryClient` / `makeServerStreamClient` / `makeResidentBidiStreamClient` / `makeBidiStreamClient`。类方法是薄 RPC 包装。工厂：`createGrpcUniverseAgentClient` / `createPinnedGrpcUniverseAgentClient`。唯一生产消费方：`universeAgentConnectionService.ts`。**该文件零单测**：`universeAgentConnection.test.ts` 全部走 `MockUniverseAgentGrpcTransport`，不经真 mapper | `node/grpc/grpcClient.ts` · `grpcTransport.ts` |
| `conversationTimelineTree.ts`（1254 行）：同文件已有 `ConversationTimelineDelegate` / `ConversationTimelineRenderer` / `ConversationTimelineProcessFoldRenderer` / `renderHonestTimelineRow` / `export class ConversationTimelineTree`。增量 apply 计划已在 `conversationTimelineApply.ts` | 该文件 `:89` / `:126` / `:575` / `:604` |
| 测：`conversationLens.test.ts` 经 `(lens as unknown as { timelineTree: … }).timelineTree` 取树；`conversationLensRevealNavigation.test.ts` / `conversationTrajectory.test.ts` 同。**无** `grpcClient` 单测文件；Actor 测走 `sessionViewHost*`.test.ts，不直 import `session-actor` | `contrib/conversation/test/browser/` · `platform/universeAgent/test/node/` |
| 热路径（status @ 2026-09-03）：frame-fanout / gap-closeout 在 `sessionViewHost` / Hub / Connection，**不是**这四文件的主写点；订阅流 Actor 回路刚收口 | [status.md](../progress/status.md) |

## 2. 四文件切分提案（实施前以规则 16 签收为准）

原则：状态机拥有可变字段与转移；投影是纯（或近纯）fold / map；IO 碰 channel / DOM / `emitIntent` / lease。门面文件保留原导出符号，新文件默认不进入 barrel，除非今天已经从该路径 import。

**同 class 文件搬迁（四文件共用）：** 拆出的是方法 / helper，不是新的状态所有者。可变字段仍写在原 class 门面上；新文件对门面实例调用或收显式参数。**禁止**借拆分改投影语义（不改 fold 结果、不改 `ViewFrame` / timeline 条目、不改 mapper JSON、不改树 apply 计划）。GFS-4 默认只搬文件，不改 mailbox / `CoreIntent` / `emitIntent` / `takeIntents`。

### 2.1 `session-actor.ts`（vendored；必须上游先拆）

本仓此文件是 Desktop `packages/session-core/src/session-actor.ts` 的同步产物。**提案文件名落在上游同目录**，同步后原样出现在 `node/sessionCore/`。禁止只在 vscode 拆。

| 层 | 提案文件 | 从 HEAD 搬出的块 |
|:---|:---------|:-----------------|
| 状态机（门面） | `session-actor.ts` | `SessionActor` 字段、`enqueue` / `drain` / `handle`、`onConnectionUp/Down`、lease acquire/release/resync/`frameAck`、linger、`openAttempt` / `rejectIfStaleAttempt` / `failClosedOverflow`、live binding getters。**保持**现有三个 export |
| 投影 | `session-actor-stream-fold.ts` | `onStreamEvent` 及 hello / gap / L2 seq / `rangeReplaced` / overlay pending+active / L1 `tryFoldL1SyncChromeStreamEvent` / `onHistoryResult` / `foldAndBroadcastPatches` |
| 投影 | `session-actor-local-fact.ts` | `onLocalFact` 家族（submit / permission / question / clientTool / regenerate / command / agent binds）、pending-send upsert/supersede/fail、文件尾 `timelineItemFromPermissionRespond` 等 helper |
| IO | `session-actor-chat-outbox.ts` | `ensureChatStreamIfNeeded` / `closeChatStream` / `enqueueOrWriteChat` / `flushPendingChatWrites` / inflight cleanup；写出只经已有 `emitIntent` |

`createSessionCore` 仍是唯一宿主入口（`session-core.ts` 已是薄工厂）。上游 `packages/session-core/src/index.ts` **继续不**导出 `SessionActor`；sync 覆写本仓 `sessionCore/index.ts` 后形状与上游 barrel 一致。

**GFS-4 粗行数（与 GFS-3 同级核对，`wc -l` / 方法起止 @ 2026-09-04，±30）：** 上表两份「投影」文件按 HEAD 方法块估算会**各自超过 800 硬上限**——`onStreamEvent`（约 `:1565`）到 `foldAndBroadcastPatches`（约 `:2570`）约 **1000+** 行；`onLocalFact`（约 `:759`）家族加尾部 `timelineItemFromPermissionRespond`（约 `:2848`）约 **900** 行。因此 GFS-4 在 Desktop 的切表**至少再切一层**：

| 层 | 文件（Desktop 同目录） | 粗行 |
|:---|:-----------------------|-----:|
| 状态机门面 | `session-actor.ts` | ~600 |
| 投影 · 流 | `session-actor-stream-fold.ts`（hello / gap / L2 seq / `rangeReplaced` / `onHistoryResult` / `foldAndBroadcastPatches`） | ~550 |
| 投影 · overlay | `session-actor-overlay-fold.ts`（overlay pending + active、L1 `tryFoldL1SyncChromeStreamEvent`） | ~450 |
| 投影 · 本地事实 | `session-actor-local-fact.ts`（submit / permission / question / clientTool / regenerate / command / agent binds + pending-send） | ~600 |
| 投影 · helper | `session-actor-timeline-items.ts`（文件尾 `timelineItemFrom*` 纯函数） | ~300 |
| IO | `session-actor-chat-outbox.ts` | ~250 |

**§6 行数上限对 GFS-4 是硬门，不接受「签收记录里改口」：** 任一新文件 > 800 → Desktop PR 不得合、本仓不得 sync。上游若坚持「一个 fold 模块」，则该模块必须自身 ≤ 800，否则等于没拆。

**GFS-4 前置（G6）——唯一路径是上游删：** 2026-09-04 复核 `scripts/sync-universe-agent-session-core.ts`：变换只有 2 空格→tab 与 `./view/*.js` import 改写，**没有**删行能力。**G6 已闭** @ Desktop `48cd90952`（删 `connectionGeneration` / `prefixHole` / `blockRespondMissingAgentId` / `commitSeqIndex`；vitest 1419 绿）。**GFS-4 已 sync 本仓** @ `a4ab1a3e754`（PIN `0dd3146cd`；vendored 树不再含 G6 手删前的上游副本）。

**与 G-CORE-1：** [session-view-frame-fanout](session-view-frame-fanout.md) 的 G-CORE-1（`CoreIntent` 加 `sessionId` / `takeIntents(sessionId)`）与 GFS-4 同写 Desktop `packages/session-core`。二选一：同一 Desktop 写者串行；**或** GFS-4 只搬 `session-actor` 文件、不改 mailbox / intent（G-CORE-1 另窗）。禁止两个写者同时改同一上游树。

上游若拒绝两份投影文件、坚持「一个 fold 模块」：签收时改口，但单文件仍须满足 §6 行数上限。

### 2.2 `conversationLens.ts`（vscode 自有）

已抽出 strings / identity strip / inbox / tree / trajectory / `conversationSessionView` / coalescer / drafts / voice bar / composer catalog / narrow layout。门面仍同时做 SessionBar DOM、Dock DOM、lease 绑定、发送。

| 层 | 提案文件 | 从 HEAD 搬出的块 |
|:---|:---------|:-----------------|
| 状态机（门面） | `conversationLens.ts` | `export class ConversationLens` 与公开方法（`layout` / `focusDockInput` / `revealTimelineItem` / `setFilterAgentId` / …）；拥有 `lensId`、`composerPolicy`、`conversationPhase`、`sessionTitleEditing`、`inputMaximized`、`submitInFlight`。**构造与 dispose 仍在此** |
| 投影 | `conversationLensProjection.ts` | `applySessionViewTimeline`、`updateSyncChrome`、`updateConversationPhase`、`updateReadingColumn`、`refreshTrajectoryRecords`、轨迹↔时间线互跳中的纯派生。继续调用已有 `projectSnapshotToEntries`，不二次 fold 引擎事件 |
| IO | `conversationLensComposer.ts` | `mountDock`、composer catalog 加载、`postBound` / `submitDraft`、turn/queue edit 保存、draft 读写、voice 录制 |
| IO | `conversationLensComposerChrome.ts` | **扩切片（门面初案残留 >1000）：** context views（Add/Tune/More/Templates）、edit begin/exit + `updateComposerEditChrome`、`syncComposerPlacement`、send/gate/maximize、session config selects、input history |
| IO | `conversationLensSessionBar.ts` | `mountSessionBar`、session select、title 编辑 DOM、new/delete session 按钮 |

**门面残留粗行数**（`wc -l` 1984 @ 2026-09-04；块边界按方法起止，±20）：

| 拟搬出 | 粗行 |
|--------|------|
| 投影所列块（`applySessionViewTimeline` / `updateSyncChrome` / `updateConversationPhase` / `updateReadingColumn` / `refreshTrajectoryRecords` / 轨迹↔时间线纯派生） | ~140 |
| composer 初案（`mountDock` ~200、catalog ~90、post·submit ~40、draft ~60、voice ~100、save* ~25） | ~520 |
| sessionBar 所列块 | ~210 |
| **初案门面残留** | **~1110（>1000 硬上限，必须扩）** |
| 扩：composer chrome（上表新文件） | ~390 |
| **扩后门面残留** | **~720（≤800 软上限）** |

`conversationLensComposer.ts` 初案 ~520 超新模块软上限 400：实施时把 `mountDock`（~200）再切到 `conversationLensDock.ts`，与 catalog/draft/voice/submit（~320）分开，仍算 GFS-3，不另开方案。

`IConversationLensSlots` 三槽冻结不改（page-access）。测继续 `import { ConversationLens } from '.../conversationLens.js'`。字段仍在 `ConversationLens` 上；新文件不另持 `lensId` / `composerPolicy` / `sessionViewLease` / `submitInFlight`。

### 2.3 `grpcClient.ts`（vscode 自有；不是 vendored）

契约在 `IUniverseAgentGrpcTransport`（`grpcTransport.ts`），本文件是手写 JSON marshalling 实现。生产只经两个工厂函数进入 `universeAgentConnectionService`。

| 层 | 提案文件 | 从 HEAD 搬出的块 |
|:---|:---------|:-----------------|
| 状态机（门面） | `grpcClient.ts` | `GrpcUniverseAgentClientOptions`、`export class GrpcUniverseAgentClient`、`isChannelAlive` / `close`、两个 `create*` 工厂。方法体只调 codec + mapper |
| 投影 | `grpcClientMappers.ts` | 全部 `*Wire` 接口与 `map*`（Connect / Session / Skill / AgentProfile / Mcp / Plugin / Tool / Model / Team）。若签收后仍 >500 行，再按 Session / Catalog / Team **三分**（`grpcClientMappersSession.ts` 等），仍算本切片，不另开方案 |
| IO | `grpcClientCalls.ts` | `grpcErrorCode`、`makeUnaryClient`、`makeServerStreamClient`、`makeResidentBidiStreamClient`、`makeBidiStreamClient` |

不改 `IUniverseAgentGrpcTransport` 任一方法签名，不改 JSON path / marshalling。两个工厂**继续从 `grpcClient.js` 出口**；`universeAgentConnectionService.ts` 的 import 行不改。

**GFS-1 机器真值（签收裁定，替代原「不补单测」）：** 该文件今天零单测，`universeAgentConnection.test.ts` 全走 mock transport，搬错 mapper 只有 compile 兜底——不够。GFS-1 分两个 commit：

1. **GFS-1a 特征测（拆前）：** 新建 `platform/universeAgent/test/node/grpcClientMappers.test.ts`，对每个 `map*` 用一份代表性 wire JSON fixture 断言输出（deep-equal 快照写在测试里，不用外部 snapshot 文件）；至少覆盖 Connect / Session / Skill / AgentProfile / Mcp / Plugin / Tool / Model / Team 九组各一条 + 一条含缺省字段的边界样本。**只描述 HEAD 行为，不修 bug**（发现 bug 记 D17，另开切片）。
2. **GFS-1b 搬迁：** 拆文件；1a 的测试 import 路径改到 `grpcClientMappers.js`，断言零改动，全绿。

`grpcClientCalls.ts` 会成为第三个 `import * as grpc from '@grpc/grpc-js'` 生产点；合入后按 [packaging-and-release §12](packaging-and-release.md) 用 `rg` 复证 import 点，不抄旧表。

### 2.4 `conversationTimelineTree.ts`（vscode 自有）

同文件已是三套 class。投影计划已在 `conversationTimelineApply.ts`，本波**不**再拆 apply（不为拆而拆）。

| 层 | 提案文件 | 从 HEAD 搬出的块 |
|:---|:---------|:-----------------|
| 无环类型 | `conversationTimelineTypes.ts` | **先落地**：`ConversationTimelineItemVariant` / `ConversationTimelineItem` / `IConversationTimelineTreeOptions` / `ITurnTemplateData`。门面与 renderer **都只从这里 import**，禁止 tree ↔ renderer 互引类型。门面 **re-export** 今日已从 `conversationTimelineTree.js` 出去的类型与 `conversationLensUserBubbleShowMore/Less` |
| 状态机（门面） | `conversationTimelineTree.ts` | `export class ConversationTimelineTree` 与现有公开 API（`applyEntries` / `setTurns` / `revealTurn` / scroll lock / `getFocusedTurn` / …）。展开 Map 的 prune 仍由门面调用 renderer |
| 投影 | （已有）`conversationTimelineApply.ts` · `conversationPinnedUserPrompt.ts` · `conversationProcessFoldModel.ts` | 不搬 |
| IO | `conversationTimelineRenderer.ts` | `ConversationTimelineDelegate`、`ConversationTimelineRenderer`、`ConversationTimelineProcessFoldRenderer`、`renderHonestTimelineRow`、`appendTurnTrajectoryButton`。从 `conversationTimelineTypes.ts` 取类型，不 import 门面 class |

测继续 `import { ConversationTimelineTree, conversationLensUserBubbleShowMore } from '.../conversationTimelineTree.js'`。

## 3. 优先级（可维护性 vs 热路径）

可维护性压力最大的是 `session-actor`（2933，且上游 2961），但 (1) 它是 vendored，本仓拆等于手改；(2) 订阅流 Actor 刚收口，[session-view-frame-fanout](session-view-frame-fanout.md) 明确禁止动 `node/sessionCore/**`。热路径现在在 **Host / Hub / Connection**，不是这四文件。

因此 **先拆 vscode 自有、机械、且不在当前 P 槽上的文件**；最大的那份放到上游窗口。

| 序 | 切片 | 为什么现在 |
|:--:|:-----|:-----------|
| 1 | **GFS-1 `grpcClient` · 已落** @ `32f71812`/`32198d0b` | mapper 特征测 + 拆为 facade、`grpcClientMappers*`（Session/Catalog/Team）、`grpcClientCalls.ts`；工厂仍从 `grpcClient.js` 出口，`universeAgentConnectionService` 零改 |
| 2 | **GFS-2 `conversationTimelineTree` · 已落** @ `78bc8bbc` | `conversationTimelineTypes.ts` 先落无环类型；`conversationTimelineRenderer.ts` 搬 Delegate/Renderer；门面 `conversationTimelineTree.ts` 保留公开 API |
| 3 | **GFS-3 `conversationLens` · 已落** @ `c5d791c7` | `conversationLensProjection.ts` / `conversationLensSessionBar.ts` / `conversationLensDock.ts` / `conversationLensComposer.ts` / `conversationLensComposerChrome.ts`；门面 `conversationLens.ts` 保留公开 API 与会话集成枢纽 |
| 4 | **GFS-4 `session-actor` · 已落** @ Desktop `0dd3146cd` → 本仓 sync @ `a4ab1a3e754` | Desktop 已拆 + 本仓 vendored PIN `0dd3146cd05efdcce118d0c3c7e19eb28b615f5c`。与 GFS-1–3 无文件重叠；与 G-CORE-1（fanout）及 [cross-repo-protocol](cross-repo-protocol.md) G2 typed arm **同一 Desktop 写者串行**，或本刀只搬文件不改 mailbox/intent/typed arm |

拒绝「先拆 session-actor 因为最长」：那是在错误的仓动刀。

## 4. Vendored 回同步（仿 SYNC.md；不新建 SYNC.md）

### 4.1 来源（本轮实读，非编造）

| 项 | 实读 |
|----|------|
| 来源仓路径 | `UniverseAgentDesktop/packages/session-core/src`（SYNC.md 与 `scripts/sync-universe-agent-session-core.ts` 的 `SOURCE_DIR` 一致）。**不是** `apps/desktop/...`（那是 deviceGrant/hub） |
| PIN（本仓 vendored） | `0dd3146cd05efdcce118d0c3c7e19eb28b615f5c`（两份 session-core SYNC.md；本仓 sync @ `a4ab1a3e754`） |
| Desktop HEAD（GFS-4 已拆） | `0dd3146cd05efdcce118d0c3c7e19eb28b615f5c` @ UniverseAgentDesktop `loop/merge`（`wc -l` @ 2026-09-05：门面 736 + stream 733 + overlay 288 + local-fact 659 + timeline-items 138 + chat-outbox 220 + fold-interface 180 + production-source 23；均 ≤800） |
| 脚本 | `npx tsx scripts/sync-universe-agent-session-core.ts` |
| view 落点 | `src/vs/platform/universeAgent/common/sessionView/`（跳过上游 `view/index.ts`） |
| Actor 落点 | `src/vs/platform/universeAgent/node/sessionCore/` |
| vscode 手维护 | **只有** `common/sessionView/index.ts`（脚本结尾写明「Update … by hand if view exports changed」；`EXCLUDE_RELATIVE_FILES` 仅跳过 `view/index.ts`） |
| sync 覆写、禁止当手维护 | `node/sessionCore/index.ts`（来自 Desktop 根 `index.ts`）。新 fold 的 barrel 在 Desktop `packages/session-core/src/index.ts` 改完再 sync |

若实施首刀时 Desktop HEAD 已前进：以**当时** `git rev-parse HEAD` 写入 SYNC.md（脚本自动做）。不要把本稿 SHA 抄进代码。若同步环境找不到 Desktop 仓：脚本已失败退出；**不要**手补 PIN。注意脚本的 `getSourceCommitHash` 在 `git rev-parse` 失败时写 `unknown` 而不是退出（仓在但不是 git 工作树时会发生）——SYNC.md 出现 `unknown` 视为同步失败，不得合入。

### 4.2 更新方式

0. **G6 前置：** 上游已删四处 dead `private` 并合入（唯一路径；同步脚本没有删行能力，见 §2.1）。否则不要跑 sync。
1. 在 Desktop 改 `packages/session-core`（第一个 commit 是 G6 删除；随后 GFS-4 切分，每文件 ≤800 硬上限；新 fold 的 re-export 写在上游 `src/index.ts`，**不**突然导出 `SessionActor`），跑上游单测。与 G-CORE-1 / G2 typed arm 同时在途则同一写者，或本刀不碰 mailbox/intent/typed arm。
2. 本仓：`UA_DESKTOP_REPO` 指向该 Desktop 工作树（默认兄弟目录），执行 `npx tsx scripts/sync-universe-agent-session-core.ts`。
3. 目视 `sessionCore/SYNC.md` 与 `sessionView/SYNC.md` 的 Commit 与 Desktop HEAD 一致。
4. 若 view 导出变了，只手改 `common/sessionView/index.ts`（仍不 vendor 上游 index）。
5. **不要**手补 `sessionCore/index.ts`：它已被脚本覆写。缺 export 回 Desktop barrel 再 sync。

### 4.3 禁止

- 禁止手改 `node/sessionCore/**` 或 `common/sessionView/**` 的 vendored `.ts` 后不回源。
- 禁止为「本仓先能 compile」在 vendored 文件改 import / 拆 class。
- 禁止把 `sessionCore/index.ts` 当本仓手维护 barrel（下次 sync 被覆写）。
- 禁止未闭合 G6 就对 session-core 跑 sync；禁止为闭合 G6 给同步脚本加「删行 / patch」能力（脚本只做缩进与 import 重写，加了就是第二处手改）。
- 禁止新建第三份 SYNC.md 或在 `src/vs/` 下另开 docs 树讲同步。
- `deviceGrant` / `hub` 不在本方案范围；只借其 SYNC 体例。

`sessionView` 各文件已经按职责切开，不是巨型文件；回同步纪律覆盖**整棵树**，不只针对 `session-actor`。

## 5. 切片与文件互斥

这四份是高冲突域。并行看板（若开）按文件互斥，不按「主题看起来不重叠」。

| 切片 | 可写路径 | 同时禁止的写者 |
|------|----------|----------------|
| GFS-1 | `node/grpc/grpcClient.ts` + 新 `grpcClientMappers.ts` / `grpcClientCalls.ts` + 新 `test/node/grpcClientMappers.test.ts` | 第二人改这四份。**不**把 `universeAgentConnectionService.ts` 的 import 划进本切片互斥——工厂仍从 `grpcClient.js` 出口则该文件零改，可与 P 槽 GC-1b 并行 |
| GFS-2 | `conversationTimelineTypes.ts`（先）+ `conversationTimelineTree.ts` + 新 `conversationTimelineRenderer.ts` | 第二人改该树/类型/renderer；GFS-3 **开始前** GFS-2 必须合入（lens 只 import 树的公开 API，合入后可并行） |
| GFS-3 | `conversationLens.ts` + 新 projection / composer / composerChrome / dock / sessionBar | 第二人改 lens；测文件 `conversationLens.test.ts` 只允许为跟上符号而做机械 import 调整，且应避免 |
| GFS-4 | **Desktop** `packages/session-core/**`；本仓仅同步脚本输出的两棵树（**含**被覆写的 `sessionCore/index.ts`）+ 两份 SYNC.md + 手维护 `sessionView/index.ts` | 本仓任何人手改 `sessionCore/**` / `sessionView/*.ts`（除 `sessionView/index.ts`）；与 G-CORE-1、cross-repo G2 typed arm 同一 Desktop 写者串行，或本刀不改 mailbox/intent/typed arm。与本仓 fanout Host **可以**并行（Host 不是 vendored） |

规则：

- 同一路径同时只允许一个写者。
- 禁止「我只改下半段」共享巨型文件。
- GFS-1 / GFS-2 无路径重叠，**允许**两人并行。GFS-1 与 GC-1b **允许**并行（无共享写路径）。
- 整波不改 `IUniverseAgentGrpcTransport`、不改 `createSessionCore` 签名、不改 Conversation 三槽、不借拆分改投影语义。

### 5.1 与同批方案的顺序（签收裁定）

| 切片 | 前置 / 后续 | 原因 |
|:-----|:-----------|:-----|
| GFS-1 | **已落** @ `32f71812`/`32198d0b`。合入后 [packaging-and-release §12 / §3.1](packaging-and-release.md) 的 `@grpc/grpc-js` import 点清单要**用 `rg` 重新数**（多出 `grpcClientCalls.ts`），不抄旧表 | packaging 静态依赖根检查按 import 点计数 |
| GFS-2 | **已落** @ `78bc8bbc`。与 [prd-020](prd-020-turn-fixture-bench.md) 共写 `conversationTimelineTree.ts` 附近——后续 prd-020 若需加 `data-*` 钩子，可在门面补 | 避免同文件两写者 |
| GFS-3 | **已落** @ `c5d791c7`。拆分 projection / sessionBar / dock / composer / composerChrome；门面 `conversationLens.ts` 保留；`conversationLens.test.ts` it() 不减 | 与 [prd-020](prd-020-turn-fixture-bench.md) 等后续若共写 lens 门面，仍按文件互斥 |
| GFS-4 | **已落** @ Desktop `0dd3146cd` → 本仓 sync @ `a4ab1a3e754`（G6 @ `48cd90952`）；Desktop 写者与 G-CORE-1 / G2 串行 | §2.1 / §4.2 |

## 6. 验收

| 项 | 标准 |
|----|------|
| 行数 | 新模块软上限 **400**（纯 mapper 允许 **500**）。门面残留软上限 **800**，**硬上限 800 对 GFS-4 每一个产出文件生效**（`wc -l` 计），超了只能再切，**不接受在签收记录里改口**；GFS-1–3 门面残留硬上限 **1000**。GFS-3 扩切片后 lens 门面目标 ≤800 |
| 单测不减 | `conversationLens.test.ts` / Reveal / Trajectory / `sessionViewHost*` / conversation 既有测的 **it() 数量不下降**；允许新增。不为拆文件而重写测。GFS-1a 特征测断言在 GFS-1b 零改动 |
| 账本外零新红 | 以 [test-baseline-ci](test-baseline-ci.md) 账本为基线：拆分 PR 不得新增账本外失败；账本内项**不得**借拆分标 `skip` |
| compile | **只认 `npm run compile` 绿**（`scripts/test.sh` 不编译，只跑 `out/` 里已有产物，测绿不证明源码能编译）。GFS-4 sync 后不得再出现 G6 四成员的 `noUnusedLocals` TS6133 |
| 契约 | 四个原路径的公开 export 仍在；`universeAgentConnectionService` 仍从 `grpcClient.js` 取两个工厂（该文件零改）；contrib 仍只 import `platform/universeAgent/common` |
| vendored | GFS-4 后两份 SYNC.md Commit = 本次同步所用 Desktop HEAD；`git diff` 在 vendored 树上必须能**完整**解释为「脚本整树覆写」，无夹杂手改、无「确定性变换」。`sessionCore/index.ts` 与 Desktop barrel 一致 |

## 7. 审查与签收

- 本稿 2026-09-05 **签收（`accepted`）**。**GFS-1/GFS-2/GFS-3（含 residue @ `533fc6c42d5`）已在 HEAD 落地**（见文首落地注）。**G6 已在 Desktop 闭合** @ `48cd90952`。**GFS-4 已闭** @ Desktop `0dd3146cd` → 本仓 sync @ `a4ab1a3e754`（vendored PIN `0dd3146cd05efdcce118d0c3c7e19eb28b615f5c`；`sessionView/index.ts` 未手改）。**compile 未跑**（用户 skip）；不得声称 `npm run compile` 绿。
- 签收后若改文件名，只改本节与 §2 表，不另开方案。GFS-4 若实施时任一文件 >800 行，回到 §2.1 粗行表再切，不改 §6。

## 8. 审查记录（规则 16）

**2026-09-04 第一轮：** 只读审查。**无 Critical**。7 条 Important 全部改入。`status` 仍为 `draft`，待签收。

**2026-09-05 第二轮（对抗性，Cursor CLI · grok-4.6，结论 Reject）→ 复核改入后签收：** 第一轮「无 Critical」不成立；四条 Critical 经 HEAD 复核全部属实并改入。

| 意见 | 复核 | 处理 |
|------|------|------|
| C1 GFS-4 按自身切表就超 800，却允许「签收记录里改口」 | 属实：`onStreamEvent`→`foldAndBroadcastPatches` 约 1000 行 | §2.1 增 GFS-4 六文件粗行表（每文件 ≤600）；§6 对 GFS-4 每文件 800 **硬**上限、删「改口」出口；§7 |
| C2 GFS-1 假绿：零单测、connection 测全 mock transport | 属实 | §2.3 分 GFS-1a 特征测（先合）/ GFS-1b 搬迁（断言零改）；§5 互斥表增测文件；非目标增例外 |
| C3 G6「脚本确定性变换」是幻影前置：脚本只做缩进 / import 重写 | 属实（`scripts/sync-universe-agent-session-core.ts`） | §2.1 / §3 / §4.2 步骤 0 / §4.3 / §6 vendored：G6 **唯一**路径是上游删四处；禁止给脚本加删行能力 |
| C4 compile 门可绕：`scripts/test.sh` 不 compile | 属实（脚本只跑 Electron 单测） | §6 只认 `npm run compile` |
| I1 锚点 | 属实 | §1：`lensId` ~`:177`、`as unknown as`、`makeUnaryClient`、tree 1254 |
| I2 与 test-baseline 缺顺序 | 属实（D16 含 `conversationLens.test.ts`） | §5.1：GFS-3 等切片 1；§6 增「账本外零新红」 |
| I3 GFS-1 多出 grpc import 点，packaging 表未回写 | 属实 | §2.3 末段 + §5.1：合入后用 `rg` 重数 |
| I4 GFS-4 漏 cross-repo G2/G3 Desktop 写者串行 | 属实 | §3 序 4 / §4.2 / §5 GFS-4 |
| Minor `getSourceCommitHash` 失败写 `unknown` | 属实 | §4.1 增「SYNC.md 出现 `unknown` 视为失败」 |
| Minor 软 400 / 硬 1000「仍算本切片」是逃逸口 | 部分采纳 | GFS-4 收紧为 800 硬；GFS-1–3 保留 1000 硬（自有文件可再切，不需额外方案） |

**签收裁定：** 本方案的机器真值是「compile 绿 + 特征测/既有 it() 不减 + 账本外零新红 + 行数硬上限」。vendored 树上任何不能被同步脚本完整解释的 diff 都是手改，不接受。

| 意见 | 处理 |
|------|------|
| I1 2961→2933 是 stream-timeline G6 手删（`connectionGeneration` 等四处），不是 indent。GFS-4 前置：上游先删或脚本确定性变换，否则 sync 回归 + `noUnusedLocals` | §1 行差改口（28 行 = G6）；§2.1 / §4.2 步骤 0 / §4.3 / §6 compile 写成前置 |
| I2 `sessionCore/index.ts` 会被 sync 覆写。新 fold 的 barrel 在 Desktop `index.ts` 改完再 sync；本仓只手维护 `sessionView/index.ts` | 非目标增行；§4.1 分「手维护」与「覆写」；§4.2 删「手补 sessionCore/index.ts」；§5 GFS-4 可写路径改口 |
| I3 GFS-1 不要把 `universeAgentConnectionService` import 划进自己互斥。工厂仍从 `grpcClient.js` 出口则不改 connectionService，才能与 P 槽 GC-1b 并行 | §2.3 / §3 / §5 互斥表改口；§6 契约写「该文件零改」 |
| I4 GFS-4 与 G-CORE-1（fanout `CoreIntent` `sessionId`）同一 Desktop 写者串行，或 GFS-4 只搬文件不改 mailbox/intent | §2 原则、§2.1、§3 序 4、§4.2、§5 GFS-4 禁写列 |
| I5 拆分是同 class 文件搬迁，字段仍归门面；禁止借拆分改投影语义 | §0 非目标；§2 原则段；§2.2 字段仍在 `ConversationLens`；§5 规则末条 |
| I6 GFS-2 共享类型先落到无环模块，门面 re-export | §2.4 增 `conversationTimelineTypes.ts`；renderer 不 import 门面 class；§5 GFS-2 可写路径含该文件 |
| I7 GFS-3 补门面残留块粗行数；超 1000 就扩切片 | §2.2 粗行表：初案残留 ~1110 → 扩 `conversationLensComposerChrome.ts` + 实施时再切 `conversationLensDock.ts`；扩后残留 ~720 |

Minor：无单独条目要求改入。
