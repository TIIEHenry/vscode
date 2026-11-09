---
title: "2026-11-06 默认窗口交互设计审查收口"
type: plan
status: draft
phase: N/A
updated: 2026-11-06
summary: "五路只读代码审查找出默认编辑器窗口约 60 条交互问题：失败反馈无关闭路径且丢输入、区域隐藏与浮层关闭后焦点丢失、连接阶段在各表面说法不一、破坏性操作缺确认、Sources 勾选随筛选丢失、同类操作行为不一致。按共享层分六组条目，按共享文件排成八个切片，八项设计分歧中 D1（Stop 留在 Inbox）已由用户拍板，其余七项待拍板。规则 16 首审须改稿，已改。未改代码。"
---

# 2026-11-06 默认窗口交互设计审查收口

状态：草案。负责：agent:claude。

覆盖需求：PRD-002、PRD-004、PRD-005、PRD-007、PRD-009、PRD-015、PRD-018、PRD-022、PRD-028、PRD-029。

对照 [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md)、[产品愿景](../../docs/product/vision.md)，以及 Conversation 行为合同 [composer-and-inbox](../../docs/systems/conversation/composer-and-inbox.md)、[lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md)。视觉、焦点环、reduced-motion 与 ARIA 已由 [2026-10-30 视觉审查收口](ui-visual-review-2026-10-30.md) 承接，本方案只管流程、状态归属、键盘路径、反馈与恢复。已有其他方案签收的条目只引用、不重复认领。

## 现状与证据

2026-11-06 按五个区域派只读子任务读代码：Conversation 主流程；会话管理与会话内导航；Navigator、Sources 与 Preview 类别条；Engine / Connection 首选项与连接状态；工作台壳与跨区域。行号以写稿时工作区为准，工作区有大量他人未提交改动，实施前按符号名重新定位。

规则 16 只读审查逐条核了 22 条代码断言，16 条完全成立，其余部分成立；部分成立处已在正文改写。这些结论都来自源码阅读，没有在测试配置的默认窗口里实测。需要运行时确认的疑点单列在文末。

产品行为变化先改需求或系统规格（愿景原则 5）。下文每条新增或改变用户可见行为的条目都写了要先改哪一处；只让代码回到现行合同的条目注明「回到合同」。

## 不在范围与已由他处承接

- 视觉、像素、焦点环样式、动效时长：归视觉审查收口方案。
- Agents Window（`src/vs/sessions/`）：不属于本项目产品窗口。
- 上游组件内部行为：只在产品代码里调用或绕开，不改上游文件。
- 引擎在听、界面却显示未连接：视觉审查 V9 已记。
- **关闭 Panel 后的焦点去向**：D17 已定「Preview 可见时照上游回到 Preview 活动组；不可见时按 `focus()` 的顺序」，由 [r09-5](review-2026-10-30-r09-workbench-shell-plan.md) 签收承接，未实施。本方案不改，实施时按 r09-5。
- **断连状态跨区域重复（V2=A）**：设置页两颗 Open Connection、状态栏 warning 底、身份条整句警告色，由视觉审查方案 S3 签收承接，尚无实施检查点。本方案 I3 的统一文案函数与它共用改动面，见切片顺序。

## I1 失败反馈的归属、关闭与输入保留

规范 §6 第 5 条：错误只在出错区域显示一次，一个图标加一句说明加至多一个操作。原则八：状态要诚实。

