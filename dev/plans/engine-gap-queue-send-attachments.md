---
title: "引擎联动缺口：队列读回、生成中发送门禁、附件上传"
type: plan
status: accepted
phase: M7
updated: 2026-10-11
summary: "2026-10-11 用户签收。本刀只做两件事：接通时停掉 Enqueue RPC 与入口；已有 streaming turn 时禁用 Send，不直发 submitInput，也不改入队。附件不开刀。未实施。不升 PRD。"
---

# 引擎联动缺口：队列读回、生成中发送门禁、附件上传

> **触发：** 2026-10-11 对 Engine 设置页、会话面、Composer、连接配对、Navigator/Review 五路只读审查。本稿取其中与引擎联动最紧的三条 P0。其余 P1/P2 不在本稿。
> **不推翻：** [ADR-003](../decisions/003-engine-adapter-boundary.md)；[conversation-stream-timeline](conversation-stream-timeline.md) 的 fold 输入口径；[engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) §5 的诚实空合同。
> **审查记录：** 见文末（规则 16）。

## 1. 现状（已在代码里核实）

| # | 现象 | 证据 |
|---|------|------|
| Q | 引擎已连或曾连时 `getMessageQueueState` 恒返回空队列。已连接时 `enqueueMessageQueueItem` 仍发 `enqueueQueueItem` | `conversationEngineRosterService.ts:633-636`、`:608-609`、`:1455-1460`。曾连但已断开时 `callRemote` 为 false，`forwardEngineQueueRef` 直接返回 false、不发 RPC（`:1416-1425`） |
| Q | Inbox 在接通或有连接历史时仍提供 Enqueue，空态文案已是 “Queue not listed” | `conversationInboxOverlay.ts:245-252`、`:261-264`、`:294-297`；文案 `conversationLensDockStrings.ts:14` |
| Q | overlay 源码扫描断言不含 `insertQueueItem`、`reorderQueue`、`deleteQueueItem`、`pinQueueItem`、`setQueueItemLocked`、`injectQueueItem`、`retryAllFailed`、`GetQueue`、`ListQueue`。扫描列表没有 `setQueueItemForkAnchor`；roster 与 overlay 源码里也没有它的调用 | `conversationInboxOverlay.test.ts:663-678` |
| Q | session-core 的 fold 没有消息队列投影。本仓 `UniverseAgentGrpcServices.Agent` 没有 `GetQueue`。`decodeChatResponse` 不读 `queue_state` | `session-actor-stream-fold.ts` 无队列投影；`grpcTransport.ts:1036-1108`；`grpcSessionAttachWire.ts:787-807` |
| S | 已连接时 Send 不看是否有 streaming 行，`submitDraft` 走 `submitInput`。未连接但曾连时先试 `enqueueMessageQueueItem`，失败则留草稿 | `conversationLensDock.ts:307`；`conversationLensComposer.ts:331-355` |
| S | `submitInFlight` 只在 `submitDraft` 入口吞第二次进入。`updateSendEnabled` 不看它 | `conversationLensComposer.ts:316-317`；`conversationLensComposerChrome.ts:583-605` |
| A | Composer 没有附件入口。`encodeSessionInput` 只写 `messageId`、`text`、`modelProfileId`、`operationId`。上传与进度方法的注释写明 catalog + node、无 Conversation UI | `grpcSessionAttachWire.ts:823-829`；`universeAgentConnection.ts:1846-1861` |
| A | 队列行的上传进度只读 `item.uploadProgress`，不调用 `getUploadProgress` | `conversationInboxOverlay.ts:756-760` |

## 2. 取证结论（2026-10-11，钉死引擎 `127.0.0.1:50061`）

监听已在（`java` pid 1446879），没有另起一份。叶证书 SHA-256 `457fdd37b70dd5200d47309f91b4487cf606f90899ab4b7c3d73787c3950c05f` 与 `vscode-debug-engine/agent-home/engine-tls.crt` 一致。`grpcurl` 1.9.3 因证书只有 CN、没有 SAN，报 `certificate relies on legacy Common Name field`（`GODEBUG=x509ignoreCN=0` 同样失败）；没有用 `-insecure`。线上调用改用 `@grpc/grpc-js`：该 PEM 作信任锚，`checkServerIdentity` 核对同一指纹，`grpc.ssl_target_name_override=UniverseAgent-Engine`。`HealthCheck` 返回 `status=SERVING`、`version=3.0.0`。回环且未开 Hub，走引擎自己的 skip-auth，没有绕过 Device Grant。探测会话都已 `Delete`。

