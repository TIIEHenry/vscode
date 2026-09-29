---
title: "序号索引不再因 64 条丢掉改写删不掉的气泡；快照铸行失败时保留仍可回答的待办"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "BH-05-1 与 BH-05-2 在 HEAD 仍成立。索引停止按容量丢掉已写入的 seq；铸不出的待办行若已在列表里则保留。非提问待办按完整 requestId 计配额。BH-05-3 与 BH-05-4 驳回。含冒号的不同 questionId 仍共用父键，作为残余接受。"
---

# 序号索引与待办快照

> **本稿是方案，不是实施。** 不改产品源码。
> **2026-09-24 决策：** 权限 / client tool 冒号 id 收进 S3。提问仍按父键；含冒号的不同 questionId 共用父键，作为残余接受。链路本地、错轮次覆盖、缺角色、多根第一仓库维持开放，不在本稿。
> **2026-09-24 签收审查：** Approve with changes。第 28、122、137 行已按保留提问父键改完。
> **2026-09-29 实施：** S1–S3 已落在本工位 `l2-seq-index.ts` 与 `pending-actions-bound.ts`。本工位同步脚本默认上游路径不存在，Desktop 检出也不在 SYNC.md 钉死的提交上，故未改上游、未跑全量同步。frontmatter 仍为 `accepted`。
> **冲突域：** `src/vs/platform/universeAgent/node/sessionCore/` 下 `mailbox.ts`、`intents.ts`、`messages.ts`、`pending-actions-bound.ts`、`local-pending-sends.ts`、`l2-seq-cursor.ts`、`l2-seq-cursor-cover.ts`、`l2-seq-index.ts`、`range-replaced-apply.ts`、`question-respond-answer-keys.ts`、`host-write-receipt.ts`、`ports.ts`、`local-fact.ts`。
> **不改** `session-actor*.ts`（[04-session-actor](04-session-actor.md)）。
> 与 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 或 [conversation-stream-timeline](../conversation-stream-timeline.md) 重复的只交叉引用，不另起实施切片。
> 这些文件是 vendored session-core。[SYNC.md](../../../src/vs/platform/universeAgent/node/sessionCore/SYNC.md) 与 [giant-file-split](../giant-file-split.md) 要求先在上游改同一函数，再同步。本稿只写不变量。
> **扫描来源：** [05-mailbox-seq](../../progress/bug-hunt-2026-09-24/05-mailbox-seq.md)。行号按 2026-09-24 HEAD 符号复核。

