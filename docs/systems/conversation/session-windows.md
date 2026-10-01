---
title: "Conversation session 窗口与 chat tab"
type: architecture
status: accepted
phase: N/A
updated: 2026-10-02
summary: "PRD-016 / ADR-002 的系统规格：Part 内最多两叶 session 窗口；叶级 SessionBar（方案 C）；窄宽 More 的新建和删除与写闸一致；revealSessionWindow 状态机；fork / 子代理 catalog（GC-4 观察 liveAgentTree；接通后 Fork 转 AgentService.Fork；接通后 killSubAgent / Kill 动作转 AgentService.Kill，空 agentId 不默认 root）；子代理 overlay 只收 lensTablist、居中卡片；面包屑、导航栈、split"
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

- **叶** = 一个 session 的窗口。`IConversationSessionWindowService` 维护 `leafOrder`、`hidden`、sticky `focusedLeafSessionKey` / `onDidChangeFocusedLeaf`；`CONVERSATION_SESSION_WINDOW_MAX_LEAVES = 2`。切会话走 `revealSessionWindow(sessionKey, { replace? })` 状态机（已有可见叶则聚焦；单叶恢复/新建目标后 `promoteLeaf` 并藏旧 primary；两叶满员走 `openSessionBeside` 或 `replace` 指定让位叶；latest-wins）。`onDidChangeActiveSession` 调用 reveal，但对 bind-failed 哨兵与 `getSessions()` 没有的 id 零动作。`ensurePrimaryWindow` **只**在尚无 primary 时引导第一叶，**不**跟随 roster。`openSessionBeside` 仍建第二叶（Navigator「Open beside」）。隐藏叶释放该叶透镜 `sessionViewLease`，恢复时重取；失败回滚必须 `disposeConversationEditorPart`。`hideSessionWindow` 后回到单窗。
- **叶内 EditorPart** 由 `EditorParts.createConversationEditorPart` 创建，注册进 `IEditorGroupsService.parts`，共用主窗 `windowId`，`excludeFromGlobalEditorAggregation = true`（不进全局 editor 枚举、MRU `activePart`、`applyState` 工作集恢复、`IHistoryService`）。细节见 [editor-part-tabs §4](../workbench/editor-part-tabs.md)。
- 两叶**共用**右侧 Preview / Sources / Panel；这不是 ADR-001 的双 session 孪生。
- 窄宽度（`.is-narrow` / `.is-compact`）把 History、Snapshots、新建、删除和会话选择收进 More。More 里的新建和删除与栏上写钮同一道闸：pairing-hold，或已连接但会话未就绪（KEEP leftover）时，这两项禁用。点它们不会创建、不会删除，也不弹出失败。History、Snapshots 和切会话仍可点。

## 2. `ConversationChatInput` 与围栏

- 资源：`conversation-chat:/session/<sessionKey>/chat/<chatId>`；`chatId === 'default'` 为根。TypeId `workbench.editors.conversationChatInput`。
- 根 tab 实现 `IEditorCloseHandler`，用户关闭被拦；编辑器区「关掉延伸标签」调用 `closeNonRootTabs`，不 `closeGroup` 根组，也不关子代理对话框。
- **围栏**（`common/conversationEditorRouting.ts`）：`isBlockedFromConversationGroup` 对 `ChatEditorInput`、任何非白名单的 `EditorInput`、scheme 不是 `conversation-chat` 的 untyped input 均返回 true；`editorGroupFinder` 把被拦 input 改落主 `EDITOR_PART` 活动组。因此文件 / untitled / Copilot Chat 以及**默认路径**下的 Diff 都在 Preview 打开。
- **已登记的例外**（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) `accepted`，[sources-changes-diff](../../../dev/plans/sources-changes-diff.md) **F1 已落**）：围栏白名单第二类 — **只读 Diff 审阅 input**（`ConversationDiffReviewInput`），只经显式动作（`sources.diff.moveToConversation`、Changes/Review 行点击且 `sources.diff.defaultOwner=conversation`）进入 Conversation 组；**不**放开 tab 拖入（plan §2.6）。默认 `openEditor` / `ACTIVE_GROUP` / `SIDE_GROUP` 仍落 Preview。它是普通延伸 tab：可关、编辑器后退可关、「关掉延伸标签」一起关；`isConversationExtensionTab` 与 fork 延伸 tab 同姿态。

## 3. chat catalog：root / fork / tool / sideChat

