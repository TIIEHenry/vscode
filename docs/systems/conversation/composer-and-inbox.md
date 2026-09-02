---
title: "Conversation Composer、身份条与 Inbox"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-015 系统规格：PreFirst 居中 / Active 列底同一张 Composer；三种 composerPolicy；身份条 XOR；Inbox 左右分簇与 MessageQueue 状态机；语音转写条；输入历史；StatusBar 芯片与诚实降级"
---

# Conversation Composer、身份条与 Inbox

> 导航：[系统索引](INDEX.md)。需求：[PRD-015](../../product/requirements.md#prd-015-conversation-空会话与输入面) · [PRD-004](../../product/requirements.md#prd-004-权限座位) · [PRD-007](../../product/requirements.md#prd-007-诚实降级)。方案：[conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)（T1–T6 `implemented`）。MessageQueue 列表 / 行交互 SSOT 为 Singularity `message-queue-bar.md`，本页只写本仓落点。

## 1. 两个阶段，一张 Composer

| | PreFirst（会话无可见消息） | Active（已有消息） |
|---|---|---|
| Composer 位置 | 阅读列居中 | 列底 Dock（32 px 底栏） |
| 身份条（引擎 · 文件夹 · 分支） | Composer 上方 | 阅读列顶（`ConversationIdentityStrip`），**不**进 SessionBar / 工具栏 |
| Agent 选择 | 在 Composer 行 | 消失，不进 SessionBar |
| Route | 在 Composer 行 | 移到 Part 级 SessionBar |
| Model / Permission / Tools | Composer 行 | 仍在 Composer 行 |
| Inbox / Goal / Stop | 无 | Composer 上方 Inbox overlay |

底栏控件：`+` 浅底圆、语音无底、发送实心圆，其余无背景；Enter 发送、Shift+Enter 换行。同一时刻只有一个输入（PRD-015 验收 1–4、7）。

身份条数据：`getConversationIdentityFolder`（首个工作区文件夹）、`getConversationIdentityBranchName`（`ISCMService` HEAD ref）；无文件夹 / 无仓库时对应 chip 省略。引擎 chip 文案 = `getConnectionPhaseStatusBarText(getConnectionPhase(), pairingPending)`（与 StatusBar `status.conversation.engine` 同函数）；点击路由 = B10（`isEngineConnected()` → `workbench.action.openEnginePreferences`，否则 `workbench.action.openConnectionPreferences`）；订阅 `IUniverseAgentConnection.onDidChangeConnection` 与 `IConversationRosterService.onDidChangeEngineConnection`。

## 2. `composerPolicy`：同一张 Composer 的三种用途

`ConversationLens` 的私有字段 `composerPolicy ∈ 'compose' | 'turnEdit' | 'queueEdit'`（非导出 API，此处只描述状态机）：

- `compose`：正常输入；Send → `IConversationRosterService.appendUserTurn`，无引擎时可追加 `appendStubEchoAssistant`（`stubEcho: true`，UI 标 Stub）。
- `turnEdit`：点击时间线用户卡进入；保存走 `updateUserTurnText`；Escape / Exit 回 `compose`。
- `queueEdit`：编辑 MessageQueue 项；进入时 `holdMessageQueueItem(..., 'EDITING')`，退出时 `releaseMessageQueueItemHold`；保存走 `updateMessageQueueItemContent`。

列表内编辑与队列编辑**复用同一 Composer**（PRD-015 验收 6）；展示态用户卡没有按钮。

## 3. Inbox overlay（Active 态）

`ConversationInboxOverlay`（`conversationInboxOverlay.ts`）挂在 Composer 上方：

```text
[ Task ▾ ] [ MessageQueue ▾ ] [ Goal ]            [ Stop ] [ ctx ○ ]
  左簇：Task 在 MessageQueue 左侧；两列表 XOR 展开      右簇
```

- 无权威时整槽省略或诚实空（「No queue」），不造假任务（PRD-007 / PRD-015 验收 5）。
- Task 列表数据 = `getAutoDriveTasks` / `getAutoDriveTaskCount`（stub 期由 `setAutoDriveTaskFixture` 注入）。
- Stop 与上下文环在引擎接通前无权威，按诚实降级处理。

## 4. MessageQueue 状态机

`conversationMessageQueueModel.ts`（对齐 Singularity message-queue-bar §3.2）：

- 项状态 `UPLOADING | UPLOAD_FAILED | PENDING | SENDING | FAILED`；hold 原因 `EDITING`。
- 队列级操作：`pauseMessageQueue` / `resumeMessageQueue` / `clearMessageQueue`；项级 `holdMessageQueueItem` / `releaseMessageQueueItemHold` / `updateMessageQueueItemContent`。
- `conversationMessageQueuePendingCount` 供 Inbox 徽标。
- stub 期状态由 `setMessageQueueFixture` 注入；真正的入队 / 出队由引擎驱动（PRD-008）。

## 5. 语音转写条

`conversationVoiceTranscriptBar.ts` / `conversationVoiceTranscriptModel.ts`：Composer 上方的 **stub 转写队列**，语音钮在发送左侧。它**不是** MessageQueue（PRD-015 验收 7），今天无真实 speech 服务接入。

## 6. 输入历史

`conversationInputHistory.ts`：Composer 内 ↑ / ↓ 浏览历史输入（仅 `compose` 且光标在首 / 末行时），Escape 退出浏览。按会话隔离。

## 7. StatusBar 芯片（`conversationSessionStatusBar.ts` / `conversationSessionStatus.ts`）

| id | 文案 | 规则 |
|----|------|------|
| `status.conversation.session` | 当前会话标题；无标题 **No session** | 点击 → `workbench.action.showConversationPart` |
| `status.conversation.engine` | `getConnectionPhaseStatusBarText`（H4b）：disconnected / connecting / connected / failed 各态；pairing-pending → **Engine not connected** | B10：`isEngineConnected()` → `workbench.action.openEnginePreferences`，否则 → `workbench.action.openConnectionPreferences`；身份条引擎 chip 同路由 |
| `status.conversation.model` | **No model** | **仅当** `CONVERSATION_PART` 隐藏时注册（UI-INV-14：座位可见时 Dock 是 model owner） |

无 Copilot、无额度、无 Sign In；无 session-usage / turns / tok/s 芯片（无权威则省略槽位）。

## 8. 与 PRD-015 验收的对应

| 验收 | 落点 |
|------|------|
| 1 空会话无 Inbox；输入不永钉列底 | §1 |
| 2 Init / During 同一张 Composer；底栏样式 | §1 / `media/conversationLens.css` |
| 3 Agent / Route XOR | §1 |
| 4 Model / Permission / Tools 留在输入行 | §1 |
| 5 Inbox 分簇、Task 左于 MQ、XOR、诚实空 | §3 |
| 6 列表编辑与队列编辑复用 Composer | §2 |
| 7 语音钮位置；转写队列 ≠ MQ | §5 |
| 8 不是 `ChatInputPart` picker、不是 Material 配置卡 | INV-NO-COPILOT；Dock 为自研 textarea |

## 9. 测试

`conversationLens.test.ts`（T1–T6）、`conversationIdentityStrip.test.ts`、`conversationInputHistory.test.ts`、`conversationSessionStatus.test.ts`、`conversationSessionStatusBar.test.ts`、`conversationStubService.test.ts`（队列 / hold）。
