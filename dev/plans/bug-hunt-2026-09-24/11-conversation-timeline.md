---
title: "对话时间线：多列定位、提问回传与行投影"
type: plan
status: accepted
phase: M7
updated: 2026-09-25
summary: "非过滤透镜只留最后一块、提问按插入序前缀回传、工具正文只读。2026-09-25：缺 attribution 的 text 行改为中性只读，不再画成助手。"
---

# 对话时间线：多列定位、提问回传与行投影

本稿是方案，不是实施。冲突域只限 conversation 的透镜阅读列、时间线、轨迹、turn 渲染、session view、process fold、visualize、engine frame source。不要改窗口服务与 composer（另路 10/12）。与 [conversation-stream-timeline.md](../conversation-stream-timeline.md) 或 [conversation-bound-session.md](../conversation-bound-session.md) 重复的只交叉引用，不另起实施切片。

## 核查

| 条目 | 判定 | 理由 |
|------|------|------|
| BH-11-1 | 成立 | `registerLens` 仍把单例 `primaryLens` 换成最后一块（`conversationTimelineRevealService.ts` 约 37–46 行）；无 `filterAgentId` 的透镜都会登记（`conversationLens.ts` 约 269–271 行）。并列会话列各有一块编辑器透镜（`conversationEditorPane.ts` `ensureLens` 约 126–131 行，不传 `filterAgentId`）。`revealItem` / 无障碍 / 滚到待确认都只打这一块。先登记的透镜 `dispose` 时若已不是 `primaryLens`，不会把自己登记回去。 |
| BH-11-2 | 成立 | `resolveQuestionRequestId`（`conversationSessionView.ts` 约 311–321 行）在展示 id 不在待决集合时，按 Set 插入序取第一个 `id + ':'` 前缀；都不中再切第一个冒号。父级 `questionId` 原样进入展示 id（`question-ask.ts` `questionAskItemId` 约 243–245 行），地址校验不拒绝冒号（同文件约 315–321 行）。座位提交用的是这个 `questionRequestId`（`conversationQuestionSeat.ts` 约 72、110 行）。较短前缀若先插入，后一个问题的选项会记到前一个问题上。 |
| BH-11-3 | 成立 | text 行只区分 `user` / `system`，其余含 `tool` 都变成 `assistant`（`conversationSessionView.ts` 约 347–349 行）。同一条在轨迹里是 `context`（`conversationTrajectoryModel.ts` 约 305–311 行）。助手行挂重新生成和删除（`conversationTimelineRenderer.ts` 约 371–418 行）；删除走 `turn.turnId` 否则 `turn.id`（`conversationLensReadingColumn.ts` 约 77 行），点下去改的是这条被画成助手的回合。2026-09-25 推翻「缺 attribution 画成助手」：正文可见、纯文本、行头中性标签、无重新生成/删除。该测试改为锁中性行。数字角色映射不在本稿，归活流方案的 host。 |
| BH-11-4 | 成立 | 权限行不在 `pendingActions` 且 `decision` 不是 `allow` / `deny` 时，状态仍是 `pending`（`conversationSessionView.ts` 约 387–388 行）。`decision` 只有这两值或缺失（`sessionView/types.ts` 约 121 行）。渲染器仅在 `status === 'pending'` 时挂 Allow / Skip（`conversationTimelineRenderer.ts` 约 262–271 行），点击会按该行 id resolve。 |
| BH-11-5 | 成立 | 会话投影里的 `parseVisualizeArgs` 只要求 `type` 是字符串（`conversationSessionView.ts` 约 436–445 行），不调用 `validateConversationVisualizePayload`（`conversationVisualize.ts` 约 25–46 行）。卡片见到 `turn.visualize` 就当成功（`conversationVisualizeCard.ts` 约 47–49 行）。`type` 不是 diagram 时 `renderComparisonBody` 遍历 `args.options`（约 155 行），缺数组会抛错。diagram 且 `mermaid` 缺失时，宿主挂载失败会走到 `mountMermaidSourceFallback` 的 `source.trim()`（`conversationMermaidHost.ts` 约 125–129 行）。这一行进图表面板，原工具输出不再出现。 |
| BH-11-6 | 成立 | 内联图滚轮把 `deltaY` 加在外层 `scrollHost.scrollTop`（`conversationTimelineRenderer.ts` 约 248–253 行；宿主是 `conversationTimelineTree.ts` 约 123、181 行的 `.conversation-lens-timeline-scroll`）。真正滚动的是树的 `tree.scrollTop`（同文件约 630–642 行）。样式上该外层只是 flex 列（`conversationLens.css` 约 517–523 行），没有把它当成列表滚动条。全屏走 overlay，不挂这条委托（`conversationMermaidHost.ts` 约 106–110 行只在 `inline` 转发滚轮）。 |
| BH-11-7 | 驳回 | `push` 在 `baseline` 时仍清空 `pending` 再只投递 baseline（`conversationSessionViewFrameCoalescer.ts` 约 75–82 行），这条代码行为还在。用户可见后果不成立：时间线对 effects 得到 `mode: 'none'` 后直接返回（`conversationTimelineTree.ts` 约 306–307 行；计划在 `conversationTimelineApply.ts` 约 130–131 行），收件箱也不读 `ViewEffect.message`。effects 即使按 `mergeSessionViewFrames` 投递出去，用户同样看不到失败说明。发送失败的可见文案走 `showPostFailure`，不走这条队列。 |

