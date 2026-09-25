---
title: "潜在缺陷：SessionViewHost"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "断线期间完成的绑定会让重连跳过 Resume，思考块丢掉回合号，从 0 开始的区间替换整段进不了时间线。"
---

# 潜在缺陷：SessionViewHost

## 结论

读过点名的 host、demux、历史补洞、IPC 通道和两端 SessionView 服务，并对照 `session-core` 的连接、订阅、历史回填和写回执。立 6 条。`dev/progress/deferred-gaps.md` 里与本范围相同的只有 D382 留下的 pairing 写门。

## 发现

### BH-03-1

- 严重度：high
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/sessionViewHost.ts` `ensureEngineSession` 约 568–588 行；`onEngineConnectionChanged` 约 495–500 行只清 `engineBoundForGeneration` / `engineBroughtUpForGeneration`。相邻：同文件 `bindEngineSession` 约 591–627 行（未绑定才 Resume），`fireStreamReopen` 约 1507–1517 行（重开只再投 `connectionUp`，不再绑定）。
- 行为：Create/Resume 还在飞时断线，在途任务仍会在断线之后把引擎 id 写回并重新置上「本代已绑定」。下一次连上看到这枚闩，直接拿旧 id 打开订阅，不再 Resume。
- 为何是缺陷：这条 id 若在断线时没有在引擎侧挂住，订阅会失败并按同一 id 重开。闩要再断一次线才清，时间线会停在关闭态，重试不会换成一次新的 Resume。
- 触发：已有 lease，且 `ensureEngineSession` 的 Resume 或 Create 尚未返回时引擎断开，随后又连上。
- 已知：否
- 修复方向：绑定完成时带上启动时的 `connectionGeneration`，代次已变则不要置闩；断线时丢掉在途绑定。

### BH-03-2

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionStreamDemux.ts` `mapByPriority` 思考分支约 427–439 行。相邻：同函数文本/工具分支约 411–409 行会展开 `turnIdFields`；`src/vs/platform/universeAgent/node/sessionCore/stream-event-to-view-patch.ts` `reasoningItemFromBody` 约 699–720 行只在 body 自带 `turnId` 时写入条目。
- 行为：同一条信封上，文本和工具会带上 `turn_id`，思考块的 body 没有这个字段。
- 为何是缺陷：思考行在时间线上没有回合号。按回合过滤、跳转或和相邻文本对齐时，这条思考对不上它所属的回合。
- 触发：会话流或历史补洞里出现带 `turn_id`、且按优先级落成 `reasoning` 的思考块。
- 已知：否
- 修复方向：思考分支与文本分支一样展开 `turnIdFields`。

### BH-03-3

- 严重度：medium
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/sessionStreamDemux.ts` `demuxRangeReplaced` 约 546–553 行。相邻：`src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts` `decodeEnvelopeRangeReplaced` 约 937 行把缺省 `from_seq` 编成 0。
- 行为：`fromSeq` 缺失或小于等于 0 时，整段 `rangeReplaced`（含替换信封）直接变成空事件。
- 为何是缺陷：从日志起点开始的压缩或改写不会进时间线，旧条目继续留在界面上。解码把缺字段写成 0，和「0 不合法」叠在一起，这类事件没有第二次机会。
- 触发：引擎发出 `envelope_range_replaced`，且 `from_seq` 为 0 或未带该字段。
- 已知：否
- 修复方向：0 作为「从起点替换」照常下发；真正缺字段再按失败关闭丢掉，并记一条诊断。

### BH-03-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts` `call` 约 64–75 行。相邻：同文件 `acquireLease` 约 55–56 行用 IPC `ctx` 当 owner；`src/vs/platform/universeAgent/electron-main/universeAgentSessionViewService.ts` `releaseLease` / `post` 约 55–62 行原样转到 host，host 只按 leaseId 查找。
- 行为：领取 lease 时窗口身份来自连接上下文。释放、提交、重同步、确认和拉详情不核对这个身份。leaseId 是进程内递增的 `attempt:N`。
- 为何是缺陷：另一个窗口只要拿到或猜到 leaseId，就能拆掉对方的订阅，或把输入写进对方的会话。多窗口共用一个主进程 host 时，时间线会停更，或消息出现在别的会话里。
- 触发：两个窗口各自 `acquireLease` 之后，其中一个对另一个的 leaseId 调用 `releaseLease` 或 `post`。
- 已知：否
- 修复方向：转发这几项调用前确认 lease 的 owner 与当前 `ctx` 一致，不一致则拒绝。

