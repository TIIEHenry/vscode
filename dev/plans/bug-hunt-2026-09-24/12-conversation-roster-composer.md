---
title: "Roster 与 Composer：编辑打错代理、stub 连发、提问勾选、模型串会话"
type: plan
status: accepted
phase: M7
updated: 2026-09-24
summary: "BH-12 八条在 HEAD 仍成立；快照删除不另起切片，其余按回合代理、发送队列、勾选、会话模型下标、确认计数、审查工作目录、身份条分支收口。"
---

# Roster 与 Composer：编辑打错代理、stub 连发、提问勾选、模型串会话

本稿是方案，不是实施。

冲突域只限扫描文点名的 roster、composer、inbox、stub、seat、snapshot、review nav、identity strip 文件。不要改时间线渲染与窗口服务（另路）。与 [conversation-bound-session](../conversation-bound-session.md) 重复的只交叉引用，不另起实施切片。

扫描来源：[12-conversation-roster-composer](../../progress/bug-hunt-2026-09-24/12-conversation-roster-composer.md)。

## 核查

| 条目 | 结论 | 理由 |
|:-----|:-----|:-----|
| BH-12-1 | 成立 | `saveTurnEdit`（`conversationLensComposer.ts` 约 373 行）调用 `updateUserTurnText` 不传回合 `agentId`；`editEngineMessage`（约 1445 行）用 `lastStreamingAgentId \|\| 'root'`，并立刻 `return true`。 |
| BH-12-2 | 成立 | `writeSubmitInput`（约 137–150 行）用单元素数组覆盖 `pendingSendsBySession`；先到期的 `setTimeout` 删掉整个会话键并写入自己闭包里的正文，后一次看到键没了就返回。 |
| BH-12-3 | 成立 | 单选 `apply(0)`（`wireConversationSeatOptionKeys` 约 44–55 行）把第一项 `aria-checked` 设为 true，方向键只走 `apply`；`selections` 只在 `onActivate`（约 178 行）写入。Submit（约 211 行）调用 `submit()`，不走 `submitIfComplete` 的必填检查。 |
| BH-12-4 | 成立 | `modelSelectedIndex` 在宿主上（约 109 行）。`syncSessionConfigSelects`（约 778–782 行）只恢复 agent / permission。`submitDraft`（约 328–332 行）把当前下标的 `modelProfileId` 发给当前绑定会话。`applySessionModelIndex` 失败时 `restoreSessionModelIndex` 改的是宿主下标和当前下拉框。 |
| BH-12-5 | 成立 | `deleteSnapshot`（约 441–459 行）在 `confirm` 之后才 `resolveSessionId()`，把新 id 和旧行 `snapshot.id` 交给 `deleteSnapshot`。`applyActiveSession` 会关列表面板，确认框仍在。 |
| BH-12-6 | 成立 | 有引擎投影时 `countPendingConfirmations`（约 868 行）返回 `pendingActions.length`。`PendingActionView.summary` 含 `permission` 以外的 kind。Inbox 文案固定为 confirmation(s) pending（约 344–346 行）。点击走 `onScrollToPendingConfirmation`。 |
| BH-12-7 | 成立 | `materializeBucket`（约 104 行）传入 `connectionSnapshot.workDir`。`materializeReviewNavRecords`（约 108 行）在 `isWorkDirCompatible` 失败时返回空数组，否则用该 `workDir` 解析路径。Roster 会话自己的 `workDir` 没有参与。 |
| BH-12-8 | 成立 | `getConversationIdentityFolder`（约 37 行）取 `folders[0]`。`getConversationIdentityBranchName`（约 48–55 行）返回第一个能读到 `historyItemRef.name` 的 SCM 仓库，不比对文件夹 URI。 |

## Problem class

