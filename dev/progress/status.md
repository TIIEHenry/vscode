---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-08
summary: "2026-10-07：编辑器壳剧本可按命令断言开关与 Sources。2026-10-06 行为与视觉审查方案仍 draft。浏览器归属、遮罩色和追问工作态仍 draft。不升 PRD。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md) · 2026-10-05 归档 → [归档](../archive/status-current-session-2026-10-05.md)。
## Current Session
- **审查与修复 Wave 21（Slot A agentHost / 集成）**：
  - **Slot A（agentService 现代化重构并解开 7 项 listSessions 变更集目录与持久化 diffs 单测）**：
    在 `agentService.test.ts` 中将此前因变更集架构演进而被跳过的 7 个核心测试全面解开并现代化对齐：
    1. `listSessions synthesizes the session changeset catalogue from persisted diffs for unopened sessions`：更新断言未打开会话由 `_changesetCoordinator.decorateListEntry` 注入现代聚合 `sessions[0].changes: { additions: 8, deletions: 2, files: 2 }`，`changesets` 保持 `undefined`；
    2. `listSessions silently ignores malformed persisted diffs`：断言畸形 diffs 优雅忽略且 `changes` 为 `undefined`；
    3. `listSessions advertises persisted changeset counts without seeding state; changeset subscribe restores lazily`：验证未打开时仅暴露 `changes` 统计而不提前注入 stateManager 快照；客户端发起 `svc.subscribe` 时由 `restoreSessionIfChangesetSubscription` 懒加载完成水合且状态为 `ready`；
    4. `listSessions prefers ready live changeset state over stale persisted diffs for unopened sessions`：校验实时状态优先于过期的持久化 diffs；
    5. `listSessions does not request the diffs metadata key when a live source can answer`：校验存在 live source 时按需跳过大对象 `diffs` 查询；
    6. `listSessions still reads persisted diffs when only a computing (not ready) changeset state exists`：校验计算中状态仍能兜底读取持久化结果；
    7. `listSessions overlays live state manager title over SDK title`：校验实时状态管理标题覆盖 SDK 标题契约；
    单测套件在 node runner 下全量验证通过。
  - 经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`npm run transpile-client` 0 errors）与目标单测全量验证。本提交在人类工位，合入 `loop/merge` 后快进对齐。未推主干。
- **审查与修复 Wave 20（Slot B sessions / Slot A agentHost held，提交 92d24294f90）**：
  - **Slot B（sessions 修复 localAgentHostSessionsProvider 活动分支变更订阅与内容 URI 校验单测）**：
    在 `localAgentHostSessionsProvider.test.ts` 中恢复 `LocalAgentHostSessionsProvider - active-session branch changeset subscription` 单测套件执行；
    在 `active branch changeset uses before content URI as the diff original` 单测中将 `originalUri` 预期值更新为 `toAgentHostContentUri(URI.parse('session-db:///before/file.ts'), LOCAL_AGENT_HOST_AUTHORITY).toString()`，精准对齐 ContentRef 携带 `contentRef: true` 元数据的契约；
    在 `changes summary tracks the live branch changeset while active and the catalogue once inactive` 单测中将断言与当前架构对齐：验证活动时 `session.changes` 呈现实时文件列表（1 个文件，2 insertions, 1 deletion），非活动时置空；`session.changesSummary` 保持目录摘要并在 `fireSessionSummaryChanged` 时正确响应；
    单测 `localAgentHostSessionsProvider.test.ts` 目标套件 10 项全绿（提交 `92d24294f90`）。
  - **Slot A（agentHostChangesetService 单测重构 WIP 保持占用）**：
    解除 skip 后经架构审查确认 `AgentHostChangesetService` 现已演进为 3 static changeset（branch/uncommitted/session）以及基于 gitState 的 5-changeset 目录契约；旧测试夹具与断言需系统性重构与对齐，已在 `loop/A` 本地安全提交 WIP（`300a075d2e4`），未入集成分支，槽位保持占用。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与针对性单测全量验证（10 passed，0 failed），单编译锁串行无冲突，已快进同步至 loop/merge（提交 `92d24294f90`）。
