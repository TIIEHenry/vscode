---
title: "方案 r06：sessions"
type: plan
status: draft
phase: N/A
updated: 2026-10-26
summary: "hold 3，drop 0，weaken 1。r06-4 已按 D1313 落地：删会话时一个终端关失败留下跟踪并继续关其余。r06-2 / r06-3 不在该刀。方案仍 draft。"
---

hold 3，drop 0，weaken 1。

## r06-1（weaken，降为低）

### 问题类
`SessionConfigChanged` 被拒绝时，乐观写入的运行中配置不会收回。审批选择器那条只写 `AutoApprove` 的请求，经 `forbidden` 检查不会被拒。异步派发在 `restoreSession` 等抛错时仍可能对任意 `SessionConfigChanged` 走 `rejectClientAction`。旧稿把「宿主不会拒绝 AutoApprove」说成整条机制不可达，说过头；去掉 `replaceSessionConfig` 里的 `AgentMergeController` 也不是发现稿要修的回滚。

### 不变量
选择器读到的 `AutoApprove` 等于宿主已经接受的会话配置。带 `rejectionReason` 的 `SessionConfigChanged` 不得留在 `_runningSessionConfigs`，随后的 `resolveSessionConfig` 也不得把这次被拒绝的值写回去。

### 要动的符号或文件
`BaseAgentHostSessionsProvider.replaceSessionConfig`（`baseAgentHostSessionsProvider.ts` 约 3748–3778 行）：派发的 `config` 去掉 `SessionConfigKey.AgentMergeController`。运行配置里已经有这个键时，现在会把它抄进 `replace: true` 的 payload；宿主在 `AgentService._dispatchActionNow`（`agentService.ts` 约 4631–4636 行）见到该键就整单拒绝，根本走不到 `_withPreservedHostWrittenSessionConfig`。

回滚先不要写。`IAgentConnection.dispatch` 返回 `void`，拒绝回执只带 `origin.clientSeq`，调用方拿不到自己发出的序号，不能把回执对上派发前的快照。整份快照盖回去还会冲掉期间到达的宿主回写。remembered 撤不撤回也没拍板。在有关联手段之前，不改 `_attachConnectionListeners` 的拒绝分支，也不改 `_resolveRunningSessionConfig`。

### 明确不改
`AgentHostPermissionPickerDelegate.setPermissionLevel` 继续只调用 `setSessionConfigValue(..., SessionConfigKey.AutoApprove, level)`（`agentHostPermissionPickerDelegate.ts` 184–185 行）。`sessionReducer` 对 `SessionConfigChanged` 的合并、`HOST_WRITTEN_SESSION_CONFIG_KEYS` 只含 `AgentMergeController`、以及字符串 remembered 写入都保持。`AutoApprove` 是字符串，会被记住；宿主接受这次写入，remembered 与宿主一致，不撤回。

### 本地验证
反证：`rejects client writes to host-owned Agent Merge controller state`（`src/vs/platform/agentHost/test/node/agentService.test.ts`）只在 payload 含 `AgentMergeController` 时带 `rejectionReason`。`preserves host-owned Agent Merge controller state across a client config replacement` 证明省略该键的 `replace: true` 会被接受，且宿主自己保留控制器状态。`accepts client writes to the client-owned Agent Merge enablement value` 证明不含该键的 `SessionConfigChanged` 没有 `rejectionReason`。选择器派发的是 `{ [AutoApprove]: level }`（`setSessionConfigValue` 约 3720 行），不包含控制器键。`UNSUPPORTED_CLIENT_ACTION_TYPES`（`protocolServerHandler.ts` 79–82 行）只有两条工作目录动作，没有 `SessionConfigChanged`。`sessionReducer`（`channels-session/reducer.ts` 214–224 行）在已有 `state.config` 时合并该值。因此「把正在运行的会话从自动执行改成需要确认，宿主拒绝后选择器仍显示新级别、会话继续按更高权限跑」这条不成立。

