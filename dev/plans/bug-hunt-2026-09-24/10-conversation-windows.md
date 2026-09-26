---
title: "已可见会话窗会抢回焦点，副窗替换失败与活树 catalog 会把导航带到旧目标"
type: plan
status: accepted
phase: M7
updated: 2026-09-24
summary: "已可见 reveal 取消后仍聚焦；副窗换新叶失败不恢复；活树不改父级也不摘离开的 tool 条目；拆列打开与后退不落到已有目标。"
---

# 已可见会话窗会抢回焦点，副窗替换失败与活树 catalog 会把导航带到旧目标

本稿是方案，不是实施。

冲突域只限 conversation 的窗口、导航、catalog、fork、kill、overlay、session bar、sessions 列表相关文件，即扫描文 [10-conversation-windows](../../progress/bug-hunt-2026-09-24/10-conversation-windows.md) 点名的那些。不要改 timeline 渲染与 composer（另路）。

与 [conversation-bound-session](../conversation-bound-session.md)、[conversation-session-windows](../conversation-session-windows.md) 重复的只交叉引用，不另起实施切片。窗口几何、`closeChildOnBack` 的设置合同、Kill / 浮层身份 / Navigator Reveal 仍以那两篇为准。

## 核查

| 条目 | 结论 | 理由 |
|:-----|:-----|:-----|
| BH-10-1 | 成立 | `runReveal` 已可见分支在 `whenLeafPaneReady` 之后无条件 `focusLeaf`，不看 `cancelled`。 |
| BH-10-2 | 成立 | 副窗 `replaceLeafWithNew` 先藏再 `ensureLeaf`；`runReveal` 的 catch 不 `restoreSessionWindow`。 |
| BH-10-3 | 成立 | 已有 catalog 条目不写 `parentChatId`，本帧未出现的 tool 条目不删除；面包屑按 `parentChatId` 走。 |
| BH-10-4 | 成立 | `openExtensionTab` 只查活动组；`CONVERSATION_GROUP` 固定进活动组，不跨列复用已有 input。 |
| BH-10-5 | 成立 | 面包屑目标为 `default` 时只认活动组 index 0，对不上仍 `fireCloseNonRootStateChange` 并返回。 |
| BH-10-6 | 成立 | `closeChildOnBack` 只 `closeEditor(leaving)`；组模型接着激活的是 MRU 或相邻标签，不是栈里的 destination。 |
| BH-10-7 | 驳回 | 回落在 `updateSessionTitle`，但叶 SessionBar 不听会话变更，删会话不会把活动会话标题写上去。见下。 |

### 驳回

**BH-10-7。** `updateSessionTitle`（`conversationLensSessionBar.ts` 约 363–364 行）在 `getBoundSessionId()` 找不到会话时会改用 `getActiveSession()`。叶上的标题按钮由 `ConversationLeafSessionBar` 挂上，`sessionKey` 在构造时钉死（约 80、116–117 行），`updateSessionTitle` 只在构造末尾调用（约 112 行），该类不订阅 `onDidChangeSession`。编辑器页的 `ConversationLens` 会在 `onDidChangeSession` 里调 `updateSessionTitle`（`conversationLens.ts` 约 317–322 行），但 `ensureLens` 不传 `sessionBar`（`conversationEditorPane.ts` 约 126–130 行），透镜没有 `sessionTitleButton`，函数在约 360 行直接返回。删会话会 `fire` `onDidChangeSession`（`conversationStubService.ts` `deleteSession` 约 461 行），叶标题仍是挂载时的旧文案，不会变成另一扇活动会话的名字。焦点进叶仍 `switchSession` 到旧 key（`conversationSessionWindowService.ts` `focusin` 约 469–473 行）是叶子还在，不是这条标题回落。

## Problem class

