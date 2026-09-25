---
title: "潜在缺陷：Navigator"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "Navigator 生产代码里，Team 切会话后旧成员仍可在新会话打开，Agents/Projects 筛选会放出不匹配子节点。"
---

# 潜在缺陷：Navigator

## 结论

读完 `src/vs/workbench/contrib/navigator/` 下 24 个生产 ts。立 7 条。最高是 Team：活动会话已经换掉，成员行仍按旧快照可点，Reveal 会在新会话里打开旧成员。

## 发现

### BH-14-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts` `NavigatorTeamView.scheduleRefresh` 约 223、337 行；`refreshTeamData` 约 397–553 行；成员 `onDidOpen` 约 359–364 行。Reveal 在 `navigatorReveal.ts` `revealNavigatorAgentInConversation` 约 22–41 行读当前活动会话。
- 行为：活动会话一变只把刷新推进 250ms 的 `RunOnceScheduler`，列表不立刻清空，行操作也不关掉。刷新要等 `memberStatus` / `taskList` 回来才重画。这期间点击仍走 `revealNavigatorAgentInConversation`，用的是新的 `getActiveSessionId()` 和旧行的 `memberAgentId`。同一会话上两次重叠刷新也没有代数：先发出的成功或失败可以在后一次画完之后落地，把新成员盖成旧成员，或给新行加上失败注、关掉行操作、把 Inspect 活集写成空集。
- 为何是缺陷：用户点的是屏幕上的旧成员，对话却开在已经切换过去的会话里。晚到的失败还会把当前团队画成读失败。
- 触发：Team 已画出成员后切换活动会话，在刷新返回前点成员行。或同一会话里上一次 `refreshTeamData` 仍在飞，下一次已经画完。
- 已知：无。相邻测试只锁「返回时会话 id 已不同则丢弃」，不锁等待期间的点击，也不锁切回原会话后的晚到响应。
- 修复方向：会话变化时立刻作废代数并禁用行操作；Reveal 带上发起时的会话 id，对不上就不开。

### BH-14-2

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/navigator/browser/navigatorAgentsView.ts` `filterHierarchyNodes` 约 933–945 行；`src/vs/workbench/contrib/navigator/browser/navigatorProjectsList.ts` `filterTreeNodes` 约 536–548 行。两处子节点赋值相同。
- 行为：节点自己命中、但过滤后的子节点长度为 0 时，子节点退回过滤前的 `node.children`。自己命中且至少一个子节点命中时，又只留下命中的子节点。
- 为何是缺陷：筛选词只命中父节点（例如 Agents 的根名，或 Projects 的 Engine / 工作目录名）时，不匹配的子会话或子 Agent 会整棵出现。同一个词若再命中其中一个子节点，其余不匹配的兄弟又被藏掉。
- 触发：树已展开，筛选框输入只出现在父标签上的词。
- 已知：无。
- 修复方向：命中父节点时不要把未过滤的原生子节点塞回去；子节点始终用过滤结果。

### BH-14-3

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/navigator/browser/navigatorProjectsList.ts` `filterTreeNodes` 约 540–541 行，配合 `matchesNavigatorProjectsInlineFilter`。
- 行为：行描述是完整工作目录或父路径，过滤却只把 `description` 按分隔符取最后一段传进去。最后一段通常就是已经显示在名称里的目录名。
- 为何是缺陷：用户按屏幕上的父路径片段筛选（路径中间的目录名），对应的工作目录和它下面的会话不会出现，除非某个会话标题碰巧包含该片段。
- 触发：Projects 里工作目录描述含多级路径，筛选框输入非最后一级的路径片段。
- 已知：无。
- 修复方向：用完整 `description` 做包含匹配，不要只传最后一段。