## Problem class

同一窗口里多块阅读列共用一个「最后登记的透镜」，定位和无障碍打到错误的列。提问展示 id 用冒号拼接父级 id，回传却按插入序吃最短前缀。投影把工具角色正文、未决集合之外的权限、未通过校验的 visualize 载荷画成可操作或会抛错的行。内联图的滚轮写到不滚动的外层容器。

## 0. 一句话结论

按会话键登记非过滤透镜；提问回传取最长的待决前缀，对不上就不截断；`tool` 正文不要进助手动作；不在待决集合且没有 allow/deny 的权限只读；图必须先过已有校验；滚轮增量写到时间线树。baseline 抢先清掉 effects 不单独立项。

## 1. HEAD 事实

| 事实 | 位置 |
|------|------|
| 揭示服务是延迟单例，只留 `primaryLens` | `conversationTimelineRevealService.ts` 约 28–46、89 行 |
| 无 `filterAgentId` 才 `registerLens`；子代理过滤透镜不登记 | `conversationLens.ts` 约 269–271 行；`conversationSubAgentOverlay.ts` 约 203–209 行 |
| 命令 `conversation.revealItem` 用活动会话解析 id，再 `revealItem` 打到 `primaryLens` | `conversationRevealItem.contribution.ts` 约 49–64 行 |
| 焦点到达与通知滚到第一条待确认，同样只打 `primaryLens` | `conversationOpenPendingOnFocus.contribution.ts` 约 47 行；`conversationNotifications.contribution.ts` 约 145 行 |
| 无障碍正文读 `primaryLens` 当前焦点回合 | `conversationAccessibleView.ts` 约 25–33 行；`conversationLens.ts` `getAccessibleTurnContent` 约 430–432 行 |
| 展示 id = `` `${questionId}:${childKey}` ``；待决 id = 父级 `questionId` | `question-ask.ts` 约 243–254 行 |
| 父级 id 只拒绝空、空白、控制字符、垃圾串和超长，不拒绝冒号 | `question-ask.ts` 约 302–321 行 |
| text + `role === 'tool'` → 对话页 `assistant`，轨迹页 `context` | `conversationSessionView.ts` 约 347–349 行；`conversationTrajectoryModel.ts` 约 305–311 行 |
| `ItemAttribution.role` 含 `tool` | `conversationViewFrame.ts` 约 123–124 行 |
| 对话页 turn kind 没有 `context` | `conversationStubModel.ts` 约 20–22 行 |
| 权限 `decision` 仅为 `'allow' \| 'deny'` 或缺省 | `sessionView/types.ts` 约 121 行 |
| 卡片侧已有会校验的 `parseVisualizeArgs`；投影侧同名函数不校验 | `conversationVisualize.ts` 约 51–59 行；`conversationSessionView.ts` 约 436–445 行 |
| 帧合并注释写明 effects 不能丢；`push` 的 baseline 短路不走合并 | `conversationSessionViewFrameCoalescer.ts` 约 75–82、108–138 行 |
| 产品投影已规定 text 的 role 只映到 user / assistant / system；visualize 在参数完整时才成图 | [conversation-stream-timeline.md](../conversation-stream-timeline.md) §3.3 |
| 发送失败的一次性 `ViewEffect` 在该稿记为收件箱提示，渲染端今日不消费 | 同稿 §3.5；消费缺口见上表 BH-11-7 |