- **审查与修复 Wave 19（Slot A sessions / Slot B chat，提交 0dd4963e16a）**：
  - **Slot A（sessions 恢复 agentHostSkillButtons 菜单注册条件与单测）**：
    在 `agentHostSkillButtons.ts` 中移除 `AGENT_HOST_SKILL_BUTTONS`（merge、createPR、createDraftPR、updatePR）4 处 `extraWhen` 中先前用于禁用的临时 `ContextKeyExpr.false()`；
    恢复由 `IsSessionsWindowContext`、`IsAgentHostSession`、`ActiveSessionContextKeys.HasGitRepository` 与具体 worktree/PR 状态构成的完整门控链；
    在 `agentHostSkillButtons.test.ts` 中恢复 `agentHostSkillButtons - menu registration` 单测套件执行；
    单测 `agentHostSkillButtons.test.ts` 11 项全绿（提交 `25d1eaeb1f4`）。
  - **Slot B（chat 解除 chatListRenderer 渲染中高度延迟计算单测 skip 并验证回归）**：
    在 `chatListRenderer.test.ts` 中将 `test.skip('fireItemHeightChange defers a mid-render measurement and delivers it after the render pass', ...)` 解除 skip；
    验证在渲染阶段（render pass）中产生同步测量时，`reconcileChatItemHeight` 延迟触发重测并在渲染结束后可靠投递高度事件的契约稳定性；
    单测 `chatListRenderer.test.ts` 45 项全绿（提交 `c423aaac8a5`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（56 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `0dd4963e16a`）。
- **审查与修复 Wave 18（Slot A sources / Slot B chat，提交 36e74417040）**：
  - **Slot A（sources 扫描测试适配 openReviewEntryMarkingReviewed 共享辅助方法）**：
    在 `sourcesReviewList.ts` 将打开与已审标记逻辑抽取为 `openReviewEntryMarkingReviewed` 供列表打开与右键菜单统一复用后，校准 `sourcesWiringScan.test.ts` 与 `sourcesLeftoverCatchScan.test.ts` 的接线扫描断言；
    在调用点断言双链异常捕获（`.catch(onUnexpectedError).catch(onUnexpectedError)`）与无直接 `async e =>`；在辅助方法体内完备断言 `markReviewedAfterSuccessfulOpen`、`settleSourcesOpenStatus`、`isSourcesGitFileDiffOpenSkipped` 与状态错误上报；
    单测 `sourcesWiringScan.test.ts` 与 `sourcesLeftoverCatchScan.test.ts` 26 项全绿（提交 `986153a46ca`）。
  - **Slot B（chat 外部 harness 卸载后回退至默认会话与 harness）**：
    `customizationHarnessService.ts` 在 `CustomizationHarnessServiceBase` 中登记构造函数 `_defaultHarness`；在 `_refreshAvailableHarnesses` 中探测当前活动会话所属的 sessionType，若外部扩展注销（`reg.dispose()`）后该 sessionType 已不在当前可用列表中，安全回退并将活动会话切至默认会话（`SessionType.Local`），保持 `activeHarness` 与 `activeSessionResource` 严格单向派生同步；
    取消 `customizationHarnessService.test.ts` 中 `falls back to first harness when active external harness is removed` 单测的 skip 并全量回归；
    单测 `customizationHarnessService.test.ts` 17 项全绿（提交 `381ee4d8de4`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（42 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `36e74417040`）。
