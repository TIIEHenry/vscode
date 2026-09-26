---
title: "潜在缺陷：Roster 与 Composer"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "Roster 与 Composer 扫描出 8 条可观察缺陷：编辑回合会落到正在流式的代理，其余为错状态或边角。"
---

# 潜在缺陷：Roster 与 Composer

## 结论

范围内读到 8 条有用户可观察后果的问题。最重的一条是引擎编辑用户回合时不带该回合的代理，而是改正在流式输出的代理。其余是 stub 连发丢句、提问座提交与勾选不一致、模型选择串会话、快照删除可能打到另一会话、待确认计数把提问算进去、审查导航用连接工作目录、身份条分支可能不是当前文件夹。有意 fail-closed（断连不发、配对中禁写、无队列不造行）未立条。

## 发现

### BH-12-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` `editEngineMessage` 约 1445 行；调用链 `conversationLensComposer.ts` `saveTurnEdit` 约 373 行
- 行为：保存用户回合编辑时，`updateUserTurnText` 不传 `agentId`。引擎路径用 `lastStreamingAgentId`，没有正在流式的行就写成 `'root'`，再 `editMessage`。
- 为何是缺陷：子代理回合、或另一代理正在流式时，编辑请求打到错误代理。接口立刻返回 true，编辑框按成功退出，屏幕上的原文不变，或另一代理的回合被改掉。
- 触发：引擎已连接，编辑一条带 `agentId` 的用户回合，同时时间线末尾有别的代理在流式输出；或编辑非 root 回合且当前没有流式行。
- 已知：无。D104 只覆盖断连时 boolean 为 false 的提示，不覆盖代理选错。
- 修复方向：编辑请求使用该回合自己的 `agentId`，缺省再回落到 root，不要用最后一条流式行的代理。

### BH-12-2

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationStubFrameSource.ts` `writeSubmitInput` 约 127–150 行
- 行为：每个会话只留一条 `pendingSends`。后一次发送覆盖前一次。先到期的 `setTimeout` 删掉整个会话键并写入第一次的正文；后一次发现键已不在就直接返回。
- 为何是缺陷：从未连上引擎时连按两次发送，输入框里后一句的预览会消失，时间线只留下前一句和它的 stub echo。
- 触发：无引擎历史的本地会话里，在第一次 `setTimeout(0)` 跑完前再发一条。
- 已知：无
- 修复方向：按 operationId 排队，每个超时只提交自己的正文，不要用「会话键是否还在」判断后一次是否已落地。

### BH-12-3

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationConfirmationSeat.ts` `wireConversationSeatOptionKeys` 约 44–55 行；`src/vs/workbench/contrib/conversation/browser/conversationQuestionSeat.ts` `renderOptions` 约 171–211 行
- 行为：单选一挂上就把第一项 `aria-checked` 设为 true，方向键只改这个勾选。真正写入 `selections` 要等 Enter、空格或点击。需要显式提交时，Submit 直接 `respond`，不要求单选已激活。
- 为何是缺陷：界面像已选中第一项或方向键移到的项，提交出去的 `selectedLabels` 仍是空的，或是上一次点击留下的旧值。提问被当成已答。
- 触发：一题里同时有单选，以及多选或自定义答案（因此出现 Submit）；用方向键改单选后点 Submit。
- 已知：无。D297 的配对禁写是另一条路径。
- 修复方向：方向键和初始焦点在改 `aria-checked` 时同步 `selections`，Submit 前要求必填单选已有标签。

### BH-12-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` `applySessionModelIndex` 约 736–768 行、`syncSessionConfigSelects` 约 778–782 行；`conversationLensComposer.ts` `submitDraft` 约 328–332 行
- 行为：代理和权限按 `sessionId` 存在 `sessionConfigBySessionId`。模型下标只在宿主上的 `modelSelectedIndex`。切会话时 `syncSessionConfigSelects` 不恢复模型。发送把当前下标对应的 `modelProfileId` 带进当前绑定会话。
- 为何是缺陷：在会话 A 选的模型会留在会话 B 的输入条上，下一条发到 B 时仍带 A 的模型 id。A 的 `switchModel` 失败回滚也会改掉此刻已经看着的 B 的下拉框。
- 触发：同一阅读列先对 A 调用 `switchModel`，再 `applyActiveSession` 到 B 后发送；或 A 的切换在 await 期间失败。
- 已知：无。D76 只处理空 `resolvedModelId` 的回滚。
- 修复方向：模型下标与模型 id 按会话存放，切会话时恢复该会话的选择，回滚只动发起切换的那一会话。

