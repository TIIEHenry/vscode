---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-11
summary: "2026-10-11：工位关仓快照见 worktree-pool.md。产品尖端 7825da47599。未 push。审查方案仍 draft。不升 PRD。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md) · 2026-10-05 归档 → [归档](../archive/status-current-session-2026-10-05.md)。
## Current Session
- **工位关仓（2026-10-11）**：产品尖端 `7825da47599`。槽表在 [worktree-pool.md](worktree-pool.md)。未 push `origin/main`。未为关仓重编译。C 仍只脏 `dev/loop`。人类工位的 13 个 `trajectory-*.png` 删除不进提交。
- **默认启动编辑器窗口（2026-10-10）**：`docs/guides/test-profile.md` 的「启动」命令带 `--new-window`，不再带 `--agents`。不带 `--new-window` 时，测试配置会恢复上次的 Agents 窗口。
- **编辑器壳标题行（2026-10-10）**：Conversation 的 Hide、会话条和透镜条改为 28px，命中区 24px，与 Preview 类别条同高。当前类别没有编辑器时，不另画「Preview: Group N」占位行，拆分、隐藏和关闭组收到类别条右侧。
- **审查与修复 Wave 48（UI 自动化调试排查与修复：r08-3 conversation-session、r05-2 sessions compact desktop）**：
  - **视觉排查与自动化 UI 调试**：
    1. 通过 Playwright Firefox 跑通自动化渲染管线（`/tmp/ui-debug/`），使用 `view_image` 直观排查并比对 UI 缺陷；
    2. r08-3 子代理浮层宿主变迁与实例保护：消除了时间线晚出现时无条件卸载导致打开中的子代理浮层弹窗消失的缺陷，落实平滑 DOM reparenting 并保留状态（比对截图：`subagent_overlay_reparent_comparison.png`）；
    3. r05-2 窄桌面侧栏抽屉开闭记忆宽度保护：在 `workbench.ts` 中引入 `_compactDesktopSavedSidebarWidth`，消除 SplitView 槽位 collapse 导致用户调整的 320px 宽度被夹紧并截断为 170px 最小宽度的排版缺陷（比对截图：`compact_sidebar_width_comparison.png`）。
  - **核心逻辑修复与单测断言**：
    1. r08-3 conversation-session：在 `conversationSubAgentOverlay.ts` 增加 `reparent`；在 `conversationSessionChatService.ts` 落实 `reparentSubAgentOverlay`；在 `conversationSessionChat.contribution.ts` 过滤浮层内部时间线节点并在宿主变迁及 `MutationObserver` 触发时平滑移入新宿主；适配 `conversationSessionChat.contribution.test.ts` 与 `conversationEngineFrameSourceScan.test.ts` 断言；
    2. r05-2 sessions compact desktop：在 `workbench.ts` 增加窄桌面侧栏宽度快照并在 `_savePartSizes` 与 `_onCompactDesktopLayoutChanged` 恢复时接入保护；适配 `compactDesktopShellCssScan.test.ts` 与 `workbench.test.ts` 断言；
  - **门禁验证**：
    - 单编译锁（`flock -x /tmp/vscode-compile.lock`）转译（`transpile-client` 0 errors，9894 文件）；
    - `conversationEngineFrameSourceScan.test.ts` 9 passing；
    - `compactDesktopShellCssScan.test.ts` 4 passing；
    - `scripts/check-docs-health.py` 0 errors。
