---
title: "方案 r08：conversation-session"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 4，drop 0，weaken 0。baseline 之前空副本不是缓存；baseline 之后投影仍是权威。不升 implemented，不升 PRD。"
---
# 方案 r08：conversation-session

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 0。

## r08-1（hold，高）

问题类：会话视图刚 acquire、宿主 baseline 还没写入副本时，名单把这份空副本当成已有投影，随后的刷新、切会话或断线会把行上已恢复的 turns 写成空数组并落盘。

不变量：`SharedEngineHostBinding.hasBaseline` 为假时，`getCachedProjection` 返回 undefined。名单沿用行上已有 turns：刷新用 `previousRowTurns` 填新行，`getTurns` 在没有投影时读行上 turns，`rememberObservedProjection` 不覆盖，`captureEngineCache` 与 `buildPersistedEngineCache` 落盘行上 turns。baseline 已经写入副本之后，投影仍是名单与落盘的权威来源，空时间线表示这份会话确实没有消息。绑定明确失败时缓存继续隐藏。

要动的符号或文件：`ConversationEngineFrameSource.getCachedProjection`（`src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts`）。在现有 `exposesCachedProjection()` 判断之后再要求 `binding.hasBaseline`。`hasBaseline` 仍只反映 `hasReceivedBaseline`，该标志仍只在成功应用 `body.kind === 'baseline'` 的帧时置真。

怎么改：没有 baseline 的副本不进入缓存投影，即使 `exposesCachedProjection` 在绑定尚未结束或已经成功时返回 true，即使副本仍是 `createEmptyReplica`。不要把「时间线长度大于 0」当作门槛，以免一份真实的空 baseline 被当成尚未到达。

明确不改：不改 `exposesCachedProjection` 的绑定成败语义（Create/Resume 明确失败后仍返回 false）；不改 `doRefreshEngineCatalog`、`rememberObservedProjection`、`getTurns`、`captureEngineCache`、`buildPersistedEngineCache` 里「有投影就用投影、没有就沿用行上 turns」的分支；不改 `publishRosterDetailIfChanged` 对第一次 `0:0` 不发字幕的判断；不改 baseline 到达之后用投影覆盖行上 turns 的行为。

怎样本地验证：现有 `getCachedProjection is undefined after bind reject even when host frames landed`、`listSessions refresh keeps remembered turns on sessions without a live lease`、`switching sessions keeps the previous session projected turn count`、`projected engine turns notify roster detail without writing session.turns`、`D13 storage persists engine cache across engine roster restart` 仍通过。在 `src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts` 新增：行上已有用户/助手 turns，观察租约已 acquire，宿主 baseline 尚未送达。断言此时 `getCachedProjection` 为 undefined；随后的名单刷新、切走该会话、以及断线落盘都仍带这些 turns。baseline 送达并含这些消息之后，再断言投影与落盘 turns 跟这份快照一致。

## r08-2（hold，中）

问题类：同一共享绑定上先成功落下一帧非 baseline（cursor 已有值、`hasReceivedBaseline` 仍为假）时，后加上的座位会把这份不完整副本当成全量 baseline 画出来，并且不为这份缺口请求补帧。

不变量：只有 `hasReceivedBaseline` 为真时，`addConsumer` 才把现有副本交给新座位，并且 `syncInitialSnapshot` 才发出 `kind: 'baseline'`。仅有 cursor、尚未收到 baseline 时，新座位不复制这份副本、不发 baseline，共享绑定改为 `requestResync`。此后宿主送来的 baseline 仍经 `onHostFrame` 扇出到该座位。cursor 与 baseline 都还没有时，新座位保持空副本等待首帧，不额外补帧。

要动的符号或文件：`SharedEngineHostBinding.addConsumer`（`src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts`）。`syncInitialSnapshot` 继续只负责复制已有 baseline 并发出 baseline 事件。补帧仍走绑定上的 `requestResync`。

怎么改：把 `hasReceivedBaseline || this.cursor !== null` 拆开。baseline 已收到才 `syncInitialSnapshot`。否则若 cursor 已有值，调用 `requestResync`，让新座位靠随后的宿主帧补上全量，而不是把 patch 或 effects 落在空副本上的结果标成 baseline。

明确不改：不改已有座位上 `onHostFrame` 的应用与失败补帧；不改 baseline 已经在绑定上时，新座位同步完整副本并收到 baseline 事件；不改 `applyViewFrame` 对帧序的判定；不改时间线调度器把 baseline 合并成一次全量刷新的行为。

怎样本地验证：现有 `two acquires for the same sessionId call host acquireLease once`、`both consumers receive the same host frame burst` 仍通过。在 `src/vs/workbench/contrib/conversation/test/browser/conversationEngineFrameSource.test.ts` 新增：第一座位先收到并成功应用一帧 patches 或 effects，此时尚无 baseline；再 acquire 第二座位。断言第二座位的 `onDidApplyFrame` 没有把这份副本报成 baseline，`requestResync` 被调用一次，第二座位的快照在补来的 baseline 应用之前不等于把该非 baseline 帧当成全量历史。baseline 随后到达后，两座位的时间线都含 baseline 里的既有条目。