- **症状：** 两扇都已打开时，较慢的那次聚焦把活动和焦点拨回先切的会话；副窗换成尚未建叶的会话若失败，副窗一直藏着。活树再推一帧后，面包屑仍按第一次的父级走，树上已经没有的 tool agent 还能点开。同一会话拆成两列时，再次打开同一 chat 会在当前列再造一张标签。点面包屑根、或默认设置下从多个延伸标签后退，停住的不是目标标签。
- **类标签：** **reveal 取消只写在 await 之前** + **藏窗与建叶不是同一成败边界** + **catalog 当追加日志** + **打开/后退只认活动组的当前格**。
- **复发机制：** 新的「叶已经在」路径不读 `cancelled`；替换先改可见性再 await；同步活树只补 title/model；`openEditor` 的目标组与 `findOpenTabForChat` 的扫描范围不一致。

## 0. 一句话结论

已可见的 reveal 从等待回来后，被取消就不得再 `focusLeaf`。副窗换成新叶失败时，可见集合回到调用前。同一帧活树写回 tool 条目的 `parentChatId`，并摘掉本帧没再出现的 tool 条目（fork 不动，已开标签另定）。同一 chat 已在任一列打开就在那一列激活；面包屑根与 `closeChildOnBack` 的后退都落到栈或 catalog 里的那个 input，不绑活动组 index 0，也不指望 `closeEditor` 自己选对。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 活动会话变化（名单里仍有该 id）调用 `revealSessionWindow` | `conversationSessionWindowService.ts` 约 109–118 行 |
| 非 atomic 的在途 reveal 只被标 `cancelled`，调用方不等它 | 同文件 `revealSessionWindow` 约 274–276 行 |
| 目标叶已存在且未隐藏：不置 `atomic`，`await whenLeafPaneReady` 后无条件 `focusLeaf` | `runReveal` 约 307–311 行 |
| `whenLeafPaneReady`：已有 pane 则返回；没有 `activeEditorPane` 时最多约 2 秒 | 约 573–594 行 |
| `focusLeaf` → `setFocusedLeaf`，活动会话不同则 `switchSession` | 约 541–570 行 |
| 两叶时 `switchLeafSession` 带 `{ replace: this.sessionKey }` | `conversationLeafSessionBar.ts` 约 124–128 行 |
| 叶 `focusin` 在活动会话不同时 `switchSession(sessionKey)` | `conversationSessionWindowService.ts` 约 469–473 行 |
| 主窗替换：先 `ensureLeaf` 再藏；副窗替换：先 `hideSessionWindowWithoutFire` 再 `ensureLeaf` | `replaceLeafWithNew` 约 402–412 行 |
| reveal 失败只 `rollbackHalfAppliedLeaf(新 key)` 并写回 `primarySessionKey`，不恢复刚藏的副窗 | `runReveal` catch 约 326–333 行 |
| `openSessionBeside` 驱逐失败会 `restoreSessionWindow` | 约 213–217 行 |
| 已有 `chatId` 只在 title 或 model 变化时改这两项，不改 `parentChatId`；循环外不删除 | `syncSubAgentsFromLiveTree` 约 308–325 行 |
| 活树父级来自节点的 parent，根 agent 映射为 `default` | `collectLiveAgentTreeCatalogEntries`（`conversationLiveAgentCatalog.ts` 约 22–38 行） |
| 面包屑沿 `parentChatId` 上走，缺父即停；根项由函数插入 | `buildAgentHierarchyBreadcrumb` 约 33–57 行 |
| 编辑器页面包屑点击调用 `navigateAgentBreadcrumb` | `conversationEditorPane.ts` 约 69–74 行 |
| `openExtensionTab` 只在 `part.activeGroup.editors` 里按 resource 查找 | `conversationSessionChatService.ts` 约 366–378 行 |
| `findOpenTabForChat` 扫该 part 的全部分组 | 约 459–472 行 |
| `CONVERSATION_GROUP` 解析为当前 conversation part 的活动组，不走「已打开则揭示」 | `editorGroupFinder.ts` `doFindGroup` 约 157–163 行 |
| `splitSessionWindow` 可在同一 part 加列并聚焦 | `conversationSessionChatService.ts` 约 479–493 行 |
| Fork、Promote 都进 `openExtensionTab` | `openForkTab` 约 352–356 行；`promoteSubAgentDialog` 约 410–412 行 |
| 目标 `default`：只看活动组 `getEditorByIndex(0)`，是默认根才关当前延伸标签并打开它；无论是否命中都 `fireCloseNonRootStateChange` | `navigateAgentBreadcrumb` 约 186–193 行 |
| 默认 `conversation.navigate.closeChildOnBack` 为 true | `conversationNavigation.ts` 约 19–20 行 |
| 离开的是延伸标签时只 `closeEditor(leaving)`，不 `openEditor(destination)`；栈已 `moveBack` | `goBack` 约 216–228 行 |
| 关掉活动编辑器后，下一活动是 MRU 第二项，或关闭位的后一项 / 前一项 | `editorGroupModel.ts` `doCloseEditor` 约 541–549 行 |
| latest-wins 测的是连续两次新建叶，结束后可见的是 B | `conversationSessionWindowReveal.test.ts` 测 `15 latest-wins` |
| `closeChildOnBack` 现测是根加一张延伸标签，后退后只剩根 | `conversationNavigation.test.ts` 测 `closeChildOnBack closes extension tab` |