- **症状：** 编辑用户回合打到正在流式的代理；未连引擎时连发丢掉后一句；提问座勾选和提交不一致；换会话后模型下标还是上一会话的；快照确认期间换会话会删到另一边；只有提问时 Inbox 仍写 confirmation；审查导航用连接工作目录；身份条文件夹和分支可以不是同一个仓库。
- **类标签：** 表面绑了会话或回合，写入却读「当前流式 / 当前宿主 / 当前连接 / 第一个能读到的仓库」。
- **复发机制：** 新的引擎写入沿用 `lastStreamingAgentId \|\| 'root'`；宿主级下标不随 `syncSessionConfigSelects` 走；确认框 `await` 之后再 `resolveSessionId()`。

## 0. 一句话结论

回合编辑用该用户回合自己的 `agentId`（没有再按已有 EditMessage 合同落 `root`）。stub 连发按 `operationId` 各自落地。单选的勾选和 `selections` 一起变，Submit 遵守已有的必填单选检查。模型下标按会话记在宿主 Map 里，不往 `ConversationSessionConfigSelection` 加 `modelId`。快照删除不在本稿切片，沿用绑定会话方案里「confirm 前捕获」。Inbox 徽章只数 `permission`。审查行优先用该会话的 `workDir`。分支名只取身份文件夹对应的仓库。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `updateUserTurnText(sessionId, turnId, text)` 无 `agentId`；接通后进 `editEngineMessage` | `conversationEngineRosterService.ts` 约 546–554、1432–1455 行 |
| `editMessage` 请求已有 `agentId?`；空 / 省略按合同接成 `root` | `universeAgentTypes.ts` `UniverseAgentEditMessageRequest` |
| 用户回合上已有可选 `agentId`；`saveTurnEdit` 已找到该回合但只传 `turnId` 与正文 | `conversationStubModel.ts` 约 49 行；`conversationLensComposer.ts` 约 371–373 行 |
| 同文件 `deleteEngineMessage` 已接受调用方传入的 `agentId`，缺省才 `lastStreamingAgentId \|\| 'root'` | 约 1238–1250 行 |
| `editEngineMessage` 在 `dispatchEngineAction` 之后立刻 `return true`；`saveTurnEdit` 据此 `exitComposerEdit` | 约 1455 行；`conversationLensComposer.ts` 约 373–382 行 |
| stub `pendingSendsBySession` 声明为数组，`writeSubmitInput` 每次 `set` 成单元素；超时用会话键是否还在决定是否 `appendUserTurn` | `conversationStubFrameSource.ts` 约 47、127–150、78–89 行 |
| 单选 `wireConversationSeatOptionKeys` 的 `onSelect` 在 `apply` 里；提问座只传 `onActivate` | `conversationConfirmationSeat.ts` 约 45–55、171–185 行；`conversationQuestionSeat.ts` 约 171–185、205–211 行 |
| `ConversationSessionConfigSelection` 只有 `agentIndex` / `permissionIndex`。模型下标是 `host.modelSelectedIndex` | `conversationLensComposerChrome.ts` 约 93–109、736–782 行 |
| 绑定会话方案 S2 禁止往该类型暗加 `modelId`；catalog 刷新回选另路 | [conversation-bound-session](../conversation-bound-session.md) S2 |
| `submitInput` 已有 `modelProfileId`，来自 `catalogModelIds[modelSelectedIndex]` | `conversationLensComposer.ts` 约 328–332 行 |
| `applySessionModelIndex` 的 `sessionId` 已传入 `switchModel`；回滚函数只写宿主下标并 `select` | `conversationLensComposerChrome.ts` 约 728–772 行；宿主已有 `getBoundSessionId` |
| 快照 `resolveSessionId` 用构造时的 `getSessionId`，否则 roster active。删除在确认后重新解析 | `conversationEngineSnapshotsList.ts` 约 315–317、440–459 行 |
| `applyActiveSession` 调用 `engineSnapshotsList?.close()`，不取消已经打开的 `dialogService.confirm` | `conversationLensSessionBinding.ts` 约 168–172 行 |
| 绑定会话方案 S3 已要求 list / restore / delete 用同一个 id，Delete 在 confirm 前捕获 | [conversation-bound-session](../conversation-bound-session.md) S3 |
| 引擎投影下确认计数等于 `pendingActions.length`。`TimelineItemSummary` 含 `permission`、`question`、`generic`、`unknown` 等 | `conversationEngineRosterService.ts` 约 864–868 行；`sessionView/types.ts` `PendingActionView` |
| Inbox 与会话列表副标题都用这一个计数，文案都是 confirmation(s) pending | `conversationInboxOverlay.ts` 约 341–346 行；`conversationSessionsView.ts` `formatSessionRosterSubtitle` |
| 滚动助手把 confirmation、question、可响应 tool 都算待处理；注释写明 toast 要点到提问座 | `conversationPendingSeat.ts` `findFirstPendingConfirmationTurnId` |
| 审查物化用连接快照 `workDir`。会话摘要已有 `SessionSummary.work_dir`，roster 行上是 `workDir?` | `conversationReviewNavService.ts` 约 97–107 行；`UniverseAgentSessionSummary.workDir`；`ConversationStubSession.workDir` |
| 身份条文件夹是 `folders[0]`。分支是 SCM 仓库迭代里第一个非空 `historyItemRef.name`。仓库有 `provider.rootUri` | `conversationIdentityStrip.ts` 约 33–61、167 行 |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 按表面已经拿到的 id 写入；勾选与载荷一致；模型下标按会话；徽章只数 permission** | §3 | **选定** |
| B 编辑继续用 `lastStreamingAgentId`，只在没有流式行时改回 `root` | 子代理回合旁边有别的代理在流式时仍然改错 | **拒绝** |
| C 往 `ConversationSessionConfigSelection` 加 `modelId`，或新的协议字段 | 绑定会话方案 S2 已禁止 `modelId`；EditMessage / submitInput / `workDir` 都已有字段 | **拒绝** |
| D 快照删除在本稿再写一套捕获 | 与绑定会话方案 S3 重复 | **拒绝。** 只交叉引用 |
| E Inbox 改文案去覆盖 question / generic，并改共享滚动助手去掉 question | 会话列表副标题仍写 confirmation；toast 点提问座是现有合同 | **拒绝** |
| F 审查行在会话 `workDir` 不兼容时改用连接 `workDir` | 会再次解析到另一棵树 | **拒绝** |
| G 身份条改成「当前资源管理器文件夹」或扫所有仓库拼分支 | 扫描只要求分支对齐 `folders[0]` | **拒绝** |

