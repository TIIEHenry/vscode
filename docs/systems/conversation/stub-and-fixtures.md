---
title: "Conversation 会话数据契约：IConversationRosterService、stub 与夹具"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-02
summary: "IConversationRosterService 契约分组；getTrajectoryRecords + filterAgentId；帧源 projectSnapshotToTrajectory；D13 持久化；A1/A2 连接态、Hub 路径与 ConnectionPhase、adapter 替换约束"
---

# Conversation 会话数据契约

> 导航：[系统索引](INDEX.md)。代码：`contrib/conversation/browser/conversationStubService.ts`（接口 + `ConversationStubService`）· `conversationStubModel.ts`（类型 + fixture 会话）。R5 研究项见 [research-queue](../../../dev/progress/research-queue.md)。

## 1. 身份

- decorator：`IConversationRosterService`，id 字符串仍是 `'conversationStubService'`；`IConversationStubService` 是同一 token 的别名（历史命名）。
- 注册：`registerSingleton(IConversationRosterService, ConversationStubService, InstantiationType.Delayed)`（`conversation.contribution.ts`）。
- 除定义文件外全仓 17 个生产 / 测试文件依赖此 token：SessionBar、Navigator roster、session 窗口服务、透镜、轨迹、Inbox、StatusBar、chat routing 测试等。

## 2. 契约分组

**产品契约**（引擎 adapter 必须实现、语义不变）：

| 组 | 成员 |
|----|------|
| 事件 | `onDidChangeActiveSession(sessionId)` · `onDidChangeSession(sessionId)` · `onDidChangeEngineConnection(boolean)` |
| 会话 | `getSessions()` · `getActiveSessionId()` · `getActiveSession()` · `switchSession` · `createSession` · `renameSession` · `deleteSession` |
| 回合 | `getTurns(sessionId)` · `appendUserTurn` · `updateUserTurnText` · `deleteTurn` |
| 轨迹 | `getTrajectoryRecords(sessionId, options?: { filterAgentId? })` — 经 `ConversationStubFrameSource.project` → `projectSnapshotToTrajectory`（[stream-timeline S1/S6](../../../dev/plans/conversation-stream-timeline.md)）；见 [lens-and-trajectory §3.1](lens-and-trajectory.md) |
| 权限 | `resolveConfirmation(sessionId, turnId, 'allowed' \| 'skipped')` · `countPendingConfirmations` |
| MessageQueue | `getMessageQueueState` · `pauseMessageQueue` · `resumeMessageQueue` · `clearMessageQueue` · `holdMessageQueueItem` · `releaseMessageQueueItemHold` · `updateMessageQueueItemContent` |
| AutoDrive | `getAutoDriveTasks` · `getAutoDriveTaskCount` |
| 连接态 | `isEngineConnected()` |

**测试 / stub 夹具**（只在无引擎或单测中有意义，**不应**出现在引擎 adapter 的公共面）：

| 成员 | 用途 |
|------|------|
| `appendStubEchoAssistant` | 本地 echo 回复，`stubEcho: true` |
| `appendConfirmationTurn` / `appendThinkingTurn` / `appendToolTurn` | 单测与 fixture 造回合；引擎接通后这些是**引擎推送**，不是 UI 主动追加 |
| `setMessageQueueFixture` · `setAutoDriveTaskFixture` | 注入队列 / 任务假状态 |
| `setEngineConnected(boolean)` | 人为翻连接态 |

## 3. 类型（`conversationStubModel.ts`）

- `ConversationStubSession { id, title, turns[] }`。
- `ConversationStubTurn { id, kind, text, status?, stubEcho?, toolName?, summary?, payload?, visualize? }`；`kind ∈ user | assistant | confirmation | thinking | tool | visualization`；`status ∈ pending | allowed | skipped`（仅 confirmation）。
- fixture 会话由 `createUntitledFixtureTurns()` 等生成，含 thinking / tool / confirmation / visualization 回合，所有 stub 文案带 `Stub`；这是 PRD-012 / 013 / 014 验收里「种子会话」的来源。
- 轨迹记录类型与投影规则见 [lens-and-trajectory §3](lens-and-trajectory.md)。HEAD：`getTurns` / `getTrajectoryRecords` 均从同一帧源 snapshot 派生（`entriesToLegacyTurns` / `projectSnapshotToTrajectory`）；UA 引擎会话不 merge stub trajectory fixture。

## 4. 持久化事实