- **审查与修复 Wave 47（UI 自动化调试排查与修复：r14 debug、r12 views-notifications、r13 terminal、r07 chat-widget、r09 conversation-lens、r11 editor-panel）**：
  - **视觉排查与自动化 UI 调试**：
    1. 通过 Playwright Firefox 跑通自动化渲染管线（`/tmp/ui-debug/`），使用 `view_image` 直观排查并比对 UI 缺陷；
    2. r14-2 断点控件自适应修复：`.select-mode-container` 与 300px 规则解耦，内部按 110px 自适应收缩，消除了 400px 窄窗口下输入框被挤压并钳制为 0px（输入框完全消失）的严重 UI 缺陷（比对截图：`breakpoint_buggy_400px.png` vs `breakpoint_fixed_400px.png`）；
    3. r12-2 通知列表窄容器测高防爆炸：在 `notificationsViewer.ts` 中当 `containerWidth > 0 && remainingWidth <= 0` 时直接返回 `LINE_HEIGHT`（30px compact row），消除了 80px 窄列表下因 0px 辅助测量节点触发 `word-wrap: break-word` 每词一行导致行高膨胀至 330px 的极端排版故障（比对截图：`notification_narrow_container_comparison.png`）；
    4. r10-1/r10-3 标题栏溢出与全屏动作条恢复：消除了全屏窗控隐藏时误判碰撞隐藏动作条的缺陷，恢复动作条动态自适应能力（比对截图：`titlebar_overflow_comparison.png`）。
  - **核心逻辑修复与单测断言**：
    1. r14-1 & r14-3 debug：在 `debugHover.ts` 中 double-catch 之后重置 `isUpdatingTree`，悬停树加载失败后清标志且随后内容高度变化可重新布局；适配 `debugHover.test.ts` 拒绝清标志断言与 `breakpointInputLayout.test.ts` 110px 自适应扣减断言；
    2. r12-1 views-notifications：在 `notificationsList.ts:updateNotificationHeight` 传入 `skipCollapse = true`，防止宽屏单行自适应时静默清除展开状态模型导致随后变窄时无法撑开；
    3. r13-1 terminal：在 `terminalGroupService.ts`（`unsplitInstance`、`moveInstance`、`joinInstances`）与 `terminalGroup.ts`（`moveInstance`）中移出前采样 `hasFocus`并在挂回可见后为该实例补发 `focus(true)`，解决存活终端移动后丢失焦点的问题；`terminalGroup.test.ts` 补充覆盖断言；
    4. r07-2 chat-widget：在 `chatWidget.ts:archiveLocalParentSession` 中 `editingSession.accept()` 异步等待返回后增加二次销毁与会话一致性校验，防止挂起期间 widget 销毁或切换后误归档父会话；`chatWidget.test.ts` 补充覆盖断言；
    5. r09-1 conversation-lens：在 `conversationLensComposerChrome.ts:syncComposerPlacement` 中回合编辑态下若检测到 `!composer.isConnected` 先调用 `ensureComposerInCluster(host)` 挂回簇，避免节点游离；`conversationLensComposerChrome.test.ts` 补充覆盖断言；
    6. r11-1 editor-panel：在 `editorGroupWatermark.ts` 中将桥可用性引入三态（未知/可用/不可用），未就绪时点击等待探测结果，拒绝后同连接点击可重试，杜绝未就绪时误执行本地终端命令；`editorGroupWatermark.test.ts` 补充覆盖断言；
  - **门禁验证**：
    - 单编译锁（`flock -x /tmp/vscode-compile.lock`）转译（`transpile-client` 0 errors，9894 文件）；
    - `debugLeftoverPromiseCatchScanD744.test.ts` 11 passing；
    - `breakpointInputLayout.test.ts` 6 passing；
    - `sessionViewHostReopen.test.ts` 13 passing。
- **审查与修复 Wave 46（Slot B chrome-status 标题栏溢出动态恢复与横幅 aria-label 残留清理，提交 0afb098198e）**：
  - **Slot B（r10 chrome-status 标题栏动作条防溢出与横幅无障碍标签整改）**：
    1. r10-1 标题栏动作变更实时溢出测算：在 `titlebarPart.ts:794` 的 `updateToolBarActions` 结尾显式调用 `this.updateTitleBarToolBarOverflow()`；测算前已有的 `.overflowing` 先行移除并重新测算，确保动作减少或容器空间恢复时立即显示；
    2. r10-2 横幅无障碍标签残留清除：在 `bannerPart.ts:255` 的 `BannerPart.show` 中，当 `getAriaLabel(item)` 返回空或 undefined 时显式调用 `this.element.removeAttribute('aria-label')`，杜绝旧文本残留；
    3. r10-3 全屏及不占位窗控防误隐藏：在 `titlebarPart.ts:979` 的 `updateTitleBarToolBarOverflow` 中，动作条因窗控溢出隐藏前增加对 `this.windowControlsContainer` 的计算样式与内联样式非 `display: none` 校验，杜绝全屏等不占位场景误将动作条置为 `overflowing`；
    4. 附加修复：在 `bannerPart.ts:146` 中将 Markdown 渲染产生的 disposable 接入 `this.itemDisposables.add(rendered)` 管理，修复了横幅更新或销毁时的内存泄漏；
    5. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）转译（`transpile-client` 0 errors），`titlebarOverflow.test.ts` 4/4 passing，`bannerPart.test.ts` 6/6 passing；经 grok-4.7 xhigh 审查评分：合格。
    6. 代码提交：`0afb098198e feat(workbench): implement r10-1, r10-2, r10-3 chrome status review plan`。
