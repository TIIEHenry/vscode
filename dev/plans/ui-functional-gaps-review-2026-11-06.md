---
title: "2026-11-06 默认窗口并行 UI 功能缺失审查与修复方案"
type: plan
status: accepted
phase: M7
updated: 2026-11-06
summary: "五路并行审查默认编辑器窗口的 Conversation、Composer/Inbox/SessionBar、Sessions/Navigator/Trajectory、Sources/Preview 与 Engine/Connection/Client Settings 的 UI 功能缺失问题；经规则 16 审查（C9/I4/M2）核验与剔除冲突项后，分 S1 与 S2 实施。"
---

# 2026-11-06 默认窗口并行 UI 功能缺失审查与修复方案

状态：执行中。负责：agent:gemini。
覆盖需求：PRD-002、PRD-003、PRD-004、PRD-005、PRD-007、PRD-009、PRD-012、PRD-013、PRD-014、PRD-015、PRD-016、PRD-018、PRD-022、PRD-023、PRD-024、PRD-025、PRD-026、PRD-027、PRD-028、PRD-029。

## 1. 背景与范围

本方案汇总 2026-11-06 对默认编辑器窗口五条产品轨道的并行「UI 功能缺失问题」深度审查结论，并经过规则 16 只读审查逐项对照 HEAD 源码与既有单测/CSS 扫描合同，剔除与既有测试合同或已签收决策冲突的假设，保留真实可验证的功能缺失项分 S1（P0 核心交互阻断与编译/运行时缺陷）与 S2（P1 功能与状态闭环）实施。

范围边界：仅针对默认编辑器窗口产品表面（`src/vs/workbench/contrib/conversation/`、`src/vs/workbench/contrib/navigator/`、`src/vs/workbench/contrib/sources/`、`src/vs/workbench/browser/parts/editor/`），不涉及 `src/vs/sessions/`（Agents Window），不修改 PRD 状态，不伪造未接通的后端协议能力。

---

## 2. 切片 S1：P0 级核心交互阻断与编译/运行时缺陷修复

### 2.1 SessionBar 打开 History / Snapshots 浮层的运行时异常与叶级互斥关闭
- **现状证据**：
  - `src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts:182-199` 在 `engineHistoryList.setOnWillShow` 与 `engineSnapshotsList.setOnWillShow` 中调用了 `host.inboxOverlay?.closePanel()`，且对可空的 `host.engineSnapshotsList` / `host.engineHistoryList` 未做可选链调用 `.close(...)`。
  - `IConversationLensSessionBarHost`（`conversationLensSessionBar.ts:47-101`）未声明 `inboxOverlay` 属性，且 `ConversationInboxOverlay` 的关闭方法名为 `closeListPanel()`（`conversationInboxOverlay.ts:238`），不存在 `closePanel()`。
  - 这不仅导致 TypeScript 类型检查报错，而且在 `ConversationLens` 宿主上点击 History / Snapshots 按钮时，`onWillShow` 抛出 `TypeError: host.inboxOverlay?.closePanel is not a function`，导致浮层无法打开；在叶级 `ConversationLeafSessionBar` 宿主上也无法互斥关闭已打开的 Inbox 队列面板。
- **修改方案**：
  - 在 `IConversationLensSessionBarHost` 中增加可选属性 `readonly inboxOverlay?: { closeListPanel(): void }`（兼容 `ConversationLens.inboxOverlay`）；在 `ConversationLeafSessionBar`（通过 `IConversationLeafPaneAccessors.closeInboxListPanel?()` 与 `ConversationEditorPane`）中提供 `inboxOverlay` getter 转发 `closeListPanel()`。
  - 将 `conversationLensSessionBar.ts:185-199` 改为调用 `host.engineSnapshotsList?.close({ restoreFocus: false })`、`host.engineHistoryList?.close({ restoreFocus: false })` 与 `host.inboxOverlay?.closeListPanel()`。

### 2.2 时间线渲染器 `onProcessFoldLayout` 签名补齐与展开/收起滚动补偿
- **现状证据**：
  - `src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts:352, 370, 540` 在展开/收起错误回合详情、Visualize 图示卡和长用户气泡时调用了 `this.onProcessFoldLayout?.(turn.id)`，但 `ConversationTimelineRenderer` 构造函数（`:159-188`）未声明该属性，且 `ConversationTimelineHost`（`conversationTimelineHost.ts:216-243`）构造 `ConversationTimelineRenderer` 时未传入该回调，触发 `TS2339` 编译报错且运行时滚动锚点补偿失效。
- **修改方案**：
  - 在 `ConversationTimelineRenderer` 构造函数末尾声明可选参数 `private readonly onProcessFoldLayout?: (rootId: string) => void`，并在 `ConversationTimelineHost` 构造 `ConversationTimelineRenderer` 时传入 `rootId => this.onUserToggleRow(rootId)`。