- **D13 @ HEAD：** `ConversationStubService` / `ConversationEngineRosterService` 将会话目录、当前会话、回合与权限记录写入 `conversation.roster.v1`（`StorageScope.WORKSPACE` + `StorageTarget.MACHINE`，`conversationRosterStorage.ts`）；`source ∈ local | engine-cache`；引擎接通后不迁移 UA 权威，本地只缓存 stub 会话与断连只读快照。
- 透镜 id 仍单独持久化（`ConversationLens`，同上 scope/target）。
- Part 显隐与 End 列尺寸由 Layout 持久化（`workbench.conversation.hidden` 等，[layout-state](../workbench/layout-state.md)），与本服务无关。
- 跨重启验收见 [PRD-017](../../product/requirements.md#prd-017-本地会话持久化) 与 `conversationStubService.test.ts` / `conversationEngineRosterService.test.ts`。

## 5. 引擎替换约束（对照 [ADR-003](../../../dev/decisions/003-engine-adapter-boundary.md) / [m6-engine-wave](../../../dev/plans/m6-engine-wave.md)，均 `accepted` @2026-09-02）

1. **同 token 替换**是既定路线（ADR-003 决策 4：公开类型与 decorator id `'conversationStubService'` 都不改，引擎实现替换 `registerSingleton` 的类）：UI 零改动。
2. **夹具方法的去向**（按 ADR-003 决策 4 / m6-engine-wave M6-A2）：接口**保留不拆**（规则 16 审查与签收均未要求另拆 fixture 接口；此问题已闭）；引擎实现对 §2 夹具组的语义是——已连接时 `appendStubEchoAssistant` 在 service 层拒写（reject / throw 或 no-op + 断言），`set*Fixture` / `setEngineConnected` 不得影响 UA session。stub 本身在 [conversation-stream-timeline](../../../dev/plans/conversation-stream-timeline.md) S1–S3 改为同契约的**帧源**，旧读方法在 S3 变为 shim。
3. **事件语义**：`onDidChangeSession` 今天是「某会话内容变了」的粗粒度信号；引擎流式回合到达时要么沿用（UI 全量重投影），要么在方案里定义细粒度事件并同步改 `ConversationTimelineTree` 的 diff 策略。
4. **权限**：`resolveConfirmation` 只改本地状态；adapter 必须把它变成向引擎发送授权 / 拒绝，并在回执前保持 pending 可见（PRD-004 验收 3 反向：不得在无回执时宣称已授权）。
5. **连接态与 Hub 路径**：生产 `isEngineConnected()` = `IUniverseAgentConnection.isEngineConnected()` = 非空 `session_token` + 活 channel（**pairing-pending → false**；Hub 登录 / ticket 签发成功 **均不算** connected，上游 I1）。`getConnectionPhase()` 返回 `ConnectionPhase`（[connection-hub-client §3.3](../../../dev/plans/connection-hub-client.md#33-领域模型ts-契约)）：

   | `ConnectionPhase` | `isEngineConnected` | StatusBar（H4b） | 路径标签 |
   |-------------------|---------------------|------------------|----------|
   | `disconnected` | false | Engine not connected | — |
   | `connecting{initial\|transport_lost}` | false | Connecting… / Reconnecting… | — |
   | `connected{path}` | true | Engine · Hub relay / Engine · Direct / loopback | `hubRelay` = 经 Hub ticket 中继；`direct` = DirectAddress 或 loopback；**H6 GUA 直连 v2 未做** |
   | `failed{code}` | false | 码对应短句 | — |
   | `closed` | false | Engine not connected | — |
   | `pairing` sidecar（非 phase） | false | Engine not connected | SAS 对话框；不写 trust 直至用户确认 |

   Hub 账号态（`signedOut` / `signedIn` / `mustChangePassword` / `hub_auth_expired`）与上表 **正交**（[connection-hub-client §3.7](../../../dev/plans/connection-hub-client.md#37-两个正交状态与-presence-矩阵)）。**切片 5 / B10：** connected → command `workbench.action.openEnginePreferences`；否则 → `workbench.action.openConnectionPreferences`。能力三态在 `getCapabilitySnapshot()`；传输失败在 `getTransportState()`，**不得** `catch → emptyList()` 冒充引擎返回 0 条。

   **Hub secret 落盘与加密可用性**（[hub-control-plane-surface §3.1](../../reference/universe-agent/hub-control-plane-surface.md#31-hub-会话与客户端身份落盘3536--321a4e0b) @ `321a4e0b`）与 `ConnectionPhase` **再正交一层**：

   | 条件 | Hub 账号 UI | `isEngineConnected` | 配对 / 连接 |
   |------|-------------|---------------------|-------------|
   | 加密可用 + 已登录 | 正常 `signedIn` | 仍仅看 Engine 握手 | 正常 |
   | 加密可用 + 未登录 | 登录表单 | false | 须先 Hub 登录 |
   | **加密不可用** | 表单 + 诚实提示「重启后须重登」 | false | **无客户端身份**（`ClientIdentityStore` → `encryption_unavailable`）；refresh **仅内存**，重启丢失 |
   | Hub signedIn 但 Engine 未 Connect | 顶部已登录 | **false** | ticket / 目录可用；**不等于** connected |

   **未落地：** 进程启动时 `refreshIfNeeded` 从磁盘恢复 Hub 会话（槽 A）——文档与产品口径在落地前仍按「重启须重登（access 15 min TTL）」描述跨重启 Hub 态。
6. **诚实降级**：断连时 UI 必须回到诚实空，不显示上次 RPC 缓存并写「已同步」（PRD-007；customizations-engine E1 验收 5 同理）。
7. **不得**用 `IChatModel`、AHP（`IAgentHostService` / `IAgentConnection`）、`copilotChatSessions` 实现本契约（[ADR-006](../../../dev/decisions/006-shell-invariants.md) INV-NO-COPILOT；[agent-host overview](../agent-host/overview.md)）。

## 6. 测试

`conversationStubService.test.ts`（会话 CRUD、队列 hold / release、连接态事件）；其余各页测试通过 `ConversationStubService` 实例作为数据源。