## 3. 选定设计

### S1 编辑使用回合代理（BH-12-1）

`saveTurnEdit` 把已找到的用户回合的 `agentId` 传给 `updateUserTurnText`。`editEngineMessage` 使用这个参数的 trim 结果；没有或空白时用 `'root'`。禁止再读 `lastStreamingAgentId`。

不变量：`editMessage` 的 `agentId` 等于该用户回合的 `agentId`；回合上没有时等于 `'root'`。接口仍在派发后返回 true（不等待引擎回写）。不改 `deleteEngineMessage` 的缺省规则。不改时间线如何画编辑结果。

### S2 stub 连发按 operationId 落地（BH-12-2）

`writeSubmitInput` 向该会话的 pending 队列追加一条，不覆盖已有条目。每个 `setTimeout` 只移除自己的 `operationId`，并 `appendUserTurn` 自己的正文。队列里还有别的条目时保留会话键。禁止用「会话键是否还在」判断后一次发送是否已经落地。

不变量：同一会话在第一次超时前连发 N 次，时间线上按发送顺序留下 N 条用户正文和各自的 stub echo；后一句的 pending 预览不会被前一次超时清掉。引擎路径不经过这个函数，本切片不改它。

### S3 单选勾选与 selections 同步（BH-12-3）

提问座单选把「写入 `selections`」接到 `wireConversationSeatOptionKeys` 的 `onSelect`。`role: 'radio'` 时，`aria-checked === 'true'` 的标签集合等于 `selections` 里该题的标签。方向键和初始 `apply(0)` 都走这条同步，因此第一项从画上起就是已选标签，而不是只改无障碍属性。