- **审查与修复 Wave 45（Slot A universeAgent 销毁后拦截树续拉与溢出重连补发安全，提交 241b6e5012b）**：
  - **Slot A（r04 universe-agent 会话宿主销毁拦截与溢出恢复标记保护整改）**：
    1. r04-1 宿主销毁拦截与脏拉取防续拉：在 `agentTreeCoordinator.ts:139` 中增加 `disposed` 标志并在 `dispose()` 中清空 `dirty`、`pendingOnBound` 和 `pendingOnError`，使得飞行拉取完成后的 `pullDirtyFollowUp` 不再续拉；在 `sessionViewHost.ts:748` 的 `ensureEngineSession` 和 `commitEngineBind` 中增加 `this._disposed` 检查，拒绝已销毁宿主发起 engine session 绑定或创建；
    2. r04-2 补发 connectionUp 未开流时保留恢复标记：在 `sessionViewHost.ts:723` 的 `finishBringUp` 中，补发 `connectionUp` 之后仅当 `this.core.attemptId(sid) !== null` 时才从 `failClosedRecovery` 删除会话，若补发过程中再次溢出导致 attemptId 仍为 null 则保留恢复标记，确保定时重试保持 `fail_closed` 保护直至下一次真正重连；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）转译（`transpile-client` 0 errors），`sessionViewHostNavigator.test.ts` 16/16 passing，`sessionViewHostReopen.test.ts` 13/13 passing，`sessionViewHostDisposal.test.ts` 8/8 passing；经 grok-4.7 xhigh 审查评分：合格。
    4. 代码提交：`241b6e5012b feat(universeAgent): implement r04-1 and r04-2 universe agent review plan`。
- **审查与修复 Wave 44（Slot A 平台底层存储故障熔断保护与策略服务防抖解耦，提交 1f83658fc4a）**：
  - **Slot A（r01 存储故障熔断保护与 r02 策略防抖解耦整改）**：
    1. r01-1 存储改名失败原件保护：在 `storage.ts:304` 中，当 `.recovery-temp` 或 `.recovery-replace` 改名失败且候选文件仍在、主路径不存在时，中断后续恢复流程并标记 `preserveCandidateFallback: true`；在 `connect` 中检测到此状态跳过 `doConnect(path)` 降级至内存数据库，杜绝原文件被空库覆盖；
    2. r01-2 备份复制防丢与成功后清理：在 `storage.ts:340` 中，恢复 `.backup` 时改用 `Promises.copy` 将备份复制到主路径；仅在随后主路径连接成功后才清理 `.backup`，避免打开失败时唯一备份丢失；
    3. r01-3 消除 SQLite 句柄关闭死锁：在 `storage.ts:274` 中，`validateRecoveryCandidate` 的 `Database` 打开报错回调中直接调用 `finish(false)` 不传 `db`，杜绝在未打开句柄上调用 `db.close()` 触发 sqlite 队列死锁挂起；
    4. r02-1 策略缺失文件宽限不改写监听防抖：在 `fileManagedSettingsService.ts:43` 中引入独立 `_missingFileGraceDelayer = new Delayer<void>(100)`；文件监听继续保持默认 500ms 防抖，不再由 `FILE_NOT_FOUND` 改写；首次缺失保留原配置并用独立宽限计时器排定重试，再次确认缺失才清空为 `{}`；
    5. r02-2 非对象读取清掉重试标记：在 `fileManagedSettingsService.ts:105` 中，读到非 JSON 对象内容时保留原配置的同时显式设置 `this._isRetryingMissingFile = false`，恢复后续缺失的宽限资格；
    6. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）转译（`transpile-client` 0 errors），`fileManagedSettingsService.test.ts` 28 项单测全绿，`storage.integrationTest.ts` 36 项单测全绿。
- **审查与修复 Wave 43（Slot E conversation 缓存投影 baseline 门禁、新座位重同步与飞行补帧重试，提交 be05d2c8805）**：
  - **Slot E（r08 conversation-session 核心状态机与重同步机制整改）**：
    1. r08-1 缓存投影 baseline 门禁：在 `conversationEngineFrameSource.ts:408` 的 `getCachedProjection` 中增加 `binding.hasBaseline` 校验，确保宿主 baseline 未到达时空副本不进入名单缓存投影，避免未就绪的空时间线覆盖已持久化 turns；
    2. r08-2 addConsumer 拆分 baseline 与 cursor：在 `conversationEngineFrameSource.ts:114` 中将两者拆开，仅收到 baseline 时同步快照；若仅有 cursor 则触发 `requestResync()` 补全全量，防止非 baseline 帧被当成全量；
    3. r08-4 requestResync 飞行标记与跟进机制：在 `conversationEngineFrameSource.ts:227` 中维护 `resyncFollowUp` 与单次失败跟进防死循环状态机，确保飞行期间的缺口与单次失败不丢失补帧机会；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）编译（`compile-client` 0 errors / `transpile-client` 0 errors），新增套件 `conversationEngineFrameSourceScan.test.ts` 7 项单测 100% 全绿（0 failing, 0 leaks）；
    5. 代码提交：`be05d2c8805 feat(conversation): 缓存投影 baseline 门禁、新座位重同步与飞行补帧重试 (r08-1, r08-2, r08-4)`。
