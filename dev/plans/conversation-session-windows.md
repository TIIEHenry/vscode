---
title: "默认窗 Conversation：session 窗口与 chat tab"
type: plan
status: draft
phase: N/A
updated: 2026-09-01
summary: "中间 Conversation 内嵌作用域 EditorPart；子代理默认窗口内对话框、最大化才开 tab；tab 顶面包屑替换；一键关非根 tab；未审、未实施"
---

# 默认窗 Conversation：session 窗口与 chat tab

> 需求：[PRD-016](../../docs/product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)（`proposed`）。  
> 形态决策：[ADR-002](../decisions/002-conversation-session-windows.md)（`proposed`）。  
> Agents 窗同 session 并排仍以 [ADR-001](../decisions/001-chat-compare-form.md) / [PRD-011](../../docs/product/requirements.md#prd-011-chat-并排比对) / [chat-compare-split](chat-compare-split.md) 为准，本方案不改。  
> 透镜页内 chrome：[conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)；「对话 | 轨迹」仍是 **每个 chat 页内** 透镜（PRD-012），不是与 chat tab 平级的第三条。  
> **规则 16：** 本会话无法派出 `claude-opus-5-thinking-high`（Task 允许 slug 仅 `composer-2.5` / `composer-2.5-fast` / `cursor-grok-4.6-high`）。**禁止**用其它模型顶替本门禁。方案保持 `draft`，**不得**标 `accepted`、不得开实施切片，直到 Opus 5.0 审查改稿。

**Goal：** 默认窗中间 Conversation 变成「session 窗口 + chat tab」：根/默认 chat 钉死；用户 Fork 默认加 tab；子代理默认在窗口内以对话框打开（父对话仍在底下），最大化才新建 tab；子代理 tab 顶有 agent 层级面包屑（点击替换当前延伸 tab）；每扇窗口一键关掉根以外的 tab；用户可 split；另一 session 用窗口并列；只能隐藏。

## 1. 选定与拒绝

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 宿主 | `CONVERSATION_PART` 内嵌 Conversation-scoped EditorPart / EditorGroup | 自研只懂 chat 的 tab 条；`ChatEditor` 占主 `EDITOR_PART`；默认窗 import `ChatGroupsView` |
| 打开路由 | 默认 `openEditor` → Preview；点名 Conversation 组才进中间 tab | 复用 Preview `SIDE_GROUP` 拆 fork；辅助 OS 窗当第二 Conversation |
| 一张 tab / 一扇窗 | 一扇 **session 窗口** = 一个 AH session；窗口内 tab = 该 session 的 chat | 用户 Fork = 新 AH 根会话（与引擎 `createChat({ fork })` 不符）；子代理自动当新根 |
| 同 session 呈现 | 用户 Fork **默认 tab**；用户 split → **同一扇窗口内** 两列，每列自己的 tab | fork 默认拆列（那是 Agents 窗 PRD-011）；fork 拆到 Preview |
| 窗口并列 | 展示 **另一个 session**；只能藏，藏后单窗口 | 窗口并列 = 同 session 的两 chat（与「fork 挂原根」混层） |
| 关 vs 藏 | 整块 Conversation、每个 session 的默认面、并列的另一 session 窗：**只藏不关** | 关闭 session / 关掉默认根 tab / 藏列时合并并丢掉 tab 模型 |
| Agent 子代理 | 仍在原 session；时间线可见；**默认点击 = 窗口内对话框**（盖在当前窗口上，父对话不卸）；**最大化才新建 tab** | 一点就开 tab；把阅读列换成子代理（钻入）；一 spawn 就开 tab 或开新 OS 窗 |
| 子代理 tab chrome | 页顶 **agent 层级面包屑**；点某一级切到该 agent，**当前延伸 tab 被替换**（不叠 tab） | 面包屑只展示不跳转；点层级再开一张 tab |
| 关延伸 tab | 每扇 session 窗口一颗 **关闭根以外全部 tab** 的按钮；根 tab 不动 | 没有批量关；把根 tab 一起关 |
| 页布局 | 每个 chat tab **与子代理对话框内** 相同：SessionBar（对话\|轨迹）+ 阅读列 + Dock | 对话\|轨迹与 chat tab 抢同一条 tablist |
| 导航 | tab 行 ←→ + 鼠标 4/5；Conversation 聚焦走 chat/对话框栈；Preview 聚焦走文件栈 | 两套历史混成一条 |
| 后退关子 tab | 设置默认开：后退弹出延伸 tab **或关掉对话框**，根/默认 tab 不动 | 后退关掉 session 窗口或整块 Conversation |
| 其它内容 | 预留：显式 `openEditor(..., conversationGroup)` | 第一期实现非 conversation 页；默认可把文件掉进中间 |

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| 中心叶是 `CONVERSATION_PART`，Editor 在 End Preview | [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) §2；`Layout.createGridDescriptor` |
| 「编辑器仅 `EDITOR_PART`」；凡 `EditorInput` 进某组 tab；**没有**打开到 Conversation 的插入面 | [editor-part-tabs](../../docs/systems/workbench/editor-part-tabs.md) §2 推论 |
| `SIDE_GROUP` / 组内 split **只**发生在 Preview 的 `EDITOR_PART` | 同上 §5 |
| 已有多 EditorPart：主 / 辅助窗 / 模态 | `IEditorGroupsService.parts`；`createAuxiliaryEditorPart`；`MODAL_GROUP` |
| Hide Conversation = `setConversationHidden`；会话不因此删除 | `layout.ts` `setConversationHidden`；PRD-001 验收 3 |
| Conversation 透镜单 session：SelectBox + 对话\|轨迹；无 chat tab | `conversationLens.ts` `mountSessionBar` |
| 用户 Fork（AH）：`createChat(session, newChat, { fork: { source, turnId } })`，**同一 session 的 peer chat** | `agentHostSessionHandler.ts` `_forkSession`；协议 `CreateChatParams`；`agentHostForkActions.ts` `_tryForkAsChat` |
| Peer 持久化：session 库 metadata `peerChats`；不新注册 `AgentSessionRegistry` 行；backing 打 I7 以免顶层 session 泄漏 | `agentService.ts` `PEER_CHATS_METADATA_KEY` / `_persistPeerChat`；`src/vs/platform/agentHost/AGENTS.md` I5/I7 |
| 工具子代理：`addChat` origin Tool；**不写** `peerChats`，重启从父 turn 再派生 | 同上 I4 / 5c |
| 本地非 AH Fork：`sessionId = generateUuid()` + `loadSessionFromData` | `chatForkActions.ts` — **不是**本产品 AH 权威 |
| Agents 窗已有 chat tab + `sessions.goBack/goForward` + 鼠标 4/5（`MOUSE_BACK_FORWARD_NAVIGATION_SETTING`） | `chatGroupsView.ts`；`sessionsMouseNavigation.ts`；仅 `IsSessionsWindowContext` |
| `workbench` 不得依赖 `sessions` | [LAYERS](../../docs/architecture/cross-cutting/layers.md)；M5 H7 |
| 组作用域前进后退已存在 | `IHistoryService` `GoScope.EDITOR_GROUP` |

## 3. 设计

### 3.1 几何与名词

```text
CONVERSATION_PART（整块只能藏，不能关）
│
├─ Session 窗口 A（AH session A；默认面只能藏）
│    [← →] [关非根 tab] [默认根📌] [fork tab…] [最大化后的子代理 tab…]
│    子代理默认点击 → 窗口内对话框（父对话仍在底下，无新 tab）；最大化 → 才变成延伸 tab
│    用户 split → A 内两组，仍是 A、仍是这一扇窗口
│
└─ 窗口并列（可选）→ Session 窗口 B（另一个 AH session，同样只能藏）
     藏 B → 单窗口 A；再打开 B 照常显示

EDITOR_PART（Preview）：默认 openEditor；与 fork/子代理无关
```

| 名词 | 是 | 不是 |
|------|----|------|
| session 窗口 | Conversation 里一块可见 session 面（一组或多组 EditorGroup，同属一个 session） | OS 辅助窗；Preview |
| chat tab | 该 session 的一个 `EditorInput`（默认 chat / 用户 Fork 的 peer / **最大化后**的子代理 chat） | 子代理默认对话框；Navigator session 行；对话\|轨迹透镜 tab |
| 窗口并列 | 两个 **session** 窗口并排 | 同 session 两 chat 的默认形态（默认是 tab；split 是用户动作） |
| 隐藏 | 不画；模型仍在 | dispose session、关默认 tab、把 tab 合并进另一组并丢掉 |

### 3.2 打开路由

新增 Conversation 组目标（名称实施时再钉，语义如下）：

| 调用 | 落到 |
|------|------|
| `openEditor` 无目标 / `ACTIVE_GROUP` 且焦点在 Preview | Preview |
| 点名 Conversation 组；用户 Fork | 当前 session 窗口的 **active 组** 新 tab（已打开则激活） |
| 用户点击子代理 | **窗口内对话框**：盖在当前 session 窗口上，**不加 tab、不换根页**；× / Esc 关掉对话框，父对话还在 |
| 子代理对话框 **最大化** | 当前窗口 **新建延伸 tab** 并激活；对话框关掉 |
| 用户 split / 拖 tab 到该窗边缘 | **当前 session 窗口内** `addGroup`，**不是** `SIDE_GROUP` |
| 打开另一个已有 session 到旁边 | 新 session 窗口（窗口并列）；该 session 的默认面 |
| 普通文件 / 未点名 Conversation | Preview |

校验：单测锁定「fork 资源不得出现在主 `EDITOR_PART` 的 tab 模型」。

### 3.3 同 session：Fork 默认 tab；子代理对话框 / 最大化才 tab

1. 用户 Fork → `forkChat` / `_forkSession`（已有）→ 当前 session 窗口 **加 tab** 并激活（不自动拆列）。
2. Agent spawn 子代理 → catalog 有 chat、时间线可点；**不加 tab、不弹对话框**。
3. 用户点击子代理 → **窗口内对话框**（对照截图那种盖在当前窗口上的内容卡：有 ×，父对话仍在底下未卸载；**不是** tab，也 **不是** 把阅读列换成子代理页）。对话框内仍是同一套透镜（对话\|轨迹 + 阅读列 + Dock）。不是 workbench `MODAL_GROUP`（那是设置）。
4. 对话框上的 **最大化** → 将该子代理 **提升为延伸 tab** 并激活；对话框关掉。已有同一 chat 的 tab 则激活已有 tab，不重复开。
5. 用户 split（命令、拖 tab 到边缘）→ 该 session 窗口内两列；每列独立 tab 条；比对上限若做，对齐 PRD-011 的 2，且只约束「比对类」入口，手动拖拽不限（与 ADR-001 验收 6 同构，但是 **默认窗、同 session 窗内**，不调用 `sessions/`）。
6. 关延伸 tab ≠ 藏窗口。默认根 tab 无关闭控件。
7. 每扇 session 窗口一颗 **关闭根以外全部 tab** 按钮：关掉该窗（含 split 两列）里除默认根 tab 外的所有 chat tab；若对话框开着则一并关掉。无延伸 tab 且无对话框时按钮 disabled。根 tab 与 session 窗口本身不动。

### 3.3a 子代理 tab 的面包屑

仅当子代理 **已经是 tab**（最大化之后）时，页顶 SessionBar 下（或 SessionBar 内第二行）显示 **agent 层级面包屑**：`根会话 > … > 父代理 > 当前子代理`。数据来自 chat `origin` 链（`ChatOriginKind.Tool` 的 `parentChat` 一直走到默认根 chat）。

- 点某一级：**切到该 chat**。若目标是默认根 → 关闭（替换掉）当前这张子代理延伸 tab，激活根 tab。若目标仍是树上某一子代理 → **用目标 chat 替换当前延伸 tab**（同一 tab 槽换 input，不新开、不留下旧子代理 tab）。
- 当前项不可点或 aria-current。中间断裂（父 chat 已删）诚实省略或停在最近仍存在的祖先，不造假节点。
- 用户 Fork 出的 peer tab **不**强制面包屑（fork 不是 tool 层级）；若 origin 有 `parentChat` 可显示「从某 turn fork」，不走 agent 层级替换规则。

### 3.4 窗口并列与隐藏

- **藏整块中间**：现有 `setConversationHidden`。所有 session 窗口一起不画；再 `showConversation` / 打开某 session → Conversation 可见，tab 模型恢复。
- **藏并列的另一 session 窗**：该窗不画，留下的 session 窗铺满；被藏 session 仍在 roster；再打开则按藏前的窗口几何与 tab 恢复。
- **藏 session 窗口内的一列**（用户 split 之后）：该列不画，回到该 session 的单列；该列 tab 仍属该 session，不是关 tab。
- 不提供「关闭 session」。删除会话仍走现有 Delete（stub / 将来引擎），与隐藏正交。

### 3.5 导航与设置

- tab 行最左 ← →：当前 **session 窗口** 内 chat 历史（含 split 两列之间的激活记录，若实现成本高则第一期只走 tab 激活序）。
- 鼠标 4/5：Conversation 聚焦且 `workbench.editor.mouseBackForwardToNavigate` 为真时走同一栈；`hasFocus(EDITOR_PART)` 时不抢 Preview（对齐 `sessionsMouseNavigation.ts` 的互斥，但默认窗要在 Conversation 聚焦时 **接管**，不能只交给 `IHistoryService` 的编辑器监听）。
- 设置（默认 true）：`conversation.navigate.closeChildOnBack`（id 实施时与配置贡献点对齐）——后退时若离开的是 **延伸 tab** 或 **子代理对话框**，则关掉该 tab / 关掉对话框；默认根 tab 从不因此关闭。设置 false 则只激活历史项，延伸 tab 仍留在条上。
- 面包屑跳转计入同一条历史栈（可后退回被替换前的子代理）。「关闭根以外全部 tab」清延伸 tab 并关掉对话框，并清空这些 tab 对应的历史项。

### 3.6 页内透镜

每个 chat 页自己的「对话 | 轨迹」状态。切 tab 不串透镜。SessionBar 是页 chrome，不是第二套 chat tab。窄宽度已有 300px 透镜 tab 测试；chat tab 独立一行（设计选定 A），有子 tab或用户 split 时再显示 chat tab 行。**开着子代理对话框不单独撑出 tab 行**（根页还在底下）。仅默认根且未 split 时可藏 chat tab 行（`shouldShowChatTabs` 同构）。推荐 **仅当存在延伸 tab 或第二组时显示 tab 行**，避免空会话多一行。

### 3.7 分层与引擎

- UI 与 EditorPart 宿主：`workbench`（`parts/conversation` + `contrib/conversation` + 必要的 `editorParts` 扩展）。
- Chat 身份与 fork 存储：Agent Host（`peerChats`）。默认窗 **不** 经 `ISessionsService`。
- 无引擎：stub session 先当「一个 session 窗口 + 一张默认 tab」。fork tab、子代理对话框/最大化依赖 PRD-008 或显式 stub chat fixture；未接线时不假装已 fork / 已有子代理。
- 其它 EditorInput：注册面预留；第一期 resolver 只让 conversation 类 input 默认进 Conversation 组。

## 4. 实施切片（审查通过前不开）

| # | 切片 | 内容 | 验证 |
|---|------|------|------|
| S1 | 插入面 | Conversation-scoped EditorPart；单 session、单组、钉死默认 tab；透镜仍填 pane | 打开文件仍只在 Preview；Conversation 组有且仅有 stub 默认 input；分层检查 |
| S2 | 导航 | ←→、鼠标 4/5、`closeChildOnBack` | 单测历史栈；Conversation vs Preview 分栈 |
| S3 | 同 session | Fork → 加 tab；子代理点击 → 对话框不加 tab；最大化 → 新建 tab | 单测打开目标；AH 路径不写新 `AgentSessionRegistry` 行 |
| S3b | 面包屑 + 关非根 | 子代理 tab 顶 origin 链面包屑；点击替换当前延伸 tab；每窗一键关非根 tab | 单测替换不叠 tab；根 tab 仍在 |
| S4 | 同窗 split | 用户 split / 拖边缘；藏列=不画 | 单测组数；文件 `SIDE_GROUP` 不增加 Conversation 组 |
| S5 | 窗口并列 | 第二 session 窗口；藏窗恢复 | roster 打开到旁边；藏后单窗；再打开几何恢复 |
| S6 | 知识层 | 签收后改 parts-and-grid / editor-part-tabs / agent-ui INV-TOPO 表述 | `check-docs-health.py` |

S1 可在无引擎下落地。S3 / S3b 活数据依赖 PRD-008。每个实施 commit 满足 DOCUMENTATION 规则 3a/3b。

## 5. 测试计划

1. **路由：** `openEditor(file)` → 主 EditorPart；conversation input 无 Preview tab。
2. **钉死：** 默认根 tab 无 close；隐藏 Conversation 再显示，同一 input 仍在。
3. **Fork：** AH `createChat` 后 catalog 多一条 origin Fork；registry session 数不变；UI 多一 tab。
4. **子代理：** spawn 不加 tab；点击后弹出窗口内对话框且 tab 数仍 1（仅根）；根页仍在对话框底下；最大化后 tab 数 2；再点面包屑祖先 → 延伸 tab 被替换，不叠第三张。
5. **关非根：** 两张延伸 tab 时点按钮 → 只剩根 tab；对话框开着点按钮 → 关掉对话框且无延伸 tab。
6. **Split：** 同 session 组数 +1；`SIDE_GROUP` 只影响 Preview 组数。
7. **窗口并列：** 两 session 可见；藏第二窗后可见 session=1；再打开恢复。
8. **导航：** 开延伸 tab → 后退（设置开）→ tab 关闭且回到根；设置关则 tab 仍在。对话框开着后退则关掉对话框。
9. **分层：** `valid-layers-check`；conversation contrib 无 `vs/sessions` import。

## 6. 风险与开放点

| 风险 | 缓解 |
|------|------|
| 嵌 EditorPart 与 INV-TOPO 文档字面冲突 | ADR-002 收窄 INV-TOPO；S6 改知识层；测试锁 ChatEditor 不进 Preview 中心 |
| `IEditorGroupsService` 多 part 的焦点 / 历史 / DND 泄漏到 Preview | Conversation part 独立 `windowId` 或等价隔离；鼠标互斥学 sessions 但默认窗要接 Conversation 焦点 |
| stub 只有 session 没有 chat | S1 只钉默认 tab；S3 等引擎或加 stub chat，禁止用「再造一个 stub session」冒充 fork |
| 与 PRD-011 用户心智不一致（Agents 窗 fork 默认并排） | 文档写明宿主不同；默认窗 fork 默认 tab，split 是显式手势 |
| SessionBar SelectBox 与多窗口并列重复 | 开放：第一期并列以 roster「打开到旁边」为准；SelectBox 仍切 **当前窗** 的 session，不删（PRD-002）直到 S5 验收后再收 |
| 对话框与 EditorInput 双模型 | 对话框是窗口 overlay（根 tab/页仍在底下）；最大化才 `openEditor` 延伸 input。单测锁「点击后 `group.count === 1`」。不走 `MODAL_GROUP`。 |
| 模态 Settings 已是第四类 EditorPart | Conversation part 不要走 `MODAL_GROUP` |

**开放点（不阻塞方案正文）：** Conversation 组是否允许 N>2（用户手动）；第一期建议手动不限、产品比对入口若做则上限 2。第二 session 窗口是否共享同一 EditorPart 的两组（每组绑不同 session）还是两个 scoped part——实施 S1 时选 **同一 Conversation EditorPart、组绑定 sessionId**，避免再造 Part 枚举。

## 7. 验收对照

| PRD-016 验收（拟定） | 由谁满足 |
|----------------------|----------|
| 中间是 Conversation 多 tab，不是 Preview 里的 ChatEditor | S1 |
| 默认根不可关；整块与 session 窗只藏 | S1 / S5 |
| Fork 同 session 新 tab，非新根 | S3 |
| 子代理默认点击窗口内对话框、不加 tab；最大化才开 tab | S3 |
| 子代理 tab 面包屑点击替换当前延伸 tab | S3b |
| 每窗一键关闭根以外 tab | S3b |
| 用户 split 同窗两列 | S4 |
| 窗口并列是另一 session，可藏可再打开 | S5 |
| 前进后退 + 鼠标；默认后退关延伸 tab | S2 |
| 文件仍进 Preview | S1 |

## 8. 审查记录（规则 16）

2026-09-01：本会话派出 `claude-opus-5-thinking-high` 失败（Invalid model selection）。未用 Grok / Composer 顶替。保持 `draft`。同日改入：子代理默认窗口内对话框（非钻入）、最大化才 tab、面包屑替换延伸 tab、每窗一键关非根 tab。Opus 5.0 可用后再审、再改稿、再谈签收。