- **审查与修复 Wave 17（Slot A conversation / Slot B sessions，提交 7c740b11086）**：
  - **Slot A（conversation 会话窗口叶生命周期与异步呈现可见性校验修复）**：
    `conversationSessionWindowService.ts` 在 `revealSessionWindow` 异步呈现应用状态表后增加可见性校验（`if (!this.isSessionWindowVisible(sessionKey)) return { cancelled: false };`），避免在异步等待期间窗口被隐藏仍继续执行布局与聚焦；
    将各会话叶的 `store` 独立实例化（`new DisposableStore()`），解耦服务层 `_register`，消除已销毁会话叶在父服务中的生命周期引用泄漏；
    在 `rollbackHalfAppliedLeaf` 中为 `disposeConversationEditorPart` 增加 `try-finally` 保证，确保编辑器部分销毁异常时仍能可靠回收叶容器与状态；并在服务 `dispose` 中完备清理全部活动叶生命周期；
    单测 `conversationSessionWindowReveal.test.ts` 25 项全绿（提交 `0a35a899879`）。
  - **Slot B（sessions 快聊新建与请求在途暴露草稿并在终态安全清理）**：
    `sessionsManagementService.ts` 在 `createAndSendQuickChatRequest` 中将新建快聊草稿登记至 `_unlistedNewSessions`，确保在请求配置与发送在途期间，通过 `getSession(session.resource)` 能正常解析到该临时草稿，并在 `finally` 块中可靠清理，对齐常规新建会话契约；
    新增单测 `createAndSendQuickChatRequest exposes draft via getSession during flight and clears unlisted draft after completion or cancellation`，覆盖正常完成与取消两条执行路径；
    单测 `sessionsManagementService.test.ts` 121 项全绿（提交 `c32b1674ff2`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（145 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `7c740b11086`）。
- **审查与修复 Wave 16（Slot A terminal / Slot B chat，提交 0a5a815c436）**：
  - **Slot A（terminal POSIX shell 单引号路径转义契约校准）**：
    `terminalEnvironment.ts` 修复 `escapeNonWindowsPath` 在 GitBash、Fish 及 POSIX 默认环境下的单引号转义规则，从无效的 `'` 修正为 POSIX 标准的 `'''`（即 `path.replace(/'/g, "'\''")`），确保包含单引号的文件路径在 POSIX shell 参数中安全准确解析；
    校准 `terminalEnvironment.test.ts` 中 Bash、Sh、Zsh、GitBash、Fish 以及默认 POSIX 分支单引号转义断言；
    单测 `terminalEnvironment.test.ts` 14 项全绿（提交 `8558b63eda4`）。
  - **Slot B（chat 补齐 sessionType 目标模型的模式与位置过滤契约）**：
    `chatInputModelUtils.ts` 在 `filterModelsForSession` 的 sessionType 定向分支中，补齐模式适配（`isModelSupportedForMode`）与行内位置过滤（`isModelSupportedForInlineChat`），消除特定会话类型下向不支持 Agent 模式或行内编辑的模型发起请求的隐患；
    取消 `chatInputModelUtils.test.ts` 中 `filters by mode for session-targeted models` 单测的 skip，全量回归验证通过；
    单测 `chatInputModelUtils.test.ts` 131 项全绿（提交 `fc4bb56afe3`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（144 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `0a5a815c436`）。
- **审查与修复 Wave 15（Slot A universeAgent / Slot B sessions，提交 95731ca21c4）**：
  - **Slot A（universeAgent 宿主断连重连自愈与 S4b fail-closed 契约保全）**：
    `sessionViewHost.ts` 引入 `failClosedRecovery: Set<string>`，在会话遭遇 `mailbox.overflow` 溢出后登记；在连接断开重连恢复（`finishBringUp`）时若当前无活跃 attempt，派发补充的 `connectionUp` 唤醒 Actor 重新开流自愈，并在成功开流或宿主销毁时安全清理；
    严格遵循 Grok 4.7 xhigh 架构裁决，维持 S4b 正式契约不变量（保持 `failClosedOverflow does not schedule reopen` 等 3 项测试断言），新增断连重连自愈测试用例 `overflow followed by disconnect and reconnect self-heals via supplementary connectionUp`；
    单测 `sessionViewHostReopen.test.ts` 12 项全绿（提交 `641b1f86959`）。
  - **Slot B（sessions 批量删除失败 PR 缓存保真与草稿工作区安全回退）**：
    `baseAgentHostSessionsProvider.ts` 优化 PR 分支缓存策略，仅在分支探测明确返回 `undefined`（确认为无 PR）时淘汰缓存，在调用失败或 reject 时完整保留缓存，杜绝异常抖动导致的重复请求；`deleteSessions` 仅在底层销毁成功时回收并清理会话，局部故障会话保留在缓存且不销毁其 PR 缓存；
    `sessionsService.ts` 强化草稿新建工作区继承保护，活动会话为 Quick Chat、无根目录或 URI 无法解析时安全回退至空工作区 / composer 视图，避免触发非预期信任弹窗；
    单测 `localAgentHostSessionsProvider.test.ts`（217 项全绿）与 `sessionsManagementService.test.ts`（120 项全绿）（提交 `11ecedd1df6`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测全量验证（350 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `95731ca21c4`）。