Submit 在 `respond` 之前执行与 `submitIfComplete` 相同的必填单选检查：`required` 里每一项都要已有非空标签，否则不调用 `respond`。多选仍只在 Enter / 空格 / 点击时改 `selections`（现有 `onActivate`）。不改 D297 的 `writesEnabled`。

不变量：看起来勾上的单选标签就是 `selectedLabels`。必填单选没有标签时 Submit 不发出 `questionRespond`。

### S4 模型下标按会话存放（BH-12-4）

不修改 `ConversationSessionConfigSelection`，不加协议字段。宿主 Map 记模型 id：`Map<sessionId, modelProfileId>`。`applySessionModelIndex` 在 `await` 之前记下该会话旧下标。成功才把这次 `catalogModelIds[index]` 写入该会话的格子。失败、空 `resolvedModelId`、写入已不活：只把这一格设回旧下标；眼前的下拉框仅在仍绑定该会话时跟着变。

`syncSessionConfigSelects` 与 `loadConnectedComposerCatalogs`（约 223–229 行，在 `setOptions` 前）用该会话记下的 id 对当时的 `catalogModelIds` 做 `indexOf`，命中才写下标；没有记录则 0。禁止把别的会话格子里的旧下标套到重排后的目录上。`submitDraft` 继续读 `host.modelSelectedIndex`。

[conversation-bound-session](../conversation-bound-session.md) S2 改完绑定会话的选择时，必须同时写入该会话的 id 格。不改 D76「仍停在发起切换的那一会话」的断言。

不变量：目录重排后切回会话 B，发出的 `modelProfileId` 仍是 B 上次记下的 id。A 的 `switchModel` 失败只回写 A 的格子。

### BH-12-5 不另起切片

HEAD 上确认后重读 `resolveSessionId()` 仍然成立。捕获点、绑定 id、confirm 前记下 `sessionId` 与 `snapshotId`，全部沿用 [conversation-bound-session](../conversation-bound-session.md) S3（Delete 在 confirm 前捕获；list / restore / delete 同一个 id）。本稿不写第二套实现，也不改 `conversationEngineSnapshotsList.ts` 的产品行为直到该切片落地。

### S5 Inbox 徽章只数 permission（BH-12-6）

引擎投影分支里，`countPendingConfirmations` 只数 `summary.kind === 'permission'` 的 `pendingActions`。没有投影时仍走 stub 的现有计数。Inbox 文案保持 confirmation(s) pending，数字与文案一致。会话列表副标题共用这个函数，因此不必改 `conversationSessionsView.ts`。

Inbox 按钮（`conversationLensDock.ts` 的 `onScrollToPendingConfirmation`）改走新的查找，只返回当前会话里第一条 `kind === 'confirmation'` 且 `status === 'pending'` 的回合。没有则不滚动。`findFirstPendingConfirmationTurnId` 保持不动，toast 仍可落到提问座。禁止让 Inbox 点击继续调用那个函数。

不变量：只有 question / generic / unknown 时徽章隐藏，按钮不可点。有 permission 时数字等于 permission 条数，点击落到 permission 座位。

### S6 审查行用会话 workDir（BH-12-7）

`materializeBucket` 取 roster 上该 `sessionId` 的 `workDir`（trim 后非空）。没有时再用 `connectionSnapshot.workDir`。得到的字符串原样传给现有 `materializeReviewNavRecords`。会话带了 `workDir` 但 `isWorkDirCompatible` 失败时保持返回空数组，不用连接工作目录顶上。

不变量：并排阅读列上该会话的「View changes」路径以该会话 `workDir` 为根。连接快照只填会话自己没有工作目录的洞。

