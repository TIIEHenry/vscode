---
title: "Conversation 轨迹透镜：DeepSeek harness 检查表移植"
type: plan
status: implemented
phase: N/A
updated: 2026-09-02
summary: "SessionBar 对话|轨迹 tablist；stub 投影 + fixture；轨迹表 + 检查器 + 过程折默认展开；T1–T3 @ `b08ca9de`–`3e2ac61f`；T5a reveal 子集 @ `f66c36c9`；T4 blocked PRD-008；T5 搜索/虚拟化/Overview 仍 Deferred"
---

# Conversation 轨迹透镜

> 需求：[PRD-012](../../docs/product/requirements.md#prd-012-conversation-轨迹透镜)（`accepted`）。  
> 对话页合同：[PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) 不变。  
> 宿主对照（只取闭集，不取内容定义）：Desktop [ADR-047 决策 2](../../../UniverseAgentDesktop/dev/decisions/047-typed-slot-hosts-and-vscode-bottom-panel.md)。  
> 内容对照（只取 view-model / 记录种类，不搬 React）：sibling `deepseek-harness/packages/client/ui-trajectory/`。  
> 透镜组装：[page-access-schemes.md](page-access-schemes.md) §4 三槽冻结；本方案只在 SessionBar 加闭集切换、在 `timeline` 槽换阅读面。  
> 本方案 Grok 只读审查（Approve with changes）已当轮改入；2026-09-01 用户签收。Opus 5.0 因账单未付未跑。  
> **签收：** T1–T3 已合入（`b08ca9de`–`3e2ac61f`）；T5a reveal 子集 @ `f66c36c9`；T4 blocked PRD-008；T5 搜索/虚拟化/Overview 仍 Deferred。

**Goal：** 在默认 Code 窗口 `CONVERSATION_PART` 上提供不可关闭的「对话 | 轨迹」两页。对话页是压缩阅读。轨迹页是同一会话的详细列表，强制显示对话隐去的注入 / chip / 环境，并对长工具段复用过程折 overlay（默认展开）。无引擎用 stub fixture，不冒充已接引擎。

## 1. 选定与拒绝

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 宿主 | SessionBar **`role="tablist"` 两枚 tab**「对话 \| 轨迹」（§3.1 含 300px 合同）；阅读列仍用现有 `timeline` 槽 | 新 Part；Bottom Panel `agentInspect`（那是 Agents/Team inspect）；Editor tab；占满 SessionBar 的内容 tab（Desktop 视觉债 V-07）；`role="radiogroup"` 分段钮（与 tablist 混用） |
| 轨迹内容 | DeepSeek harness **检查记录表**（`TrajectoryCellKind` + 局部检查器） | ADR-047 正文「当前活动/运行监视」当作本仓轨迹定义（冲突见 [traceability](../../docs/product/traceability.md)） |
| 隐形卡片 | **只在轨迹**。对话页用户行只有用户正文 | 对话页折叠摘要；把注入卡画进 PRD-003 时间线 |
| UI 实现 | 本仓 DOM + CSS（`contrib/conversation`），对照 harness 行为 | `import` `deepseek-harness/**`、React、`dsh-client-*` runtime（Desktop ADR-042 / INV-ALGO-1） |
| 数据 | 无引擎：stub **平行投影**（turns ≠ trajectory records）。有引擎：同一 Event 窗口、轨迹 `ConversationNodeDefinition`（`target: 'trajectory'`） | 第二套 session store；用 `IChatModel` / `ChatListWidget` 当轨迹；实现名为 Assembler 的类型 |
| 过程折 chrome | **显示 overlay**（ADR-046）：连续思考/工具可折。对话默认收起；轨迹默认展开便于分析 | 把折壳当成列表行 / `groupIdentity`；把 context / SYSTEM / compacted 折进过程区藏掉 |
| 轨迹缩进 | 过程折之内再套 harness **tool → subtool**（`parentCallId` / depth） | 只做 subtool 缩进、禁止 Thinking 层 |
| 注意力 | pending confirmation / Diff **不**自动切轨迹 | 权限到达时切轨迹 |

未回答的上一问按 harness 默认钉死：对话页 **完全不出现** 注入卡 / chip / 环境全文。

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| `ConversationLens` 挂三槽 `sessionBar` / `timeline` / `dock`；无透镜切换 | `src/vs/workbench/contrib/conversation/browser/conversationLens.ts` |
| SessionBar 单行 22px：leading 标题 + trailing SelectBox / New / Delete / History | `conversationLens.ts` `mountSessionBar` · `media/conversationLens.css` |
| 时间线数据 = `IConversationStubService` turns：`user` / `assistant` / `confirmation` | `conversationStubModel.ts` |
| seed：`untitled` / `tour` / `blank`；`blank.turns = []` | `conversationStubModel.ts` `createSeedSessions` |
| Dock 贴列底；Maximize input 给 `timeline`+`dock` 加 class | `conversationLens.ts` `setInputMaximized` |
| 权限座位在时间线内 | `conversationConfirmationSeat.ts` |
| page-access 切片 4 绿field `ConversationTimelineTree` **尚未实施**；timeline 仍是 stub DOM | [page-access-schemes](page-access-schemes.md) §10 切片 4 |
| inspect Panel `workbench.panel.agentInspect` 属页面接入切片 3，**不是**本方案 | page-access §1.3 / §15.3 |
| harness 记录种类 | `deepseek-harness/.../trajectory-record.ts` `TrajectoryCellKind` = `system` \| `user` \| `context` \| `compacted` \| `message` \| `tool` \| `subtool` |
| harness：`user/message` 且 `source.kind !== 'user'` → trajectory `kind: 'context'` | `trajectory-message-definitions.ts` |
| harness：`request/header` → SYSTEM / prompt 变化 | `trajectory-request-header-definition.ts` |
| harness 用户附带 block | `TrajectoryCellProps.sourceBlocks`；检查器 Source / Payload |
| `IConversationStubService` 无轨迹 API；model 为 service 私有 | `conversationStubService.ts:13-31` · `:37` |
| `ConversationPart.minimumWidth = 300` | `conversationPart.ts:50` |

## 3. 设计

### 3.1 闭集透镜（chrome）

SessionBar 加 `role="tablist"` 两枚 tab（不可关、不可拖、不可第三枚）：

| id | 标签（`localize` 英文源，与现有 SessionBar 一致） | 默认 |
|----|------|------|
| `conversation` | Conversation | **是** |
| `trajectory` | Trajectory | 否 |

**300px / 22px 合同（HEAD 已挤满，禁止「挤 leading」空话）：**

HEAD：`ConversationPart.minimumWidth = 300`（`conversationPart.ts:50`）；bar `height/min-height: 22px`；trailing `.conversation-lens-session-controls` 为 `flex-shrink: 0`（「Session」label + SelectBox `min-width: 120px` + New/Delete/History）；leading 已 `min-width: 0`，标题在 300px 下几乎被吃光。page-access §1.4 **Deferred 保留 SelectBox**，本方案不得删它。不得加高第二行。

T1 **必须同时**做这三件，否则 tab 在最小宽不可见：

1. **隐藏** `.conversation-lens-session-switcher-label` 可见「Session」字（`SelectBox` 用 `aria-label` 保留）。省 ~50px。
2. SelectBox `min-width` 从 `120px` 降到 **`72px`**（`max-width: 180px` 保持）。
3. tablist 放在 leading：**图标之后、标题之前**，`flex-shrink: 0`；两枚短标签。标题继续 ellipsis。

T1 断言：宿主宽 300px 时两枚 tab `offsetWidth > 0`；bar 计算高度仍 22px。

- 切到 `conversation`：`timeline` 槽渲染现有回合列表（PRD-003）。
- 切到 `trajectory`：`timeline` 槽渲染轨迹表 + 其局部检查器。Dock **仍在**，不改发送链。
- Input Maximize 在两页都有效：最大化时仍藏/压 `timeline` 视口，不卸 Dock。
- 切会话：透镜选择 **保持**，轨迹表换成该会话投影。
- 持久化：`IStorageService`，`StorageScope.WORKSPACE` + `StorageTarget.MACHINE`，键 `conversation.lensId`（`'conversation' | 'trajectory'`）。缺省 / 坏值 → `conversation`。**重载窗口后保持**（不只「同一次打开」）。`ConversationLens` 今天无 storage 注入，T1 在构造函数服务参数末尾加 `@IStorageService`（`workbenchInstantiationService` 已有该服务）。
- 在轨迹页发送：Dock 发送链不变（仍 `appendUserTurn`）。新用户回合同时进入对话 turns 与轨迹 `user` 行；**不**因此切回对话。
- Inbox 点击：这是用户操作，**不是** PRD-012.4 的自动切页。轨迹页上点 Inbox → 切回 `conversation` 再 `scrollToFirstPendingConfirmation`（座位只在对话 DOM）。pending 到达 / Diff **禁止**自动切到轨迹。
- 文案：用户可见处禁止两页都叫「过程」。对话页过程折（将来）用既有折区用语；本页叫 Trajectory。

**禁止：** 用 `EDITOR_PART` tab、`ViewPane` 标题 tab、或占满 SessionBar 宽度的大 tab。Desktop 视觉审计 V-07 已否。

### 3.2 两套投影（同一会话，不是两套真相）

| 面 | 输入 | 输出 |
|----|------|------|
| 对话 | `ConversationStubTurn[]`（将来 UA admitted turns） | 用户正文 / 助手正文 / 权限座位 |
| 轨迹 | `ConversationTrajectoryRecord[]`（将来 Event fold） | 下表 cell |

无引擎时 **turns 不自动生成** context / SYSTEM / `sourceBlocks`。seed 会话另附 fixture 记录（§3.4），证明「对话看不见、轨迹看得见」。引擎阶段用同一 Event 窗口、轨迹自己的 `ConversationNodeDefinition`（`target: 'trajectory'`，对照 harness；**不要**实现名为 Assembler 的类型）做 fold，替换 fixture，不改 chrome。

### 3.3 轨迹记录种类（本仓闭集）

对照 harness `TrajectoryCellKind`，本仓加 `thinking`（过程折用，DSH 表无此格）。

**T1–T2 必出现：** `user` / `context` / `system` / `message`（PRD-012.3）。  
**T3 必出现：** 一对 Stub **`tool` + 缩进 `subtool`**，以及过程折 overlay（默认展开）；context / SYSTEM 在折外。  
**T4：** 活数据替换 fixture。`compacted` 仍预留，且始终在折外。

| kind | 对话页 | 轨迹页 | 来源 |
|------|--------|--------|------|
| `user` | 只显示 `text` | text + compact `sourceBlocks` | 用户消息 |
| `context` | **不渲染** | 注入卡 | stub / 引擎 inject |
| `system` | **不渲染** | 环境 / 提示词摘要 | `request/header` |
| `message` | 助手正文 | 助手请求行 | assistant |
| `tool` | 过程折里的工具行 | 过程折内的检查父行 + payload | 根 tool call |
| `subtool` | 过程折内缩进（不另起一层 Activity） | 相对父 `tool` 再缩进 | `parentCallId` |
| `thinking` | 对话 `reasoning` 投影 | 过程折内 Thinking 层（**本仓扩展**，DSH `TrajectoryCellKind` 无此项） | 思考块 |
| `compacted` | 不渲染 | 预留 | compaction |

每条记录字段（本仓 `ConversationTrajectoryRecord`，对照 `TrajectoryCellProps` / `TrajectorySourceBlock`，**不**抄 React props，**不** import `dsh-client-runtime` 的 `ConversationPromptSnapshot`）：

```ts
type ConversationTrajectoryKind = 'system' | 'user' | 'context' | 'compacted' | 'message' | 'tool' | 'subtool' | 'thinking';

interface ConversationTrajectoryBlock {
	readonly type: string;      // harness: 'text' | 'image' | 'tool-call' | …
	readonly content: string;
	readonly toolName?: string;
}

interface ConversationTrajectoryRecord {
	readonly id: string;
	readonly kind: ConversationTrajectoryKind;
	readonly text: string;
	readonly sourceBlocks?: readonly ConversationTrajectoryBlock[];
	readonly messageSource?: { readonly kind: string; readonly label?: string };
	readonly environment?: { readonly cwd?: string; readonly os?: string; readonly extra?: string }; // 本仓 stub 字段，harness TrajectoryCellProps **没有**此项
	readonly promptDetail?: string;       // stub 用纯文本；引擎后可换成结构化 snapshot，不进对话页
	readonly inputDetail?: string;
	readonly outputDetail?: string;
	readonly result?: string;
	readonly opensTurn?: boolean;
	readonly callId?: string;
	readonly parentCallId?: string; // subtool → 父 tool；对照 harness，无则平铺
	readonly depth?: number;       // 0 = 根 tool；subtool ≥ 1
}
```

**chip / 附带 block：** harness **没有** `type: 'chip'`。USER 行把 `sourceBlocks` 画成行内 compact 标签（文件名 / `toolName` / 截断 `content`）；检查器展开原文。对话页只渲染 turn `text`，**零** `sourceBlocks`。

**环境信息：** 优先 `kind: 'system'` 行（提示词 / 工具目录 / cwd 摘要）；检查器展示 `promptDetail` 与 `environment`。不把环境画进 StatusBar。

**tool / subtool 缩进：** 在过程折 **内部** 再套 harness 调用树。`subtool` 的 `parentCallId` 指向父 `callId`，`padding-inline-start: 12px * depth`。

**过程折 overlay（轨迹分析）：** 与 PRD-013 **同一套** `projectProcessFoldSpans` / 折 chrome。切段 kinds = `thinking` | `tool` | `subtool`；`user` / `context` / `system` / `message` / `compacted` **切开且不得藏进折内**。轨迹默认 **展开**（分析）；对话默认收起。折壳不是列表行键。T3 必须能收起长工具段，收起后 header 仍含 Stub，折外仍能看见 SYSTEM / context。

### 3.4 Stub fixture（无引擎必有）

在 `conversationStubModel` **不**把轨迹检查行写入 `turns`（过程折 kinds 是对话页的，不是轨迹记录）：

| 会话 | 对话 turns（保持现状） | 轨迹额外 fixture |
|------|------------------------|------------------|
| `untitled` | user + 过程折 kinds + assistant + confirmation | 1× `system`（**Stub environment**）；1× `context`（**Stub: workspace context**）；`untitled-u1` 轨迹 user 行 1× `sourceBlocks`；T3：投影出的 thinking/tool + 1× `subtool`（`parentCallId` 指向投影 tool，**Stub: nested dispatch**） |
| `tour` | 现有 Q&A | 1× `context`（`text` 含 **Stub: time context**） |
| `blank` 以及 `createSession()` / 删光后的新会话 | `[]` 或仅新用户输入 | 无 fixture extras → 凡 `getTrajectoryRecords` 为空都走轨迹空态 |

`IConversationStubService.getTrajectoryRecords(sessionId)`（**必须**扩接口；HEAD 只有 `getTurns`，model 是 service 私有字段 `conversationStubService.ts:37`）。Lens **只**走服务，禁止透镜直接 `new ConversationStubModel`。

实现：`ConversationStubModel.getTrajectoryRecords` = `projectTurnsToTrajectory(turns)` ∪ fixture extras。`projectTurnsToTrajectory`：`user`→`user`、`assistant`→`message`、`confirmation` **跳过**、`reasoning`→`thinking`（Stub 文案保留）、`tool`→`tool`。fixture 另插 `context` / `system` / `sourceBlocks` / `subtool`。过程折只包 `thinking`/`tool`/`subtool` 连续段，不把 extras 里的 SYSTEM 吃进去。

**诚实：** 所有 fixture 行的 `text` / 检查器可见文案必须带 `Stub`（上表）。禁止「Engine connected」。SYSTEM 用 Stub environment。chip 不得看起来像用户真的附了 README。

### 3.5 轨迹 UI

`timeline` 槽内（非 Panel）：

```text
┌ toolbar: 搜索（v1 可先不做）     ┐
├ record table（两列：kind | 预览）┤
└ details（选中行；可关；窄时盖表）┘
```

- 表：`role="table"` 或 list；kind 列 USER / CONTEXT / SYSTEM / ASSISTANT；T3 起加 TOOL / SUBTOOL。subtool 行 `padding-inline-start` 随 `depth`。
- 选中：打开局部检查器（Summary / Payload / Result 按 kind 显隐）。**不**用 Chat 详情栏，**不**用 `PANEL_PART`。
- Overview 瀑布时间条：**Deferred**（harness 有，本波用户未要）。
- 虚拟化：**Deferred** 到记录数需要时；fixture 三位数以下用普通 DOM。与 page-access `ConversationTimelineTree` **不是**同一棵树。
- 空态：**任何** `getTrajectoryRecords` 为空的会话（不限 seed id `blank`）→ `localize('conversationLens.trajectoryEmptyTitle', "No activity yet")`，可附 hint。禁止空白 tab。对话页空态仍是 HEAD「No messages yet」，两页文案不要混。
- 实时跟随：无引擎不需要；引擎后仅当滚动已在底部才跟尾。

### 3.6 文件落点

全部 `src/vs/workbench/contrib/conversation/`：

| 文件 | 职责 |
|------|------|
| `conversationLens.ts` | SessionBar tablist + 300px 合同；按 `lensId` 把 timeline 交给对话列表或轨迹宿主；Inbox 从轨迹切回对话 |
| `conversationLensSessionBarStrings.ts` | Conversation / Trajectory 标签 |
| `conversationTrajectory.ts` | 表 + 检查器 DOM |
| `conversationTrajectoryModel.ts` | `ConversationTrajectoryRecord` 类型 + `projectTurnsToTrajectory` |
| `conversationStubModel.ts` | `getTrajectoryRecords` + fixture |
| `conversationStubService.ts` | **扩展** `IConversationStubService.getTrajectoryRecords` 并委托 model |
| `media/conversationLens.css` | 藏 Session label、SelectBox 72px、tablist、表、检查器、subtool 缩进 |
| `conversationLens.test.ts` | **T1**：默认 Conversation；切 Trajectory；300px 两 tab 可见；持久化；切会话保持 `lensId`；任意空记录会话轨迹空态；Inbox 从轨迹切回对话 |
| `conversationTrajectory.test.ts` | **T2**：投影 confirmation 不进轨迹；fixture Stub 文案；对话 DOM 无 CONTEXT/SYSTEM/`sourceBlocks` |
| `conversationTrajectoryUi.test.ts` | **T3**：表 + 检查器 + tool/subtool + 过程折默认展开、收起后 SYSTEM/context 仍在 |
| `conversationTrajectoryImportBoundaries.test.ts` | T2：扫描 `contrib/conversation` 生产文件，禁路径子串 `deepseek-harness` / `dsh-client`。**禁止**占用 page-access 切片 4 规划的 `conversationImportBoundaries.test.ts` |

**禁止**改 `contrib/chat/**`、`vs/sessions/**`、`layout.ts`。

## 4. 切片

| # | 内容 | 验证 | 引擎？ |
|---|------|------|--------|
| T1 | tablist + 300px 合同 + 持久化 + **任意**空记录会话空态 + 切会话保持透镜 + Inbox 从轨迹切回对话 | `conversationLens.test.ts` | 否 |
| T2 | stub 投影 + fixture（context / sourceBlocks / system，均 Stub 文案）+ 对话负向断言 + 独立 import 扫描 | `conversationTrajectory.test.ts` + `conversationTrajectoryImportBoundaries.test.ts` | 否 |
| T3 | 轨迹表 + 检查器 + tool/subtool 缩进 + **过程折 overlay（默认展开；SYSTEM/context 在折外）** | `conversationTrajectoryUi.test.ts` | 否 |
| T4 | 引擎 Event fold 替换 fixture（含真 tool 树） | **blocked on PRD-008** | 是 |
| T5a | 对话 ↔ 轨迹双向 reveal（非 Inbox）：turn 菜单 View in Trajectory；轨迹行链回对话并 `revealTurn` / `revealRecord` | lens + 轨迹导航 wiring（`f66c36c9`；无专属测试文件） | 否 |
| T5 | 搜索、虚拟化、Overview | Deferred | 是 |

**Implemented：** **T1–T3**（`b08ca9de`–`3e2ac61f`）；**T5a** reveal 子集（`f66c36c9`）。T4 否（blocked on PRD-008）；**T5** 搜索/虚拟化/Overview 仍 Deferred。

T1 与 page-access / M5：**不**改 `agentSessionsActions.ts`、roster `onDidOpen`、Chat 路由。SessionBar 只加 tablist + 上列收缩。**不**提前删 SelectBox。

## 5. 非目标

- 不接 UniverseAgent / harness runtime / Cordis Assembler。
- 不搬 `TrajectoryView.tsx` / CSS modules。
- 不把轨迹放进 Agents Window `SESSIONS_PART`（本需求是默认窗 Conversation）。
- 不把 context / SYSTEM / compacted / 用户正文折进过程区。
- 不改 PRD-003 对话列表语义。
- 不做 Diff / inspect Panel / 轨迹造 Run。
- 不在对话页画隐形卡片「一行摘要」。

## 6. 验收对照

| PRD-012 | 切片 |
|---------|------|
| 1 闭集、默认对话、Dock 仍在 | T1 |
| 2 对话无注入/环境/chip | T2 |
| 3 轨迹有 context、chip、SYSTEM + 检查器 | T2–T3 |
| 4 轨迹过程折（默认展开；相关项在折外） | T3 |
| 5 父子工具缩进 | T3 |
| 6 pending/Diff **不自动**切轨迹 | T1：无 arrival listener；Inbox 点击切回对话是用户操作 |
| 7 空态 | T1 任意零记录会话，不限 `blank` |
| 8 不是 ChatEditor / Panel inspect | T1 仍在 `CONVERSATION_PART` |

## 7. 风险

| 风险 | 缓解 |
|------|------|
| SessionBar 22px × 300px 已挤满 | §3.1 三件套：藏 Session 字、SelectBox 72px、tab 在 leading 图标后且 `flex-shrink: 0`。T1 用 300px 宿主测可见性。Part hide-control overlay（`conversationPart.css`）是既有 trailing 裁切，tabs 不放 trailing |
| fixture 被当成引擎 | 每条 fixture 可见文案含 Stub；PRD-007；traceability 禁止当证据 |
| 与 page-access 切片 4 抢 `timeline` DOM | 轨迹是另一宿主组件；对话列表仍可日后换成 `ConversationTimelineTree`；两页互斥挂载 |
| 实施者 import harness | **新** `conversationTrajectoryImportBoundaries.test.ts`；不创建 / 不改 page-access 的 `conversationImportBoundaries.test.ts` |
| 透镜直接碰 private model | T2 扩 `IConversationStubService.getTrajectoryRecords` |

## 8. 知识层待同步（签收后）

- [conversation-lens-assembly.md](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)：SessionBar 闭集透镜；timeline 槽可换轨迹面。
- [agent-ui.md](../../docs/systems/chat/agent-ui.md)：ConversationLens = 对话 \| 轨迹。
- [glossary.md](../../docs/glossary.md)：**轨迹透镜** 词条已在本稿落盘（链本方案）；签收后把「详见」改指知识层。
- [page-access-schemes.md](page-access-schemes.md) §4 已加本方案指针，不重开三槽所有权。

## 9. 相关文档

- [PRD-012](../../docs/product/requirements.md#prd-012-conversation-轨迹透镜) · [traceability](../../docs/product/traceability.md)
- [page-access-schemes.md](page-access-schemes.md) §4
- [conversation-process-fold.md](conversation-process-fold.md)（PRD-013 共用 overlay）
- [m5-ui-shell-hardening.md](m5-ui-shell-hardening.md)（无共享文件；Chat 路由不是本方案）
- Desktop [ADR-047](../../../UniverseAgentDesktop/dev/decisions/047-typed-slot-hosts-and-vscode-bottom-panel.md) · [ADR-046](../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md)（折是 overlay，不是列表行）
- harness（只读对照，禁止 import）：`packages/client/ui-trajectory/src/client/trajectory-record.ts` · `trajectory-message-definitions.ts` · `TrajectoryTable.tsx`

## 10. 审查记录

**Reviewer：** Cursor Grok 4.6（`inherit` / `generalPurpose`，只读）。**Assessment：** Approve with changes。Critical / Important 已当轮改入下文表。

**签收：** 2026-09-01 用户签收（Grok 审查后；Opus 5.0 因账单未付未派）。T1–T3 已合入（`b08ca9de`–`3e2ac61f`）；`status: implemented`。

| 级别 | 意见 | 本稿处理 |
|------|------|----------|
| Critical | 22px×300px 上「挤 leading」不可行；trailing `flex-shrink:0` + SelectBox 120px 已占满 | 改入 §3.1 三件套合同 + T1 300px 可见性断言 |
| Important | `getTrajectoryRecords` 挂在 private model，Lens 看不见 | 改入：扩 `IConversationStubService` |
| Important | 空态绑死 seed `blank`，漏 `createSession()` | 改入：任意零记录会话 |
| Important | `tool`/`subtool` 写成 v1 必实现但 T1–T3 无 fixture | 改入：种类预留，T4 才有工具行 |
| Important | context/chip fixture 无 Stub 标签，撞 PRD-007 | 改入：可见文案必须含 Stub |
| Important | 勿占用 page-access 的 `conversationImportBoundaries.test.ts` | 改入独立 `conversationTrajectoryImportBoundaries.test.ts` |
| Important | 轨迹页 Inbox 座位 DOM 被卸掉 | 改入：Inbox 点击切回对话再滚动；arrival 不自动切轨迹 |
| Important | T2/T3 断言写进 T1 测试文件 | 改入按切片拆三个测试文件 |
| Minor | `environment` 非 harness 字段；分段控件 vs tablist；Assembler 叫法；中英空态 | 已改入或标注 |