### BH-03-5

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionViewHost.ts` `requestDetail` 约 441–470 行；`fillHistory` 约 1636–1674 行。相邻：同文件 `post` / `writeChat` 约 391–396、1585–1591 行已先看 `pairingPending`。
- 行为：配对未完成时，提交、心跳和聊天写会被拒绝。拉工具详情和历史补洞不看这道闸，断线时 `requestDetail` 还改用本地 sessionId 去拉。
- 为何是缺陷：界面仍处在「还没真正连上」时，补洞会改时间线水位，详情会打到引擎；断线时本地 id 和引擎 id 不一致就会查错会话或得到失败。写路径已经当成未认证，这两条读路径仍像活连接。
- 触发：`isEngineConnected()` 为真且 `pairingPending` 为真时发生 hello 补洞或打开工具详情；或已断线但 lease 还在时请求详情。
- 已知：是，D382（该条只关上 resync/ack，并写明未改 `requestDetail` / `fillHistory`）
- 修复方向：与 `post` 相同，先拒绝 `pairingPending`，断线时不要用本地 id 调用 `fetchToolDetail`。

### BH-03-6

- 严重度：medium
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/sessionViewHost.ts` `writeChat` 约 1600–1608 行。相邻：同函数一次性 `chat()` 约 1619–1628 行要等调用结束才标接受；`src/vs/platform/universeAgent/node/sessionCore/local-fact.ts` 约 127–128 行写明 `accepted` 只做诊断、不收回乐观发送。
- 行为：居民聊天流上，`write` 同步返回就投递 `inputDelivery: accepted`。服务端稍后拒绝或流马上出错，没有第二条失败回执。
- 为何是缺陷：乐观发送不会被标成失败。用户看到消息已经送出，引擎没有这次输入，回合不会开始。
- 触发：居民 Chat 流已 Up，`write` 未抛错，随后该流以 `error` 或 `remote` 结束，且服务端没有收下这条 payload。
- 已知：否
- 修复方向：本地写入先标成已排队，等服务端回执或流关闭再标接受或失败。

## 看过但未立条

- `questionRespond` / `clientToolRespond` 只折本地清理、不发聊天写。`local-fact.ts` 写明这是 ADR-325 一元调用成功后的界面清理；一元 RPC 在连接服务上，不在这条 post 路径。
- `openStream` / `openResidentChat` 在引擎 id 缺失时直接 return、不投关闭。现有调用都在 `ensureEngineSession` 写入 map 之后的同步排空里，没有稳定触发面。
- 订阅远程结束后先 `postAndDrain(streamClosed)`，Actor 的 `closeStream` 会在 map 删除前 `dispose`。这是有意把本地 dispose 交给 Actor。
- 邮箱溢出后的 fail-closed 闩、以及重连第一次 Up 仍画成 live，属于 Actor（见会话 Actor 扫描），host 只在断线时清自己的集合。
- `sessionStreamClose.ts` 的 `closeLocal` 不回调 `onClosed`，用来吞掉本地取消之后的 CANCELLED。
- `universeAgentChannel.ts` 只建固定 TLS 的 gRPC 通道，不碰会话订阅。
- `browser/universeAgentSessionViewService.ts` 的 `web-empty:` 与拒绝 `whenEngineSessionReady` 是 Web 无引擎的合同。
- 无订阅方时 pending 超过 64 帧清空并等下次监听再 resync，是缓冲上限，不是静默丢直播。
- `NodeSchedulerPort` 与孤儿 lease 的 5 秒定时器用的是真实 `setTimeout`；重开退避才注入测试时钟。生产路径仍会触发。

## 未读完

- `session-actor.ts`、`session-actor-stream-fold.ts`、`session-actor-local-fact.ts`、`session-actor-chat-outbox.ts`、`local-fact.ts`、`stream-event-to-view-patch.ts` 只读了与订阅开关、历史结果、思考条目和写回执相邻的函数。
- `grpcSessionAttachWire.ts` 只读了 GetHistory 与 `envelope_range_replaced` / 信封 `turn_id` 的解码。
- `universeAgentConnectionService.ts` 只确认 `subscribeSessionEventStream` 转到传输层，以及 `respondQuestion` 不经过 host。
- 按范围未读 sessions / base / editor / extensions / 未点名 workbench。未跑测试。