1. **Composer 失败提示行出现后不消失（回到合同）。** `conversationLensComposerChrome.ts` 的 `showPostFailure` 把 `host.postFailureVisible` 置为 true（约 938 行），生产代码里只有 `conversationLens.ts`（约 309 行）初始化为 false，没有清除路径；`updateGateRow`（约 879 行）见到它就提前返回。切会话的 `applyActiveSession`（`conversationLensSessionBinding.ts` 约 241–258 行）也不清。改法：同类写操作下次成功时清除，切会话时清除，并给一个关闭按钮。
2. **失败文案借用"消息未发送"（回到合同）。** Stop（`conversationInboxOverlay.ts` 的 `onStopClicked`）、Goal、复制、权限响应、删除回合同步失败时都调 `showPostFailure`，显示 `conversationLensDockStrings.ts` 里的 "Message not sent — engine disconnected. Draft kept." 或 "Retry failed — could not post."。用户点 Stop 却看到"草稿已保留"。改法：每种动作用自己的一句说明，显示在触发它的控件旁；Composer 上方只留发送与重试失败。权限座位异步失败已走座位自己的 `respondFailure`，同步失败也改走座位，不再借 Composer 行。
3. **Engine 对话框先关后发，失败丢输入。** Providers（`engineProviderModelSection.ts` 约 742→770 行，含 API key 密码框）、MCP（`engineMcpSection.ts` 约 780→926 行）在 RPC 返回前关闭输入对话框，失败只在节内写一行。改法：失败时用原值重开对话框并在框内显示错误。先在 [engine-catalog](../../docs/systems/workbench/engine-catalog.md) 写明失败保留输入。
4. **Triggers 对话框开着时被 refresh 静默丢弃（回到合同）。** 连接事件触发 refresh（`engineTriggersSection.ts` 约 248–254、315–319 行），确认后在约 836 行静默返回。Providers / Models 在连接变化时也静默返回，而 MCP、Rules 写 `engineWriteNotSentCopy`。改法：静默丢弃统一改写"未发送 / 未确认"文案。
5. **改名失败丢掉已输入文字。** `conversationLensSessionBar.ts` 提交前先关编辑框（约 633 行），失败或空标题时回退。改法：失败时保留编辑框与输入，就地写原因。先在 [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md) 的改名段补这一句。

切会话时丢弃正在编辑的回合，见待拍板 D7。

验收：上述失败各触发一次，错误只在出错控件附近出现一次；重试成功后提示消失；Providers 失败后 API key 仍在框内；改名失败后输入仍在。

## I2 区域与浮层的焦点去向

原则四：键盘定位可辨。PRD-018：键盘可达。

1. **隐藏 Conversation / Sources 时焦点落到 body。** `layout.ts` 的 `setConversationHidden`、`setSourcesHidden`（约 2074–2118 行）只改显隐；`partRegionHideControl.ts` 的 − 钮本身在被隐藏区域里。上游侧栏隐藏时会交出焦点。改法：隐藏前若该区域持有焦点，按 `Layout.focus()` 的顺序交给下一个可见区域。先在 [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) 写明隐藏时的焦点交接。
2. **四钮重新打开区域不聚焦，Sources 无聚焦命令。** `layoutActions.ts` 的显示动作不移动焦点；状态栏与 Ctrl+Alt+I 走的 `showConversationPart` 会聚焦。全仓唯一的 `focusPart(SOURCES_PART)` 在 `Layout.focus()`（约 1477 行），没有单独的命令。改法：新增 Focus Conversation / Preview / Sources 三条命令；键盘触发的显示动作同时聚焦。先按 PRD-018 在 [commands](../../docs/systems/conversation/commands.md) §7 登记新键位并核对不与上游冲突。
3. **Sessions 列表刷新时把焦点拉回当前会话。** `conversationSessionsView.ts` 的 `updateActiveSession`（约 614–629 行）每次 `refreshList` 都对当前会话 `setFocus` + `reveal`；刷新由会话变更、引擎连接变更和名册明细变更触发，明细事件在消息数或待确认数变化时发出（`conversationEngineRosterService.ts` 约 2098–2108 行）。后台会话收到新消息时，用方向键浏览会被拉回当前行。改法（回到原则四）：只在活动会话切换时设选中与焦点；数据刷新保留原焦点项与滚动位置。
4. **窄宽 SessionBar「更多」键盘进不去（回到合同）。** `conversationLensSessionBar.ts`（约 263–330 行）打开后焦点留在按钮上，没有方向键处理；窄宽时会话选择器被隐藏，History、Snapshots、新建、删除、切换都只剩这个入口。改法：照搬下级代理弹层（`conversationNavigation.contribution.ts`）的首项聚焦、上下键、关闭回焦。
5. **轨迹与时间线互跳后焦点丢失，失败无反馈。** `conversationLensProjection.ts`（约 332–349 行）先隐藏发起侧，再只滚动不聚焦；找不到映射时直接返回，记录超出 5000 条窗口时 `conversationTrajectory.ts` 的 `revealRecord`（约 719–756 行）静默返回。改法：跳转后聚焦目标行（已有 `focusRecord`）；无映射时给一行说明。先在 lens-and-trajectory 写明跳转后的焦点与失败反馈。
6. **Engine / Connection 窄宽导航按 ↓ 直接进详情。** `enginePreferencesPane.ts` 焦点变化即 `selectSection`，窄宽时切详情并聚焦 Back；Connection 同理。改法：窄宽下只在 Enter / open 时进入详情。先在 engine-catalog 写明窄宽导航的进入方式。
7. **确认弹层关闭不还焦点（回到合同）。** `engineConfirmPopover.ts` 关闭后不把焦点还给触发按钮，也不圈住 Tab；行尾按钮只在悬停或焦点时出现，焦点一丢按钮也消失。改法：关闭回焦触发按钮，弹层内 Tab 循环。I4 复用这颗弹层，先修它。
8. **小处。** 回到底部按钮点完自隐藏，焦点无处落（`conversationTimelineHost.ts` 的 `scrollToEnd`），改为回焦输入框；Inbox 待确认芯片只滚动不聚焦（`revealPendingTurn`），改为滚到位后聚焦座位主按钮。两处都先在 composer-and-inbox 补一句焦点去向。

