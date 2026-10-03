---
title: "Conversation 透镜、时间线与轨迹"
type: architecture
status: accepted
phase: N/A
updated: 2026-10-04
summary: "ConversationEditorPane 页 chrome（lensTablist）；「对话 | 轨迹」双透镜；阅读列身份条与时间线流宽 min(100%, 720px) 居中；轨迹 Overview 是 12px 分段条（>200 段按 turn 聚合），时间刻度瀑布条仍 Deferred；视觉规则见 ui-design-principles；叶宽 `.is-medium` / `.is-narrow` / `.is-compact`（Q6/RWD-1）；子代理 overlay 自备 sessionBar、只传 lensTablist；时间线会话 pill；stub 字面会话路径 catalog 命中才改写；同步徽章 28ch / 窄叶 12ch；SessionBar 上一级与下一级常驻，History / Snapshots 窄于 450 才收进 `…`；会话标题未改不报发送失败，空白说明不能为空；编辑器来回在编辑器区；待确认定位走 revealPendingTurn，非末根解开贴底；时间线 content-visibility 只走样式表，焦点行不被 120px 占位夹住；Accessible View；帧源投影与 Q4 live 过程折；换到另一条会话时过程折展开不沿用，pending 或名单未就绪时时间线和轨迹也不留上一条；发起窗乐观发送行标 Sending… 且不可编辑；轨迹表与检查器的用户预览去掉合法引用尾块；不可重试的权限送达失败不再标 Input needed；离开待决且未回答的提问是 undecided，不再当成待确认座位；已提交且快照仍 pending 的 Allow/Skip 与提问不再交第二次；多道必填单选在每道都点过之前不提交，也不把没点过的第一项一起交出去；换到另一条会话时清掉轨迹搜索，同一条重连和 KEEP leftover 仍留着；工具行保留从正文拆出的思考，收起工具正文时也看得见；关掉工具详情时不画 file_edit 增删统计；live 工具 overlay 仍有正文时阅读区另留助手行，工具摘要只用工具名；同一 turn 只有 tool_call、没有可用正文、且 streaming 正文还在时，阅读行留着这段字，工具行另留在时间线上；工具一开始跑时 `tool_call_lifecycle.started` 的工具名走同一条生成中工具路径，已流出的正文留着；同一封信落盘时工具臂也带着正文"
---

# Conversation 透镜、时间线与轨迹