## 核查

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-05-1 | 成立 | `feedL2SeqIndexState`（`l2-seq-index.ts` 约 144–163 行）经 `evictLowestUntilCap`（约 95–108 行）在超过 `L2_SEQ_INDEX_CAP`（64，约 34 行）时删掉最小 seq，并抬高只增不减的 `evictedFloor`。生产 `feedIndex`（`session-actor-stream-fold.ts` 约 184–185 行）走的就是这条。`dropMirrorFromSeq`（约 477–489 行）只为仍留在 Map 里且 `seq >= dropFromSeq` 的项发 `removeTimelineItem`。`l2SeqIndexCoversFrom`（约 190–192 行）没有生产调用方。时间线类型禁止带 seq，被挤出的 id 无法再按窗口找回。hello 改写（`consumeRewriteWindowFromHello` 约 446–450 行）先按这张 Map 删，再 `maybeEmitHistoryFill`。回填只 upsert。同一 id 会被盖住；窗口里没回到回填里的旧 id，以及换成新 id 的旧气泡，留在时间线上。 |
| BH-05-2 | 成立 | `planOverlayPendingSetReplace`（`pending-actions-bound.ts` 约 517–540 行）在 requestId 能规范化后先写入 `seenIds`，`pendingActionFromOverlayItem` 返回 `undefined` 则 `continue`，该 id 不进 `mapped` / `desiredIds`。已迁移且不在 `desiredIds` 里的待办发 `removePendingAction`。重复 id 整帧 `skip_ambiguous_pending_ids`（约 520–522 行），铸行失败不会。铸行失败点仍在：提问描述 trim 后为空或 `questions` 不是数组（约 416–424 行）；权限缺工具名或描述为空（约 390–396 行）；client tool 缺 `toolName` / `argumentsJson`（约 446–450 行）。形状门 `isOverlayPendingSnapshotItemShape`（`local-fact.ts` 约 451–463 行）只要求 `requestId`、`kind`、`description` 是字符串，空描述和缺 `questions` 仍放行。demux 会交出这种行（`sessionStreamDemux.ts` `demuxRuntimeOverlay` 约 765–785 行：描述可为空，提问没有条目就不带 `questions`，工具名或参数空则省略）。`onOverlayPendingSnapshot`（`session-actor-overlay-fold.ts` 约 75–90 行）在未触配额时应用这份 remove/upsert。卡片从界面消失，同帧其它铸得出来的待办仍更新。 |
| BH-05-3 | 驳回 | `isTurnInterruptedFact`（`local-fact.ts` 约 944–955 行）仍是 `turnId` 或 `messageId` 有一边精确字符串就返回真，`onTurnInterrupted`（`session-actor-local-fact.ts` 约 515–516 行）仍读 `fact.messageId.length`，`drain`（`session-actor.ts` 约 333–350 行）仍无 catch。全仓没有投递 `kind: 'turnInterrupted'` 的生产路径；`writeMessageToCoreFact`（`sessionViewHost.ts` 约 146–191 行）不含该 kind。单边 id 的 TypeError 和信箱停排在当前用户路径上到不了。 |
| BH-05-4 | 驳回 | `isHistoryFillResultPayload`（`local-fact.ts` 约 1070–1084 行）仍只要求 `coveredThrough` / `pagesFetched` 为有限数；`isCoverThroughIndexable`（`l2-seq-cursor-cover.ts` 约 46–48 行）仍是有限整数即可，活流 `isGapDomainCount`（`l2-seq-cursor.ts` 约 65–67 行）仍要安全整数。唯一成功回帖来自 `fillHistoryGap`（`sessionViewHostHistoryFill.ts` 约 30–36、142–152 行）：窗口与 `seq` 都先过 `Number.isSafeInteger`，`coveredThrough` 只从这些安全整数赋值。宿主原样 post（`sessionViewHost.ts` 约 1654–1674 行）。非整数或超出安全整数的封面不会从这条路径进时间线，游标也不会因此分叉。 |
| BH-05-5 | 部分成立 | 权限 / client tool 的 id 可以含冒号：`isExactToken` 允许冒号，`canonicalizeOverlayPendingRequestId` 原样返回 `requestId`。这半由 S3 按完整 id 计配额。提问 id 是 `questionId` 原样，入口允许冒号（`sessionStreamDemux.ts` `isExactToken`、`local-fact.ts` `isQuestionAskedFact`、`session-actor-local-fact.ts` `onQuestionAsked`）。两道不同提问 `a:1` 与 `a:2` 在 S3 之后仍共用父键 `a`，第二道不占配额。同一 `questionId` 重复仍走精确命中。这个提问残余接受，不改成按完整 id 计数。 |

## 驳回

BH-05-3、BH-05-4 见上表。不进下面的问题类和切片。BH-05-5 的提问铸行半同样不进切片；权限 / client tool 冒号 id 见 S3。

## Problem class

- **症状：** 可索引 seq 超过 64 之后，hello 改写窗口若从已被挤出的 seq 起算，时间线上留下旧气泡，历史回填再叠上新内容。overlay 快照里某张已在列表中的权限、提问或可响应工具卡片若描述为空、提问没有 `questions` 数组、或 client tool 缺工具名 / 参数，这张卡被摘掉，用户不能再点允许或回答。
- **类标签：** 有损 seq 索引被当成改写删除全集；铸行失败被当成引擎已取消。
- **复发机制：** 容量驱逐只改 Map 和 `evictedFloor`，不保留被删 id；set-replace 用「铸得出来的 id」当期望集合，铸失败的 id 落进删除支。

显示写源与 `fillHistoryGap` 的 `{ seq, arm, body }` + `pagesFetched` / `coveredThrough` 合同仍以 [conversation-stream-timeline](../conversation-stream-timeline.md) 已落的 HistoryFill 行为准。解码与 Create 恢复仍以 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 为准。本稿不重写这两处。

## 0. 一句话结论

