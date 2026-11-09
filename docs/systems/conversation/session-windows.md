---
title: "Conversation session 窗口与 chat tab"
type: architecture
status: accepted
phase: N/A
updated: 2026-11-07
summary: "PRD-016 / ADR-002 的系统规格（2026-10-24 删除会话先确认；2026-11-06 Sessions 行菜单与 Delete 键可删该行，删当前会话后落到列表上的下一行，列表刷新不抢焦点，筛选框 ↓ / Escape 交回列表，面包屑 ←/→/Enter）：Part 内最多两叶 session 窗口；叶级 SessionBar（方案 C）；窄宽 More 的新建和删除与写闸一致；revealSessionWindow 状态机；fork / 子代理 catalog（GC-4 观察 liveAgentTree；接通后 Fork 转 AgentService.Fork；接通后 killSubAgent / Kill 动作转 AgentService.Kill，空 agentId 不默认 root）；已有延伸标签的子代理聚焦原列、不复制到活动列；面包屑祖先已是延伸标签时同样聚焦原列、不复制；子代理 overlay 只收 lensTablist、居中卡片；面包屑、导航栈、split；live tree 改名会更新已打开的延伸标签和对话框标题；栏上新建 / 删除 / 改名禁用时写出原因"

---

# Conversation session 窗口与 chat tab

> 导航：[系统索引](INDEX.md)。需求：[PRD-016](../../product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)。决策：[ADR-002](../../../dev/decisions/002-conversation-session-windows.md)。方案与切片历史：[conversation-session-windows](../../../dev/plans/conversation-session-windows.md)（S1–S6 `implemented`）。

## 1. 结构

```text
CONVERSATION_PART
├── sessionBar（Part 槽已退役，保持空）
└── sessionWindowGrid
    ├── leaf[primary]  session A
    │   ├── 叶级 SessionBar（SelectBox、上一级、下一级、History、Snapshots、新建、删除、hide −；主语 = 该叶 sessionKey）
    │   └── sessionWindow
    │         ├── 编辑器区 ←→、关掉延伸标签（有编辑器历史或延伸标签才显示）
    │         └── Conversation IEditorPart
    │                        ├── CONVERSATION_GROUP: [root tab] [fork tab] [sub-agent tab]
    │                        └── CONVERSATION_SIDE_GROUP（split 后第二列）
    │             └── ConversationSubAgentOverlay（居中卡片，覆盖在叶上；透镜只收 lensTablist）
    └── leaf[beside]   session B（最多两叶；同样一份叶级 bar）
```

