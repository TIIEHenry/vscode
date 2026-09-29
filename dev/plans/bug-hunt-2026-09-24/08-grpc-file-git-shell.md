---
title: "上传 oneof 与 Git 暂存不得丢掉调用方已经传入的臂和空元素"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "同一帧不得同时写 UploadChunk 的 header 与 chunk；空 chunk 仍占 chunk 臂；Git 暂存的空 argv 与空命令保留在线上。"
---

# 上传 oneof 与 Git 暂存不得丢掉调用方已经传入的臂和空元素

> **本稿是方案，不是实施。**
> **2026-09-24 审查：** 抛错同步穿出 `write`，客户端不接住。连接层「空 chunk 原样」由 S2 对齐；同帧两臂仍抛错。`universeAgentConnection.test.ts` 的双写走 Mock，不经过编码器，那则测试不改。
> **2026-09-29 实施（loop/G）：** S1–S3 已落在 `grpcUploadAttachmentStreamWire.ts`、`grpcGitUnaryWire.ts` 及这两份 wire 单测。同帧两臂由 `encodeUploadChunk` 抛错，`grpcClient.ts` 的 `write` 未改、仍不接住。frontmatter 保持 `accepted`。
> **冲突域：** `src/vs/platform/universeAgent/node/grpc/grpcUploadAttachmentStreamWire.ts`、`grpcGitUnaryWire.ts`，以及这两份 wire 的现有单测。
> **不改** `grpcProtoCodec.ts` 的 `encodeBytesField` / `encodeStringField`。`encodeRepeatedString` 在 `grpcGitUnaryWire.ts` 约 165–170 行，同样不改；ApplyHunks 的空 `patches` 仍走它。文件写入的空 bytes、标量空串仍按 proto3 缺省省略。**不改** Sources 请求组装、Changes 列表、Diff Stage 调用点。
> **不碰** [live-stream-bytes-decode](../live-stream-bytes-decode.md) 的 Chat / SessionStream oneof，也不碰 [07-grpc-session-stream](07-grpc-session-stream.md) 的 GetHistory 游标。扫描未立 Shell，本稿不碰 Shell。
> **不发明**协议字段。`header`=1、`chunk`=2、`offset`=3、`session_id`=1、`commands`=2、`argv`=1 都是 HEAD 注释里已有的号。

## 核查表

对照 [扫描文](../../progress/bug-hunt-2026-09-24/08-grpc-file-git-shell.md) 与 HEAD。

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-08-1 | 成立 | `UniverseAgentUploadChunk` 注释写明 `oneof header \| chunk`。`encodeUploadChunk` 先写字段 1 再写字段 2。只有 `chunk` 长度大于 0 时字段 2 才会出现；此时与 `header` 同帧，两臂都在线上，后出现的是 chunk。长度为 0 的 `chunk` 今天被省略，线上只剩 header。workbench 还没有同帧双写的调用方。`write` 原样送出编码结果。 |
| BH-08-2 | 成立 | 同上类型是 oneof。`encodeBytesField` 对长度为 0 的字节返回空缓冲。单测把 `{ chunk: 空, offset: 8 }` 锁成字段 2 不出现、字段 3 仍为 8。空 header 已用 `encodePresentMessageField` 占住 header 臂；空 chunk 没有同等存在性。连接注释写空 `chunk` 原样上线。 |
| BH-08-3 | 成立 | `encodeStringField` 丢掉空串。`{ argv: [''] }` 因此变成空缓冲，`encodeMessageField` 再丢掉整段 `GitArgvCommand`。`sourcesGitStagePathsRequest` 仍组出 `{ argv: [''] }`。Changes 列表 `gitPath ?? fsPath` 在 `gitPath === ''` 时不会改用本地路径。接受条件是 `supported && success`，成功后整批刷新。[sources-review-open-identity](../sources-review-open-identity.md) S3 已签收、尚未落地：HEAD 的 Diff `runStage` 仍会把 `sourcesDiffLocalWritePath` 的 `''` 送进暂存。本稿不实现那个调用点闸门。 |