`conversationSessionWindowReveal.test.ts` 测 `8` 只锁「两叶都已可见时，一次 reveal 会聚焦该叶」，没有「先一次的 `whenLeafPaneReady` 更晚返回」。

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 补六条不变量** | 见 §3。不改窗口几何，不改 Kill / 浮层绑定身份 | **选定** |
| B 已可见路径改成 atomic，后来者等待 | 能避免并行 `focusLeaf`，但等待的是一次本不该再聚焦的 reveal | **拒绝。** 取消后跳过 `focusLeaf` 即可 |
| C 副窗也改成先 `ensureLeaf` 再藏，允许等待期间出现第三扇可见叶 | 与最多两叶的可见集合不一致 | **拒绝。** 失败时恢复被藏的那一扇 |
| D 活树同步时清空该 session 整个 catalog 再写入 | 会丢掉 fork 条目（`originKind: 'fork'`，不在活树收集结果里） | **拒绝** |
| E 本帧消失的 tool 条目连同已打开标签一起关 | 扫描文把关标签另定；关标签会碰到导航栈与面包屑回根，超出本缺陷 | **拒绝。** 本波只摘 catalog |
| F 重做 [conversation-session-windows](../conversation-session-windows.md) 的导航栈或 [conversation-bound-session](../conversation-bound-session.md) 的 Kill / 浮层 / Navigator Reveal | 那两篇已收口的合同不是这六条的成因 | **拒绝。** 只交叉引用 |

## 3. 选定设计

### S1 已可见 reveal 被取消后不再聚焦（BH-10-1）

`runReveal` 在 `existing && !existing.hidden` 分支里，`whenLeafPaneReady` 返回之后：

- `state.cancelled` 为真，或 `this.revealInFlight` 已不是这次 `state`：直接 return。
- 只有这次仍是当前 reveal，才 `focusLeaf`。

不把这条快路径改成 `atomic`。`revealSessionWindow` 把「这次已被取消」传回调用方（返回值或等价结果）。`switchLeafSession`（约 124–132 行）在 await 之后若这次结果是已取消，直接返回，不得再 `switchSession` 到旧目标。

**不变量：** 叶下拉先选 A 再选 B，且 A 的 await 先结束时，A 不得 `switchSession(A)`，活动会话停在 B。只断言「未调用 `focusLeaf`」不够。

### S2 副窗替换建叶失败则恢复被藏的叶（BH-10-2）

`replaceLeafWithNew` 把 outgoing key 写在这次 `state` 上（局部变量过不了 `ensureLeaf` 的抛错），再 `hideSessionWindowWithoutFire`，然后 `await ensureLeaf`。失败信息仍由 `runReveal` 的 catch 记日志并通知。