`feedL2SeqIndexState` / `createL2SeqIndexState` 不再因为 64 条上限从 `entries` 丢掉已经写入的 seq。`planOverlayPendingSetReplace` 在铸行失败且当前列表已有同一 requestId 时不发 `removePendingAction`。非提问待办按完整 `requestId` 计配额，提问仍按父键。Actor 文件不动：现有 `dropMirrorFromSeq` 仍遍历整张 Map，现有 overlay 折叠仍应用规划结果。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 索引上限 64，驱逐策略是删最小 seq，不是拒绝新行 | `l2-seq-index.ts` `L2_SEQ_INDEX_CAP` 约 34 行；`evictLowestUntilCap` 约 95–108 行 |
| 喂入后 `evictedFloor` 取先前水位、地址拒绝 seq、本次被删最高 seq 的最大者，只增不减 | `feedL2SeqIndexState` 约 144–163 行 |
| 有意 prune 不改水位 | `pruneL2SeqIndexState` 约 172–183 行 |
| `fromSeq > evictedFloor` 才算覆盖；水位 0 时任意正 fromSeq 通过。无生产调用方 | `l2SeqIndexCoversFrom` 约 190–192 行 |
| 活流与历史回填都 `feedL2SeqIndexState`，不走把水位清零的 Map API | `session-actor-stream-fold.ts` `feedIndex` 约 184–185 行；`feedL2SeqIndex` / `pruneL2SeqIndex` 约 199–226 行无生产调用方。Actor 接线不在本稿改 |
| hello 的 `lastMutatedFromSeq` 与本地水位不同则 `rewriteWindow`，`dropFromSeq` 为该 seq（0 则从 1） | `stream-hello-gap.ts` `planGapFromStreamHello` 约 132–140 行；`planRewriteWindowBounds` 约 167–178 行 |
| 改写先 `dropMirrorFromSeq`，再按窗口 `fillHistoryGap` | `consumeRewriteWindowFromHello` 约 446–471 行。历史分页合同见 [conversation-stream-timeline](../conversation-stream-timeline.md)，本稿不改宿主 |
| 视图类型禁止在时间线项上放 seq | `common/sessionView/types.ts` 文件头 |
| 时间线 id 来自 `operationId`，否则 `body.id` | `stream-event-to-view-patch.ts` `timelineItemIdFromDomain` 约 217–220 行 |
| 快照项能规范化就进 `seenIds`；铸行失败跳过；期望集合只含铸成的行 | `planOverlayPendingSetReplace` 约 513–540 行 |
| 重复 requestId 整帧不应用 | 同函数约 520–522 行，`skip_ambiguous_pending_ids` |
| 空描述、非数组 `questions`、缺工具名或参数则铸行返回 `undefined` | `pendingActionFromOverlayItem` 约 385–450 行 |
| 事件形状门不要求描述非空，也不要求 `questions` 为数组 | `isOverlayPendingSnapshotItemShape` 约 451–463 行 |
| demux 对空描述写入 `''`，提问没有可投影条目就不带 `questions`，空工具名 / 空参数省略 | `sessionStreamDemux.ts` `demuxRuntimeOverlay` 约 765–785 行。解码臂本身见 [live-stream-bytes-decode](../live-stream-bytes-decode.md)，本稿不改 demux |
| 配额未跳过时，规划出的 remove/upsert 写进快照 | `onOverlayPendingSnapshot` 约 75–90 行。该折叠文件属于方案 04 的冲突域，本稿只把它当已有应用点 |

## 2. Options

| 选项 | 结论 |
|:-----|:-----|
| A. `feedL2SeqIndexState` 与 `createL2SeqIndexState` 不再因容量调用 `evictLowestUntilCap`。已写入的 `(seq, itemId)` 留在 `entries`，直到 `pruneL2SeqIndexState` 按给出的 seq 删除。`evictedFloor` 不再因容量升高 | **选定**，作 S1 |
| B. 保持 64，改写前若 `l2SeqIndexCoversFrom` 为假就整段降级，并按 id 删窗口内时间线 | **拒绝。** 被驱逐的 id 已经不在 Map 里，时间线项又没有 seq，按窗口删不回来。调用点在 `dropMirrorFromSeq`，属于 [04-session-actor](04-session-actor.md) |
| C. 把上限抬到一个更大的常数 | **拒绝。** 更长的会话仍会丢掉最小 seq，同一条用户可见后果还在 |
| D. 铸行失败且 `current` 已有同一 requestId：该 id 留在期望集合里，不 `removePendingAction`，也不 upsert 新行。当前没有该 id 则仍跳过，不发明行。重复 id 仍整帧 `skip_ambiguous_pending_ids` | **选定**，作 S2 |
| E. 任一铸行失败就整帧 `skip_ambiguous_pending_ids` | **拒绝。** 一行空描述会冻住同帧其它仍完整的权限或提问更新 |
| F. 把铸行失败继续当成「引擎已取消」 | **拒绝。** 这就是 BH-05-2 |
| G. 在 demux 里补默认标题、空 `questions` 或空参数，让铸行一定成功 | **拒绝。** 与 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 抢解码路径，并会发明当前折叠明确不写的占位正文 |