### 2.3 叶级 `ConversationLeafSessionBar` 会话同步徽标（`sessionSyncBadge`）与写闸状态联动
- **现状证据**：
  - 默认窗口 `ConversationEditorPane` 构造 `ConversationLens` 时不传 `slots.sessionBar`，而是单独挂载 `ConversationLeafSessionBar`（`conversationEditorPane.ts:168-202`）。
  - `publishLeafSessionLists()`（`conversationEditorPane.ts:332-345`）只将 `bar.engineHistoryList` 与 `bar.engineSnapshotsList` 赋给 `lens`，漏掉了 `lens.sessionSyncBadge = bar.sessionSyncBadge` 与首次 `lens.updateSyncChrome()`，导致叶级会话栏上的会话同步状态徽标（`PRD-007.4`）永久保持 `hidden = true`。
  - 同时，`ConversationLeafSessionBar`（`conversationLeafSessionBar.ts:143-157, 293-306`）未订阅 `uaConnection.onDidChangeConnection`、`stubService.onDidChangeEngineConnection` 与 `stubService.onDidChangeActiveSession` 调用 `updateSessionBarWriteChrome(this)`，且 `ConversationLeafSessionBar.updateSessionTitle()` 与 `conversationLensSessionBar.ts:579-594` 在 `sessions` 为空时提前 `return` 跳过了 `applySessionTitleHold(host)`，导致连接或就绪度变化时叶级会话栏上的新建、删除与标题改名写闸不更新。
- **修改方案**：
  - 在 `ConversationEditorPane.publishLeafSessionLists()` 中同步 `lens.sessionSyncBadge = bar.sessionSyncBadge` 并调用 `lens.updateSyncChrome()`。
  - 在 `ConversationLeafSessionBar` 中订阅 `uaConnection.onDidChangeConnection`、`stubService.onDidChangeEngineConnection`、`stubService.onDidChangeActiveSession` 及 `stubService.onDidChangeSession` 调用 `updateSessionBarWriteChrome(this)`，并在 `ConversationLeafSessionBar.updateSessionTitle()` 与 `conversationLensSessionBar.ts:updateSessionTitle()` 的 `!session` 早退分支中调用 `applySessionTitleHold(host)`。

### 2.4 单列会话窗口打开延伸标签时自动显示 chat tab 标签栏
- **现状证据**：
  - `src/vs/workbench/browser/parts/editor/conversationEditorPart.ts:73-76, 110-137` 的 `ConversationEditorPartImpl` 仅在 `onDidAddGroup`、`onDidRemoveGroup`、`setGroupHidden` 与 `notifyGroupsLabelChange` 时调用 `applyConversationPartOptions()`，从未监听组内编辑器列表变化（`group.onDidModelChange`），且 `super.create(parent)` 创建初始根组时不触发 `onDidAddGroup`。
  - 当用户在未分屏的单列会话窗口中将子代理「打开为 tab」（`PRD-016.4`）、执行 Fork（`PRD-016.3`）或将 Diff「移到对话窗口」（`PRD-009.2`）时，`extensionTabCount > 0` 但 `applyConversationPartOptions()` 未被触发，`showTabs` 仍为 `'none'`，用户看不到也无法切换或关闭延伸 tab（违反 `PRD-016.1`）。
- **修改方案**：
  - 在 `ConversationEditorPartImpl` 中使用 `DisposableMap<GroupIdentifier, IDisposable>` 为 `create()` 后的现有组及 `onDidAddGroup` 新增组注册 `group.onDidModelChange(() => this.applyConversationPartOptions())`，在 `onDidRemoveGroup` 时释放。

