---
title: "潜在缺陷：会话窗口"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "会话窗在已可见叶上会抢回旧焦点，并列替换失败会藏掉副窗，活树 catalog 不改父级也不摘掉已离开的 agent。"
---

# 潜在缺陷：会话窗口

## 结论

并列两扇已打开的会话窗里，后一次切换可能被前一次 reveal 的焦点抢回去；在副窗里换会话若建叶失败，当前副窗会一直藏着。活树再次同步时，面包屑仍按第一次写入的父级走，已经不在树上的 agent 也留在 catalog 里。

## 发现

### BH-10-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts` `runReveal` 约 307–311 行；取消标记在 `revealSessionWindow` 约 274–276 行
- 行为：目标叶已经可见时，`runReveal` 不把这次 reveal 标成 atomic，先 `await whenLeafPaneReady`，回来后无条件 `focusLeaf`。后一次 reveal 只能把前一次的 `cancelled` 设为 true，等不到它结束，两边并行；前一次从 await 回来仍会 `focusLeaf` 并 `switchSession`。
- 为何是缺陷：活动会话监听（同文件约 109–118 行）和叶上的 `switchLeafSession`（`conversationLeafSessionBar.ts` 约 124–128 行）都走 `revealSessionWindow`。两扇都已可见时快速互切，先发出、pane 更慢的那次可以在后一次聚焦之后把焦点和活动会话拨回去。测 `conversationSessionWindowReveal.test.ts` 的 latest-wins 只覆盖新建叶的 atomic 路径。
- 触发：并列两扇都可见，连续切换活动会话，且先切的那扇 `whenLeafPaneReady` 更晚返回（pane 未就绪时最多约 2 秒）。
- 已知：否。D99 / D100 只收导航栈 throw 与空 destination。
- 修复方向：已可见快路径在 `focusLeaf` 前若 `state.cancelled` 或已有更新的 reveal，就不要再聚焦。

### BH-10-2

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts` `replaceLeafWithNew` 约 411–412 行；`runReveal` catch 约 326–333 行
- 行为：副窗替换时先 `hideSessionWindowWithoutFire(outgoingKey)`，再 `await ensureLeaf`。建叶抛错时 catch 只 `rollbackHalfAppliedLeaf` 新 key，并把 `primarySessionKey` 设回旧值，不会把刚藏起的副窗 `restoreSessionWindow`。
- 为何是缺陷：叶 SessionBar 在可见数 ≥ 2 时用 `{ replace: this.sessionKey }` 换会话（`conversationLeafSessionBar.ts` `switchLeafSession` 约 125–126 行）。副窗替换失败后，用户要换上去的会话没有窗，原来的副窗也保持隐藏，网格从两扇变成一扇。主窗替换是先 `ensureLeaf` 再藏，这条路径没有这个问题。D97 只给 `openSessionBeside` 的驱逐做了失败恢复。
- 触发：两扇都可见，在副窗的会话下拉里选一个尚未建叶的会话，且 `createConversationEditorPart` / `whenReady` 抛错。
- 已知：否。D96–D98 / D108 只覆盖 `openSessionBeside`。
- 修复方向：藏副窗之前记下 outgoing key，catch 里按 D97 同样 restore。

### BH-10-3

- 严重度：high
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts` `syncSubAgentsFromLiveTree` 约 308–315 行；面包屑读取在 `src/vs/workbench/contrib/conversation/common/conversationAgentHierarchy.ts` `buildAgentHierarchyBreadcrumb` 约 33–38 行
- 行为：catalog 里已有同一 `chatId` 时只在 title 或 model 变化时改这两项，`parentChatId` 保持第一次写入。树上已经没有的节点不会从 catalog 删除。
- 为何是缺陷：面包屑靠 `parentChatId` 往上走。父级在后续活树里变了，条上仍是旧父，点面包屑会 `navigateAgentBreadcrumb` 到旧 agent。子节点还在、父节点已离开树时，旧父仍留在 catalog 里，条上还能点开一个树上已经没有的对话框。
- 触发：同一 session 的活树再推一帧，某个非根 agent 的父级变了，或父节点从树里消失但子节点还在。
- 已知：否。
- 修复方向：已有条目同步 `parentChatId`；本帧未再出现的 tool 条目从该 session catalog 摘掉，已打开的标签是否关闭另定，不要让面包屑继续指向旧父。

### BH-10-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts` `openExtensionTab` 约 366–369 行；对照 `findOpenTabForChat` 约 459–472 行
- 行为：打开扩展标签前只在 `part.activeGroup.editors` 里找同一 resource。`findOpenTabForChat` 会扫该 part 的所有 group。
- 为何是缺陷：`splitSessionWindow`（约 479–496 行）可以在同一会话 part 里加一列。标签已经在另一列时，Fork、Promote（`promoteSubAgentDialog` 约 412 行）和再次 `openExtensionTab` 会在当前列再造一个 `ConversationChatInput`，焦点进新标签，另一列的原标签还在。
- 触发：同一会话拆成两列，子会话标签在非活动列，再执行打开同一 chat 的 Fork / Promote / `openExtensionTab`。
- 已知：否。D85 / D88 只收 throw 通知。
- 修复方向：复用 `findOpenTabForChat`，已有输入就在它所在的 group 里 `openEditor`。

