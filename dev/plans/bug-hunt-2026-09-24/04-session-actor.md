---
title: "会话 Actor：溢出后这次重连不把同步条画成已连接，在途历史回填不互相盖掉，纪元前进不再提交过期的重新生成"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "BH-04-1 至 BH-04-4 在 HEAD 均成立；三条 Actor 不变量，不改宿主、不改 mailbox 与 l2-seq。"
---

# 会话 Actor：溢出后重连、在途历史与重新生成

> **本稿是方案，不是实施。** 不改产品源码。
> **冲突域：** `src/vs/platform/universeAgent/node/sessionCore/session-actor*.ts` 与 `session-core.ts`。
> **不改** mailbox、l2-seq（另一路）。**不改** `sessionViewHost.ts`。该文件已在 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 的冲突域里；下文只交叉引用，不另起宿主切片。
> **扫描来源：** [04-session-actor](../../progress/bug-hunt-2026-09-24/04-session-actor.md) 的 BH-04-1 至 BH-04-4。行号按 2026-09-24 HEAD 符号复核。

## 核查

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-04-1 | 成立 | `onConnectionUp`（`session-actor.ts` 约 407–423 行）在 `subscriptionFailed` 仍为真时先把快照和每个 lease 画成 `live`，再跳过 `openAttempt`，最后才把闩清掉。断连会清宿主闩并投递 `connectionDown`，重连经 `finishBringUp` 再投递 `connectionUp`，已有 lease 不会再次 `acquireLease`。 |
| BH-04-2 | 成立 | `maybeEmitHistoryFill`（`session-actor-stream-fold.ts` 约 556–576 行）每次都换 `pendingHistoryRequestId`。`onHistoryResult`（约 579–587 行）对不上号就返回，不进时间线、不推进游标。宿主对每次 intent 都会回帖结果。 |
| BH-04-3 | 成立 | `clearPendingForRuntimeEpochChange`（约 543–554 行）不清 `pendingRegenerateTurn`。`onStreamHello` 在纪元严格前进且已有锚点时调用它（约 380–386 行）。随后 `agent.editMessage` 成功仍走 `emitRegenerateSubmit`（`session-actor-local-fact.ts` 约 604–605 行）。 |
| BH-04-4 | 成立 | 编辑成功后无条件 `emitRegenerateSubmit` 再把闩置空（约 604–605 行）。聊天 attempt 为空或根 agent 不可用时只打诊断并返回（约 613–626 行），不写乐观行，也不发已有的发送失败效果。 |

## 驳回

无。四条行为与用户可见后果都还在 HEAD 上。

## Problem class

- **症状：** 邮箱溢出后断连再连上，同步条显示已连接，事件流没开。同一条订阅上后一次历史回填把先到的成功结果丢掉，时间线缺一段。运行时纪元已经前进，旧的重新生成仍可能写进当前聊天流；若当时没有聊天流或根 agent，编辑已经成功，界面上却没有失败，闩也没了。
- **类标签：** 连接闩与同步条不一致；历史回填只留一个 request id；重新生成的在途状态没有跟纪元和聊天流对齐。
- **复发机制：** 把「这次 Up 不开流」和「把同步条画成 live」写在同一个函数里；用一个 id 槽表示「当前唯一回填」却允许覆盖；纪元清理清单与 `pendingRegenerateTurn` 分开维护。

## 0. 一句话结论

三处都改 Actor 自己的不变量：不开流的这次 `connectionUp` 不要广播 `live`；在途历史回填不被后一次请求换掉 id；纪元前进清掉重新生成闩，提交没写出去就留着闩并走已有的发送失败效果。宿主、mailbox、l2-seq 不动。

