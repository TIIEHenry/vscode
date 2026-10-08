---
title: "方案 r09：conversation-lens"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 0，drop 1，weaken 1。回合编辑中断开的 composer 先挂回簇内。不升 implemented，不升 PRD。"
---

hold 0，drop 1，weaken 1。滚动不会拆掉仍在挂的编辑行；名册 `getTurns` 必返回数组，`?? true` 到不了。

## r09-1（weaken，低）

问题类：回合编辑仍被当成活着、且 composer 已经不在文档里时，`syncComposerPlacement` 直接返回，输入既不回到回合宿主，也不回到簇。

不变量：`composerPolicy === 'turnEdit'` 且 `isComposerEditSurfaceLive` 为真时，只要 `composerCluster` 在文档中，`composer` 就必须在文档中，要么在当前回合编辑宿主里，要么在 `composerCluster` 里。同一次调用若见到 `!composer.isConnected`，不得把该节点放进编辑宿主。

要动的符号或文件：`syncComposerPlacement`（`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts`）。断开分支先 `ensureComposerInCluster`，不要在这次调用里 `appendChild` 到 `getTurnEditHost` 的结果，也不要为这次断开再预约下一帧；下一帧会看到节点已经连上，从而把它送进编辑宿主。

明确不改什么：不改 `exitComposerEdit` 把策略收成 `compose` 之后的底栏挂载（同函数第 473 行起）。不改 `provideTurnEditComposer` 和 `ConversationTimelineRenderer.renderElement` 里编辑行重建时对 `pendingTurnEditComposer` 的挂回。不改 `isComposerEditSurfaceLive` 的 `?? true`。不改时间线窗口、`content-visibility` 和 `ConversationTimelineHost.syncArticles`。

怎样本地验证：保留并通过 `ConversationLensComposerChrome` 的 `turnEdit placement rAF after composer disconnect does not mount into timeline edit host`，以及 `turnEdit after user turn disappears hides edit chrome and skips timeline editHost placement`。新增断言：回合编辑仍活、`composer.remove()` 之后调用 `syncComposerPlacement`，`composerCluster` 包含 `composer`，簇已在文档中则 `composer.isConnected` 为真，编辑宿主不包含 `composer`。再新增断言：收回簇且 composer 已连接之后，再调一次 `syncComposerPlacement`，编辑宿主已在文档中时 composer 进入该宿主。本地用 `scripts/test.sh --grep "turnEdit placement rAF after composer disconnect|turnEdit after user turn disappears"`。
