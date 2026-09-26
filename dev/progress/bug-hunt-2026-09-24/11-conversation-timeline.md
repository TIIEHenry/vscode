---
title: "潜在缺陷：对话时间线"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "对话时间线在多窗口定位、提问回传和角色投影上会指错对象，图与失败通知还有几处错渲染。"
---

# 潜在缺陷：对话时间线

## 结论

范围内最严重的是定位服务只记住最后一块透镜，以及提问行用「第一个冒号前缀」回传答案，两者都会作用到错误会话或错误提问。另有工具角色的正文被画成助手、未决权限被画成可点、可视化载荷未校验、图上滚轮不滚动时间线，以及基线帧清掉尚未投递的失败通知。缺 attribution 被画成助手已被单测锁成现行合同，不单独立条。

## 发现

### BH-11-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationTimelineRevealService.ts` `ConversationTimelineRevealService.registerLens` 约 37–46 行；调用点 `src/vs/workbench/contrib/conversation/browser/conversationLens.ts` 构造函数约 269–271 行
- 行为：服务是进程内单例，每次 `registerLens` 都把 `primaryLens` 换成最后注册的那块。`revealItem`、`getAccessibleTurnContent`、`focusAccessibleTurn`、`scrollToFirstPendingConfirmation` 都只打这一块。
- 为何是缺陷：同一窗口可以有多块非过滤透镜（拆开的会话列都会注册）。后打开或后布局的列覆盖先打开的列。从通知或命令跳到某一步时，滚的是另一列的时间线；无障碍朗读也读那一列当前焦点。先打开的列在被覆盖后，自己的 `dispose` 不会把自己重新登记回去。
- 触发：同时打开两个会话列，再对先打开的会话执行定位、读无障碍正文，或触发滚到第一条待确认。
- 已知：否。D124 / D126 只给这几条委托加了抛错通知，没有处理多透镜。
- 修复方向：按 `sessionKey` 登记透镜，定位时用目标会话选列，而不是全局只留最后一块。

### BH-11-2

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionView.ts` `resolveQuestionRequestId` 约 311–321 行；展示 id 规则在 `src/vs/platform/universeAgent/common/sessionView/question-ask.ts` `questionAskItemId` 约 243–245 行（`问题id:子键`），待决 id 是父级 `questionId`（约 252–254 行）
- 行为：展示 id 不在 `pendingActions` 里时，按 Set 插入顺序取第一个「作为前缀且后面跟冒号」的待决 id。一个都对不上时，再切第一个冒号之前的子串。
- 为何是缺陷：父级 id 允许含冒号。待决集合里若同时有 `ask` 与 `ask:sub`，行 id `ask:sub:q_0` 会先命中较短的 `ask`，提交进 `questionRequestId`。用户在后一个问题里选的选项会被记到前一个问题上。父级还不在待决集合里时，回退切分同样把 `ask:sub:q_0` 收成 `ask`。
- 触发：两个待回答问题的 id 成「短 id + 冒号」前缀关系，或单个问题 id 含冒号且当前待决集合里还没有这条父级 id，然后在该行提交。
- 已知：否
- 修复方向：在待决 id 中取最长的 `id + ':'` 前缀；对不上时不要按第一个冒号截断。

### BH-11-3

- 严重度：high
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionView.ts` `timelineItemToEntry` 的 `text` 分支约 347–349 行；对照 `src/vs/workbench/contrib/conversation/browser/conversationTrajectoryModel.ts` `timelineItemToTrajectoryRecord` 约 297–313 行。助手行的重新生成/删除在 `src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts` 约 371–418 行
- 行为：正文行只把 attribution `user` / `system` 分开，其余角色（含 `tool`）一律变成 `assistant`。同一条在轨迹里是 `context`（工具注入）。
- 为何是缺陷：工具角色的正文在对话页显示成助手，并带上重新生成和删除。点删除走的是这条助手回合的 id，会改到错误的归属。轨迹页却把同一条标成上下文。缺 attribution 被画成助手是单测锁死的合同，本条只指明确写成 `tool` 的正文。
- 触发：快照里有 `summary.kind === 'text'` 且 attribution.role 为 `tool` 的时间线项。
- 已知：否
- 修复方向：`tool` 角色不要进助手气泡；与轨迹一样做成不可重新生成、不可删除的上下文行。

### BH-11-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionView.ts` `timelineItemToEntry` 的 `permission` 分支约 387–389 行；座位按钮在 `src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts` 约 262–271 行（仅 `status === 'pending'` 时挂 Allow / Skip）
- 行为：id 不在 `pendingActions` 时，只有 `decision === 'allow'` / `'deny'` 会变成已允许或已跳过。没有 decision 的其它值仍得到 `pending`。
- 为何是缺陷：已经不在待决集合里的权限，只要决策字段缺失，对话页仍画出可点的允许/跳过。点击会按该行 id 去 resolve。同一文件的单测写明待决由 `pendingActions` 驱动、决策由记录驱动，这条 else 把「没有决策」又画回待决。
- 触发：权限行不在 `pendingActions` 中，且 `summary.decision` 不是 `allow` 或 `deny`。
- 已知：否
- 修复方向：不在待决集合且没有明确 allow/deny 时不要挂可写按钮，改成只读状态。