### 2.5 压缩分段（`compacted`）隔离、已验证 `visualize` 轨迹过滤与活引擎 `visualize` 详情按需拉取
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationSessionView.ts:1349-1382` 的 `timelineItemToEntry` 未过滤 `isCompactedItemAttribution(attr)`，且 `findTurnIdForTrajectoryRecord`（`conversationTrajectoryModel.ts:888-902`）未排除 `record.kind === 'compacted'`。导致引擎快照中的 `compacted` 记录被误渲染到对话页时间线，且在轨迹页点击 `compacted` 行会跳回对话页而非打开局部检查器（违反 `PRD-012.2`、`PRD-012.3`）。
  2. `projectSnapshotToTrajectory`（`conversationTrajectoryModel.ts:185-215`）接收了 `_details: ReadonlyMap<string, string>` 但未使用，导致当 `summary.toolName === 'visualize'` 且 `details` 中存在合法 `ConversationVisualizeArgs`（即对话页已提升为 `kind: 'visualization'` 图示卡，不再是 `tool` 行）时，轨迹页仍将其投影为 `tool` 行（违反 `PRD-014.5`；注：当 `details` 缺失或非法时，对话页保持为 `tool` 行，轨迹页也必须保持为 `tool` 行以满足 `conversationSessionView.test.ts:650-683` 的对称合同）。
  3. 对话页 `applySessionViewTimeline`（`conversationLensProjection.ts:161-203`）未对缺 `details` 的 `toolName === 'visualize'` 项调用 `requestReadingColumnDetail(host, ref)`，且 `SharedEngineHostBinding.recordDetail`（`conversationEngineFrameSource.ts:295-302`）写入详情后未触发 `this.publish({ kind: 'patches', changedIds })`，导致真实引擎路径下 `visualize` 拿不到参数而退化为普通工具行（违反 `PRD-014`）。
- **修改方案**：
  1. 在 `conversationSessionView.ts` 的 `timelineItemToEntry` 中若 `isCompactedItemAttribution(attr)` 为真则返回 `undefined`；在 `findTurnIdForTrajectoryRecord` 中若 `record.kind === 'compacted'` 则返回 `undefined`。
  2. 在 `conversationTrajectoryModel.ts` 的 `projectSnapshotToTrajectory` 中，当 `item.summary.kind === 'tool' && item.summary.toolName === 'visualize'` 且 `item.detail !== undefined` 且 `parseVisualizeArgs(details.get(String(item.detail))) !== undefined` 时跳过该项（仅过滤已合法解析为 `visualization` 图示卡的项，保留无详情或非法详情的回退 `tool` 行）。
  3. 在 `conversationLensProjection.ts` 的 `applySessionViewTimeline` 中，对 `item.summary.kind === 'tool' && item.summary.toolName === 'visualize' && item.detail !== undefined` 且 `!lease.details.has(String(item.detail))` 的项（用集合防重入重复请求）调用 `void requestReadingColumnDetail(host, String(item.detail))`；在 `conversationEngineFrameSource.ts` 的 `SharedEngineHostBinding.recordDetail(ref, content)` 中，当写入新详情且 `this.replica.timeline` 存在 `String(item.detail) === ref` 的条目时，调用 `this.publish({ kind: 'patches', changedIds: new Set(matchingIds) })`。

### 2.6 非 `Code` 类别下 Sources 打开文件/Diff 的类别路由保护，以及移动 Diff 保留变更身份与 `Accept` 按钮
- **现状证据**：
  1. `src/vs/workbench/services/editor/browser/editorOpenSlot.ts:48-95`：当 Preview 停留在非 `Code` 类别（如 `Terminal`、`Web`、`Planning`、`Overview`）且该类别有活动编辑器时，从 Sources 单击文件或 Diff（默认 `replace` 模式），`openEditorInSlot` 直接对当前 `activeGroup` 调用 `group.replaceEditors`，绕过了 `CategorizedMainEditorPart` 的类别路由，导致非 `Code` 类别的终端/网页/规划页被直接替换关闭，且代码文件被打开在非 `Code` 类别中（违反 `PRD-027.2/3/4/5`）。
  2. `src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts:192, 222`、`sourcesDiffOpenIdentity.ts:9-12`、`sourcesDiffRefHelpers.ts:39-63`：从 Sources 默认在 Preview 打开 Diff 时，`rememberSourcesDiffOpenIdentity` 只保存了 `{ groupId, scmResource }`，丢弃了 `ISourcesChangeIdentity`（`origin`、`sessionId`、`gitPath`、`indexState`、`kind`）。当用户执行 `Move Diff to Conversation`（`PRD-009.2`）或 `Move Diff to Panel`（`PRD-009.4`）后，生成的 `ISourcesChangeRef` 丢失上述字段，导致对话窗口和底部的 Diff 审阅面板永远不显示 `Accept`（接受光标所在一块改动，`PRD-009.3`）按钮。
  3. `src/vs/workbench/contrib/sources/browser/sourcesDiffActions.ts:49-52`：`previewDiffTitleWhen` 仅匹配 `ResourceContextKey.Scheme.isEqualTo(Schemas.file)`，导致引擎目录 Diff（`sources-git-diff:`）与 Git 暂存区/删除文件 Diff（`git:`）在 Preview 中不显示移动按钮；且 `sourcesDiffActions.ts`、`sourcesChangesList.ts`、`sourcesReviewList.ts`、`sourcesReviewCommands.contribution.ts` 调用 `openSourcesChangeEntry` 时漏传 `layoutService`，在 Conversation 隐藏时移入 Diff 不会自动显示 Conversation。
- **修改方案**：
  1. 在 `IPreviewCategoryRoutingPart`（`previewCategoryRouting.ts`）与 `CategorizedMainEditorPart` 中增加 `getTargetGroupForInput?(input: EditorInput | IUntypedEditorInput): IEditorGroup`（内部调用 `this.previewCategoryService.getCategoryForInput(input)`，若当前 `activeGroup` 属于该类别则返回 `activeGroup`，否则返回 `this.getMostRecentGroup(category) ?? this.ensureCategoryGroup(category)` 并 `revealCategory`）。在 `editorOpenSlot.ts` 的 `resolveGroup` 中，当 `preferredGroup === ACTIVE_GROUP` 且 `editorGroupsService.mainPart` 实现了 `getTargetGroupForInput` 且 `editorGroupsService.activeGroup` 属于 `mainPart` 时，使用 `mainPart.getTargetGroupForInput(editor)` 解析目标类别组，不改动 `openEditorInSlot` 的函数签名。
  2. 将 `ISourcesDiffOpenIdentity` 扩展为继承 `ISourcesChangeIdentity`，在 `openSourcesChangeInPreview` 与 `resolveSourcesChangeRefFromEditor` 中完整保存并恢复 `...sourcesChangeIdentity(...)`（严格保持 `sourcesWiringScan.test.ts` 对 `sourcesChangeEntryOpen.ts` 与 `sourcesDiffRefHelpers.ts` 的函数边界与禁止子串约束）。
  3. 在 `sourcesDiffActions.ts` 中将 `previewDiffTitleWhen` 放宽为支持 `file`、`git` 与 `sources-git-diff` scheme，并在 `sourcesDiffActions.ts`、`sourcesChangesList.ts`、`sourcesReviewList.ts`、`sourcesReviewCommands.contribution.ts` 四处调用点补传 `layoutService`（保持 `moveActiveDiffTo` 原有关闭合同以兼容既有单测）。

### 2.7 `openPendingOnFocus` 与权限通知点击在异步挂载会话叶及叶级切换时的定位闭环
- **现状证据**：
  - `src/vs/workbench/contrib/conversation/browser/conversationTimelineRevealService.ts:99-118` 与 `conversationLeafSessionBar.ts:197-212`：点击后台未挂载叶会话的权限通知「Show」或从 Sessions 列表切入时，`scrollToFirstPendingConfirmation(sessionId)` 在 `ConversationLens` 异步挂载注册前同步执行，因 `lensFor(sessionId)` 为 `undefined` 直接丢弃请求；且默认窗口通过 `ConversationLeafSessionBar.switchLeafSession` 切会话时不触发 `openPendingOnFocus`（违反 `PRD-026.2`）。
- **修改方案**：
  - 在 `ConversationTimelineRevealService` 中记录待执行的 `pendingConfirmationScrollSessionId`：若调用 `scrollToFirstPendingConfirmation(sessionId)` 时 `lensFor(resolved)` 尚未注册，则暂存 `resolved`，并在 `registerLens(sessionKey, lens)` 注册匹配会话时自动补执行一次 `lens.scrollToFirstPendingConfirmation()`。
  - 在 `ConversationLeafSessionBar` 中注入 `@IConversationTimelineRevealService`：在 `switchLeafSession(sessionId)` 切换完成后，检查 `shouldOpenPendingOnFocus(this.configurationService) && shouldAutoRevealPendingConfirmation(this.uaConnection) && this.stubService.hasPendingAttentionSeat(sessionId)`，满足时调用 `this.timelineRevealService.scrollToFirstPendingConfirmation(sessionId)`。

---

## 3. 切片 S2：P1 级重要 UI 功能与状态闭环修复

### 3.1 提问座位（`ConversationQuestionSeat`）单选+自定义输入可提交支持
- **现状证据**：
  - `src/vs/workbench/contrib/conversation/browser/conversationQuestionSeat.ts:167-170`：当题目同时提供预设选项（如包含空白占位或用户改填自定义输入）与 `allowCustom: true` 时，`requiredLabelMissing()` 仅检查 `selections.get(item.id)` 是否有非空标签，完全忽略了用户在自定义输入框中填写的非空 `customText.trim()`，导致用户在 `allowCustom: true` 的题目中输入自定义答案后仍可能被 `"Can't submit — a required choice is empty."` 拦截（注：保留单选默认 `initialIndex = 0` 与纯自定义/多选既有提交行为，不破坏 `conversationQuestionSeat.test.ts` 的 24 条既有单测）。
- **修改方案**：
  - 在 `conversationQuestionSeat.ts` 的 `requiredLabelMissing()` 中，若某题 `item.allowCustom === true` 且对应 `customInputs.get(item.id)?.value.trim()` 非空，则视为已提供有效回答，不再报错拦截。

### 3.2 用户回合内联编辑（`turnEdit`）查找回退、异步失败反馈与标签切换隔离
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts:513, 690, 950` 与 `conversationLensComposer.ts:491` 只从 `stubService.getTurns()` 查找可编辑用户回合，未像 `regenerateTurn`（`conversationLensSessionBinding.ts:586`）那样优先从 `host.lastAttachedEntries` 查找。
  2. `ConversationInboxOverlay`（`conversationInboxOverlay.ts:220-235`）与 `ConversationLens` 未监听 `stubService.onDidFailEngineAction?.(...)`：当引擎异步拒绝 `cancelGeneration`（Stop）或 `setSessionGoal` / `cancelSessionGoal`（Goal）时，`ConversationInboxOverlay` 的 `stopInFlightSessionId` 卡在 `Stopping…` 禁用态，且不显示 `Couldn't stop the reply. Try again.` 或 `Goal not saved. Try again.`。
  3. `conversationLensProjection.ts:249-275` 与 `conversationLens.ts:478-492`：同一编辑器组内切换根标签与子代理延伸标签时，`updateConversationPhase` 因 `conversationPhase === nextPhase` 早退而未更新 `identityStrip` 显隐；`setFilterAgentId` 在切换标签前未退出 `turnEdit`。