验收：只用键盘走一遍：隐藏 / 重开三个区域、窄宽打开 SessionBar「更多」并选一项、轨迹与时间线互跳、Engine 窄宽导航、确认弹层取消，每一步焦点都落在可见且合理的位置。后台会话收到消息时，方向键浏览 Sessions 列表不被打断。

## I3 连接阶段与模型回显的一处真相

原则八：重连中不能显示在线；愿景原则 3：诚实降级。

1. **连接阶段文案与色调统一。** 节正文一律写 "No engine connected…"（`engineSectionChrome.ts` 约 66 行），重连、配对、失败时也一样；配对中 Composer 写 "Engine not connected"（`conversationLensComposerChrome.ts`），状态栏写 "Waiting for pairing"（`conversationSessionStatus.ts` 约 186–199 行）；身份条与状态栏把连接中、重连中映射成 standard 显示绿点（`conversationSessionStatus.ts` 约 174–182 行），Connection 页与 Engine banner 又各有一套映射（`connectionPreferencesPaneLabels.ts`、`enginePreferencesPane.ts`）。改法：一个阶段到文案与色调的共享函数，连接中单独一档，Composer、状态栏、身份条、两张设置页共用。配对保持时 Composer 门闩仍写 `Engine not connected` 是 composer-and-inbox 写定的，若要改成 Waiting for pairing，先改那一句。
2. **状态栏模型回显写死 "No model"。** `conversationSessionStatus.ts` 的 `getConversationModelEchoStatusText`（约 213–215 行）不带参数；Dock 接通后列出真实模型（`conversationComposerCatalog.ts`）。改法：读 Dock 的同一选中值；没有权威来源就不显示这一项。

权限座位 "1 confirmation pending" 与 Inbox 计数对不上，见待拍板 D6。

验收：模拟未连接、连接中、重连中、配对中、失败、已连接六个阶段，状态栏、身份条、Engine 与 Connection 页的文案和色调一致，重连中不显示绿点；接通并选模型后隐藏 Conversation，状态栏回显真实模型或不显示。

## I4 破坏性操作的确认

规范 §5.6 只点名 Engine Preferences：删除、清除凭据、移除和导入确认锚在按钮的弹出层上，不用系统原生对话框。§7 反模式清单没有原生对话框条目。本节只做 §5.6 直接覆盖的部分；把这条规则推广到 Connection、Snapshots 等其他表面属于扩大规范，归待拍板 D3。

1. **Triggers 的 Delete 没有确认。** `engineTriggersSection.ts` 的 `handleDelete`（约 737–753 行）直接发请求。Triggers 在 Engine Preferences 内，§5.6 直接适用。改法：用 `engineConfirmPopover`。
2. **Connection 操作行不按状态禁用。** Disconnect 与 Forget（`connectionPreferencesPane.ts` 约 773–780 行）不经 `updateConnectGates`，未连接时 Disconnect 点了没反应。改法（回到原则：运行时不可用的禁用并写原因）：用 `presentAction` 禁用并写原因。

验收：Triggers 删除弹锚定确认，Esc 取消回焦按钮；Connection 未连接时 Disconnect、Forget 禁用并有原因。

## I5 Sources 的勾选、筛选与键盘

原则八：写操作范围要诚实。PRD-009、PRD-005。

