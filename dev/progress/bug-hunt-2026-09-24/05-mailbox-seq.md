---
title: 潜在缺陷：信箱与序号
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: 长会话的序号索引会在改写后留下旧气泡；快照形状不完整会拆掉仍可回答的卡片；单边打断事实会中断信箱排空。
---

# 潜在缺陷：信箱与序号

## 结论

扫描范围内有 5 条用户可见缺陷：超过 64 条序号后的 hello 改写删不干净，待回答卡片会被形状不完整的快照摘掉，只有一侧 id 的打断事实会抛错并停住信箱，历史回填的 `coveredThrough` 过宽会让游标和已上屏内容分叉，带冒号的 requestId 能绕过待办配额。与 `dev/progress/deferred-gaps.md` 无同条。

## 发现

### BH-05-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionCore/l2-seq-index.ts` `evictLowestUntilCap` 约 95–108 行，`feedL2SeqIndexState` 约 144–163 行，`L2_SEQ_INDEX_CAP` 为 64（约 34 行）。相邻 `src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts` `dropMirrorFromSeq` 约 477–489 行只遍历仍留在 Map 里的 seq；`l2SeqIndexCoversFrom`（约 190–192 行）没有生产调用方
- 行为：同一 seq 后写入覆盖先写入。条目超过 64 时删掉最小 seq，并把该 seq 记入只增不减的 `evictedFloor`。hello 改写按「seq 大于等于 dropFromSeq」从这份 Map 生成 `removeTimelineItem`
- 为何是缺陷：被挤出索引的气泡还在时间线上。改写起点落在水位上或水位之前时，这些旧气泡不会被删，补历史再叠上一份新气泡，同一段对话出现两套内容
- 触发：活流或历史回填累计超过 64 个可索引 seq 之后，hello 的改写窗口从已被挤出的 seq 起算（例如会话前部被编辑、再生或分支）
- 已知：无
- 修复方向：改写或按 seq 删除之前若 `l2SeqIndexCoversFrom` 为假，先整段降级并按 id 清掉窗口内时间线，再补历史；不要只删索引里还看得到的行

### BH-05-2

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionCore/pending-actions-bound.ts` `planOverlayPendingSetReplace` 约 517–540 行；`pendingActionFromOverlayItem` 在描述为空、`questions` 不是数组、或 client tool 缺 `toolName` / `argumentsJson` 时返回 `undefined`（约 385–396、413–424、447–450 行）。相邻 `src/vs/platform/universeAgent/node/sessionCore/session-actor-overlay-fold.ts` `onOverlayPendingSnapshot` 约 75–90 行会应用这份 remove/upsert
- 行为：requestId 能规范化就先记入 `seenIds`。铸行失败则 `continue`，该 id 不进 `mapped`。随后凡是已迁移、且不在 `desiredIds` 里的待办都会 `removePendingAction`。重复 id 会整帧 `skip_ambiguous`，铸行失败不会
- 为何是缺陷：快照里仍带着这张待回答卡片，只是正文形状不完整。界面上权限、提问或可响应工具卡片消失，用户无法再点允许/回答，同帧其它合法待办仍会更新
- 触发：epoch 与当前 hello 对齐的 `overlayPendingSnapshot` 里，某个已在 `pendingActions` 中的 requestId 再次出现，但提问缺 `questions` 或标题为空，或 client tool 的工具名/参数为空
- 已知：无
- 修复方向：铸行失败且当前已有同一 requestId 时保留旧行，或让该帧像 `skip_ambiguous` 一样整帧不应用；不要把「铸不出来」当成「引擎已取消」

### BH-05-3

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionCore/local-fact.ts` `isTurnInterruptedFact` 约 944–956 行。相邻 `src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts` `onTurnInterrupted` 约 515–516 行读取 `fact.messageId.length`；`src/vs/platform/universeAgent/node/sessionCore/session-actor.ts` `drain` 约 333–350 行没有 catch
- 行为：守卫在 `turnId` 或 `messageId` 有一边是精确字符串时就返回真，类型却收成两边都是 `string`。折叠处无条件读 `messageId.length`
- 为何是缺陷：只有 `turnId`、或 `messageId` 不是字符串时抛 TypeError。打断错误行不上屏。`drain` 的循环被打断，排在这条后面的信箱消息留到下一次 `post` 才继续；调用方未接住的话，这一拍的流回调失败
- 触发：`localFact` 的 `kind` 为 `turnInterrupted`，且只带可接纳的 `turnId`（`messageId` 缺省或不是字符串）
- 已知：无
- 修复方向：两边 id 都不是精确字符串则拒绝承认；承认之后折叠只用已经验证过的那一侧，缺 `messageId` 时用 `turnId`

### BH-05-4

