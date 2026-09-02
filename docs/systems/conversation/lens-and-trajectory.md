---
title: "Conversation 透镜、时间线与轨迹"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-02
summary: "ConversationEditorPane 页 chrome；「对话 | 轨迹」双透镜；帧源 projectSnapshotToTrajectory + T5 搜索/虚拟化；子代理 filterAgentId；DetailRef 六态经 P2a requestDetail；轨迹含 permission/question/error/unknown；Q3 compacted 只消费 P2b attribution；Overview 仍 Deferred；PRD-003 / 012 / 013 / 014 / 020 / 021"
---

# Conversation 透镜、时间线与轨迹

> 导航：[系统索引](INDEX.md)。需求：[PRD-003](../../product/requirements.md#prd-003-时间线与输入) · [PRD-012](../../product/requirements.md#prd-012-conversation-轨迹透镜) · [PRD-013](../../product/requirements.md#prd-013-conversation-过程折) · [PRD-014](../../product/requirements.md#prd-014-conversation-图示卡visualize)。donor 对照与「为什么不用 ChatWidget」见 [conversation-lens-assembly](../../reference/code-oss-b2/conversation-lens-assembly.md)。

## 1. 页 chrome 在哪

每张 chat tab / 子代理对话框的内容由 `ConversationEditorPane`（`workbench.editor.conversationChat`）渲染。它把 `IConversationLensSlots`（`sessionBar` / `timeline` / `dock` 三个 DOM 槽）交给 `ConversationLens` 填。**注意两层 SessionBar**：Part 级的窗口 chrome（SelectBox、←→、关非根、Route）在 `ConversationPart.sessionBar`；页级的「对话 | 轨迹」透镜切换与面包屑在 pane 内。会话切换不随 tab 复制。

`ConversationLens` 把当前透镜 id（`'conversation' | 'trajectory'`）存到 `StorageScope.WORKSPACE`（`CONVERSATION_LENS_ID_STORAGE_KEY`），是本系统今天**唯一**持久化的用户状态。

## 2. 对话透镜：时间线

| 零件 | 文件 | 说明 |
|------|------|------|
| `ConversationTimelineTree` | `conversationTimelineTree.ts` | `WorkbenchObjectTree<ConversationTimelineItem>` 绿field 列表；行 = turn 或 process-fold 节点 |
| 自动滚底 | `conversationTimelineScroll.ts` | `ConversationAutoScrollHolds`：用户上滚时 hold，新回合到达不抢滚 |
| 内容渲染 | `conversationTurnContentAdapter.ts` · `conversationTurnMarkdown.ts` | **唯一**允许触碰 `contrib/chat/browser/widget/chatContentParts/**` 的入口；只借 markdown / code block 渲染函数，不造 `IChatRequestViewModel` 影子模型 |
| 用户卡 | `conversationUserBubbleCollapse.ts` | 用户回合展示为纯文本卡；点卡进入编辑（PRD-015 验收 6） |
| 置顶提示 | `conversationPinnedUserPrompt.ts` | 滚动时把当前可见段落对应的用户提问钉在列顶（对齐 Singularity `PinnedUserPromptState`） |
| 权限座位 | `conversationConfirmationSeat.ts` | Allow / Skip；处理后按钮消失、记录留在列表（PRD-004）；不是可回收 virt 行 |
| 提问座位 | `conversationQuestionSeat.ts` | 独立 ask-user 座位（选项 / Submit）；**禁止复用 Allow/Skip**（PRD-004.4）；不标 Stub |
| 图示卡 | `conversationVisualizeCard.ts` | §5 |

对话透镜**不含**：context 注入卡、环境 / SYSTEM 全文、工具 schema 目录；用户回合只显示正文（PRD-012 验收 2）。这些都在轨迹页。

## 3. 轨迹透镜

> 帧源与 shim 合同：[conversation-stream-timeline §3.3 / S6](../../../dev/plans/conversation-stream-timeline.md)（`accepted`）。切片对照：[conversation-trajectory-lens §4 T4/T5](../../../dev/plans/conversation-trajectory-lens.md)。

### 3.1 数据路径（HEAD）

| 层 | 文件 | 行为 |
|----|------|------|
| 契约 | `conversationStubService.ts` | `getTrajectoryRecords(sessionId, options?: { filterAgentId? })` |
| 帧源投影 | `conversationTrajectoryModel.ts` | `projectSnapshotToTrajectory(snapshot, attribution, details, options)` — **T4 / stream-timeline S6 子集** |
| 旧回合投影 | 同上 | `projectTurnsToTrajectory(turns)` — UA 断连或无 cached projection 时的回退 |
| Stub 服务 | `ConversationStubService` | `frameSource.project` → `projectSnapshotToTrajectory`；仅 `shouldMergeTrajectoryFixtureExtras`（`untitled` 且未连接）时 `mergeTrajectoryFixtureExtras` |
| 引擎 roster | `ConversationEngineRosterService` | 已连接 UA 会话：cached snapshot → `projectSnapshotToTrajectory`（**永不** merge stub fixture）；否则 `projectTurnsToTrajectory(getTurns())` |
| 透镜 | `conversationLens.ts` | 读 roster；子代理 overlay 经 `IConversationLensSlots.filterAgentId` 传入 `trajectoryProjectionOptions()` |

`ConversationTrajectoryKind = system | user | context | compacted | message | tool | subtool | thinking | permission | question | error | unknown`。`projectSnapshotToTrajectory` 把 session-core `TimelineItemView` + **attribution sidecar**（role / agentId / toolCallId / parentToolCallId / `branchReason` / `compacted`）映射为轨迹行：`text+role=system` → `system`，`reasoning` → `thinking`，`tool` → `tool`（经 `finalizeToolTree` 可升为缩进 `subtool`），`permission` / `question` / `error` / `unknown` 各为独立 kind（请求/答案摘要、`retryable`、`typeName`+`rawContent`）；`generic` 不进轨迹。**confirmation 与 visualization** 仍不从 stub turns 投影（对话页专属座位 / 图示卡）；引擎 snapshot 的 `permission` / `question` **进轨迹**，但不进过程折、也不自动切页（PRD-012）。

**DetailRef（Q2 接通）：** 局部 inspector 六态 — `preview` / `loading`（本地 in-flight；lease 无 `requestDetail` 永不 loading）/ `full` / `partial`（`truncated=true` + 字节数）/ `unavailable` / `failed`+Retry。成功先 `upsertDetail(ref, content)` 再 settle；UI 读 `details` + outcome。stub 帧源本地 `requestDetail`；引擎 lease 代理 `IUniverseAgentSessionView.requestDetail`。搜索 haystack 仍用有界 preview。

**`compacted`（Q3）：** `projectSnapshotToTrajectory` 只消费 P2b `ItemAttribution.branchReason==='compact'` 和/或 `compacted{anchorTurnId,foldedLeafTurnId,compactBranchTurnId,summary?}` 才 emit 独立记录；无 attribution 则**零行**，不解析 envelope / 不订阅 `ContextCompactedEvent`、不伪造 stub 行。范围 / 原因 / summary 来自 attribution；无 summary 只显示类型与范围。token 前后数仅当 span 上已有富化数字才显示。始终折外，不伪装成 SYSTEM / assistant。点击局部 inspector 看三 turn id，并声明已丢弃全文不可恢复。

**仍 Deferred / 预留（勿写进「已接通引擎全文」）：**

| 项 | HEAD 姿态 |
|----|-----------|
| Overview 瀑布时间条 | harness 有、本仓未做（T5 子集之外，仍随 M6-D） |
| 活 Event fold 替换 fixture | 完整 T4 仍 blocked on [PRD-008](../../product/requirements.md#prd-008-引擎与会话权威)（M6-D）；HEAD 仅为帧源上的纯函数投影 + stub fixture |

Stub fixture：`mergeTrajectoryFixtureExtras` 仅 seed `untitled`、且 `!isEngineConnected()` 时插入带 `Stub` 的 system / context / sourceBlocks / subtool（`CONVERSATION_TRAJECTORY_STUB_*`）。**不**插入 compacted（browser stub 从不产出 `ItemAttribution.compacted`）。`createSession()` 等无 extras → 空态。

**子代理过滤（PRD-016）：** `filterAgentId` 保留无归属的 `user` 行 + attribution 中 `agentId` 匹配项；根 tab 不传 filter。`conversationSubAgentOverlay.ts` 把对话框 `chatId` 注入 `ConversationLens`。

**双向 reveal（T5a @ `f66c36c9`）：** `findTurnIdForTrajectoryRecord` / `findTrajectoryRecordIdForTurn`；纯 fixture 行返回 `undefined`。

### 3.2 视图与 T5（搜索 / 虚拟化 / 上限）

| 组件 | 文件 | 职责 |
|------|------|------|
| 轨迹表 + 检查器 | `conversationTrajectory.ts` | 工具栏搜索、`WorkbenchList` 虚拟化表、过程折 overlay（默认展开）、局部检查器 |
| MessageNavigator | `conversationTrajectoryList.ts` | SessionBar History 的回合索引列表（**不是**轨迹透镜主表） |

- **搜索（T5）：** 工具栏 `input[type=search]`，debounce；`filterTrajectoryRecordsBySearch` 匹配 kind / text / blocks / 检查器字段。
- **虚拟化（T5）：** `buildTrajectoryTableDisplayItems` 产出 record / fold 行 → `WorkbenchList<TrajectoryTableDisplayItem>`。
- **规模上限（PRD-020）：** `CONVERSATION_TRAJECTORY_RECORD_LIMIT = 5000`；超出保留最近段并显示诚实 `limitNotice`（`applyTrajectoryRecordLimit`）。
- **Overview 瀑布条：** 仍 **Deferred**（[conversation-trajectory-lens §3.5](../../../dev/plans/conversation-trajectory-lens.md)）。

选中一行打开**局部检查器**（pane 内，不占 Bottom Panel）。`subtool` 相对父 `tool` 再缩进。pending 权限或新 Diff **不**自动切到轨迹（验收 6）。任意零记录会话 → 诚实空态（验收 7）。

## 4. 过程折（overlay，不是列表身份）

模型：`conversationProcessFoldModel.ts`。

- 对话页：`projectProcessFoldSpans(turns)` — 连续 thinking / tool 成一个 span；user、assistant、confirmation、question、error、unknown、system 打断。`nestThinkingTools` 把工具行缩进到最近的 thinking 下。
- 轨迹页：`projectTrajectoryProcessFoldSpans(records)` — thinking / tool / subtool 成 span；user、context、system、message、compacted、permission、question、error、unknown 打断，**始终在折外**。
- 外层摘要 `summarizeProcessSteps` / `summarizeTrajectoryProcessSteps` 必含 `Stub`（PRD-013 验收 4），无假耗时。
- 默认态：对话页收起，轨迹页展开（验收 2）。视图 `conversationProcessFold.ts`；两页共用 overlay 辅助函数，宿主 DOM 各自一套。
- 折壳不是 Copilot Chat 列表行，也不是 `groupIdentity`；分组按 Desktop ADR-046「平行 span overlay」。

## 5. 图示卡（visualize）

- 协议类型在 `common/conversationVisualize.ts`：`type: 'diagram'`（`mermaid` 必填）或 `'comparison'`（`options[]`：name / pros / cons / recommended / 可选 mermaid）。`parseVisualizeArgs` 失败时给 `fallbackMarkdown`（错误说明 + 原始 fence）。
- 渲染：`conversationVisualizeCard.ts` 在时间线以卡片呈现，无 You / Agent 气泡头；`conversationVisualizeOverlay.ts` 全屏 overlay（Close + Reset，Esc 关闭），**不是** mermaid preview editor tab。
- mermaid 宿主 `conversationMermaidHost.ts`：依赖内置扩展 `vscode.mermaid-markdown-features` 的 `chat-webview-out` 资源起 webview；扩展缺失时 `fallback: true`，退回 `<pre>` 源码 fence + Stub 文案（PRD-014 验收 4）。
- 引擎 admitted `visualize` **只**映射为 `visualization` kind（`visualizeArgsFromMermaidTool` 是未来 adapter 入口），不进 tool / reasoning span，轨迹不投影。

## 6. 与需求验收的对应

| PRD | 验收 | 落点 |
|-----|------|------|
| 003 | 1–3 | §2 时间线树；发送链见 [composer-and-inbox](composer-and-inbox.md)；stub 回复 `stubEcho` 标记 |
| 012 | 1 双页不可关、默认对话 | §1 `ConversationLens` 透镜切换 + 持久化 |
| 012 | 2 对话页不含注入 / SYSTEM | §2 末段 |
| 012 | 3 轨迹至少一条 context / 带 block 的 user / SYSTEM；局部检查器 | §3.1 fixture extras + §3.2 检查器 |
| 012 | 4–5 过程折默认展开、subtool 缩进 | §4 / §3 |
| 012 | 6–8 不自动切轨迹、诚实空、非 Copilot | §3.2 |
| 020 | 2 轨迹搜索与虚拟化 | §3.2（Overview 仍 Deferred） |
| 013 | 1–5 | §4 |
| 014 | 1–5 | §5 |

## 7. 测试

`conversationLens.test.ts`、`conversationLensRevealNavigation.test.ts`、`conversationTimelineScroll.test.ts`、`conversationTurnMarkdown.test.ts`、`conversationUserBubbleCollapse.test.ts`、`conversationPinnedUserPrompt.test.ts`、`conversationTrajectory*.test.ts`（含 `ImportBoundaries`）、`conversationProcessFold*.test.ts`、`conversationVisualize*.test.ts`。import 红线由 `conversationImportBoundaries.test.ts` 机械 enforce（[ADR-006](../../../dev/decisions/006-shell-invariants.md) INV-NO-COPILOT）。
