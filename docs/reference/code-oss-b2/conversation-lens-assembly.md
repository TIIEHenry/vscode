---
title: "Conversation 透镜组装：零件如何嵌进 CONVERSATION_PART"
type: reference
status: accepted
phase: N/A
updated: 2026-09-05
summary: "三槽自研 chrome 冻结；ConversationLens 门面仍在 conversationLens.ts，GFS-3 拆 projection/sessionBar/dock/composer/composerChrome + residue（readingColumn/sessionBinding）同级模块；timeline 仍 ConversationTimelineTree；PRD-015/016 已落；禁止 ChatWidget 整块；3a → conversation-stream-timeline（accepted）"
---

# Conversation 透镜组装

> **结构性决策 SSOT** = [`dev/plans/page-access-schemes.md`](../../../dev/plans/page-access-schemes.md)；冲突以父方案为准。

外仓合同（只读，**不复述条款**）：[ui-interaction-spec](../../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md) §8.3 Input Dock、§8.4 权限座位、§8.6 阅读层级。  
本仓零件清单：[widget-parts](../../systems/chat/widget-parts.md)。宿主 / INV-TOPO / Copilot：[agent-ui](../../systems/chat/agent-ui.md)。壳槽：[desktop-shell-mapping](desktop-shell-mapping.md)。会话列表：[session-roster-reuse.md](session-roster-reuse.md)。

对照对象是 **Desktop Conversation 列**，不是把 `ChatWidget` 升格成产品中心。下文标 **已落地** vs **选定（已签收）**。

## 1. 问题

[widget-parts](../../systems/chat/widget-parts.md) 列了 donor 零件，没写 **怎么装进三槽**。

**已落地：** `ConversationLens` 门面仍在 `contrib/conversation/browser/conversationLens.ts`（`export class ConversationLens`）；GFS-3（`c5d791c7`）+ residue（`533fc6c42d5`）把 SessionBar / Dock / Composer / 阅读列 / session 绑定拆到同级 `conversationLens*.ts` 模块（§2.1），**不改** `IConversationLensSlots` 三槽契约与对外 import。`ConversationEditorPane` 创建三槽 DOM 并 `createInstance(ConversationLens, slots)`；`IConversationLensSlots` 定义在 `conversationPart.ts`（`sessionBar?` / `timeline` / `dock`；子代理 overlay 只传 `{ timeline, dock, filterAgentId }`）。时间线仍是绿field **`ConversationTimelineTree`**（`conversationTimelineTree.ts`；GFS-2 拆 types/renderer，门面符号不变）；数据经帧源投影 / `IConversationRosterService`。**零 import** `ChatWidget` / `ChatListWidget` / `IChatService`。

下一步容易把 `ChatWidget.render()` 整块塞进 Part——那会把 Copilot picker / welcome / entitlement 门闩带进产品列（INV-NO-COPILOT）。`chatSetup/` 在宿主层（`ChatViewPane`），见 §7，不在 widget 内。本文写组装合同，挡住这条捷径。

## 2. 三槽所有权（已落地，保持）

```text
IConversationLensSlots     ← 三槽契约（Part 定义；EditorPane 创建 DOM）
└── ConversationLens
    ├── sessionBar? → 自研（根 tab；子代理 overlay 省略）
    ├── timeline    → 阅读列：ConversationTimelineTree + parts adapter
    └── dock        → 自研表面，按外仓 §8.3；基础设施可借输入编辑器
```

Part 级窗口 chrome（SelectBox、←→、关非根 tab）在 `ConversationPart.sessionBar`，与页级透镜栏分层；见 [lens-and-trajectory](../../systems/conversation/lens-and-trajectory.md) §1。

| 槽 | 今天（已落地） | 所有权 |
|----|----------------|--------|
| `sessionBar?` | 「对话｜轨迹」透镜 tab、标题 rename、session `SelectBox`、New、Delete、Active Route；History→No history | **必须自研**（根 tab；overlay 无此槽） |
| `timeline` | `ConversationTimelineTree` + markdown + `ConversationConfirmationSeat` | chrome 自研；**禁止**整棵 `ChatListWidget` |
| `dock` | textarea + Send + Inbox 状态 + Maximize input（列内 `setInputMaximized`） | **必须自研表面** |