### 1. 已有 turn 时的第二条 `Chat`

**结论：** 第二条 `Chat`（`delivery=INPUT_DELIVERY_STANDARD`，与省略时的映射相同）RPC 成功、零帧，生成窗口内没有第二个 `turn_started`。当前 turn 在约 76ms 内进入 error，日志异常是 `Illegal transition: GENERATING → WAITING`。这不是「引擎拒绝并发」，也不是「引擎自己把第二条排进队列」。§3 S1 定为：已有 streaming turn 时禁用 Send，不发 `submitInput`，也不改走入队。

**证据（线上）：** 会话 `7f0aff03-9e6f-49be-91f9-19e0c5a67f27`。第一条 `turn_started`（`t-646b9a0e`）之后、`AgentService.Status` 仍为 `AGENT_STATUS_GENERATING` 时发出第二条（晚 25ms）。两条 `Chat` 都是 `ended=true`、`frames=0`、无 gRPC status。`~/.universe-agent/logs/universe-agent.log`：`23:02:25.848` `AGENT_TURN_START` 且 `waiting → generating`；`23:02:25.924` `generating → error`，`IllegalStateException: Illegal transition: GENERATING → WAITING`，栈在 `AgentLoopRunOrchestration.executeOneTurn`（运行中的 class 行号 522）。下一次 `AGENT_TURN_START` 是 `23:02:33.978`，落在约 8s 后的另一次 `Status`/`EnqueueQueueItem`，不在那 76ms 的生成窗口里。

**源码对照（行号与上述二进制栈不一致，只说明工作区树里的意图；外仓行号未经本仓复核）：** `GrpcApiAdapter.toInputDeliveryPolicy` 把 `UNSPECIFIED`/`STANDARD` 收成 `STANDARD`（`GrpcApiAdapter.kt:15-20`）。`SessionInputCoordinator.dispatchStandard` 先 `enqueueUserInput`，仅 `!busy` 时 `runDrainUserInput`（`SessionInputCoordinator.kt:621-644`）。工作区 `executeOneTurn` 在轮次开头执行 `transitTo(WAITING)`（`AgentLoopRunOrchestration.kt:396-397`）。本仓 `encodeSessionInput` 不写 `delivery`，线上等价于这条 STANDARD 路径（`grpcSessionAttachWire.ts:823-829`）。

**线上验证：** 是。

### 2. 入队之后 `SessionEventStream` 有没有队列事件；有没有 `GetQueue`

**结论：** 入队成功后，`SessionEventStream` 没有队列事件。反射里的队列 RPC 只有变更族，没有 `GetQueue` / `ListQueue` / `SubscribeQueue`。§3 Q2 本刀只停掉已连接时的 Enqueue 入口和 RPC。不从 `SessionEventStream` 投影，不在本仓加 `GetQueue`，也不在未收到 `queue_state` 帧之前做 Chat 投影。本仓不改引擎 proto。

**证据（线上帧）：** `EnqueueQueueItem` 返回 `ok=true`、`op_id=op-q1-enq`、`item_id=q-3cbb4b976584f30a`（会话 `fab3567c-28eb-42c6-808a-b72a6a4c2eb1`，入队时还没有 Chat）。随后 1.5s 的流事件只有 `hello`（`hello.runtime_epoch`）和 `runtime_overlay_snapshot`（`runtime_epoch`）。`InsertQueueItem` 返回 `item_id=q-f55df66f864b2f58` 之后仍然没有名字里带 queue 的事件。整段流上出现过的 `SessionStreamEvent.event`：`hello`、`runtime_overlay_snapshot`、`turn_lifecycle`（`change=turn_started`，内含 `turn_id` / `agent_id` / `model_id` / `provider_id` / `model_name` / `model_profile_id`）、`envelope_batch_appended`（`seq` / `session_version` / `operation_id` / `envelopes`）、`heartbeat`（`server_mono_ms`）、`session_closed`（`reason=SESSION_DELETED`）。外层还有 `session_id`，部分帧有 `operation_id`。

**反射（线上，`grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo`；`grpc.reflection.v1` 为 `UNIMPLEMENTED`）：** 22 个服务。`agentservice.AgentService` 的队列方法为 `EnqueueQueueItem`、`InsertQueueItem`、`ReorderQueue`、`PauseQueue`、`ResumeQueue`、`ClearQueue`、`DeleteQueueItem`、`RetryQueueItem`、`RetryQueueItemUpload`、`PinQueueItem`、`SetQueueItemLocked`、`InjectQueueItem`、`SetQueueItemForkAnchor`、`HoldQueueItem`、`EditQueueItem`、`ReleaseQueueItemHold`。`FileTransferService` 只有 `UploadAttachment`、`DownloadAttachment`、`GetUploadProgress`。`SessionService` 含 `SessionEventStream`。三份描述符里都没有 `GetQueue` / `ListQueue` / `SubscribeQueue`。