- **审查与修复 Wave 14（Slot A conversation / Slot B chat，提交 6d88e201f7a）**：
  - **Slot A（conversation 发送按钮尺寸断言校准与 Composer 单测 Disposable 纳管）**：
    `conversationLens.test.ts` 校准发送控制按钮高度断言从 28px 至 24px，匹配 PRD-028 24px 发送按钮视觉规范；
    `conversationLensComposer.test.ts` 补齐 `InMemoryStorageService` 在测试套件 `disposables` 中的纳管注册，消除单测 disposable 泄漏警告；
    单测 `conversationLens.test.ts` 与 `conversationLensComposer.test.ts` 全绿（提交 `62ee3b80f2b`）。
  - **Slot B（chat OpenAgentHostStateFileAction 前置条件契约修复）**：
    `openAgentHostStateFileAction.ts` 将动作前置条件 `precondition` 中 `IsSessionsWindowContext` 修正为取反 `IsSessionsWindowContext.toNegated()`，保证该命令在默认 VS Code 窗口可用，在专用 Sessions/Agents 窗口中严格禁用；
    单测 `openAgentHostStateFile.test.ts` 12 项全绿（提交 `0cb049b9596`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与目标单测验证（153 项全绿），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `6d88e201f7a`）。
- **审查与修复 Wave 13（Slot A conversation / Slot B sessions，提交 4ec70ecd67a）**：
  - **Slot A（conversation Timeline Overlay 容器挂载与 Promise Catch 契约扫描计数校准）**：
    `conversationSessionChat.contribution.ts` 恢复优先在 `leaf.sessionWindow` 中查找 `.conversation-timeline` 作为子代理浮层宿主，确保浮层被正确约束在时间线包含块中；
    `conversationLeftoverPromiseCatchScan*.test.ts` 校准断连态下 4 处双链 catch 契约匹配断言计数；
    单测 `conversationLensCssScan.test.ts`（27 项）与 3 个 Promise catch 扫描套件（19 项）共 46 项全绿（提交 `e3b496242b3`）。
  - **Slot B（sessions newChatInput 契约扫描兼容与 Agent Host PR 编号粘性解析）**：
    `newChatInputCatchScan.test.ts` 重构 import 断言为正则匹配，兼容多标识符具名导入并严格保证双链 catch 契约；
    `baseAgentHostSessionsProvider.ts` 在 `AgentHostSessionAdapter` 中实现 `_pullRequestNumberCache`，确保活动会话分支 PR 编号在 `gitHubInfo` 重算时不发生重复查询或图标抖动；恢复并跑绿被 skip 的 PR sticky 单测；
    单测 `newChatInputCatchScan.test.ts`（4 项全绿）与 `localAgentHostSessionsProvider.test.ts`（217 项全绿，提交 `4ec70ecd67a`）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与双领域测试全量通过，单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 `4ec70ecd67a`）。