`IConversationSessionChatService` 按 session 维护 `IConversationSessionChatEntry[]`（`chatId`、`title`、`originKind ∈ user | fork | tool | sideChat`、`parentChatId`），与协议 `ChatOrigin` 四 kind 对齐。stub 期 catalog 来自内存 fixture。引擎接通后 **GC-4**：roster 观察活动会话 lease 的 `liveAgentTree` 预同步非根 catalog（`chatId` ≡ `agent_id`，根不登记）。传输 `forkAgent?` **已进** `AgentService.Fork` catalog + node unary。接通后用户 Fork 动作转发 `IConversationRosterService.forkSubAgent` → 该 unary（空父 id 用末条 streaming 否则 `root`），**不**开本地 Fork tab、不造 catalog id；未接通仍走 `registerForkChat`。传输 `killAgent?` **已进** `AgentService.Kill` catalog + node unary。接通后用户 Kill 动作 / `IConversationRosterService.killSubAgent` 转发该 unary（空 `agentId` 原样上线、**不**默认 `root`；省略用末条 streaming 否则空串；≠ Cancel）。**不**造本地 catalog 变更。未接通 / 断连缓存 / 无 hook 不发。Navigator 仍只读，不挂 Kill 钮。完整活会话权威仍依赖 PRD-008。
`IConversationSessionChatService` 按 session 维护 `IConversationSessionChatEntry[]`（`chatId`、`title`、`originKind ∈ user | fork | tool | sideChat`、`parentChatId`），与协议 `ChatOrigin` 四 kind 对齐。用户 Fork 仍走本地 `registerForkChat`（无 `Fork` RPC）。**HEAD** 已按 [m7-gap-closeout GC-4](../../../dev/plans/m7-gap-closeout.md)（`implemented`）接线：roster 的观察 lease 驱动 `syncSubAgentsFromLiveTree` + `conversationLiveAgentCatalog`，把 `liveAgentTree` 非根节点投成 `originKind:'tool'`（只增不减，同 id 改名就地更新；引擎 `root` → chat id `default`）；点击 / Reveal 时的惰性 `registerSubAgentChat` 仍保留。活 `Fork` RPC / 会话权威仍依赖 [PRD-008](../../product/requirements.md#prd-008-引擎与会话权威)，不得升 `implemented`。

| 用户动作 | 服务调用 | 结果 |
|----------|----------|------|
| Fork（`ForkConversationAction` 的 Conversation 版） | `registerForkChat` → `openForkTab` | 同 session 新增一张**延伸 tab**；不产生第二个根会话 |
| Kill（`ConversationKillSubAgentAction`） | 接通后 `killSubAgent` → `AgentService.Kill` | 不造本地 catalog 变更；空 agentId 原样上线、不默认 `root`；未接通 no-op |
| 点击时间线里的子代理 | `openSubAgent` | 叶内**居中对话框**（`ConversationSubAgentOverlay`：backdrop + card + popout / maximize / close），父对话仍在底下；**不**加 tab |
| 对话框「铺满」 | `toggleSubAgentDialogMaximized` | 仍是 overlay，仍只有根 tab |
| 对话框「打开为 tab」 | `promoteSubAgentDialog` → `openExtensionTab` | 关对话框，加一张延伸 tab |
| 面包屑点击祖先 | `navigateAgentBreadcrumb` | 对话框内替换预览（或回根关对话框）；已是 tab 时**替换当前延伸 tab**，不叠新 tab |
| 关延伸标签 | `closeNonRootTabs` | 只关该叶延伸 tab（fork / 弹出的子代理 / 审阅 diff）。不关子代理对话框 |

面包屑由 `common/conversationAgentHierarchy.ts::buildAgentHierarchyBreadcrumb` 沿 `parentChatId` 走到 `default`；只对 `originKind === 'tool'` 的 chat 生成。协议侧另有 `ChatInteractivity`（Full / ReadOnly / Hidden；`SideChat` 不是它的值，而是 `ChatOrigin` 四 kind 之一）呈现合同已签收，本仓 stub 期一律 Full，且 `contrib/conversation` 尚无对应符号（只有 `ConversationSessionChatOriginKind`）。

## 4. 两套导航

会话栏管对话，编辑器区管编辑器历史。导航栈同时记下编辑器标签和子代理对话框。

- **上一级**（SessionBar，`goUpOneAgent`）：当前是 tool 子代理（对话框或延伸 tab）时，沿面包屑退到紧挨的父项。父项是会话根时，对话框关掉，延伸 tab 关掉并回到根 tab。根对话和 Fork 上这颗按钮禁用。窄宽度也留在栏上。面包屑回到根是退到对话框之下，历史仍留着，前进可以重新打开。
- **下一级**（SessionBar，`listDirectChildAgents` / `openDirectChildAgent`，方案 [conversation-session-bar-down](../../../dev/plans/conversation-session-bar-down.md)）：紧挨上一级，弹出当前 chat 的直接子代理。`parentChatId` 等于当前 chat 的条目算直接孩子；当前是根 `default` 时，没有 `parentChatId` 的 fork 也算根的孩子。不列孙子。没有直接孩子时禁用。当前 chat 以打开的子代理对话框为准，否则看活动 chat tab；活动编辑器不是 chat 时禁用。tool 走 `openSubAgent`（已有延伸 tab 则聚焦，否则对话框）。fork 走 `openExtensionTab`，不另开根会话，也不再 `registerForkChat`。点一项、Escape、点外面都关掉弹出层。不占用编辑器 ←→ 或鼠标侧键。窄宽度与上一级一起留在栏上，不收进 More。
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
| 2 根 tab 不可关；隐藏再打开 tab 仍在 | `IEditorCloseHandler` + `hideSessionWindow` 保留叶（**进程内**；跨重启见 PRD-017） |
| 3 Fork 不产生第二根会话 | §3 `registerForkChat` |
| 4 子代理点击前无 tab / 无对话框；点击后 overlay；弹出才 tab | §3 |
| 5 面包屑 + 关掉延伸标签 | §3 |
| 6 split 仍同 session 同叶 | §5 |
| 7 并列是第二 session 叶，共用 Preview | §1 |
| 8 编辑器 ←→ 与鼠标侧键走导航栈（含对话框步骤与延伸 tab）。后退默认关掉离开的对话框或延伸 tab。会话栏上一级退父代理，下一级只列直接子代理 | §4 |
| 9 「对话 \| 轨迹」在 tab / 对话框内 | [lens-and-trajectory](lens-and-trajectory.md) |

## 7. 测试

`contrib/conversation/test/browser/`：`conversationSessionChat.test.ts`、`conversationSessionSplit.test.ts`、`conversationSessionWindowSideBySide.test.ts`、`conversationEditorFence.test.ts`、`conversationEditorAggregation.test.ts`、`conversationNavigation.test.ts`。D4 目视：V5 / V7（[shell-smoke-verification](../../guides/shell-smoke-verification.md)）。