BH-04-1 的 Actor 侧诉求已经写在 [session-subscription-lifecycle](../session-subscription-lifecycle.md) §3.2 **G-CORE-2**（不开流时不要刷 live）。本稿不重写那篇的宿主退避，只把尚未落地的 Actor 不变量收成 S1。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `failClosedOverflow` 置 `subscriptionFailed`，有 attempt 则关流，同步条为 `degraded` / `mailbox_overflow` | `session-actor.ts` `failClosedOverflow` 约 540–563 行 |
| `onConnectionDown` 把同步条写成 `closed`，**不**清 `subscriptionFailed` | 同文件 `onConnectionDown` 约 426–446 行 |
| `onConnectionUp` 先写 `sync: live` 并给每个 lease `setSyncChrome`，`allowOpen === false` 时不 `openAttempt`，函数末尾仍 `subscriptionFailed = false` | 约 407–423 行 |
| 宿主在连接 down 时 `failClosedSessions.clear()` 并投递 `connectionDown`；up 时 `finishBringUp` → `postConnectionUp` | `sessionViewHost.ts` `onEngineConnectionChanged` 约 485–526 行，`finishBringUp` 约 559–564 行。宿主行为只作可达性，**不在本稿改** |
| 仍-connected 时宿主闩挡住退避重开，避免无订阅却刷 live | [session-subscription-lifecycle](../session-subscription-lifecycle.md) S4b。断连会清这道闩，所以 BH-04-1 的触发仍在 |
| `maybeEmitHistoryFill` 递增 `historyRequestSeq`，覆盖 `pendingHistoryRequestId`，发出 `fillHistoryGap` | `session-actor-stream-fold.ts` 约 556–576 行 |
| request 不符：计 `history.fill_failed` / `request_mismatch` 后返回；注释假定「真正的那次仍在飞」 | 约 579–587 行 |
| 成功结果才 fold 进快照，并用 `coveredThrough` 走已有 cover 计划 | 约 624–674 行。cover 规则在 l2-seq，**本稿不改** |
| 宿主 `fillHistory` 对每个 intent 各回一帖 `historyResult` | `sessionViewHost.ts` 约 1636–1675 行。分页合同见 [conversation-stream-timeline](../conversation-stream-timeline.md) 已落的 HistoryFill 行 |
| `clearPendingForRuntimeEpochChange` 清聊天出站、在途清理、待确认项，并 `failAllLocalPendingSends(SEND_FAILED_EPOCH_CHANGED)` | `session-actor-stream-fold.ts` 约 543–554 行 |
| 调用点：hello 纪元严格增大且 `prevEpoch !== null`；overlay 快照 `clear_epoch_ahead` | `onStreamHello` 约 380–386 行；`session-actor-overlay-fold.ts` 约 46–57 行 |
| `pendingRegenerateTurn` 只在 `onCommandOutcome` 里清 | `session-actor.ts` 字段注释约 201–209 行；`onCommandOutcome` 约 587–606 行 |
| 编辑成功后 `emitRegenerateSubmit`：无 `currentChatAttemptId` 或根 agent 不可用则 return；调用方随即置空闩 | `session-actor-local-fact.ts` 约 604–626 行；`blockSubmitMissingRootAgent` 约 273–278 行只 warn |
| 提交族失败效果是已有的 `emitSendFailureEffect`（`kind` 为 `send_failed`） | `session-actor-chat-outbox.ts` `emitSendFailureEffect` |
| 时间线把 effects 帧标成不改树 | `conversationTimelineApply.ts` `computeTimelineApplyPlan` 对 `kind: 'effects'` 返回 `none`。可见行是 `localPendingSends` |
| 这些文件是 vendored session-core；`SYNC.md` 写明不要手改、应上游改完再同步 | `node/sessionCore/SYNC.md`。结构纪律见 [giant-file-split](../giant-file-split.md) |

## 2. Options

| 选项 | 结论 |
|:-----|:-----|
| A. 这次 Up 在闩仍为真时不写 `live`，末尾仍清 `subscriptionFailed`（G-CORE-2 的第二选项） | **选定**，作 S1 |
| B. 给 `SessionCore` 加 `subscriptionFailed` 只读面，让宿主自己别投递 `connectionUp` | **拒绝。** G-CORE-2 的另一选项。宿主闩在断连时本来就要清，挡不住 BH-04-1；而且要改 `sessionViewHost.ts` |
| C. 溢出后这次 Up 直接 `openAttempt` | **拒绝。** 扫描与现有注释都把「这次不开流」当作闩设计 |
| D. 在途历史未结束就不要换 request id；后一次窗口先记下，等这一次落地再发一帖 | **选定**，作 S2 |
| E. 先到的成功回包一律并进快照，即使 id 已被换掉 | **拒绝。** 重写窗口会先丢掉镜像再补洞；把过期宽窗口并回去会把刚丢掉的行写回来。也不去改 l2-seq 的 cover |
| F. 纪元前进时清 `pendingRegenerateTurn`，迟到的编辑成功不再提交 | **选定**，作 S3 |
| G. 提交没写出时保留闩，并发已有 `send_failed`；聊天流 Up 或根 agent 刚绑上时再试一次提交 | **选定**，作 S4 |
| H. 提交失败就清闩，只靠用户再点一次 | **拒绝。** 编辑已经在引擎上成功，清闩会让这次生成消失且没有失败行 |
| I. 在宿主里合并历史回帖或拦截过期 `commandOutcome` | **拒绝。** 与 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 抢 `sessionViewHost.ts` |

## 3. 选定设计