- **修改方案**：
  1. 在 `beginTurnEdit`、`isComposerEditSurfaceLive`、`updateSendEnabled` 与 `saveTurnEdit` 中优先从 `host.lastAttachedEntries` 查找目标用户回合，未命中再回退 `host.stubService.getTurns(sessionId)`（保持 `saveTurnEdit` 同步退出合同以兼容 `conversationLensDisposeGate.test.ts`）。
  2. 在 `ConversationInboxOverlay` 中订阅 `this.stubService.onDidFailEngineAction?.(failure => ...)`：当 `failure.action === 'cancelGeneration'` 时清除 `stopInFlightSessionId`、渲染 `conversationLensDockStopFailed` 并调用 `this.render()`；当 `failure.action === 'setSessionGoal' || failure.action === 'cancelSessionGoal'` 时渲染 `conversationLensDockGoalSaveFailed` 并调用 `this.render()`。
  3. 在 `updateConversationPhase` 的 `if (host.conversationPhase === nextPhase)` 早退分支中，若 `!preFirst` 则同步 `host.filterAgentId` 对应的 `identityStrip` 挂载或移除；在 `ConversationLens.setFilterAgentId` 中若切换到了不同的 `agentId` 且 `this.composerPolicy === 'turnEdit'`，先调用 `this.exitComposerEdit(true)`。