### BH-11-5

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionView.ts` `parseVisualizeArgs` 约 436–445 行；卡片在 `src/vs/workbench/contrib/conversation/browser/conversationVisualizeCard.ts` `renderConversationVisualizeCard` 约 47–49 行直接相信 `turn.visualize`。校验函数在 `src/vs/workbench/contrib/conversation/common/conversationVisualize.ts` `validateConversationVisualizePayload` 约 25–46 行，这条投影没有调用它
- 行为：只要详情 JSON 是带字符串 `type` 的对象，工具行就改成 `visualization`。卡片看到 `turn.visualize` 就当成功，不再走 `parseVisualizeArgs`。
- 为何是缺陷：`type` 为 `diagram` 但没有非空 `mermaid`，或 `type` 根本不是 diagram/comparison 时，本应留在工具行或错误卡。现在会进入图表面板，`args.mermaid` 为空时 `trim` 抛错，这一行渲染中断，用户看不到原工具输出。
- 触发：名为 `visualize` 的工具带上详情，JSON 有 `type` 字符串但通不过 `validateConversationVisualizePayload`。
- 已知：否
- 修复方向：投影与卡片都走已有的校验；不通过则保持工具行或错误卡，不要把未校验对象当成图。

### BH-11-6

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts` 可视化卡 `onWheelDelegate` 约 248–253 行；滚动条在 `src/vs/workbench/contrib/conversation/browser/conversationTimelineTree.ts` 的 `tree.scrollTop`（约 630–642 行）。样式上 `.conversation-lens-timeline-scroll` 只是 flex 列，列表滚的是 `.conversation-timeline-tree`
- 行为：图宿主把滚轮增量加在外层 `scrollHost.scrollTop` 上。真正滚动对话的是树控件自己的滚动位置。
- 为何是缺陷：指针停在内联图上时，对话不跟着滚。图越高，时间线越难离开这一段。全屏层不走这条委托，所以只有内联图中招。
- 触发：展开一条带图的可视化卡，指针放在图上滚动。
- 已知：否
- 修复方向：滚轮增量写到时间线树的 `scrollTop`，不要写外层 scroll 容器。

### BH-11-7

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionViewFrameCoalescer.ts` `push` 约 75–82 行；同文件 `mergeSessionViewFrames` 约 108–138 行写明效果帧不能丢。接线在 `src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts` 约 153–154 行
- 行为：16ms 窗口里的 patch 与 effects 会合并后分两次交给时间线。若窗口未刷新时来了 `baseline`，`push` 直接清空 `pending` 再只投递 baseline。
- 为何是缺陷：发送失败这类一次性通知只活在 effects 里。baseline 会按当前快照重画行，但被清掉的 effects 不会再出现，用户看不到失败说明。合并函数已经避免在同一窗口里丢掉 effects，baseline 短路绕过了它。
- 触发：失败通知进入合并队列后的 16ms 内又收到 baseline（重同步、整表替换）。
- 已知：否
- 修复方向：baseline 落地前先把队列里的 effects 按 `mergeSessionViewFrames` 的规则单独投递出去。

## 看过但未立条

- 缺 attribution 的 text 行被画成 `assistant`：`conversationSessionView.ts` 约 348 行与 `conversationSessionView.test.ts` 约 114 行把这锁成「中性」合同，不按方案里的诊断行另立。
- `usage` / `generic` 不进对话页、根路径会话链接不改写、折叠 id 变化就收起、配对保持时轨迹不刷成空列表，都是注释里的 fail-closed 或既定合同。
- `orderKey` 按字符串排序与 `dev/plans/conversation-stream-timeline.md` 的产品投影一致；类型注释里的 S0「展示不要排序」没有当成现行缺陷。
- 轨迹子工具点击回父调用 id、过程折叠把工具挂到最近一条 thinking 下，是当前投影规则，不是误点。
- Mermaid 扩展查询失败（D142）和定位委托抛错（D124 / D126）已收口。
- 工具状态在关闭 live chrome 时一律打勾，是 stub 外观，不单独立条。

## 未读完

- `conversationTrajectory.ts` 约 450–700 行的搜索防抖、窄宽检查器和概览条只抽读了 `selectRecord` / `refreshTable`，没有逐行对点击热区以外的布局。
- `conversationLens.ts` 里 composer、会话条和收件箱段没有逐行读；按范围也不扫窗口服务与 composer。
- `conversationTimelineRenderer.ts` 约 420 行之后的座位回收、诚实行和独立 thinking/tool 行只对到符号和 `renderStandaloneThinkingOrToolRow`，没有再展开每个按钮的文案。
- `conversationProcessFold.ts` 后半的 diff 编辑器挂载（约 279–320 行）只确认了展开时才创建，没有把 diff 池的生命周期当缺陷追完。
