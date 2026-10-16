---
title: "对话动作失败、未归因变更与空任务列表"
type: plan
status: draft
phase: M7
updated: 2026-10-16
summary: "Kill、Retry、delete/edit/fork/队列失败与 AutoDrive 空列表维持现有行为。缺 path 或 operation 的 file_mutation 仍不归因，只加计数。mailbox 的 fail_closed 跳过不改。未实施。不升 PRD。"
---

# 对话动作失败、未归因变更与空任务列表

> **触发：** [功能缺口审查 2026-10-16](review-2026-10-16-feature-gaps.md) G8、G9、G12、G13、G14、G18。
> **不推翻：** [engine-gap-queue-send-attachments](engine-gap-queue-send-attachments.md) 的生成中禁用 Send。不签收 G-CORE-2 的 S5。不升 PRD。

## 1. Kill 与 Continue

`workbench.action.conversation.killSubAgent` 以 `f1: true` 注册（`conversationKillActions.contribution.ts:69-77`）。子代理浮层 `renderChrome` 已有打开为标签、最大化、关闭（`conversationSubAgentOverlay.ts:121-157`）。没有的是 Kill。窄宽 More 菜单的动作是 Tune、权限和输入区高度（`conversationLensComposerChrome.ts:342-366`），`:341` 另有当前 Agent 说明。Navigator 生产代码不调用该命令。Team 写操作仍由 `navigatorTeamSubviews.test.ts` 负向锁住。

错误回合在 `retryable === true` 时画 Retry，点击 `onRetryError`（`conversationTimelineRenderer.ts:812-828`）。没有第二条 Continue。

**本切片不加入口，不新增续写。** 命令面板里的 Kill 保持。Retry 仍只出现在可重试的错误回合上。streaming 期间不另发 Chat。

**明确不改：** 不改 `tryKillSubAgent` 的请求形状。不把 Kill 放进 Team，也不放进浮层的现有三钮。不改 More 菜单的现有动作和当前 Agent 说明。不改这条命令的 `f1` 注册。

**验证：** `conversationKillActions.contribution.test.ts` 保持现有的焦点与通知断言。它不断言 `f1: true`，本切片也不让它改口。时间线测试里不可重试的错误回合没有 Retry 按钮。

## 2. 失败不回滚

`dispatchEngineAction` 在拒绝时先跑可选的 `recover`，再发 `_onDidFailEngineAction`（`conversationEngineRosterService.ts:1015-1028`）。`setEngineSessionGoal` 在 `:1065` 记下 `previous`，`:1066` 调度发出，`:1077` 才 `sessionGoals.set`。不要把这次 `set` 挪到 `dispatchEngineAction` 之前。拒绝时 `restoreSessionGoal`（`:1085-1091`）。公开的 `setSessionGoal` 在 `:450`。

下列路径在 RPC 前不改名册、不改消息正文、不改队列项，也没有 `recover`：

- `deleteEngineMessage`（`:1321-1338`）
- `editEngineMessage`（`:1518-1541`）
- `forkEngineSubAgent`（`:1121-1145`）
- `killEngineSubAgent`（`:1182-1206`）
- 队列转发（例如 `retryQueueItem` 在 `:1504-1512` 只 `fire` 会话变更，不写入队列项）

已连接或曾连接（`wasEverConnected`）时 `getMessageQueueState` 返回空队列（`:633-635`），`setMessageQueueFixture` 也不写入（`:640-643`）。断连缓存同样没有可收回的队列项。不给断连路径补队列回滚。

**本切片不加 recover。** 拒绝仍只发 `_onDidFailEngineAction`。goal 的写后回滚保持。

**验证：** `conversationEngineRosterService.test.ts` 里 `connected remaining writes ok:false reports onDidFailEngineAction` 与对应的 remote throw 只断言 fork / kill / delete / edit 的失败事件。本切片不改这些断言，也不新增「投影与发出前相同」。goal 拒绝仍回到 `previous`。

## 3. 缺字段的 file_mutation

`parseFileMutation` 在值不是对象时于 `:371-372` 返回 `undefined`，在对象缺 `path` 或 `operation` 时于 `:376-377` 返回 `undefined`。`onToolRuntimeSnapshot` 在 `:176-178` 见到假值就 `return`。历史信封 `emitHistoryEnvelopeMutations` 在 `:278-280` 见到假值就 `continue`。两条都不调用 `onRecord`。不读 `arguments_json`。

**本切片：** 计数只加在 `:376-377` 这条缺字段返回上，因此 snapshot 与历史都会计到。非对象和空 payload 不加。`FileMutationJoin` 上的 `unattributedDropCount` 加一。不发出 `IFileMutationRecord`。Review、归因和 ReviewNav 不订阅这个计数，不画新行。以后若要可见提示，锚点是已有的 `.sources-review-status`，不在本切片接上。

**明确不改：** 不解析 `arguments_json`。不发明 path。完整的 path + operation 仍按现有键去重发出。

**验证：** `fileMutationJoin.test.ts` 增加：对象缺 path、缺 operation 时，snapshot 与历史各使 `onRecord` 次数为 0，计数各加一。非对象不加计数。已有的带 path 与 operation 的用例仍发出一条。

## 4. mailbox 与 AutoDrive

`streamReopenSkipReason` 在 `failClosedSessions` 含该会话时返回 `'fail_closed'`（`sessionViewHost.ts:1914-1915`）。`scheduleStreamReopen` 与 `fireStreamReopen` 遇到该原因就计数并返回，不 `postAndDrain(connectionUp)`（`:1937-1940`、`:1961-1964`）。[engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) 的 G-CORE-2 已写明溢出后停在 closed，要第二次 `connectionUp` 才开流。S5 未签收。

**本切片不改跳过条件，不改条幅。** closed 继续表示未重开。

`getAutoDriveTasks` 在已连接或曾连接时返回 `[]`，fixture 写不进去（`conversationEngineRosterService.ts:647-665`）。注释写明没有任务列表 RPC，Team.TaskList 留在 Navigator（`conversationStubService.ts:266-270`）。Inbox 测试断言没有 `.conversation-lens-inbox-task`。

**本切片不接 TaskList，不画任务行。** 空数组继续表示没有这份列表，fixture 不得冒充引擎任务。

**验证：** `sessionViewHostReopen.test.ts` 里 fail_closed 仍跳过 reopen。`conversationEngineRosterService.test.ts` 的 `connected AutoDrive ignores fixture and stays empty` 保持。`conversationInboxOverlay.test.ts` 仍断言没有任务节点。
