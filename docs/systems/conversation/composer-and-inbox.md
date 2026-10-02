---
title: "Conversation Composer、身份条与 Inbox"
type: architecture
status: accepted
phase: N/A
updated: 2026-10-02
summary: "PRD-015 系统规格（视觉规则见 ui-design-principles / PRD-028；底栏已去掉空操作的 New Worktree 芯片）：PreFirst 居中 / Active 列底同一张 Composer；三种 composerPolicy；身份条 XOR；Inbox 左右分簇与 MessageQueue 状态机；待确认芯片走 revealPendingTurn，座位不是最后一根时解开贴底；Stop 仅 connected+streaming 时转 AgentService.Cancel；Goal 接通后转 SetSessionGoal / CancelSessionGoal；MessageQueue 列表 Enqueue 接通后转 EnqueueQueueItem（无引擎禁用、失败不造假项）；FAILED / UPLOAD_FAILED 行 Retry 走 retryMessageQueueItem（接通后按 upload 转 RetryQueueItem / RetryQueueItemUpload；无引擎禁用、失败行仍可操作）；接通后转 Pause/Resume/Clear/Hold/Release/Edit/Retry；catalog 无 GetQueue，接通 / 断连缓存 Inbox 文案 Queue not listed、不把 fixture 当引擎队列；Inbox AutoDrive 接通 / 断连缓存诚实空；turnEdit 保存接通后转 AgentService.EditMessage（空 turnId / 空正文不发；与载入正文相同只退出、不发、不报失败）；queueEdit 与载入正文相同同样只退出、不发 Edit、不报失败；断连 Send 未连不锁、引擎缓存不得 stub echo / 已同步；断连 Agent/Model 仅 No agent / No model；无假麦克风 / 假 Route；输入历史（无匹配的 @ 不吞 Enter）；StatusBar 芯片与诚实降级；发起窗乐观发送在时间线标 Sending…，不是已落盘回合"
---

# Conversation Composer、身份条与 Inbox