**Proto（钉死工位 `grpc-api/src/main/proto`，与反射一致）：** `SessionStreamEvent.event` oneof 止于 `client_tool_call=52`，没有队列臂（`message_envelope.proto:491-531`）。`QueueStateEvent` 挂在 `ChatResponse.event.queue_state=76`（`agent_service.proto:309-310`、`:1681-1688`），字段 `items`、`is_paused`、`pause_reason`、`lock_blocked_item_id`、`op_id`、`is_processing`、`version`。`QueueItemProto`（`:1691-1709`）字段 `id`、`client_message_id`、`text`、`created_at`、`status`、`hold`、`upload_progress`、`retry_count`、`last_error`、`priority`、`pinned`、`locked`、`fork_from_turn_id`、`fork_from_preview`、`version`、`upload_total_count`、`upload_completed_count`。工作区 `QueueSessionSupport.publishQueueState` 把 `ChatResponse.queue_state` 推给 Chat 的 `StreamObserverRegistry`，不推 `SessionEventStream`（`QueueSessionSupport.kt:16-29`）。本次每条 `Chat` 都是零帧结束，线上没有收到 `queue_state`。本仓 `UniverseAgentGrpcServices.Agent` 同样没有 `GetQueue`（`grpcTransport.ts:1036-1108`）。

**线上验证：** 是（流帧与 v1alpha 反射）。`grpcurl` 本身没连上，见节首。

### 3. `SessionInput` 的附件字段，以及上传完成后用什么绑到发送

**结论：** `SessionInput.attachments`（field 3）是附件引用。`UploadAttachment` 成功响应只有 `success`、`file_path`、`checksum_sha256`，没有新的附件 id。`file_path` 形如 `attachments/<客户端 transfer_id>`。`queue_item_id` 是上传头入参，用来对已有队列项回写进度；响应不返回它。把返回的 `file_path` 和 `transfer_id` 放进下一条 `Chat` 的 `attachments` 后，落库用户信封只有 `TEXT`，没有附件块。§3 A1 先不开刀。

**证据（线上）：** 会话 `612ee85a-b208-477a-9081-5aeedd35d717`，`transfer_id=q1env1`。响应键只有上述三个：`file_path=attachments/q1env1`，`checksum_sha256` 为 64 位十六进制。文件落在工作区树 `vscode-WorkTrees/H/attachments/q1env1`。随后 `Chat` `message_id=msg-env`、`text=see-attachment`，`attachments[0]` 带 `file_path=attachments/q1env1`、`transfer_id=q1env1`、`filename`、`media_type`、`checksum_sha256`、`total_size`（同一套 proto-loader 序列化后的字节里能搜到这些字符串）。RPC `error=null`、零帧。`envelope_batch_appended` 里 `id=msg-env`、`role=USER`、`kind=CHAT` 的 `blocks` 只有 `RUNTIME_ENVIRONMENT` 与 `TEXT`（`text_block.text=see-attachment`）。另一会话 `ea4f7725-76bd-44cc-bb35-4d3a464fb2d5` 上 `file_path=attachments/does-not-exist` 的 `Chat` 同样 RPC 成功，没有 `INVALID_ARGUMENT`。`queue_item_id=not-a-queue-item` 的上传仍然 `success=true`。

**Proto：** `Attachment` 字段 `media_type=1`、`data=2`、`filename=3`、`file_path=4`、`transfer_id=5`、`total_size=6`、`checksum_sha256=7`（`common.proto:292-301`）。`SessionInput.attachments=3`（`agent_service.proto:151-165`）。`UploadHeader.queue_item_id=9`（`file_transfer_service.proto:32-42`）。`UploadResponse` 为 `success`、`file_path`、`checksum_sha256`、`error_message`、`error_code`（`:44-50`），无 id。本仓解码与此相同（`grpcUploadAttachmentStreamWire.ts:51-66`）。`encodeSessionInput` 只写 `message_id`、`text`、`model_profile_id`、`operation_id`（`grpcSessionAttachWire.ts:823-829`）。外仓 proto 行号未经本仓复核。