### BH-10-5

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts` `navigateAgentBreadcrumb` 约 186–193 行
- 行为：目标是 `default` 时，只看活动 group 的 index 0。那里不是默认根 `ConversationChatInput` 就直接 return，仍然 `fireCloseNonRootStateChange`。
- 为何是缺陷：面包屑根项由 `buildAgentHierarchyBreadcrumb` 插上（`conversationAgentHierarchy.ts` 约 48–57 行），编辑器页点击会进这个方法（`conversationEditorPane.ts` 约 69–74 行）。根标签被拖离第一位，或当前活动列是拆出来的、根在另一列时，点「根」没有关闭子标签，也没有打开根。
- 触发：子 agent 标签已打开，根标签不在活动 group 的 index 0，点击面包屑根项。
- 已知：否。D87 只收 throw 通知。
- 修复方向：用 `findOpenTabForChat(sessionKey, 'default')` 找到根再打开，不要绑死 index 0。

### BH-10-6

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationNavigationService.ts` `goBack` 约 216–228 行
- 行为：`conversation.navigate.closeChildOnBack` 为 true（默认，`conversationNavigation.ts` 约 20 行）且离开的是扩展标签时，只 `closeEditor(leaving)`，不 `openEditor(destination)`。栈已经 `moveBack`。
- 为何是缺陷：关闭活动编辑器激活的是组内下一次要显示的编辑器，不是导航栈里的 destination。组里还有第三个会话标签，或 destination 的 `groupId` 不是当前列时，后退关掉的是子标签，停住的却是另一个标签；栈索引已经指到 destination，再前进会从错误的可见标签往后走。现有测只锁「根 + 一个子标签」关掉之后只剩根。
- 触发：默认设置下，同一会话组里除根以外至少还有两个扩展标签（或根与子标签分属拆列），从最上面的子标签 Go Back。
- 已知：否。D99 / D100 只收 throw 回滚和空 destination。
- 修复方向：关掉离开的扩展标签之后，若活动编辑器不是 destination，再按 destination 的 `groupId` 打开它。

### BH-10-7

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts` `updateSessionTitle` 约 363–365 行
- 行为：按 `getBoundSessionId()` 找不到会话时，改用 `getActiveSession()` 的 title 写到这根 SessionBar 上。叶的 `sessionKey` 不会跟着改（`conversationLeafSessionBar.ts` 构造时钉死）。
- 为何是缺陷：删会话没有摘掉对应叶（窗口服务只在活动会话仍存在于名单里时 reveal，约 115–117 行）。被删会话的叶还在时，标题变成另一扇正在活动的会话的名字，点这扇叶的 `focusin` 仍 `switchSession` 到旧 key。
- 触发：两扇可见，删掉其中一扇对应的会话，留下的叶 SessionBar 刷新标题。
- 已知：否。D467 只延期「已删除会话的隐藏叶 DOM 不回收」，没有这个标题回落。
- 修复方向：绑定 id 已不在名单里时不要显示活动会话标题；隐藏或标出该叶已失效。

## 看过但未立条

- `ensurePrimaryWindow` / `openSessionBeside` / `tryBootstrapPrimaryWindow` 的半应用回滚和错误通知已由 D90、D96–D98、D108、D111 收口；`goBack` / `goForward` 的 throw 与空 destination 已由 D99、D100 收口。
- Fork / Kill / SessionBar / Sessions 侧栏在 pairing-hold、断连且有连接史、KEEP leftover list-fail 时拒绝写入并通知，属有意 fail-closed。
- Kill 命令不传 `agentId`，roster 用最后一条 streaming agent 或空串（`conversationKillActions.contribution.ts` 与相邻 `killEngineSubAgent`）。贡献注释写明不发明本地 catalog id，不单独立条。
- 相邻 `conversationLens.ts` 约 339–342 行在连接变化时 `bindSessionView(getActiveSessionId())`，可能把别的叶的租约绑到活动会话。调用点不在本清单文件里，未立条。
- `conversationSessionsInlineFilterBox.ts` 清除按钮的 aria-label 与过滤框相同。读屏名称不准，但不会开错会话或关错窗。

## 未读完

- `src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts` 约 220 行之后的确认、复制、删回合、取消工具调用和 regenerate，只对过前面的 bind / pairing-hold 门，没有逐行对照调用方。
- 编辑器组 `closeEditor` 在三个以上标签时具体激活哪一个，没有再读 workbench editor 组实现，BH-10-6 只根据「后退分支不打开 destination」立条。