### S7 分支对齐身份文件夹（BH-12-8）

文件夹芯片仍是 `folders[0]`。`getConversationIdentityBranchName` 增加该文件夹 URI，只读 `provider.rootUri` 与之相同的 SCM 仓库的 `historyItemRef.name`。没有对应仓库或没有 HEAD 名时分支芯片隐藏。禁止再返回迭代中另一个仓库的分支。

不变量：多根工作区里，条上同时可见的文件夹与分支属于同一个仓库根；对不上则只有文件夹、没有分支。

## 4. 不做

- 时间线渲染、会话窗口服务、叶级 SessionBar
- [conversation-bound-session](../conversation-bound-session.md) 的 S2 catalog 回选算法、S3 快照删除捕获（不平行再做）
- 给 EditMessage、submitInput、会话摘要发明新字段；把 `modelId` 放进 `ConversationSessionConfigSelection`
- 修改 `deleteEngineMessage` / Kill 的 `lastStreamingAgentId` 缺省
- 修改 `findFirstPendingConfirmationTurnId` 的 question 包含
- 改 `conversationSessionsView.ts` 的文案（S5 让现有 confirmation 文案与数字一致）
- 身份条改绑「当前选中文件夹」
- 重开 GitHub Actions

## 5. 验证

本地 `scripts/test.sh --run` 点名下列文件。不要重开托管 workflow。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| S1 | `src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`；`conversationComposerEditDraft.test.ts` | 用户回合带 `agentId`、时间线末尾另一个代理在流式：`editMessage` 的 `agentId` 是回合上的那个。回合没有 `agentId` 且没有流式行：请求里是 `root`，不是别的代理。派发后返回值仍为 true。 |
| S2 | `conversationStubService.test.ts` | 同一本地会话在超时前 `submitInput` 两次：两条用户正文都进时间线，顺序与发送一致；第二次的 pending 预览不会在第一次超时被删掉。 |
| S3 | 提问座没有独立测试文件 | 在 `src/vs/workbench/contrib/conversation/test/browser/` 为 `renderOptions` 增加：单选加自定义答案时，方向键移动后的 `aria-checked` 与 `selectedLabels` 相同；必填单选没有标签时点击 Submit 不调用 `onRespond`。 |
| S4 | `conversationComposerCatalog.test.ts`；`conversationLensDisposeGate.test.ts` 里现有的 `applySessionModelIndex` | 不改 D76 / throw 路径上「仍是发起会话」的断言。新增：A 的 `switchModel` 在 await 期间绑定换成 B 后失败，B 的下拉下标不变，A 的格子回到切换前。`syncSessionConfigSelects(B)` 后 `modelSelectedIndex` 是 B 的格子。发到 B 的 `modelProfileId` 来自 B 的下标。 |
| BH-12-5 | `conversationEngineSnapshotsList.test.ts` | 不在本稿加新断言。捕获 id 的测试随绑定会话方案 S3，避免两套相反断言。 |
| S5 | `conversationInboxOverlay.test.ts`；`conversationEngineRosterService.test.ts` 里现有 `countPendingConfirmations` | 投影里只有 `question` 时计数为 0，pending 按钮隐藏。一条 `permission` 加一条 `question` 时计数为 1，点击滚动 id 是 confirmation 回合。 |
| S6 | `conversationReviewEntry.test.ts` | `materializeBucket`（或包一层的服务测试）在会话 `workDir` 与连接 `workDir` 不同且都是工作区根时，记录路径落在会话根下。会话 `workDir` 不兼容时结果为空，即使连接 `workDir` 兼容。 |
| S7 | `conversationIdentityStrip.test.ts` | 两个 SCM 仓库，`folders[0]` 没有 HEAD 名、另一个有：分支为 undefined。`folders[0]` 的 `rootUri` 对应仓库有 HEAD 名：分支等于该名，不是另一个仓库的名。 |