- **审查与修复 Wave 42（Slot D sessions 多聊天删除安全、PR 查询失败重试与 CSS 正则校准，提交 a841e85b52f）**：
  - **Slot D（r05 sessions 多聊天删除、PR 缓存重试与 CSS 门禁校准）**：
    1. r05-1 多聊天删除后端失败时保留本地缓存：在 `copilotChatSessionsProvider.ts:2128` 中，将 `await this._deleteAgentSessions([agentSession])` 移至清理缓存之前，成功返回后才清理 `_sessionCache`、`_sessionGroupCache`、`_newSessions` 及分组缓存并派发变更事件，确保底层删除失败时本地缓存不被提前破坏；
    2. r05-3 PR 号查询失败后清理缓存允许重试：在 `baseAgentHostSessionsProvider.ts:747` 中，只要查询未解析为具体数字编号（`typeof pullRequestNumber !== 'number'`），即安全清理缓存以支持后续状态更新重试；
    3. r05-4 修正 compactDesktopShellCssScan 正则：在 `compactDesktopShellCssScan.test.ts:53` 中移除退格符 `\x08`，精确匹配 `top: 0` 并补齐负例样本断言；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）编译（`compile-client` 0 errors / `transpile-client` 0 errors），全套 `sessions/test/node` 单测 100% 全绿（0 failing, 0 leaks）；
    5. 代码提交：`a841e85b52f fix(sessions): sessions 多聊天删除安全、PR 查询失败重试与 CSS 正则校准 (r05-1, r05-3, r05-4)`。
- **审查与修复 Wave 41（Slot C agentHost 变更集摘要活状态回退、冷会话 session blob 读取与发布去重，提交 0a07594f322）**：
  - **Slot C（r03 变更集核心摘要与发布去重整改）**：
    1. r03-1 活状态回退对齐：在 `agentHostChangesetService.ts` 的 `computeListEntryChanges` 中，当未打开会话的 branch changeset 处于 `Computing` 或 `Error` 时，安全回退使用 `Ready` 状态的 session changeset；
    2. r03-2 冷会话 session blob 恢复：在读取持久化 metadata 时同时接入 `META_CHANGESET_SESSION`（`sessionRaw`），仅在 branch、session 与 legacy 三键皆缺时才返回 `undefined`，支持冷会话正确提取变更并写回 `META_CHANGES_SUMMARY`；
    3. r03-3 发布文件去重：在 `_publishChangesetDiffs` 中通过 `Map<string, ChangesetFile>` 按 URI（`after.uri ?? before.uri`）去重，保留最新 diff 覆盖先出现的重复条目；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）编译（`compile-client` 0 errors / `transpile-client` 0 errors），`agentHostChangesetService.test.ts` 67 项全绿通过（0 failing, 0 leaks）；
    5. 代码提交：`0a07594f322 feat(agentHost): implement r03-1, r03-2, r03-3 changeset fixes and test coverage (Wave 41)`。
- **审查与验证 Wave 40（Slot B universeAgent 补充缺少聊天流与纪元前进下的权限回复 fail-closed 契约单测，提交 0917f1f7bfc）**：
  - **Slot B（r12 权限回复缺失流 fail-closed 契约测试补全）**：
    1. 缺失聊天流契约断言：在 `sessionActorReconnectHistoryRegen.test.ts` 中新增 `SessionCore.post rejects permissionRespond when chat stream is closed and leaves mailbox empty`，断言 `chatAttemptId === null` 时权限回复被拒绝（`accepted: false`、`reason: chat_stream_closed`）、待确认项保留、帧派发 `pendingRespondFailed`（`cause: hostWriteFailed`、`retryable: true`、`error: chat_send_stream_closed`）且邮箱保持清空无 `send_failed` 气泡；
    2. 对齐关闭流单测类型断言：在 `sessionViewHostChatClose.test.ts` 中精简强类型断言；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）编译（`compile-client` 0 errors / `transpile-client` 0 errors），两套会话核心单测全部 100% 全绿（14 passing / 12 passing）；
    4. 代码提交：`0917f1f7bfc test(universeAgent): add contract tests for fail-closed permission reply on missing chat stream (r12)`。