1. **筛选会永久删除勾选（回到合同）。** `sourcesChangesList.ts` 的 `renderFromSnapshot` 用筛选后的 `entries` 清理 `checkedEntryIds`（约 1094–1098 行），清空筛选也回不来。改法：只按全量快照 `allEntries` 清理。
2. **分组头与目录行键盘碰不到。** 它们画在首个文件行里，勾选框 `tabIndex=-1`（约 226、242 行）；收起后列表里留一个隐藏的锚点文件（约 1300 行）。改法：分组与目录做成独立树节点，左右键折叠、Space 勾选；最小版本先让收起状态下的打开事件跳过锚点。锚点打开路径实施前逐行确认。
3. **Review「Unreviewed only」下打开即消失。** 打开标记已审阅，整表重画（`sourcesReviewList.ts`），焦点丢失。改法：焦点移到下一行；本次打开的行是否保留到下一次手动操作，实施时选一种并写进 Sources 规格。
4. **本轮路径筛选跨会话残留。** Review 不监听会话切换，横幅仍写 "Showing N files from this turn"。改法：换会话清掉路径筛选。
5. **Review 不跟双击固定标签。** 写死 `pinned:false`，Changes 跟随 `e.editorOptions.pinned`。改法：Review 也跟随。
6. **Mark all as reviewed 与进度只算筛选集合。** 改法：按钮写明作用范围，进度显示全量。

筛选时 Stage All 的作用范围，见待拍板 D8。

验收：勾选后筛选再清空，勾选还在；只用键盘折叠、展开、勾选一个分组；Review 未审阅模式下连续用 ↓ + Enter 审完多行，焦点不丢。

## I6 同类操作的一致性

1. **流式中写入判定不一。** 发送钮禁用并写 "Wait for the current reply to finish."（`conversationLensComposerChrome.ts` 约 847–849 行），重新生成、删除、错误重试、点用户卡编辑只查 `isReadingColumnWritesEnabled`（`conversationLensReadingColumn.ts` 约 189–202 行），流式中仍可点。改法：这四个入口与发送共用同一判定与同一句原因。Stop、Allow / Skip 在流式中本就应可点，不在此列。先在 composer-and-inbox 写明这四个入口的流式门禁。
2. **Stop、重试、重新生成没有进行中态。** 连点会重复发请求。改法：点击后禁用并显示 Stopping… / Retrying…，直到状态落定。与 I1.2 改同一组函数，合在一个切片。
3. **Navigator 单击语义回到规格。** [navigator-tabs-access](../../docs/reference/code-oss-b2/navigator-tabs-access.md) 已写「行 Inspect / 单击 → `setTarget`；Reveal 是另一个动作」。代码里层级树单击打开子代理对话框并设目标、工具活动打开底部 Inspect 并抢焦点、成员单击打开对话框（`navigatorAgentsView.ts`、`navigatorTeamList.ts`）；任务列表没有 `openOnSingleClick`，单击无反应，双击或 Enter 才设目标（约 561–571 行）。改法（回到合同）：四个列表单击都只 `setTarget`、不抢焦点；Reveal 走行内按钮。行为与用户现有习惯不同，实施前给用户看一段说明。
4. **状态被省略号截掉。** Team 成员、任务、工具活动把状态拼在名字后的单行省略 span 里（`navigatorTeamList.ts` 约 749、767 行，`navigatorAgentsActivity.ts`），窄栏时状态最先被截。依据：原则八「状态常显」与 PRD-028 第 481 行附近的状态常显要求。改法：状态做成行尾固定列，复用层级树的图标加文字。
5. **筛选框缺键盘出口。** Sessions、Navigator 三处、Sources 共五份同构筛选框，框为空时 Esc 无反应、↓ 进不了列表。改法：抽一份共享行为：Esc 先清空、再回列表；↓ 进列表首项；无结果一行文案带清除链接。Sessions 筛选结果始终包含当前会话是 `conversationSessionsView.test.ts`（约 635、650 行）锁定的现行行为，本方案不改。
6. **Sessions 行「更多」缺删除。** PRD-028 第 481 行已要求 Sessions 行尾「更多」承接 Open / Delete；代码里行菜单只有 Open beside（`conversationSessionsView.ts` 约 499–507 行），删除在视图标题栏且删当前会话。改法（回到 PRD-028）：行菜单补针对该行的删除。PRD-002.6 与 [session-windows](../../docs/systems/conversation/session-windows.md) 第 36 行穷举了删除入口，同刀补上这一入口。F2 改名、Delete 删除的列表键位按 PRD-018 先登记再加。
7. **Diff 开到 Conversation 时不打开隐藏的 Conversation。** `sourcesChangeEntryOpen.ts`（约 384–425 行）直接向 Conversation 组 `openEditor`，不调 `setPartHidden(false, CONVERSATION_PART)`。改法：打开前先显示区域。
8. **快捷键冲突。** Toggle Conversation（Ctrl+Shift+Alt+C，`layoutActions.ts` 约 265–274 行，无 when）与上游 Copy Relative Path 在 Linux / macOS 上同键同权重（`fileCommands.ts` 约 310–319 行，带 `!editorFocus`），冲突出现在编辑器外，例如 Sources Files 树。改法：换键或给产品命令加 when，登记进 commands §7。与 I2.2 同改 `layoutActions.ts`，合在一个切片。
9. **删除当前会话后的落点按目录下标取邻居**（`conversationEngineRosterService.ts`），不是列表上看到的下一行。改法：按 Sessions 列表的显示顺序取下一行。先在 session-windows 写明落点。