## 2. Options

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 多列定位 | 揭示服务按 `sessionKey` 登记非过滤透镜；`revealItem` 用命令已经解析出的活动会话选列 | 继续全局一块 `primaryLens`；改窗口服务去开关或重排叶（[conversation-bound-session.md](../conversation-bound-session.md) 的窗口域，另路） |
| 提问回传 | 在待决 id 里取最长的、且 `displayId` 以 `id + ':'` 开头的那条；没有则不写 `questionRequestId` | 保持插入序第一个前缀；对不上时切第一个冒号；发明新的提问关联字段 |
| `tool` 正文 | 不进助手气泡，不挂重新生成/删除；行头用轨迹已有的 context 文案。缺 attribution 改为中性只读（2026-09-25） | 维持 `assistant`；新增 turn kind 或协议字段 |
| 权限座位 | 不在 `pendingActions` 且 `decision` 不是 allow/deny 时不要 `pending`，不要挂可写按钮 | 把缺决策画回待决；改 `decision` 的类型 |
| 图 | 投影与卡片都走 `conversationVisualize.ts` 的校验；不通过则留下工具行，卡片走已有错误卡 | 相信带字符串 `type` 的对象；为图新增协议字段（[conversation-stream-timeline.md](../conversation-stream-timeline.md) G2 的 typed arm 不在本稿重开） |
| 内联滚轮 | 增量加到时间线树的 `scrollTop` | 继续写 `.conversation-lens-timeline-scroll`；给外层另做一套滚动 |
| effects 与 baseline | 不立项 | 在本稿再写一套「baseline 前先吐 effects」；那条队列今日到不了用户可见通知，收件箱提示以 §3.5 为准，不另起切片 |

## 3. 选定设计

### S1 按会话登记透镜

`ConversationTimelineRevealService.registerLens` 的不变量：

- 只接受调用点已经排除过滤透镜之后的登记（调用点保持 `conversationLens.ts` 约 269 行的 `!slots.filterAgentId`）。
- 登记键是调用点传入的 `slots.sessionKey`，不读 `boundSessionId`。`registerLens` 发生时该字段仍是 `undefined`，`setBoundSessionId` 之后透镜不重建。同一键后登记的替换先登记的；`dispose` 只摘掉自己这次登记，若同键还有更早的存活透镜则恢复那一块，没有则该键为空。
- `revealItem(itemId, sessionId)`、`getAccessibleTurnContent(sessionId)`、`focusAccessibleTurn(sessionId)`、`scrollToFirstPendingConfirmation(sessionId)` 的 `sessionId` 由调用方传入（命令、通知、焦点路径各自已经握着的那个），不在服务里再读窗口。目标键没有透镜时保持今日的空操作。
- 目标键没有透镜时，保持今日的空操作（不抛到另一列）。

### S2 提问回传取最长前缀

`resolveQuestionRequestId` 的不变量：

- 展示 id 本身在待决集合里 → 返回它。
- 否则在待决 id 中选最长的一条，使得展示 id 以 `` `${pendingId}:` `` 开头。并列最长时结果必须稳定，按代码单元序取一条，不按 Set 插入序。
- 没有这样的前缀 → 不返回截断父级。`timelineItemToEntry` 的 question 分支因此不写 `questionRequestId`。座位已有「没有 requestId 就不提交」的分支（`conversationQuestionSeat.ts` 约 74–80 行），选项保持只读列表。
- 不改 `questionAskItemId` / `questionAskPendingRequestId`，不新增关联字段。

### S3 工具角色正文不是助手回合

`timelineItemToEntry` 的 text 分支不变量：

- `attr.role === 'user'` → `user`；`system` → `system`；`tool` 走只读行。缺失 attribution → 中性只读正文（2026-09-25），不是 `assistant`。
- `attr.role === 'tool'` → 不得是 `assistant`，不得进入 `renderHonestTimelineRow`（它只接受 `error` | `unknown` | `system`），也不得进入 `renderStandaloneThinkingOrToolRow` / `projectProcessFoldSpans`。不新增 `ConversationTurnKind`，不改过程折函数。渲染器在 kind 分支之前认这条只读行，标题调用已有的 `getTrajectoryKindLabel('context')`，不挂重新生成和删除。
- `deleteTurn` 不会因这一行被调用。轨迹侧 `timelineItemToTrajectoryRecord` 的 `context` 投影保持不动。
- 实施时只改 [conversation-stream-timeline.md](../conversation-stream-timeline.md) §3.3 的 role 表，补上 `tool` → 只读行、不是 assistant。不改该文其它节。

### S4 没有决策的权限不可写

`timelineItemToEntry` 的 permission 分支不变量：

- id 在 `pendingIds` → `pending`（可挂 Allow / Skip）。
- 否则 `decision === 'allow'` → `allowed`；`decision === 'deny'` → `skipped`。
- 其余（`decision` 缺省且不在 `pendingIds`）→ 视图状态 `undecided`。这不是协议字段，也不映射成 `allowed` 或 `skipped`。座位只在 `pending` 挂按钮；`undecided` 不显示 Allowed / Skipped 文案。不改 `decision` 的取值集合。

