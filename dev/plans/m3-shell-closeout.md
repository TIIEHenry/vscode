---
title: "M3 壳收尾：ChatEditor 默认路径与 Navigator 会话列表"
type: plan
status: proposed
phase: M3
updated: 2026-08-31
summary: "可选 follow-on：藏/转 ChatEditor 默认打开路径；Navigator stub 会话列表。无引擎。不阻塞无引擎产品壳。"
---

# M3 壳收尾（无引擎，可选）

> **前置**：[m0-topology-surgery.md](m0-topology-surgery.md) · [m1-shell-followon.md](m1-shell-followon.md) · [m2-product-shell.md](m2-product-shell.md)（均 `implemented`）。  
> **决策**：外仓 [ADR-061](https://github.com/TIIEHenry/UniverseAgentDesktop/blob/main/dev/decisions/061-code-oss-base-and-editor-window-shell.md) 决策 5 复用清单（只读）：会话列表侧边栏（sessions viewlet / `agentSessions` 控件族）。  
> **本仓事实**：[agent-ui](../../docs/systems/chat/agent-ui.md) · [views-and-composites](../../docs/systems/workbench/views-and-composites.md) · [desktop-shell-mapping](../../docs/reference/code-oss-b2/desktop-shell-mapping.md) · [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md)

**Goal：** 收掉 M2 之后仍让默认窗看起来像 vanilla Copilot Chat、或仍留 **INV-TOPO 洞** 的壳项：默认路径不得把 Conversation 打开成 `EDITOR_PART` tab；Navigator（Sidebar）有一份 stub 会话 roster。仍 **不接** UniverseAgent 引擎。

**Architecture：** 继续只动默认 Code 窗口 chrome / 打开路径。中心透镜仍是 `ConversationPart` + `contrib/conversation` stub 产品面。`ChatWidget` / `ChatEditor` **源码保留**（donor）。会话列表是 Sidebar 里的 **roster**，不是第二块 Conversation，也不是 `IChatModel`。

> **相对 M2 的地位（本方案拍板）：** [M2 产品完成线](m2-product-shell.md) 已经把「没有引擎」前提下的 ADR-061 编辑器窗口产品壳写完整：中心透镜可操作、Aux 出厂 hidden、Chat 非 Aux default、知识层诚实。本 M3 **不是** 无引擎方案的阻塞出口，只是 **chrome / INV-TOPO 卫生 follow-on**。两切片可独立落地，也可整波搁置；不验收、不排期也不等于壳没做完。compile / 启动 / EH 仍是 D3–D5，本波不勾。

## 全局约束

- 不碰 UniverseAgent 引擎、gRPC、adapter、session-core（INV-UA-TRUTH）。
- 不把 `IChatModel` / Copilot entitlement / `chatSetup` 提成会话真相（INV-NO-COPILOT）。
- 不改 `vs/sessions`；禁止 workbench 反向 import sessions。
- 不改 `product.json` 身份。不迁 ADR-003 token。不接 Open VSX。
- **不碰 Diff 深查看路由 / Sources Changes tab**（M2 已 PARKED FORK）。
- 不改 `layout.ts` 的 `createGridDescriptor` / `arrangeMiddleSectionNodes` / 互斥公式。
- 不删 `ChatWidget` / `ChatEditor` / `ChatEditorInput` 源文件（donor 与 EH 对照仍要）。
- 两切片 **禁止并行改同一文件**。本方案 **不** 勾 D3–D5。
- 分层：`workbench/browser` 不得 import `workbench/contrib`。

---

## M0 + M1 + M2 已落地（本波不再做）

| 项 | HEAD 事实 |
|----|-----------|
| 拓扑 | `ConversationPart` 中心；End 上 `EDITOR_PART`、下 `SOURCES_PART`；`Conversation ∨ (Editor ∨ Sources)` |
| 四钮 | titlebar `LayoutControlMenu`：Nav / Conversation / Preview / Sources |
| 透镜 | stub 多会话切换、turn 列表、本地 Dock、Inbox 诚实空、Allow/Skip 本地状态 |
| Aux | 出厂 `hidden`；Chat 容器 `isDefault: false`；`ChatViewPane` 仍可命令打开作 donor |
| 中心不是 ChatEditor | 单测已锁 `CONVERSATION_PART ≠ ChatEditorInput` |
| 文档 | M2 切片 3 已按代码诚实；Changes/Diff FORK、引擎、D3–D5 仍标明缺口 |

合入锚点：M0 `b5631393` · D7 `2dcd5a0a` · M1 透镜 `4f3fef65` · Files `156f0fe5` · M2 透镜 `7822d430` · Aux `9b34c1b6` · 文档 `221e8823`。

## 对照：M2「仍 deferred」与切片 2「本切片明确不做」

摘自 [m2-product-shell.md](m2-product-shell.md)：

| M2 明确留下 | M3 |
|-------------|----|
| 把 `ChatEditor` 从编辑器注册表删除（切片 2「明确不做」） | **不做删除。** 做 **默认打开路径** 的藏/转，堵住 INV-TOPO 洞 |
| 会话列表侧边栏（ADR-061 决策 5 复用清单；M2 只做了 SessionBar 切换器） | **做 Navigator stub roster**；不是第二 Conversation，不是 `IChatModel` |
| 引擎 / Diff FORK / Changes / `product.json` / Open VSX / `vs/sessions` / D3–D5 | **整波仍排除** |

M2 出口句「用户打开默认窗，中心是 Conversation 透镜，不是 `ChatEditor` tab」在 **启动默认路径** 上已经成立（中心 Part ≠ EditorInput）。剩下的洞是：**命令 / URI resolver / 工作区还原 /「New Chat Editor」仍能在 End Preview 开出一张 Copilot Chat tab**。那是 chrome 卫生，不是「产品壳还没完整」。

---

## 推荐顺序（恰好 2 切片，均可选）

顺序 = 先堵 INV-TOPO 默认路径，再补 Navigator roster。两切片无运行时硬依赖；文件表互斥。

### 切片 1 — ChatEditor 默认路径藏/转（INV-TOPO）

**做什么：** 默认编辑器窗口里，**产品路径不得把对话打开成 `EDITOR_PART` tab**。`ChatEditor` / `ChatEditorInput` **继续注册、源码保留**；`ChatWidget` **不删**。最小责任面 = 藏菜单/命令调色板入口 + 把仍会 `openEditor(ChatEditorInput)` 的默认路径转到已有 Conversation 透镜（或 no-op 并露出 `CONVERSATION_PART`）。

**现状（HEAD）：**

| 路径 | 代码锚点 | 为何算 INV-TOPO 洞 |
|------|----------|-------------------|
| Command Palette「New Chat Editor」 | `chatActions.ts` `ACTION_ID_OPEN_CHAT` = `workbench.action.openChat` → `widgetService.openSession(..., ACTIVE_GROUP)` | 主动在 End 列开 Chat tab |
| 「Move Chat into Editor Area」 | `chatMoveActions.ts` `workbench.action.chat.openInEditor` | 把 donor ChatView 搬进 editor |
| URI resolver | `chat.shared.contribution.ts` `ChatResolverContribution` 把 `vscodeChatEditor` / `vscodeLocalChatSession` 注册给 `ChatEditorInput` | 任何该 scheme 的 `openEditor` 都变 tab |
| 工作区还原 | `ChatEditorInputSerializer`（同文件 `registerEditorSerializer`） | 上次开过的 Chat tab 会回来 |
| agentSessions「在编辑器组打开」 | `OpenAgentSessionInEditorGroupAction` | 会话列表点开 → ChatEditor（切片 2 不得走这条） |

`workbench.action.chat.open`（`CHAT_OPEN_ACTION_ID`）走 `revealWidget()` → `ChatViewPane`，那是 M2 已卫生过的 Aux donor，**不是**本切片对象。中心非 `ChatEditorInput` 的透镜单测 **保持**，不要改成「注册表里没有 ChatEditor」。

**选定路径（三刀，缺一不可；都不删 pane 注册）：**

1. **命令：** `workbench.action.openChat` / `workbench.action.chat.openInEditor`（及同文件里只为「再开一张 ChatEditor」服务的 `ACTION_ID_OPEN_CHAT.*` 变体）`f1: false`（或 `precondition` 在默认窗永远假），`run()` 改为 `IWorkbenchLayoutService.setPartHidden(false, Parts.CONVERSATION_PART)`（必要时 `focus` Conversation）。禁止 `editorService.openEditor` / `openSession(..., ACTIVE_GROUP)`。
2. **还原：** `ChatEditorInputSerializer.canSerialize` 对默认窗返回 `false`（或 serializer 不再注册）。已打开的 donor 调试窗不依赖工作区还原 Chat tab。
3. **Resolver：** `ChatResolverContribution` **不要再**为 `Schemas.vscodeChatEditor` / `Schemas.vscodeLocalChatSession` 注册 `RegisteredEditorPriority.builtin` 的 ChatEditor。`ChatDebugEditor` resolver **留下**（不是 Conversation）。`registerEditorPane(ChatEditor, ChatEditorInput)` **留下**，这样显式 donor / 测试仍能 `createInstance(ChatEditorInput)`。

`OpenAgentSessionInEditorGroupAction`：本切片把它的默认窗 `f1`/菜单藏掉或 `run()` 同样转到 Conversation；不要在这里重写 agentSessions 模型。切片 2 的 roster **禁止**调用该 action。

**不选：** 从 `EditorPane` 注册表删除 `ChatEditor`；删除 `chatEditor.ts` / `ChatWidget`；改 `revealWidget` 去开 Conversation（会误伤 ChatViewPane donor）；改 `layout.ts`；把 Chat 容器挂到 `CONVERSATION_PART`（ViewContainer 进不了中心 Part）。

**Likely files（本切片独占）：**

| 路径 | 角色 |
|------|------|
| `src/vs/workbench/contrib/chat/browser/actions/chatActions.ts` | `NewChatEditorAction` 族：藏 + 转 Conversation |
| `src/vs/workbench/contrib/chat/browser/actions/chatMoveActions.ts` | `openInEditor`：藏 + 转 |
| `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts` | serializer 拒绝还原；`ChatResolverContribution` 不再把 chat session scheme 送进 `EDITOR_PART`。**只改这三处逻辑**，禁止顺手改 Copilot setup / entitlement |
| `src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsActions.ts` | 仅 `OpenAgentSessionInEditorGroupAction`（及明显的 New Editor Group 变体）默认窗藏/转 |
| `src/vs/workbench/contrib/chat/test/browser/widgetHosts/editor/chatEditorShellPaths.test.ts`（或同等新测） | 断言：上述 command id 的 `run` 不产生 `ChatEditorInput`；serializer `canSerialize` 为 false；resolver 不再认 `vscodeChatEditor`。可继续用现有 `ChatEditorInput` 单测证明类仍存在 |

落地时把 [agent-ui.md](../../docs/systems/chat/agent-ui.md) §3 的「代码里已存在，改造时要避免默认打开 chat 走 editor」改成现在时：**默认路径已藏/转；pane 仍注册；ChatWidget 仍 donor**。不要把「已从注册表删除」写进去。

**本切片明确不做：** 删 `ChatWidget` / `ChatEditor` 文件；动 `contrib/conversation`；动 `contrib/sources`；动 `layout.ts`；改 ChatViewPane / Aux 默认（M2 已做）；引擎；`product.json`。

---

### 切片 2 — Navigator 会话列表侧边栏（ADR-061 stub roster）

**做什么：** 在 **Sidebar（Navigator）** 放一份 **本地 stub 会话列表**，对齐 ADR-061 决策 5「明确进复用清单：会话列表侧边栏」。点一项 = 切换 **已有** Conversation 透镜的当前 stub 会话。它是 roster，**不是** 第二块 Conversation，**不是** `IChatModel` / `IAgentSessionsService` 真相。

**对照：**

| 面 | 今天 | 本切片 |
|----|------|--------|
| SessionBar | `contrib/conversation` 下拉切 `untitled` / `tour` / `blank`；`ConversationLens` **私有** `new ConversationStubModel()` | 同一份 stub 模型提升为 conversation contrib 内可共享的内存服务；SessionBar 继续切 |
| Sidebar | Explorer 默认容器；无产品会话 roster | 非 default 的 Sessions 列表视图；列出同一批 stub 会话 |
| `agentSessions` 控件族 | Copilot 会话目录 + `agentSessionsOpener` → 经常 `ChatEditor` | **不接入。** 不复用 opener，不把 `AgentSessionsControl` 整块搬进 Sidebar（那会变成第二 Chat） |
| Desktop Navigator | roster 换成产品 tab（[desktop-shell-mapping §2](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)） | 最小：Sidebar 里多一个可开的 Sessions 列表。**不**把 Explorer 从 default 换成它 |

**选定路径：**

1. 把 `ConversationStubModel` 从 `ConversationLens` 私有实例提升为 `contrib/conversation` 内的进程内服务（`IConversationStubService` 或同等；**不要**放到 `workbench/browser`，避免 browser→contrib）。种子仍是 M2 的 `untitled` / `tour` / `blank`。刷新不持久化。
2. 新 `ViewPane`（建议 id `workbench.view.conversationSessions`）注册到 **Sidebar** 新 `ViewContainer`（`isDefault: false`，Explorer 仍是 Sidebar default）。列表渲染要朴素（标题 + 当前标记），风格可像 `contrib/sources` 的 Files 列表，**不要**嵌 `ChatWidget` / `ChatViewPane`。
3. 点击 / 键盘激活 → `switchSession(id)` 并确保 `CONVERSATION_PART` 可见。禁止 `IEditorService.openEditor`、禁止 `OpenAgentSessionInEditorGroupAction`、禁止 `IChatService`。
4. SessionBar 与 Sidebar 列表共用同一服务：一边切，另一边高亮跟着变（`Event` 即可）。

**不是方案分叉：** ViewContainer 进 Sidebar 合法（views-and-composites §2）。Conversation 仍然只住 `CONVERSATION_PART`（同页 §4）。本切片加的是 Navigator **配套 roster**，与 Explorer / SCM 同类，不是中心透镜。

**Likely files（本切片独占）：**

| 路径 | 角色 |
|------|------|
| `src/vs/workbench/contrib/conversation/browser/conversationStubModel.ts` | 加 `onDidChangeActive` / `onDidChangeSessions`（若列表要反映 title） |
| `src/vs/workbench/contrib/conversation/browser/conversationStubService.ts` | **新建** 进程内单例；种子 + `switchSession` / `getSessions` |
| `src/vs/workbench/contrib/conversation/browser/conversationLens.ts` | 改用共享服务，不再 `new ConversationStubModel()` |
| `src/vs/workbench/contrib/conversation/browser/conversationSessionsView.ts` | **新建** Sidebar `ViewPane` 列表 |
| `src/vs/workbench/contrib/conversation/browser/conversation.contribution.ts` | 注册 Sidebar `ViewContainer` + view；`isDefault: false` |
| `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css`（或旁路 `conversationSessions.css`） | 列表选中态 |
| `src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts` | 扩：服务与透镜共用当前会话 |
| `src/vs/workbench/contrib/conversation/test/browser/conversationSessionsView.test.ts` | **新建**：容器 location = Sidebar 且非 default；点击不构造 `ChatEditorInput`；零 `IChatModel` |

落地时改 [agent-ui.md](../../docs/systems/chat/agent-ui.md) §2 复用清单一句为现在时（Navigator stub roster 已挂 Sidebar，仍非 `IChatModel`）；[views-and-composites.md](../../docs/systems/workbench/views-and-composites.md) 补一句：产品会话列表是 Sidebar View，不是 Conversation Part；[desktop-shell-mapping.md](../../docs/reference/code-oss-b2/desktop-shell-mapping.md) Navigator 行写清 Explorer 仍权威、Sessions roster 为 stub。

**本切片明确不做：** 把 `AgentSessionsControl` / `IAgentSessionsService` 当数据源；在 Sidebar 再开一个 Chat；持久化 stub；改 Explorer `isDefault`；改 `layout.ts` / `conversationPart.ts` 槽数；碰 `contrib/chat`（切片 1 独占）；`vs/sessions`。

---

## 整波排除（Out）

- UniverseAgent 引擎 / gRPC / adapter / Device Grant / session-core。
- Diff 深查看改绑（ADR-047 FORK）与 Sources **Changes** tab（ADR-051）。
- Open VSX、`product.json` 身份、ADR-003 token 全量迁 CSS。
- 任何 `src/vs/sessions/` 编辑。
- D3 compile / D4 启动演示 / D5 EH 探针。
- 把生产入口改成 Agents Window；Zen Mode 产品语义。

---

## 切片文件互斥（实施门闩）

| 切片 | 可改 | 禁止碰 |
|------|------|--------|
| 1 ChatEditor 默认路径 | 上表 `contrib/chat` 的 actions / shared.contribution / agentSessionsActions（仅 Editor-group 打开）+ 对应测试 + agent-ui §3 现在时 | `contrib/conversation/**`、`contrib/sources/**`、`layout.ts`、`ChatWidget` 零件、删 `chatEditor*.ts` |
| 2 Navigator roster | `contrib/conversation/**` + 上列三份知识层现在时句 | `contrib/chat/**`、`layout.ts`、`conversationPart.ts`、`vs/sessions/**` |

无共享 grid 手术。无「两人改同一文件」。

---

## 验收（方案层；实施另 commit；整波可选）

若落地（仍 **不**要求本方案期间 compile）：

1. 默认窗：Command Palette / 工作区还原 / chat session URI **不会**在 `EDITOR_PART` 开出 Conversation。`ChatEditor` pane 类与 `ChatWidget` 仍在树上。中心仍是 `CONVERSATION_PART`。
2. Sidebar 能打开 stub 会话列表；点选只切换透镜当前会话；不是 `ChatViewPane`、不是 `ChatEditorInput`、零 `IChatModel`。Explorer 仍是 Sidebar default。
3. `python3 scripts/check-docs-health.py` 在文档变更后 0 error。
4. **不落地也不构成 M2 回退**：无引擎产品壳完成线仍以 M2 为准。

## 相关文档

- [m2-product-shell.md](m2-product-shell.md)（`implemented`；本波为其「明确不做 / 仍 deferred」里的壳卫生）
- [agent-ui.md](../../docs/systems/chat/agent-ui.md) §2 决策 5 复用清单 · §3 ChatEditor
- [views-and-composites.md](../../docs/systems/workbench/views-and-composites.md)
- [deferred-gaps.md](../progress/deferred-gaps.md) D3–D5
- 外仓 ADR-061 决策 5（只读）