应新增：运行配置里已有 `AgentMergeController` 时，`replaceSessionConfig` 派发出去的 `config` 不含该键，宿主接受其余键（含 `AutoApprove`）。若回执仍带 `rejectionReason`，`_runningSessionConfigs` 回到派发前，对应序号的 `_resolveRunningSessionConfig` 不再覆盖缓存。

## r06-2（hold，中）

### 问题类
重开窗口时，活动槽第一次等满 30 秒仍未出现，补放循环会跳过它。

### 不变量
持久化网格里每个带 `resource` 的槽，第一次 `RESTORE_SESSION_WAIT_TIMEOUT` 没等到时，再按同一超时走一次 `_waitForSession`，并用 `place` 放回原来的下标。

### 要动的符号或文件
`SessionsService._restoreVisibleSessions`（`sessionsService.ts`）。第一次等待仍在约 1559–1563 行，`RESTORE_SESSION_WAIT_TIMEOUT` 仍是文件顶部的 `30_000`。补放循环约 1606–1614 行：`idx === activeIdx` 且 `resolved[activeIdx] === undefined`、`activeTarget.resource` 存在时，不再直接 `return`，改为与旁边槽相同的 `_waitForSession` + `place`。

### 明确不改
没有 `resource` 的空新会话槽仍立即变成 `null`，不进补放。`restoreGrid` 的一次性布局、`place` 的左右锚点、30 秒超时数值保持。活动槽在第一次等待里已经出现时，`resolved[activeIdx]` 已有值，补放仍跳过。

### 本地验证
现有 `restoreVisibleSessions waits for session to appear via onDidChangeSessions`（`src/vs/sessions/services/sessions/test/browser/sessionsManagementService.test.ts`）只覆盖活动槽在第一次等待内出现。应新增：活动资源在第一次等待内缺席、旁边槽已经在网格里，活动会话在第二次等待内出现后仍被放进原来的下标。

## r06-3（hold，中）

### 问题类
定时自动化超时后先把运行标成 `failed`，令牌要等这次 `updateRun` 结束才取消；取消会话失败则记录停在失败，代理继续跑。

### 不变量
不要把顺序改成「先取消再无条件等 `whenCompleted` 再标失败」。`_markCancelled` 在 run 仍是 running 时会自己写成 `failed` 和 “Cancelled”，随后 scheduler 的 `getActiveRunFor` 找不到这条 run，超时文案丢失。现有 `automationScheduler.test.ts` 约 442–519 行断言 `RUN_TIMEOUT_REASON_PREFIX`，假 runner 在取消回调里写 “Cancelled”；先取消再标失败会让它挂。取消后无条件 `await runOnce().whenCompleted` 会重新引入 `raceTimeout` 要避开的无界挂起。`_markCancelled` 吞掉 `cancelCurrentRequest` 的错误，scheduler 拿不到「取消失败」信号，不能写成「抛错就不标失败」。`_markCancelled` 按会话状态取消，不看 run 是否已是 failed，所以「已标失败就不会再被取消」这半句也不成立。本稿只保留：超时文案不能被取消路径的 “Cancelled” 盖掉；具体顺序要重写后再实施。

### 要动的符号或文件
`AutomationSchedulerCore.runOneWithTimeout`（`automationScheduler.ts` 约 190–223 行）：`raceTimeout` 的回调仍只记下 `timedOut`。`timedOut` 之后先 `perRunCts.cancel()`，等 `runOnce(...).whenCompleted` 结束，再 `updateRun` 为 `failed`。

`AutomationRunner._markCancelled`（`automationRunner.ts` 约 255–274 行）：`cancelCurrentRequest` 抛错时现在只打日志（约 264–266 行），然后 `getActiveRunFor` 看不到已经是 `failed` 的行（`findActiveRun`，`automationService.ts` 845–846 行只认 `pending` 和 `running`）。会话取消必须发生在失败标记之前；`findActiveRun` 的过滤保持，失败标记不能抢在取消前面，否则第二次 `updateRun` 会被跳过。