## r08-3（hold，中）

问题类：子代理浮层第一次挂到整个会话窗上，时间线节点晚出现后不会自己挪进去；下次可见窗口变化时，已经打开的浮层被拆掉再新建。

不变量：同一 `sessionKey` 的浮层实例在宿主从 `sessionWindow` 换成编辑器里的 `.conversation-timeline` 时保持同一对象，`open` 之后的 `isOpen`、对话框 state 与已创建的 lens 都不因换宿主而消失。叶子从可见集合消失时仍 `unmountSubAgentOverlay` 并 `dispose`。宿主时间线只认会话窗里、且不在 `.conversation-subagent-overlay` 内部的那个 `.conversation-timeline`；浮层自己 `open` 时在 body 里造的时间线节点不能当成新宿主。

要动的符号或文件：`ConversationSessionChatContribution` 里 `mountAll` 的宿主选择（`src/vs/workbench/contrib/conversation/browser/conversationSessionChat.contribution.ts`）；`ConversationSessionChatService.mountSubAgentOverlay`（`src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts`）旁增加把已有浮层挪到新父节点的入口；`ConversationSubAgentOverlay.element` 挪到新父节点。时间线晚出现的发现点放在贡献里：对 `leaf.sessionWindow` 观察子节点，或在会话编辑器窗格创建后重跑同一套宿主选择，使这次选择发生在下一次 `onDidChangeVisibleWindows` 之前。

怎么改：已挂载且宿主元素变了时，把现有浮层的根元素移到新父节点并更新 `mountedOverlayHosts`，不要先 `unmountSubAgentOverlay`。时间线节点插入同一扇窗后立刻做这次选择，而不是只等下一次可见窗口变化。叶子不在了的那条路径继续 dispose。

明确不改：不改 `unmountSubAgentOverlay` 在叶子消失和贡献 `dispose` 时的 dispose 语义；不改 `ConversationSubAgentOverlay.open` / `close` 的对话框内容；不改 `runReveal` 里先 `fireVisibleWindowsChange` 再 `whenLeafPaneReady` 的顺序；不改浮层内部那份 `.conversation-timeline` 的创建方式。

怎样本地验证：现有 `re-registers part listeners when the conversation editor part is recreated for the same session key`、`does not register part listeners after contribution dispose`、`unmountSubAgentOverlay disposes overlay and removes DOM element` 仍通过。在 `src/vs/workbench/contrib/conversation/browser/conversationSessionChat.contribution.test.ts` 新增：会话窗里还没有编辑器时间线时完成第一次挂载，打开子代理对话框，再把 `.conversation-timeline` 插进该会话窗且不放进浮层内部。断言浮层根元素成为该时间线的子节点，对话框仍是打开的同一实例。再触发一次可见窗口变化且宿主仍是该时间线时，不新建浮层、不 dispose。叶子从 `getAllLeafSessionKeys` 消失时仍 dispose 并移除 DOM。

## r08-4（hold，低）

问题类：一帧应用失败后的补帧请求还在飞时，后面的缺口被丢掉；这次请求失败也不会再发，宿主不再推帧时时间线停在缺口上。

不变量：同一共享绑定上同时最多一个 `requestResync` 在飞。飞行期间再次进入 `requestResync` 只记下「结束后再补一次」，本次 settle（成功或失败）之后若记了号，再发恰好一次。请求失败时同样记下这一次，不依赖下一帧应用失败才重发。跟进的那一次若再失败，且飞行期间没有新的缺口，不再自动循环。`leaseId` 为空时仍不发。失败继续吞掉 rejection，不把未处理拒绝漏出。

要动的符号或文件：`SharedEngineHostBinding.requestResync` 及其 `resyncPending`（`src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts`）。调用点仍是座位 `onHostFrame` 在 `applyViewFrame` 失败时的 `this.requestResync()`。

怎么改：在飞行锁旁边加一个跟进标记。锁已加上时后来的 `requestResync` 只置标记并返回。当前这次的 `finally` 清锁后，若标记为真，清标记并再调用一次 `requestResync`。`catch` 路径在清锁前把标记置真，使失败本身成为这一次跟进，而不是只等 microtask 放开锁。跟进请求自己的失败不再因为「失败」再次置标记，除非飞行期间又有新的 `requestResync` 把标记置上。

明确不改：不改按座位各发一路补帧；不改应用成功后的 acknowledge；不改 `requestResync reject does not leave an unhandled rejection or apply a bad frame` 所锁住的「失败不抛未处理拒绝、坏帧不进副本」；不改宿主 `requestResync` 的参数，仍只传当前 `leaseId`。

怎样本地验证：现有 `requestResync reject does not leave an unhandled rejection or apply a bad frame` 仍通过，且仍无未处理拒绝。在 `src/vs/workbench/contrib/conversation/test/browser/conversationEngineFrameSource.test.ts` 新增：第一次补帧的 promise 尚未完成时再让一帧应用失败，断言宿主只在第一次 settle 之后再收到恰好一次 `requestResync`。另断言第一次请求 reject、期间没有第二帧时，settle 之后仍会再发一次，而这次跟进也 reject 且期间没有新缺口时不再发第三次。