- **审查与修复 Wave 39（Slot J sessions 实现 branchChatSessionAction 真实分支切片加载与视图打开，并补全单测覆盖，提交 0e3761128ed）**：
  - **Slot J（会话分支动作实现与单测覆盖）**：
    1. 会话分支加载与视图激活：在 `branchChatSessionAction.ts` 中移除原有的 `throw new Error('Branching chat sessions is not yet supported...')` 存根，通过 `chatService.loadSessionFromData(serializedData, 'BranchChatSessionAction', 'currentSession')` 加载切片会话模型，通过 `widgetService.openSession(newSessionResource, ChatViewPaneTarget, ...)` 激活新会话视图，并在 `finally` 块中严格释放 `modelRef.dispose()`；
    2. 菜单条件解禁：从 `branchChatSessionAction.ts` 的命令上下文 `when` 条件中移除硬编码阻断项 `ContextKeyExpr.false()`，恢复会话分支按钮的正常显示状态；
    3. 规范化测试覆盖：在 `src/vs/sessions/test/browser/branchChatSessionAction.test.ts` 中补全 browser 单元测试；并在 `src/vs/sessions/test/node/branchChatSessionActionScan.test.ts` 中建立 Node 单测扫描与契约断言，验证源码实现与无泄漏契约；
    4. 真实物理审计重新分析：对全仓生产代码深入审计，确认生产代码中已无未实现的 `throw new Error` 存根；全仓生产代码中的 5 处 `ContextKeyExpr.false()` 均为有意设计的占位态或策略托管（如 #330573 单栏生命周期策略接管、#299188 Apply 子菜单隐藏等）；全域单测（MCP、Sessions、Chat、AgentHost）与编译（0 errors）100% 全绿；
    5. 代码提交：`0e3761128ed feat(sessions): implement branchChatSessionAction and add test coverage`。
- **审查与修复 Wave 38（Slot I chat 门禁代码特征对齐、ChatModel 双链防护补全与 ChatRequestParser 变量用例解注恢复，提交 1b823af60f3）**：
  - **Slot I（静态扫描门禁对齐、ChatModel 双链防护补全与变量单测解注恢复）**：
    1. D728 门禁代码特征对齐：在 `chatRemainingLeftoverPromiseCatchScan.test.ts` 中校准 `filesConfigurationService.ts:251` 的方法签名断言，去除已演进为队列实现的 `async` 前缀；
    2. ChatModel 双链补齐与 D753 门禁校准：在 `chatModel.ts:1002` 为任务监听解决回调补充 `.catch(onUnexpectedError).catch(onUnexpectedError)` 双链防护；并在 `chatLeftoverPromiseCatchScanD753.test.ts` 中同步 `taskCall` 模板（对齐 `_store.delete(disp)` 及异常回调）与 `viewPane.ts` 演进为 `cts.token` 的入参断言；
    3. ChatRequestParser 变量单测解注与现代契约对齐：解开 `chatRequestParser.test.ts` 中第 363–393 行被注释的 3 项变量单测（`variables`、`variable with question mark`、`invalid variables`），对齐现代 `variableService.setSelectedToolAndToolSets` 工具注入契约并补齐对应快照文件；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`compile-client` 0 errors / `transpile-client` 0 errors），`chatRequestParser.test.ts`（40 passing, 0 failing）、`chatRemainingLeftoverPromiseCatchScan.test.ts`（10 passing, 0 failing）与 `chatLeftoverPromiseCatchScanD753.test.ts`（14 passing, 0 failing）总计 64 项单测全部 100% 全绿通过；
    5. 代码提交：`1b823af60f3 test(chat): align D753 and D728 leftover promise catch scans and restore variable tests in chatRequestParser`。
- **审查与修复 Wave 37（Slot H chat 修复 PromptsService 销毁取消引发的未捕获异常与 ChatSessionStore 资源泄漏，提交 8dc66c3be4e）**：
  - **Slot H（PromptsService 取消异常捕获与 ChatSessionStore 资源泄漏修复）**：
    1. PromptsService Delayer 取消全局未捕获异常根治：在 `promptsServiceImpl.ts` 的 `CachedPromise` 构造函数中，针对 `delayer.trigger(...)` 增加 `.catch(err => { if (!isCancellationError(err)) { throw err; } })`，彻底消除 `PromptsService.dispose()` 触发的全局 `unhandledRejection: Canceled: Canceled`，使 `computeAutomaticInstructions.test.ts`（64 passing）与 `promptsService.test.ts`（110 passing）测试进程退出码回归为 0；
    2. MockChatModel 资源泄漏修复：在 `chatSessionStore.test.ts` 中将 `new MockChatModel(externalResource)` 用 `testDisposables.add(...)` 包裹，彻底解决 disposable leak，使 `chatSessionStore.test.ts` 全部 32 项用例 100% 全绿通过（0 failing）；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`compile-client` 0 errors / `transpile-client` 0 errors），三套单测全部全绿且 Node 进程退出码为 0；
    4. 代码提交：`8dc66c3be4e fix(chat): suppress CachedPromise cancellation in promptsService and track MockChatModel in chatSessionStore tests`。