**工作区映射（未被这次线上信封证实）：** `toAttachment` 在 `file_path` 非空时做成 `PathRef`，否则用内联 `data`，不读 `transfer_id`（`GrpcApiAdapter.kt:29-41`）。`convertAttachment` 把该路径限制在 `workDir()` 内再读文件，失败则 `INVALID_ARGUMENT`（`ChatStreamHandler.kt:364-385`、`:250-258`）。运行中的二进制栈行号与这棵工作区树不一致，且缺失路径的 RPC 没有返回 `INVALID_ARGUMENT`，用户信封也没有附件块。

**线上验证：** 是（响应字段，以及下一条 `Chat` 的用户信封）。信封未带上附件，所以 A1 不能把 `file_path` 当成已经打通的发送引用。

## 3. 签收后的本刀

Q1 已完成。下面不再留分支。后续读回（Chat `queue_state` 或向引擎仓提 `GetQueue`）另立方案，不在本刀。

**Q2 停掉写通读空的 Enqueue。** 条件与接通或曾连时 `getMessageQueueState` 返回空队列相同。

- Inbox：`isEnqueueOffered()` 在该条件下为 false。空态继续用 `conversationLensDockInboxQueueNotListed`（“Queue not listed”），不画成已同步的空列表。
- roster：`isEngineConnected()` 时 `enqueueMessageQueueItem` 不调用 `enqueueQueueItem`，返回 false。曾连但已断开时今天已经 `callRemote: false`、不发 RPC，保持。从未连过仍走 stub。
- 改写锁定「接通后 Enqueue 转发」的单测（`conversationInboxOverlay.test.ts` 里 connected Enqueue forwards）。
- 不从 `SessionEventStream` 做队列投影。不读 `ChatResponse.queue_state`。不在本仓增加 `GetQueue`。

**S1 生成中禁用 Send。** 已连接且时间线有 streaming 行时（与 Inbox Stop 的启用条件同一事实）：Send 禁用；`submitDraft` 不发 `submitInput`，也不调用 `enqueueMessageQueueItem`。`submitInFlight` 为真时 `updateSendEnabled` 同样禁用 Send，不再只在函数入口吞掉第二次进入。空闲、已连接、没有 streaming 行时，Send 仍走 `submitInput`。

生成中改入队不在本刀。Q1 没有抓过 `AGENT_STATUS_GENERATING` 期间的 `EnqueueQueueItem`，不能把入队当成安全替代；而且入队与「队列不可读」冲突。

**A1 不开刀。** `file_path` 没有进入用户信封。不接 Composer 附件，不做上传分块或 `GetUploadProgress` UI。

## 4. 不做

- 不改 Pause / Resume / Clear / Hold / Release / Edit / Retry。它们在已连接时仍会发 RPC，打在读不回的队列上。这是已知残留，本刀不把它说成已对齐。
- `deleteQueueItem` 今天没有 roster 或 Inbox 调用。不补 Delete，也不把 Delete 写成已经转发。
- 不做 Insert / Reorder / Pin / Lock / Inject / ForkAnchor 的 UI。
- 不做 `DownloadAttachment` UI。
- 不升 PRD-008 / PRD-025。
- 不改 session-core vendored 文件，不改引擎 proto。
- 协议面 §5 仍写接通后转发 Enqueue，那是当前 HEAD。实施 commit 再改这一句。同文件第一个「## 7」标题下的会话表是过期副本（MessageQueue 仍写 fixture、Rename 未接）。实施以 §5 与 §5a 为准，不按那张表再做一遍 Enqueue 转发。本稿不整表回写。

## 5. 验证

只用本地门禁：`compile-client`、eslint、`scripts/check-docs-health.py`，以及本刀单测：接通时 Enqueue 不发 RPC 且入口关闭；曾连未连接时行为与现在相同（不发 RPC）；streaming 时 Send 禁用且不发 `submitInput`；`submitInFlight` 时 Send 禁用。引擎行为以 Q1 抓帧为证据，不用单测替代。不写上传分块测试。

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
| 2026-10-11 规则 16 | 改完 Critical / Important 前不可签收 | Critical：§3 收成单一本刀。生成中禁用 Send，不入队，不保留「引擎自己排队则继续直发」。Important：Enqueue 停在 Inbox 入口和已连接时的 roster RPC；曾连未连接的不发 RPC 保持；Pause 等写路径标为残留；Delete 不写成已转发；行号改到 HEAD；A1 与验证去掉上传；过期 §7 会话表声明不作依据。外仓 Kotlin / proto 行号保持「未经本仓复核」，不删线上证据。 |
| 2026-10-11 用户签收 | **accepted** | 未实施。不升 PRD。 |