**禁止**让 `ChatWidget.render()` 接管三槽。`ChatWidget`（`browser/widget/chatWidget.ts`）继续当 donor 对照；宿主仍可开 `ChatViewPane` / Quick Chat（非产品中心）。`ChatEditor` 不是透镜（INV-TOPO）。

人类拍板：SessionBar / Inbox / 透镜自研；列表虚拟化、markdown/code、confirmation 零件进复用；权限座位半自研。SessionBar SelectBox 去留见父方案 §1.4 **Deferred**。

## 2.1 实现文件（GFS-3 + residue，已落 @ `c5d791c7` / `533fc6c42d5`）

**组装合同不变：** §2 三槽所有权冻结；timeline 槽仍由门面 `mountTimeline` 填 **`ConversationTimelineTree`**；Dock 仍是自研表面，不是 `ChatInputPart` 整块。

**机械拆分（不改产品语义）：** [giant-file-split](../../../dev/plans/giant-file-split.md) GFS-3 把原单文件 `conversationLens.ts` 拆成门面 + 同级实现模块；residue @ `533fc6c42d5` 再切 `conversationLensReadingColumn.ts` / `conversationLensSessionBinding.ts`。状态字段（`lensId` / `composerPolicy` / `conversationPhase` / `sessionViewLease` / `submitInFlight` / `inputMaximized` / `sessionTitleEditing` 等）与构造 / dispose **仍在门面**；新模块经各自 host 接口读写字段，不另持会话状态。门面 HEAD **783** 行（`wc -l` @ `533fc6c42d5`），≤ GFS 扩切片目标 800。

| 文件 | 从门面搬出的职责 |
|------|------------------|
| `conversationLens.ts` | 门面 `ConversationLens`；公开 API（`layout` / `focusDockInput` / `revealTimelineItem` / …）；`mountTimeline` → timeline 槽；仍 import 并持有 `ConversationTimelineTree` |
| `conversationLensProjection.ts` | `applySessionViewTimeline`、`updateSyncChrome` / `updateConversationPhase` / `updateReadingColumn`、`refreshTrajectoryRecords`、透镜 tab 状态（`setLensId` / `updateLensTabs`）、轨迹↔时间线互跳 |
| `conversationLensReadingColumn.ts` | `mountTimeline`（阅读列 DOM、identity strip、timeline 挂载）、`bindReadingColumnLayout`、密度 / 宽度布局 |
| `conversationLensSessionBinding.ts` | `bindSessionView` / `applyActiveSession`、lease 帧订阅与 coalescer、`renderInboxStatus`、turn 动作（copy / delete / cancel / visualize / focus） |
| `conversationLensSessionBar.ts` | `mountSessionBar`（含透镜 tab DOM）、session select、Active Route、标题 rename、New / Delete |
| `conversationLensDock.ts` | `mountDock`（Dock 槽：composer cluster、Inbox overlay、Send 绑定等） |
| `conversationLensComposer.ts` | `postBound` / `submitDraft`、`saveTurnEdit` / `saveQueueEdit`、draft 读写、voice、composer catalog |
| `conversationLensComposerChrome.ts` | Send / gate / maximize、context views（Add/Tune/More/Templates）、edit chrome、input history、session config selects |

i18n 字符串另抽出 `conversationLensDockStrings.ts` / `conversationLensSessionBarStrings.ts`（纯搬迁，不改语义）。

测与生产仍 `import { ConversationLens } from '.../conversationLens.js'`。本文不声称本轮跑过 compile / smoke；拆分验收见 GFS 方案 **§6** 与既有 `conversationLens.test.ts` 未减 it() 的签收记录。

## 3. 时间线选定组装（已签收；HEAD 已落地阶段 2 骨架）

**选定：** 在 `contrib/conversation` **新建** `ConversationTimelineTree`（`WorkbenchObjectTree<ConversationTimelineItem>`），**零 import** `chatListWidget.ts` / `ChatListItemRenderer`。虚拟化与滚底 hold **参考** donor 行为，代码写在新产品文件（`conversationTimelineScroll.ts`）。Markdown/code **仅借 render 函数**，经唯一 `IConversationTurnContentAdapter`（`conversationTurnContentAdapter.ts`）入参。