catch 只读这次 `state` 上的 outgoing key。该 key 仍是隐藏叶时才 `restoreSessionWindow` 这一扇。禁止按「某一隐藏叶」恢复：可见数已满时不得再藏另一扇非主窗。主窗分支维持先 `ensureLeaf` 再藏，不改。

**不变量：** 可见数 ≥ 2、副窗 `{ replace }` 指向尚未建叶的会话、`ensureLeaf` 抛错时，incoming 不留在 `leaves` 里，outgoing 重新可见，可见数回到进入 `applyRevealStateTable` 之前。主窗替换失败时旧主窗不被这条提前藏住。

### S3 活树帧写回父级，并摘掉本帧没有的 tool 条目（BH-10-3）

`syncSubAgentsFromLiveTree` 对 `collectLiveAgentTreeCatalogEntries` 的结果：

- 已有同一 `chatId` 且 `originKind === 'tool'`：`title`、`model`、`parentChatId` 任一与本帧不同则写回这三项。`originKind === 'fork'` 不改父级。不新增字段。
- 已经打开的浮层面包屑是 `open` 时的快照。本帧父级变化或父条目被摘掉后，不关闭浮层，但用更新后的 catalog 再 `setItems`。点击仍走 `navigateOverlayBreadcrumb`。
- 本帧没有、且该 session catalog 里 `originKind === 'tool'` 的条目：从这张 catalog 删除。
- `originKind === 'fork'` 以及不是 tool 的条目：不因本帧没出现而删除。

`changed` 在父级变化或删除时同样为真，继续 `fire` 现有的 catalog 与 close-non-root 事件。不在本切片关闭已经打开的标签或浮层。面包屑继续只读 catalog 的 `parentChatId`（`buildAgentHierarchyBreadcrumb` 不改算法）。

**不变量：** 同步返回后，本帧每个非根节点的 catalog `parentChatId` 等于该帧收集结果；catalog 里不存在「本帧没有、且 `originKind === 'tool'`」的 `chatId`；同步前已有的 fork 条目仍在。

### S4 已打开的 chat 在其所在列激活（BH-10-4）

`openExtensionTab` 在创建新的 `ConversationChatInput` 之前调用 `findOpenTabForChat(sessionKey, chatId)`。命中则在**含有该 input 的 group** 上 `openEditor(existing)` 并返回。未命中才 `createInstance` 并用 `CONVERSATION_GROUP` 打开。

Fork 与 Promote 仍只调用 `openExtensionTab`，不各写一套查找。

**不变量：** 同一 session、同一 `chatId` 的 `ConversationChatInput` 已在该 part 任一列中时，再次 `openExtensionTab` 不增加 input 个数，活动编辑器变为已存在的那一个。

### S5 面包屑根按已打开的默认根打开（BH-10-5）

`navigateAgentBreadcrumb` 在目标是 `default`、且当前走的是编辑器页分支（浮层仍走 `navigateOverlayBreadcrumb`，浮层里 `default` 关闭对话框的行为不改）时：

- 用 `findOpenTabForChat(sessionKey, 'default')` 找默认根。
- 找到：关掉当前活动延伸标签，再在**根所在的 group** 打开该根 input。
- 找不到：return，不调用 `fireCloseNonRootStateChange`。
- 不再读 `group.getEditorByIndex(0)`。

**不变量：** 活动列的 index 0 不是默认根、但该 session 某列已有默认根时，点面包屑根会使该根成为它所在列的活动编辑器，并关掉点击时所在的那张延伸标签。没有默认根 input 时，标签集合与 close-non-root 事件都不变。

### S6 后退关掉延伸标签后，可见编辑器是 destination（BH-10-6）

`goBack` 在 `closeChildOnBack` 且 `leaving` 是延伸标签时：仍先 `moveBack`，再 `closeEditor(leaving)`。关闭成功之后的 `openEditor(destination.editor)` 若再抛错，不得走进现有 catch 的 `moveForward`，栈不得回到已经关掉的 `leaving`。打开失败停在关闭之后的栈上。不要改用 `targetPart.activeGroup.openEditor`，destination 可以在另一列。