- **叶** = 一个 session 的窗口。`IConversationSessionWindowService` 维护 `leafOrder`、`hidden`、sticky `focusedLeafSessionKey` / `onDidChangeFocusedLeaf`；`CONVERSATION_SESSION_WINDOW_MAX_LEAVES = 2`。切会话走 `revealSessionWindow(sessionKey, { replace? })` 状态机（已有可见叶则聚焦；单叶恢复/新建目标后 `promoteLeaf` 并藏旧 primary；两叶满员走 `openSessionBeside` 或 `replace` 指定让位叶；latest-wins）。`onDidChangeActiveSession` 调用 reveal，但对 bind-failed 哨兵与 `getSessions()` 没有的 id 零动作。还没有主叶、并且记下的可见叶仍在名册里时，这次活动变化先恢复那一对叶，不先只开活动会话。在途删除会先把活动 id 挪到邻居、再等 unary 成功才发 `onDidDeleteSession`；邻居是 Sessions 列表上看到的下一行（`orderSessionsForRoster`：Today / Yesterday / Earlier 分组、组内按最近访问排序后的顺序），被删的是最后一行时取上一行，不按目录下标（2026-11-06，引擎名册；本地 stub 名册的落点仍按自己的下标）；这段时间焦点会话已经不在名册里，活动变化不另开邻居窗。连接着的目录列表若少了会话，走 `onDidPruneEngineSessions`（不是删除事件）：卸掉这些 id 的可见叶；卸完没有可见叶时，仍在名册里的活动会话得到一扇窗。`ensurePrimaryWindow` **只**在尚无 primary 时引导第一叶，**不**跟随 roster。`openSessionBeside` 仍建第二叶（Navigator「Open beside」）。隐藏叶释放该叶透镜 `sessionViewLease`，恢复时重取；失败回滚必须 `disposeConversationEditorPart`。`hideSessionWindow` 后回到单窗。
- **叶内 EditorPart** 由 `EditorParts.createConversationEditorPart` 创建，注册进 `IEditorGroupsService.parts`，共用主窗 `windowId`，`excludeFromGlobalEditorAggregation = true`（不进全局 editor 枚举、MRU `activePart`、`applyState` 工作集恢复、`IHistoryService`）。细节见 [editor-part-tabs §4](../workbench/editor-part-tabs.md)。哪一叶可见、哪一叶是主叶由**宿主上报**：`IConversationEditorPart.setLeafHostState({ visible, primary })`（只读 `leafVisible` / `leafPrimary`，默认 `visible: true`、`primary: false`），会话窗服务在 `createConversationEditorPart` 返回后、`whenReady` 前报一次，`promoteLeaf` / `demoteLeaf` / 隐藏切换改完 CSS 类后同步再报。`EditorParts.getActiveConversationEditorPart` 只读这些字段（焦点所在可见叶 → sticky 焦点叶且可见 → 可见主叶 → 任一可见叶），不再探 `.conversation-session-leaf` 的类名；`conversation-session-leaf-hidden` / `-primary` 类只剩样式用途。隐藏叶漏报时仍算可见、会接到 `CONVERSATION_GROUP`，所以上报与改类必须在同一段同步代码里。

- **跨重启的可见叶**：`conversation.sessionWindows.v1` 存在工作区、本机目标（不随 Settings Sync 漫游）。记下的是当前可见叶，主叶在前，最多两扇。网格挂上且这些 id 仍在名册里时，按主叶、并排叶打开，再把焦点放回活动会话；活动会话不在这对叶里就按原 reveal 打开它。名册里已经没有的 id 略过。名册还空着（目录第一次还在拉）就先等，不造一扇「Session unavailable」。隐藏叶不写进这份记录，重启后不自动打开；再次打开该会话时，叶内 chat tab 仍按该 `sessionKey` 的编辑器网格记忆恢复。Part 显隐仍走 Layout。绑定失败占位不记。
- 两叶**共用**右侧 Preview / Sources / Panel；这不是 ADR-001 的双 session 孪生。
- 每叶阅读列身份条的文件夹、分支及动作目标属于该叶绑定 session，重绑同步更新；全局引擎芯片和窗口加入目录的操作保持原范围。非活动叶不借活动叶焦点修正身份，详见 [composer-and-inbox](composer-and-inbox.md) 与 [D1386 方案](../../../dev/plans/2026-10-26-leaf-session-root-identity.md)。
- 窄宽度（`.is-narrow` / `.is-compact`）把 History、Snapshots、新建、删除和会话选择收进 More。More 里的新建和删除与栏上写钮同一道闸：pairing-hold，或已连接但会话未就绪（KEEP leftover）时，这两项禁用。点它们不会创建、不会删除，也不弹出失败。History、Snapshots 和切会话仍可点。栏上的新建、删除与标题改名用同一道写闸：不可写时禁用，并把原因写进 `title` 与 `aria-label`（pairing-hold 写 `Engine not connected`，已连但会话未就绪按就绪度写 `Loading session…` 或 `Session unavailable — The engine is connected, but the active session is not ready.`）。删除先经 `IDialogService.confirm`（2026-10-24，PRD-002 验收 6）：标题 `Delete session "{title}"?`，说明 `This permanently deletes the session and its messages. This cannot be undone.`，主按钮 `Delete`。栏上的删除、More 里的删除、Navigator Sessions 标题上的删除、Sessions 行尾「更多」里的 Delete（删这一行，不是当前会话）、Sessions 列表聚焦时按 Delete（macOS ⌘⌫，删焦点行，命令 `workbench.action.conversationSessions.deleteFocusedSession`）和 Navigator Projects 会话行的删除共用这一个确认函数（`conversationDeleteSessionConfirm.ts`）。行菜单的 Delete 与 Delete 键和标题上的删除同一道写闸，不可写时禁用。Projects 行在确认返回后重新检查写闸和会话是否还在，任一不满足就不删。顺序：先过写闸（配对保持、会话未就绪照旧拒绝），断连但有连接历史时也在确认前拒绝；再取会话 id 与标题并确认；取消时不删除、不写草稿、不提示失败；确认后重新过写闸并确认该 id 仍在名册，再用这个 id 删除。
- Sessions 列表的键盘（2026-11-06）：只有活动会话换了，列表才把选中和焦点移到它那一行并滚过去；消息数、待确认数、改名或连接变化引起的刷新保留用户当前的焦点行和滚动位置。筛选框里按 ↓ 进列表第一条会话；有字时 Escape 先清空，框已空再按 Escape 把焦点交回列表（原焦点行，没有就第一条）。筛选结果始终含当前会话的现行行为不变。窄宽 More 里的会话行与这份列表同序，见 [lens-and-trajectory](lens-and-trajectory.md) §1。