**拒绝：** 从 `ChatListWidget` **抽出**虚拟化——抽出仍共享构造链与 `ChatTreeItem` 类型系统，import 级无法机械 enforce **INV-NO-COPILOT**。

| 面 | 做法 | 状态 |
|----|------|------|
| 虚拟化 / 滚底 hold | 绿field `ConversationTimelineTree` + `ConversationAutoScrollHolds` | **已落地** |
| Markdown / code block | 复用 `chatMarkdownContentPart` / `codeBlockPart` 的 **渲染实现**，经 **唯一 adapter** 入参。**禁止**造长期存活的 `IChatRequestViewModel` / `IChatResponseViewModel` 影子模型 | **已落地** adapter 骨架 |
| 工具卡路由 | 按外仓 §8.6 阅读层级；打开落到已有 File / Terminal；卡不是 L1 | **选定** |
| 权限座位 | 保持 `ConversationConfirmationSeat`；虚拟化时座位 **不得**变成可回收 virt 行。合同指针：外仓 spec **§8.4** | **已落地** |
| 欢迎 / quota / setup parts | **禁止**（INV-NO-COPILOT） | 红线 |

**机械 enforce（CI）：** `conversationImportBoundaries.test.ts` 扫描 `contrib/conversation` **生产**文件（排除 `test/`）。失败条件 = import 路径含 `chat/widget/chatListWidget`、`chatWidget`、`chat/browser/widget/input/`、`agentSessions/`、或 `contrib/chat/` 下 **非** `chatContentParts/` 前缀。**允许：** `vs/workbench/contrib/chat/browser/widget/chatContentParts/**` 仅此白名单。

**禁止：** 把 `ChatListItemRenderer` 连同 `IChatRendererContent` 全套当产品时间线。产品路由在透镜，不在 donor renderer。

## 4. Dock / 发送链

| 面 | 选定 | 状态 |
|----|------|------|
| 表面 | 保持自研 Dock（textarea 或日后 `CodeEditorWidget` 输入核）；**禁止** `ChatInputPart` 整块（含一排 picker） | **已落地** textarea |
| 补全 / 粘贴 | 可借 `input/editor/` 基础设施 | **选定** |
| picker | 旁路 vscode model / mode / permission picker | **选定**（今天无 picker） |
| Send | lease `post({ kind:'submitInput' })`（旧 `appendUserTurn` 是 shim）；无引擎 stub 帧源可产 Stub echo，已连接拒写。**不是** `acceptInput` → `IChatService.sendRequest` 当权威。也 **禁止**照抄 `ChatInputPart` 的 execute 条把 Send 变成 Stop（指针：外仓 §8.3.6 / §8.3.7，不复述） | **已落地** 同 `post` 路径；引擎权威仍 PRD-008 |
| Inbox | 自研诚实空 / pending 摘要；可复用 confirmation pending 文案零件 | **已落地** 空 + pending |
| Maximize | 列内 `setInputMaximized`（已落地实现事实；条款指针 §8.3.11） | **已落地** |

`ChatInputPart` 是 donor 对照，不是 Dock 合同。外仓条款只链 §8.3，本文不发明例外。