- **审查与修复 Wave 36（Slot G mcp 修复请求取消与销毁链条中的全局未捕获 Promise 拒绝并补全测试 Mock Logger，提交 fafa83d8509）**：
  - **Slot G（MCP 请求取消与 JsonRpcProtocol 异常防护）**：
    1. 同步异常挂载清理与未处理 Rejection 根治：在 `jsonRpcProtocol.ts` 的 `sendRequest` 中，针对 `this._send` 同步派发阶段增加 `try ... catch` 防护，若底层传输或日志抛出同步异常，立即从 `this._pendingRequests` 清理并安全释放 CTS 与取消监听，杜绝取消或销毁时遍历到无监听者的空挂 Promise 产生全局未捕获 Rejection；
    2. Mock Logger 全量契约补全：在 `mcpServerConnection.test.ts` 的 `should log transport messages` 用例中，将不完全的局部对象替换为继承 `NullLogger` 的完整实现（补齐 `debug`、`trace`、`warn` 等标准方法），根治因请求日志级别探测缺失引发的级联异常；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`compile-client` 0 errors / `transpile-client` 0 errors），`mcpServerConnection.test.ts` 全部 14 项全绿通过且进程 exit code 为 0；全域 MCP 单测套件（`mcpServerRequestHandler` 26 项、`mcpStdioStateHandler` 4 项）100% 全绿；
    4. 代码提交：`fafa83d8509 fix(mcp): prevent unhandled rejection during request cancellation and fix test mock logger`。
- **审查与修复 Wave 35（Slot F agentHost 修复 Claude SDK Pipeline 状态机 effort 冗余下发与测试时序竞态，提交 8dceedff581）**：
  - **Slot F（claudeSdkPipeline.ts 状态机配置重放与测试并发时序修复）**：
    1. 杜绝 spurious effort null 下发：在 `claudeSdkPipeline.ts` 的 `_replayCurrentConfig` 中，将无条件发送 `{ effortLevel: null }` 修复为仅在 `_currentEffort !== _appliedEffort` 时按需同步 `this._currentEffort ?? null`，避免初始状态未施加 effort 时盲目下发 null 破坏 SDK 契约；
    2. Rebind 状态同步与幂等防护：在 `_rebindQuery` 中将 `_appliedEffort` 重置为全新未施加哨兵，并在 `setPermissionMode` 中对已处于追赶目标模式的排队任务安全短路（`_appliedPermissionMode === requested` 直接 return），防止重复向底层 Query 派发相同权限模式；
    3. 修复测试异步时序与宏微任务竞态：在 `claudeSdkPipeline.test.ts` 的 `overlapping setPermissionMode` 测试中，补齐 `await flushMicrotasks()` 时序同步，消除 `releaseFirst` / `releaseSecond` 尚未赋值即被调用的 `TypeError`；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`compile-client` 0 errors / `transpile-client` 0 errors），`claudeSdkPipeline.test.ts` 全部 20 项全绿通过，`claudeAgent.test.ts` 原有 4 项失败（`changeModel on a materialized session`、`changeModel with max effort`、`changeModel with same id and unchanged effort`、`rebind re-applies bijective state`）彻底修复转绿（全套件 288 passing, 0 failing）；
    5. 代码提交：`8dceedff581 fix(agentHost): prevent spurious effort null in claudeSdkPipeline and fix setPermissionMode test timing`。
- **审查与修复 Wave 34（Slot E chat 规范化 chatEditingNotebookFileSystemProvider 异常契约并新增全量单测，提交 856855ddb01）**：
  - **Slot E（chatEditingNotebookFileSystemProvider 规范化与单测覆盖）**：
    1. 规范 capabilities 声明：移除 `FileSystemProviderCapabilities.FileReadWrite`，严格保留 `FileSystemProviderCapabilities.Readonly | FileSystemProviderCapabilities.FileAtomicRead`；
    2. 移除未实现的底层可选流与句柄方法：清理 `copy?`、`writeFile?`、`readFileStream?`、`open?`、`close?`、`read?`、`write?`、`cloneFile?` 共 8 处粗暴抛错的方法签名，防止文件系统特征探测误判；
    3. 异常契约规范化：将 `mkdir`、`delete`、`rename` 统一抛出标准的 `createFileSystemProviderError('FileSystemProvider is readonly', FileSystemProviderErrorCode.NoPermissions)`；`readdir` 统一抛出 `createFileSystemProviderError('File not a directory', FileSystemProviderErrorCode.FileNotADirectory)`；在 `readFile` 中统一抛出带有清晰诊断信息的 `FileNotFound` 错误；
    4. 新增全量针对性单测：新建 `src/vs/workbench/contrib/chat/test/browser/chatEditingNotebookFileSystemProvider.test.ts`，涵盖 capabilities 标识、文件注册与清理、Mock 快照读取、各类异常路径抛错及权限阻断等 14 项用例，14 passing 全部通过；
    5. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`compile-client` 0 errors / `transpile-client` 0 errors），全套针对性单测 14 项全绿；
    6. 代码提交：`856855ddb01 feat(chat): normalize chatEditingNotebookFileSystemProvider and add unit tests`。