### 3.3 合并 `file_edit` 卡单行 `data-turn-id` / 断连 `Incomplete` 状态与轨迹页 `displayMode`
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts:800-901`：`renderFileEditCard` 在多文件合并（`turns.length > 1`）时未在每条 `.conversation-file-edit-line` 上设置 `data-turn-id = turn.id`；且在断连缓存（`displayMode === 'cached'`，`!showLiveChrome`）下若某条 `file_edit` 处于 `running` 或 `pending`，未在行内与 `aria-label` 标出 `Incomplete`（违反 `PRD-013.4`；注：保持 `countProcessFoldToolStatuses` 的 `pending` 计数与无 `metadata.diff` 时不渲染 `.conversation-file-edit-diff` 的既有单测合同）。
  2. `src/vs/workbench/contrib/conversation/browser/conversationLensReadingColumn.ts:105-113` 与 `conversationTrajectory.ts:211, 356, 1177`：未向 `ConversationTrajectory` 传入 `displayMode`，导致断连缓存会话在轨迹页过程折头误显示 `Stub ·`（违反 `PRD-013.4`）。
- **修改方案**：
  1. 在 `renderFileEditCard` 中为每条 `.conversation-file-edit-line` 设置 `line.setAttribute('data-turn-id', turn.id)`；当 `displayMode === 'cached' && !showLiveChrome && (turn.toolStatus === 'running' || turn.toolStatus === 'pending')` 时，在行尾状态文字与路径 `aria-label` 中补充 `Incomplete`。
  2. 向 `ConversationTrajectory` 传入 `displayMode: () => getConversationDisplayMode(host)` 并在 `applyTrajectoryFoldTemplate` 与 `TrajectoryTableAccessibilityProvider` 中透传。

### 3.4 会话叶分屏（Split Session Window）与同叶 Diff 标签切换时叶级 SessionBar 稳定性
- **现状证据**：
  - `src/vs/workbench/contrib/conversation/browser/conversationEditorPane.ts:150-162, 222-246, 361-373`：
    1. 会话叶内分屏为左右两列时，两列的 `this.group.activeEditorPane === this` 均为真，`syncLensTablistPlacement()` 把两列的 `lensTablist` 都插进叶顶部同一个 `.conversation-lens-session-bar-leading`，出现双份 `Conversation | Trajectory` 标签栏；
    2. 分屏后子列 `dimension.width` 直接传给 `leafSessionBar.layout(dimension.width)`，把整叶宽度的 SessionBar 错误打上 `.is-narrow`。
- **修改方案**：
  - 在 `ConversationEditorPane.syncLensTablistPlacement()` 中，若 `.conversation-lens-session-bar-leading` 内已存在其他活动 `ConversationEditorPane` 的 `.conversation-lens-tablist`（或当前面板不是叶内首个放置 `tablist` 的面板），则将本列的 `lensTablist` 留在各自列的 `pageChrome` 中，避免叶级 SessionBar 出现两个 `tablist`。
  - 在 `ConversationEditorPane.layout(dimension)` 中，测量叶级 `sessionBar` 容器的实际宽度（`barHost.clientWidth > 0 ? barHost.clientWidth : dimension.width`）传给 `this.leafSessionBar.layout(barWidth)`。

### 3.5 `isWorkDirCompatible` 子目录兼容与多根工作区 Sources `Files` 根跟随
- **现状证据**：
  1. `src/vs/workbench/contrib/sources/common/sourcesReviewAttribution.ts:77-83`：`isWorkDirCompatible` 只判断 `normalizeReviewPath(root.fsPath) === normalizedWorkDir`，未像同文件第 97 行 `resolveMutationResource` 那样允许 `normalizedWorkDir.startsWith(`${rootPath}/`)`，导致会话 `workDir` 位于已打开工作区文件夹子目录时不生成时间线「查看更改」入口。
  2. `src/vs/workbench/contrib/sources/browser/sourcesFilesExplorer.ts:300-418`：多根工作区下切换会话时，列表模式默认根与面包屑始终取 `folders[0]`，未优先匹配当前活动会话的 `localRoot`（违反 `PRD-029.1`）。
- **修改方案**：
  1. 在 `isWorkDirCompatible` 中允许 `rootPath === normalizedWorkDir || normalizedWorkDir.startsWith(`${rootPath}/`)`。
  2. 在 `SourcesFilesExplorer` 中监听 `this.session?.onDidChangeActiveWorkRoot`，在计算默认工作区根文件夹时优先匹配包含 `this.session?.getActiveWorkRoot?.()?.localRoot` 的工作区文件夹（回退 `folders[0]`），并在列表模式下当活动会话 `localRoot` 变化时刷新列表与面包屑。

### 3.6 Sessions 断连删除门控、Client Settings 紧凑密度 Dock 挂载与 Enter 键提示实时刷新
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationSessionsView.ts:334-339, 579-586`：引擎断连但有连接历史（`isConversationDisconnectedEngineSession`）时，`updateDeleteEnabledContextKey()` 未禁用删除按钮，且 `showSessionContextMenu()` 中禁用项未附带不可用原因（违反 `PRD-002.6` / `PRD-028`），每次打开菜单创建的 `Action` 实例也未在 `onHide` 中释放。
  2. `src/vs/workbench/contrib/conversation/browser/conversationLensReadingColumn.ts:354-368`：`applyConversationDensity` 未对 `host.slotHosts.dock` 切换 `.density-compact`，导致 `conversationLens.css:5486-5518` 中定义的 `.density-compact .conversation-lens-composer` 与 `.density-compact .conversation-lens-inbox-overlay` 在对话开始后不生效（违反 `PRD-026.2`）。
  3. `src/vs/workbench/contrib/conversation/browser/conversationLens.ts:365-372` 与 `conversationTimelineRenderer.ts:962`：`onDidChangeConfiguration` 未监听 `UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR` 立即调用 `updateSendEnabled()` 刷新 Send 按钮快捷键提示；`renderStandaloneThinkingOrToolRow` 硬编码了 `showToolInvocationDetails: true` 而未读取 `this.showToolInvocationDetails()`。