验收：流式中重新生成、删除、重试、编辑禁用且原因与发送一致；连点 Stop 只发一次；Navigator 四个列表单击后焦点都留在列表；窄侧栏下 Team 状态仍完整可见；五个筛选框键盘行为一致；Sessions 行菜单能删除该行。

## I7 低优先

- 发送、退出编辑、− 钮的 tooltip 不带快捷键；Stop、聚焦输入框、Allow / Skip 没有命令（commands 也列在"仍缺"）。
- toast 正文直接用 `getErrorMessage(error)`（`conversationTimelineRevealService.ts`、`conversationSessionChatService.ts`、`navigatorReveal.ts` 约 61 行、`sourcesReviewAttributionService.ts`、`conversationNotifications.contribution.ts`），违反反模式 10。改为一行说明，原文进详情。
- `conversationSplitActions.contribution.ts` 的几条 `f1:true` 命令在 Conversation 无焦点时静默返回。改为先聚焦再执行。
- Navigate Left / Right（`navigationActions.ts` 约 37–75 行）不识别 Conversation 与 Sources。
- Navigator 菜单与右键菜单仍写 "Primary Side Bar"（`layoutActions.ts`）。
- Preview 类别条提示点只靠颜色、无 tooltip（`previewCategorySwitcher.ts` 约 103–108 行）。
- Review 顶部说明未写明只读（PRD-005），`sourcesReviewList.revealMiss` 是硬编码中文。
- Changes 右键菜单只有换方式打开，缺 Stage / Unstage。
- Sources 三个 tab 没有切换命令。
- Engine 列表两套键盘模型（普通 DOM 行逐钮 Tab vs WorkbenchList）；§5.3「超过 5 行再显示 N 个」全仓未实现，需改规范或补实现。
- 窄宽 SessionBar「更多」里的会话行无当前项对勾与元信息，排序与 Sessions 列表不同（§5.5）。
- 下级代理弹层每行只有标题，没有运行中 / 待确认 / 失败状态。
- Agent 面包屑可 Tab 到但没有 ←/→/Enter。
- 任一历史工具失败就把整条会话标 failed（`conversationSessionsViewStrings.ts`）。
- 有未保存草稿时 Skills / Agents 静默弹回选择，应就地提示 Save / Discard。
- 点导航会重复激活同一节，Triggers / Clipboard / Context Variables 的 refresh 会作废未返回的写操作。

## 待拍板

- **D1 Stop 放在哪。** 两次用户决定冲突。2026-09-28 用户确认 Stop 留在 Inbox 右簇、不与发送合并（composer-and-inbox §10 约 133 行，规范 §5.2 控件表）；2026-11-02 规范 §1 续补也写保留独立 Stop。2026-11-04 [GPT 视觉复刻决定](../../docs/decisions/ui-gpt-visual-replication-2026-11-04.md)（`accepted`，更晚）写生成中使用蓝色圆形 Stop、位于最右主操作位，composer-and-inbox 约 27、137 行与规范 §10 HEAD 差距表约 348 行跟进了这一写法。代码里 Stop 仍在 Inbox（`conversationInboxOverlay.ts`）。A：按 11-04 决定把 Stop 移到发送位，改规范 §5.2 控件表、composer-and-inbox §10 与代码。B：以 09-28 / 11-02 为准，改回 11-04 决定与两处跟进的文字。
  **已定（2026-11-06 用户）：B，「放在最开始的设计」。** Stop 留在 Inbox 右簇，不与发送合并。代码本来就在 Inbox，没有代码改动。同日已改文字：11-04 决定第 6 条与验收、PRD-028 的 11-04 修订行、composer-and-inbox 的底栏段与 11-04 复刻段、规范 §10 差距表。
