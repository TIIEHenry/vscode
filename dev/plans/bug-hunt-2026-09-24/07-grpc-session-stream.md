---
title: "GetHistory 缺省 seq 不得当成下一页游标"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "历史页最后一条 seq 缺省或超出安全整数时不得再请求 cursor 0；权限回复与回合/快照解码仍属活流方案。已落地 S1：encodeGetHistoryRequest、decodeGetHistoryResponse、parseCursorSeq 只在最后一条 field 3 大于 0 且不超过 2^53-1 时给出十进制 nextCursorSeq，更大则抛错，请求侧非法游标不再编成 0。"
---

# GetHistory 缺省 seq 不得当成下一页游标

> **本稿是方案，不是实施。**
> **冲突域：** 只动 `grpcSessionAttachWire.ts` 的 `encodeGetHistoryRequest`、`decodeGetHistoryResponse`、`parseCursorSeq`。不占该文件的 Chat 臂、`turn_completed`、overlay field 7，也不占 `decodeMessageEnvelope`。
> **2026-09-24 审查：** 无损判断改在调用 `decodeMessageEnvelope` 之前读 field 3 的原始 `bigint`。冲突域从整份 wire 收到这三个函数。
> **不改** `grpcHandshakeWire` / `grpcDevicePair`（另一路 01）。**不改** file/git/shell wire（另一路 08）。
> **禁止改** [live-stream-bytes-decode](../live-stream-bytes-decode.md) 已占的解码切片：Chat 臂 11/13/20、`turn_lifecycle.turn_completed` 的 `turn_id` / `assistant_turn_id`、overlay `tool_runtime_snapshots`=7。本稿新切片只动 GetHistory 游标。
> **不发明**协议字段。`seq`、`has_more`、请求 cursor 都是 HEAD 已有字段。

## 核查

对照 [扫描文](../../progress/bug-hunt-2026-09-24/07-grpc-session-stream.md) 与 HEAD。

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-07-1 | 已知，见 [live-stream-bytes-decode](../live-stream-bytes-decode.md) | `encodeChatRequest` 约 585–603 行仍只在心跳时 return，其余写入 field 30；`encodeSessionInput` 约 616–622 行不写 `requestId` / `decision`。`writeChat` 约 1602–1605 行在 `resident.write` 返回后标 accepted。该缺口是已签收方案 S6，不是 S1。 |
| BH-07-2 | 已知，见 [live-stream-bytes-decode](../live-stream-bytes-decode.md) | `decodeTurnLifecycleEvent` 约 793–800 行把 `turn_completed` 解成 `{}`。`handleStreamPayload` 约 99–102 行只认顶层 `turn_completed`。`grpcSessionAttachWire.test.ts` 约 832–867 行把 field 13 锁成不出现。已签收方案 S1 要求解出 `turn_id` 与 `assistant_turn_id`，并让 join 兼认嵌套形。 |
| BH-07-3 | 已知，见 [live-stream-bytes-decode](../live-stream-bytes-decode.md) | `decodeRuntimeOverlaySnapshotEvent` 约 812–824 行只解 epoch、`active_turn`、`pending`=6；注释写明 field 7 不读。`onRuntimeOverlaySnapshot` 约 176–179 行要数组才会播种。同一 S1 已要求 `tool_runtime_snapshots`=7 用 `allLengthDelimited` 解成数组，并带根上的 `file_mutation_payload`。 |
| BH-07-4 | 驳回 | bidi `data` 约 321 行确实不看 `gate.closed`，`write` 约 333–336 行关闭后直接 return。用户可见的闪回与误标 accepted 不成立：`openStream` 的 `onClosed` 约 1418–1432 行同步 `postAndDrain(streamClosed)`；Actor `onStreamClosed` 把 `currentAttemptId` 置空并发 `closeStream`；`handleIntent` 约 1058–1064 行在同一次调用栈里 `dispose`，监听器约 1437–1438 行先把 `disposed` 设为 true。之后的帧在约 1390 行返回；即便贴出，`rejectIfStaleAttempt` 约 530–536 行也会丢掉。Chat 的 `onClosed` 约 1305–1316 行同栈删掉 `chatStreams`，随后的 `writeChat` 约 1600 行拿不到这个句柄。 |
| BH-07-5 | 成立 | `decodeMessageEnvelope` 约 951 行用 `Number` 填 `seq`，缺省为 0。`decodeGetHistoryResponse` 约 380–392 行在 `has_more` 时把最后一条 `cursorSeq` 当作 `nextCursorSeq`，于是可以是 `"0"`。`parseCursorSeq` 约 1146–1151 行把 `<=0` 和非安全整数编成游标 0。`fillHistoryGap` 约 82–88 行只在 `nextCursorSeq` 为空时停下，`"0"` 会再请求，直到约 85–86 行 `page_budget_exceeded`。失败结果不应用已收集信封，时间线留下这段历史缺口。 |

