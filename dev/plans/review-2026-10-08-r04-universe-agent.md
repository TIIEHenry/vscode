---
title: "审查 r04：universe-agent"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "2 条，最重的是宿主销毁后树拉取的 dirty 续拉仍会 Resume 引擎会话。"
---
# 审查 r04：universe-agent

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r04-1 中
- 症状：宿主已经 dispose 之后，进行中的 Agent 树拉取若被标成 dirty，结束后的续拉仍会按缓存 id Resume 引擎会话；两次 Resume 都失败则 Create 一个新会话。
- 位置：`src/vs/platform/universeAgent/node/sessionViewHost.ts` 第 426–448 行
- 引用：`this.releasePublishedLink();` 之后 `sidecar.tree?.dispose();`。传输闭包在第 830 行：`fetchAgentTree: async (id) => this.host.fetchAgentTree(await this.ensureEngineSession(id))`。
- 为什么是问题：`releasePublishedLink` 第 645 行清掉 `engineBoundForGeneration`，`engineSessionByLocal` 仍留着缓存 id。`AgentTreeCoordinator.dispose`（`agentTreeCoordinator.ts` 第 140–145 行）只 `clearTimeout` 防抖，不取消 `inFlight`，也不清 `dirty`。飞行中的 `doFetch` 结束时 `pullDirtyFollowUp`（第 101–119 行）会再 `pullNow`。这次调用发生在 `_disposed` 之后：`committedEngineSessionId`（第 731–734 行）因本代绑定已空返回 `undefined`，`bindEngineSession`（第 782–787 行）拿缓存 id `callResumeSession`。这不是销毁前已经发出的那次拉取，而是续拉新开始的绑定。活跃会话上，`finishBringUp` 第 728 行的立即刷新和流上第一帧第 1780 行的立即刷新经常叠在同一次 `inFlight` 上，从而把 `dirty` 设上。
- 方向：销毁时取消树协调器的飞行拉取和 dirty 续拉，并让已销毁的宿主不再进入 `ensureEngineSession`。

## r04-2 低
- 症状：溢出之后那次重连本应补一次 `connectionUp` 把流打开，但补发自身若再次撑满邮箱，这次重连打不开流，定时重开也被挡住。
- 位置：`src/vs/platform/universeAgent/node/sessionViewHost.ts` 第 719–726 行
- 引用：`this.postAndDrain(sid, { t: 'connectionUp', connectionGeneration: this.connectionGeneration });` 之后无条件 `this.failClosedRecovery.delete(localId);`。
- 为什么是问题：Actor 在 `subscriptionFailed` 为真时，第一次 `connectionUp` 不 `openAttempt`，末尾才把 `subscriptionFailed` 写成 false（`session-actor.ts` 第 411–427 行）；第二次才打开流。补发的这一次会先把 live 帧交给租约。监听器在同一次 drain 里把邮箱再次撑满时，`onMailboxOverflow`（第 1914–1916 行）把该会话重新放进 `failClosedRecovery`，随后第 726 行把它删掉。`openAttempt`（第 527 行）看到 `subscriptionFailed` 直接返回，`attemptId` 仍是 null，流没有订阅。`failClosedSessions` 还在，第 1855–1856 行的重开原因一直是 `fail_closed`。这次重连保持非 live，要再断一次线，下一次单独的 `connectionUp` 才会打开。
- 方向：只在补发之后 `attemptId` 已经非空时清除 `failClosedRecovery`；这次 post 里若再次溢出，保留恢复标记。
