---
title: "审查 r08：conversation-session"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "4 条，最重是 baseline 到达前的空副本被当成缓存投影，切会话或断线会把已恢复的对话写成空。"
---
# 审查 r08：conversation-session

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r08-1 高
- 症状：会话视图刚 acquire、宿主 baseline 还没写进副本时，名单把这份空副本当成已有投影。再切会话、再刷列表或断线，该会话里已经恢复的用户/助手消息被写成空数组。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts` 第 386–396 行
- 引用：`if (!binding || !binding.exposesCachedProjection()) { return undefined; }` 之后返回 `snapshot: binding.snapshot`。`exposesCachedProjection` 在绑定尚未结束时 `return true`（第 246–253 行）。副本初始是 `createEmptyReplica`，`hasReceivedBaseline` 仍为 false（第 46、51 行）；`hasBaseline`（第 104–106 行）没有参与这次判断。
- 为什么是问题：`projectSnapshotToEntries` 只沿 `snapshot.timeline` 出条目（`conversationSessionView.ts` 第 439–441 行）。还没有任何帧时，投影是空的。`getTurns` 只要拿到投影就用它，不再读行上的 `turns`（`conversationEngineRosterService.ts` 第 344–348 行）。`rememberObservedProjection` 见到投影就把 `getTurns` 的结果写回行上（第 1821–1828 行）。列表刷新里 `const carried = !cached ? previousRowTurns.get(id) : undefined`，投影对象为真就放弃旧 turns，新行变成 `[]`（第 1901–1906 行）。`captureEngineCache` 与 `buildPersistedEngineCache` 同样用这份投影生成落盘 turns（第 2019–2022、2096–2099 行）。观察租约在 `doRefreshEngineCatalog` 的 `finally` 里 acquire（第 1945–1946 行），第一次落盘可能还带着旧 turns；baseline 到达之前的下一次切换、刷新或断线会把空投影写进内存和存储。
- 方向：`getCachedProjection` 在 `hasBaseline` 为真之前返回 undefined，让行上已有 turns 继续被沿用和落盘。

## r08-2 中
- 症状：同一会话上后加上的视图座位，会把一份尚未形成 baseline 的副本当成全量历史画出来，并且不再为这份缺口请求补帧。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts` 第 114–122 行
- 引用：`if (this.hasReceivedBaseline || this.cursor !== null)` 就 `syncInitialSnapshot`。该函数末尾固定 `this._onDidApplyFrame.fire({ kind: 'baseline' })`（第 468–471 行）。`hasReceivedBaseline` 只在 `frame.frame.body.kind === 'baseline'` 时置真（第 148–150 行），其它成功帧也会写上 `cursor`。
- 为什么是问题：共享绑定上先落到一帧 patch 时，cursor 已有值，baseline 标志仍为假。新座位拿到的是这份不完整副本，事件种类却是 baseline。座位按全量刷新之后，后续缺口不会走 `onHostFrame` 里应用失败才调用的 `requestResync`（第 577–578 行）。后打开的时间线停在这帧 patch 之前的内容上。
- 方向：只有 `hasReceivedBaseline` 时才把现有副本同步给新座位，并发出 baseline；仅有 cursor 时让该座位走 resync。

## r08-3 中
- 症状：子代理浮层第一次挂到整个会话窗上。时间线节点晚出现后不会自己挪进去；下次可见窗口变化时，已经打开的浮层被拆掉再新建。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionChat.contribution.ts` 第 59–67 行
- 引用：`const host = (leaf.sessionWindow.querySelector('.conversation-timeline') as HTMLElement) || leaf.sessionWindow`，宿主变化时先 `unmountSubAgentOverlay` 再 `mountSubAgentOverlay`。`unmountSubAgentOverlay` 会 `store.dispose()`（`conversationSessionChatService.ts` 第 149–157 行）。
- 为什么是问题：`mountAll` 只在槽创建和 `onDidChangeVisibleWindows` 时重跑（第 79–84 行）。`runReveal` 在 `whenLeafPaneReady` 之前就 `fireVisibleWindowsChange`（`conversationSessionWindowService.ts` 第 364–365 行），这时时间线节点经常还不在。浮层记在 `sessionWindow` 上。时间线后来插进同一扇窗，不会再次选择宿主。下一次可见性变化选中新的时间线元素时，先卸掉旧浮层，打开中的子代理对话框随之销毁。
- 方向：时间线节点出现后再把浮层挂上去；换宿主时把已有浮层移到新父节点，不要先 dispose。

## r08-4 低
- 症状：一帧应用失败后的补帧请求还在飞时，后面的缺口被丢掉。这次请求失败也不会再发，时间线停在缺口上。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts` 第 226–232 行
- 引用：`if (this.leaseId && !this.resyncPending)` 才 `requestResync`；`catch(() => undefined)` 后在 `finally` 里用 `queueMicrotask` 把 `resyncPending` 清掉。调用点是应用失败的 `this.requestResync()`（第 577–578 行）。
- 为什么是问题：共享绑定上所有座位共用这一把锁。第一帧失败已经把锁加上之后，飞行期间再次失败直接返回。请求本身失败被吞掉，锁要等 microtask 才放开，中间没有“结束后再补一次”的标记。宿主不再推帧时，没有下一次失败可以重新发起补帧。
- 方向：飞行中再遇到缺口就记下，本次结束后补发；请求失败要重新允许下一次 resync。
