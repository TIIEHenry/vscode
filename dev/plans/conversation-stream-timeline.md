---
title: "Conversation 订阅流与时间线增量模型（M6 时间线专章）"
type: plan
status: accepted
phase: M6
updated: 2026-09-02
summary: "m6-engine-wave / ADR-003 的时间线专章（规则 16 两轮 Cursor CLI Grok 审查后签收）：显示写源 = SessionEventStream L1–L4；fold 复用 Desktop session-core（view→common，Actor→node）；同 token 增量加 acquireSessionView；attribution sidecar 解 role/agent；stub 改帧源；TimelineTree 三类帧增量；S1–S3 ReadyToImplement，S4–S6 随 M6-A/D"
---

# Conversation 订阅流与时间线增量模型

> **定位：** 本稿是 [m6-engine-wave](m6-engine-wave.md)（`accepted`）与 [ADR-003 引擎 adapter 边界](../decisions/003-engine-adapter-boundary.md)（`accepted`）的**时间线专章**，细化 m6 §3 的「时间线 / 发送 / 权限 / 变更事件」四行与 M6-A 发送链、M6-D 轨迹 fold。**不 supersede** 两稿的任何 Decision；对两稿的增量修订建议集中在 [§9](#9-对-m6--adr-003-的增量修订建议)。
> **需求：** [PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) / [PRD-004](../../docs/product/requirements.md#prd-004-权限座位) / [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级)（`accepted`）；活数据上游 [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威)（`blocked`）。
> **透镜合同：** [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) §3 / §6（三槽冻结；阶段 3a「只换服务」由本稿修正为「换帧源 + 增量 apply」）。
> **外仓合同（只读，不复述）：** Desktop [ADR-009](../../../UniverseAgentDesktop/dev/decisions/009-session-projection-core.md) 投影核 · [ADR-012](../../../UniverseAgentDesktop/dev/decisions/012-chat-stream-lifecycle-and-outbox.md) Chat 流与 outbox · [ADR-013](../../../UniverseAgentDesktop/dev/decisions/013-engine-event-ingestion-reliable.md) 摄入 Reliable；`UniverseAgentDesktop/packages/session-core`；引擎 proto `UniverseAgent/grpc-api/src/main/proto/{session_service,message_envelope,agent_service}.proto`。
> **规则 16：** Cursor CLI `cursor-grok-4.6-high`（`--mode ask` 只读）两轮：第一轮 **Reject** → 改稿；第二轮 **Approve with changes**（1 Critical + 6 Important）→ 全部改入（见 [§12](#12-审查记录)）。**2026-09-02 用户授权「改完没问题就签收」，据此 `accepted`。** S1–S3 ReadyToImplement；S4–S6 随 m6 / ADR-003 签收。

**Goal：** 把「引擎事件流怎么进 IDE、时间线怎么增量更新」写成可实施合同。vscode **不**自研 fold：复用 Desktop `session-core` 做 L1–L4 fold；renderer 只应用幂等 `ViewFrame`。无引擎 stub 改为**同一契约的帧源**，时间线只剩一条渲染路径；引擎接通时换帧源，不换 UI、不换 token。

## 1. 选定与拒绝（本稿裁定）

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 显示写源 | `SessionService.SessionEventStream` **L1–L4** 全部经 demux 进 session-core（L1 控制 → `SyncChrome`；L2 持久 envelope → timeline；L3 运行态 → overlay；L4 `permission_request` / `ask_user_question` / `client_tool_call` → `pendingActions`） | 用 `AgentService.Chat` 的 `ChatResponse` 当显示源（无 seq、无持久身份、双写源；Desktop ADR-012 INV-CHAT-2） |
| 写路径 | `AgentService.Chat` bidi 只做写：`SessionInput` / `PermissionResponse` / `ClientToolResponse` / `heartbeat_ack`；回执只产 `localFact` | Send 后本地回写助手行当权威 |
| fold 归属 | **复用** session-core，经同步脚本 verbatim 落两层：`view/**` → `platform/universeAgent/common/sessionView/`；其余（Actor / mailbox / fold）→ `platform/universeAgent/node/sessionCore/` | vscode 自研 fold；整包塞 `common`（会进 web 包体，且违反 ADR-009「renderer 只见 view」） |
| renderer 边界 | 两道门：① ESLint `local/code-layering`（`common` / `browser` / `electron-browser` 不得见 `node` 目录名；现为 warn，S1 对 `platform/universeAgent/**` 提为 error）；② S1 新增 **platform 级** boundary 测：扫描 `src/vs/workbench/**`（含 `services/` 与全部 contrib）与 `src/vs/sessions/**` 生产文件，禁 import `platform/universeAgent/node/**`。`valid-layers-check` 是 API / lib 检查，**不是** path 门，不计入 | 只靠 `contrib/conversation` 的 import 扫描；把 `valid-layers-check` 当 path 门 |
| token | **同 token**：`IConversationRosterService`（id `'conversationStubService'`）**增量加** `acquireSessionView(sessionId)`；`onDidChangeSession` / `onDidChangeActiveSession` / `onDidChangeEngineConnection` 继续发（ADR-003 §4、m6 §7「扩展方法挂同一接口」） | 第二 token `IConversationSessionViewService`；收缩 roster 公开形状 |
| 旧时间线方法 | `getTurns` / `getTrajectoryRecords` / `append*Turn` / `resolveConfirmation` 在 S3 变为**从 lease 快照派生的 shim**；删除另开切片（附迁移表） | S1 直接删方法让 PRD-015/016 测试面崩 |
| role / agent 归属 | vscode 自有 **attribution sidecar**：`{ itemId, role, agentId?, agentPath? }`，demux 从 `MessageEnvelopeProto.role / agent_id / agent_path` 直接填；stub 从 fixture `kind` 填 | 按 `title` 字面猜 role；等上游 session-core 改 S0 才开工 |
| 产品视图模型 | 单一纯函数 `projectSnapshotToEntries(snapshot, attribution)` → `ConversationTimelineEntry[]`；stub 与引擎共用 | adapter 直接产 `ConversationStubTurn`（第二次 fold） |
| 时间线刷新 | `applyEntries(entries, changedIds)`：三类帧分治（[§3.4](#34-时间线增量-apply三类帧)） | 每帧 `setChildren(null, all)` + 清空所有展开态 |
| 乐观发送 | 三键分立：`message_id`（乐观 UI 占位）/ `operation_id`（幂等 + supersede）/ `originLeaseId`（多窗口裁剪）；Actor 分配（ADR-012 §6.1） | 三键合一；见到 echo 就删事件；`PostOutcome.accepted` 当「已到引擎」 |
| 宿主进程 | **不裁决**。按 ADR-003 §1：`platform/universeAgent/node` 客户端 + `electron-browser` ProxyChannel；具体宿主（main / shared / 新 utility）由 M6-A 实施定；**不得**复用 agentHost 子进程 | 本稿预设 UtilityProcess 为默认 |
| 连接真相两层 | 连接级 `isEngineConnected()` = `session_token` + 活 channel（ADR-003 §7）→ StatusBar 芯片 / Engine 页门控；会话级 `sync.kind` → SessionBar 徽标，只有 `live` 可说「已连接」 | 用 `sync: live` 抬 Engine 页能力三态；用 `isEngineConnected` 冒充某会话已同步 |
| 断连 | `degraded` / `closed` 保留最后 baseline 只读并明示「断开前快照」；不回填 stub 种子（m6 §6） | 显示上次 RPC 缓存并写「已同步」；回退 stub echo |

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| `IConversationRosterService`：3 事件 + 31 方法；`setEngineConnected` 对 UI 可写 | `conversationStubService.ts:16-59` |
| `ConversationStubTurn { id, kind, text, status?, stubEcho?, toolName?, summary?, payload?, visualize? }`；kind ∈ `user\|assistant\|confirmation\|thinking\|tool\|visualization`；无 streaming / seq / operationId | `conversationStubModel.ts:19-32` |
| Lens 订阅 `onDidChangeSession` → `renderTimeline()` → `getTurns()` → `setTurns()` 全量 | `conversationLens.ts:226-236`, `:1289-1298` |
| `setTurns` 清 seats / userBubble / processFold / visualize 展开态后 `tree.setChildren(null, items)` | `conversationTimelineTree.ts:640-659` |
| 树已有 `identityProvider`（turn.id / `fold:` span id）、`supportDynamicHeights`；`withPersistedAutoScroll` | `conversationTimelineTree.ts:529-551`, `:832-842` |
| 测试 `conversationLens.test.ts` 约 27 处 stub 直调（`appendUserTurn` / `getTurns` 后查 `data-kind="user"`，如 `:553,706,1597`）；T6 语音测靠 `setEngineConnected(true)`（`:1720-1721`） | 见 [§3.7](#37-旧方法调用点与-shim) |
| 轨迹记录 kind ∈ `system\|user\|context\|compacted\|message\|tool\|subtool\|thinking`，`projectTurnsToTrajectory(turns)` | `conversationTrajectoryModel.ts:8`, `:42` |
| `conversationImportBoundaries.test.ts` 只扫 `contrib/conversation` 生产文件、只禁 Copilot 路径 | 该文件 `:14-19` |
| 兄弟仓同步先例（协议**类型**；加 Microsoft 头） | `scripts/sync-agent-host-protocol.ts:6-23` |
| 分层：`common` 可被 browser / web 加载；`node` 仅 Node 宿主；`common`/`browser` 不得 import `node` | `.github/instructions/source-code-organization.instructions.md` |
| 引擎流四层：`SessionStreamEvent` oneof；L1 `hello` / `heartbeat` / `subscription_health` / `session_closed` / …；L2 `envelope_appended` / `envelope_batch_appended` / `envelope_range_replaced` / `branch_topology_notified`；L3 `streaming_delta` / `thinking_delta` / `tool_call_lifecycle` / `tool_call_delta` / `turn_lifecycle` / `runtime_overlay_snapshot` 等 17 种；L4 `permission_request` / `ask_user_question` / `client_tool_call` | `message_envelope.proto:468-526` |
| `StreamHello { session_version, head_seq, runtime_epoch, last_mutated_from_seq }`；`MessageEnvelopeProto { id, seq, role ∈ USER\|ASSISTANT\|SYSTEM\|TOOL, agent_id, agent_path, turn_id, branch_reason, blocks[] }` | `message_envelope.proto:362-389`, `:534-539` |
| `AgentService.Chat(stream ChatRequest) returns (stream ChatResponse)`；`ChatRequest.payload` oneof 含 `session_input` / `permission_response` / `client_tool_response` / `heartbeat_ack`；`SessionInput` 同时有 `message_id`（乐观 UI）与 `operation_id`（幂等） | `agent_service.proto:14`, `:117-130`, `:146-159` |
| `SessionService.GetHistory`（`cursor_seq` 分页） | `session_service.proto:31` · `message_envelope.proto:401-403` |
| session-core：`createSessionCore(deps).post / takeIntents`；ports `SchedulerPort` / `IdPort` / `DiagnosticsPort`；`ViewFrame { leaseId, generation, frameId, version, body: baseline\|patches\|effects }`；`TimelineItemSummary` kind ∈ `text\|reasoning\|tool\|permission\|question\|error\|usage\|generic\|unknown`（`generic` 禁止生产 fold 使用）；`TimelineItemView.agentId?` 仅 pendingActions 投影；fold 输入是 demux 后的 domain arm（`text\|tool\|reasoning\|permission\|error\|usage\|clientToolCall\|unknownBlock`），**`text` arm 无 role**（S0 有意 omit） | `packages/session-core/src/{session-core.ts:33-38,75, ports.ts:14-25, view/types.ts:7-8,79-187,325-334, stream-event-to-view-patch.ts:51-76,167-175}` |
| `view/**` 生产文件除 **`index.ts:64`**（`export { pendingActionFromLocalPendingSend } from '../pending-actions-bound.js'`，后者再 import Actor 侧 `local-fact` / `local-pending-sends`）外只 import 本目录；非 view 文件对 `./view/*.js` 的 import 可被路径重写覆盖 | `packages/session-core/src/view/{apply,index,client-tool-call,question-ask,overlay-view-helpers,empty-snapshot}.ts` · `pending-actions-bound.ts:39-45` |
| ESLint：`local/code-layering`（warn）挡目录名分层；`header/header`（**error**）要求 Microsoft 头；`.eslint-ignore` 已有 vendored 先例（`src/vs/base/common/lit-html/**`、`signals-core/**`） | `eslint.config.js:110-143` · `.eslint-ignore:61-63` |
| `valid-layers-check` = `layersChecker.ts`（禁 NATIVE_TYPES）+ `layersTypeCheck.ts`（按 `tsconfig.browser.json` 做 API/lib 检查）；不查 path；D8 仍红 | `build/lib/layersChecker.ts` · [D8](../progress/deferred-gaps.md) |
| HEAD 生产调用点（非测试）：`getTurns` 仅 `conversationLens.ts`（`:823,860,1151,1280,1291,1317`）；`appendUserTurn` / `appendStubEchoAssistant` 仅 Dock `conversationLens.ts:1363-1364`；`resolveConfirmation` `:493,1301`；`deleteTurn` `:495,1309`；`updateUserTurnText` `:1378`；`updateMessageQueueItemContent` `:1390`；`getTrajectoryRecords` `:1153,1174`；`isEngineConnected` 仅语音 mic `:947,979`；`countPendingConfirmations` 在 `conversationSessionsView.ts:101,123,223`、`conversationInboxOverlay.ts:128`；StatusBar **不**读 `isEngineConnected`（文案写死，`conversationSessionStatusBar.ts:114-115`）；`appendThinkingTurn` / `appendToolTurn` / `appendConfirmationTurn` 无生产调用（fixture / 测试） | `rg` @ 2026-09-02 |
| Desktop proto→arm demux 在宿主侧，`title = titleFromRole(role)` | `apps/desktop/src/main/engine/demux-{session-stream-event,message-envelope}.ts` |

## 3. 设计

### 3.1 分层与数据流

```text
UniverseAgent 引擎
  │ gRPC SessionEventStream L1–L4（显示写源）     gRPC AgentService.Chat（写路径）
  ▼                                                 ▲
[platform/universeAgent/node —— 宿主进程由 M6-A / ADR-003 定；不是 agentHost 子进程]
  SessionStreamHost（pull 解码；Reliable：不分类不合并不丢弃，ADR-013）
  → demux（proto → domain arm）+ attribution（role / agent_id / agent_path）
  → session-core Actor（per-session；L1–L4 fold；lease 集合；linger）
  → ConversationViewFrame = { frame: ViewFrame, attribution?: AttributionPatch[] }
  │ electron-browser ProxyChannel（per-window，per-lease 有序）
  ▼
[renderer / workbench]
  IConversationRosterService.acquireSessionView(sessionId)  ← 同 token
  → SessionViewReplica（common/sessionView/apply.ts；非预期 frameId → requestResync）
  → projectSnapshotToEntries(snapshot, attribution)（纯函数）
  → ConversationLens → ConversationTimelineTree.applyEntries()
```

**落点：**

| 路径 | 内容 | 层 |
|------|------|----|
| `platform/universeAgent/common/sessionView/**` | session-core `view/**` verbatim（types / apply / client-tool-call / question-ask / overlay-view-helpers / empty-snapshot）。**不 vendor `view/index.ts`**（其 `:64` 反向 re-export Actor 侧 `pending-actions-bound`）；vscode 自写 `index.ts` 只 re-export 本目录；`pendingActionFromLocalPendingSend` 留在 node 侧 | common |
| `platform/universeAgent/common/conversationViewFrame.ts` | `ConversationViewFrame` / `AttributionPatch` / `ConversationWriteMessage` 契约（vscode 自有） | common |
| `platform/universeAgent/node/sessionCore/**` | session-core 其余生产源（`session-core` / `session-actor` / `mailbox` / `stream-event-to-view-patch` / `local-fact` / …）；同步脚本把 `./view/*.js` 重写为 `../../common/sessionView/*.js` | node |
| `platform/universeAgent/node/demux/**` | proto → domain arm + attribution；可先同步 Desktop `demux-*.ts` 再裁剪；生成物 / `@grpc/grpc-js` 引入按 ADR-003 / M6-A | node |
| `scripts/sync-universe-agent-session-core.ts` | 来源 `UniverseAgentDesktop/packages/session-core/src`；跳过 `*.test.ts` / `testing/` / `view/index.ts`；2 空格 → tab；非 view 文件 `./view/*.js` → `../../common/sessionView/*.js`；**保留上游文件头**；两棵 vendored 树加入 `.eslint-ignore`（先例 `src/vs/base/common/lit-html/**`），因此 `header/header`（error）与 `code-layering` 对其不生效——renderer 边界由**消费方**（browser / common 侧）的 `code-layering` + platform 级 boundary 测把关；写 `sessionView/SYNC.md` + `sessionCore/SYNC.md`（来源 SHA；`sync-agent-host-protocol.ts` 因加 Microsoft 头才不需豁免，本树不同） | 脚本 |
| `contrib/conversation/**` | 只 import `platform/universeAgent/common/**` 与自家 | browser |
| `platform/universeAgent/test/common/universeAgentImportBoundaries.test.ts`（S1 新增） | 扫描 `src/vs/workbench/**`、`src/vs/sessions/**` 生产文件（排除 `test/`、`node/`、`electron-main/`），禁 import `platform/universeAgent/node/**`；这是 D8 闭前**唯一真实生效**的 path 门 | test |

**禁止**手改 vendored 目录；改动回上游 Desktop 仓再同步。

### 3.2 renderer 契约（同 token 增量）

```ts
// contrib/conversation/browser/conversationStubService.ts（接口所在文件不变）
export interface IConversationRosterService {
	// … HEAD 既有 3 事件 + 31 方法保持 …
	/** S1 新增。每个 chat tab / 对话框 / split 列各持一个 lease；同 session 多 lease 共享一条订阅。 */
	acquireSessionView(sessionId: string): IConversationSessionViewLease;
}

// platform/universeAgent/common/conversationViewFrame.ts
export interface IConversationSessionViewLease extends IDisposable {
	readonly sessionId: string;
	readonly snapshot: SessionViewSnapshot;                 // baseline 前为 emptySnapshot（sync: idle）
	readonly attribution: ReadonlyMap<string, ItemAttribution>;
	readonly onDidApplyFrame: Event<ConversationViewFrameApplied>;
	post(msg: ConversationWriteMessage): PostOutcome;      // accepted ≠ 已到引擎（ADR-012 INV-CHAT-3）
	requestResync(): void;
}

export interface ItemAttribution {
	readonly role: 'user' | 'assistant' | 'system' | 'tool';
	readonly agentId?: string;
	readonly agentPath?: readonly string[];
}

export type AttributionPatch =
	| { readonly op: 'upsertAttribution'; readonly itemId: string; readonly attribution: ItemAttribution }
	| { readonly op: 'removeAttribution'; readonly itemId: string };

export interface ConversationViewFrame {
	readonly frame: ViewFrame;                              // session-core 原样
	readonly attribution?: readonly AttributionPatch[];    // 同帧、同 itemId；baseline 帧带全量 map
}

export type ConversationViewFrameApplied =
	| { readonly kind: 'baseline' }
	| { readonly kind: 'patches'; readonly changedIds: ReadonlySet<string> }   // TimelineItemId | `overlay:${blockId}` | `pending:${requestId}` | `send:${messageId}`
	| { readonly kind: 'effects'; readonly effects: readonly ViewEffect[] };

export type ConversationWriteMessage =
	| { readonly kind: 'submitInput'; readonly text: string }                   // 三键由 Actor 分配
	| { readonly kind: 'permissionRespond'; readonly requestId: string; readonly decision: 'allow' | 'deny' }
	| { readonly kind: 'questionRespond'; readonly requestId: string; readonly answers: Readonly<Record<string, string>> }
	| { readonly kind: 'clientToolRespond'; readonly requestId: string; readonly resultJson: string };
// S1–S3 只用 submitInput；S5 须对照 ChatRequest.payload 完整 oneof（含 question_response 等）
// 与 unary PermissionService.Respond，逐臂决定写路径。
```

- `isEngineConnected()` 语义按 ADR-003 §7 / m6 §5（连接级）；本稿不改。`onDidChangeEngineConnection` 不变。
- `sync.kind` 是会话级订阅态，来自 lease；**不**并入 `isEngineConnected`。
- attribution 是 vscode 自有 sidecar，不改 session-core 类型；上游若把 role / agent 投进 `TimelineItemView`（[§6 G1/G4](#6-契约缺口需上游补vscode-不得自造)），sidecar 退场。

### 3.3 产品视图模型 `projectSnapshotToEntries(snapshot, attribution)`

`ConversationTimelineEntry` 取代 `ConversationStubTurn` 成为时间线输入；`ConversationStubTurn` 降为 stub fixture 输入类型。

**命名清楚：** 这一步（含 attribution join）是 **vscode 产品投影**，不是 session-core 的事件语义 fold。Desktop ADR-009 §3 禁止的是 renderer 做事件 fold / overlay≡L2 合并；产品映射允许，但范围只限「summary → entry.kind」与「role / agent 归属 join」。§1 拒绝的「adapter 直接产 `ConversationStubTurn`」指的是绕过 session-core 另写一套 fold，不是这一步。实施者**不得**因为这里存在 join 就用 `title` 填 role。

| 来源 | entry.kind | 备注 |
|------|-----------|------|
| `timeline[]` `summary.kind='text'` + attribution.role | `user` / `assistant` / `system` | attribution 缺失（不应发生）→ 中性正文 + 诊断计数，**不猜 title** |
| `'reasoning'` | `thinking` | `streaming` → 折内 `Codicon.loading`（仅引擎 live；stub 禁止） |
| `'tool'` | `tool`；`toolName==='visualize'` 且拿到完整参数 → `visualization`（[G2](#6-契约缺口需上游补vscode-不得自造)） | `status` → 完成勾 / loading / 失败；`canvasRefs` 保留给 Preview 打开 |
| `'permission'` | `confirmation` | `pendingActions` 中存在同 requestId → 座位可点；`summary.decision` → 已决 |
| `'question'` | `question`（新） | Ask-user 与权限分家（Desktop ADR-018）；PRD 缺口见 [§7](#7-产品需求待改规则-10a) |
| `'error'` | `error`（新） | `retryable` 决定是否画重试 |
| `'usage'` | 不进对话页 | 喂 PRD-015 上下文环 / 轨迹 |
| `'unknown'` | `unknown`（新） | 诚实降级：`typeName` + 有界 `rawContent` |
| `'generic'` | 不应出现 | session-core 注明生产 fold 不得使用；出现即诊断 |
| `overlay.blocks[]` | 追加在尾部的 **live 行**；id `overlay:${blockId}`；`chunks` 按 `orderKey` 拼接；role 由 demux 从 L3 事件的 `agent_id` 所属侧写入 attribution（`overlay:${blockId}` 键）——L3 运行态事件**只由 agent 产生**，这是协议事实不是猜测，产品约定记为 `assistant`；无 attribution 时与 text 行同样中性 | L2 落盘后 session-core 移除 overlay 块、同 turn 的 timeline 行接管；UI **不**做「同一条」推断，接受一次卸行 + 挂行 |
| `pendingActions[]` | 座位来源（不是行来源） | 座位不是可回收 virt 行（lens-assembly §3） |
| `localPendingSends[]` | `user` 行占位，`pending: true`；role 固定 `user` | 只在发起 lease 可见；被 L2 supersede 时消失 |
| `sync` | 不是行；喂 SessionBar 徽标 + Inbox 文案 | 五态 `idle / syncing / live / degraded(reason) / closed(reason)` |

**排序**：按 `orderKey` 字面比较；**禁止**解析 `orderKey` 或用它做缺口检测。`localPendingSends` 排在 timeline 之后、overlay 之前。

**过程折**：`projectProcessFoldSpans(entries)` 照旧按连续 `thinking / tool` 切段；span id `fold:${firstEntryId}` 稳定，展开态按 span id 保留。

**轨迹**：`projectTurnsToTrajectory` → `projectSnapshotToTrajectory(snapshot, attribution)`；`role='system'` → `system`，`branch_reason='compact'` → `compacted`（需 demux 投影，S6）。轨迹页要 SYSTEM / context / 工具全文，而 `TimelineItemSummary` 只带有界预览（INV-SPC-13）→ S6 依赖 `GetHistory` + `DetailRef`（[G3](#6-契约缺口需上游补vscode-不得自造)）。S1–S3 保持 fixture extras。

### 3.4 时间线增量 apply（三类帧）

`ConversationTimelineTree.setTurns(turns)` → `applyEntries(entries, changed?: ReadonlySet<string>)`。`WorkbenchObjectTree` 语义：同 identity 不替换节点，须 `rerender()` 才刷内容；结构变化走 `setChildren(..., { diffIdentityProvider })`。据此分三类，**验收分别写**：

| 帧类 | 触发 | 做法 | 验收 |
|------|------|------|------|
| A 同 id 内容变化 | overlay chunk 追加、tool status 变、permission decision 落、attribution 补 | `tree.rerender(item)` 仅 `changed` 命中的行 | rerender 计数 = changed 数；**`setChildren` 调用次数 = 0**（负向断言，防「全量重设后再 rerender」假绿）；展开态 Map 不变；滚底 hold 不被打断 |
| B 结构变化 | 新行追加、`localPendingSends` 被 L2 supersede、overlay → L2 卸挂、range replaced | `setChildren(null, items, { diffIdentityProvider })`；未变 id 的 DOM 复用 | 未变 id 行 DOM 节点同引用；展开态按 id 保留；被删 id 从 Map 剔除 |
| C 过程折 span 变化 | 连续 `thinking/tool` 段延长 / 被 user 切开 → 根子节点集合从多 turn 折成一个 `fold:` 节点或反向 | 允许根级 splice（结构 diff）；**只**保证 span id 稳定时展开态保留；span id 变化 = 新折，默认按页态（对话收起 / 轨迹展开） | 测试矩阵：延长段（span id 不变 → 展开态保留）；切开段（新 span id → 默认态）；不假绿「只 rerender 变更行」 |

其余：

- 展开态（userBubble / processFold / visualize）、座位实例、编辑态改为**按 id 的 Map**；apply 后剔除不存在的 id，不再整体清空。
- **流式文本**：overlay 行 `streaming` 期间用纯文本 + 光标态，L2 落盘后才走 `IConversationTurnContentAdapter` markdown。
- **帧合并**：`SessionViewReplica` 把同一动画帧内到达的 patches 合并后触发一次 `onDidApplyFrame`（`changedIds` 并集）；apply 上限 1 次 / 16ms，不丢帧。
- **滚动 / 高度**：沿用 `withPersistedAutoScroll` + `ConversationAutoScrollHolds`；`supportDynamicHeights` 已开。

### 3.5 发送链（三键分立）

```text
Dock Send
  → lease.post({ kind:'submitInput', text })
  → Actor：分配 messageId / operationId / originLeaseId（ADR-012 §6.1）
       upsertLocalSend（乐观占位，仅 originLeaseId 所在窗口可见）
       意图 chatStreamWrite（SessionInput.message_id = messageId, operation_id = operationId）或入 outbox
  → 引擎 L2 envelope_appended（携 operation_id）→ session-core removeLocalSend + upsertTimelineItem
```

| 键 | 用途 | 谁分配 |
|----|------|--------|
| `message_id` | 绑乐观 UI 占位（`PendingSendView`） | Actor `IdPort` |
| `operation_id` | 引擎幂等；L2 supersede 对账在 Actor 内按 ADR-012 §6.2 三元组 `sourceClientId + operationId + messageId` 做，renderer 只见 `operationId`（INV-SPC-2 不暴露 `sourceClientId`） | Actor |
| `originLeaseId` | 多 lease 裁剪：只有发起窗口见「发送中」 | Actor（由 `post` 的 lease 决定） |

- PRD-003.2 由 L2 事实满足；乐观占位是 overlay 级 chrome。
- `PostOutcome.accepted=false`（`mailbox_full` / `not_authenticated` / `no_such_session`）→ Dock 显式失败文案；不静默、不写「已发送」。
- outbox 溢出 / flush 超时 / stale `chatAttemptId` → `ViewEffect` → Inbox 一次性提示；`localPendingSends` 标 failed。语义沿 ADR-012 §4 / §6，vscode 不另造。
- 与 m6 M6-A 一致：**已连接**时 `appendStubEchoAssistant` 在 service 层拒写；**未连接**时 stub 帧源走同一 `post` 路径产 Stub echo（[§3.6](#36-stub-作为帧源)）。

### 3.6 stub 作为帧源

`ConversationStubService` 保留类名与 token；内部新增 `ConversationStubFrameSource`：

- fixture（`untitled` / `tour` / `blank` / `visualize`）→ `stubTurnsToSnapshot(turns)`：`sync: idle`；text 行 title 带 Stub；`kind` → attribution.role（**不进** `TimelineItemSummary`）；permission → `pendingActions`。
- `post(submitInput)` → `upsertLocalSend` → 下一 tick `removeLocalSend + upsertTimelineItem(user)` → 可选 `upsertTimelineItem(text, Stub echo)`。
- 旧方法（`getTurns` 等）在 S3 改为从 snapshot + attribution 派生（[§3.7](#37-旧方法调用点与-shim)）。
- **禁止** stub 产 `sync: live`、`streaming: true`、`Codicon.loading`（PRD-007 / PRD-013.4）。需要 `live` 的测试（T6 语音 mic）改用 **测试专用** `TestConversationFrameSource`（`test/browser/`），不是产品 stub 类。
- MessageQueue / AutoDrive fixture 不在 `SessionViewSnapshot` 内 → 留在 roster 接口既有方法（m6 §3「保留接口」），本稿不动。

### 3.7 旧方法调用点与 shim

S3 前**不改**公开形状。**同步点写死：**

- **S2 起，stub 的所有写方法双写**：`appendUserTurn` / `appendStubEchoAssistant` / `appendConfirmationTurn` / `appendThinkingTurn` / `appendToolTurn` / `resolveConfirmation` / `deleteTurn` / `updateUserTurnText` 既更新旧 `ConversationStubSession.turns`，也同步向 `ConversationStubFrameSource` 产帧（patches）。透镜在 S2 **只**订 `onDidApplyFrame`、只读 lease；HEAD 测试「`appendUserTurn` 后查 `data-kind="user"`」因此仍绿。
- **S3 起，读方法变 shim**（从 lease 派生），旧 `turns` 数组退为帧源内部 fixture 存储；写方法改为只经 `post` / 帧源。
- 删除旧方法在 M6-D 之后另开切片并附迁移表。

| 方法 | HEAD 生产调用点（非测试，`rg` @ 2026-09-02） | S2 | S3 |
|------|--------------------|----|----|
| `getTurns` | `conversationLens.ts:823,860,1151,1280,1291,1317`（透镜内部：输入历史、轨迹、渲染、pinned prompt） | 透镜改读 lease | shim：`entriesToLegacyTurns(projectSnapshotToEntries(...))` |
| `getTrajectoryRecords` | `conversationLens.ts:1153,1174` | 透镜改读 lease | shim：`projectSnapshotToTrajectory` ∪ fixture extras |
| `appendUserTurn` / `appendStubEchoAssistant` | Dock `conversationLens.ts:1363-1364` | 双写 | 转 `lease.post(submitInput)`；已连接时 echo 拒写（m6 M6-A） |
| `resolveConfirmation` | `conversationLens.ts:493,1301` | 双写 | → `post(permissionRespond)`；stub 帧源移 `pendingActions` |
| `deleteTurn` / `updateUserTurnText` | `conversationLens.ts:495,1309` / `:1378` | 双写（帧源 `removeTimelineItem` / `upsertTimelineItem`） | 保留为 stub 专用 fixture 编辑；已连接时拒写（引擎无对应 RPC 前不假装） |
| `countPendingConfirmations` | `conversationSessionsView.ts:101,123,223`、`conversationInboxOverlay.ts:128` | 不动 | shim：`snapshot.pendingActions.length` |
| `appendConfirmationTurn` / `appendThinkingTurn` / `appendToolTurn` | 无生产调用（fixture / 测试） | 双写 | 测试保留，写帧源 |
| `updateMessageQueueItemContent` 及 MessageQueue / AutoDrive 族 | `conversationLens.ts:1390` 等 | 不动 | 不动（不在 snapshot；m6 §3「保留接口」） |
| `onDidChangeSession(sessionId)` | lens、`conversationSessionWindowService.ts:263`（标题）、roster、StatusBar；Inbox **不**订阅（由透镜 `render()` 拉） | 每次 frame apply 后**合并发一次** | 同 |
| `isEngineConnected` / `setEngineConnected` | 仅语音 mic `conversationLens.ts:947,979`；StatusBar HEAD **未订**（切片 5 才接） | 不动 | 不动（ADR-003 §7；`setEngineConnected` 测试保留） |

测试面：`conversationLens.test.ts`（约 27 处 stub 直调）、`conversationStubService.test.ts`、`conversationIdentityStrip.test.ts`、`conversationTrajectory*.test.ts`、`conversationSessionChat.test.ts` 等继续用 `ConversationStubService` 作内存 fake；S1–S3 **不得**让它们改注入方式。

### 3.8 断连 / 重连 / 诚实

| 会话态 `sync` | 来源 | UI |
|----|------|----|
| `idle` | 未订阅（stub、或未选 profile） | SessionBar 无徽标；stub 文案含 Stub |
| `syncing` | 订阅中 / HistoryFill / reseed | 徽标「同步中」；时间线保留旧 baseline 可读，不闪空 |
| `live` | hello 对齐、无 gap | 徽标「已连接」；**唯一**允许该措辞的会话态 |
| `degraded(reason)` | L2 gap 未补、mailbox 溢出重试、stale 终态 anomaly | 徽标「降级：reason」；输入仍可用（走 outbox） |
| `closed(reason)` | `session_closed` / `session_purged` / 连接下线且 linger 到期 | 徽标「已断开」；保留 baseline，列顶「显示为断开前快照」；Send 禁用并说明；不回填 stub 种子（m6 §6） |

- 连接级 StatusBar 芯片 / Engine 页仍按 `isEngineConnected()` 与能力三态（m6 §5、customizations-engine §2）；两层各说各的，**互不代称**。
- 非预期 `frameId` / `generation` → `requestResync` → 等新 baseline；renderer 不补洞、不重排。
- 多 chat tab / 对话框 / split（PRD-016）= 同 session 多 lease，共享一条订阅；最后一个 lease 释放进 linger（默认 30s）。

## 4. 切片

| # | 内容 | 验证 | 引擎？ |
|---|------|------|--------|
| S1 | 同步脚本（跳过 `view/index.ts`；自写 barrel；`.eslint-ignore` 两棵树；SYNC.md）+ `common/sessionView/**` + `node/sessionCore/**`；`conversationViewFrame.ts` 契约；`acquireSessionView` 增量加入接口；`stubTurnsToSnapshot` + attribution；`projectSnapshotToEntries`；`ConversationStubFrameSource`（lens **尚未**切换）；platform 级 boundary 测；`code-layering` 对 `platform/universeAgent/**` 提 error | 新 `conversationSessionView.test.ts`：三会话 fixture → entries → legacy turns 与 HEAD `getTurns` 逐项等价；`npm run compile` 绿；`npm run eslint` 绿（含 header / layering）；boundary 测绿。`valid-layers-check` 不是本切片门（API/lib 检查；D8 open） | 否 |
| S2 | `applyEntries` 三类帧；按 id Map 保留态；overlay live 行 + chunk 拼接；帧合并；**stub 写方法双写**（[§3.7 同步点](#37-旧方法调用点与-shim)）；lens 改订 `onDidApplyFrame`、只读 lease | `conversationTimelineScroll.test.ts` 扩三类帧矩阵（A rerender 计数 + `setChildren`=0 / B DOM 复用 / C span id 规则）；HEAD `conversationLens.test.ts` 全绿（靠双写）；无默认 UI 假流 | 否 |
| S3 | Dock → `lease.post(submitInput)` + 占位 → supersede；`PostOutcome` 失败文案；`SyncChrome` → SessionBar / Inbox；读方法转 shim、写方法只经帧源（[§3.7](#37-旧方法调用点与-shim)）；`TestConversationFrameSource` 供语音测 | `conversationLens.test.ts`：发送后占位 → 正式行；stub 永远 `idle`；shim 等价测；T6 语音测改用测试帧源 | 否 |
| S4 | node 侧生产者：gRPC `SessionEventStream` + demux + attribution + Actor + lease over ProxyChannel；ports 实现 | **随 M6-A2**（ADR-003 已 `accepted` @2026-09-02；A2 入口 = S3 + M6-A1 合入）；隔离 profile 冒烟：hello → live、gap → syncing → live、断连 → closed 快照 | 是 |
| S5 | Chat bidi 写路径 + outbox + `heartbeat_ack` reflex + permission / question / clientTool respond | 随 M6-A2 / M6-B；契约测试复用 ADR-012 行为表 | 是 |
| S6 | 轨迹 T4：`GetHistory` + `DetailRef` 全文；`compacted` 投影；visualize 类型化；子代理按 attribution 过滤 | 随 M6-D；依赖 [§6](#6-契约缺口需上游补vscode-不得自造) G2 / G3 | 是 |

**顺序**：S1 → S2 → S3 串行（同改 `conversationLens.ts` / `conversationTimelineTree.ts` / `conversationStubService.ts`，**同一 PR 禁止两人同时改**）。S4 = M6-A2 的时间线部分。与 **M6-A1**（`platform/universeAgent` 传输层，[m6 §8](m6-engine-wave.md#8-切片顺序)）并行时，S1 只新建 `common/sessionView/**`、`node/sessionCore/**`、`conversationViewFrame.ts`，不碰 A1 的连接 / gRPC 文件。

**ReadyToImplement：** S1–S3（已签收）。S4–S6 已并入 m6 切片表（M6-A2 / M6-D；[§9](#9-对-m6--adr-003-的增量修订建议) 已于 2026-09-02 全部并入）。

## 5. 非目标

- 不自研 fold、seq 对账、reseed、outbox（复用 session-core / ADR-009 / 012 / 013）。
- 不把 `ChatResponse` 流当显示源；不用 AHP 顶替 UA 订阅。
- 不在 renderer 暴露 seq / runtimeEpoch / sourceClientId / 拨号地址（INV-SPC-2 / 14）。
- 不裁决宿主进程与 npm 依赖（ADR-003 / M6-A）；不改 token。
- 不改 Inbox MessageQueue / AutoDrive 权威（m6 §3）。
- 不做 T5 虚拟化搜索 / Overview（D10）。
- 不改 `contrib/chat/**`、`vs/sessions/**`、`layout.ts`。

## 6. 契约缺口（需上游补；vscode 不得自造）

| ID | 缺口 | 影响 | 归属 | 本稿姿态 |
|----|------|------|------|----------|
| G1 | `TimelineItemSummary(text)` 无 role；S0 审计**有意** omit author/role | user / assistant 区分 | Desktop session-core（S0 设计修订，非补字段） | attribution sidecar（[§3.2](#32-renderer-契约同-token-增量)），来源 envelope `role`；上游投影后 sidecar 退场 |
| G2 | `visualize` 只是 `tool` 行，`resultPreview` / `argPreview` 有界；已有 `canvasRefs` 但不承载 mermaid 正文 | PRD-014 图示卡 | session-core typed arm 或 `DetailRef` 取全文 | tool 行 + 「打开完整结果」；不截断当图 |
| G3 | `DetailRef` 按需通道未实施（Desktop D14 defer） | 轨迹全文、长工具输出、图示卡 | Desktop + vscode 共同 | 轨迹保持 fixture extras；不把预览当全文 |
| G4 | 普通 timeline 行无 agent 归属（`TimelineItemView.agentId?` 仅 pendingActions 投影；`liveAgentTree` 是另一份树） | PRD-016 子代理对话框过滤 | Desktop session-core 从 envelope `agent_id / agent_path` 投影 | attribution sidecar 的 `agentId / agentPath`；上游投影后退场 |
| G5 | Ask-user `question`、`error`、`unknown` 行无产品需求条 | 行存在但 PRD 未覆盖 | 本仓 requirements | [§7](#7-产品需求待改规则-10a) |

## 7. 产品需求待改（规则 10a）

签收后、S2 / S3 开工前须落（编号 **≥ PRD-021**，017–020 已占用）：

- **PRD-003** 增验收：助手回合可流式增量出现；未完成回合可辨；完成后与历史行一致；无引擎时不出现流式态。
- **PRD-004** 增：Ask-user 问题座位（选项 / 自定义答案）与权限座位分家；处理后按钮消失、记录保留。
- **PRD-007** 增：会话级连接态五值可见（未连接 / 同步中 / 已连接 / 降级 / 已断开）；只有「已连接」可用该措辞；断开后保留快照并明示；与连接级 Engine 状态分开陈述。
- **新 PRD-021（建议）** 未知块 / 错误行诚实呈现：`typeName` + 有界原文，`retryable` 才画重试。

## 8. 验收对照

| 需求 / 合同 | 切片 | 观察 |
|------|------|------|
| PRD-003.2 发送后留在当前会话 | S3 | 占位 → 正式行，同一 session |
| PRD-003.3 助手回复可辨 Stub | S1 / S3 | stub text title 含 Stub；`sync: idle` |
| PRD-004 处理后按钮消失 | S3 / S5 | `pendingActions` 移除 → 座位不可点，行保留 |
| PRD-007 不显示假「已连接」 | S3 | 会话级只有 `live`；连接级按 ADR-003 §7 |
| lens-assembly §3 座位不是 virt 行 | S2 | 座位来源 `pendingActions`，按 id 持有 |
| PRD-013 展开态 | S2 | 帧类 A / B 展开态保留；帧类 C 按 span id 规则 |
| PRD-016 多 tab 同 session | S4 | 多 lease 共享一条订阅 |
| ADR-003 §4 同 token | S1 | 无新 `createDecorator`；注入点不变 |

## 9. 对 m6 / ADR-003 的增量修订建议

**状态：已并入（2026-09-02）。** 两稿已同批 `accepted`，下表各行均已落入 [m6-engine-wave](m6-engine-wave.md)（§3 四行、§8 M6-A2 / M6-D）与 [ADR-003](../decisions/003-engine-adapter-boundary.md)（Decision 1、Consequences）。本表保留为对照记录。下表除标 **替换** 的一行外均为增量；**不推翻 ADR-003 任何编号 Decision**（token / 落层 / AHP 隔离 / `isEngineConnected` / 断连语义均保留）。

**签收顺序（已满足）：** 本稿与 m6 同批改稿签收；M6-A 的 `GetHistory` 句已替换，S4 不再阻塞。

| 目标 | 现文 | 建议 |
|------|------|------|
| m6 §3 时间线行 | 「`GetHistory` + `SessionEventStream`」 | 加：经 session-core fold；renderer 只吃 `ViewFrame`；细则见本稿 |
| m6 §3 发送行 | 「`AgentService.Chat` 双向流」 | 加：三键分立；outbox 沿 ADR-012 |
| m6 §3 权限行 | 「流内权限事件 + `PermissionService.Respond`」 | 加：L4 `permission_request` → `pendingActions`；应答走 Chat 臂或 `Respond`（M6-A 定） |
| m6 §3 变更事件行 | 「投影层继续发这两事件」 | 保留；加 `acquireSessionView` 为细粒度通道 |
| m6 §8 M6-A | 「`GetHistory` 只读投影到 roster」 | **替换**为：history 经 session-core `historyResult` 进 Actor，由 fold 产 baseline；M6-A 不另写 roster 投影（这是改 M6-A「做什么」，不是加注） |
| m6 §8 M6-D | 「Event fold 替换 fixture」 | 指向本稿 S6 + G2 / G3 |
| ADR-003 §1 | `common` 契约 | 加：`common/sessionView/**`（vendored view）与 `conversationViewFrame.ts` 归此层；`node/sessionCore/**` 归 node |
| ADR-003 Consequences | 「`valid-layers-check` 必须拒绝 contrib → `universeAgent/node`」 | **更正**：`valid-layers-check` 不查 path；改为「ESLint `code-layering`（对 `platform/universeAgent/**` 提 error）+ platform 级 boundary 测」 |

## 10. 风险

| 风险 | 缓解 |
|------|------|
| session-core 版本漂移 | `SYNC.md` 记来源 SHA；CI 比对 hash |
| 实施者手改 vendored 代码 | 脚本写生成 header 标记；lint 拒非同步改动 |
| renderer 偷看 Actor | Actor 在 `node/`；`code-layering`（error）+ platform 级 boundary 测（S1）；`valid-layers-check` 不承担此职 |
| vendored 树触发 `header/header` / `code-layering` | `.eslint-ignore` 两棵树（先例 lit-html）；边界由消费方规则把关 |
| `view/index.ts` 反向 import 把 Actor 拖回 common | 不 vendor 该 barrel；自写 barrel 只 re-export 本目录；同步脚本 CI 断言 `common/sessionView/**` 无 `../` import |
| S2 透镜切 lease 但写方法未产帧 → HEAD 测试红 | S2 双写合同（§3.7 同步点）；S2 退出条件含 `conversationLens.test.ts` 全绿 |
| 帧类 C 被当成 rerender 假绿 | S2 三类帧矩阵分别断言 |
| 用 title 猜 role | attribution 缺失 → 中性行 + 诊断；测试用无 attribution 行断言 |
| 三键合一 | S3 单测断言 `message_id` ≠ `operation_id`；裁剪按 `originLeaseId` |
| 旧方法 shim 语义漂移 | S1 等价测：fixture → entries → legacy turns 与 HEAD `getTurns` 逐项相等 |
| `accepted` 当已送达 | Dock 文案区分「已受理」与 L2 落盘 |
| ADR-003 / m6 签收晚于本稿 | S1–S3 不依赖；S4–S6 明确随 M6-A/D |

## 11. 知识层待同步（签收后）

- [conversation-lens-assembly.md](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) §6 阶段 3a 正文改写（目前只有 draft 脚注）。
- `docs/systems/conversation/`（另一 agent 在建）：`lens-and-trajectory.md` 时间线数据流、`stub-and-fixtures.md` 帧源与 shim。
- [docs/modules/platform/overview.md](../../docs/modules/platform/overview.md)：`platform/universeAgent` 条目（与 M6-A 同期）。
- [glossary.md](../../docs/glossary.md)：**帧源**、**lease**、**SyncChrome**、**attribution sidecar**。

## 12. 审查记录

**2026-09-02 第一轮：** Cursor CLI `cursor-grok-4.6-high`（`--mode ask` 只读）。**Reject**。处理如下：

| 级别 | 意见 | 本稿处理 |
|------|------|----------|
| Critical | 推翻未 supersede 的 ADR-003 / m6 同 token 边界；把落层挂到已废 ADR-004 | 改为 m6 / ADR-003 **时间线专章**；同 token 增量加 `acquireSessionView`；删除全部 ADR-004 引用；宿主进程不裁决、去掉 UtilityProcess 默认；增 §9 增量修订表 |
| Critical | G1「中性正文」与「HEAD `data-kind=user` 测试仍绿」互斥 | 裁定 attribution sidecar（来源 envelope role / fixture kind，非 title 猜测）；§3.2 / §3.3 / §3.6 改写 |
| Critical | 「新 PRD-017」撞号（017 = 本地会话持久化） | 改 ≥ PRD-021 |
| Important | 漏 L4 层 | 显示写源改 L1–L4；§2 补 L4 三臂 |
| Important | `operationId = message_id` 曲解 ADR-012 | §3.5 三键分立表 |
| Important | G4 类型陈述不准；G1 是 S0 设计变更 | §6 改写 |
| Important | roster 收缩低估调用面；`onDidChangeSessions` 不存在 | 不收缩；事件名改回 `onDidChangeSession`；调用点表第一版仍有错（第二轮 I2 指出，已按 `rg` 重写） |
| Important | 整包 vendoring 进 `common`、套 Microsoft 头、边界只扫 contrib | `view` → common / Actor → node；保留上游头 + SYNC.md；边界第一版误挂 `valid-layers-check`（第二轮 I1 更正为 `code-layering` + platform 级 boundary 测） |
| Important | `applyEntries` 过程折 / overlay 换 id 不是 rerender | §3.4 三类帧分治 + 分别验收 |
| Important | 与 lens-assembly / customizations-engine / R5 关系未收口 | §1 连接真相两层；§11；plans/INDEX 重登记 |
| Minor | 方法计数、行号、proto 行、L3 枚举、`generic`、`canvasRefs` | 全部改入 §2 / §3.3 / G2 |

**2026-09-02 第二轮：** 同一 CLI / 模型，只读。**Approve with changes**。Round-1 闭合核验：C1–C3、I1–I3、I6、I7 closed；I4、I5 partially（本轮 I1 / I2 续改）。处理如下：

| 级别 | 意见 | 本稿处理 |
|------|------|----------|
| Critical | `view/index.ts:64` 反向 re-export `../pending-actions-bound`，verbatim 同步会把 Actor 拖回 `common` | 不 vendor 该 barrel；vscode 自写 barrel 只 re-export 本目录；§2 锚点改写；§3.1 / §4 S1 / §10 风险改入；CI 断言 `common/sessionView/**` 无 `../` import |
| Important | 边界机械保证误挂 `valid-layers-check`（API/lib 检查，非 path；D8 红） | 改为 ESLint `code-layering`（对 `platform/universeAgent/**` 提 error）+ S1 platform 级 boundary 测（扫 `workbench/**` 与 `sessions/**`）；§1 / §3.1 / §4 / §9 / §10 同步；`valid-layers-check` 明确不作门 |
| Important | §3.7 调用点与 `rg` 不符；漏 `deleteTurn` / `updateUserTurnText`；StatusBar 不读 `isEngineConnected` | 按 `rg` 逐方法重写表并入 §2 锚点；补两方法（S2 双写 / S3 stub 专用编辑）；StatusBar 改「HEAD 未订，切片 5 才接」 |
| Important | S2「透镜切 `onDidApplyFrame`」与 S3「才 shim」互相卡住 | §3.7 写死同步点：S2 写方法**双写**（旧 model + 帧源），透镜只读 lease；S3 读方法转 shim |
| Important | 未承认 sidecar join 是第二次投影；overlay 默认 `assistant` 是猜 | §3.3 增「vscode 产品投影」命名段；overlay role 由 demux 按 L3 事件归属写入 attribution（协议事实：L3 只由 agent 产生），缺失则中性 |
| Important | §9 M6-A `GetHistory` 行是替换非增量 | 改标 **替换**；增签收顺序：与 m6 同批，或 S4 阻塞于该句已改 |
| Important | 帧 A 可假绿；`header/header` error 与「不加 Microsoft 头」冲突 | 帧 A 加 `setChildren`=0 负向断言；两棵 vendored 树入 `.eslint-ignore`（先例 lit-html） |
| Minor | ADR-012 §6.2 三元组；Inbox 不订 `onDidChangeSession`；`ChatRequest.payload` 完整臂；审查记录措辞 | 全部改入 §3.5 / §3.7 / §3.2 注释 / 本表 |

**签收：** 2026-09-02，用户授权「用 Cursor CLI 审查、架构由本会话裁定、改完没问题就签收」。两轮意见全部核验属实并改入；`status: accepted`。S1–S3 ReadyToImplement（须先按 §7 改 PRD）；S4–S6 随 m6 / ADR-003。