设置合同仍是 [conversation-session-windows](../conversation-session-windows.md) 里「后退关掉延伸 tab，默认根不因此关闭」。本切片不改对话框的后退，不改 `goForward`。

**不变量：** 默认设置下，同一 part 里除根以外至少还有两张延伸标签，或 destination 的 `groupId` 不是关闭发生时的活动列：`goBack` 成功返回后，destination 那一组的活动编辑器是 `destination.editor`。`closeEditor` 抛错时仍 `moveForward` 并通知，与现有失败回滚相同。

## 4. 不做

- 不改 timeline 渲染、composer、时间线 pill。
- 不实施 [conversation-bound-session](../conversation-bound-session.md) 的连接重绑、模型回选、浮层列表身份、Kill、Navigator Reveal。Kill 不传 `agentId` 的行为保持该篇与 session-windows 合同，不在本稿单独立条。
- 不重开 [conversation-session-windows](../conversation-session-windows.md) 的网格、最多两叶、只藏不关、fork 默认进 tab。
- 不回收已删除会话的叶 DOM，不改叶 `focusin` 的 `switchSession`（BH-10-7 的标题回落不成立）。
- catalog 摘掉 tool 条目时不关闭已打开标签、不关浮层。
- 不改 `openSessionBeside` / `ensurePrimaryWindow` 已有的失败回滚。
- 不改 pairing-hold、断连且有连接史、KEEP leftover list-fail 的拒绝写入。
- 不建议重开 GitHub Actions。

## 5. 验证

现有路径（本地）：

- `src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts`
- `src/vs/workbench/contrib/conversation/test/browser/conversationSessionChat.test.ts`
- `src/vs/workbench/contrib/conversation/test/browser/conversationNavigation.test.ts`
- `src/vs/workbench/contrib/conversation/test/common/conversationAgentHierarchy.test.ts`
- `src/vs/workbench/contrib/conversation/test/common/conversationLiveAgentCatalog.test.ts`

该加的断言：

- **S1：** 两叶都已可见；先 reveal A，并让 A 的 `whenLeafPaneReady` 在 B 的 reveal 开始之后才结束。结束后焦点叶与活动会话是 B，A 那次不再把它们改回 A。测 `15 latest-wins` 仍只表示新建叶路径，不要改它来冒充这条。
- **S2：** 两叶可见，在副窗上 `{ replace }` 到尚无叶的会话，且 `createConversationEditorPart` 或 `whenReady` 抛错。断言副窗会话仍可见，新 key 没有叶，并有错误通知。主窗替换失败的用例要断言旧主窗没有被提前藏住。
- **S3：** 同一 `chatId` 第二帧 `parentChatId` 不同，catalog 与 `getAgentHierarchyBreadcrumb` 使用新父级。第二帧去掉父节点、留下子节点时，父的 tool 条目不在 catalog，面包屑不再包含该父。先 `registerForkChat` 再同步一帧不含该 fork 的树，fork 仍在 catalog。
- **S4：** `splitSessionWindow` 之后，延伸标签在非活动列，再 `openExtensionTab` / Promote 同一 `chatId`。该 part 里这个 resource 的 `ConversationChatInput` 仍是一张，活动编辑器是原来那张。
- **S5：** 默认根不在活动组 index 0（另一列，或不是 index 0）。`navigateAgentBreadcrumb(sessionKey, 'default')` 打开该根，并关掉当前延伸标签。没有默认根 input 时，编辑器个数不变。
- **S6：** 同一组三张会话标签（根 + 两张延伸），从最上面一张 `goBack`。活动编辑器是栈的 destination，而不是 `editorGroupModel` 按 MRU 或相邻位选出的另一张。再加一条：destination 的 `groupId` 不是关闭发生的那一列，后退后 destination 列的活动编辑器是 destination。现有「根 + 一张子标签，后退后只剩根」保持。

不要把上述断言写成「重开 workflow」。