## Problem class

- **症状：** GetHistory 本页最后一条没有可用 seq，或 seq 超过 `Number` 安全整数时，补历史反复请求 cursor 0，页数打满后整段结果作废，时间线上这段历史补不上。
- **类标签：** **缺省 seq 被当成下一页游标**。
- **复发机制：** 游标先收成 JS number，0 与精度丢失都变成请求 field 2 的 0；翻页只判断下一页字符串是否非空。

## 0. 一句话结论

历史响应只有在最后一条信封的 seq（field 3）是大于 0 的安全整数时才给出十进制 `nextCursorSeq`。缺省或 0 不写下一页游标。出现但不是安全整数时，这次 GetHistory 失败，禁止再编码成 cursor 0。请求侧空游标与 `"0"` 仍表示第一页起点。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 请求 field 2 由 `parseCursorSeq` 变成 number；空串与 `<=0`、非安全整数都是 0；`encodeInt64Field` 对 0 省略字段 | `grpcSessionAttachWire.ts` `encodeGetHistoryRequest`、`parseCursorSeq`；`grpcProtoCodec.ts` `encodeInt64Field` |
| 信封 `seq`=3 经 `Number(bigint)`，缺省为 0 | `decodeMessageEnvelope` |
| `has_more`=4 为 1 且本页有信封时，`nextCursorSeq` 取最后一条 `cursorSeq` | `decodeGetHistoryResponse` |
| 翻页在 `nextCursorSeq` 为非空字符串时继续，满 64 页返回 `page_budget_exceeded` | `sessionViewHostHistoryFill.ts` `fillHistoryGap` |
| 失败的 history 结果只记 `history.fill_failed`，不把已收集信封贴进时间线 | `session-actor-stream-fold.ts` `onHistoryResult` |
| 第一页游标来自 `String(fromExclusive)`，起点可以是 `"0"` | `fillHistoryGap` |
| Chat 臂、嵌套 `turn_completed`、overlay field 7 仍未按已签收方案落地 | [live-stream-bytes-decode](../live-stream-bytes-decode.md) 文首 2026-09-22 核对；HEAD `encodeChatRequest`、`decodeTurnLifecycleEvent`、`decodeRuntimeOverlaySnapshotEvent` |
| 扫描提到的 ChatSync 映射没有对应 BH 条目 | 扫描文「未读完」 |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 响应侧只在安全正整数 seq 上给出下一页；缺省或 0 省略；非安全整数让本次 GetHistory 失败** | 见 §3 | **选定** |
| B 在 `fillHistoryGap` 里把 `"0"` 当成没有下一页 | 坏游标仍会从别的调用方编码成 0；翻页文件不在本稿要动的 wire 合同里 | **拒绝** |
| C 把信封 `seq` 一律改成十进制字符串 | `decodeMessageEnvelope` 同时服务流与历史；demux 与 `toSafeInt` 认的是 number | **拒绝** |
| D 为游标发明新的 proto 字段 | 请求 field 2 与信封 field 3 已存在 | **拒绝** |
| E 重做 Chat 权限臂、回合 settle、overlay field 7 | 已签收方案占着这些切片 | **拒绝** |
| F 给 bidi `data` 补 `gate.closed`，关闭后 `write` 抛错 | BH-07-4 的用户可见后果不成立 | **拒绝** |

