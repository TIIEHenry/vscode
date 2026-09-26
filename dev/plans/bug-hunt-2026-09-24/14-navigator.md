---
title: "Navigator：同会话晚到刷新、筛选回填、最近文件夹失败关点击、活动按 id 截断"
type: plan
status: accepted
phase: M7
updated: 2026-09-24
summary: "Team 同会话重叠刷新可盖住新画；Agents/Projects 筛选回填未命中子节点；最近文件夹失败关掉仍接通的会话点击；活动按 id 字符串截成「最新 200」。"
---

# Navigator：同会话晚到刷新与筛选 / 活动截断

> **本稿是方案，不是实施。**
> **冲突域：** 仅 `src/vs/workbench/contrib/navigator/`。
> **交叉引用：** 活动会话一切，成员行仍按旧 `memberAgentId` 调用 `revealNavigatorAgentInConversation`，而该函数读 `getActiveSessionId()`——这条与 [conversation-bound-session](../conversation-bound-session.md) **S5** 重复。S5 已要求行上带产生该行的 `sessionId`，Reveal 传行戳、禁止再读 `getActiveSessionId()`。本稿**不另起** Reveal / 行戳实施切片。同会话两次 `refreshTeamData` 没有代数，不在 S5 的「session / lease 对不上则丢弃」里，见 §3 S1。

## 核查

| ID | 判定 | 理由 |
|:---|:-----|:-----|
| BH-14-1 | 成立 | `onDidChangeActiveSession` 只 `scheduleRefresh()`（`navigatorTeamList.ts` 约 224、337 行），250ms 内不关行操作。`revealNavigatorAgentInConversation` 约 22 行仍读当前活动会话。同会话重叠刷新在 `refreshTeamData` 约 521、540 行只比对会话 id，没有代数。Reveal 串会话归 S5，不单独立项。 |
| BH-14-2 | 成立 | `filterHierarchyNodes` 约 941 行与 `filterTreeNodes` 约 545 行：自身命中且过滤后子节点长度为 0 时，子节点退回过滤前的 `node.children`。 |
| BH-14-3 | 成立 | `filterTreeNodes` 约 540–541 行把 `description` 按分隔符取最后一段再交给 `matchesNavigatorProjectsInlineFilter`。工作目录行的 `description` 是完整路径（`navigatorProjectsTree.ts` 约 91、111 行），屏幕上的中间目录名匹配不到。 |
| BH-14-4 | 成立 | `rebuildTree` 约 331–335 行：已画过树之后 `getRecentlyOpened` 失败直接 `return`，并 `markLeftoverSessionSwitchClosed`。会话行还在，`openTreeNode` 约 296 行因 `isProjectsSessionSwitchLive` 丢掉点击。外层 catch 的断连快照不走这条内层路径。 |
| BH-14-5 | 成立 | `collectNavigatorActivityItems` 约 88–98 行按 `id` 字符串降序再 `slice(0, 200)`。`id` 是品牌字符串（工具行用 `callId`）。`setActivityFromSnapshot` 约 726 行在截断时写 “Showing the latest 200 items”。`TimelineItemView.orderKey` 约 178 行写明展示不得按 `orderKey` 排序，本条不改用它。 |
| BH-14-6 | 成立 | `resolveTeamIdForInfo` 约 102–103 行：没有 `liveTeamId`、管理者对不上时用 `teams[0]`。`refreshTeamData` 约 482–501 行把 `teamInfo` 的 status 写进管理者标签；`managers.length > 1` 时该标签成为成员行前缀。单管理者时前缀为空，错误 status 不上屏，但多管理者前缀会带上另一支团队的 status。 |
| BH-14-7 | 成立 | 成员 `id` 约 500 行是 `` `member:${row.memberAgentId}` ``，任务约 513 行是 `` `task:${row.taskId}` ``。`ensureMembersList` 约 353 行用该 `id` 做列表 identity。两个 manager 返回同一个 `memberAgentId` 时，两行共用一个 identity。 |

## Problem class

- **症状：** Team 上一次刷新的成功或失败落在同会话后一次画完之后；筛选词只命中父节点时放出全部子节点，再命中一个子节点时又藏掉兄弟；Projects 按路径中间段筛不到工作目录；最近文件夹读失败后会话行还在但点了不切换；活动列表自称最新 200 条，顺序却是 id 字典序。
- **类标签：** **在飞结果没有代数** + **过滤回退到未过滤子树** + **失败路径误关仍接通的点击**。
- **复发机制：** 新的 await 只比对会话 id；树过滤用「父命中则塞回原子节点」；失败分支复用 leftover 的「关掉行操作」。

