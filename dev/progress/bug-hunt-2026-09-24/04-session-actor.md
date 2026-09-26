---
title: "潜在缺陷：会话 Actor"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "会话 Actor 在溢出后的第一次重连会显示已同步却不再订阅，在途历史回填会被后一次请求丢掉，纪元切换后仍可能发出过期的重新生成。"
---

# 潜在缺陷：会话 Actor

## 结论

读过 `src/vs/platform/universeAgent/node/sessionCore/` 里点名的 9 个生产文件，并对照 `sessionViewHost.ts` 的连接、重开订阅与历史回填。立 4 条。mailbox 与 l2-seq 代数未扫。`dev/progress/deferred-gaps.md` 无同题条目。

## 发现

### BH-04-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor.ts` `SessionActor.onConnectionUp` 约 407–424 行；`failClosedOverflow` 约 540–548 行。相邻：`src/vs/platform/universeAgent/node/sessionViewHost.ts` `onEngineConnectionChanged` 约 485–533 行（断连清 host 闩，重连 `postConnectionUp`）。
- 行为：邮箱溢出把 `subscriptionFailed` 置上并关掉订阅。下一次 `connectionUp` 先把快照和所有 lease 的同步条画成 `live`，再用溢出前的闩拒绝 `openAttempt`，最后才清闩。
- 为何是缺陷：拒绝在这次 Up 上重开订阅是闩设计；把同步条画成已连接不是。用户看到会话已恢复，事件流实际没开，这段时间的回合不会进时间线。
- 触发：订阅邮箱溢出之后，引擎断连再连上一次（host 在断连时清掉自己的 fail-closed 集合，重连只投递 `connectionUp`）。已有 lease 不会再次 `acquireLease`。要再连一次，或重新要 lease，订阅才会打开。
- 已知：否
- 修复方向：这次 Up 在闩仍为真时保持 degraded，不要广播 `live`。

### BH-04-2

- 严重度：high
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts` `maybeEmitHistoryFill` 约 556–576 行；`onHistoryResult` 约 579–587 行。相邻：`sessionViewHost.ts` `fillHistory` 约 1636–1675 行（两次 intent 都会回帖结果）。
- 行为：同一次 attempt 上第二次补洞直接覆盖 `pendingHistoryRequestId`。先返回的成功结果因 request 不符被丢掉，不进时间线，也不推进游标。
- 为何是缺陷：后一次补洞若失败或窗口更窄，先一次已经拉到的历史被丢弃。游标仍停在洞前，时间线缺这一段，直到下一次 hello 再计划；若后一次先把水位盖过去，这段不会再要。
- 触发：同一条订阅上，hello 的补洞或重写窗口还在飞，又来一次 hello 再次 `fillHistoryGap`。两次回包按完成顺序交错，先完成的那次被当成过期。
- 已知：否
- 修复方向：在途 request 未结束时不要换 id；或把先到的成功回包按序号并进快照，而不是整包丢弃。

### BH-04-3

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts` `clearPendingForRuntimeEpochChange` 约 543–554 行；`onStreamHello` 约 380–386 行调用它。`session-actor-local-fact.ts` `onCommandOutcome` 约 587–606 行仍读 `pendingRegenerateTurn`。
- 行为：运行时 epoch 前进会清空聊天出站、在途清理和待确认项，并失败本地待发送。`pendingRegenerateTurn` 不在这张清单里。之后 `agent.editMessage` 的成功回执仍会 `emitRegenerateSubmit`。
- 为何是缺陷：纪元已经切走，旧回合的重新生成仍写进新的聊天流。用户看到的是新纪元里冒出一段旧文案的发送，或把已经作废的编辑又提交一次。
- 触发：重新生成已发出编辑命令、结果尚未回来时，订阅 hello 的 `runtimeEpoch` 严格增大。
- 已知：否
- 修复方向：纪元前进时清掉 `pendingRegenerateTurn`，迟到的编辑成功不再提交。

### BH-04-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts` `onCommandOutcome` 约 595–606 行；`emitRegenerateSubmit` 约 613–627 行。
- 行为：编辑命令成功后无条件调用提交，然后立刻把 `pendingRegenerateTurn` 置空。提交在没有聊天 attempt、或没有可用根 agent 时只打诊断并返回，不写乐观行，也不发失败效果。
- 为何是缺陷：引擎上的用户消息已经被改掉，后续生成没有发出，界面上也没有失败。闩已清，用户以为重新生成结束了，助手回合不会出现。
- 触发：重新生成的编辑回执先到，而当时 `currentChatAttemptId` 仍为空（聊天流尚未 Up 或刚被关掉），或根 agent 尚未绑定。
- 已知：否
- 修复方向：提交没写出去时保留在途闩，并向 lease 发一条可见的发送失败。

## 看过但未立条

- `session-actor-local-fact.ts` `onLocalFact` 对 `applyViewPatches` 只改快照、不广播。生产 host 没有投递这个 fact，流上的同名 arm 会走 `foldStreamApplyViewPatches`。
- `questionRespond` / `clientToolRespond` 只做本地清理、不发 `chatStreamWrite`。`local-fact.ts` 写明这是 ADR-325 一元调用成功后的清理。
- 溢出后这一次 Up 不调用 `openAttempt` 是注释里的闩；立条的是同时把同步条画成 `live`。
- `drain` 拒绝重入。`sessionViewHost.ts` `onFrameEnqueued` 不在帧回调里再 `post`。
- `seedSeqCursor` 把 `lastMutatedFromSeq` 写成 0。仓库内没有生产投递点。
- overlay set-replace 丢掉仍指向已移除 request 的排队 permission 写：新快照里该项已不在，视为服务端已撤下。
- `submitInputWritePayload` 遇到非对象会只剩 `agentId`。host 的 `writeMessageToCoreFact` 始终提交带 `text` 的对象。

## 未读完

- `sessionViewHost.ts` 只读了连接、订阅开关、历史回填和写事实的投递，没有通读整文件。
- `apply.ts`、`stream-hello-gap.ts`、`pending-actions-bound.ts` 只读了与上述路径相邻的函数。
- 按范围未读 mailbox、l2-seq 代数，以及 sessions / base / editor / extensions / 未点名 workbench。
- 未跑测试。