- 严重度：medium
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/sessionCore/local-fact.ts` `isHistoryFillResultPayload` 约 1070–1084 行，`isFiniteNumber` 约 390–392 行。相邻 `src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts` `onHistoryResult` 约 624–681 行先折叠信封再 `planLocalSeqCursorCover`。封面域在 `src/vs/platform/universeAgent/node/sessionCore/l2-seq-cursor-cover.ts` `isCoverThroughIndexable` 约 46–48 行（有限整数即可）；活流推进在 `src/vs/platform/universeAgent/node/sessionCore/l2-seq-cursor.ts` `isGapDomainCount` 约 65–67 行要求安全整数
- 行为：成功回填只要 `coveredThrough` 与 `pagesFetched` 是有限数就通过，不要求整数或安全整数。信封先写入时间线和序号索引。非整数封面被标成 `covered_through_invalid` 且不写游标。大于 `MAX_SAFE_INTEGER` 仍能被封面规划写成 `lastAppliedSeq`
- 为何是缺陷：非整数水位时气泡已经在屏幕上，本地游标停在回填前。下次 hello 按缺口再拉同一段，时间线再叠一份。不安全整数一旦写入游标，之后每条活流事件都在 `planLocalSeqCursorAdvance` 里因 `seq_invalid` 不再前进，缺口判断一直对着这个游标
- 触发：`historyResult` 的 `ok` 为真，信封可折叠，且 `coveredThrough` 不是安全整数（小数，或大于 `Number.MAX_SAFE_INTEGER` 的整数）
- 已知：无
- 修复方向：与活流游标同一安全整数域拒绝 `coveredThrough`；不合法时不要先折叠信封

### BH-05-5

- 严重度：low
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/sessionCore/pending-actions-bound.ts` `pendingActionParentKey` 约 177–180 行；`decidePendingActionUpsert` 约 228–231 行在父键已存在时直接 upsert，不再看 `PENDING_ACTIONS_CAP`（64）。相邻 `admitPendingActionUpserts` 约 270–284 行按该决定放行
- 行为：父键是第一个 `:` 左边的一段；没有冒号则整段 id 算一个父。新父键才占配额，同一父键下的新 requestId 不占
- 为何是缺陷：权限或工具 requestId、或提问 id 若含冒号，不同卡片会共用一个父键，64 的上限不再卡住新增。待办条数可以一直涨，列表和点击目标超出设计容量
- 触发：已有待办 `a` 或 `a:...` 时，再 upsert requestId 形如 `a:其它` 的新卡片，重复直到超过 64 个父键本应拒绝的数量
- 已知：无
- 修复方向：配额按完整 requestId 计数；只有提问子行这一条已知复合 id 才共享父键

## 看过但未立条

- `mailbox.ts` `BoundedMailbox.offer` 满则拒绝入队。相邻 `session-actor.ts` `failClosedOverflow` 约 540–548 行关流、`clear`、并把同步条打成 `mailbox_overflow`。这是有意 fail-closed。`dev/progress/deferred-gaps.md` D405 仍开，但是订阅重开与手测，不是这条入队语义。
- `l2-seq-cursor-cover.ts` `planLocalSeqCursorCover` 在 `sessionVersion` 变化时把 `lastAppliedSeq` 重铺成 `coveredThrough`（约 145–154 行），注释写明版本变化不受单调约束。有意重铺，不立条。
- `question-respond-answer-keys.ts` `planQuestionRespondAnswerKeys` 按未知键 / 非法容器 fail-closed，但 `src/` 内没有生产调用。文件头写明不接 Actor。相邻 `onQuestionRespond` 仍会清卡片，缺的是接线，不在本函数的判定里。
- `l2-seq-index.ts` `feedL2SeqIndex` / `pruneL2SeqIndex` 用 `evictedFloor: 0` 再取出 Map（约 199–226 行），会丢掉水位。生产喂索引走的是 `feedL2SeqIndexState`，这两条 Map API 没有生产调用方。
- `range-replaced-apply.ts` 对缺省 `seq` 的替换行放行，注释写明是不可索引的残留。`fromSeq` 非法、id 为空、替换 seq 越界或重复则拒绝，属于有意 fail-closed。
- `host-write-receipt.ts` `readHostWriteReceiptMarkers` 只认 `host-write-accepted` 加精确 `writeId` / `chatAttemptId`。相邻 `sessionViewHost.ts` `writeChat` 约 1571–1583 行按此盖章。与已关闭的 D51 相同，不另立。
- `local-pending-sends.ts` 满 64 或非法 `operationId` 时跳过新行且不丢旧行。有意 fail-closed。`admitLocalPendingSendUpserts` 注释写明尚未接到 Actor。
- `local-fact.ts` `isInputDeliveryFact` 承认 `dispatched`，但清乐观发送只在相邻折叠里对 `accepted` / `failed` 发生；`dispatched` 留给时间线回声取代。与文件头「dispatched 只做诊断」一致，乐观行仍可由 L2 回声摘掉。

## 未读完

范围内 13 个文件已逐行读完。相邻只读了接线：`session-actor-stream-fold.ts` 的活流推进、range、hello 改写、历史回填；`session-actor-overlay-fold.ts` 的快照应用；`session-actor-local-fact.ts` 的打断、提问、投递回执；`session-actor.ts` 的 `drain` 与 overflow；`sessionViewHost.ts` 的 `writeChat` 盖章。没有通读整个 session-actor，也没有读 `sessions/`、`base/`、`editor/`、`extensions/` 和 VS Code 原生层。