### BH-14-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/navigator/browser/navigatorProjectsList.ts` `rebuildTree` 约 331–335 行；`openTreeNode` 约 295–298 行；`isProjectsSessionSwitchLive` 约 403–405 行。
- 行为：已经画过树之后，`getRecentlyOpened` 再抛错会直接 return：不重建会话树，并 `markLeftoverSessionSwitchClosed`。会话行还在，点击因 `leftoverSessionSwitchClosed` 被丢掉。外层 catch 才会把末次树标成断连快照；这条内层路径只写最近文件夹失败状态。
- 为何是缺陷：最近文件夹读失败时，引擎会话列表被冻住，而且点会话不会切换。用户看到的仍像可点的会话树。
- 触发：Projects 已成功画过，之后任意 `refresh`（会话变化、活动会话、连接变化）赶上 `getRecentlyOpened` 抛错。
- 已知：无。D146 / D150 / D214 收的是末次树保留和首绘失败，不是这条路径把仍接通的会话点击关掉。
- 修复方向：最近文件夹失败只冻住本地文件夹并标失败；已接通时仍重建会话行并允许 `switchSession`。

### BH-14-5

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/navigator/common/navigatorAgentsActivity.ts` `collectNavigatorActivityItems` 约 88–98 行。截断文案在 `navigatorAgentsView.ts` `setActivityFromSnapshot` 约 725–726 行。时间线条目另有 `orderKey`（`sessionView/types.ts` `TimelineItemView` 约 176–179 行），这里没有用。
- 行为：工具行按 `id` 字符串降序再切前 200。`id` 是带品牌的字符串，不是序号。`tool-9` 会排在 `tool-10` 前面。超过 200 时提示「Showing the latest 200 items」。
- 为何是缺陷：活动列表顺序和被截掉的行都不是时间上最新的一批。超过 200 条时，用户看不到真正较新的工具调用，列表却写着最新 200 条。
- 触发：同一会话工具活动 id 不是等宽字典序，或总数超过 200。
- 已知：无。
- 修复方向：按快照里的时间线顺序截取最新 200，不要按 id 字符串排序。

### BH-14-6

- 严重度：low
- 置信度：中
- 位置：`src/vs/workbench/contrib/navigator/common/navigatorTeamData.ts` `resolveTeamIdForInfo` 约 94–103 行。调用在 `navigatorTeamList.ts` `refreshTeamData` 约 482–488 行，状态会拼进管理者标签。
- 行为：快照没有 `liveTeamId` 时，先按 `managerAgentId` 找团队；找不到就用 `teams[0]`。
- 为何是缺陷：列表里有多个团队且当前管理者不在其中时，成员行前缀会带上另一个团队的 status。
- 触发：`liveTeamId` 为空、`listTeams` 返回多个团队、当前 manager 对不上。
- 已知：无。注释只说从 ListTeams 里取，空列表才不写标题。
- 修复方向：对不上 manager 就不要调用 `teamInfo`，不要回退到 `teams[0]`。

### BH-14-7

- 严重度：low
- 置信度：中
- 位置：`src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts` `refreshTeamData` 成员 `id` 约 500 行。任务 id 约 513 行同样只有 `taskId`。列表 identity 在 `ensureMembersList` 约 353 行。
- 行为：多个 manager 时标签会加前缀，但列表 id 仍是 `member:` 加 `memberAgentId`。两个 manager 返回同一个成员 id 时，虚拟列表把两行当成一行。
- 为何是缺陷：多管理者团队里，后一个成员行会盖住前一个，或只画出一行。
- 触发：`findManagerNodes` 得到至少两个 manager，且 `memberStatus` 的 `memberAgentId` 重复。
- 已知：无。
- 修复方向：列表 id 带上 `managerAgentId`。

## 看过但未立条

- `NavigatorSessionLeaseHolder.refreshLease` 获取失败会清掉 lease 并通知。这是有意失败关闭，对应已关的 D123。
- Agents / Team 断连、配对挂起、树拉取失败时保留上次行并标快照或失败，行操作关掉。已关的 D220、D229、D236、D241、D274 这一类，不把活行装成空成功。
- Inspect 在两侧活集都是 `undefined` 时不标过期。`isInspectTargetStale` 约 138–141 行，GC-5d 有意如此。空集才标过期。
- Projects 点本地文件夹时 `openWindow` 拒绝被吞掉。已关的 D146。会话行本身带 `sessionId`，点击切的是该行的会话，不另立条。
- `getTeamTreeEmptyCopy` 在能力不支持或树还没到时不发成员请求。有意不把「正在读取」画成「没有团队」。

## 未读完

范围内 24 个生产 ts 已读完。测试文件按范围未做审查对象。