### BH-12-5

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts` `deleteSnapshot` 约 440–459 行
- 行为：确认框出现前用当时的会话做 `canSendDelete`。`await dialogService.confirm` 之后重新 `resolveSessionId()`，再把这个新 id 和旧行的 `snapshot.id` 交给 `deleteSnapshot`。
- 为何是缺陷：确认文案是打开列表时那条快照，RPC 却可能打到确认期间切过去的会话。快照 id 若在另一会话也可解析，会删错会话里的检查点；否则用户以为删的是刚才那条，结果没有删到。
- 触发：快照面板用 `getSessionId` 绑定阅读列；确认框未关时绑定会话被换成另一个（`applyActiveSession` 会关面板，但确认框仍在，返回后仍会读新的 `getSessionId`）。
- 已知：无。D179 / D486 / D511 只补未处理 rejection，不改会话捕获点。
- 修复方向：在打开确认框之前记下 `sessionId` 和 `snapshotId`，确认后仍用这对 id，并在发送前核对面板仍对应该会话。

### BH-12-6

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` `countPendingConfirmations` 约 864–871 行；`src/vs/workbench/contrib/conversation/browser/conversationInboxOverlay.ts` `renderPending` 约 341–346 行
- 行为：有引擎投影时，计数是 `snapshot.pendingActions.length`。Inbox 文案固定为「1 confirmation pending」或「{0} confirmations pending」。`PendingActionView` 的 summary 除 permission 外还有 question、generic、unknown。
- 为何是缺陷：只有提问、没有权限请求时，Inbox 仍显示若干条确认待处理。点击滚动走 `findFirstPendingConfirmationTurnId`，可能落到提问座，和按钮文案不一致；若待处理项没有对应座位，按钮可点但页面不滚动。
- 触发：引擎会话的 `pendingActions` 里有非 permission 项，Inbox 已渲染。
- 已知：无
- 修复方向：徽章只数 `summary.kind === 'permission'`，或把文案改成与实际 kind 一致并滚动到对应座位。

### BH-12-7

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationReviewNavService.ts` `materializeBucket` 约 97–107 行；`src/vs/workbench/contrib/conversation/browser/conversationReviewEntry.ts` `materializeReviewNavRecords` 约 100–109 行
- 行为：审查行用 `connection.getConnectionSnapshot().workDir`，不用 roster 会话上的 `workDir`。`isWorkDirCompatible` 失败则整会话审查行为空。
- 为何是缺陷：并排阅读列绑的是非当前连接工作目录的会话时，「View changes」要么不出现，要么按另一棵工作目录解析路径，点开的文件不是该会话改过的那些。
- 触发：连接快照的 `workDir` 与该 `sessionId` 的 `workDir` 不同，且该会话已有落盘的文件变更和已结算回合。
- 已知：无
- 修复方向：物化审查行时用该会话自己的 `workDir`，缺省再使用连接快照。

### BH-12-8

- 严重度：low
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts` `getConversationIdentityFolder` 约 33–44 行、`getConversationIdentityBranchName` 约 48–55 行
- 行为：文件夹芯片永远是工作区 `folders[0]`。分支芯片是第一个能读到 HEAD 名的 SCM 仓库，不要求与该文件夹是同一个仓库。
- 为何是缺陷：多根工作区里，第一个文件夹没有 HEAD、后面的仓库有时，条上会同时显示文件夹 A 和仓库 B 的分支名。
- 触发：多根工作区，`folders[0]` 对应仓库没有 `historyItemRef.name`，另一个仓库有。
- 已知：无。D28 只处理身份条被连接面板挡住。
- 修复方向：分支名只取与当前身份文件夹 URI 对应的那个 SCM 仓库。

## 看过但未立条

- `uaClientComposerDrafts.ts` 用最后一个 `/` 拆 `sessionId/chatId`。本仓 stub id 形如 `session-N`，未看到可达的 id 含 `/`，不构成已证实的串草稿。
- `conversationLensSessionBinding.ts` `applyActiveSession` 会 `resetInputHistoryBrowse` 并按会话读草稿，输入历史下标不会直接带去下一会话。
- 从未连接时 `enqueueMessageQueueItem` 返回 false、配对中禁写、断连不把 stub 历史画成引擎历史，都是有意 fail-closed。
- `conversationStubFrameSource.ts` 对 `questionRespond` / `clientToolRespond` / `continueGeneration` 接受为 no-op，注释写明 stub 不发明记录。
- 目标、改名、删除会话的远端失败回滚已在 D92、D94、D95 收口。`submitDraft` 的 post 拒绝已在 D86 收口。目录抛错回退已在 D50 收口。
- `buildPersistedEngineCache` 约 1907 行持久化引擎缓存时丢掉 `workDir`。本范围没有读到会把这个戳画给用户的表面，未单独立条。
- `uaClientExternalLink.ts` 确认框用 `uri.toString(true)`，打开仍用同一个 URI。`uaClientWorkspaceToolsGate.ts` 只转发配置，未见独立后果。

## 未读完

- `conversationEngineRosterService.ts` 约 1–320 行（连接门闩与列表投影前半）未逐行，1700 行之后的目录刷新与持久化已读。
- `conversationStubService.ts` 约 1–400 行与 630 行之后未逐行；已核对队列入队与权限 / 提问转发。
- 按范围未读时间线渲染与窗口服务。相邻调用只抽了 `conversationLensSessionBinding.ts` 的切会话、编辑保存和提问提交，以及 `sessionView/types.ts` 里 `pendingActions` 的 kind。