- **修改方案**：
  1. 在 `ConversationSessionsView.updateDeleteEnabledContextKey()` 中检查 `!this.isSessionRowActionDisabled(this.stubService.getActiveSessionId())`，在 `showSessionContextMenu()` 中当操作禁用时将 `getRowActionUnavailableReason()` 拼入菜单项标签并在 `onHide` 中 `dispose()` 临时 `Action`。
  2. 在 `applyConversationDensity` 中增加 `applyConversationDensityClass(host.slotHosts.dock, host.configurationService)`。
  3. 在 `ConversationLens` 的 `onDidChangeConfiguration` 中监听 `UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR` 并调用 `this.updateSendEnabled()`；在 `ConversationTimelineRenderer.renderStandaloneThinkingOrToolRow` 中传入 `showToolInvocationDetails: this.showToolInvocationDetails()`。

---

## 4. 规则 16 只读审查记录（2026-11-06）

- **首轮审查结论**：Critical 9，Important 4，Minor 2。已全部核验源码与单测并修订本方案：
  1. **Critical 1 & 2（S1 2.5 `visualize` 过滤与 `recordDetail` 签名）**：核对 `conversationSessionView.test.ts:650-683` 与 `conversationViewFrame.ts:261-268`，已在 §2.5 改为仅当 `parseVisualizeArgs(details.get(String(item.detail))) !== undefined` 时才从轨迹表过滤 `visualize`（保留无详情或非法详情的回退 `tool` 行）；`recordDetail` 使用合法的 `{ kind: 'patches', changedIds: new Set(matchingIds) }`，且 `requestReadingColumnDetail(host, ref)` 使用双参数签名并加防重集合。
  2. **Critical 3（S1 2.7 `ConnectionPreferencesPane` 设备刷新与 `idle`）**：核对 `connectionPreferencesPane.test.ts:5153,6656,7527,7617`，在測試桩中 `createHubStub.refreshDirectory` 默认返回 `{ kind: 'idle' }` 且测试严格断言 `listDevices` 调用次数与失败横幅，故从 §2.7 移除对 `refreshDirectoryListed` 和 `refreshEngineDeviceLists` 的改动，避免破坏既有 D212/D221/Slot G 合同。
  3. **Critical 4（S2 3.1 `ConversationQuestionSeat`）**：核对 `conversationQuestionSeat.test.ts:33,58,84,161,495`，既有单测显式断言挂载时单选第 0 项 `aria-checked === 'true'` 且允许空多选/纯自定义提交，故 §3.1 仅保留「当 `allowCustom === true` 且自定义输入非空时满足 `requiredLabelMissing()`」。
  4. **Critical 5（S2 3.2 `renameEngineSession` 与 `saveTurnEdit`）**：核对 `conversationEngineRosterService.test.ts:2738-2752` 与 `conversationLensDisposeGate.test.ts:4945-5037`，保留 `renameEngineSession` 离线本地缓存行为与 `saveTurnEdit` 同步退出合同，§3.2 仅修复 `lastAttachedEntries` 查找回退、Inbox `onDidFailEngineAction` 监听与标签切换时的 `identityStrip` / `turnEdit` 清理。
  5. **Critical 6 & Important 4（S2 3.3 `countProcessFoldToolStatuses` 与 `renderFileEditCard`）**：核对 `conversationProcessFold.test.ts:936-942`、`conversationProcessFoldToolDetails.test.ts:300-311` 与 D21，保留 `pending` 计入 `executing` 及无 `metadata.diff` 不渲染 `.conversation-file-edit-diff` 的合同，§3.3 仅补齐合并 `file_edit` 行的 `data-turn-id`、断连缓存 `Incomplete` 状态与轨迹页 `displayMode`。
  6. **Critical 7 & Important 3（S2 3.4 `syncSubAgentsFromLiveTree` 与 `teardownLens`）**：核对 `conversationSessionChat.test.ts:2074-2146` 与 `conversationEditorPane.test.ts:77-78`，保留子代理退出活树从目录移除及 `teardownLens` 移除孤儿 sessionBar 的既有单测合同，§3.4 仅修复分屏时双份 `lensTablist` 挤占与 `leafSessionBar` 宽度测量。
  7. **Critical 8（S2 3.5 `getWorkDirMismatchNote` 与 F14）**：核对 `sourcesReviewAttribution.test.ts:699-718` 与 `review-2026-11-01-feature-gaps.md` F14，保留 `getWorkDirMismatchNote` 现有合同，§3.5 仅修复 `isWorkDirCompatible` 子目录支持与 `SourcesFilesExplorer` 多根工作区会话根跟随。
  8. **Critical 9 & Important 2（S2 3.6 Navigator 单击、Projects 行尾、Triggers Edit、Agents dirty 与 `restoreDrafts`）**：核对 `navigatorAgentsSubviews.test.ts:2324`、`navigatorTeamSubviews.test.ts:2722`、`navigatorProjectsList.test.ts:1255`、`engineTriggersSection.test.ts:1745` 与 `conversationLens.test.ts:3666`，剔除与这些单测冲突的改动，§3.6 聚焦于 `ConversationSessionsView` 断连删除门控、`.density-compact` Dock 挂载、`keyboardEnter.behavior` 实时刷新与独立工具行 `showToolInvocationDetails`。
  9. **Important 1 & Minor 1–2**：已在 §2.3、§2.6、§2.7 融入 `IPreviewCategoryRoutingPart.getTargetGroupForInput`、`sourcesWiringScan.test.ts` 边界保护、`applySessionTitleHold` 与 `switchLeafSession` 三重门控。