实施落点是上面点名的 Actor 文件。它们来自上游 session-core，`SYNC.md` 禁止无合同手改。切片只描述不变量；真要改时在上游同一函数落下同样不变量再同步，避免下一次 sync 盖掉。

### S1 — 不开流的 `connectionUp` 不画 `live`（BH-04-1）

与 [session-subscription-lifecycle](../session-subscription-lifecycle.md) G-CORE-2 第二选项是同一句话，这里只钉函数不变量，不重做 S4b。

`SessionActor.onConnectionUp`：

- `connectionUp = true` 与 `allowOpen = !subscriptionFailed` 保持。
- `allowOpen === false`：不改 `snapshot.sync`，不对 lease 发 `setSyncChrome` `live`。断连之后条幅留在 `closed`；若中间没有 `connectionDown`，留在溢出时的 `degraded`。
- `allowOpen === true`：仍照今天写 `live` 并广播，再按现有条件 `openAttempt`。
- 函数末尾仍把 `subscriptionFailed` 置为 false。下一次 `connectionUp`，或 `onAcquireLease` 在连接已 up 且没有 attempt 时，可以 `openAttempt`。
- 不在这次拒绝开流的 Up 上调用 `openAttempt`。

### S2 — 一条订阅上同时只有一个历史 request（BH-04-2）

`maybeEmitHistoryFill` / `onHistoryResult` / `clearStreamHelloAnchor`：

- `pendingHistoryRequestId` 非空时，不再递增序号、不覆盖该 id、不再发第二帖 `fillHistoryGap`。把这次的 `fromExclusive` / `toInclusive` 记在 Actor 内部的一格延迟窗口上（后来的覆盖先前的）。这不是协议字段。
- 因在途而推迟时，`consumeRewriteWindowFromHello`（约 446–474 行）里先于 `maybeEmitHistoryFill` 的 `dropMirrorFromSeq` 也推迟，不在这次 hello 上丢镜像。新的 drop 起点与水位跟延迟窗口走，不改挂到旧 id 上。
- 在途成功包仍走今天的 fold。落地并清掉 `pendingHistoryRequestId` 之后，先按延迟窗口的 `fromExclusive` 做那次被推迟的 `dropMirrorFromSeq`，再发延迟的 `fillHistoryGap`。延迟窗的 `fromExclusive` 必须仍覆盖这些尚未被 drop 的序号。
- `consumeRewriteWindowFromHello` 仅在「不会再补这一窗」（没有 attempt，或窗口为空）时清水位；因为已有在途而推迟时不清。
- `onHistoryResult` 对不上 `pendingHistoryRequestId` 仍整包丢掉（真正的过期回帖）。对得上的成功路径仍走今天的 fold 与 cover，不改 l2-seq。
- 这一帖结束（成功、失败或畸形）并清掉 `pendingHistoryRequestId` 之后，若延迟窗口还在，再发恰好一帖新的 `fillHistoryGap`。
- `clearStreamHelloAnchor` 同时丢掉延迟窗口。

宿主仍会对每一帖 intent 回 `historyResult`。S2 保证不会同时发出两帖，所以不必改 `fillHistory`。

### S3 — 纪元前进清掉重新生成闩（BH-04-3）

`clearPendingForRuntimeEpochChange`（hello 与 overlay `clear_epoch_ahead` 两条都走它）：

- 在现有清理之后只把 `pendingRegenerateTurn` 置空。S4 不另造状态字段。
- 清掉之后，迟到的 `commandOutcome`（`agent.editMessage` 且 `succeeded`）在 `onCommandOutcome` 开头就返回，不调用 `emitRegenerateSubmit`。
- 不新造失败文案。已经写进 `localPendingSends` 的行仍由现有 `failAllLocalPendingSends(SEND_FAILED_EPOCH_CHANGED)` 处理。重新生成在提交之前没有乐观行。

### S4 — 提交没写出去就留闩（BH-04-4）

`onCommandOutcome` / `emitRegenerateSubmit`：

- `emitRegenerateSubmit` 要能区分「已写入或已排队」和「没写出去」。没写出去指：`currentChatAttemptId === null`，或根 agent 仍不可用（今天 `blockSubmitMissingRootAgent` 那条）。
- 编辑失败：仍清闩，只留现有 warn。
- 编辑成功且已经写入或排队：仍清闩。
- 编辑成功但没写出去：不清闩。可以调用已有 `emitSendFailureEffect`，但这一帧用户看不见：`conversationTimelineApply.ts` 对 effects 返回 `mode: 'none'`，可见行只来自已 upsert 的 `localPendingSends`，而早退发生在 `upsertLocalPendingSendFromSubmit` 之前。验收只锁留闩与稍后补交，不把这一帧当成可见失败。没有聊天 attempt 时若复用 `SEND_FAILED_STREAM_CLOSED`，测试不得把这条 message 读成流已关闭。缺根 agent 同样不新增常量。诊断 warn 保留。
- 闩还在、且编辑已经成功时：`onChatStreamUp` 在冲刷完排队写之后再调一次 `emitRegenerateSubmit`；`onRootAgentBound` 在 agent id 被接纳后再调一次。第二次若写出，再清闩。
- `onRegenerateTurn` 在闩非空时仍拒绝第二笔（今天约 556–561 行）。留闩不会变成连点两次编辑。