- **2026-10-07 调度**：merge 槽 `133b08803f5` 合入槽 A `e3b496242b3`（overlay 挂到 timeline）、槽 B `9ec81fcaaee`（图示与子代理浮层去掉模糊）、槽 D `02cb44e31b2`（Composer 8px、不投影、发送钮 24px）。扫描测试两边保留，自动合并。`npm run compile-client` 0 errors。`conversationLensCssScan.test.ts` 27 passing。各工位已 ff-only 到 `54d98f287af`。槽 F `7d39b8b38e6`：输入光标跟 `input.foreground`，图示选项过渡不再带 box-shadow。`compile-client` 0 errors，扫描测试 27 passing。轨迹搜索聚焦仍用 `box-shadow`，这一处还在用，没有并进这一刀。不升 PRD-028。未 push。
- **审查与修复 Wave 12（Slot A conversation / Slot B sessions，提交 32358af552c）**：
  - **Slot A（conversation 会话叶窗切换早退修复与回合编辑退出 composer 挂载防护）**：
    `ConversationLeafSessionBar.switchLeafSession` 移除目标等于当前会话时的早退逻辑，确保正确处理聚焦、取消阻塞中的 in-flight reveal 并同步 `rosterService.switchSession`；`ConversationSessionWindowService` 增加聚焦叶冗余 reveal 过滤保护；
    `ConversationLensComposerChrome.syncComposerPlacement` 修复退出回合编辑模式时因行内容器销毁导致瞬时 `!isConnected` 而误跳过挂载的问题，确保原子挂回 `composerCluster` / `dockRoot`；
    单测 `conversationSessionWindowReveal.test.ts`（25 项全绿）与 `conversationLens.test.ts`（138 项全绿）。
  - **Slot B（sessions 多聊天删除缓存同步与新建会话工作区继承恢复）**：
    `CopilotChatSessionsProvider.deleteChat` 在持久化多聊天场景下，同步清理 `_sessionCache`、`_newSessions` 与 `_sessionGroupCache`，使分组缓存失效并触发群组变更事件通知，杜绝界面残留与空指针隐患；
    `SessionsService.openNewSession` 恢复 `inheritWorkspaceFromActiveSession` 选项支持，支持按需继承活动会话的工作区根路径并对齐草稿；恢复 `sessionsManagementService.test.ts` 中两个被 skip 的继承单测；
    单测 `copilotChatSessionsProvider.test.ts`（94 项全绿）与 `sessionsManagementService.test.ts`（118 项全绿）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与双领域全量单测通过（375 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 32358af552c）。
- **审查与修复 Wave 11（Slot A storage & policy / Slot B copilot tools & conversation，提交 f6606f16e4b）**：
  - **Slot A（storage 启动恢复抢修、并发 flush 回调精确结算与托管策略瞬态保护）**：
    `SQLiteStorageDatabase.connect()` 在首次连接前执行 `restoreRecoveryDatabaseIfMissing`，主库缺失时优先校验并原子重命名恢复 `.recovery-temp`（次选 `.recovery-replace`），防止异常中断后遗留恢复库被覆盖或回退至空库；
    `Storage.flushPending()` 快照当批待写入数据与等待中的 `whenFlushedCallbacks`，刷盘完成时精确结算当前批次，避免并发写入时回调滞留或受后批失败牵连；
    `FileManagedSettingsService` 增加瞬态 ENOENT 保护，首次缺失保留上一代策略并调度重试读取，防止配置原子替换时白名单短暂全开。
    单测 `storage.integrationTest.ts`（36 项）与 `fileManagedSettingsService.test.ts`（25 项）全绿。
  - **Slot B（copilot 命令免确认白名单净化与会话链路修复）**：
    从 `noConfirmationCommandsWithoutArgs` 彻底移除具有副作用的 `git.stash`、`git.stashPop`、`git.stashStaged`，保留只读的 `git.stashView`，强制要求弹窗确认；
    单测 `vscodeCmdTool.spec.ts` 4 项全绿；保持 thinking 轮次标题并在投影中改写活动会话链接；视口内含可见用户轮次时不置顶用户提示。
  - 修复 storage 模块 TypeScript TS2454 / TS6133 / TS2341 编译报错，补齐备份文件存在性断言，重构 flushPending Promise 生命周期。
  - 经 merge 槽集成编译（`compile-client` 0 errors，`compile-copilot` 0 errors）与全量针对性单测通过（共 123 项通过，0 失败），单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐（提交 38196081a1e）。