- **D2 Inbox 待确认计数口径。** 现在只数权限请求（`conversationEngineRosterService.ts`），提问座位与等待客户端响应的工具不计。A（推荐）：三类都计入。B：维持只数权限。
- **D3 确认规则是否推广到 Engine Preferences 以外。** 涉及：Connection 的 Forget this Engine（会断开在线引擎，且不像换引擎那样检查待确认会话）与 Disconnect；原生框确认的吊销设备、有待确认会话时切换引擎（`connectionPreferencesPane.ts` 约 1695、2364 行）、删除快照（`conversationEngineSnapshotsList.ts` 约 593 行）；删除会话（session-windows 第 36 行写明用 `IDialogService.confirm`）；删除回合与 Snapshots Restore（无确认）。A（推荐）：扩大 §5.6 适用范围到所有产品自有表面，以上全部改为锚定弹层，Forget / Disconnect 补待确认会话检查；同步改 §5.6 与 session-windows。保留原生调用的白名单至少包括 `uaClientExternalLink.ts`（约 29 行，外链打开确认）。B：只补缺失的确认（Forget、删除回合、Restore），已有原生框维持。C：维持现状。
- **D4 Projects 单击不在工作区的文件夹直接加入工作区。** 符合 PRD-029，但单击即改工作区且无撤销。A：保持，补一条可撤销的通知。B：改为双击或菜单项加入。
- **D5 Clipboard Clear 与 Plugins Unload 是否需要确认。** engine-catalog 已写为立即执行。A：纳入确认。B（推荐）：维持，因为可重新加载，不算不可逆。
- **D6 权限座位的数量文案。** 每张座位写死 "1 confirmation pending"（`conversationConfirmationSeat.ts` 约 218 行），有 N 张时与 Inbox 的 "N confirmations pending" 对不上。[agent-ui](../../docs/systems/chat/agent-ui.md) 第 68 行（人类 2026-08-30 补充）点名复用「N confirmation pending」摘要行；同一文案也是读屏名（`conversationAccessibility.ts` 约 15 行），被 `conversationTimelineRenderer.test.ts`（约 164 行）断言；这个槽位已决时还要显示 Allowed / Skipped。A：保留摘要行，改为显示这张座位所在回合的真实待确认数。B：维持现状，只在 Inbox 计总数。改动须同改读屏文案与测试。
- **D7 切会话时正在编辑的回合。** `applyActiveSession` 调 `exitComposerEdit`（`conversationLensSessionBinding.ts` 约 248 行），`beginTurnEdit` 只快照撰写草稿，编辑稿静默丢失。现行合同没有写这一情形。A（推荐）：按会话保存回合编辑稿，回到该会话时恢复，不弹确认。B：离开前锚定提示 Save / Discard。选定后写进 composer-and-inbox。
- **D8 筛选时 Changes 的 Stage All 作用范围。** `entriesInGroup` 读筛选后的 `currentEntries`（`sourcesChangesList.ts` 约 1236、1357 行），按钮写"全部"却只暂存可见项。A（推荐）：筛选时按钮改名 "Stage N shown"，行为不变。B：始终作用于整组，与上游 SCM 一致。

## 需运行时验证

- 回合编辑按 Esc 或保存后，输入框搬回列底是否聚焦。
- Stop 成功、按钮禁用后焦点去向。
- 时间线滚动位置按会话保存与否；轨迹视图重新显示时是否归零。
- 需要客户端响应的工具在收起的过程折里，回应按钮是否可见。
- 流式中途断连时那一行是否写明已中断。
- 后台会话从运行中变回空闲是否触发列表刷新。
- 删除当前聚焦的叶后 DOM 焦点去向。
- I6.8 两条键位实际谁生效。
- 两个 Diff 面的 Revert 走 `git.clean`，上游是否弹确认、能否取消。
- 分屏第二叶的会话被判为不活跃时，是否误弹"需要你处理"（`conversationPendingSeat.ts`）。

## 切片与顺序

几组条目改同一文件甚至同一函数，按下表合并与排序，不并行改同一文件。