## 3. 选定设计（A）

1. **S1 GetHistory 游标。** 只改 `encodeGetHistoryRequest`、`decodeGetHistoryResponse`、`parseCursorSeq`。`decodeMessageEnvelope`（约 951 行 `numberOrZero(lastVarint(fields, 3))`）不改：`Number(2n ** 53n + 1n)` 会变成仍被 `Number.isSafeInteger` 接受的 `2^53`，看 `payload.seq` 实现不了「大于 `2^53−1` 就抛」。
   响应：在调用 `decodeMessageEnvelope` **之前**，用最后一条信封 field 3 的原始 `bigint` 判断。`has_more` 为真时，仅当该 `bigint` 存在、大于 0、且 `<= 2n ** 53n - 1n`，才设置 `nextCursorSeq` 为它的十进制字符串。field 3 缺省或值为 0 时不设置 `nextCursorSeq`。field 3 存在但大于 `2^53−1` 时，`decodeGetHistoryResponse` 抛错，不进入共用解码；现有 `getHistory` 失败，`fillHistoryGap` 的 `catch` 收成 `transport_failed`。禁止先 `Number` 再 `String` 当成下一页。
   请求：`cursorSeq` 缺省、空串或 `"0"` 仍编成起点（field 2 省略，与今日 0 相同），这样 `fromExclusive === 0` 的第一页不变。其它非空字符串若不是大于 0 的安全整数，`encodeGetHistoryRequest` 抛错，禁止落成 cursor 0。
   不改 `fillHistoryGap` 的循环，不改 Actor 的 history 结果形状。

## 4. 不做

- BH-07-1 / BH-07-2 / BH-07-3：不改 Chat 臂、`turn_completed` 内层、overlay field 7（[live-stream-bytes-decode](../live-stream-bytes-decode.md) S6 与 S1）
- BH-07-4：不改 bidi 关闭闸
- 不把 `decodeMessageEnvelope.seq` 改成字符串
- 不改 `grpcHandshakeWire` / `grpcDevicePair`，不改 file/git/shell wire
- 不为 ChatSync 另开切片（本轮没有对应 BH）
- 重开 GitHub Actions

## 5. 验证

本地、点名现有文件，不跑托管 CI。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| S1 | `src/vs/platform/universeAgent/test/node/grpcSessionAttachWire.test.ts`（`decodeGetHistoryResponse maps envelope seq to cursorSeq`、`encodeGetHistoryRequest uses page_size + FORWARD_AFTER`）；`src/vs/platform/universeAgent/test/node/sessionViewHostHistoryFill.test.ts`（`pages with nextCursorSeq until the window is covered`） | 最后一条 field 3 的原始 varint 为 7 且 `has_more`=1：`nextCursorSeq` 仍是 `'7'`。`has_more`=1 但最后一条没有 field 3：结果没有 `nextCursorSeq`，不是 `'0'`，`fillHistoryGap` 按成功停下并保留已收集行。field 3 的原始 `bigint` 为 `2n ** 53n + 1n`：在 `decodeMessageEnvelope` 之前抛错，不把 `payload.seq` 收成 `2^53`。`encodeGetHistoryRequest` 的 `cursorSeq: '0'` 仍省略 field 2；传入一个非安全整数字符串时抛错，编码结果里不是 cursor 0。翻页测试保持「有非空下一页才继续」 |

门禁命令沿用 [health-gates](../../progress/health-gates.md)：`scripts/test.sh` 点名上表文件。