效果帧本身不改时间线树。可见的失败行仍只来自已经 upsert 的 `localPendingSends`。S4 不在早退路径上假装已经插入乐观行；它保证的是不再把成功编辑当成「重新生成已结束」，并在聊天流或根 agent 就绪后补交。

## 4. 不做

- 不改 `sessionViewHost.ts`（连接、`fillHistory`、`dispatchEditMessage`）。交叉：[live-stream-bytes-decode](../live-stream-bytes-decode.md)、[session-subscription-lifecycle](../session-subscription-lifecycle.md)。
- 不改 mailbox 容量、溢出判定、l2-seq / `planLocalSeqCursorCover`。
- 不改 `session-core.ts` 的 intent 队列与 `takeIntents`（[session-view-frame-fanout](../session-view-frame-fanout.md) 的 G-CORE-1）。S1 不需要新的只读访问器。
- 不改 `ensureChatStreamIfNeeded` 在这次被拒绝的 Up 上是否开聊天流。
- 不发明协议字段、效果 kind、RPC。发送失败只用 `session-actor-chat-outbox.ts` 里已有的 `send_failed` 与 `SEND_FAILED_*`。
- 不改渲染端对 effects 帧的分类。
- 不改 `scripts/sync-universe-agent-session-core.ts`。不在本稿把 vendored 文件当成可以脱离上游的手写树。
- 不重开 GitHub Actions。

## 5. 验证

现有路径（行为相邻，但没有锁住上述不变量）：

- `src/vs/platform/universeAgent/test/node/sessionViewHostReopen.test.ts`：`failClosedOverflow does not schedule reopen` 锁的是宿主不调度重开。
- `src/vs/platform/universeAgent/test/node/sessionViewHostHistoryFill.test.ts`：宿主分页回帖。
- `src/vs/platform/universeAgent/test/node/sessionViewHostIntentOwner.test.ts`：`regenerateTurn dispatches agent.editMessage unary`。
- `src/vs/platform/universeAgent/test/node/sessionViewHostActorLoop.test.ts`：帧上的 `setSyncChrome`。

该加的断言（Actor 邮筒进、帧与 intent 出；放在 `src/vs/platform/universeAgent/test/node/`，不要改宿主来绕）：

- S1：lease 还在，先溢出，再 `connectionDown`，再 `connectionUp`。同步条不是 `live`，`openStream` intent 条数为 0，`subscriptionFailed` 在这次 Up 之后为 false。再投递一次 `connectionUp` 才出现 `openStream`。
- S2：同一 attempt 上连续两次 hello 改写且第二窗到来时第一帖仍在途：第二次不 `dropMirrorFromSeq`。第一帖成功落地后，被推迟的 drop 才发生，延迟窗的 `fromExclusive` 仍盖住这些序号，并再发出第二帖。先回旧 id 的成功结果被丢弃。
- S3：`pendingRegenerateTurn` 已设、编辑尚未回执时，hello 的 `runtimeEpoch` 严格增大。随后成功的 `commandOutcome` 不产生 `chatStreamWrite`。
- S4：编辑成功时 `currentChatAttemptId === null`。闩仍在，没有 `chatStreamWrite`，时间线上没有新的失败行。随后 `chatStreamUp` 再试，写出一笔后闩为空。缺根 agent 的早退同样只锁留闩，不断言 message 等于流已关闭。

本地命令沿用 [health-gates](../../progress/health-gates.md)：触及 `platform/universeAgent` 时跑对应单测；编译用 `npm run compile-client` 或 `npm run compile`。不建议重开托管 CI。

## 审查记录

- 2026-09-29 实施（loop/H）：S1–S4 已落在 Actor。不开流的 `connectionUp` 不画 `live`；在途历史保持原 request id，改写的 drop 与水位随延迟窗口在这一帖结束后再做；纪元前进清 `pendingRegenerateTurn`；编辑成功但提交没写出去则留闩，`chatStreamUp` / `rootAgentBound` 再交。frontmatter 仍为 `accepted`。