## 3. 选定设计

实施时在上游 `packages/session-core` 的同名函数落下同样不变量，再跑同步脚本。不要只改本仓副本。

### S1 — 容量不再丢掉已索引的 seq

落点：`l2-seq-index.ts` 的 `createL2SeqIndexState`、`feedL2SeqIndexState`。`feedL2SeqIndex` 已委托后者，跟着同一不变量，不另写一套驱逐。

不变量：

- 一次 feed 或 create 之后，输入里每个已通过 `isL2SeqIndexable` 且 `isL2SeqIndexAddress` 的 `(seq, itemId)` 都在返回的 `entries` 里（同一 seq 后写覆盖先写，与现在一致）。
- 调用前 `entries` 里已有的 seq，只要这次 feed 没有用可索引且可寻址的新 id 覆盖它，就仍在返回的 `entries` 里。
- `evictedFloor` 不再因为条目数超过 `L2_SEQ_INDEX_CAP` 而升高。地址拒绝仍可抬高水位，规则保持文件头现述：不写入、不 trim。
- `pruneL2SeqIndexState` 仍只删调用方列出的 seq，且不改 `evictedFloor`。
- `L2_SEQ_INDEX_CAP` 常量留着，标明与待办上限同一量级，但不再作为删行条件。时间线本身无 64 条上限，索引与时间线同阶增长。

现有 `dropMirrorFromSeq` 继续只遍历 `seqIndex`。S1 之后这张 Map 仍含改写窗口里曾经索引过的 seq，因此会发出对应的 `removeTimelineItem`。不改 Actor。

### S2 — 铸不出的已有待办保持在列表里

落点：`pending-actions-bound.ts` 的 `planOverlayPendingSetReplace`。`pendingActionFromOverlayItem` 的失败条件不放宽，也不发明标题、空 `questions` 或空参数。

不变量：

- requestId 规范化为 `''`：仍丢行，不进 `seenIds`。
- 同一帧出现第二个相同的规范化 id：仍返回 `skip_ambiguous_pending_ids`，0 条 patch。
- `pendingActionFromOverlayItem` 返回 `undefined`，且 `current` 里已有该 requestId：该 id 算在期望集合内。不发 `removePendingAction`，不发 `upsertPendingAction`。列表里的旧行保持可点。
- 铸行失败且 `current` 没有该 id：跳过，不发明行。
- 铸行成功的项仍 upsert。快照里完全没有的、已迁移的 requestId 仍 `removePendingAction`（引擎没再列出这张卡）。
- 本函数仍不调用 `decidePendingActionUpsert`。配额仍由现有 admit 在应用点处理。

`onOverlayPendingSnapshot` 已在 `kind === 'apply'` 时应用 `patches`。S2 只改规划结果，不改该折叠。

### S3 — 非提问待办按完整 requestId 计配额

