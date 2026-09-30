---
title: "方案 r03：sessions"
type: plan
status: accepted
phase: N/A
updated: 2026-09-30
summary: "2026-09-30 用户签收。未实施。多聊天审批、解析中的配置记忆、Agent 写入目标和分栏恢复仍要改；提交后被清掉的是用户文件，Changes 与 Files 在默认单栏会重开。"
---

# 方案

核查：hold 4（r03-1、r03-2、r03-3、r03-5），weaken 1（r03-4），drop 0。

## r03-1（hold，高）

**问题类：** 分组会话的权限芯片读写组内第一个聊天，当前聊天按自己的级别发送。

**不变量：** 芯片读到的级别、`setPermissionLevel` 写到的级别，和 `_sendExistingChat` 放进 `modeInfo.permissionLevel` 的级别，是同一条聊天的 `permissionLevel`。组内新建聊天的起始级别等于当时芯片显示的级别。

**要动：**

- 芯片和 `createNewChat` 的调用方传入这次输入的 chat resource，形状对齐已有的 `setModel(sessionId, chatResource, ...)`。`CopilotChatSessionsProvider.setPermissionLevel` 用 `_sessionCache.get(resource)` 读写，不把组 id 交给 `_findChatSession`。提供者构造函数没有活动会话，组 id 对不上缓存键（键是 resource 字符串）。不要改去读窗口活动会话：并排的另一条会话的 `activeChat` 不能代表这次输入。
- `CopilotPermissionPickerDelegate` 的 `currentPermissionLevel` 与 `setPermissionLevel`：用这次输入的 chat resource 读写 `permissionLevel`，不调用 `provider.getSession(session.sessionId)`（那会落到组内第一个聊天）。
- 产品入口 `AddChatToSessionAction.run`（`sessionsActions.ts` 约第 670 行）只把会话交给 `openNewChatInSession`。`createNewChatInSession`（`sessionsManagementService.ts` 约第 623 行）只传 `session.sessionId`。`_createNewSubsequentChat` 第 2079–2080 行取组内第一个聊天，只用来带 workspace、model、parent（第 2089、2106、2108 行）。第 2109 行仍调用 `_defaultPermissionLevel()`。有 `activeChat` 时把 `activeChat.resource` 传到 `createNewChat`，后续聊天的起始级别用这条聊天的 `permissionLevel`。首个会话在 `createNewSession` 里用 `_defaultPermissionLevel()` 的播种保持不动。保留 `_newSessions` 提前返回（约第 1828–1834 行）。

**不改：** `_findChatSession` 对归档、分支、隔离等其它调用方的回退；分组 `sessionId` 的形状。不要把「`_sendExistingChat` 已从该聊天自己的 `permissionLevel` 取发送级别」写成会失败的回归断言：那是现码已经成立的行为，锁不住芯片。

**本地验证：** `scripts/test.sh --grep "new session default permission level"` 里已有三条（`CLI session seeds permission level from chat.permissions.default`、`clamps to Default when chat.tools.global.autoApprove policy is false`、`falls back to Default when chat.permissions.default is unset`）继续通过。新断言放在权限芯片与 `createNewChat`：两个聊天级别不同时，活动聊天的 resource 被读写，另一个不变；新聊天的级别等于该 resource 当时的级别。

## r03-2（hold，高）

**问题类：** 新会话配置还在解析时，`setSessionConfigValue` 先把选择写入 remembered，再丢掉当前草稿。

**不变量：** `isResolvingConfig` 为真时，这一次写入既不进 `STORAGE_KEY_REMEMBERED_SESSION_CONFIG_VALUES`，也不改当前草稿的 config。解析结束后的下一次成功选择仍按「策略 > remembered > 设置」播种下一份草稿。

**要动：** `BaseAgentHostSessionsProvider.setSessionConfigValue`。对 `_getNewSession` 命中且 `isResolvingConfig.get()` 为真的路径，在写 remembered 之前返回。隔离开关 `_applyIsolationValue` 和审批确认后的 `setSessionConfigValue` 都走这一处，改提供者即可盖住两条入口。

**不改：** `_initialNewSessionConfig` 的优先级；`isRememberedSessionConfigKey` 排除分支名；解析中丢弃当前草稿这一决定本身；运行中会话走 `_runningSessionConfigs` 的后半段；选择器的 disabled / `aria-disabled` 表现。