### S5 图先校验再离工具行

不变量：

- 名为 `visualize` 的工具行，只有 `conversationVisualize.ts` 的 `parseVisualizeArgs` 返回 `ok: true` 时，投影才得到 `kind: 'visualization'` 和 `visualize`。
- 校验失败或正文不是该函数接受的对象 → 保持 `kind: 'tool'`，用户仍看见工具标题和预览。
- `renderConversationVisualizeCard` 不得把未校验的 `turn.visualize` 当成 `{ ok: true }`。有 `visualize` 时仍交给同一个 `parseVisualizeArgs`；`ok: false` 走该文件已有的错误卡，不进入 `renderDiagramBody` / `renderComparisonBody`。
- 不新增图的协议字段。typed arm 仍以 [conversation-stream-timeline.md](../conversation-stream-timeline.md) G2 为准。

### S6 内联图滚轮滚动时间线树

不变量：

- 可视化卡的 `onWheelDelegate` 把 `deltaY` 加到 `ConversationTimelineTree` 用来滚动列表的那个 `scrollTop`（`scrollToEnd` 写入的 `tree.scrollTop`，约 630–631 行），不写 `.conversation-lens-timeline-scroll`。
- 全屏 overlay 继续不注册这条委托。
- 滚轮之后沿用树已有的滚动条外观刷新（`refreshScrollChrome`）。

## 4. 不做

- 不改窗口服务、会话叶开关、composer、发送失败的 `showPostFailure` 文案。
- 缺 attribution 的 text 行改为中性只读（2026-09-25）。不新增 `ConversationTurnKind`。不在投影侧设角色缺省。
- 不改 `questionAskItemId` 的 `` `${questionId}:${childKey}` ``，不改待决 id 等于父级 `questionId`。
- 不新增 `ConversationTurnKind`、不改轨迹 `context` 投影、不改过程折把工具挂到最近一条 thinking 的规则。
- 不重做 [conversation-stream-timeline.md](../conversation-stream-timeline.md) 的帧分类、G2 typed arm、§3.5 收件箱提示。
- 不把 `push` 的 baseline 短路改成「先吐 effects」：effects 今日不产生用户可见失败说明。
- 不改 `orderKey` 字符串排序。

## 5. 验证

沿用现有单测，补断言。不要重开 GitHub Actions。本地跑对应的 `scripts/test.sh` 目标（或 `scripts/run-unit-custom.sh` 里已覆盖这些文件的入口）。

| 切片 | 现有测试 | 要加的断言 |
|------|----------|------------|
| S1 | `conversationPendingSeat.test.ts` 只锁「透镜抛错仍通知」 | 两块无 `filterAgentId` 的透镜先后 `registerLens`：`revealItem` / `getAccessibleTurnContent` / `scrollToFirstPendingConfirmation` 打到与目标 `sessionKey` 相同的那块；先登记的那块 `dispose` 后，后登记的仍被选中；后登记的 `dispose` 后若先登记的还在，调用回到先登记的那块 |
| S2 | `conversationSessionView.test.ts` 提问投影 | 待决集合同时有 `ask` 与 `ask:sub` 时，展示 id `ask:sub:q_0` 的 `questionRequestId` 是 `ask:sub`，与插入序无关；待决集合里没有任一前缀时，该行没有 `questionRequestId` |
| S3 | `conversationSessionView.test.ts` 约 114 行改为锁中性行 | `summary.kind === 'text'` 且 `role === 'tool'` 的条目不是 `assistant`；无 attribution 的 text 行也不是 `assistant`，正文可见，没有重新生成/删除按钮 |
| S4 | `conversationSessionView.test.ts` 约 121 行「待决由 pendingActions、决策由记录」 | 构造一条不在 `pendingActions`、且 `summary.decision` 缺省的权限行，投影 `status` 不是 `pending`；渲染没有 Allow / Skip |
| S5 | `conversationVisualize.test.ts` 的 `parseVisualizeArgs` | 投影：`type: 'diagram'` 且无非空 `mermaid`，或 `type` 不是 diagram/comparison，得到的是 `tool` 而不是 `visualization`；卡片在传入未校验 `visualize` 时走出错误卡，不抛 `trim` / 遍历 `options` |
| S6 | `conversationTimelineScroll.test.ts` 锁的是帧合并与 `scrollTop` 计划，没有滚轮委托 | 内联图的滚轮委托调用后，树的 `scrollTop` 增加 `deltaY`，`.conversation-lens-timeline-scroll` 的 `scrollTop` 不变 |

S1–S6 不要求新的浏览器手工剧本。BH-11-7 不补「baseline 前投递 effects」的断言。