落点：`pending-actions-bound.ts` 的 `decidePendingActionUpsert` 与 `countPendingActionParents`。配额键是文件私有的：该行 `summary.kind === 'question'` 时取 `pendingActionParentKey(requestId)`，否则取完整 `requestId`。键不含 kind，已有 permission `a` 时新提问 `a:x` 仍命中同键放行，反过来也一样。入参和 `current` 各行的 `summary.kind` 都按 `readLocalPendingSendSummaryKind` 那种两层自有数据读取；读不到按非提问处理。文件头 INV-PAB-OWN-1 补上 `summary.kind`。`pendingActionParentKey` 本身、INV-QAF-2 的提问反函数、`exists` 精确命中即 upsert、`admitPendingActionUpserts` 的遍历顺序都不改。注释改三处：文件头「Permission / clientTool requestIds have no ':'」、`pendingActionParentKey` 的「Parent quota key」、`decidePendingActionUpsert` 的「allow sibling children under an existing parent」，改完后只对提问成立。不改 `session-actor-overlay-fold.ts`、`session-actor-stream-fold.ts`、`question-ask.ts`、`sessionStreamDemux.ts`、`local-fact.ts`、`planOverlayPendingSetReplace`。先在上游 `packages/session-core` 同名函数落下，再同步。

## 4. 不做

- 不改 `session-actor*.ts`，包括 `dropMirrorFromSeq`、`onHistoryResult`、`onTurnInterrupted`、`drain`。
- 不改 `sessionViewHost.ts`、`sessionStreamDemux.ts`、`sessionViewHostHistoryFill.ts`。HistoryFill 与解码分别留在 [conversation-stream-timeline](../conversation-stream-timeline.md) 与 [live-stream-bytes-decode](../live-stream-bytes-decode.md)。
- 不把 `l2SeqIndexCoversFrom` 接到改写路径。S1 之后删除集就是 Map 本身。
- 不收紧 `isHistoryFillResultPayload`，不改 `planLocalSeqCursorCover` 的整数域。BH-05-4 的用户可见分叉不在 HEAD 的回填路径上。
- 不把 `isTurnInterruptedFact` 改成必须两边 id 都在。BH-05-3 没有生产投递。
- 不把提问待办改成按完整 requestId 计数。含冒号的不同 `questionId` 仍共用父键，第二道不占配额，作为已接受的残余。同一 `questionId` 重复仍走精确命中。非提问的冒号绕过由 S3 收。
- 不改 `mailbox.ts` 满则拒绝的语义，不改 `range-replaced-apply.ts`、`question-respond-answer-keys.ts`、`host-write-receipt.ts`、`local-pending-sends.ts` 里扫描已标明的 fail-closed。
- 不发明协议字段，不给时间线项加 seq。

## 5. 验证

现有路径里没有调用 `feedL2SeqIndexState`、`planOverlayPendingSetReplace`、`decidePendingActionUpsert` 或 `countPendingActionParents` 的测试。历史回填行为仍由 `src/vs/platform/universeAgent/test/node/sessionViewHostHistoryFill.test.ts` 覆盖；S1/S2 不改它的 `coveredThrough`。universeAgent 单测收集见 `scripts/run-unit-custom.sh`（`scripts/test.sh --tfs universeAgent`）。

在 `src/vs/platform/universeAgent/test/node/` 新增断言，让上述收集能扫到：

- 连续 feed 65 个不同正整数 seq 之后，`entries` 仍含 seq 1 与 seq 65，`evictedFloor` 仍为 `L2_SEQ_INDEX_FLOOR_NONE`。随后 `pruneL2SeqIndexState` 只删 seq 1，seq 65 还在，水位不变。
- 地址不合法的 feed 仍不写入该 id，水位仍可升高（与 S1 不冲突的旧规则）。
- `current` 里已有一条 `question` 待办时，快照再次带上同一 requestId，但 `description` 为 `''` 或 `questions` 不是数组：规划 `kind === 'apply'`，patches 里没有该 id 的 `removePendingAction`，也没有该 id 的 upsert。同帧另一条铸行成功的 permission 仍 upsert。
- 快照里根本没有该 requestId：仍有 `removePendingAction`。
- 同一 requestId 出现两次：仍是 `skip_ambiguous_pending_ids`，patches 为空。
- `current` 已有 64 条不同的 permission 父键 `p0`…`p63` 时，upsert permission `p0:x` 返回 `skip_at_capacity` / `pending_actions_at_capacity`。满额且已有提问 `q` 时，upsert 提问 `q:c1` 仍是 upsert，记为已接受的提问残余。满额时精确已存在的 id 仍是 upsert。permission `a` 与 `a:b` 在 `countPendingActionParents` 里计为 2。

本地按改动面跑上述新测试，加上 `npm run compile-client`（只动这些 TypeScript 时）或 `npm run compile`。不要为此重开 GitHub Actions。
