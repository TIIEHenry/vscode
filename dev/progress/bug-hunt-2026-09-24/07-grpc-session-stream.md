---
title: "潜在缺陷：gRPC 会话流"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "会话 Chat 把权限回复编成空用户输入；回合结束与快照里的文件变更被丢掉；断流后 bidi 仍派发事件。"
---

# 潜在缺陷：gRPC 会话流

## 结论

活路径上有 5 处会让用户看到错的会话状态：点允许不会变成权限决定、回合结束后 Sources 不结算、快照里的文件变更不出现、断流后旧事件还能画进时间线、历史翻页在 seq 为 0 时打转。权限误编码与方案里的 Chat 臂是同一条已知缺口。

## 发现

### BH-07-1

- 严重度：高
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts` `encodeChatRequest` / `encodeSessionInput` 约 585–623 行；出站经 `src/vs/platform/universeAgent/node/sessionViewHost.ts` `writeChat` 约 1600–1608 行
- 行为：除 `heartbeat_ack` 外，任意 record 都编成 Chat oneof `session_input`=30，只写 `message_id` / `text` / `model_profile_id` / `operation_id`。`permissionRespond` 的 `requestId` 与 `decision` 不进 field 11。
- 为何是缺陷：宿主把允许/拒绝写进常驻 Chat。`writeChat` 再把 correlation 填成 `messageId`。线上是 `session_id` + `agent_id` + 只有 message id、没有正文的用户输入。引擎收不到 allow/deny，权限座不消失，还可能多出一条空用户消息。`resident.write` 成功后宿主标 accepted。
- 触发：会话里对权限座点允许或拒绝，且 Chat 流已打开。
- 已知：已知，D944（方案里 Chat `permission_response`=11 / `client_tool_response`=13 / `question_response`=20 仍开）。Actor 当前只把 permission 写进 Chat；client tool / question 只做清理、不入队，同一编码器若以后收到也会落进 30。
- 修复方向：`kind==='permissionRespond'` 只写 field 11 后返回，禁止再写 30。

### BH-07-2

- 严重度：高
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts` `decodeTurnLifecycleEvent` 约 793–801 行；消费在 `src/vs/platform/universeAgent/node/fileMutationJoin.ts` `handleStreamPayload` / `onTurnCompleted` 约 99–102、188–199 行；宿主 `sessionViewHost.ts` `handleHostStreamPayload` 约 695–702 行把整包 payload 交给 join
- 行为：`turn_completed`=11 解成空对象 `{}`，不读 `turn_id`=1 与 `assistant_turn_id`=13。join 只认 payload 顶层的 `turn_completed`，不认 `turn_lifecycle.turn_completed`。
- 为何是缺陷：引擎把回合结束放在 field 37 里时，join 既看不到顶层键，也看不到助手回合 id。`notifyTurnSettle` 不会发生，Sources 上这次编辑仍挂在 runtime turn，不会改挂到助手回合。测 `grpcSessionAttachWire.test.ts` 把 field 13 锁成 unread，和 join 的需求相反。
- 触发：生成结束，服务器只发 `SessionStreamEvent.turn_lifecycle.turn_completed`，其中带 `turn_id` 与 `assistant_turn_id`。
- 已知：与 D944 方案 S1 同一缺口。`dev/progress/deferred-gaps.md` 把 decoder 写成已与 SessionStream 波重叠，本行仍在。
- 修复方向：解出 `turn_completed.turn_id` 与 `assistant_turn_id`，join 同时认嵌套形。

### BH-07-3

