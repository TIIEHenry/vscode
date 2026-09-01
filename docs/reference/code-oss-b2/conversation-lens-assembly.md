---
title: "Conversation 透镜组装：零件如何嵌进 CONVERSATION_PART"
type: reference
status: draft
phase: N/A
updated: 2026-09-01
summary: "对照 Desktop Conversation / Input Dock：三槽自研 chrome 保持；阶段 2 绿field ConversationTimelineTree + chatContentParts 白名单；发送链换 UA adapter；禁止 ChatWidget 整块或 ChatEditor"
---

# Conversation 透镜组装

> **结构性决策 SSOT** = [`dev/plans/page-access-schemes.md`](../../../dev/plans/page-access-schemes.md)；冲突以父方案为准。

外仓合同（只读，**不复述条款**）：[ui-interaction-spec](../../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md) §8.3 Input Dock、§8.4 权限座位、§8.6 阅读层级。  
本仓零件清单：[widget-parts](../../systems/chat/widget-parts.md)。宿主 / INV-TOPO / Copilot：[agent-ui](../../systems/chat/agent-ui.md)。壳槽：[desktop-shell-mapping](desktop-shell-mapping.md)。会话列表：[session-roster-reuse.md](session-roster-reuse.md)。

对照对象是 **Desktop Conversation 列**，不是把 `ChatWidget` 升格成产品中心。下文标 **已落地** vs **选定（已签收）**。

## 1. 问题

[widget-parts](../../systems/chat/widget-parts.md) 列了 donor 零件，没写 **怎么装进三槽**。

**已落地：** `ConversationLens`（`contrib/conversation/browser/conversationLens.ts`）挂进 `ConversationPart` 的 `IConversationLensSlots`（`sessionBar` / `timeline` / `dock`）。时间线已是绿field **`ConversationTimelineTree`**（`conversationTimelineTree.ts`）；数据是 `IConversationRosterService` turns。**零 import** `ChatWidget` / `ChatListWidget` / `IChatService`。

下一步容易把 `ChatWidget.render()` 整块塞进 Part——那会把 Copilot picker / welcome / entitlement 门闩带进产品列（INV-NO-COPILOT）。`chatSetup/` 在宿主层（`ChatViewPane`），见 §7，不在 widget 内。本文写组装合同，挡住这条捷径。

## 2. 三槽所有权（已落地，保持）

```text
CONVERSATION_PART          ← 槽宿主；不渲染产品 chrome
└── ConversationLens
    ├── sessionBar  → 自研（产品 chrome）
    ├── timeline    → 阅读列：ConversationTimelineTree + parts adapter
    └── dock        → 自研表面，按外仓 §8.3；基础设施可借输入编辑器
```

| 槽 | 今天（已落地） | 所有权 |
|----|----------------|--------|
| `sessionBar` | 标题 rename、`SelectBox`、New、Delete、History→No history | **必须自研** |
| `timeline` | `ConversationTimelineTree` + markdown + `ConversationConfirmationSeat` | chrome 自研；**禁止**整棵 `ChatListWidget` |
| `dock` | textarea + Send + Inbox 状态 + Maximize input（列内 `setInputMaximized`） | **必须自研表面** |

**禁止**让 `ChatWidget.render()` 接管三槽。`ChatWidget`（`browser/widget/chatWidget.ts`）继续当 donor 对照；宿主仍可开 `ChatViewPane` / Quick Chat（非产品中心）。`ChatEditor` 不是透镜（INV-TOPO）。

人类拍板：SessionBar / Inbox / 透镜自研；列表虚拟化、markdown/code、confirmation 零件进复用；权限座位半自研。SessionBar SelectBox 去留见父方案 §1.4 **Deferred**。

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
| Send | 无引擎：`appendUserTurn`（+ 可选 stub echo）；有引擎：adapter → UA，**不是** `acceptInput` → `IChatService.sendRequest` 当权威。也 **禁止**照抄 `ChatInputPart` 的 execute 条把 Send 变成 Stop（指针：外仓 §8.3.6 / §8.3.7，不复述） | **已落地** stub；引擎链 **选定** |
| Inbox | 自研诚实空 / pending 摘要；可复用 confirmation pending 文案零件 | **已落地** 空 + pending |
| Maximize | 列内 `setInputMaximized`（已落地实现事实；条款指针 §8.3.11） | **已落地** |

`ChatInputPart` 是 donor 对照，不是 Dock 合同。外仓条款只链 §8.3，本文不发明例外。

**选定合同（[PRD-015](../../product/requirements.md#prd-015-conversation-空会话与输入面) / [conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)，2026-09-01 签收，未实施）：** PreFirst 居中 Composer + 身份条、无 Inbox；Active Composer BottomDocked；Agent/Route XOR；Inbox 左右分簇且 Task 左于 MessageQueue。上表「已落地」仍是 HEAD：gate + 单行 inbox-row + 底栏 Send。实施前不得把本表改写成新布局。

## 5. SessionBar

**已落地、保持自研。** 不在此做 Settings 齿轮。与 Navigator roster 共用同一会话服务（见 [session-roster-reuse.md](session-roster-reuse.md)），今天是 `IConversationRosterService`（decorator id 仍 `'conversationStubService'`）内存标题；引擎后换 UA session，不换槽位。SelectBox 去留 **Deferred**（父方案 §1.4）。

保持自研。Active 增加 **Route** 下拉（无策略则省略）是 PRD-015 选定，HEAD 尚无该槽。身份条继续禁止进 SessionBar。

## 6. 分阶段

1. **无引擎（已落）：** 三槽 **位置与所有权** 冻结（SessionBar / Timeline / Dock 各是谁的）。
2. **长列表 / markdown 质量（已落骨架）：** `ConversationTimelineTree` + parts adapter（§3）；数据仍 stub 或 UA 投影。不换 Part。座位对齐 §8.4。
3. **引擎：** **3a** 只换服务 / 发送链（adapter → UA）。**3b** Dock **状态行控件集**随 queue / stop / ctx 权威解锁（槽位仍是 Dock，不是「控件集永冻」）。不换 Part。

阶段 2 与 3a/3b 可交错，但 **槽位所有权先于接线**。

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
- 空会话 / 输入面选定（未实施）：[conversation-empty-hero.md](../../../dev/plans/conversation-empty-hero.md)（PRD-015）

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。Critical：禁止嵌入整棵 `ChatListWidget`（硬编码 `ChatTreeItem` + `ChatListItemRenderer` 注入 entitlement）；content-part 须经唯一 adapter，禁止长期存活的 `IChatRequestViewModel` / `IChatResponseViewModel` 影子模型。Important：座位对齐 §8.4；阶段 3 拆 3a 发送链 / 3b Dock 控件集；Send ≠ `ChatInputPart` execute 条上的 Stop。

2026-09-01 按父方案 §12 同步：阶段 2 改为绿field `ConversationTimelineTree` + `conversationImportBoundaries.test.ts` / `chatContentParts/**` 白名单；与 HEAD 对齐。
