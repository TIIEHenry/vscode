---
title: "Conversation 空会话与输入面"
type: plan
status: accepted
phase: N/A
updated: 2026-09-01
summary: "PreFirst 居中 Composer + 身份条；Active 底栏同一 Composer；Agent/Route 初始化 XOR；Inbox 左右分簇且 Task 在 MessageQueue 左；已签收；T1–T6 ReadyToImplement；未实施"
---

# Conversation 空会话与输入面

> 需求：[PRD-015](../../docs/product/requirements.md#prd-015-conversation-空会话与输入面)（`accepted`）。  
> 时间线发送合同：[PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) 不改。  
> 透镜三槽：[conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)（`draft`）— 本方案改 `dock` 与空会话 placement，不改 `ChatWidget` 接管。  
> 外仓只读：Desktop [ui-interaction-spec §8.3](../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md) Inbox / Input Dock；Singularity [session-config-panel](../../../UniverseAgent/singularity/docs/systems/session/session-config-panel.md) 首条锁定、[chat-input-bar](../../../UniverseAgent/singularity/docs/ui/components/input/chat-input-bar.md) 现行底栏无 Agent；**MessageQueue 列表/行交互**以 Singularity [message-queue-bar.md](../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md) 与交互原型 [message-queue-layout-preview.html](../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html) 为设计稿 SSOT。  
> 视觉对照（非正式 SSOT）：仓内快照 [conversation-empty-hero.canvas.tsx](conversation-empty-hero.canvas.tsx)。聊天旁活 canvas 仍在 Cursor `canvases/`，不同步进 git。  
> **签收：** 2026-09-01 用户签收。规则 16 Opus 5.0 slug 不可用（未用其它模型顶替）。T1–T6 ReadyToImplement；未改 `src/`。

**Goal：** 空会话是安静居中输入；有消息后同一张 Composer 落到列底。SessionConfig 五字段按 XOR 放置，不复活 2×2 卡，也不画锁定配置第二行。

## 1. 选定与拒绝

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 空会话布局 | Wide：身份条在居中 Composer **上方**；无 Inbox | 空态「No messages yet」+ 输入永远钉底；Cursor 式 Inbox 叠在空会话上 |
| During 布局 | Composer **BottomDocked**；身份 = 阅读列一行 | 身份进 SessionBar；第二行 Locked SessionConfig |
| Composer | **一张**组件：Init / During / 列表编辑 / 队列编辑 | `ChatInputPart` 整块；Singularity 2×2 Material 配置卡；展示态再画一套带按钮的用户输入 |
| 底栏视觉 | 同行同高（32px 命中）；`+` 浅底圆、语音无底、发送实心圆；下拉/工具图标无背景 | 16px `IconButton` 与 32px 圆钮混高；`+`/语音描边实心底；发送变 Stop |
| AgentProfile | **仅空会话**可改；首条后从 Composer 消失 | During 仍下拉；进 SessionBar；CompactStrip 锁定行当第二 chrome |
| Route | 空会话在 Composer；首条后 **只**在 SessionBar | During 仍在 Composer；只藏在 More |
| Model / Permission / Tools | During **仍**在 Composer 底栏 | 全部挪到 SessionBar；Tools 做成第二颗 labeled pill（Tune 图标保留） |
| Inbox 槽位 | Active 才出现；左 Task · MessageQueue · Goal，右 Stop · ctx 环；独立浮层无共用底条 | 一条 Inbox 标签把 Queue/Goal/Stop 挤在同一行；Queue/Tasks 融成一颗 chip；Init 显示 Inbox |
| MessageQueue 列表 UI | 跟 Singularity Queue Tab 设计稿（hold/edit、Pause/Clear、行状态、reorder/inject 等） | 自造一套列表行；把已退役 QueueBar 常驻条挂回 Composer；用 StatusPanel 当本仓 Inbox owner |
| 编辑 | 展示 = 纯文本用户卡；点击才 mount Composer + Exit；队列编辑 XOR 主 Composer | 展示卡带 Edit/Copy 按钮；列表编辑与底栏 Composer 同时存在 |
| 语音 | 麦克风紧贴发送左侧；转写队列 ≠ MessageQueue | 语音进 MessageQueue；麦克风放在 `+` 旁 |

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| 三槽已落地：`sessionBar` / `timeline` / `dock` | `conversationLens.ts` `mountSessionBar` / `mountTimeline` / `mountDock` |
| 身份条 **始终** 在阅读列顶，且测 fort 不在 SessionBar / dock | `ConversationIdentityStrip`；`conversationIdentityStrip.test.ts` |
| 空时间线文案「No messages yet」/「Send a message below…」 | `conversationTimelineTree.ts` emptyState |
| Dock **始终** 含 gate 行 + **单行** Inbox（label · queue · goal · stop · pending）+ composer | `mountDock` ~313–391 |
| Inbox 无 Task 独立控件、无 ctx 环、无左右分簇 | 同上；测试 `compact chrome: inbox status stays on one row` |
| Composer：textarea + 底栏 attach / Maximize 文案钮 / 「No model」文本 / monaco **Send** | `mountDock` bottomBar；无 Permission / Agent / Route / Tune / mic |
| SessionBar：透镜 tab · 标题 · Session SelectBox · New · Delete；无 Route | `mountSessionBar` |
| 禁止 `ChatInputPart` 整块进 Dock | [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) §4；`conversationImportBoundaries.test.ts` |
| Singularity：Agent 首次选定后不可改（`system_prompt` 绑会话）；Permission/Route 锁定后仍可改工具栏 | `session-config-panel.md` 设计约束 |
| Singularity 现行 ChatInputBar 底栏无 Agent：`+ Tune Flag ⋯ \| Model 模板 Send` | `chat-input-bar.md` 布局概览 |
| Desktop SessionBar 拥有 History / Route / Copy / Snapshots | ui-interaction-spec §6.4 槽位表 |
| Desktop Inbox：左 Queue/Tasks tab · Goal；右 Stop · ctx 环 | ui-interaction-spec §8.3 |
| Singularity MessageQueue 列表：hold=`EDITING` 不 pause 整队；Save/Cancel 释 hold；Pause/Clear/reorder/inject 等见设计稿 §4–§5 | [message-queue-bar.md](../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md)；原型 [message-queue-layout-preview.html](../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html) |

## 3. 设计

### 3.1 相位

由 **可见消息** 派生（与 Singularity `hasVisibleMessages` 同口径，不是裸 `turns.length` 若日后有非可见项）。本仓 stub 今天 `getTurns` 即可见集。

| 相位 | 条件 | Composer 放置 | 身份条 | Inbox |
|------|------|----------------|--------|-------|
| **PreFirst** | 无可见消息 | 阅读列内 **居中**（Wide）；窄宽可仍居中缩 padding | **Composer 上方**（从阅读列顶拆下来或复制挂载点，XOR 只一处） | **隐藏** |
| **Active** | 有可见消息 | `dock` 槽 BottomDocked | **仅**阅读列顶（现 `ConversationIdentityStrip`） | **显示**（§3.4） |

Heal：清空消息 / 新建会话 → 回到 PreFirst（身份回到 Composer 上；Route 回 Composer；Agent 重新可改）。失败回滚首条与 Singularity 解锁自愈同语义，本波 stub 只需「删光 turns 即 PreFirst」。PreFirst **仍须**诚实引擎状态（PRD-007）：可留在身份条引擎 chip，或 Composer 上一行；**不要**靠 Inbox 行表达。

**禁止：** PreFirst 与 Active **同时**画两份身份条。**禁止**身份条进 SessionBar（HEAD 测试已锁）。

### 3.2 一张 Composer

产品表面是 **一个** Composer 宿主，政策 `compose` | `turnEdit` | `queueEdit`。

底栏单行、控件命中高度一致（32px）：

```text
左滚： [+] [Tune] [Permission▾] [Agent▾?] [Route▾?] [⋯]
右钉： [Model▾] [模板] [Maximize] [Mic] [Send]
```

| 控件 | 表面 | Init | During / 编辑 |
|------|------|------|----------------|
| `+` | 浅底圆、无描边 | 有 | 有 |
| Tune | ghost 图标 | 有 | 有 |
| Permission | ghost 下拉 | 有 | 有 |
| Agent | ghost 下拉 | **有** | **无** |
| Route | ghost 下拉 | **有** | **无**（改 SessionBar） |
| More | ghost | Display / Pin，不含 Route | 同 |
| Model | ghost 下拉；未选禁用 Send | 有 | 有 |
| 模板 / Maximize | ghost | 有 | 有 |
| Mic | 默认 ghost；录音中 filled | 有 | 有 |
| Send | 实心圆；恒为 Send | 有 | 队列编辑 = Save |

图标产品复用 Codicon / ActionBar（`add`、tune/`settings-gear`、`ellipsis`、`arrowUp`、mic、screen-full）。Canvas 字形只是对照。

**XOR 输入：** `turnEdit` 或 `queueEdit` 时 **不** 再挂主 `compose` Composer。Exit 退出 hold，回到 `compose`。

展示态用户回合：文本卡片、无按钮；点击 → `turnEdit`。

### 3.3 SessionConfig 五字段

不是第二棵组件树。字段挂在 Composer / SessionBar 上，按相位 XOR。

| 字段 | PreFirst | Active | 依据 |
|------|----------|--------|------|
| Agent | Composer 可改（默认 none / 无） | **从 Composer 移除**；不进 SessionBar | Singularity：`system_prompt` 首次注入后锁定 |
| Model | Composer 必选 | Composer 仍在 | 现行 ChatInputBar 右簇；Send 门控 |
| Permission | Composer | Composer | Singularity：锁定后仍可改工具栏 |
| Tools | Tune popup | Tune popup | ChatInputBar Tune，不是 labeled pill |
| Route | Composer | **SessionBar**（History/Route 槽）；Composer 无 | Desktop §6.4；本仓用户拍板 |

**禁止：** SessionConfigLockedPanel / CompactStrip 当列表头第二行（已否「锁定配置线」）。锁定后的 Agent 名称若要可见，本波 **不** 新开 chrome；引擎后可在轨迹/会话元数据读，不在 Dock。

无引擎：Agent / Route 用 stub 选项或诚实「无」，禁止假策略表。PRD-007。

### 3.4 Inbox 浮层（仅 Active）

独立芯片，**无**共用背景条，**不**与 Composer 连底。Maximize 输入时隐藏浮层（HEAD `setInputMaximized` 已有列内 maximize）。

```text
左： [Task] [MessageQueue] [Goal]          右： [Stop?] [ctx 环]
```

- **Task** 在 MessageQueue **左侧**（纠正「Queue / Tasks」融一颗）。点开 `auto_drive_task` 列表向上；与 Queue 列表 **XOR**。
- **MessageQueue 槽位**（本方案）：Inbox 芯片，点开列表**向上**浮出，不挤 Composer 高度。行点击进入 `queueEdit`（hold），与主 Composer XOR。
- **MessageQueue 列表 UI**（Singularity 设计稿，不在本方案重画）：行结构、状态 tag（编辑中 / 上传中 / 失败）、Pause / Clear、单项 hold 编辑、reorder / pin / inject / lock / retry 等 **跟** [message-queue-bar.md](../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md) §4–§5 与 [message-queue-layout-preview.html](../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html)。本仓只换挂载点（Inbox 浮层，不是 StatusPanel Queue Tab，也不是已退役的 Composer 上 QueueBar 常驻条）。编辑态仍用本仓同一张 Composer + Exit，对应稿里的 hold → 内联编辑 → Save/Cancel 释 hold。
- **Goal** 独立图标，永不进 Composer 行（Singularity 现行 Flag 在输入栏；本仓选定 Inbox）。
- **Stop** 仅 in-flight；不在 Composer 底栏。Send 恒 Send。
- **ctx** 圆环，不是 chip。无 admitted ctx 时省略。

无权威：整槽省略或诚实空（HEAD 已有 `No queue` 文案可迁到 MessageQueue 槽）。**禁止**假任务列表。

### 3.5 语音队列

麦克风在 Send 左侧。停止一段可立刻再录；转写按序拼进当前 draft。该队列 **不是** MessageQueue（候发）。无引擎时录音控件可 disabled + 诚实 title，或本地 stub 转写；不得把 clip 画进 Queue 列表。

### 3.6 SessionBar

保持自研。Active 增加 **Route** 下拉（无策略则省略）。SelectBox 去留仍是 page-access **Deferred**，本方案不改。

身份条继续禁止进 SessionBar。

## 4. 切片

冲突域：**一个** — `src/vs/workbench/contrib/conversation/**`（含 `browser/media` 与 `test/browser`）。同 tick 只 1 个写者。T1–T6 **ReadyToImplement**。

| 切片 | 交付 | 验证 |
|------|------|------|
| **T1 Placement** | PreFirst 居中 Composer + 身份 XOR；隐藏 Inbox/gate 或把 gate 收到 Composer 内诚实一行；空态去掉「Send a message below」把输入钉死的暗示 | `conversationLens.test.ts` + `conversationIdentityStrip.test.ts`：空会话身份不在 timeline 顶而在 composer 簇；dock 无 inbox-row |
| **T2 Composer chrome** | 32px 底栏；`+`/mic/Send 表面；Tune · Permission · Model · ⋯；Codicon | 测命中高度与 DOM 结构；无 `ChatInputPart` import |
| **T3 SessionConfig XOR** | `showAgent`/`showRoute` 仅 PreFirst；Active SessionBar Route；清空 turns 回到 PreFirst | 空会话 Composer 有 Agent+Route；发送后 Composer 无、SessionBar 有 Route |
| **T4 Inbox** | 左右分簇；Task 左于 Queue；列表 XOR；诚实空。Queue **列表**按 Singularity 设计稿接线，不自造行 chrome | 不再断言单行含 label+queue+goal+stop 融在一起；有队列 fixture 时行/hold 语义对得上 message-queue-bar |
| **T5 Edit XOR** | 用户卡展示无按钮；click → Composer+Exit；队列编辑 XOR 主输入 | 同时只存在一个 `.conversation-lens-composer` |
| **T6 Voice** | mic 槽位；可选 stub 转写条。无引擎可先 disabled | mic 在 Send 左；Voice 列表 ≠ inbox queue |

T1–T3 可串行同一写者；T4 依赖 T1（Inbox 仅 Active）。T5 依赖 T2。T6 可与 T4 后并行但同冲突域故仍串行。

## 5. 测试与门禁

- 改 `conversationLens.test.ts` 里 **过时** 的 Inbox 单行 / attach+文案 Maximize / 空态 hint 断言，使与本方案一致，禁止为保绿留旧布局。
- 保持 `conversationImportBoundaries.test.ts`：Dock **不得** import `chat/browser/widget/input/`。
- 身份 XOR：扩展 `conversationIdentityStrip.test.ts`（PreFirst 不在 reading-column 顶）。
- 最小命令：`scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts`（及 identity / import boundaries）。分层未变则不跑 `valid-layers-check`。

## 6. 文档

签收已做：PRD-015 `accepted`；本文件 `accepted`。知识层只加选定指针，**不**把 HEAD 写成新布局。实施 commit 再把 [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) §4「已落地」行改成与代码一致。

## 7. 文件互斥

| 冲突域 | 路径 | 写者 |
|--------|------|------|
| conversation-lens | `src/vs/workbench/contrib/conversation/**` | 实施 tick 单槽 |
| docs-prd-015 | `docs/product/**` · `dev/plans/conversation-empty-hero.md` | 本方案文档波 |

禁止实施 tick 改 `ChatInputPart` / Copilot welcome。