- 严重度：中
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts` `decodeRuntimeOverlaySnapshotEvent` 约 817–824 行（注释写 field 7 unread）；`fileMutationJoin.ts` `onRuntimeOverlaySnapshot` 约 176–185 行要读 `tool_runtime_snapshots`
- 行为：快照只解 `runtime_epoch`、`active_turn`、repeated `pending`=6。`tool_runtime_snapshots`=7 整段丢掉。独立事件 field 46 仍解 `file_mutation_payload`。
- 为何是缺陷：文件变更若只搭在 overlay 快照的 repeated 快照里，join 看到的不是数组，Sources 不出现对应 diff。权限/提问 pending 仍在，所以像「座还在、改过的文件没出现」。
- 触发：一条 `runtime_overlay_snapshot`=44，文件变更只在 field 7，没有单独的 field 46。
- 已知：与 D944 方案 S1 同一缺口；账上未把 field 7 单列成仍开。
- 修复方向：field 7 用 `allLengthDelimited` 解成 `tool_runtime_snapshots`，并带上根上的 `file_mutation_payload`。

### BH-07-4

- 严重度：中
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcClientCalls.ts` `makeResidentBidiBytesHandleClient` 约 321–337 行；`subscribeSessionEventStream` 在 `grpcClient.ts` 约 2064–2077 行。对照同文件 `makeServerStreamBytesClient` 约 167–170 行会先看 `gate.closed`
- 行为：bidi 的 `data` 不看关闭闸，直接 `onResponse`。`error` / `end` 会 `finish`，但已经关闭后的帧仍派发。`write` 在闸关上后直接 return，不抛错。宿主 `openStream` 的监听只在本地 `dispose` 时把 `disposed` 设为 true（`sessionViewHost.ts` 约 1389–1432 行）；远端 `end`/`error` 不设这个标志。
- 为何是缺陷：断流回调会清 overlay、发出 `streamClosed`，并可能排重连。随后仍到达的帧按原会话画回时间线，重连后的新流再画一遍，出现已关掉的流式文字或权限座闪回。`write` 被静默丢掉时，若调用方仍把句柄当活的，发送会被标成 accepted，消息实际没出去。
- 触发：SessionEventStream 或 Chat bidi 收到 `end`/`error` 之后，缓冲里还有一帧；或断流后立刻 `write`。
- 已知：无。
- 修复方向：`data` 与服务器流一样先看 `gate.closed`；关闭后的 `write` 抛错，让宿主标 failed。

### BH-07-5

- 严重度：中
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts` `decodeGetHistoryResponse` 约 378–392 行，`decodeMessageEnvelope` 约 951 行，`parseCursorSeq` 约 1146–1151 行；翻页在 `src/vs/platform/universeAgent/node/sessionViewHostHistoryFill.ts` `fillHistoryGap` 约 82–88 行
- 行为：信封 `seq` 用 `Number(bigint)`，缺省变成 0。`has_more`（field 4）为真时，`nextCursorSeq` 取最后一条的 seq 字符串。`parseCursorSeq` 把非安全整数、空串和 `<=0` 都编成游标 0。
- 为何是缺陷：最后一条 seq 被 proto3 省掉（值为 0）或超出 `Number.MAX_SAFE_INTEGER` 时，下一页请求仍是 cursor 0，同一页再取。补历史直到页数上限，用户看到历史缺口，或失败码 `page_budget_exceeded`，而不是停在已覆盖的 seq。
- 触发：GetHistory 响应 `has_more`=1，且本页最后一条没有 field 3，或 seq 大于 2^53−1。
- 已知：无。
- 修复方向：游标保持十进制字符串，禁止把 0 或缺省 seq 当成下一页；不安全整数直接失败。

## 看过但未立条

- `decodeChatResponse` 只留 `session_id` / `agent_id`。宿主注释写明时间线走 SessionEventStream，ChatResponse 当 ack 丢掉。Continue / Regenerate / Resume 的 `onResponse` 是空函数。这是当前合同，不是静默丢生成正文。
- `encodeSessionInput` 不写 delivery、skill、system prompt。当前 `submitInput` 出站只有 `text`、`modelProfileId`、`agentId`，再加 `messageId`。这些字段没有活路径。
- Shelve / Purge / Cancel 的 `success` 缺省当失败（`=== true` 才成功）。这是 fail-closed。
- 空 `sessionId` 的握手会被 `encodeStringField` 省掉 field 1。宿主在没有 engine session id 时不开流。
- `decodeToolCallLifecycleEvent` 不读 change oneof。join 只用 `turn_id` / `tool_call_id` / `agent_id`，这三项有解。
- RemoteChat / GetRemoteSessionStatus 不核对返回的 `call_id` 与请求是否同一条。协议面写明 RemoteChat 无 UI，本轮看不到用户表面。
- `GrpcUniverseAgentClient.close` 不逐条 `closeLocal`。`disconnect` 先关通道再把相位设为 closed；重连跳过条件含 `connection_down`。没有稳定的「断线后仍显示已连接」路径。
- D24 仍开的 JSON unary（Connect / Watch / Resolve / Pty）不在本轮会话流切片里。

## 未读完

- `grpcClient.ts` 约 3363 行，读了构造、`close`、会话 unary、Chat / SessionEventStream / Remote 会话方法；catalog 类 unary 未逐行看。
- `grpcTransport.ts` 只看了会话与流的接口注释，没有对每一条 RPC 做字段对照。
- `grpcClientMappersSession.ts` 读了 resume、history、chatSync、prewarm；usage / rules 等映射未逐字段对 proto。
- `grpcClientMappers.ts` 只是再导出。
- 未读 `grpcHandshakeWire.ts`、`grpcDevicePairUnaryWire.ts`。
- 未读 `sessions/`、`base/`、`editor/`、`extensions/`，也未读 VS Code 自带 Chat。