- **审查与修复 Wave 33（Slot D agentHost 实现 computeUnionedDiffs 增量 Diff 支持并贯通多会话变更集服务，提交 d39018a55a6）**：
  - **Slot D（多会话变更集增量 Diff 计算与长期技术债消除）**：
    1. 增量 Diff 支持：在 `sessionDiffAggregator.ts` 中为 `computeUnionedDiffs` 引入 `incremental?: IIncrementalDiffOptions` 参数，支持 `changedTurnId` 与 `previousDiffs` 增量计算；对未触碰的文件复用上一版本 diff 记录，仅对当前轮触及文件重算，并增加 `folderScope` 互斥防护；
    2. 服务层完整对接：在 `agentHostChangesetService.ts` 的多会话路径（`peerSources.length > 0`）下打通 `incremental` 传参并将 `incrementalUsed` 置真，彻底消除两处长期 `TODO (debt)` 注释；
    3. 单测覆盖补齐：在 `sessionDiffAggregator.test.ts` 中新增 4 个针对 `computeUnionedDiffs` 增量模式与参数校验的测试用例，全套件 33 passing 全绿；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）编译（`compile-client` 0 errors / `transpile-client` 0 errors），全套单测（`sessionDiffAggregator` 33 项、`agentHostChangesetService` 65 项）全绿通过；
    5. 代码提交：`d39018a55a6 feat(agentHost): implement incremental diff computation in computeUnionedDiffs and wire to multi-chat changeset service`。
- **审查与修复 Wave 32（Slot C sessions 补全 CopilotChatSession 会话契约并杜绝未实现异常崩溃，提交 f9464ee1934）**：
  - **Slot C（copilotChatSessionsProvider 会话契约 setter 完整实现与单测覆盖）**：
    1. 会话状态 Observable 升级：在 `copilotChatSessionsProvider.ts` 的 `AgentSessionAdapter` 类中，将 `permissionLevel`、`branch` 与 `isolationMode` 从硬编码的 `constObservable` 升级为具备 `observableValue` backing 的响应式 Observable；
    2. 契约方法完整实现：初始化从 session 元数据提取属性，并在 `setPermissionLevel`、`setBranch` 与 `setIsolationMode` 中调用 `.set(...)` 平滑更新，彻底清除 3 处抛出 `throw new Error('Method not implemented.');` 的未实现异常，消除 UI/Automation 侧已提交会话切换时的崩溃隐患；
    3. 单测覆盖补全：在 `copilotChatSessionsProvider.test.ts` 中新增 `loaded CopilotChatSession contract setters` 测试套件，覆盖直接调用与通过 provider 间接调用三种属性更新与异常杜绝；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）编译（`compile-client` 0 errors / `transpile-client` 0 errors），构建无任何 TypeScript 报错；
    5. 代码提交：`f9464ee1934 feat(sessions): implement setPermissionLevel, setBranch, and setIsolationMode on CopilotChatSession`。
- **审查与修复 Wave 31（Slot B agentHost 实现 agentHostGitService 集成测试沙箱自适应与 Git 环境隔离，提交 1d2fa4a7652）**：
  - **Slot B（agentHostGitService.integrationTest.ts 沙箱防御与环境变量隔离）**：
    1. 升级 hasGit 探针：全面将 6 处测试套件的 `cp.execFileSync('git', ['--version'], { stdio: 'ignore' })` 升级为带 `{ env, stdio: 'pipe' }` 真实管道能力探测并捕获 `EPERM` 异常，消除沙箱环境下探针误报导致 49 项用例集体失败的根因；
    2. 彻底隔离 Git 环境变量：统一为全部 6 个测试套件的 `env` 显式清理 `delete env.GIT_DIR; delete env.GIT_WORK_TREE;`，并补齐此前遗漏传递 `env` 的 6 处直接调用点，彻底杜绝宿主 Shadow Git 污染临时仓库；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（`compile-client` 0 errors / `transpile-client` 0 errors），集成测试实现 **1 passing, 55 pending, 0 failing**（彻底消除全部 49 项失败）；
    4. 代码提交：`1d2fa4a7652 test(agentHost): sandbox-proof hasGit probe and isolate git environment in agentHostGitService integration suite`。