- **审查与修复 Wave 10（Slot A conversation / Slot B sessions，提交 9b688de6f87）**：
  - **Slot A（conversation 多消费者 Lease 基线快照回放与权威缓存投影）**：`SharedEngineHostBinding` 补齐次级消费者
    `addConsumer` 时回放基线快照与 cursor；权威缓存投影收归 `SharedEngineHostBinding.getCachedProjection`，
    修复多视图或次级绑定覆盖清空缓存投影问题；优化连接与暂存态下读取缓存投影的判定门禁。
    单测 `conversationEngineRosterService.test.ts` 与 `conversationEngineFrameSource.test.ts` 共 163 项全绿。
  - **Slot B（sessions 单个聊天删除前置确认门禁与草稿级联销毁防护）**：修复 `deleteChat` 当 `chatIds.length <= 1`
    时直接调用 `deleteSession` 绕过确认对话框缺陷，添加前置确认门禁；未提交草稿删除时仅清理本地缓存，
    阻断级联销毁父会话历史；修复 `RemoteNewSession.setPermissionLevel` 抛异常导致 Cloud 会话崩溃的缺陷。
    单测 `copilotChatSessionsProvider.test.ts` 共 92 项全绿。
  - 经 merge 槽集成编译（0 errors）与合并单测（254 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **编辑器壳剧本**：窗口驱动可以按命令 id 执行。剧本核对 Sources 当前标签和可见面板，并确认标题栏开关与命令留在编辑器窗口。