## 0. 一句话结论

同会话的 Team 刷新用代数丢掉晚到的成功和失败。筛选后的子节点只用过滤结果。最近文件夹失败只冻住本地文件夹。活动按快照数组顺序保留末 200，不按 id 重排。Reveal 身份只走 S5。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 活动会话 / 连接 / team runtime 只 `scheduleRefresh`，`RunOnceScheduler` 250ms 后才 `refreshTeamData` | `navigatorTeamList.ts` |
| 成员 `onDidOpen` 在 `isTeamRowActionLive()` 为真时把 `memberAgentId` 交给 Reveal；Reveal 用 `getActiveSessionId()` | 同文件约 359–364 行；`navigatorReveal.ts` 约 22–41 行 |
| await 之后若活动会话 id 变了则 return（成功与 catch 都有）。同一会话、后一次已经 `setMemberEntries` 之后，先发出的成功仍会 `setMemberEntries`，先发出的 catch 仍会 `markLeftoverRowActionsClosed`、写失败注、把 Team 活集设成空集 | `refreshTeamData` 约 521–552 行 |
| 现测只锁「返回时会话 id 已不同则丢弃」 | `navigatorTeamSubviews.test.ts`（stale success / stale failure） |
| S5：行戳 + Reveal 禁止再读 `getActiveSessionId()`；`refreshTeamData` 记下 session / lease，对不上则丢弃 | [conversation-bound-session](../conversation-bound-session.md) §3 第 5 点 |
| 父节点命中且过滤子节点为空 → `children` 用原来的 `node.children` | `navigatorAgentsView.ts` `filterHierarchyNodes`；`navigatorProjectsList.ts` `filterTreeNodes` |
| 工作目录节点 `description` 为完整 `workDir`；本地文件夹 `description` 为 `splitRecentLabel` 的父路径，渲染进描述 | `navigatorProjectsTree.ts`；`navigatorProjectsList.ts` `ProjectNodeRenderer` / `ProjectFolderRenderer` |
| 过滤只传入 `description` 最后一段 | `filterTreeNodes` 约 540–541 行 |
| `getRecentlyOpened` 抛错且已有 `localFolderEntries` 或 `treeNodes`：不重建树，`leftoverSessionSwitchClosed = true`，只 `setRecentsStatus` | `rebuildTree` 约 331–335 行 |
| 会话点击要求 `isProjectsSessionSwitchLive()` | `openTreeNode` 约 295–298 行；约 403–405 行 |
| 外层 catch 才 `surfaceLastGoodAsStale` | `rebuildTree` 约 388–393 行 |
| 工具活动先按 id 降序再切 200；截断文案 “Showing the latest 200 items” | `navigatorAgentsActivity.ts`；`navigatorAgentsView.ts` 约 725–726 行 |
| `orderKey` 不透明，展示不得按它排序 | `sessionView/types.ts` `TimelineItemView` 约 178 行 |
| 无 `liveTeamId` 时按 `managerAgentId` 找 `ListTeams`，否则 `teams[0].teamId`。空列表返回 `undefined`，不调 `teamInfo` | `navigatorTeamData.ts` `resolveTeamIdForInfo`；`listTeamsForInfo` |
| 现测把「对不上 manager 则用第一支」锁死 | `navigatorTeam.test.ts` `empty liveTeamId uses matching manager team, else first` |
| 多 manager 时标签前缀含 `teamInfo.status`；列表 id 不含 `managerAgentId` | `refreshTeamData` 约 497–516 行；identity 约 353 行 |
| `UniverseAgentTeamListEntry` 已有 `teamId` / `status` / `managerAgentId`。本稿不新增字段 | `universeAgentTypes.ts` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A** 同会话刷新代数；子节点只用过滤结果；描述用全文；最近文件夹失败不关仍接通的会话点击；活动按快照顺序取末 200；对不上的 manager 不调 `teamInfo`；列表 id 带 manager | §3 | **选定** |
| B 会话一变立刻清空 Team 并禁用点击，以此代替行戳 | 与 S5 的「点旧行打开产生该行的会话」冲突 | **拒绝。** Reveal 身份只交叉引用 S5 |
| C 用 `orderKey` 排序活动 | `TimelineItemView` 已写明展示不得按 `orderKey` 排序 | **拒绝** |
| D 父节点命中时继续塞回未过滤子节点，方便「看到整棵」 | 这就是 BH-14-2 | **拒绝** |
| E 最近文件夹失败继续 `markLeftoverSessionSwitchClosed` | 引擎仍接通时会话行被冻住且点不了 | **拒绝** |
| F manager 对不上时继续 `teams[0]` | 多 manager 前缀会带上另一支团队的 status | **拒绝** |