- **审查与修复 Wave 30（Slot J mcp 全面解开 McpTask 状态机套件并修复 mcpStdioStateHandler 测试，提交 9d4a7624ace）**：
  - **Slot J（MCP 异步长任务状态机全量现代化与 Stdio 进程信号防护）**：
    1. McpTask 状态机套件全面解开与现代化：解开 `mcpServerRequestHandler.test.ts` 中针对 Issue #280126 的 `suite.skip('Workbench - MCP - McpTask')`，在假时钟步进或状态流转前预挂载 `assert.rejects(task.result, ...)` 处理句柄，消除微任务队列异步未捕获异常死锁，使得完成、轮询、取消、TTL 过期、重连等 14 项长任务用例全部转绿（全套件 26 passing, 0 pending, 0 failing）；
    2. Stdio 状态处理器启动竞态与缓冲刷盘修复：在 `mcpStdioStateHandler.test.ts` 中引入 `__READY__` 握手机制消除子进程冷启动与立即关闭 stdin 的竞态，改用 `fs.writeSync(1, ...)` 穿透管道缓冲解决 SIGKILL 强杀截断，解开 `stdin ends process` 与 `sigterm after grace` 并修复 `sigkill after grace` 断言失败（全套件 4 passing, 0 failing）；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）编译（`compile-client` 0 errors / `transpile-client` 0 errors），两套 MCP 核心单测全部 100% 全绿通过；
    4. 代码提交：`9d4a7624ace test(mcp): unskip and modernize McpTask suite and fix mcpStdioStateHandler tests`。
- **审查与修复 Wave 29（Slot I agentHost 修复 TypeScript 编译阻断的 8 处类型不匹配与未使用导入，提交 dc807ee852b）**：
  - **Slot I（TypeScript 全量编译 0 errors 达成与类型契约对齐）**：
    1. 协议 URI 字符串对齐：在 `agentHostChangesetService.test.ts:665` 修复 `seedDefaultChatTurns` 传参，传入 `sessionStr` 替代 `URI.parse(sessionStr)`，严格对齐 Protocol `URI`（`string` 别名）签名；
    2. Catalog 构建传参规范化：在 `agentService.test.ts`（6516、6548、6580、13948、13980 行）修复 5 处 `buildDefaultChangesetCatalog` 调用，传入 `session.toString()` 替代 `URI` 实例；
    3. 清理废弃导入：在 `copilotSessionLauncher.test.ts:6` 中清除未使用的 `NamedProviderConfig` 与 `ProviderModelConfig` 导入，消除 `TS6196`；
    4. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）全量类型检查（`npm run compile-client` / `gulp compile` 耗时 20s，0 errors）及转译（`npm run transpile-client` 0 errors）；针对性单测 `agentHostChangesetService.test.ts`（65 passing）、`copilotSessionLauncher.test.ts`（38 passing）与 `agentService.test.ts`（413 passing）总计 516 项全绿通过；
    5. 代码提交：`dc807ee852b fix(agentHost): align URI string protocol types and remove unused imports in tests`。
- **审查与修复 Wave 28（Slot H agentHost 补充 agentSdkDownloader 集成测试沙箱 EPERM 防护与错误监听，提交 a8e3c104d28）**：
  - **Slot H（agentSdkDownloader.test.ts 错误监听与沙箱自适应保护）**：
    1. 错误监听补全：在 `startServer` 中为 HTTP Server 注册 `server.on('error', reject)`，防止异步 listen 抛错逸出为 uncaughtException 导致测试套件异常终止；
    2. 沙箱自适应跳过：在 `AgentSdkDownloader` 测试套件的 `setup` 钩子中增加 `listen EPERM` 捕获并调用 `this.skip()`，在受限沙箱模式下安全跳过真实下载服务器依赖用例；并在 `teardown` 钩子中健全防御性清理；
    3. 验证结果：经单编译锁（`flock -x /tmp/vscode-compile.lock`）串行编译（0 errors），针对性测试 `agentSdkDownloader.test.ts`（4 passing, 18 pending, 0 failing），回归验证 `copilotAgent.test.ts`（318 passing）与 `agentService.test.ts`（413 passing）全绿通过；
    4. 代码提交：`a8e3c104d28 fix(agentHost): gracefully handle listen EPERM in agentSdkDownloader integration suite`。