- **2026-10-06 审查**：行为十六路与视觉十六路的发现和方案已写入，frontmatter 仍 `draft`，未实施。浏览器页归属、对话框遮罩色、追问工作态聚焦仍是 draft。
- **UI 审查 Wave 8（r15 Debug 调试 / r16 Themes 主题，提交 47816a1adc5）**：
  - **r15（Debug 调试浮动条与悬停）**：`DebugToolBar.setCoordinates` 在标题栏显隐变动事件驱动下重置 `_yRange`，
    确保自定义标题栏显隐时浮动条吸顶与下移纵向区间正确重新计算；`DebugHoverWidget` 补齐 `beforeRender`
    异步时序计数保护，在异步 Promise 完成时标记 `isUpdatingTree = false` 并调用 `layoutTreeAndContainer()`。
    更新单测 `debugToolBar.test.ts`（2 项通过）与 `debugLeftoverPromiseCatchScanD744.test.ts`（11 项通过）。
  - **r16（Themes 默认主题对齐与对比度）**：更新 `COLOR_THEME_LIGHT_INITIAL_COLORS` 与 `COLOR_THEME_DARK_INITIAL_COLORS`
    启动占位色对齐 Universe 默认主题；更新 `2026-dark.json` 的 `disabledForeground`、`input.placeholderForeground`
    （`#8C8C8C`）与 `list.invalidItemForeground`（`#B89500`）提升暗色对比度。更新单测 25 项全绿。
  - 经 merge 槽（47816a1adc5）集成编译（0 errors）与针对性单测（36 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 7（r13 Terminal 终端 / r14 Markers & Search 问题与搜索，提交 56c4d04e83f）**：
  - **r13（Terminal 终端面板与编辑器）**：`DecorationAddon._updateClasses` 拷数组清 class 避免 token 残留；
    `TerminalTabsChatEntry` 显隐变化驱动 `TerminalTabbedView` 即时重排列表高度；
    `TerminalGroup._removeInstance` 用 `hadFocusOnExit` 保护焦点转交；
    `TerminalEditor` 的 `mousedown` 锁定本页实例；分栏/列表 `hasText` 在 63px 统一对齐并吸附。单测 13 项全绿。
  - **r14（Markers & Search 问题表视图与搜索）**：`MarkersTable.revealMarkers` 未选中时查可见行有效下标防越界；
    `SearchView.cancelSearch` 抽离 `cancelSearchWithFocus` 保证语义与文本均取消且按需聚焦；
    `MarkersFileDecorations` 补齐装饰开关与可见性双向配置监听。单测 27 项全绿。
  - 经 merge 槽（56c4d04e83f）集成编译（0 errors）与合并单测（40 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 6（r11 Welcome 欢迎页 / r12 Preferences 设置，提交 08cb8a490b5）**：
  - **r11（Welcome 欢迎页与入门引导）**：`GettingStartedPage.layout` 避免排版重建媒体与步骤 disposables；
    `walkthroughRestoreFolderMatches` 防空工作台 URI 崩溃；窄窗 `toSide` 侧组聚焦拦截并轻提示；
    `GettingStartedIndexList` 保持早退 `itemCount`。针对性单测 28 项全绿通过。
  - **r12（Preferences 设置编辑器与小部件）**：`ListSettingWidget`、`ObjectSettingDropdownWidget`、
    `ObjectSettingCheckboxWidget` 在策略与只读下禁用改序/添加/编辑；Renderers 向下透传只读；
    AI 搜索开关按状态机保持显示稳定。针对性单测 15 项全绿通过。
  - 经 merge 槽（08cb8a490b5）集成编译（0 errors）与合并单测（39 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 视觉与交互修复（r01/r02/r04/r05/r06/r08 并行波次合入）**：
  - **r01 & r02（标题栏/状态栏/横幅）**：标题栏读屏跟随当前会话名，状态栏空文本进度恢复默认显示，横幅同 id 重新显示时正确重建 DOM 并绑事件。
  - **r08（Sessions 紧凑桌面/抽屉）**：修复抽屉 z-index 与顶部导航条定位、抽屉折叠零槽（0 宽度）、折叠态侧边栏隐藏重定向至抽屉折叠。
  - **r06（Views 视图与树控件）**：空树消息隐藏与清除（正确销毁 Markdown DisposableStore 并清空缓存值）、欢迎区无内容焦点安全转移至容器、常量视图按 id 匹配折叠。
  - **r04（Editor Part 编辑器区域）**：分类条布局原点（top + reserved 统一高度防重复扣减）、终端空态键位与点击命令保持一致（含 sequence 防异步竞态、断开即时重绘与销毁保护）、并排视图尺寸约束随水平/垂直方向动态按主/交叉轴计算并在配置变更时触发事件。
  - **r05（Notifications 通知与弹窗）**：窄窗展开依据实际容器宽度动态测高、消息变长动态补充展开动作（流式防抖保焦点）、无障碍视图拷贝保护原动作引用与 keepOpen、右上铃铛根据注意力与免打扰四态上下文键驱动、列表空白处双击安全容错。
  - 所有模块均通过 worktree 分槽并行开发（Slot A / Slot B）、Grok CLI 审查通过、独立单测全绿，已安全合入 loop/merge 并快进至 agent-ide（提交 1d1c20a329b）。