**本地验证：** `scripts/test.sh --grep "setSessionConfigValue remembers portable string picks"` 与 `--grep "createNewSession gives remembered autoApprove precedence"` 继续通过。在 `localAgentHostSessionsProvider.test.ts` 新增断言：解析屏障未放开时调用 `setSessionConfigValue` 写 `autoApprove` 或 `isolation`，remembered 与当前 `getSessionConfig().values` 都保持调用前的值；随后 `createNewSession` 的种子不含这次被丢掉的值。

## r03-3（hold，中）

**问题类：** `setAgent` 只收会话 id，非窗口活动会话上的选择写到该会话的默认聊天。

**不变量：** 某条聊天输入里的 Agent 选择写入 `setChatAgent` 的 resource 就是这条聊天。窗口活动会话的 `activeChat` 只属于窗口活动会话，不能代表并排的另一条会话。

**要动：**

- `IAgentHostSessionsProvider.setAgent` 增加聊天 resource，形状对齐已有的 `setModel(sessionId, chatResource, ...)`。
- `BaseAgentHostSessionsProvider.setAgent` 把该 resource 交给 `cached.setChatAgent`。`_activeChatResource` 只被这一处调用，改完后删掉，避免留下第二条猜测。
- `AgentHostAgentPickerContribution._selectMode` / `_setAgent` 传入这份 `ISessionContext` 会话的 `activeChat.resource`，与 `sessionModelSelection.ts` 里 `setModel` 的取法相同。`ISession.resource` 在 `VisibleSession` 上转发给默认聊天，不能拿它当触发这次选择的聊天。
- `LocalAgentHostSessionsProvider` 里把草稿 agent 拷到替换会话的那次 `setAgent`（约第 383 行）改为传入 `replacementChat.resource`，与紧挨着的 `setModel` 一致。

**不改：** `setModel` 的参数与写入；`VisibleSession.mode` 按该可见会话的 `activeChat` 派生；草稿迁移仍然复制的是 main chat 上的 agent，只补 resource，不改复制哪一条。

**本地验证：** `setAgent updates existing session agent` 与 `createSideChat inherits model and agent selection from the source peer chat` 改为传入当时那条聊天的 resource（单聊天用例传该聊天 resource，同伴用例传 `peer.resource`），然后再要求它们通过。不要为了让旧的 `(sessionId, agent)` 调用原样通过而保留 `_activeChatResource`。新增断言：窗口 `activeSession` 是另一条会话时，以同伴 resource 调用 `setAgent`，只有同伴的 mode 变。`scripts/test.sh --grep` 跑这两条和这条新断言。

## r03-4（weaken，降为低）

**问题类：** 草稿换成资源不同的正式会话时，当前编辑区的 working set 没有记到正式资源上，套用结果是 `'empty'`，用户打开的普通文件编辑器被关掉。

**反证：** `sessions.layout.singlePaneDetailPanel` 默认 true，`workbenchFactory` 因此创建 `SinglePaneWorkbench`，布局贡献只装 `SinglePaneLayoutController`。空 working set 套用结束时 `_withSessionLayoutRestore` 会发出 `onDidEndSessionLayoutRestore`。`SinglePaneDockedTabsCoordinator` 在该事件上以 `openDefaultsIfEmpty: true` 再 reconcile；组已被清空时 `_reconcileCore` 会重新打开 Changes 和 Files。默认单栏下这两枚托管标签的最终状态是开着的。另外 `_sendFirstChat` 在替换前已把草稿标成 `InProgress`，替换当时的 `previousSession.status` 往往已不是 `Untitled`，保存会执行，但键是草稿 resource；正式 resource 在 `_applyWorkingSet` 里仍然落到 `'empty'`。

**不变量：** 提交替换套用之前，正式会话 resource 上已有草稿当时的编辑区 working set。套用后，用户打开的非托管编辑器仍在。单栏在恢复结束后重开 Changes 与 Files 的结果保持。

**要动：** `BaseLayoutController` 里活动会话切换时的 `_saveWorkingSet` / `_applyWorkingSet`，以及 `_onSessionReplaced`。在 `_applyWorkingSet` 读取正式 resource 之前，把当前编辑区 working set 记到 `to.resource`。以套用时读到的集合为准，不依赖这两个监听的注册顺序。

**不改：** `SinglePaneDockedTabsCoordinator` 的 `openDefaultsIfEmpty` 重开；离开仍为 `Untitled` 的未发送草稿时不把 working set 记到别的会话；`_onSessionReplaced` 已经搬走的编辑区显隐和面板视图。