| 切片 | 内容 | 共享改动面 | 前置 |
|:---|:---|:---|:---|
| S1 | I2.7 确认弹层回焦，I4.1，I1.4 的 Triggers 部分 | `engineConfirmPopover.ts`、`engineTriggersSection.ts` | 无 |
| S2 | I1.1、I1.2、I6.1、I6.2 | `conversationLensComposerChrome.ts`、`conversationInboxOverlay.ts`、`conversationTimelineRenderer.ts`、`conversationConfirmationSeat.ts` | composer-and-inbox 先补流式门禁 |
| S3 | I1.3、I1.4 的 Providers / Models 部分、I1.5、I2.4、I2.5、I2.6、I2.8、I4.2 | 各自文件，互不重叠 | 对应规格先补焦点与失败句 |
| S4 | I2.1、I2.2、I2.3、I6.5、I6.6、I6.7、I6.8、I6.9 | `layout.ts`、`layoutActions.ts`、`conversationSessionsView.ts`、筛选框 | PRD-018 / commands §7 键位登记；PRD-002.6 与 session-windows 补删除入口 |
| S5 | I3 全部 | `conversationSessionStatus.ts`、`engineSectionChrome.ts`、两张设置页 | 与视觉审查 S3（V2=A）同改这几处，先做 V2=A 或合在一起 |
| S6 | I5 全部 | `sourcesChangesList.ts`、`sourcesReviewList.ts` | 无 |
| S7 | I6.3、I6.4 | `navigatorAgentsView.ts`、`navigatorTeamList.ts` | 给用户看单击语义说明 |
| S8 | I7 | 按需挑 | 无 |
| 拍板后 | D1–D8 | — | 用户拍板 |

按上表划分后，各切片的生产文件不重叠，可以并行；I2.8 与 I2.4 都在 Conversation 内但分属 `conversationTimelineHost.ts` 与 `conversationLensSessionBar.ts`。S1 先做，因为 D3 若选 A 会复用同一颗弹层。每个切片单独提交，只暂存本切片文件。

## 验证

只用本地门禁（[health-gates](../progress/health-gates.md)）：`npm run compile-client`、改到的文件跑 eslint、`python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`，单测用 `scripts/test.sh` 或 `scripts/run-unit-custom.sh` 跑对应 suite，例如 `conversationLensComposerChrome`、`conversationSessionsView`、`conversationLensSessionBar`、`enginePreferencesPane`、`sourcesChangesList`、`sourcesReviewList`、`navigatorTeamSubviews`。每条修复补一条能复现原问题的单测（先红后绿）。

键盘与焦点类条目另在测试配置的默认窗口（[测试配置](../../docs/guides/test-profile.md)，带 `--new-window`）里只用键盘走一遍各节验收；组件测试不替代这一步。

## 审查记录

2026-11-06 规则 16 只读审查：须改稿，Critical 2、Important 5、Minor 4，已全部改入。

- Critical：原 I2.2（关 Panel 焦点改走 `focusPanelOrEditor`）违反 D17 且与 r09-5 重复，已删，改为「已由他处承接」；原 I3.4（座位标题去掉数量）与 agent-ui 复用清单、读屏文案和测试冲突，已移为 D6。
- Important：原 I3.1（V2=A）与视觉审查 S3 重复认领，改为引用；原 I4 把 §5.6 扩大到全局且误称反模式清单有据，I4 收窄到 Engine Preferences，其余并入 D3 并列白名单；D1 行号与事实改正，不再把推翻 11-04 决定写成推荐；各条补上愿景原则 5 要求的先改需求处，原 I1.6 无合同依据移为 D7，I6.5 不再反转测试锁定的当前会话保留，I6.6 改引 PRD-028 第 481 行，I6.3 改引 navigator-tabs-access；切片表改为按共享文件合并排序。
- Minor：I6.1 验收排除 Stop 与 Allow / Skip；I6.4 依据改为原则八与 PRD-028；删去「Projects 点已在工作区的文件夹换成资源管理器」（PRD-029 验收 10 写定），覆盖需求补 PRD-029；I5.2 范围选择移为 D8。
- 部分成立的代码断言已改写：I1.2 不再称同一失败报两次；I2.2（原 I2.3）改为 `focusPart(SOURCES_PART)` 只在 `Layout.focus()`；I2.3（原 I2.4）写明刷新触发条件；I6.3 补任务列表单击无反应。