## Problem class

- **症状：** 同一次上传 `write` 若同时带上 header 和非空 chunk，线上两臂都在，后写的 chunk 臂留下，header 里的 `session_id` 不在这一臂上。长度为 0 的上传片只剩偏移。暂存请求里的空路径在线上消失，界面仍按整次 RPC 成功刷新。当前没有产品代码做同帧双写。
- **类标签：** **oneof 后写覆盖**，以及 **重复字段里的空元素被当成缺省删掉**。
- **复发机制：** 长度分隔字段长度为 0 就整段省略。oneof 靠「字段出现」选臂，嵌套消息靠「子缓冲非空」才写上。空串、空字节因此既选不中臂，也留不住调用方传入的那一条。

## 0. 一句话结论

`UploadChunk` 一次编码只占 `header` 或 `chunk` 的一臂；`chunk` 已传入时，长度为 0 也写出字段 2。`WriteGitStagePaths` 里调用方传入的每条 `GitArgvCommand` 都保留，`argv` 里的空字符串写成长度 0 的字段 1。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `UploadChunk` 是 `oneof data`：`header`=1 / `chunk`=2，`offset`=3。空 header 对象仍写 oneof 存在性 | `grpcUploadAttachmentStreamWire.ts` `encodeUploadChunk` |
| `header` 与长度大于 0 的 `chunk` 同帧时，字段 1 与字段 2 都写上。长度为 0 的 `chunk` 今天不写字段 2 | 同上，约 29–32 行；`encodeBytesField` |
| `openUploadAttachmentStream` 的 `write` 调用 `encodeUploadChunk` 后原样 `handle.write`，没有 try/catch | `grpcClient.ts` 约 2916–2917 行 |
| 类型允许 `header` 与 `chunk` 同时出现。workbench 没有调用方把两者放进同一次 `write` | `universeAgentTypes.ts` `UniverseAgentUploadChunk`；扫描文 BH-08-1 |
| 连接测试在同一次 `write` 里带 header 和长度为 0 的 `chunk`，对象原样进 Mock，不调用 `encodeUploadChunk` | `universeAgentConnection.test.ts` 约 9894–9907 行 |
| 连接注释：空 `chunk` 原样映射 | `universeAgentConnection.ts` 约 1850–1852 行；`universeAgentTypes.ts` 约 3199 行 |
| 长度 0 的 bytes 不写字段 | `grpcProtoCodec.ts` `encodeBytesField`；`encodeMessageField` 走同一函数 |
| 空子消息仍写 tag 与长度 0 | 同文件 `encodePresentMessageField` |
| 单测：空 `chunk` 省略、`offset` 8 仍在；header 与 chunk 分属两个用例 | `grpcUploadAttachmentStreamWire.test.ts` |
| `WriteGitStagePaths`：`session_id`=1，repeated `commands`=2；`GitArgvCommand.argv`=1。约 111 行注释写明空串与空嵌套省略。`encodeRepeatedString` 是本文件约 165–170 行的函数 | `grpcGitUnaryWire.ts` `encodeWriteGitStagePathsRequest` / `encodeGitArgvCommand` / `encodeRepeatedString` |
| 空串不写字段 | `grpcProtoCodec.ts` `encodeStringField` |
| 类型注释：空 `commands` / 空 `argv` 原样送出 | `universeAgentTypes.ts` `UniverseAgentWriteGitStagePathsRequest` |
| 每个路径一条 `{ argv: [path] }`，空路径保留 | `sourcesChangesGitWrite.ts` `sourcesGitStagePathsRequest` |
| 列表暂存用 `gitPath ?? fsPath` | `sourcesChangesList.ts` `runOnSelected` / `runResourceAction` |
| 接受且刷新的条件是 `supported && success` | `sourcesChangesGitWrite.ts` `isSourcesGitWriteAccepted`；`sourcesChangesList.ts` `tryStagePaths` |
| 单测：`{ sessionId: '', commands: [] }` 与 `{ argv: [] }` 都锁成整段省略，是两条断言。请求组装把 `['']` 锁成一条命令 | `grpcGitUnaryWire.test.ts` 约 203–205 行；`sourcesChangesGitWrite.test.ts` |
| Diff Stage 仍调用暂存，路径来自 `sourcesDiffLocalWritePath`；非 file 且没有 `scmResource` 时该函数返回 `''`。已签收方案 S3 要求空则不调 hook，HEAD 还没有这道闸门 | `conversationDiffReviewPane.ts` `runStage` 约 395 行；`sourcesDiffPanelView.ts` `getWriteContext` 约 384–397 行、`runStage` 约 513–525 行；`sourcesChangeRef.ts` `sourcesDiffLocalWritePath`；[sources-review-open-identity](../sources-review-open-identity.md) S3 |
| ApplyHunks 的空 `patches` 是另一条已签收合同 | [sources-accept-empty-success](../sources-accept-empty-success.md)；[ADR-008](../../decisions/008-write-git-apply-hunks-empty.md) |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 上传一帧只占一臂；空 chunk 仍写字段 2；暂存空 argv 与空命令留在线上** | 见 §3 | **选定** |
| B 两臂都有时静默只留 header 或只留 chunk | 另一臂仍被丢掉，调用方不知道 | **拒绝** |
| C 在 `write` 里把一帧拆成两次发送 | 调用方只调了一次 `write`；拆帧会改变流上的消息条数 | **拒绝** |
| D 改全局 `encodeBytesField` / `encodeStringField`，让所有空 bytes / 空串都上线 | 文件内容的空 bytes、标量空串的 proto3 省略会一起变 | **拒绝** |
| E 在 Changes 列表把 `gitPath === ''` 换成 `fsPath`，或在请求组装里丢掉空路径 | 类型与 `sourcesGitStagePathsRequest` 的合同是空路径原样保留。Diff 调用点已另有方案 | **拒绝** |
| F 重做 Chat / SessionStream oneof，或改 ApplyHunks 空补丁 | 分别属于已签收的活流方案与 ADR-008 | **拒绝** |