---

## 5. 验证门禁（本地门禁）

遵循 [health-gates](../progress/health-gates.md)：
1. `npm run transpile-client` 与 `npm run typecheck-client` 零错误。
2. 相关 Node / Electron / Chromium 单测与 CSS 合同扫描。
3. 修改文件的 ESLint 与 `git diff --check`。
4. 文档门禁：`python3 scripts/generate-docs-status.py`、`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`。

## 6. S1–S2 实施与验证检查点（2026-11-06）

- **S1（P0 核心交互阻断与编译/运行时缺陷修复）**：
  - `conversationLensSessionBar.ts`、`conversationLeafSessionBar.ts`、`conversationEditorPane.ts`：修复 History / Snapshots `onWillShow` 调用不存在的 `closePanel()` 为 `host.inboxOverlay?.closeListPanel()` 并在叶级桥接 `closeInboxListPanel`；在 `publishLeafSessionLists()` 同步 `lens.sessionSyncBadge = bar.sessionSyncBadge` 与 `lens.updateSyncChrome()`；在 `ConversationLeafSessionBar` 订阅连接/会话变化更新 `updateSessionBarWriteChrome(this)` 并在空会话分支调用 `applySessionTitleHold`。
  - `conversationTimelineRenderer.ts`、`conversationTimelineHost.ts`：补齐 `onProcessFoldLayout` 构造参数与回调传入，修复展开/收起时滚动补偿与 `TS2339`。
  - `conversationEditorPart.ts`：监听组内 `group.onDidModelChange` 重算 `applyConversationPartOptions()`，单列会话窗口打开延伸标签（子代理 tab、Fork、Diff 审阅）时自动显示 chat tab 栏。
  - `conversationSessionView.ts`、`conversationTrajectoryModel.ts`、`conversationLensProjection.ts`、`conversationEngineFrameSource.ts`：对话页时间线跳过 `isCompactedItemAttribution`，轨迹页 `compacted` 行点击留在轨迹打开局部检查器；轨迹表过滤已合法解析的 `visualize` 图示卡；活引擎路径按需拉取 `visualize` 详情并在 `recordDetail` 写入后发布增量重绘。
  - `previewCategoryRouting.ts`、`categorizedMainEditorPart.ts`、`editorOpenSlot.ts`、`sourcesDiffOpenIdentity.ts`、`sourcesChangeEntryOpen.ts`、`sourcesDiffRefHelpers.ts`、`sourcesDiffActions.ts`、`sourcesChangesList.ts`、`sourcesReviewList.ts`、`sourcesReviewCommands.contribution.ts`：非 `Code` 类别下从 Sources 打开文件/Diff 时经 `getTargetGroupForInput` 路由到目标类别组而不覆盖当前类别；Preview 打开 Diff 时在 `rememberSourcesDiffOpenIdentity` 保存完整 `ISourcesChangeIdentity`，移动 Diff 到对话窗口或底部后保留 `Accept` 按钮；放宽 `previewDiffTitleWhen` 支持 `git` 与 `sources-git-diff` scheme 并补齐四处 `layoutService` 注入。
  - `conversationTimelineRevealService.ts`、`conversationLeafSessionBar.ts`：支持未挂载会话叶的延迟 `scrollToFirstPendingConfirmation`，并在 `switchLeafSession` 补齐 `openPendingOnFocus` 联动。