**已落地（[PRD-015](../../product/requirements.md#prd-015-conversation-空会话与输入面) / [conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)，`ea0104c0`–`d4064ba0` T1–T6）：** PreFirst 居中 Composer + `ConversationIdentityStrip`、无 Inbox；Active Composer BottomDocked（32px 底栏）；Agent/Route XOR（PreFirst 在 Composer、Active Route 在 SessionBar）；Inbox 左右分簇且 Task 左于 MessageQueue。Dock 槽仍是自研表面，不是 `ChatInputPart`。

## 5. SessionBar

**已落地、保持自研。** 不在此做 Settings 齿轮。与 Navigator roster 共用同一会话服务（见 [session-roster-reuse.md](session-roster-reuse.md)），今天是 `IConversationRosterService`（decorator id 仍 `'conversationStubService'`）内存标题；引擎后换 UA session，不换槽位。SelectBox 去留 **Deferred**（父方案 §1.4）。Active **Route** 下拉在 SessionBar（PRD-015 T3）。身份条在 PreFirst 居中区 / Active 阅读列顶，不进 SessionBar。

## 6. 分阶段

1. **无引擎（已落）：** 三槽 **位置与所有权** 冻结（SessionBar / Timeline / Dock 各是谁的）。
2. **长列表 / markdown 质量（已落骨架）：** `ConversationTimelineTree` + parts adapter（§3）；数据仍 stub 或 UA 投影。不换 Part。座位对齐 §8.4。
3. **引擎：** **3a** 只换服务 / 发送链（adapter → UA）。**3b** Dock **状态行控件集**随 queue / stop / ctx 权威解锁（槽位仍是 Dock，不是「控件集永冻」）。不换 Part。

阶段 2 与 3a/3b 可交错，但 **槽位所有权先于接线**。

> **3a 修正（accepted @2026-09-02）：** 「只换服务」不成立——引擎事件是流式 delta，HEAD `onDidChangeSession` → `getTurns()` → `setChildren(null)` 全量重建会丢展开态并逐 token 重排。选定改为「换**帧源** + 时间线**增量 apply**」：显示写源 = `SessionEventStream` L1–L4，fold 复用 Desktop `session-core`，renderer 只吃幂等 `ViewFrame`，stub 也改为同一契约帧源；token 不变（`acquireSessionView` 同接口增量）。见 [conversation-stream-timeline](../../../dev/plans/conversation-stream-timeline.md)（`accepted`；本节正文随 S1 实施 commit 改写）。

## 7. 非目标

- `ChatEditor` / `ChatEditorInput` 当产品中心（INV-TOPO）
- 整块 `ChatViewPane` 搬进 `CONVERSATION_PART`（setup / entitlement 会进来）
- `IChatModel` 当 session-core
- 复述外仓 §8.3 / §8.6 条款

## 8. 相关文档

- [Agent UI](../../systems/chat/agent-ui.md) — 宿主、INV-TOPO、INV-NO-COPILOT
- [Widget 零件](../../systems/chat/widget-parts.md) — donor 清单（本文写组装，不重复枚举）
- [session-roster-reuse.md](session-roster-reuse.md) — Navigator roster 与 SessionBar 共用会话服务
- [壳映射](desktop-shell-mapping.md) — Part 与四钮
- 外仓 `docs/product/ui-interaction-spec.md` §8.3 Input Dock、**§8.4 权限座位**、§8.6 阅读层级（只链，不复述）
- 父方案：[page-access-schemes.md](../../../dev/plans/page-access-schemes.md) §4 / §10 切片 4
- 空会话 / 输入面（已实施）：[conversation-empty-hero.md](../../../dev/plans/conversation-empty-hero.md)（PRD-015）
- session 窗口 / chat tab（已实施）：[conversation-session-windows.md](../../../dev/plans/conversation-session-windows.md)（PRD-016）；timeline/dock 在 Conversation `IEditorPart` pane 内，窗口 chrome 在 Part
- 巨型文件拆分（GFS-3 已落）：[giant-file-split.md](../../../dev/plans/giant-file-split.md) §2.2

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。Critical：禁止嵌入整棵 `ChatListWidget`（硬编码 `ChatTreeItem` + `ChatListItemRenderer` 注入 entitlement）；content-part 须经唯一 adapter，禁止长期存活的 `IChatRequestViewModel` / `IChatResponseViewModel` 影子模型。Important：座位对齐 §8.4；阶段 3 拆 3a 发送链 / 3b Dock 控件集；Send ≠ `ChatInputPart` execute 条上的 Stop。

2026-09-01 按父方案 §12 同步：阶段 2 改为绿field `ConversationTimelineTree` + `conversationImportBoundaries.test.ts` / `chatContentParts/**` 白名单；与 HEAD 对齐。

2026-09-05 GFS-3 诚实同步：新增 §2.1（门面 `conversationLens.ts` + projection / sessionBar / dock / composer / composerChrome 同级模块）；§2 槽宿主改为 EditorPane + 可选 `sessionBar?`；重申三槽冻结与 timeline 仍 `ConversationTimelineTree`；不发明 compile/smoke 证据。审查后改：职责表补 `refreshTrajectoryRecords` / Route / save*；GFS 验收指针 §6；门面 ~949 行残留注记。

2026-09-05 GFS-3 residue 诚实同步：§2.1 补 `conversationLensReadingColumn.ts` / `conversationLensSessionBinding.ts`；门面 783 行 @ `533fc6c42d5`。