> 导航：[系统索引](INDEX.md)。需求：[PRD-015](../../product/requirements.md#prd-015-conversation-空会话与输入面) · [PRD-004](../../product/requirements.md#prd-004-权限座位) · [PRD-007](../../product/requirements.md#prd-007-诚实降级)。方案：[conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)（T1–T6 `implemented`）。MessageQueue 列表 / 行交互 SSOT 为 Singularity `message-queue-bar.md`，本页只写本仓落点。

## 1. 两个阶段，一张 Composer

| | PreFirst（会话无可见消息，含无 `localPendingSends`） | Active（已有消息，含乐观 pending） |
|---|---|---|
| Composer 位置 | 阅读列居中；空会话草稿至少两行（52px） | 列底 Dock。底栏最小 28px：幽灵控件 24px，发送圆 28px |
| 身份条（引擎 · 文件夹 · 分支） | Composer 上方 | 阅读列顶（`ConversationIdentityStrip`），**不**进 SessionBar / 工具栏 |
| Agent 选择 | 在 Composer 行 | 消失，不进 SessionBar |
| Route | **省略**（引擎无 `routeIndex` RPC，不画假下拉） | **省略** |
| Model / Permission / Tools | Composer 行 | 仍在 Composer 行 |
| Inbox / Goal / Stop | 无 | Dock 顶 Inbox overlay（与 Composer cluster 同 `sideBar` 托盘底；顶边在 cluster） |

输入卡比 720px 阅读列再宽 32px（左右各多 16px），`border-radius: 16px`，浅投影。草稿字号 16px、行高 24px。这和 [UI 设计原则 §5.2](../../architecture/cross-cutting/ui-design-principles.md) 的 8px 圆角、不投影仍不一致，差距记在 [UI 设计原则 §10](../../architecture/cross-cutting/ui-design-principles.md)。

底栏控件：发送实心圆，其余无背景；**不画**假麦克风。HEAD **不画** `+` / 独立 Task 钮 / ctx 环（测锁缺席；PRD-015 验收 2 仍写 `+`，不升 PRD）。Enter 发送、Shift+Enter 换行。同一时刻只有一个输入（PRD-015 验收 1–4）。`…` **仅** `.is-narrow` / `.is-compact`（< 450 / < 300）出现，宽叶默认藏；底栏不用横向滚动藏发送/输入。宽叶未连「not connected」只走 PreFirst 身份条，Active 走 SessionBar 徽章，Inbox 不重复 sync。配对保持的门闩仍是 Engine not connected。传输仍在、但 KEEP leftover 的会话列表失败时，门闩写 Session unavailable，不把活连接说成未连接。同步原因若只是纯数字则不拼进 Session disconnected / Session degraded，也不拼进断连快照条。没有任何回合、待发或时间线的关闭会话不显示断连快照条；PreFirst 空阅读列也不画这张条。

HEAD 底栏从左到右（`conversationLensDock.ts`）：Tool options（齿轮，开 Tune 浮层）、Permission（Ask / Agent / Permit）、Agent（仅 PreFirst）、`…`（仅窄叶）、Model、放大输入、发送。除发送外无底无框（[UI 设计原则 §5.2](../../architecture/cross-cutting/ui-design-principles.md)）。引擎未接通时 Permission / Model 用 `disabledForeground`，不伪装成可点。空操作的 `New Worktree` 芯片已从底栏移除：引擎没有会话隔离 RPC，画出来会和 [PRD-007](../../product/requirements.md#prd-007-诚实降级) 冲突。

身份条数据：`getConversationIdentityFolder`（首个工作区文件夹）、`getConversationIdentityBranchName`（`ISCMService` HEAD ref）；无文件夹 / 无仓库时对应 chip 省略。引擎 chip 文案 = `getConnectionPhaseStatusBarText(getConnectionPhase(), pairingPending)`（与 StatusBar `status.conversation.engine` 同函数）；点击路由 = B10（`getEngineStatusCommandId(phase, pairingPending)` / `isConversationEngineLive` → `workbench.action.openEnginePreferences`；`pairingPending` → `workbench.action.openConnectionPreferences`，`onDidShow` 落到配对区；其余未连接 → 同一命令并落到 **Connection profiles**）；订阅 `IUniverseAgentConnection.onDidChangeConnection` 与 `IConversationRosterService.onDidChangeEngineConnection`。

接通且能力 `SUPPORTED` 时，Agent / Tools / Model 下拉由 `conversationComposerCatalog.ts` **只读填表**（`listAgentProfiles` / `listTools` / `listModels`）。Model 选中 catalog id 进 `submitInput.modelProfileId`（Chat `SessionInput.model_profile_id`；诚实空不带）。下拉变更可走已有 `switchModel?`。Agent / Tools 选择不进发送载荷。无引擎或能力未就绪时诚实空：Agent 选项**只有**「No agent」（无 Stub agent）；Model **只有**「No model」（无 Stub model）；Send 不要求选假模型。Permission 接通后走 `setPermissionMode`。Route **不画**（无引擎 `routeIndex`，不留只回显的 SelectBox）。

## 2. `composerPolicy`：同一张 Composer 的三种用途

`ConversationLens` 的私有字段 `composerPolicy ∈ 'compose' | 'turnEdit' | 'queueEdit'`（非导出 API，此处只描述状态机）：

- `compose`：正常输入；Send → lease `post({ kind:'submitInput', text })`（旧 `appendUserTurn` / `appendStubEchoAssistant` 是帧源 shim）。**从未连过**：无引擎 stub 帧源产 Stub echo，首条 `localPendingSends` 即可离 PreFirst；「No model」不锁发送。发起窗的 `localPendingSends` 在时间线上是 Sending… 占位（`pending`），不是已落盘回合，也不能点进编辑；引擎接住后由 L2 用户卡替换。**引擎缓存断连**（`hasEngineConnectionHistory()`）：Send 仍可用，先试 `enqueueMessageQueueItem`（断连缓存现网拒收）；失败则保留 draft 并写明确失败文案，**不** stub echo、**不**清输入、**不**写「已同步 / 已发送」。已连接时 service 层拒写 stub echo。
- `turnEdit`：点击时间线用户卡进入；保存走 `updateUserTurnText`（接通后转 `AgentService.EditMessage`，空 `turnId` / 空正文不发；未接通仍本地改）。去掉空白后与载入时要提交的正文相同（含合法引用尾块按同一规则重组），只退出编辑，不调用 update，也不弹出失败。发送钮在这份正文未改时禁用。Escape / Exit 回 `compose`。
- `queueEdit`：编辑 MessageQueue 项；进入时 `holdMessageQueueItem(..., 'EDITING')`，退出时 `releaseMessageQueueItemHold`；正文有变化时保存走 `updateMessageQueueItemContent`。去掉空白后与载入时要提交的正文相同（含合法引用尾块按同一规则重组），只退出编辑，不调用 update，也不弹出失败。保存钮在这份正文未改时禁用。

列表内编辑与队列编辑**复用同一 Composer**（PRD-015 验收 6）；展示态用户卡没有按钮。

## 3. Inbox overlay（Active 态）

`ConversationInboxOverlay`（`conversationInboxOverlay.ts`）挂在 Dock 顶，与 `.conversation-lens-composer-cluster` 共用 `sideBar-background`；分隔线在 cluster 顶边。Maximize 时 overlay 与可见 gate **留在文档流**（`flex-shrink:0`，composer `flex:1`），禁止 `display:none` overlay / gate-row（待确认座位与发送失败条仍可达）。Maximize **关** History / Snapshots / Visualize / Inbox 列表，且 **不**对整槽 `.conversation-timeline` 写 `display:none`（确认座仍在）。切会话同样关这些浮层。窄宽 Dock `…` 在已 Maximize 时写 **Restore timeline**。SessionBar 把上一级、下一级、History、Snapshots、New、Delete 以图标留在栏上。上一级和下一级任何宽度都留在栏上；History、Snapshots、New、Delete 在 `.is-narrow` / `.is-compact`（< 450 / < 300）收进 More。编辑器来回和关掉延伸标签在编辑器区。禁止 hide 写操作且无入口。Visualize / 子代理浮层挂在 `.conversation-timeline`（`position: relative`），不铺满 session window，Dock Stop 仍可点。

```text
[ list-ordered · No queue ] [ target ]            [ Stop ]
  左簇：Queue 列表 XOR 展开                 右簇
```

- MessageQueue 芯片可见的是 `list-ordered` 图标加状态文案。文字「MessageQueue」只在 `aria-label` 与 tooltip。空态同样是幽灵芯片：去掉原生按钮底。空队列且 Enqueue 不可用时芯片不展开列表（状态已经写在芯片上）。有队列项，或 Enqueue 可用时，点击才打开列表。
- 无权威时整槽省略或诚实空：stub / 从未连过「No queue」；接通 / 断连缓存「Queue not listed」（catalog 无 GetQueue，不把空列表说成活引擎队列）。不造假任务（PRD-007 / PRD-015 验收 5）。
- MessageQueue 列表头 **Enqueue**：列表能打开时才出现。从未接通且没有队列项时没有这颗禁用钮。有项而仍未接通时禁用（「Cannot enqueue without engine」）。接通或断连且有连接史时启用；断连+history 点击 `showPostFailure('engine_disconnected')`，不打开 prompt、不 enqueue。接通后点开 `IQuickInputService`；取消不发；确认后调用 `enqueueMessageQueueItem`（空正文 / 未知 session / 断连缓存 / stub 返回 false）。失败不把假项写入列表（接通 false → `failed`；prompt 中途断连+history → `engine_disconnected`）。Composer 发送仍走 `submitInput`，不经此钮。
- MessageQueue **FAILED / UPLOAD_FAILED** 行：**Retry**（`retryMessageQueueItem`）。未接通禁用（「Cannot retry without engine」）。接通后 FAILED → `RetryQueueItem`（`upload` 省略 / false）；UPLOAD_FAILED → `{ upload: true }`（`RetryQueueItemUpload`）。空 itemId / 未知 session / stub / 断连缓存 / 无 hook / 转发失败返回 false，行仍带 Retry，不退化成死徽章。点 Retry 不进入 `EDITING` hold。≠ 时间线 `retryError` / ContinueGeneration。
- 行元信息只写该项自己的状态：未在编辑的 `PENDING` 才是 Queued。`EDITING` 只标 Editing。`UPLOADING` 只标上传百分比。`SENDING` 写 Sending…，与队列头同一句。`FAILED` / `UPLOAD_FAILED` 只写失败原因，旁边是 Retry，不再前缀 Queued。
- Task 列表数据仍走 `getAutoDriveTasks` / `getAutoDriveTaskCount`（stub / 从未连过 fixture；接通 / 断连缓存诚实空）。HEAD **不画**独立 Task chip；`Team.TaskList` 仍只给 Navigator。
- Stop：未接通或时间线无 `streaming` 行时禁用（「Not generating」）。接通且有 streaming 行时启用，点击 `IConversationRosterService.cancelGeneration` → 引擎 `AgentService.Cancel`（未指定 agent 用末条 streaming 否则 `root`）。HEAD **不画** ctx 环。
- 待确认芯片只滚动，不代替 Allow / Skip。Inbox 点击定位第一张仍 pending 的权限座。回到会话在 `hasPendingAttentionSeat`（权限或问题）为真时定位，问题座走同一条 `revealPendingTurn`。定位立刻滚到该根，不用平滑 `scrollIntoView`。座位不是时间线最后一根时解开贴底跟随，避免下一帧或尺寸变化把视口拽回底部。座位就是最后一根时跟随保持。配对等待时芯片禁用，不滚动。
- Goal：控件是 `target` 图标。未接通时诚实禁用，只显示图标，tooltip「Needs an engine connection」。接通且尚无本机目标时图标单独显示，tooltip / aria 为「No goal」。接通后点开 `IQuickInputService` 输入。去掉空白后与当前目标相同，只关掉输入，不调用 set，也不弹出失败。非空且有变化才 → `IConversationRosterService.setSessionGoal` → 引擎 `PermissionService.SetSessionGoal`（空 / 未变 / 未知 session / 断连缓存不发）。已有本地目标时图标后显示该目标文字，清空确认 → `cancelSessionGoal` → `PermissionService.CancelSessionGoal`。取消输入框不发 unary。无 `GetSessionGoal`，图标旁文字与 tooltip 只反映本机上次成功 set。

## 4. MessageQueue 状态机

`conversationMessageQueueModel.ts`（对齐 Singularity message-queue-bar §3.2）：

- 项状态 `UPLOADING | UPLOAD_FAILED | PENDING | SENDING | FAILED`；hold 原因 `EDITING`。
- 队列级操作：`pauseMessageQueue` / `resumeMessageQueue` / `clearMessageQueue`；项级 `holdMessageQueueItem` / `releaseMessageQueueItemHold` / `updateMessageQueueItemContent` / `retryMessageQueueItem`。
- `conversationMessageQueuePendingCount` 供 Inbox 徽标。
- stub / 从未连过：状态由 `setMessageQueueFixture` 注入。引擎接通后 Inbox 操作转发 `AgentService` Pause / Resume / Clear / Hold / Release / Edit / Retry（未知 session / 空 item / 空正文 / 断连缓存 / 无 hook 不发）。`enqueueMessageQueueItem` 接通后转发 `EnqueueQueueItem`（空正文 / 未知 session / 断连缓存不发）；`retryMessageQueueItem` 接通后按 `upload` 转发 RetryQueueItem / RetryQueueItemUpload（空 item / 未知 session / 断连缓存 / 无 hook 不发）；stub / 从未连过诚实失败且不改 fixture。Composer **接通**发送仍走 `submitInput`，**断连引擎缓存**先试 Enqueue，拒收则保留 draft。catalog / connection 无 GetQueue（未发明 RPC）；接通 / 断连缓存 `getMessageQueueState` 诚实空，Inbox 文案「Queue not listed」，fixture 不得冒充引擎队列。Inbox 列表仅 stub / 从未连过消费 fixture；Composer 无队列入口。

## 5. 语音输入（诚实省略）

`IUniverseAgentConnection` 无 voice/transcript 方法，也无对应 capability key。Composer **不画**麦克风按钮、转写条或预设台词；不得用 `durationLabel '0:01'` / stub phrase 冒充用户说过话。真转写须等引擎 capability 后再开门控。语音队列不是 MessageQueue。

## 6. 输入历史

`conversationInputHistory.ts`：↑ / ↓ 浏览该会话已发送的用户正文。去掉空白后输入框还有字时不开始翻。光标必须是折叠选区：↑ 只在首行、↓ 只在末行；否则方向键只移动光标，不改文字。Ctrl / Alt / Shift / Meta 加方向键也不翻。召回后 ↑ 把光标放在开头、↓ 放在末尾，下一次同向键才能继续翻。`turnEdit` / `queueEdit` 按同一套光标规则改输入框里的字，但不写入 compose 草稿。Escape 退出浏览并还原进入前的文字。按会话隔离。

输入 `@`（前面是空白或行首）打开匹配会话的 listbox，焦点留在输入框。打开期间输入框是 `combobox`：`aria-expanded`、`aria-controls`、`aria-autocomplete="list"`，当前项同时写在输入框和 listbox 的 `aria-activedescendant`（读屏只认焦点元素上的那条）。方向键只移动高亮，不浏览输入历史；没有匹配项时同样吃掉方向键，空态文案挂在 `aria-describedby`。Escape 或点外面关闭，并去掉这些属性，输入框回到普通文本。有当前项时 Enter 选中它，不发送。没有匹配项时没有当前项，Enter 不吞掉，仍按 `ua.client.keyboardEnter.behavior` 发送或换行。

未发送草稿在 `ua.client.chatInput.restoreDrafts` 为 true 时按 workspace + `${sessionId}/${chatId}` 写入 `conversation.drafts.v1`（`StorageScope.WORKSPACE` + `StorageTarget.MACHINE`）；根叶与 overlay 透镜不共用。删除会话或 roster 中消失的 id 会同步清持久化。

## 7. StatusBar 芯片（`conversationSessionStatusBar.ts` / `conversationSessionStatus.ts`）

| id | 文案 | 规则 |
|----|------|------|
| `status.conversation.session` | 当前会话标题；无标题 **No session** | 点击 → `workbench.action.showConversationPart` |
| `status.conversation.engine` | `getConnectionPhaseStatusBarText`（H4b）：disconnected / connecting / connected / failed 各态；pairing-pending → **Waiting for pairing**。颜色 `getConversationEngineChipTone`，与身份条相同：未连接 / closed / pairingPending 为 `warning`，failed 为 `error`（文案已是 Waiting for pairing 时仍是错误色），连接中和已连接为 `standard` | B10：`getEngineStatusCommandId` + `getEngineStatusCommandArguments`。`isConversationEngineLive` → `workbench.action.openEnginePreferences`。`pairingPending` → `workbench.action.openConnectionPreferences`（`onDidShow` 落到配对区并 focus）。其余未连接（含 Connection failed）→ 同一命令，参数 `profiles`，打开后选中 **Connection profiles**。身份条引擎 chip 同路由、同色 |
| `status.conversation.model` | **No model** | **仅当** `CONVERSATION_PART` 隐藏时注册（UI-INV-14：座位可见时 Dock 是 model owner） |

无 Copilot、无额度、无 Sign In；无 session-usage / turns / tok/s 芯片（无权威则省略槽位）。

## 8. 与 PRD-015 验收的对应

| 验收 | 落点 |
|------|------|
| 1 空会话无 Inbox；输入不永钉列底 | §1 |
| 2 Init / During 同一张 Composer；底栏样式 | §1 / `media/conversationLens.css` |
| 3 Agent XOR（Route 省略，无假下拉） | §1 |
| 4 Model / Permission / Tools 留在输入行 | §1 |
| 5 Inbox 分簇、Queue XOR、诚实空（HEAD 无独立 Task 钮 / ctx） | §3 |
| 6 列表编辑与队列编辑复用 Composer | §2 |
| 7 无假麦克风；无转写条冒充 MQ | §5 |
| 8 不是 `ChatInputPart` picker、不是 Material 配置卡 | INV-NO-COPILOT；Dock 为自研 textarea |

## 9. 测试

`conversationLens.test.ts`（T1–T6；断连 Send：未连可发且首条 pending 离 PreFirst；引擎缓存断连保留 draft + 失败文案、enqueue 接纳则不清 timeline）、`conversationComposerAtSuggest.test.ts`（`@` 列表当前项跟着 `aria-activedescendant`；无匹配时方向键不进输入历史，Enter 不吞发送或换行，Escape 清属性；有当前项时 Enter 选中且不发送）、`conversationInboxOverlay.test.ts`（Stop 禁用 / 接通 streaming 转发；Goal 禁用 / 接通转发 Set / 取消不发 / 清空确认 Cancel / 断连+history 可点出 engine_disconnected；Enqueue 从未接通禁用 / 接通转发 / 取消不发 / 失败不造假项 / 断连+history 可点出 engine_disconnected；FAILED / UPLOAD_FAILED stub Retry 禁用；接通 Inbox 不把 fixture 当引擎队列 / 文案 Queue not listed）、`conversationComposerCatalog.test.ts`、`conversationIdentityStrip.test.ts`、`conversationInputHistory.test.ts`、`conversationSessionStatus.test.ts`、`conversationSessionStatusBar.test.ts`、`conversationStubService.test.ts`（队列 / hold / cancel·goal no-op；Enqueue / Retry 无引擎诚实失败且不改 fixture）、`conversationEngineRosterService.test.ts`（接通转发 Cancel / SetSessionGoal / Fork / Kill / CancelToolCall / DeleteMessage / Respond / MessageQueue 五操作 + Edit + Enqueue；断连 `hasEngineConnectionHistory`）。Lens / identity / stub 基线红见 [D16](../../../dev/progress/deferred-gaps.md)。

## 10. 视觉规则

配色、密度、焦点与按压零形变见 [UI 设计原则与规范](../../architecture/cross-cutting/ui-design-principles.md)（Composer / Inbox 见其 §5.2），本页不重复。Stop 留在 Inbox 右簇、不与发送钮合并（2026-09-28 用户确认，PRD-015 不变）。