### 明确不改
`findActiveRun` 的 `pending` / `running` 条件、`raceTimeout` 的实现、未超时就返回的成功路径保持。`markStaleRunsFailed` 不负责停掉这次超时的会话。

### 本地验证
现有 `runOneWithTimeout: a hung run is cancelled, marked failed, and the next due automation still fires`（`src/vs/sessions/contrib/automations/test/browser/automationScheduler.test.ts`）断言 `cancelObserved` 和 `RUN_TIMEOUT_REASON_PREFIX`。它的假 runner 在取消回调里才用 `getActiveRunFor` 写 `Cancelled`，测不到「先标失败导致这次写入被跳过」，也没有 `cancelCurrentRequest`。现有 `getActiveRunFor returns the first pending or running run for an automation`（`automationService.test.ts`）只固定活跃行的状态过滤。

应新增：超时路径里 `cancelCurrentRequest` resolve 之后才出现 `status: 'failed'` 和超时文案；`cancelCurrentRequest` 抛错时该 run 不保持 `failed`。

## r06-4（D1313 已落地；原 hold，中）

### 问题类
删掉会话时，某个终端 `safeDisposeTerminal` 抛错会中断后面的关闭，`finally` 仍删掉整份 `_sessionTerminals`。

### 不变量
单个终端关闭失败时，该实例留在这个会话的跟踪里，循环继续关闭其余终端。已经成功关闭的才从跟踪里移除。去掉 `.finally(delete)` 时，必须另写被 `continue` 跳过的活动终端和已不可用终端的跟踪清理；否则它们会挂在死会话 id 下，并影响 `_isTerminalTracked`。`safeDisposeTerminal` 被用户否决时正常返回、不抛错，算成功关闭还是留下跟踪，本稿不拍板，实施前写明。

### 要动的符号或文件
`SessionsTerminalContribution` 会话删除处（`sessionsTerminalContribution.ts` 约 303–304 行）的 `.finally(() => this._sessionTerminals.delete(session.sessionId))`。

`_closeTerminalsForSession`（约 913–927 行）：`await this._terminalService.safeDisposeTerminal` 失败时不中断 `for`，也不对失败实例调用 `_removeTerminalFromTrackedSessions`。成功关闭的实例仍调用它。

### 明确不改
当前活动终端的 `continue`（约 916–918 行）保持，毕业场景仍不关掉用户正在用的终端。`_closeArchivedSessionTerminals` 不在本条。`safeDisposeTerminal` 的确认关闭逻辑不改。

### 本地验证
现有 `does not leak unhandled rejection when disposing a removed session terminal fails`（`src/vs/sessions/contrib/terminal/test/browser/sessionsTerminalContribution.test.ts`）只断言没有 unhandled rejection。`closes terminals when a non-focused session is removed` 只覆盖成功关闭一个终端。`_closeTerminalsForSession double-catch then finally; _closeArchivedSessionTerminals double-catch (D644)`（`src/vs/sessions/contrib/terminal/test/node/sessionsTerminalContributionCatchScan.test.ts`）把「双 catch 之后 finally 删除整个 session 键」钉在源码上；改掉整表删除后，这条扫描要改成新的收尾形状。

应新增：同一会话两个非活动终端，第一个 `safeDisposeTerminal` 抛错时，第二个仍被关闭，失败的那个仍留在 `_sessionTerminals` 里。

### 落地（2026-10-25，D1313）

`_closeTerminalsForSession` 对每个终端单独接住抛错。抛错的实例留在该会话跟踪里，循环继续关掉后面的，并写 warn。正常返回仍从跟踪里移除：用户取消关闭时 `safeDisposeTerminal` 不抛错、终端仍在，这次按收尾处理，不把该终端留在已删除会话 id 上。活动终端和已经不在的终端也不再挂在这个 id 上。调用点不再 `.finally` 删掉整张表。r06-2 对照当前源码已会在第一次等待落空后把活动槽放进补放；r06-3 不在本刀。方案仍是 `draft`。