## 3. 选定设计

1. **S1 上传一帧只占一臂（BH-08-1）。** 只改 `encodeUploadChunk`。`header` 与 `chunk` 同时不是 `undefined` 时抛错。这一帧被拒绝，头和正文都不送出。调用方要两者都上线，就分两次 `write`：一次只有 header，一次只有 chunk。只传 `header` 时仍只写字段 1（空 header 对象继续用现有的存在性写法）。只传 `chunk` 时只写字段 2。`offset` 仍是字段 3，0 继续省略。`openUploadAttachmentStream` 的 `write` 继续原样送出编码结果，不在客户端里把一次 `write` 拆成两帧，也不接住这次抛错：`grpcClient.ts` 约 2916–2917 行没有 try/catch，异常同步离开 `write()`。长度为 0 的 `chunk` 与 `header` 同在也抛错。连接注释（`universeAgentConnection.ts` 约 1850–1852 行、`universeAgentTypes.ts` 约 3199 行）说的是空 `chunk` 原样映射；对齐它的是 S2。同帧两臂仍按本条抛错，不为那条注释把两臂都编码。`universeAgentConnection.test.ts` 约 9894–9907 行走 Mock，对象原样入列，不调用 `encodeUploadChunk`；这则测试保持绿色，也不改成断言抛错。落地时改本文件约 25–26 行注释：没有 `header` 的空 `chunk` 占住字段 2；两臂同时出现则编码失败。

2. **S2 空 chunk 占住 chunk 臂（BH-08-2）。** `chunk` 已传入（含长度为 0）且没有 `header` 时，字段 2 必须出现：长度为 0 时写 tag 与长度 0。bytes 与 message 都是 wire type 2，字段 2、载荷长度 0 与现有 `encodePresentMessageField` 的 tag 相同，写法放在本文件内。非空 `chunk` 继续走 `encodeBytesField`。`chunk` 为 `undefined` 时不写字段 2。不改 `encodeBytesField`。`offset` 非 0 仍写字段 3。