## 3. 选定设计

### S1 Team 同会话刷新代数

`refreshTeamData` 每次进入（通过 250ms 调度器真正开始时）把代数加一，闭包记下本次代数、本次 `sessionId`、本次 lease。每一个 `await`（`listTeamsForInfo`、`teamInfo`、`memberStatus`、`taskList`）之后：

- 代数不是当前值，或活动会话 id 不是本次 `sessionId`，或 lease 不是本次记下的那份：**成功与 catch 都丢弃**。不得 `setMemberEntries` / `setTaskEntries`，不得 `markLeftoverRowActionsClosed`，不得把失败注写到当前画，不得 `setLiveAgentIds('team', 空集)` / `setLiveTaskIds(空集)`。
- 只有仍是当前代数、会话与 lease 都对得上，才允许现有的成功画或失败画。
- [conversation-bound-session](../conversation-bound-session.md) §3 第 5 点里「`refreshTeamData` 记下 session / lease，对不上则丢弃」在实施时改成：代数、session 或 lease 对不上则丢弃，代数以本稿 S1 为准。不重写该方案其余句子。后做 S5 的人不得按旧句把代数拿掉。

不变量：后一次刷新已经画完之后，先一次的 resolve 或 reject 不再改成员、任务、行操作开关、Inspect 活集。会话 id 已经不同的丢弃保持。行戳与 Reveal 不在本切片，见 S5。

### S2 过滤子节点不回退

`filterHierarchyNodes` 与 `filterTreeNodes` 同一不变量：节点留下，当且仅当自身命中或过滤后的子节点长度大于 0。留下时 `children` **等于**过滤后的子节点（可以是空数组）。禁止在自身命中且过滤子节点为空时写回 `node.children`。

不变量：筛选词只出现在父标签上时，不匹配的子会话 / 子 Agent 不出现。同一个词再命中一个子节点时，行为与「子节点始终用过滤结果」一致，不出现「命中一个就藏掉其余、一个都不命中反而全放出」。

### S3 Projects 描述用全文匹配

`filterTreeNodes` 把该行完整 `description` 传给 `matchesNavigatorProjectsInlineFilter`，不再 `split(/[/\\]/).pop()`。`matchesNavigatorProjectsInlineFilter` 的包含匹配保持。无 `description` 时仍只匹配 `label`。

不变量：屏幕上工作目录描述或本地文件夹父路径里的任意一段，都能命中该行（以及因此保留的命中祖先）。最后一段不再被单独拿出来代替全文。

### S4 最近文件夹失败不关仍接通的会话点击

`getRecentlyOpened` 抛错且已经成功画过：

- 保留上次成功的 `localFolderEntries`。禁止落到约 340–342 行：那里在 `recentsFailureCopy` 存在时会把 `localFolderEntries` 换成仅当前文件夹。
- `setRecentsStatus(失败文案)`。禁止再经 `withRecentsFailureNote`（约 476–488 行）把失败文案挂成树上的 note。
- **不**因此 `markLeftoverSessionSwitchClosed`。
- 引擎仍接通且会话列表能力不是「还不能当活列表」时，继续用当前 roster 重建会话行，并按重建结果决定 `leftoverSessionSwitchClosed`（未接通、能力 UNKNOWN、KEEP leftover list-fail 才关）。未接通时仍走原早退，不把点击开关留在「仍接通才重建」的早退上。
- 外层 catch 的 `surfaceLastGoodAsStale` 不动。配对挂起分支仍在约 344 行之后，不断连、不改首绘失败的已有分支。

不变量：最近文件夹读失败时，本地文件夹停在上次成功的那份并标失败；已接通的会话行仍按本次 roster 重画，点击仍 `switchSession`。不得把「最近文件夹失败」画成断连快照。

### S5 活动按快照顺序取末 200

`collectNavigatorActivityItems`：按 `snapshot.timeline` 的数组顺序收录 `kind === 'tool'`，再按 `overlay.blocks` 的数组顺序补上尚未出现的 id。不去重以外的重排。截断取该序列的**末** `NAVIGATOR_ACTIVITY_MAX_ITEMS`（200）条，再反转成新的在上（与 [navigator-engine-segments](../navigator-engine-segments.md) §2.3「最新在上」一致）。禁止按 `id` 字符串排序。禁止按 `orderKey` 排序。截断文案仍只在 `navigatorActivityTruncated` 为真时出现，且截掉的是序列前部，不是字典序较小的 id。

不变量：`tool-9` 与 `tool-10` 的相对顺序等于它们在快照数组里的相对顺序。超过 200 时列表是该序列的末 200，文案 “Showing the latest 200 items” 指这 200 条。