> 导航：[系统索引](INDEX.md)。需求：[PRD-003](../../product/requirements.md#prd-003-时间线与输入) · [PRD-012](../../product/requirements.md#prd-012-conversation-轨迹透镜) · [PRD-013](../../product/requirements.md#prd-013-conversation-过程折) · [PRD-014](../../product/requirements.md#prd-014-conversation-图示卡visualize)。donor 对照与「为什么不用 ChatWidget」见 [conversation-lens-assembly](../../reference/code-oss-b2/conversation-lens-assembly.md)。视觉规则（对话阅读面、轨迹表）见 [UI 设计原则与规范](../../architecture/cross-cutting/ui-design-principles.md) §5.1 / §5.3，本页只写结构与行为。

## 1. 页 chrome 在哪

每张 chat tab 的内容由 `ConversationEditorPane`（`workbench.editor.conversationChat`）渲染。生产路径把 `IConversationLensSlots` 的 `lensTablist` / `timeline` / `dock` 交给 `ConversationLens`（**不**再传 Part 级 `sessionBar`）。「对话 | 轨迹」在页 chrome `pageChrome.lensTablist`。窗口 chrome 是**叶级 SessionBar**（每扇一份，见 [session-windows](session-windows.md)），由 `ConversationLeafSessionBar` 挂在该叶 `sessionBar` 槽，不经过透镜。

子代理对话框（`ConversationSubAgentOverlay`）给透镜只传自己的 `lensTablist`（可见形态仍是「对话 | 轨迹」），不再传完整 SessionBar。focus trap 根 = `overlay.element`，Tab wrap 与 Escape 才能包住透镜 / 改名。Escape 顺序：图示 overlay → 局部 inspector → 标题改名 → 对话框；不关根会话。

SessionBar 标题 Enter 或失焦即提交，Escape 取消且不提示。去掉首尾空白后与当前标题相同，只收起输入，不调用 `renameSession`，也不把输入条画成发送失败。空白标题收起，标题不变，并说明不能为空。配对等待或 KEEP leftover 时，即使输入框已经打开也不提交，说明引擎未连接。真正改名失败仍走既有失败提示。

时间线行名由 `getConversationTurnAriaLabel` 给出（含 `system` / error 可否重试 / unknown 原始类型 / 乐观发送的 sending）。流式行只在进入 / 离开 `streaming` 时改「进行中」后缀，不按 token 更新 `aria-label`。完整回合经 `ConversationAccessibleView` 接入既有 `IAccessibleViewService`（`AccessibleViewProviderId.Conversation`），不新造 live 区。

**窄宽度（Q6 = a11y RWD-1）：** `ConversationEditorPane.layout(dimension)` 用**本叶** `dimension.width` 打 `.is-medium`（450–899）、`.is-narrow`（< 450）与 `.is-compact`（< 300），再把同宽传给 `ConversationLens.layout`。禁止用 `ConversationPart` 宽代表 split / 并列叶。SessionBar 把上一级、下一级、History、Snapshots、New、Delete 做成图标。上一级沿代理父链退一层，下一级弹出直接子代理。两钮任何宽度都留在栏上。History、Snapshots、New、Delete 在窄于 450px 时收进 SessionBar `…`。编辑器来回和关掉延伸标签在会话窗口的编辑器区，不进 SessionBar。同步徽章默认 `max-width: 28ch` 且有 `title`；仅 `.is-narrow` / `.is-compact` 收到 12ch，且允许收缩。Part 级 SessionBar 用自己的盒宽打 class；overlay 自备栏用卡片体宽。300px 叶：主输入、透镜 tabs、同步态、inspector Back 保持 `flex-shrink: 0`；标题截断。轨迹 inspector 在叶宽 < 600 时覆盖表并显示 Back，关闭后恢复选中与 `scrollTop`。Navigator / Review reveal 把 `lastRevealItemId` 记在透镜上；隐藏 Part / 叶宽从 0 恢复 / overlay 打开或铺满时 `layout` 再 `revealTurn` / `scrollRecordIntoView`，不丢定位。

`ConversationLens` 把当前透镜 id（`'conversation' | 'trajectory'`）存到 `StorageScope.WORKSPACE`（`CONVERSATION_LENS_ID_STORAGE_KEY`）。这不是本系统唯一持久化：会话目录 / 回合见 `conversation.roster.v1`（D13）；未发送草稿见 `conversation.drafts.v1`（[composer-and-inbox](composer-and-inbox.md) §6）。

## 2. 对话透镜：时间线

| 零件 | 文件 | 说明 |
|------|------|------|
| `ConversationTimelineHost` | `conversationTimelineHost.ts` | 原生文档流宿主（[ADR-010](../../../dev/decisions/010-conversation-timeline-document-flow.md)），推翻 `WorkbenchObjectTree` 与测高逻辑；配合 `content-visibility`、历史窗口化（未决座位强制在窗）与重资源预算；按根增量键控协调；流容器 `role=feed`，每根 `article`。屏外根用样式表 `content-visibility: auto` 与 `contain-intrinsic-block-size: auto 120px`。`--cv-visible`（流式、编辑、待确认座位、最近三根）和 `:focus-within` 改为 `visible` / `none`。宿主不把这两项写成内联样式，否则键盘焦点停在更早的行时仍被 120px 占位夹住 |
| 跟随控制器 | `conversationTimelineFollow.ts` | `ConversationTimelineFollowController`：沿用 HEAD 解锁语义，写入台账排除控制器自身写入；用户滚离底部解锁、滚回底部恢复跟随；发送上锁；帧末尾同步贴底 + ResizeObserver 异步变高贴底；D12 展开收起位置补偿。Inbox 待确认、回到会话和通知 Show 走 `revealPendingTurn`：立刻滚到该根（含窗口外的可应答工具），不用平滑 `scrollIntoView`。座位不是最后一根时解开贴底，下一帧和尺寸变化不会把视口拽回底部；座位就是最后一根时跟随保持 |
| 调度器 | `conversationTimelineScheduler.ts` | 动画帧调度（16ms 兜底），合并同帧 patch 与 effects；不可见时只停宿主 DOM 更新，投影与 Inbox 照旧 |
| 流式渲染 | `conversationStreamingMarkdown.ts` · `conversationTurnContentAdapter.ts` | 按 marked 词法块冻结，尾部用 `fillInIncompleteTokens` 渲染；L2 落盘完整渲染一次定稿 |
| 交接排序 | `platform/universeAgent/node/overlayDeltaJoin.ts` | 宿主侧按 turn 关联排序（D5）：带可用正文或空 blocks 的助手信封到达后紧随清除 overlay。同一 turn 只有可用 tool_call、没有可用正文、且 streaming 正文还在时，清掉 `generatingToolName` 并留下这段正文；宿主先投下的工具行留在时间线上。`turn_completed` 先到仍挂起，直到这种会清除的助手信封、下一轮 `turn_started` 或 2s。活路径不发 `generating_tool` 时，`tool_call_lifecycle.started` 的非空 `tool_name` 走同一条：写上 `generatingToolName`，留下已累积的正文、思考和 agentId。`args_complete`、`completed`、`failed` 不清这段正文 |
| 内容渲染 | `conversationTurnContentAdapter.ts` · `conversationTurnMarkdown.ts` · `conversationSessionPill.ts` · `resolveConversationTimelineLink.ts` · `rewriteConversationStubTurnSessionLinks.ts` | **唯一**允许触碰 `contrib/chat/browser/widget/chatContentParts/**` 的入口；只借 markdown / code block 渲染函数，不造 `IChatRequestViewModel` 影子模型。助手 markdown **只**放行 `conversation-chat` scheme，显式 `actionHandler` 单点分流（http/https/mailto → 外链确认；白名单内其它 scheme → `openLinkFromMarkdown`；内部命中 → pill 路由）。投影 `ConversationStubTurn.text` 时（`projectSnapshotToEntries` / stub `getTurns`），stub/fixture 字面 `/session/<key>/chat/<id>` **仅**在该 session catalog 命中 tool/fork 才改写成 `conversation-chat:`；已是该 scheme、catalog 未命中、以及任何带 scheme 的 live-engine / donor 链接原样保留（R9）。adapter **不再**改写 href/text。resolve 命中的 tool/fork/default 升级为会话 pill + 轻量 hover；catalog / roster 晚到时补画。无状态徽标。adapter **不得**直接 import `conversationSessionChatService.js`。无新 RPC |
| 用户卡 | `conversationUserBubbleCollapse.ts` · `conversationTimelineRenderer.ts` | 已落盘的用户回合是纯文本卡，点卡进入编辑（PRD-015 验收 6）。`localPendingSends` 的乐观行带 `pending`，标题写 Sending…，不是按钮、不能进编辑；L2 接住后换成可点的用户卡 |
| 置顶提示 | `conversationPinnedUserPrompt.ts` | 覆盖式置顶气泡（D3），滚动口设 `scroll-padding-top`，不再推动内容产生位移（纯函数判定，对齐 Singularity `PinnedUserPromptState`） |
| 过程折 | `conversationProcessFold.ts` | 增量更新句柄，子项按 turn id 键控，懒渲染，保留内滚与粘性面包屑（D7/D11） |
| 权限座位 | `conversationConfirmationSeat.ts` | Allow / Skip；处理后按钮消失、记录留在列表（PRD-004）。点过 Allow 或 Skip 后，快照仍是 pending 且还没有新的送达失败时，两个按钮保持可见并禁用，同一次座位不再交第二次；出现可重试失败后可以再点。不可重试时藏起 Allow / Skip，不再标 Input needed，改写不能再次送出；记录仍 pending，不写成 Allowed / Skipped。不是可回收 virt 行 |
| 提问座位 | `conversationQuestionSeat.ts` | 独立 ask-user 座位（选项 / Submit）；**禁止复用 Allow/Skip**（PRD-004.4）；不标 Stub。仍在 `pendingActions` 里才是 pending，可提交。已回答是 Answered。离开待决且未回答是 undecided：不标 Input needed，不写 Can't answer，不提供 Submit，时间线也不把它当成待确认座位。选项预览仍只读。已经提交且快照仍 pending、还没有新的送达失败时，选项和 Submit 保持可见并禁用，不再交第二次；可重试失败后可以再提交。同一张座位有多道必填单选且没有 Submit 时，只点一道不会提交，也不会把没点过的那道的第一项当作答案；每道都点过才交一次 |
| 图示卡 | `conversationVisualizeCard.ts` | §5 |

对话透镜**不含**：context 注入卡、环境 / SYSTEM 全文、工具 schema 目录；用户回合只显示正文（PRD-012 验收 2）。这些都在轨迹页。

## 3. 轨迹透镜

> 帧源与 shim 合同：[conversation-stream-timeline §3.3 / S6](../../../dev/plans/conversation-stream-timeline.md)（`accepted`）。切片对照：[conversation-trajectory-lens §4 T4/T5](../../../dev/plans/conversation-trajectory-lens.md)。

### 3.1 数据路径（HEAD）

| 层 | 文件 | 行为 |
|----|------|------|
| 契约 | `conversationStubService.ts` | `getTrajectoryRecords(sessionId, options?: { filterAgentId? })` |
| 帧源投影 | `conversationTrajectoryModel.ts` | `projectSnapshotToTrajectory(snapshot, attribution, details, options)` — **T4 / stream-timeline S6 子集** |
| 旧回合投影 | 同上 | `projectTurnsToTrajectory(turns)` — UA 断连或无 cached projection 时的回退 |
| Stub 服务 | `ConversationStubService` | `frameSource.project` → `projectSnapshotToTrajectory`；仅 `shouldMergeTrajectoryFixtureExtras`（`untitled` 且未连接）时 `mergeTrajectoryFixtureExtras` |
| 引擎 roster | `ConversationEngineRosterService` | 已连接 UA 会话：cached snapshot → `projectSnapshotToTrajectory`（**永不** merge stub fixture）；否则 `projectTurnsToTrajectory(getTurns())` |
| 透镜 | `conversationLens.ts` | 读 roster；子代理 overlay 经 `IConversationLensSlots.filterAgentId` 传入 `trajectoryProjectionOptions()` |

`ConversationTrajectoryKind = system | user | context | compacted | message | tool | subtool | thinking | permission | question | error | unknown`。`projectSnapshotToTrajectory` 把 session-core `TimelineItemView` + **attribution sidecar**（role / agentId / toolCallId / parentToolCallId / `branchReason` / `compacted`）映射为轨迹行：`text+role=system` → `system`，`reasoning` → `thinking`，`tool` → `tool`（经 `finalizeToolTree` 可升为缩进 `subtool`），`permission` / `question` / `error` / `unknown` 各为独立 kind（请求/答案摘要、`retryable`、`typeName`+`rawContent`）；`generic` 不进轨迹。**confirmation 与 visualization** 仍不从 stub turns 投影（对话页专属座位 / 图示卡）；引擎 snapshot 的 `permission` / `question` **进轨迹**，但不进过程折、也不自动切页（PRD-012）。

**DetailRef（Q2 接通）：** 局部 inspector 六态 — `preview` / `loading`（本地 in-flight；lease 无 `requestDetail` 永不 loading）/ `full` / `partial`（`truncated=true` + 字节数）/ `unavailable` / `failed`+Retry。成功先 `upsertDetail(ref, content)` 再 settle；UI 读 `details` + outcome。stub 帧源本地 `requestDetail`；引擎 lease 代理 `IUniverseAgentSessionView.requestDetail`。搜索 haystack 仍用有界 preview。

**`compacted`（Q3）：** `projectSnapshotToTrajectory` 只消费 P2b `ItemAttribution.branchReason==='compact'` 和/或 `compacted{anchorTurnId,foldedLeafTurnId,compactBranchTurnId,summary?}` 才 emit 独立记录；无 attribution 则**零行**，不解析 envelope / 不订阅 `ContextCompactedEvent`、不伪造 stub 行。范围 / 原因 / summary 来自 attribution；无 summary 只显示类型与范围。token 前后数仅当 span 上已有富化数字才显示。始终折外，不伪装成 SYSTEM / assistant。点击局部 inspector 看三 turn id，并声明已丢弃全文不可恢复。

**仍 Deferred / 预留（勿写进「已接通引擎全文」）：**

| 项 | HEAD 姿态 |
|----|-----------|
| 带时间刻度的 Overview 瀑布条 | harness 有、本仓未做：轨迹记录没有时间戳（T5 子集之外，仍随 M6-D）。按类型分段的 Overview 已落，见 §3.2 |
| 活 Event fold 替换 fixture | 完整 T4 仍 blocked on [PRD-008](../../product/requirements.md#prd-008-引擎与会话权威)（M6-D）；HEAD 仅为帧源上的纯函数投影 + stub fixture |

Stub fixture：`mergeTrajectoryFixtureExtras` 仅 seed `untitled`、且 `!isEngineConnected()` 时插入带 `Stub` 的 system / context / sourceBlocks / subtool（`CONVERSATION_TRAJECTORY_STUB_*`）。**不**插入 compacted（browser stub 从不产出 `ItemAttribution.compacted`）。`createSession()` 等无 extras → 空态。

**子代理过滤（PRD-016）：** `passesTrajectoryAgentFilter`：无 filter 全留；无 attribution 丢掉；`role==='user'` 且没有 `agentId` 留下；其余只留 `agentId` 匹配项。对话页时间线、overlay、座位与轨迹页用这一条。`setFilterAgentId` 在当前会话已有快照时重画对话页。根 tab 不传 filter。`conversationSubAgentOverlay.ts` 把对话框 `chatId` 注入 `ConversationLens`。该 lens 的 `submitInput` 带上这个 id；Actor 在 id 合法时用它写 Chat，否则仍用根 agent。合法目标的乐观发送行带这个 `agentId`，留在过滤后的对话页上。

**双向 reveal（T5a @ `f66c36c9`）：** `findTurnIdForTrajectoryRecord` / `findTrajectoryRecordIdForTurn`；纯 fixture 行返回 `undefined`。

### 3.2 视图与 T5（搜索 / 虚拟化 / 上限）

| 组件 | 文件 | 职责 |
|------|------|------|
| 轨迹表 + 检查器 | `conversationTrajectory.ts` | 工具栏搜索、`WorkbenchList` 虚拟化表（记录行与折头 22px；类型列图标加正常大小写）、过程折 overlay（默认展开）、局部检查器 |
| MessageNavigator | `conversationTrajectoryList.ts` | 遗留回合索引 helpers（role / summary）；**不是** SessionBar History 数据源 |
| Engine history | `conversationEngineHistoryList.ts` | SessionBar History extra control + overlay；接通后直呼 `getHistory`（空 `sessionId` 原样上线）；断连不发、不把 fixture 回合冒充引擎信封；空列表诚实空。浅预览 `cursor_seq` + payload，**不**另写 fold。overlay 不铺满阅读列；`aria-modal` 且 trap Tab |
| Engine snapshots | `conversationEngineSnapshotsList.ts` | SessionBar extra control + overlay；接通后 `listSnapshots?`；行 Restore 直呼 `restoreSnapshot?`，成功后 overlay 保持打开并再拉 `listSnapshots`，失败 / 未发不刷新；行 Delete 确认成功后 overlay 保持打开并再拉 `listSnapshots`；取消 / 失败 / 未发不刷新；空 id / 断连 / 无 hook 不发。overlay 不铺满阅读列；`aria-modal` 且 trap Tab |

- **搜索（T5）：** 工具栏 `input[type=search]`，debounce；`filterTrajectoryRecordsBySearch` 匹配 kind / text / blocks / 检查器字段。haystack 仍是记录原文，含合法引用尾块。换到另一条会话时 `clearSessionState` 清掉搜索框和过滤，下一条轨迹不再被上一条的词滤掉。同一条会话重连和 KEEP leftover 不走这条清理，搜索留着。
- **用户预览：** 表一行预览（`getTrajectoryRecordPreview`）和检查器 Summary（`buildPreviewText`）对 `user` 行去掉合法 `<<<conversation-refs>>>` 尾块，与遗留 `getConversationTurnSummary` 相同。源块芯片仍来自 `sourceBlocks`，不从尾块另造。只有尾块时表预览是 `(empty)`；检查器拼接去掉尾块后的正文（可以为空）以及 input / output。助手和其它 kind 保留原文，非法多标记不剥。
- **虚拟化（T5）：** `buildTrajectoryTableDisplayItems` 产出 record / fold 行 → `WorkbenchList<TrajectoryTableDisplayItem>`。
- **规模上限（PRD-020）：** `CONVERSATION_TRAJECTORY_RECORD_LIMIT = 5000`；超出保留最近段并显示诚实 `limitNotice`（`applyTrajectoryRecordLimit`）。
- **Overview（[M7 closeout](../../../dev/plans/conversation-ui-closeout.md) Q1）：** `conversationTrajectoryOverview.ts` 把记录投影成分段：user、assistant（`message`）、reasoning（`thinking`）、tool（含 `subtool`）、permission、error、compacted；system / context / question / unknown 不进 Overview。投影用与轨迹表相同的最近窗口（`applyTrajectoryRecordLimit`），上限通知已经丢掉的更早记录不再画成可点的段。段数超过 `TRAJECTORY_OVERVIEW_MAX_SEGMENTS`（200）时按 turn 聚合为「T{n} · 类型 · 条数」。轨道高 12px；每段是一个按钮，用颜色加形状区分（错误是叉，不是思考的菱形），文字只在 tooltip 与 `aria-label`，点击定位到该段首条记录，选中行同步高亮对应段。工具栏搜索若正把该条滤掉，点击会清掉搜索再定位；搜索已经能看见它时不动搜索框。整条可折叠，默认展开。带时间刻度的瀑布条仍 **Deferred**（[conversation-trajectory-lens §3.5](../../../dev/plans/conversation-trajectory-lens.md)）。见 [UI 设计原则 §5.3](../../architecture/cross-cutting/ui-design-principles.md)。

选中一行打开**局部检查器**（pane 内，不占 Bottom Panel）。`subtool` 相对父 `tool` 再缩进。pending 权限或新 Diff **不**自动切到轨迹（验收 6）。任意零记录会话 → 诚实空态（验收 7）。

## 4. 过程折（overlay，不是列表身份）

模型：`conversationProcessFoldModel.ts`。

- 对话页：`projectProcessFoldSpans(turns)` — 连续 thinking / tool 成一个 span（同一 turn 的 live reasoning/tool 同 span）；user、assistant、confirmation、question、error、unknown、system 打断。span 内每条 thinking 和每条 tool 各是一行，工具不收进前面的 Thinking；收起 Thinking 只收思考正文。span id = `fold:${firstId}`。L3 `overlay:${blockId}` 与 L2 **零关联**：禁止为保展开去推断对应；overlay 做段首时 id 变成 `fold:overlay:…`，展开重置是合同行为。
- 轨迹页：`projectTrajectoryProcessFoldSpans(records)` — thinking / tool / subtool 成 span；user、context、system、message、compacted、permission、question、error、unknown 打断，**始终在折外**。
- live 信号：`ConversationTimelineEntry.streaming` 与 tool `toolStatus` 经 `entryToRenderableTurn` 传到渲染层。执行中详情限高内滚；折叠后只稳定摘要；sticky breadcrumb 仅展开且内容超出可视区时出现。完成后换成完成/失败状态。
- 外层摘要 `summarizeProcessSteps` / `summarizeTrajectoryProcessSteps`：无引擎时必含 `Stub`（PRD-013 验收 4），无假耗时 / loading / live 字样。引擎 live chrome（`showLiveChrome`）才显示 Loading / Running。stub 源永不置 `streaming`。
- 思考行摘要就是这条思考自己的文字，不把后面的工具名拼进去。外层摘要仍按步骤列出 thinking 和工具名。披露箭头只画在外层摘要；Thinking 与工具行不画 chevron，有正文时仍可展开。
- 工具行上的 `thinkingText`（live 块把 `:think:` 从工具正文拆出去之后留下的思考）画在标题下，工具正文收起时也留着。不把它拼进工具名或摘要。`showToolInvocationDetails` 关掉时，标题下不留这段思考，也不留 `file_edit` 的增删统计；工具名和摘要还在。
- 同一块 live overlay 的 summary 已是 tool、chunks 里仍有正文时，投影仍是这一块：再交一行助手正文（沿用这块 attribution，过滤页留得住），工具行只用工具名，正文不写进工具摘要。没有正文的工具块仍是一行。投影缓存命中时两行一起交。同一封信落盘时工具臂也带着这段正文。根对话页和子代理页走同一条投影。
- 轨迹跳转按钮在该行标题行内，只在这一行 hover 或键盘焦点时出现，不随父级思考块一起亮。工具结果 payload 用预览块，和思考正文分开。
- 阅读列身份条、过期快照条与时间线流宽 `min(100%, 720px)` 居中（`min-width: 0`），用户气泡贴这一列的右缘，不贴窗边。
- 默认态：对话页收起，轨迹页展开（验收 2）。视图 `conversationProcessFold.ts`；两页共用 overlay 辅助函数，宿主 DOM 各自一套。
- 换会话：对话页过程折的外层、思考和工具展开只属于当前这条。绑到另一条会话时先清掉这些展开再画；相同的 `fold:` / `fold:overlay:` id 不再沿用上一条的展开，对话页回到默认收起。人在轨迹页、对话时间线藏着时也收起：结构相同的下一帧不会把上一条的展开留在 DOM 上。新会话的引擎副本还是 `pending`、名单未就绪，或配对保持挡住另一条会话时，时间线和已经打开的轨迹表不再留着上一条的步骤，轨迹上一条的 turn 关联也清掉。同一条会话重连和 KEEP leftover 不收起、不清表。
- 折壳不是 Copilot Chat 列表行，也不是 `groupIdentity`；分组按 Desktop ADR-046「平行 span overlay」。

## 5. 图示卡（visualize）

- 协议类型在 `common/conversationVisualize.ts`：`type: 'diagram'`（`mermaid` 必填）或 `'comparison'`（`options[]`：name / pros / cons / recommended / 可选 mermaid）。`parseVisualizeArgs` 失败时给 `fallbackMarkdown`（错误说明 + 原始 fence）。
- 渲染：`conversationVisualizeCard.ts` 在时间线以一张卡片呈现，无 You / Agent 气泡头。卡头只有一行：有 `title` 时用标题（种子标题含 Stub），没有标题才用「Visualize · Stub: diagram / comparison」。全屏按钮在这一行右侧，图贴在卡内，不再重复标题，也不再套带独立滚动条的内框。`conversationVisualizeOverlay.ts` 全屏 overlay（Close + Reset）。Escape 只听 `overlay.element`（不再在 layout 容器上吞键），先关图示、不关子代理对话框或根会话。**不是** mermaid preview editor tab。
- mermaid 宿主 `conversationMermaidHost.ts`：依赖内置扩展 `vscode.mermaid-markdown-features` 的 `chat-webview-out` 资源起 webview；扩展缺失时 `fallback: true`，退回 `<pre>` 源码 fence + Stub 文案（PRD-014 验收 4）。
- 引擎 admitted `visualize` **只**映射为 `visualization` kind（`visualizeArgsFromMermaidTool` 是未来 adapter 入口），不进 tool / reasoning span，轨迹不投影。

## 6. 与需求验收的对应

| PRD | 验收 | 落点 |
|-----|------|------|
| 003 | 1–3 | §2 时间线树；发送链见 [composer-and-inbox](composer-and-inbox.md)；stub 回复 `stubEcho` 标记 |
| 003 | 5 乐观占位 | §2 用户卡：发起窗 `pending` 行标 Sending…，不可点编辑；L2 接住后才是持久用户卡。未接住时 Composer 写 Message not sent，不写已发送 |
| 012 | 1 双页不可关、默认对话 | §1 `ConversationLens` 透镜切换 + 持久化 |
| 012 | 2 对话页不含注入 / SYSTEM | §2 末段 |
| 012 | 3 轨迹至少一条 context / 带 block 的 user / SYSTEM；局部检查器 | §3.1 fixture extras + §3.2 检查器 |
| 012 | 4–5 过程折默认展开、subtool 缩进 | §4 / §3 |
| 012 | 6–8 不自动切轨迹、诚实空、非 Copilot | §3.2 |
| 020 | 2 轨迹搜索与虚拟化 | §3.2（分段 Overview 已落；带时间刻度的瀑布条仍 Deferred） |
| 013 | 1–5 | §4 |
| 014 | 1–5 | §5 |

## 7. 测试

`conversationLens.test.ts`、`conversationEngineHistoryList.test.ts`、`conversationEngineSnapshotsList.test.ts`、`conversationLensRevealNavigation.test.ts`、`conversationTimelineScroll.test.ts`、`conversationTurnMarkdown.test.ts`、`conversationUserBubbleCollapse.test.ts`、`conversationPinnedUserPrompt.test.ts`、`conversationTrajectory*.test.ts`（含 `ImportBoundaries`）、`conversationProcessFold*.test.ts`、`conversationVisualize*.test.ts`。import 红线由 `conversationImportBoundaries.test.ts` 机械 enforce（[ADR-006](../../../dev/decisions/006-shell-invariants.md) INV-NO-COPILOT）。