3. **S3 暂存保留空 argv 与空命令（BH-08-3）。** 只改 `encodeWriteGitStagePathsRequest` / `encodeGitArgvCommand`。`commands` 里的每一条都用 `encodePresentMessageField(2, …)` 写出，子缓冲长度为 0 也保留这条命令。`argv` 的每个元素都写字段 1，空字符串写长度 0；不走会丢掉空串的 `encodeStringField`。`argv: []` 仍是一条空的 field 2 消息，不再整段消失。`session_id` 空串继续省略。不改 `encodeRepeatedString`（本文件约 165–170 行），因此 `encodeWriteGitApplyHunksRequest` 的省略保持今天的行为。落地时改约 111 行注释：本请求的空命令与空 argv 元素保留；`session_id` 空串仍省略。

## 4. 不做

- 不改 `grpcProtoCodec.ts` 的 `encodeBytesField` / `encodeStringField`，也不改本文件 `encodeRepeatedString`
- 不在 `write` 里接住 S1 的抛错，也不改 `universeAgentConnection.test.ts` 约 9894–9907 行的 Mock 双写
- 不改 `sourcesGitStagePathsRequest`、`sourcesChangesList.ts` 的 `gitPath ?? fsPath`
- 不实现 [sources-review-open-identity](../sources-review-open-identity.md) S3。该闸门已签收、HEAD 未落地；本稿只改暂存编码，不在 `conversationDiffReviewPane.ts` 与 `sourcesDiffPanelView.ts` 的 `runStage` 加「空路径不发送」
- 扫描未立 Shell（取消流会 `call.cancel()`，空标量省略与 proto3 一致）。本稿不改 Shell wire
- 不改 ApplyHunks、Commit，不改文件读/写的空 bytes 省略
- 不改 Chat / SessionStream 解码（[live-stream-bytes-decode](../live-stream-bytes-decode.md)）
- 不发明新的字段号，不改引擎 proto
- 重开 GitHub Actions

## 5. 验证

本地、点名现有文件，不跑托管 CI。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| S1 | `src/vs/platform/universeAgent/test/node/grpcUploadAttachmentStreamWire.test.ts`（header 用例、chunk 用例） | 同一对象既有 `header`（含非空 `sessionId`）又有非空 `chunk`：`encodeUploadChunk` 抛错。长度为 0 的 `chunk` 与 `header` 同在也抛错。只有 header、只有非空 chunk 的现有断言仍绿。`universeAgentConnection.test.ts` 约 9894–9907 行不改 |
| S2 | 同上文件里「empty chunk omitted」那段；约 291–309 行标识符扫描 | `{ chunk: 长度 0, offset: 8 }` 的字段 2 存在且载荷长度为 0，字段 3 仍为 8。`chunk` 缺省且 `offset` 为 0 时整段仍为空。空 header 对象仍是长度为 0 的字段 1。源码里继续同时出现 `encodePresentMessageField` 与 `encodeBytesField` |
| S3 | `src/vs/platform/universeAgent/test/node/grpcGitUnaryWire.test.ts`（`encodeWriteGitStagePathsRequest` 约 203–205 行）；`src/vs/workbench/contrib/sources/test/browser/sourcesChangesGitWrite.test.ts`（空路径仍组出 `{ argv: [''] }`，该断言不改） | `commands: [{ argv: [''] }]` 在线上是一条 field 2，其内有一条长度 0 的 field 1。`commands: [{ argv: [] }]` 仍是一条长度为 0 的 field 2（改约 205 行）。`{ sessionId: '', commands: [] }` 仍是空缓冲（约 203 行保留）。非空 argv 的现有两条命令断言仍绿。ApplyHunks 编码测试不改 |

门禁命令沿用 [health-gates](../../progress/health-gates.md)：`scripts/test.sh` 点名上表文件。