- **打开文件**：资源管理器单击默认新开固定标签；Sources 单击和 Enter 默认替换当前标签。右键只留另一种。Preview 标签条有 `+`。Sources Files 是完整资源管理器树，不再是只读投影。从 Sources 打开或新建文件不带动资源管理器定位。
- **对话阅读面**：用户回合不显示 You，助手默认不显示 Agent；非 default 代理名在首行 11px。用户气泡无描边、无投影，焦点是 1px focusBorder，高对比仍用 contrastBorder。读屏名仍在文章 aria-label。轨迹角色词保留，不再全大写。Inspector 区段标题 12px、600，状态徽标淡底。不升 PRD-028。
- **一拖二**：宿主按发起 lease 裁剪 `localPendingSends`，baseline 补齐 attribution；已决 permission 不再和待决座位叠成两次点击。
- **合入的 4 个提交**：浏览器单测模块加载失败改为非 0 退出；`ResolveTurn` / `ResolveAnchor` / `PtyStream` / `WatchConfig` 改 proto bytes；渲染进程跳过只能在 Node 加载的会话令牌测试；选择器把 `id` 放在 `class` 前。
- **D24**：仍开。`Connect`、`WatchConfig`、`ResolveTurn`、`ResolveAnchor`、`PtyStream` 已是 proto bytes。仍走 JSON 的只有 `SaveSkillContent`（本仓 JSON 客户端已挂；引擎 proto 方法仍缺）。对照引擎 proto 确认后按 [cross-repo-protocol](../plans/cross-repo-protocol.md) §3.1–§3.2 提需求。本仓不发明字段号，不改引擎仓。这次还没开 issue。
- **十六路审查**：hold 切片已有对应提交在 `7cf1474419e`。方案 frontmatter 仍 `accepted`，不升 `implemented`。
- **PRD-008**：仍 `blocked`。`d8-evidence/7cf1474419e` 为 PARTIAL：回环曾显示 `Engine · Loopback`（不算通过）；Direct Address 停在 `Waiting for pairing`，主进程配对框未出现。
- **PRD-028 密度**：Sessions roster、轨迹表、Engine 首选项导航都是 22px 单行。轨迹表类型列是图标加正常大小写。阅读面不再显示 You / Agent，用户气泡无描边无投影。Composer 卡片是 8px、不投影，发送钮 24px。图示浮层与子代理浮层不再模糊。其余验收未齐。本条不升 `implemented`。
- **槽 F**：轨迹 Overview 从形状加文字方块改成 12px 分段条。点击定位不变。不升 PRD-028。
- **槽 E**：Sessions Changes 在 `pairingPending` 时卸掉标题栏写钮，并在确认前拦住 `invokeChangesetOperation`。文件列表仍可留着。不升 PRD-007 / PRD-008。
- **槽 G**：Fix CI、处理评论、提交反馈在会话聊天不存在时弹出错误，不再只写日志后把按钮恢复成无事发生。Changes 菜单的 Fix Checks 同一句。不升 PRD。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | 已合入自动化重读、定制树分组、账号 Loading、评审解析、策略遮罩、浏览器认领、空 GitHub 树、加载前卸文件夹。C 仅脏 `dev/loop` gitlink，不入库，不 `checkout -B`。 |
| **2026-10-06** | `efa6bdefcb8` 已快进到 `agent-ide`。在 `60d3f146086` 之上合入 r15-4 断点条件输入扣 Mode 容器宽度。merge 槽 `npm run compile` 0 errors。未 push。A/H 对齐。B 留有未跟踪 `tmp/`。C/D/E/F/G/I/J 未动。 |
## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 不因 `SaveSkillContent` 再切刀。不得宣称 leftover / pills 完成。打开身份 S1–S4 已落，方案仍 accepted，见 [D944](deferred-gaps.md) |
| **十六路审查** | 2026-09-30 切片已落，方案仍 [accepted](../plans/review-2026-09-30.md)，不升 implemented。2026-10-06 行为与视觉方案仍 [draft](../plans/review-2026-10-06.md)，未实施 |
| **PRD-008** | `d8-evidence/7cf1474419e` PARTIAL。下次要先让主进程配对框出现并点 Verified on Engine。全 PASS 之前不升档 |
| **Sources** | [sources-architecture](../plans/sources-architecture.md) P6/P7 已落，方案仍 accepted。Accept hunk S1 已落，不升 PRD-009 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI。本仓不发明、不实现外仓 RPC，不改引擎仓。对照引擎 proto 确认没有该方法、或只能靠发明字段号才能改 bytes 之后，按 [cross-repo-protocol](../plans/cross-repo-protocol.md) §3.1–§3.2 提需求。§3.4 只报已有面的 bug。
