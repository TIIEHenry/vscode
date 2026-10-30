---
title: "方案 r04：universe-agent"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 2，drop 0，weaken 0。销毁后不再续拉；补发 connectionUp 未开流时保留恢复标记。不签收 S5，不升 implemented，不升 PRD。"
---
# 方案 r04：universe-agent

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 2，drop 0，weaken 0。

## r04-1（hold，中）

问题类：宿主 dispose 之后，进行中且已标 dirty 的 Agent 树拉取结束时仍会按缓存 id Resume，两次失败再 Create。

不变量：`_disposed === true` 之后不得再进入 `ensureEngineSession`，不得 `callResumeSession` / `createSession`。`AgentTreeCoordinator.dispose` 之后，`pullDirtyFollowUp` 不得再 `pullNow`。销毁前已经发出的那一次 `doFetch` 可以自然结束，结束不得启动新的绑定。

要动的符号或文件：

- `AgentTreeCoordinator.dispose`、`pullDirtyFollowUp`（`src/vs/platform/universeAgent/node/agentTreeCoordinator.ts`）。dispose 时清掉 `dirty` 和挂起的 `pendingOnBound` / `pendingOnError`，让飞行拉取的 `finally` 不再续拉。
- `SessionViewHost.ensureEngineSession`（`src/vs/platform/universeAgent/node/sessionViewHost.ts`）。`_disposed` 时直接拒绝，不走到 `commitEngineBind` / `bindEngineSession`。
- `SessionViewHost.dispose` 里对 `sidecar.tree` 的 dispose 必须盖住续拉；传输闭包仍是 `fetchAgentTree` → `ensureEngineSession`。

明确不改什么：

- 不改未销毁时的 dirty 续拉：in-flight 期间再次 `pullNow` 仍只再拉一次，并用最新的 `onBound`。
- 不在 `releasePublishedLink` 里清空 `engineSessionByLocal`。代际缓存仍只在引擎身份变化时清。
- 不改 `finishBringUp` 的立即刷新，也不改流首帧的立即刷新。
- 不改 `host.fetchAgentTree` 的取树语义。

怎样本地验证：

- 保留 `src/vs/platform/universeAgent/test/node/sessionViewHostNavigator.test.ts` 的 `pullNow during in-flight fetches once more with the latest onBound`。
- 新增断言：`SessionViewHost` 在第一次 `fetchAgentTree` 未完成、第二次立即拉取已把 dirty 置上时 `dispose()`，然后放行第一次传输。`TestConnection.resumeSessionCalls` 与 `createSessionCalls` 不再增加，`fetchAgentTree` 不再被调用第二次。现有 `sessionViewHostDisposal.test.ts` 的 `dispose cleans up sidecars and tree coordinators` 只断言 sidecar map 为空，盖不住这条。
- `scripts/test.sh --grep "pullNow during in-flight fetches once more|dispose cleans up sidecars"`，并带上新测试名。

## r04-2（hold，低）

问题类：溢出后重连补发的 `connectionUp` 若在同一次 drain 里再次撑满邮箱，这次重连打不开流，定时重开也被 `fail_closed` 挡住。

不变量：只在补发的 `postAndDrain` 返回后 `attemptId` 已经非空时，才从 `failClosedRecovery` 删除该会话。同一次 post 里若再次 `mailbox.overflow`，保留恢复标记。`failClosedSessions` 仍让 `streamReopenSkipReason` 返回 `fail_closed`，直到下一次真正打开流或连接断开。

要动的符号或文件：

- `SessionViewHost.finishBringUp`（`src/vs/platform/universeAgent/node/sessionViewHost.ts`）。补发 `connectionUp` 之后，仅当 `this.core.attemptId(sid)` 非空时 `failClosedRecovery.delete(localId)`。`attemptId` 仍为 null（补发过程中再次溢出，`openAttempt` 因 `subscriptionFailed` 返回）则保留标记。

明确不改什么：

- 不改 `SessionActor.onConnectionUp` 的两拍：`subscriptionFailed` 为真时第一次不 `openAttempt`，函数末尾才把标志写成 false；第二次才打开流。
- 不改 `openAttempt` 在 `subscriptionFailed` 时直接返回。
- 不改 `onMailboxOverflow` 同时写入 `failClosedSessions` 与 `failClosedRecovery`。
- 不改 `streamReopenSkipReason` 对 `failClosedSessions` 返回 `fail_closed`。
- 不改 `openStream` 成功路径上已有的 `failClosedRecovery.delete`。
- 不签收、不实施 [session-subscription-lifecycle](session-subscription-lifecycle.md) §4.2 S5。不新增 recovery 定时器，不改 30 秒归零，不改 `sessionCore`，不把「溢出后合法回 live」写成已拍板。本条只阻止补发 `connectionUp` 未开流时摘掉 `failClosedRecovery`。

怎样本地验证：

- 保留 `src/vs/platform/universeAgent/test/node/sessionViewHostReopen.test.ts` 的 `overflow followed by disconnect and reconnect self-heals via supplementary connectionUp`、`failClosedOverflow does not schedule reopen`、`armed reopen timer skips fail_closed after overflow and does not paint live`。
- 新增断言：`mailboxCapacity: 1`，溢出后断开再连；补发 `connectionUp` 打出的 live 帧监听器里再 `post` 两次把邮箱撑满。`subscribeCalls` 不增加，`attemptId` 仍为 null，`failClosedRecovery` 仍含该会话；定时 `fireAll` 的跳过原因仍是 `fail_closed`。再断一次线并重连、且监听器不再撑满时，`subscribeCalls` 增加且 `attemptId` 非空。
- `scripts/test.sh --grep "supplementary connectionUp|failClosedOverflow does not schedule reopen|armed reopen timer skips fail_closed"`，并带上新测试名。