- **S2（P1 重要 UI 功能与状态闭环修复）**：
  - `conversationQuestionSeat.ts`：支持 `allowCustom: true` 题目在填写非空自定义答案时通过必填校验。
  - `conversationLensComposerChrome.ts`、`conversationLensComposer.ts`、`conversationInboxOverlay.ts`、`conversationLensProjection.ts`、`conversationLens.ts`：`turnEdit` 优先从 `lastAttachedEntries` 查找用户回合；Inbox 监听 `onDidFailEngineAction` 处理 Stop / Goal 异步拒绝并恢复按钮与错误提示；同组切换根标签与子代理延伸标签时同步 `identityStrip` 显隐并退出 `turnEdit`。
  - `conversationProcessFold.ts`、`conversationLensReadingColumn.ts`、`conversationTrajectory.ts`：合并 `file_edit` 卡每行挂载 `data-turn-id` 并在断连缓存未完成时标出 `Incomplete`；向 `ConversationTrajectory` 透传 `displayMode` 避免断连缓存误标 `Stub ·`。
  - `conversationEditorPane.ts`：会话叶内分屏时防止双份 `lensTablist` 挤入叶级 SessionBar，并按叶级容器实际宽度计算响应式断点。
  - `sourcesReviewAttribution.ts`、`sourcesFilesExplorer.ts`：`isWorkDirCompatible` 支持工作区子目录会话生成「查看更改」入口；多根工作区下 `SourcesFilesExplorer` 列表模式与面包屑跟随活动会话 `localRoot`。
  - `conversationSessionsView.ts`、`conversationLensReadingColumn.ts`、`conversationLens.ts`、`conversationTimelineRenderer.ts`：引擎断连后禁用 Sessions 删除动作；`.density-compact` 同步挂载 `dock` 槽；`keyboardEnter.behavior` 变更实时刷新 Send 按钮提示；独立 `file_edit` 行读取 `showToolInvocationDetails` 设置。
- **验证结果**：
  - `npm run transpile-client` 与 `npm run typecheck-client` **0 errors**。
  - Node 合同扫描：`conversationLensCssScan.test.ts` 与 `sourcesWiringScan.test.ts` **97 passing / 0 failing**。
  - 组件行为单测：`conversationEditorPane.test.ts`、`conversationQuestionSeat.test.ts`、`conversationTrajectoryUi.test.ts`、`conversationTrajectory.test.ts`、`conversationSessionView.test.ts`、`conversationLensComposerChrome.test.ts`、`sourcesReviewAttribution.test.ts`、`sourcesDiffRefHelpers.test.ts`（163 passing）、`conversationProcessFold.test.ts`、`conversationProcessFoldToolDetails.test.ts`、`conversationTimelineRenderer.test.ts`、`conversationSessionsView.test.ts`、`conversationSessionSplit.test.ts`、`navigatorProjectsList.test.ts`（223 passing）全绿通过。
  - 修改文件 ESLint **0 errors**。