### S6 对不上的 manager 不借用 `teams[0]`

`resolveTeamIdForInfo`：`liveTeamId` 有值则用它。否则只返回 `managerAgentId` 相等的那条 `teamId`。没有相等项则 `undefined`，**不**读 `teams[0]`。`refreshTeamData` 仅在返回值不是 `undefined` 时调用 `teamInfo`。空 `ListTeams` 仍不写团队 status（现有空列表行为保留）。

不变量：多 manager 且某个 manager 不在 `ListTeams` 里时，该组前缀没有另一支团队的 status。匹配到的 manager 仍可以带上自己的 status。

### S7 列表 identity 带上 manager

成员 id 包含 `managerAgentId` 与 `memberAgentId`。任务 id 包含 `managerAgentId` 与 `taskId`。`identityProvider.getId` 继续用条目 `id`。不改 `memberAgentId` / `taskId` 字段本身，Inspect 仍用原来的成员 / 任务字段。

不变量：两个 manager 返回同一个 `memberAgentId` 或同一个 `taskId` 时，列表里是两行，后一行不替换前一行。

## 4. 不做

- 不实施 S5 的行戳、可见叶、`openSubAgent` / 面包屑分支。那些只引用 [conversation-bound-session](../conversation-bound-session.md)。
- 不按 `orderKey` 排序，不解析 `orderKey`，不新增协议字段。
- 不改配对挂起、断连、能力 UNKNOWN、KEEP leftover list-fail 已经关掉行操作的路径。
- 不把最近文件夹失败改成外层 catch 那种断连快照。
- 不在 Team 单管理者（前缀本来就是空的）上发明一段新的团队 status 文案。
- 不改 `src/vs/workbench/contrib/navigator/` 以外的文件。

## 5. 验证

本地点名即可。门禁见 [health-gates](../../progress/health-gates.md)。不要重开托管 workflow。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| S1 | `navigatorTeamSubviews.test.ts` 已锁「会话 id 变了之后，在飞的成功 / 失败不覆盖新会话」 | 同一 `sessionId`、同一 lease：第一次 `memberStatus` 挂起，第二次已画完，再 resolve 第一次不得改成员标签；第一次 reject 不得 `markLeftoverRowActionsClosed`、不得把失败注盖上、不得把 Team 活集写成空集 |
| S2 | `navigatorAgentsInlineFilter.test.ts`、`navigatorProjectsInlineFilter.test.ts` 只锁单字符串包含 | 父标签命中、子标签都不命中 → 子节点长度为 0。父与一个子命中 → 只留该子，不含未命中兄弟。Agents 与 Projects 各一条 |
| S3 | `navigatorProjectsInlineFilter.test.ts` 对传入的 description 做包含匹配（含中间段 `user`） | `filterTreeNodes` 对 `description` 为 `/home/user/my-projects`、查询 `user` 的工作目录行必须留下。查询只等于最后一段时仍留下 |
| S4 | `navigatorProjectsList.test.ts` `getRecentlyOpened throw after first paint keeps last-good tree` 只锁文件夹 id 还在 | 已接通且会话列表可用时，该抛错之后 `leftoverSessionSwitchClosed` 仍为假，`openTreeNode` 仍调用 `switchSession`；本地文件夹 id 仍是上次成功的那份；失败文案在 recents status，树上不出现断连快照注 |
| S5 | `navigatorAgentsActivity.test.ts` `truncates beyond 200 items` 只锁长度为 200 | id 为 `t-9` 与 `t-10`、且 `t-9` 在数组中更靠后时，`t-9` 排在 `t-10` 前面（新的在上）。201 条按数组顺序时，结果是末 200 的倒序，不是字典序最大的 200 个 id |
| S6 | `navigatorTeam.test.ts` 现断言 `mgr:missing` → `teams[0]` | 该断言改为 `undefined`。匹配的 manager 仍返回其 `teamId`。`refreshTeamData`：两个 manager、只有一个在 `ListTeams` 里时，对不上的那组前缀不含另一支的 status，且 `teamInfo` 不被用那个 `teamId` 调用 |
| S7 | `navigatorTeamSubviews.test.ts` 成员行只用一个 `memberAgentId` | 两个 manager、同一个 `memberAgentId`：列表长度为 2，两行 id 不同。任务同理 |

针对性运行：`scripts/test.sh` 点名上表文件（或仓库等价的 `scripts/test-node.sh` / `scripts/test-browser.sh` 里已覆盖这些文件的入口）。分层未改，不必跑 `npm run valid-layers-check`。
