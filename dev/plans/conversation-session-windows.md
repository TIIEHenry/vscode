---
title: "默认窗 Conversation：session 窗口与 chat tab"
type: plan
status: accepted
phase: N/A
updated: 2026-09-01
summary: "ConversationPart 每叶内嵌 IEditorPart；围栏 CONVERSATION_GROUP；自有导航栈；子代理叶内对话框；已签收；S1–S6 ReadyToImplement；未实施"
---

# 默认窗 Conversation：session 窗口与 chat tab

> 需求：[PRD-016](../../docs/product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)（`accepted`）。  
> 形态决策：[ADR-002](../decisions/002-conversation-session-windows.md)（`accepted`）。  
> Agents 窗同 session 并排仍以 [ADR-001](../decisions/001-chat-compare-form.md) / [PRD-011](../../docs/product/requirements.md#prd-011-chat-并排比对) / [chat-compare-split](chat-compare-split.md) 为准，本方案不改。  
> 透镜页内 chrome：[conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)；「对话 | 轨迹」是 **每个 chat 页内** 透镜（PRD-012，经 PRD-016 修正），不是与 chat tab 平级的第三条。  
> **签收：** 2026-09-01 用户签收。规则 16：Grok 4.6 High Block 已改入后产品签收（Opus 5.0 slug 不可用，未再派审查）。S1–S6 ReadyToImplement；未改 `src/`。

**Goal：** 默认窗中间 Conversation 变成「session 窗口 + chat tab」：根/默认 chat 钉死；用户 Fork 默认加 tab；子代理默认在窗口内以对话框打开（父对话仍在底下），最大化才新建 tab；子代理 tab 顶有 agent 层级面包屑（点击替换当前延伸 tab）；每扇窗口一键关掉根以外的 tab；用户可 split；另一 session 用窗口并列；只能隐藏。

## 1. 选定与拒绝

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 宿主 | `CONVERSATION_PART` 自管 session 窗口网格；每叶内嵌一个 Conversation `IEditorPart`（Modal 同款注册，非 Layout `Parts` 枚举） | 自研只懂 chat 的 tab 条；`ChatEditor` 占主 `EDITOR_PART`；默认窗 import `ChatGroupsView`；一组贴纸 `sessionId` 冒充窗口 |
| 打开路由 | 默认 `openEditor` / `ACTIVE_GROUP` / `SIDE_GROUP` → 主 `EDITOR_PART`；仅 `CONVERSATION_GROUP` / `CONVERSATION_SIDE_GROUP` / 具体 Conversation 组才进中间 | 复用 Preview `SIDE_GROUP` 拆 fork；焦点在 Conversation 时把文件开进中间；辅助 OS 窗当第二 Conversation |
| 一张 tab / 一扇窗 | 一扇 **session 窗口** = 一个 AH session；窗口内 tab = 该 session 的 chat | 用户 Fork = 新 AH 根会话（与引擎 `createChat({ fork })` 不符）；子代理自动当新根 |
| 同 session 呈现 | 用户 Fork **默认 tab**；用户 split → **同一扇窗口内** 两列，每列自己的 tab | fork 默认拆列（那是 Agents 窗 PRD-011）；fork 拆到 Preview |
| 窗口并列 | 展示 **另一个 session**；只能藏，藏后单窗口 | 窗口并列 = 同 session 的两 chat（与「fork 挂原根」混层） |
| 关 vs 藏 | 整块 Conversation、每个 session 的默认面、并列的另一 session 窗：**只藏不关** | 关闭 session / 关掉默认根 tab / 藏列时合并并丢掉 tab 模型 |
| Agent 子代理 | 仍在原 session；时间线可见；**默认点击 = 窗口内对话框**（盖在当前窗口上，父对话不卸）；**最大化才新建 tab** | 一点就开 tab；把阅读列换成子代理（钻入）；一 spawn 就开 tab 或开新 OS 窗 |
| 子代理 tab chrome | 页顶 **agent 层级面包屑**；点某一级切到该 agent，**当前延伸 tab 被替换**（不叠 tab） | 面包屑只展示不跳转；点层级再开一张 tab |
| 关延伸 tab | 每扇 session 窗口一颗 **关闭根以外全部 tab** 的按钮；根 tab 不动 | 没有批量关；把根 tab 一起关 |
| 页布局 | 窗口 chrome（SelectBox / ←→ / 关非根）+ 每个 chat 页相同的「对话\|轨迹」+ 阅读列 + Dock | 对话\|轨迹与 chat tab 抢同一条 tablist；每 tab 复制 SelectBox |
| 导航 | Conversation **自有**历史栈（tab + 对话框）；`IHistoryService` 只服务 Preview；鼠标 4/5 在 `hasFocus(CONVERSATION_PART)` 时拦截 | 两套历史混成一条；靠用户改 `workbench.editor.navigationScope`；`GoScope.EDITOR_GROUP` 当隔离 |
| 后退关子 tab | 设置默认开：后退弹出延伸 tab **或关掉对话框**，根/默认 tab 不动 | 后退关掉 session 窗口或整块 Conversation |
| 其它内容 | 第一期 **只** conversation 类 input；围栏落地前禁止任何文件/untitled/`ChatEditorInput` 进 Conversation 组 | 第一期实现非 conversation 页；默认可把文件掉进中间 |

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| 中心叶是 `CONVERSATION_PART`，Editor 在 End Preview | [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) §2；`Layout.createGridDescriptor` |
| 「编辑器仅 `EDITOR_PART`」；凡 `EditorInput` 进某组 tab；**没有**打开到 Conversation 的插入面 | [editor-part-tabs](../../docs/systems/workbench/editor-part-tabs.md) §2 推论 |
| `SIDE_GROUP` / 组内 split **只**发生在 Preview 的 `EDITOR_PART` | 同上 §5 |
| 已有多 EditorPart：主 / 辅助窗 / 模态 | `IEditorGroupsService.parts`；`createAuxiliaryEditorPart`；`MODAL_GROUP` |
| Hide Conversation = `setConversationHidden`；会话不因此删除 | `layout.ts` `setConversationHidden`；PRD-001 验收 3 |
| Conversation 透镜单 session：SelectBox + 对话\|轨迹；无 chat tab | `conversationLens.ts` `mountSessionBar` |
| 用户 Fork（AH） | 连接面 `createChat(session, chat, { fork: { source, turnId } })`；协议是 `CreateChatParams.source?: { kind: "fork", chat, turnId }`，**不是** `CreateChatParams.fork` | `src/vs/platform/agentHost/common/state/protocol/channels-chat/commands.ts`；连接类型 `IAgentCreateChatForkSource`；workbench 默认窗走 `_forkSession` / `IAgentConnection.createChat`。**不** import `src/vs/sessions/.../agentHostForkActions.ts`（该文件 `openChatToSide`，属 PRD-011） |
| 本地非 AH Fork | `sessionId = generateUuid()` + `loadSessionFromData` | `chatForkActions.ts` — **不是**本产品 AH 权威 |
| Peer 持久化 | session 库 metadata `peerChats`；不新注册 `AgentSessionRegistry` 行；backing 打 I7 | `src/vs/platform/agentHost/node/agentService.ts` `PEER_CHATS_METADATA_KEY` / `_persistPeerChat`；`src/vs/platform/agentHost/AGENTS.md` I5/I7 |
| 工具子代理 | `addChat` origin Tool `{ chat, toolCallId }`；**不写** `peerChats` | 同上 I4 / 5c；协议 `ChatOrigin` 在 `channels-chat/state.ts`（字段是 **`chat`**，不是 sessions 的 `parentChat`） |
| EditorPart 工厂 | HEAD 只有 main / auxiliary / modal 三种；`EditorGroup` **无** sessionId | `editorParts.ts` `createMainEditorPart` / `createAuxiliaryEditorPart` / `createModalEditorPart` |
| 未指定目标的 `openEditor` | 落到 `editorGroupService.activeGroup`（焦点在 Conversation 组时会把文件开进该组，除非加围栏） | `editorGroupFinder.ts` |
| 默认导航栈 | `GoScope.DEFAULT` = 跨所有 editor/group；`EDITOR_GROUP` 仅当用户改 `workbench.editor.navigationScope` | `historyService.ts` |
| 鼠标 4/5 | 主窗 HistoryService 在每个 container 上监听，**无** Conversation 互斥 | `historyService.ts`；Agents 窗模式：`sessionsMouseNavigation.ts`（独立栈，**不可** import） |
| `workbench` 不得依赖 `sessions` | ESLint `code-import-patterns`（M5 H7）；`valid-layers-check` **不**查这条 | [layers.md](../../docs/architecture/cross-cutting/layers.md)；`m5-ui-shell-hardening.md` |

## 3. 设计

### 3.1 几何与名词（拓扑已选定，禁止再开放）

HEAD `EditorParts` 只工厂出 main / auxiliary / modal。`EditorGroup` **无** `sessionId`。`addGroup` 是 **一个** `IEditorPart` 内的扁平网格。因此 **禁止**「同一 Conversation EditorPart、组贴纸 sessionId」。选定 **Grok 拓扑 (a)**：

```text
CONVERSATION_PART（Layout `Parts` 枚举中心叶；整块只能藏）
│
├─ 窗口 chrome（Part 级，每扇 session 窗一份，不随 tab 复制）
│    藏窗 / ←→ / 关非根 tab / PRD-002 SelectBox（当前窗切 session）
│
└─ ConversationPart 自管 session 窗口网格（最多 2 叶；**不是** EditorGroup）
     │
     ├─ Session 窗口 A 叶（一个 AH session）
     │    └── Conversation EditorPart A（见下）
     │         └── SerializableGrid<EditorGroupView>   ← 仅同 session split
     │              └── ConversationChatInput → ConversationEditorPane
     │
     └─ 窗口并列（可选）→ Session 窗口 B 叶（另一个 AH session）
          └── Conversation EditorPart B（第二个 nested part）
               └── 同样只能藏；藏 B → 单窗口 A；再打开 B 按几何恢复

EDITOR_PART（Preview / MainEditorPart）：默认 openEditor、ACTIVE_GROUP、SIDE_GROUP
```

每个 Conversation EditorPart：

| 项 | 合同 |
|----|------|
| DOM 父 | 对应 session 窗口叶的 content 节点（`ConversationPart.createContentArea` 里 `.content` 之下的叶，**不是** `layoutService.mainContainer`，**不是** `Parts.EDITOR_PART`） |
| 工厂 | `EditorParts.createConversationEditorPart(parent, sessionKey)`（新 API，Modal 同款：register 到 `IEditorGroupsService.parts`） |
| Layout `Parts` | **不**新增枚举。中心叶仍是 `CONVERSATION_PART` |
| `windowId` | 与 `mainWindow.vscodeWindowId` **相同**（Modal 已 special-case；禁止伪造第二个 windowId） |
| scoped 服务 | **独立** scoped `IEditorService`（与 Modal 一样：共享 windowId 但不得与 Preview 共用同一 scoped 实例） |
| 组含义 | 该 part 内的组 = **这一扇 session 窗口**里的列。两扇 session 窗 = **两个** Conversation EditorPart，不是一组绑两个 sessionId |

`IConversationLensSlots`：Part 级 `timeline` / `dock` **退役**。S1 起阅读列与 Dock 由 `ConversationEditorPane` 填；窗口 chrome（含 SelectBox）留在 Part / session 叶，**不**复制到每个 tab。

| 名词 | 是 | 不是 |
|------|----|------|
| session 窗口 | ConversationPart 网格的一叶 + 其内嵌 Conversation EditorPart | OS 辅助窗；Preview；贴纸了 sessionId 的 EditorGroup |
| chat tab | 该 Conversation EditorPart 某组里的 `ConversationChatInput`（默认根 / 用户 Fork peer / **最大化后**的子代理） | 子代理默认对话框；Navigator session 行；对话\|轨迹透镜；`ChatEditorInput` |
| 窗口并列 | 两个 **session 叶**（两个 Conversation EditorPart） | ADR-001 形态 2（Agents 窗双 session 孪生）；同 session 两 chat 的默认形态 |
| 隐藏 | 不画；模型仍在 | dispose session、关默认 tab、`closeGroup` 根组 |

两扇可见 session 窗 **共享** 同一个 Preview / Sources / Panel（默认窗本来就只有一个 `EDITOR_PART`）。这 **不是** ADR-001 延后的孪生。第一期接受共享配套区；若某 session 因 worktree 隔离需要独立 working set，窗口并列对该 session **只允许 stub、不得当真并排**，直到另有 Preview-owner 规则。

### 3.2 打开路由与围栏

`PreferredGroup` **现在**命名（不要「实施时再钉」），接在 HEAD `-1…-4` 之后：

| 常量 | 值 | 落到 |
|------|----|------|
| `CONVERSATION_GROUP` | `-5` | 焦点所在 session 窗口的 Conversation EditorPart **active 组**（无焦点则当前可见的那一扇） |
| `CONVERSATION_SIDE_GROUP` | `-6` | 上述 part 内 `addGroup(activeGroup, …)`，**永不**调用 Preview `SIDE_GROUP` |

围栏强度对齐 Modal（`editorGroupFinder.ts`：未点名 `MODAL_GROUP` 不得进模态组）：

1. Conversation 组 **只**接受 conversation 类 input（新 `ConversationChatInput` / 未 typed 的 conversation 资源）。
2. 且 **只**在目标为 `CONVERSATION_GROUP`、`CONVERSATION_SIDE_GROUP`、或具体 Conversation `IEditorGroup` 时才进中间。
3. 文件 / untitled / diff / `ChatEditorInput` **永远**落到 `MainEditorPart`，即使 Conversation 组是 `activeGroup`。
4. 未指定目标与 `ACTIVE_GROUP`：若 `activeGroup` 是 Conversation 组，文件仍进 Preview；conversation input 无点名则 **拒绝**（不静默掉进 Preview，也不静默掉进中间）。
5. `SIDE_GROUP` **只**拆 Preview。`getGroups()` / `revealIfOpened` 不得把文件 reveal 进 Conversation part。
6. **禁止** `ChatEditorInput` 作为产品对话载体（默认窗 resolver 仍不注册；M5 `chatShellRouting.ts` 不变）。

| 调用 | 落到 |
|------|------|
| `openEditor` 无目标 / `ACTIVE_GROUP` / `SIDE_GROUP`（文件） | Preview |
| `openEditor(..., CONVERSATION_GROUP)`；用户 Fork | 当前 session 窗口 active 组新 tab（已打开则激活） |
| 用户点击子代理 | **该 session 叶上的对话框**（§3.3）；不加 tab |
| 子代理对话框 **最大化** | `openEditor(input, CONVERSATION_GROUP)` 延伸 tab；关掉对话框 |
| 用户 split / 拖 tab 到该窗边缘 | `CONVERSATION_SIDE_GROUP` / 该 Conversation EditorPart `addGroup` |
| 打开另一个已有 session 到旁边 | 新 session 叶 + 新 Conversation EditorPart；该 session 的默认面 |
| 点名 Conversation 组但 input 是文件 / `ChatEditorInput` | **拒绝并落到 Preview**（围栏 3） |

校验：单测锁定「fork / conversation 资源不得出现在主 `EDITOR_PART`」**以及**「文件 / `ChatEditorInput` 不得出现在任何 Conversation EditorPart」。

### 3.3 同 session：Fork 默认 tab；子代理对话框 / 最大化才 tab

1. 用户 Fork → 默认窗 workbench 调 `IAgentConnection.createChat` / `_forkSession`（`agentHostSessionHandler.ts`）→ `openEditor(ConversationChatInput, CONVERSATION_GROUP)` 加 tab 并激活（不自动拆列）。**不**走 `agentHostForkActions.ts` / `openChatToSide`。
2. Agent spawn 子代理 → catalog 有 chat、时间线可点；**不加 tab、不弹对话框**。
3. 用户点击子代理：
   - 若该 chat **已有**延伸 tab → 激活该 tab，**不**再开对话框。
   - 否则 → **session 叶 overlay**（§3.3 对话框合同）。
4. 对话框 **最大化** → `openEditor(..., CONVERSATION_GROUP)` 提升为延伸 tab；关掉 overlay。已有同一 chat 的 tab 则激活已有 tab。
5. 用户 split → `CONVERSATION_SIDE_GROUP`；该 session 窗口内两列；每列独立 tab 条；比对上限若做，对齐 PRD-011 的 2，且只约束「比对类」入口，手动拖拽不限（与 ADR-001 验收 6 同构，但是 **默认窗、同 session 窗内**，不调用 `sessions/`）。
6. 关延伸 tab ≠ 藏窗口。默认根 input **不是** pin/sticky（HEAD pin 仍可关、group lock 挡的是别的 editor）。须 **关闭拦截器**：隐藏 index-0 默认 chat 的关闭控件；拦截 `closeEditor` / 中键 / `closeAllEditors` / 关组，使默认根永不 `dispose`。关掉一列里最后一张非根 tab **不得** `closeGroup` 根组、不得拆掉 session 窗口。
7. 每扇 session 窗口一颗 **关闭根以外全部 tab** 按钮：关掉该窗（含 split 两列）里除默认根 tab 外的所有 chat tab；若对话框开着则一并关掉。实现 **不得** `closeGroup` 根所在组。无延伸 tab 且无对话框时按钮 disabled。根 tab 与 session 窗口本身不动。

**子代理对话框合同（overlay owner）：**

| 项 | 合同 |
|----|------|
| 父 DOM | **当前 session 叶**（盖住该 Conversation EditorPart 的内容区）。父根 pane **保持 mounted** |
| 不是 | `layoutService.mainContainer`（那是 `ConversationVisualizeOverlay`，全窗、盖住 Preview）；不是 `MODAL_GROUP` |
| 内容 | **瞬时第二份透镜实例**（对话\|轨迹 + 阅读列 + Dock），**不是** tab 模型里的 `EditorInput`，也不是 `ConversationEditorPane` 直到最大化 |
| 关闭 | × / Esc；`closeChildOnBack` 后退也关 |
| 与 visualize 叠放 | visualize 仍是 window-level、`aria-modal`、盖整个 `mainContainer`。z 序：visualize **高于**子代理对话框。Esc：先关最顶层（visualize 开着先关 visualize） |
| 与 Settings 模态 | 互不复用；Settings 仍走 `MODAL_GROUP` |

### 3.3a 子代理 tab 的面包屑

仅当子代理 **已经是 tab**（最大化之后）时，**页 chrome**（ConversationEditorPane 顶，SessionBar 窗口 chrome 之下）显示 **agent 层级面包屑**：`根会话 > … > 父代理 > 当前子代理`。

数据走 **协议** `ChatOrigin`（`channels-chat/state.ts`）：Tool `{ kind: Tool, chat, toolCallId }`、Fork `{ kind: Fork, chat, turnId }`。沿 **`origin.chat`** 走到该 session 的默认根 chat URI。**禁止**读 sessions 适配器的 `IChatOrigin.parentChat`（映射在 `baseAgentHostSessionsProvider.ts`，默认窗不得 import）。

- 点某一级：**切到该 chat**。若目标是默认根 → 关闭（替换掉）当前这张子代理延伸 tab，激活根 tab。若目标仍是树上某一子代理 → **用目标 chat 替换当前延伸 tab**（同一 tab 槽换 input，不新开、不留下旧子代理 tab）。
- 当前项不可点或 aria-current。中间断裂（父 chat 已删）诚实省略或停在最近仍存在的祖先，不造假节点。
- 用户 Fork 出的 peer tab **不**强制 agent 层级面包屑；若 origin 为 Fork 可显示「从某 turn fork」，不走 agent 层级替换规则。

### 3.4 窗口并列与隐藏

- **藏整块中间**：现有 `setConversationHidden`。所有 session 叶一起不画；再 `showConversation` / 打开某 session → Conversation 可见，tab 模型恢复。
- **藏并列的另一 session 窗**：卸下该叶（含其 Conversation EditorPart 不画，不 dispose 模型），留下的 session 叶铺满；被藏 session 仍在 roster；再打开则按藏前的窗口几何与 tab 恢复。
- **藏 session 窗口内的一列**（用户 split 之后）：该 Conversation EditorPart 内该组不画，回到该 session 的单列；该列 tab 仍属该 session，不是关 tab。
- 两扇可见窗共享 **一个** Preview / Sources / Panel。
- 不提供「关闭 session」。删除会话仍走现有 Delete（stub / 将来引擎），与隐藏正交。

### 3.5 导航与设置

**不**使用 `IHistoryService` / `GoScope.EDITOR_GROUP`。HEAD 默认 `editorNavigationScope = GoScope.DEFAULT`（跨所有 editor/group）；`EDITOR_GROUP` 只在用户改了 `workbench.editor.navigationScope` 时生效。把 Conversation 组登记进 `IEditorGroupsService` 却不隔离历史，会把 chat tab 并进全局 Alt+Left / 鼠标 4/5。

合同：

- Conversation **自有**导航栈（每扇 session 窗口一条；含 tab 激活与子代理对话框开/关）。实现放在 `workbench/contrib/conversation`（或 parts/conversation），**不是**改用户的 navigationScope。
- tab 行最左 ← → 驱动该栈。
- 鼠标 4/5：当 `hasFocus(Parts.CONVERSATION_PART)`（含内嵌 EditorPart DOM，仍在 Conversation container 内）且 `workbench.editor.mouseBackForwardToNavigate` 为真时 **拦截**，走 Conversation 栈；否则交给 `IHistoryService`（Preview）。模式抄自 `sessionsMouseNavigation.ts`，**禁止 import** 该模块。
- `IHistoryService` **只**服务 Preview / 主 `EDITOR_PART`。Conversation 组的 open/close **不得**写入默认 editor 历史栈（实施时从 history 监听排除 Conversation part，或根本不把 Conversation 组标成参与 editor history 的 part）。
- 设置（默认 true）：`conversation.navigate.closeChildOnBack`——后退时若离开的是 **延伸 tab** 或 **子代理对话框**，则关掉该 tab / 关掉对话框；默认根 tab 从不因此关闭。设置 false 则只激活历史项，延伸 tab 仍留在条上。
- 面包屑跳转计入同一条 Conversation 栈。「关闭根以外全部 tab」清延伸 tab、关掉对话框，并清空这些项对应的历史记录。

### 3.6 页内透镜与 chrome 分层

| 层 | 放什么 | 不放什么 |
|----|--------|----------|
| **窗口 chrome**（session 叶 / Part） | 藏、←→、关非根、PRD-002 SelectBox（切 **当前窗** session）、roster「打开到旁边」 | 对话\|轨迹；每 tab 再画一个 SelectBox |
| **页 chrome**（ConversationEditorPane / 对话框透镜） | 「对话 \| 轨迹」、阅读列、Dock、子代理 tab 面包屑 | 切 session |

每个 chat 页自己的「对话 | 轨迹」状态。切 tab 不串透镜。窄宽度已有 300px 透镜 tab 测试；chat tab 独立一行（设计选定 A），有延伸 tab 或用户 split 时再显示 chat tab 行。**开着子代理对话框不单独撑出 tab 行**。仅默认根且未 split 时可藏 chat tab 行（复制 `shouldShowChatTabs` **启发式**，**禁止** import `chatGroupsView.ts`）。推荐 **仅当存在延伸 tab 或第二组时显示 tab 行**。

PRD-012 原文把「对话 | 轨迹」钉在 Conversation **标题条**。本方案把它改成 **每个 chat 页 / 对话框** 的页 chrome；PRD-016 依赖里显式修正。SelectBox 仍是窗口级，满足 PRD-002。

### 3.7 分层、引擎、插入面合同

- UI 与 Conversation EditorPart 宿主：`workbench`（`parts/conversation` + `contrib/conversation` + `editorParts.ts` 扩展）。**禁止** `workbench/contrib/conversation` import `vs/sessions`（ESLint `code-import-patterns` / M5 H7）。`valid-layers-check` **不**查这条；仅当 S1 改目标环境边界时才跑它。
- Chat 身份与 fork 存储：Agent Host（`peerChats`）。默认窗 **不** 经 `ISessionsService`。
- 无引擎：stub session 先当「一个 session 窗口 + 一张默认 tab」。fork tab、子代理对话框/最大化依赖 PRD-008 或显式 stub chat fixture；未接线时不假装已 fork / 已有子代理。
- 第一期 **只** conversation 类 input。围栏落地前禁止「其它 EditorInput 预留进 Conversation 组」。

**插入面合同（写入本方案与 ADR-002；不是「S6 事后收窄 INV-TOPO」）：**

HEAD 已接受的锁是 **插入面**：编辑器仅 `EDITOR_PART`；没有「打开到 Conversation」的第三条面；Conversation 不是 editor pane。本决策把它改成：

1. Layout 中心叶仍是 `CONVERSATION_PART`，**不是**把 `Parts.EDITOR_PART` 搬回中心。
2. Conversation `IEditorPart` 是与 Modal/Aux **并列的第四类 editor 容器**，DOM 挂在 ConversationPart 内，**不是** `Parts.EDITOR_PART`。
3. 产品对话 input **禁止** `ChatEditorInput`；新 `ConversationChatInput` + `ConversationEditorPane`。
4. 默认窗仍不为 ChatEditor 注册 resolver（M5 不变）。
5. 知识层（`parts-and-grid` §5、`editor-part-tabs` §2/§4、`agent-ui` INV-TOPO）在 **本签收批**改写为选定合同。S1 落地后再把「选定、未实施」改成 HEAD 事实。**禁止** `ChatEditorInput`。

须改写或补断言的测试（签收后 S1）：

| 测试 | 怎么处理 |
|------|----------|
| `conversationLens.test.ts` `does not host the lens as ChatEditorInput` | **保留** ChatEditorInput 禁令；断言改为「透镜在 ConversationEditorPane，input 不是 ChatEditorInput」 |
| `chatEditorShellPaths.test.ts` 默认窗不打开 ChatEditorInput | **保持** |
| 新围栏测试 | 焦点在 Conversation tab 时 `openEditor(file)` / `SIDE_GROUP` 只进 MainEditorPart；`CONVERSATION_GROUP` + 文件被拒绝 |
| Part 级 `IConversationLensSlots` timeline/dock 测试 | 迁到 pane；窗口 chrome 测试只覆盖 SelectBox / 关非根 / ←→ |

## 4. 实施切片（ReadyToImplement）

| # | 切片 | 内容 | 验证 |
|---|------|------|------|
| S1 | 插入面 | `createConversationEditorPart`；单 session 叶、单组、关闭拦截器钉死默认 tab；透镜迁入 pane；`findGroup` 围栏；`CONVERSATION_GROUP` | 打开文件仍只在 Preview；Conversation 组有且仅有 stub 默认 input；无 `vs/sessions` import（ESLint）；ChatEditorInput 两边都不进 |
| S2 | 导航 | Conversation 自有栈；←→；`hasFocus(CONVERSATION_PART)` 鼠标拦截；`closeChildOnBack` | 单测两栈隔离；Conversation open 不写入 `IHistoryService` |
| S3 | 同 session | Fork → `createChat` + `CONVERSATION_GROUP`；子代理点击 → session 叶对话框；最大化 → tab | 单测打开目标；AH 路径不写新 `AgentSessionRegistry` 行；不 import `agentHostForkActions` |
| S3b | 面包屑 + 关非根 | 沿协议 `origin.chat`；点击替换当前延伸 tab；关非根 **不** `closeGroup` 根组 | 单测替换不叠 tab；根 tab 仍在 |
| S4 | 同窗 split | `CONVERSATION_SIDE_GROUP`；藏列=不画 | 单测组数；文件 `SIDE_GROUP` 不增加 Conversation 组 |
| S5 | 窗口并列 | 第二 session 叶 + 第二 Conversation EditorPart；藏窗恢复；共享 Preview | roster 打开到旁边；藏后单窗；两 session 时 Preview 仍一个 `EDITOR_PART` |
| S6 | 知识层 | 签收本批已改 parts-and-grid / editor-part-tabs / agent-ui 插入面合同；S1 落地后把 HEAD 句从「选定」改成「已落」 | `check-docs-health.py` |

S1 可在无引擎下落地。S3 / S3b 活数据依赖 PRD-008。每个实施 commit 满足 DOCUMENTATION 规则 3a/3b。知识层插入面合同已随签收改写；S1 改代码，不重开拓扑。

## 5. 测试计划

1. **围栏：** 焦点在 Conversation tab 时 `openEditor(file)` 与 `SIDE_GROUP` → 只进 `MainEditorPart`；`CONVERSATION_GROUP` + 文件被拒绝。conversation input 无 Preview tab。`ChatEditorInput` 两边都不进。
2. **钉死：** 默认根无关闭控件；`closeEditor` / 中键被拦截；隐藏 Conversation 再显示，同一 input 仍在；关非根 **不** `closeGroup` 根组。
3. **Fork：** AH `createChat` + `source.kind === "fork"` 后 catalog 多一条；registry session 数不变；UI 多一 tab。默认窗无 `agentHostForkActions` import。
4. **子代理：** spawn 不加 tab；点击后 session 叶对话框且 `group.count === 1`；根 pane 仍 mounted；已有 tab 再点则激活 tab 不开第二对话框；最大化后 tab 数 2；面包屑沿 `origin.chat`；点祖先 → 延伸 tab 被替换。
5. **关非根：** 两张延伸 tab 时点按钮 → 只剩根 tab；对话框开着点按钮 → 关掉对话框且无延伸 tab。
6. **Split：** 同 session Conversation EditorPart 组数 +1；文件 `SIDE_GROUP` 只影响 Preview 组数。
7. **窗口并列：** 两 session 叶、两个 Conversation EditorPart；共享一个 Preview；藏第二窗后可见 session=1；再打开恢复。
8. **导航：** Conversation 栈与 `IHistoryService` 隔离；开延伸 tab → 后退（设置开）→ tab 关闭且回到根；对话框开着后退则关掉对话框；Conversation 聚焦时鼠标 4/5 不驱动 Preview 历史。
9. **分层：** `workbench/contrib/conversation` 无 `vs/sessions` import（ESLint `code-import-patterns`）。仅 S1 改目标环境边界时才跑 `valid-layers-check`。

## 6. 风险与开放点

| 风险 | 缓解 |
|------|------|
| 第四类 EditorPart 与已接受 INV-TOPO 字面冲突 | §3.7 写入新插入面合同；签收时与 S1 同批改知识层；围栏测试锁文件/`ChatEditorInput` |
| 共享 `windowId` 的 scoped `IEditorService` | 抄 Modal special-case；禁止伪造 windowId |
| Conversation 组进入全局 editor 历史 | S2：自有栈；从 `IHistoryService` 排除 Conversation part |
| DND 跨 session 叶 / 拖到 Preview | S4/S5：禁止把 ConversationChatInput 拖进 MainEditorPart；禁止把文件拖进 Conversation 组 |
| stub 只有 session 没有 chat | S1 只钉默认 tab；S3 等引擎或加 stub chat，禁止用「再造一个 stub session」冒充 fork |
| 与 PRD-011 用户心智不一致 | 宿主不同；默认窗 fork 默认 tab，split 是显式手势 |
| SelectBox 与窗口并列 | SelectBox 只切 **当前叶** session（PRD-002）；并列入口是 roster「打开到旁边」 |
| 对话框与 EditorInput 双模型 | overlay = 瞬时透镜，不进 tab 模型；最大化才 `openEditor` |
| visualize 与子代理对话框双 Esc | z 序 visualize 在上；Esc 关最顶层 |
| 两 session 共享 Preview | 第一期接受；worktree 隔离 session 不得当真并排，直到 Preview-owner 规则 |

**仍开放（不阻塞正文、也不许再开放已锁拓扑）：** Conversation 组用户手动 N>2；第一期手动不限、产品比对入口若做则上限 2。

## 7. 验收对照

| PRD-016 验收 | 由谁满足 |
|----------------------|----------|
| 中间是 Conversation 多 tab，不是 Preview 里的 ChatEditor | S1 |
| 默认根不可关（拦截器，非 pin）；整块与 session 窗只藏 | S1 / S5 |
| Fork 同 session 新 tab，非新根 | S3 |
| 子代理默认点击 session 叶对话框、不加 tab；最大化才开 tab | S3 |
| 子代理 tab 面包屑沿 `origin.chat`；点击替换当前延伸 tab | S3b |
| 每窗一键关闭根以外 tab（不 closeGroup 根组） | S3b |
| 用户 split 同窗两列（`CONVERSATION_SIDE_GROUP`） | S4 |
| 窗口并列是另一 session 叶 + 第二 EditorPart，共享 Preview，可藏可再打开 | S5 |
| Conversation 自有栈 + 鼠标拦截；默认后退关延伸 tab | S2 |
| 文件 / `SIDE_GROUP` / `ChatEditorInput` 仍进 Preview | S1 |

## 8. 审查记录（规则 16）

2026-09-01：Grok 4.6 High 只读审查 → **Block**（审查 id `878b1cb4-5930-44e3-88b2-183077912462`）。

Critical 已改入：Conversation EditorPart 工厂 + session 叶在组之上；`CONVERSATION_GROUP`/`CONVERSATION_SIDE_GROUP` 与 Modal 级围栏；Conversation 自有导航栈（弃 `GoScope.EDITOR_GROUP`）；协议 `origin.chat` / `CreateChatParams.source`；插入面合同写入方案而非「S6 收窄」。Important 已改入：对话框 DOM/z 序；窗口 vs 页 chrome 与 PRD-012 修正；窗口并列非 ADR-001 孪生、共享 Preview；关闭拦截器；ESLint 分层门；默认窗 fork 不走 `agentHostForkActions`。

方案 `accepted`（2026-09-01 用户签收）。末次只读审查为 Grok Block，Critical/Important 已改入后签收；未再派 Opus。S1–S6 ReadyToImplement；未改 `src/`。