### 删除确认与草稿归属

三个删除入口（Sessions View、叶级 Session Bar、Navigator Projects 会话行）在打开确认框前捕获会话、local/engine 模式与已发布 link/identity。等待期间观察到明确断开或归属变化，永久作废这一确认，即使后来连接恢复也不删除；无关 capability 更新不取消。确认返回后再核 owner、会话存在与入口生命周期，dispose 后不继续。engine 要求有效 link，identity 允许 undefined 以保留 loopback 行为；Sessions/Session Bar 保留 local 模式，Navigator 不新增 local 能力。

待删除草稿按原 owner 保存，失败或稍后恢复的所有入口先比对归属，失配只丢弃旧记录，不向新引擎或新 surface 写入。同步删除回调若在同 owner 切到另一 bound surface，false 分支不把旧稿写到新 surface，也不覆盖回调保存的新稿；true 分支仍可在正常切到后继会话时清除原会话草稿。等待确认的连接监听在 finally 释放。作曲器处于回合或队列编辑时，删除被拒或回滚只写回撰写草稿，不覆盖编辑中的正文；退出编辑后撰写草稿回到输入框。

三入口将确认前 owner 原值传入 roster，不在调用前重新 capture；roster、IPC 与 main 的独立删除归属合同见 [stub-and-fixtures §2.2](stub-and-fixtures.md#22-删除会话的完整归属链)。该链已补齐 renderer 通知迟到窗口与晚结算保护，真实 byte IPC 业务旧红/新绿、分阶段浏览器回归、完整编译及独立综合 OV 均通过，[D1393](../../../dev/progress/deferred-gaps.md) 的代码与自动化验收 closed；真实产品窗口/引擎手验不在本轮范围内。相关回归在 `conversationDeleteSessionConfirm`、`conversationSessionsView`、`conversationLens`、`navigatorProjectsList` 及草稿/生命周期套件，实际运行范围见[当前进度](../../../dev/progress/status.md)。

### 1.1 可见 Pane 缺 lease 的对齐候选

> **可见叶lease当前检查点（2026-10-27）**：固定d8e新L4公开重读/sameLens窄修经原Astra C0/I0/M0/root采纳，以0ef352真双亲接入14e，当前src62996b35；仅Reveal80259B/110f7f…变更，Pane及其他src/Sources四窄implemented保持。7361首次checker五条TS2339失败与consumed原件不改；新checker、业务red/新13矩阵/完整Reveal/非作者after均待，尚无新prep或执行release。15500 metadata仍54fe、native256及额外Reveal旧JS/freeze4/cache3精确，lease accepted/overall active、fullCompile=false。[当前合源证明](../../../dev/progress/conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/INDEX.md)覆盖当前身份；[首失败](../../../dev/progress/conversation-visible-lease-first-checker-failure-20261027-evidence/INDEX.md)完整保留。下述是源码合同，未作运行通过。

[可见叶lease恢复窄方案](../../../dev/plans/conversation-visible-lease-recovery.md)已accepted；当前源码候选在Pane现有visibility生命周期中监听真实roster session通知，仅当捕获input/Lens仍为当前存活owner、明确bound一致、叶实际visible、未suspended、真实引擎live且非pairing、catalog ready并且自身lease缺失时，调用既有公开bind入口。目标取该Pane当前bound，不按通知active id过滤，因此两个pinned visible叶各核自己的owner；已有lease保持，hidden与未挂载/已移除叶不补领。原hide释放与正常reveal（含local stub/断连缓存）路径保持。

普通Pane/Lens dispose撤销listener并释放registered lifetime，测试持有的旧Lens对象不保证将lease字段置空；旧owner退出消费应从实际lease不再接帧与最后消费者释放host的公开边界观察。历史5fd I1与783/f33源码窄peer保留[方案§8–§9](../../../dev/plans/conversation-visible-lease-recovery.md#8-5fd-正式源码-peer-与新-l4-合同修订2026-10-27)。7361首次checker在新L4报5条TS2339；d8e仅公开重读restoredLens/同对象断言与两receiver修订已peer签收并合入，未改生命周期合同，实际隔离/release仍未运行。

源码窄peer已签收，d8e窄修已真三路接入；运行验收仍未达。旧源码L1业务red、新矩阵/原Reveal回归与非作者默认编辑器窗口after均待新授权，consumed失败run不可重试；不能以共享observer收到frame推断实际Pane已持lease或已绘制，方案与产品状态未提升。

## 2. `ConversationChatInput` 与围栏

- 资源：`conversation-chat:/session/<sessionKey>/chat/<chatId>`；`chatId === 'default'` 为根。TypeId `workbench.editors.conversationChatInput`。
- 根 tab 实现 `IEditorCloseHandler`，用户关闭被拦；编辑器区「关掉延伸标签」调用 `closeNonRootTabs`，不 `closeGroup` 根组，也不关子代理对话框。
- **围栏**（`common/conversationEditorRouting.ts`）：`isBlockedFromConversationGroup` 对 `ChatEditorInput`、任何非白名单的 `EditorInput`、scheme 不是 `conversation-chat` 的 untyped input 均返回 true；`editorGroupFinder` 把被拦 input 改落主 `EDITOR_PART` 活动组。因此文件 / untitled / Copilot Chat 以及**默认路径**下的 Diff 都在 Preview 打开。核心不 import 这份 contrib：`conversationEditorRouting.ts` 在模块求值时 `registerEditorGroupRoute`（`services/editor/common/editorGroupRoute.ts`，`classify` 三态 `exclusive` / `foreign` / 未注册，另给 `isExtensionTab` 与 `createDefaultRoot`），`conversationEditor.contribution.ts` 带上该 import；finder、`EditorParts` 默认根与 `ConversationEditorPartImpl` 标签条都问这个注册点；finder 对只读 Diff 审阅的判定仍直接读 `workbench/common/editor/conversationDiffReviewInput.ts`（P7 的 type id / scheme guard），已注册时 Diff 归 `exclusive`。注册句柄由 `conversationEditorRouting.ts` 持有（`conversationEditorGroupRouteRegistration`，`markAsSingleton`，进程寿命）。未注册时 finder 不抛「必须点名 Conversation 组」、只靠「排除聚合 part 拨回主 Preview」保住文件围栏，叶不开默认根。
- **已登记的例外**（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) `accepted`，[sources-changes-diff](../../../dev/plans/sources-changes-diff.md) **F1 已落**）：围栏白名单第二类 — **只读 Diff 审阅 input**（`ConversationDiffReviewInput`），只经显式动作（`sources.diff.moveToConversation`、Changes/Review 行点击且 `sources.diff.defaultOwner=conversation`）进入 Conversation 组；**不**放开 tab 拖入（plan §2.6）。默认 `openEditor` / `ACTIVE_GROUP` / `SIDE_GROUP` 仍落 Preview。它是普通延伸 tab：可关、编辑器后退可关、「关掉延伸标签」一起关；`isConversationExtensionTab` 与 fork 延伸 tab 同姿态。

## 3. chat catalog：root / fork / tool / sideChat

`IConversationSessionChatService` 按 session 维护 `IConversationSessionChatEntry[]`（`chatId`、`title`、`originKind ∈ user | fork | tool | sideChat`、`parentChatId`），与协议 `ChatOrigin` 四 kind 对齐。stub 期 catalog 来自内存 fixture。引擎接通后 **GC-4**：roster 观察活动会话 lease 的 `liveAgentTree` 预同步非根 catalog（`chatId` ≡ `agent_id`，根不登记）。传输 `forkAgent?` **已进** `AgentService.Fork` catalog + node unary。接通后用户 Fork 只在来源是 roster 会话（`conversation-chat:` 资源且 sessionKey 在 roster 目录中）时转发 `IConversationRosterService.forkSubAgent` → 该 unary（空父 id 用末条 streaming 否则 `root`），**不**开本地 Fork tab、不造 catalog id。其余来源不论是否接通都走 Chat fork：内容提供方会话的 fork 结果开成本会话的 Fork 延伸 tab（`registerForkChat` → `openForkTab`），本地 chat 的 fork 开回 Chat 视图。传输 `killAgent?` **已进** `AgentService.Kill` catalog + node unary。接通后用户 Kill 动作 / `IConversationRosterService.killSubAgent` 转发该 unary（空 `agentId` 原样上线、**不**默认 `root`；省略用末条 streaming 否则空串；≠ Cancel）。**不**造本地 catalog 变更。未接通 / 断连缓存 / 无 hook 不发。Navigator 仍只读，不挂 Kill 钮。完整活会话权威仍依赖 PRD-008。
`IConversationSessionChatService` 按 session 维护 `IConversationSessionChatEntry[]`（`chatId`、`title`、`originKind ∈ user | fork | tool | sideChat`、`parentChatId`），与协议 `ChatOrigin` 四 kind 对齐。用户 Fork 仍走本地 `registerForkChat`（无 `Fork` RPC）。**HEAD** 已按 [m7-gap-closeout GC-4](../../../dev/plans/m7-gap-closeout.md)（`implemented`）接线：roster 的观察 lease 驱动 `syncSubAgentsFromLiveTree` + `conversationLiveAgentCatalog`，把 `liveAgentTree` 非根节点投成 `originKind:'tool'`（只增不减，同 id 改名就地更新；引擎 `root` → chat id `default`）；点击 / Reveal 时的惰性 `registerSubAgentChat` 仍保留。活 `Fork` RPC / 会话权威仍依赖 [PRD-008](../../product/requirements.md#prd-008-引擎与会话权威)，不得升 `implemented`。

| 用户动作 | 服务调用 | 结果 |
|----------|----------|------|
| Fork（`ForkConversationAction` 的 Conversation 版） | `registerForkChat` → `openForkTab` | 同 session 新增一张**延伸 tab**；不产生第二个根会话 |
| Kill（`ConversationKillSubAgentAction`） | 接通后 `killSubAgent` → `AgentService.Kill` | 不造本地 catalog 变更；空 agentId 原样上线、不默认 `root`；未接通 no-op |
| 点击时间线里的子代理 | `openSubAgent` | 已有延伸 tab 则聚焦那一列，不复制到当前活动列；否则叶内**居中对话框**（`ConversationSubAgentOverlay`：backdrop + card + popout / maximize / close），父对话仍在底下，**不**加 tab |
| 对话框「铺满」 | `toggleSubAgentDialogMaximized` | 仍是 overlay，仍只有根 tab |
| 对话框「打开为 tab」 | `promoteSubAgentDialog` → `openExtensionTab` | 关对话框，加一张延伸 tab |
| 面包屑点击祖先 | `navigateAgentBreadcrumb` | 对话框内替换预览（或回根关对话框）。祖先已经是延伸标签时聚焦它所在的列，不在当前列再开一张；从延伸标签退上来时关掉正在离开的那张 |
| 关延伸标签 | `closeNonRootTabs` | 只关该叶延伸 tab（fork / 弹出的子代理 / 审阅 diff）。不关子代理对话框 |

`liveAgentTree` 改掉已有 chat 的名字后，延伸标签的标签名、面包屑上的这一级，以及正在打开的子代理对话框标题，都改成这个新名字。根标签不动。只改祖先的名字时，对话框标题仍是当前子代理，面包屑上的祖先改为新名字。

面包屑由 `common/conversationAgentHierarchy.ts::buildAgentHierarchyBreadcrumb` 沿 `parentChatId` 走到 `default`；只对 `originKind === 'tool'` 的 chat 生成。键盘（2026-11-06）：Tab 进面包屑后 ←/→ 在各级之间移动（首次按键落在当前一级），Enter 或 Space 打开焦点所在的祖先，与点击同一条路径；焦点在当前一级时不动作。协议侧另有 `ChatInteractivity`（Full / ReadOnly / Hidden；`SideChat` 不是它的值，而是 `ChatOrigin` 四 kind 之一）呈现合同已签收，本仓 stub 期一律 Full，且 `contrib/conversation` 尚无对应符号（只有 `ConversationSessionChatOriginKind`）。

## 4. 两套导航

会话栏管对话，编辑器区管编辑器历史。导航栈同时记下编辑器标签和子代理对话框。

- **上一级**（SessionBar，`goUpOneAgent`）：当前是 tool 子代理（对话框或延伸 tab）时，沿面包屑退到紧挨的父项。父项是会话根时，对话框关掉，延伸 tab 关掉并回到根 tab。父项已经是延伸标签时，聚焦那一列，不复制到当前列；正在离开的延伸标签关掉。对话框这次关掉是离开，不是 × / Esc / 遮罩：历史留着，前进重新打开刚离开的那一个。若聚焦父标签往栈顶又压了一步，这一步留在对话框前面，前进仍先回到对话框。根对话和 Fork 上这颗按钮禁用。窄宽度也留在栏上。面包屑回到根同样是退到对话框之下，前进可以重新打开。
- **下一级**（SessionBar，`listDirectChildAgents` / `openDirectChildAgent`，方案 [conversation-session-bar-down](../../../dev/plans/conversation-session-bar-down.md)）：紧挨上一级，弹出当前 chat 的直接子代理。`parentChatId` 等于当前 chat 的条目算直接孩子；当前是根 `default` 时，没有 `parentChatId` 的 fork 也算根的孩子。不列孙子。没有直接孩子时禁用。当前 chat 以打开的子代理对话框为准，否则看活动 chat tab；活动编辑器不是 chat 时禁用。tool 走 `openSubAgent`（已有延伸 tab 则聚焦那一列，不把同一张标签再开进当前活动列，否则对话框）。当前正开着别的子代理对话框时，先聚焦已有标签再离开对话框，对话框不盖住那张标签；离开后前进能重新打开它。fork 走 `openExtensionTab`，不另开根会话，也不再 `registerForkChat`。点一项、Escape、点外面都关掉弹出层。不占用编辑器 ←→ 或鼠标侧键。窄宽度与上一级一起留在栏上，不收进 More。
- **编辑器历史**（`IConversationNavigationService`，每个 Conversation `IEditorPart` 一栈，深 50）：记录 `(groupId, editor)`，子代理对话框另带 `subAgentChatId`。打开对话框压入一步；同一对话框里换成另一个子代理再压一步；叶内最大化不另计。后退和前进都按记下的 `groupId` 打开那一列，不把仍打开的侧列审阅或延伸标签塞进当前活动列；会话叶空列不关，原列还在就在原列打开。←→ 和「关掉延伸标签」挂在该叶 `sessionWindow` 的 `.conversation-editor-nav`，三颗都不可用时整条隐藏。鼠标侧键（`event.button === 3 / 4`，焦点在 Conversation）仍走这套栈。关闭的 tab 从栈里移除。与 `IHistoryService` 完全隔离——Preview 聚焦时鼠标侧键仍是文件历史。

设置 `conversation.navigate.closeChildOnBack`（默认 `true`）：从对话框退到没有对话框的历史项时关掉对话框，从延伸 tab 后退时关掉该 tab；根 tab 永不因此关闭。默认开启时，前进会按栈重新打开刚离开的对话框。点 × / Esc / 遮罩丢掉这些对话框步骤，前进不能再打开。「关掉延伸标签」只关延伸 tab，不关对话框。

## 5. split 与并列

- **split**（`workbench.action.conversation.splitSessionWindow`，F1 可见）：同一叶内新建 `CONVERSATION_SIDE_GROUP`，两列各自 tab；`hideSplitColumn` / `showSplitColumn` 收放。仍是同一 session、同一叶；fork 不会因此被送进 Preview。
- **并列** = 第二叶（§1）；隐藏后剩单叶；再打开恢复。每叶 `ConversationEditorPane.layout` 用自己的叶宽打 `.is-medium` / `.is-narrow` / `.is-compact`，不用 Part 宽。
- chrome / 窗口后续 `ConversationPart.layout` 按各叶 host 的 `clientWidth`/`clientHeight` 再 layout 对应 conversation editor part（创建时已有首次 layout；host 仍为 0 则跳过以免冲掉首次尺寸）。拆列后改窗口大小网格随叶尺寸更新。

## 6. 与 PRD-016 验收的对应

| 验收 | 落点 |
|------|------|
| 1 中间可见 chat tab，不是 Preview 里的 Chat 标签 | §1 叶内 EditorPart + §2 围栏 |
| 2 根 tab 不可关；隐藏再打开 tab 仍在 | `IEditorCloseHandler` + `hideSessionWindow` 保留叶（**进程内**）。跨重启的可见叶见上文「跨重启的可见叶」；隐藏叶要再打开才回来，tab 记忆在该 `sessionKey` 的编辑器网格里 |
| 3 Fork 不产生第二根会话 | §3 `registerForkChat` |
| 4 子代理点击前无 tab / 无对话框；点击后 overlay；弹出才 tab | §3 |
| 5 面包屑 + 关掉延伸标签 | §3 |
| 6 split 仍同 session 同叶 | §5 |
| 7 并列是第二 session 叶，共用 Preview | §1 |
| 8 编辑器 ←→ 与鼠标侧键走导航栈（含对话框步骤与延伸 tab）。后退默认关掉离开的对话框或延伸 tab。会话栏上一级退父代理，下一级只列直接子代理 | §4 |
| 9 「对话 \| 轨迹」在 tab / 对话框内 | [lens-and-trajectory](lens-and-trajectory.md) |

## 7. 测试

`contrib/conversation/test/browser/`：`conversationSessionChat.test.ts`、`conversationSessionSplit.test.ts`、`conversationSessionWindowSideBySide.test.ts`、`conversationSessionWindowLayout.test.ts`、`conversationEditorFence.test.ts`、`conversationEditorAggregation.test.ts`、`conversationNavigation.test.ts`。D4 目视：V5 / V7（[shell-smoke-verification](../../guides/shell-smoke-verification.md)）。

`conversationSessionWindowReveal.test.ts`保留默认QuietRoster原26条及静态展开13条真实EngineRoster / UA / Deferred catalog / SessionView host frame矩阵，覆盖见[窄方案§7.1](../../../dev/plans/conversation-visible-lease-recovery.md#71-静态展开选择器与待运行资格)。首次实际项目上下文checker在7361新L4报5条TS2339后停止；d8e窄修只复用作者一次AST/lint原件与源码peer结论，没有新checker/emit/tests/after，13条结果未观察，见[当前证明](../../../dev/progress/conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/INDEX.md)。