**本地验证：** 已有 `[managed tabs / submit] activates Changes after changes arrive on a resource-replace submit` 只断言托管标签，且测试桩的 `applyWorkingSet` 不关编辑器，不能当作本条的验收。拆开两条断言，不要在「已经打开用户文件」的同一次断言里要求 Files 占位仍在：打开 `file` / `vscode-remote` 文件时协调器会去掉 Files，组不空时也不会按空组规则补回。一条断言正式 resource 上 `applyWorkingSet` 的参数不是 `'empty'`，且参数的 `id` 或 `name` 含该 resource。共用桩的 `saveWorkingSet` 只返回 `{ id, name }`（`layoutControllerTestUtils.ts` 约第 714 行），不要断言返回对象里有编辑器列表。夹具必须把 `visibleEditorsList` 设成这次打开的用户文件（约第 625 行）。失败条件仍是参数，不是「编辑器仍在组里」。另一条沿用现有空集合夹具，断言单栏恢复结束后 Changes 与 Files 仍被重开。`scripts/test.sh --grep "resource-replace submit"` 与这两条一起跑。

## r03-5（hold，中）

**问题类：** 分栏恢复把会话 `loading === false` 当成目录已到齐，已登录的 agent host 会话在同伴聊天到达前结束恢复并清掉已存布局。

**不变量：** 已存分栏在「保存的聊天都已出现」或「目录快照已经到齐且确实没有那些聊天」之前保持 `_restorePending`。到齐之前不 `_removeEmptyGroups`、不 `_persistLayout`。目录到齐后仍缺的聊天按已删除处理，栏可以收起。已登录且 `authenticationPending` 已为 false、但 `applyChatCatalog` 尚未写入同伴时，恢复继续等。

**要动：**

- `ChatGroupsView._reconcile`：结束条件去掉 `catalogSettled = !session.loading`。改为读 `ISession` 上的目录已应用 observable，`VisibleSession` 转发它。信号若只写在适配器私有状态上，视图读不到。
- Agent Host 适配器构造时该标记为假。标成真的那次 `_applyChatCatalog` 必须发生在 root capabilities 已经到达之后。capabilities 仍未知时，`surfacesAsPeer` 会滤掉还不能判断的 peer，`survivingPeers.size === 0` 时提前返回（约第 1189 行）；这次写入保持未到齐。capabilities 到达后已有的 autorun 会再套用，那时才标真。其它从未调用 `applyChatCatalog` 的会话（含 Copilot 多聊天和现有测试夹具）缺省为真，这样「目录已到、保存的聊天不在其中」仍收成 1 栏。缺省若是「未到齐」，那些会话不再收栏。
- `chatGroupsView.test.ts` 的 `TestActiveSession` 要能表达「目录未到齐」，且 `loading` 仍可为假。现有「目录已到、保存的聊天不在其中」的夹具保持目录已到齐，这样收起行为还在。

**不改：** `authenticationPending` 的含义与粘住为 false 的行为；`ISession.loading` 对其它调用方的含义；`_tryRestoreLayout` 在草稿（`isCreated === false`）上不恢复网格。

**本地验证：** `scripts/test.sh --grep "restoration settles when an already-loaded catalog no longer contains a saved chat"` 仍期望栏数变为 1。同文件新增断言：已存两栏、恢复时 `loading` 为 false 且可见聊天只有默认聊天、目录标记为未到齐，第一次 reconcile 后栏数仍大于 1 且存储的布局未被写成空；把同伴加进 `visibleChatTabs` 并标记目录到齐后，同伴进入保存的那一栏。

## 审查

2026-09-30 只读审查后改稿。Critical：r03-1 芯片不走按组 id 的 `setPermissionLevel`，改为传入这次输入的 chat resource。Important：r03-3 用 `activeChat.resource`，旧测试改为传入 resource；r03-4 把用户文件与 Files 占位拆成两条断言；r03-5 在 `ISession` 上点名目录已应用标记，其它会话缺省为真。Minor：共用桩不关编辑器，失败条件改成 `applyWorkingSet` 参数。均已写入正文。

2026-09-30 第二轮。无 Critical。Important：后续聊天的起始级别从第 2109 行的 `_defaultPermissionLevel()` 改成传入的 `activeChat`；`applyWorkingSet` 只断言 `id` / `name`，夹具设置 `visibleEditorsList`；目录标记等到 root capabilities 到达后再标真。均已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
