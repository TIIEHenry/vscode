---
title: "思考块回合号、跨窗口 lease 与未接通的读路径、居民写回执"
type: plan
status: accepted
phase: M7
updated: 2026-09-24
summary: "断线后的在途绑定只交叉引用活流 S5；居民 write 的 accepted 只交叉引用活流 S6。思考块补上已有 turnId；lease 调用核对窗口；断线详情不再用本地 sessionId。"
---

# 思考块回合号、跨窗口 lease 与未接通的读路径、居民写回执

> **本稿是方案，不是实施。**
> **冲突域：** `sessionViewHost.ts`（不含 `bindGeneration` 与居民 `writeChat` 成功回执）、`sessionStreamDemux.ts` 的思考分支、electron-main 的 session view channel / service（只给转发补 `ctx`）。不改 `universeAgentChannel.ts`、`sessionStreamClose.ts`、Web `web-empty:`、`listen`。
> 不改 session-actor（另一路 04）和 mailbox（另一路 05）。
> **禁止**改 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 已占的 host `bindGeneration`、解码切片，以及 S6 钉死的居民 `writeChat` 成功回执（编码不抛则 `accepted`）。
> **2026-09-24 审查：** BH-03-6 改为已知、归活流 S6，删除原 S4。S3 的 `requestDetail` 只改断线 `else`，已连接且配对中的门留给 S5。
> **不发明**协议字段。`turnId`、`inputDelivery` 的 `accepted` / `failed`、`PostOutcome` 的 `not_authenticated`、历史失败码 `transport_failed` 都是 HEAD 已有的。

## 核查

对照 [扫描文](../../progress/bug-hunt-2026-09-24/03-session-view-host.md) 与 HEAD。

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-03-1 | 已知，见 live-stream-bytes-decode | `ensureEngineSession` 约 581–584 行在 `await` 之后无条件写入 `engineSessionByLocal` 并 `engineBoundForGeneration.add`。断线约 499–500 行只 `clear` 这两个 Set，不取消 `engineBindInflight`。`fireStreamReopen` 约 1514–1517 行只再投 `connectionUp`。与活流 S5（`bindGeneration` = 现有 `connectionGeneration`，代次对不上不提交，断线在途不得跳过 Resume）同一条。 |
| BH-03-2 | 成立 | `mapByPriority` 文本约 421 行、工具约 380 行展开 `turnId`；思考分支约 430–438 行的 `reasoning` body 没有。`reasoningItemFromBody` 约 715–718 行只在 body 自带 `turnId` 时写入条目。`timelineItemToEntry` 约 345、359–365 行因此给不出思考行的回合号。 |
| BH-03-3 | 驳回 | `demuxRangeReplaced` 约 550–552 行对 `fromSeq <= 0` 返回 `undefined`，行为还在。用户可见的「从起点替换进不了时间线」不是本路要改的缺陷：`isValidFromSeq`（`range-replaced-apply.ts` 约 136–142 行）已要求 `fromSeq > 0`，否则 `planRangeReplacedApply` 约 175–176 行以 `range_replaced_from_seq_invalid` 拒绝。05 扫描把非法 `fromSeq` 标成有意 fail-closed。把 0 当成起点会推翻这道门，且 Actor 不在本稿。 |
| BH-03-4 | 成立 | `acquireLease` 约 55–56 行用 IPC `ctx` 当 owner，`acquireLease` 约 312–322 行把 owner 记在 lease 上。`call` 约 66–75 行的 `releaseLease` / `post` / `requestResync` / `acknowledge` / `requestDetail` 不传 `ctx`。service 约 55–76 行原样转到 host，host 只按 leaseId 查找。leaseId 来自 `createSessionViewIdPort` 的 `attempt:` 递增（`sessionViewHostPorts.ts` 约 57–64 行）。 |
| BH-03-5 | 成立 | `post` 约 391–396 行、`writeChat` 约 1585–1591 行已拒绝 `pairingPending`。`fillHistory` 约 1646–1656 行不看这道闸，直接绑定并 `getHistory`。断线时 `requestDetail` 约 457–467 行用 `binding.sessionId` 调 `fetchToolDetail`。D382 写明未改这两处。活流 S5 只占「配对中不新 Create/Resume、已绑定 leftover 的详情仍可读」，不覆盖补洞，也不覆盖断线本地 id。 |
| BH-03-6 | 已知，见 live-stream-bytes-decode S6 | 居民 `write` 成功后 `writeChat` 约 1602–1605 行 `mark('accepted')` 是 S6 钉死的基线：编码不抛则 host 仍 `accepted`，只有 `encodeChatRequest` 抛错才 `failed`。无 kind 的用户输入仍走 field 30，成功写入必须 `accepted`。本稿不改这条回执。 |

## Problem class

- **症状：** 思考行没有回合号，审查导航和按回合跳转对不上相邻文本。另一个窗口拿着 `attempt:N` 可以拆掉订阅或把输入写进别人的会话。配对未完成时历史补洞仍改水位；断线后拉工具详情用本地 id。居民聊天 `write` 一返回，乐观发送就按已送出清掉，流随后出错没有失败回执。
- **类标签：** **思考块漏抄已有 turnId** + **lease 调用不核对领取时的窗口** + **读路径绕过未认证闸** + **同步 write 被当成服务端已收下**。
- **复发机制：** demux 测思考块不带 `turn_id`；通道测只断言 acquire 使用 `ctx`，转发测不换窗口；回执测把权限座的 `removePendingAction` 锁在同步 `write` 成功上。

断线期间完成的绑定仍在，归类与切片都在 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S5，不重复写进本类。

## 0. 一句话结论

思考分支与文本分支一样展开已有的 `turnId`。主进程转发释放、提交、重同步、确认和拉详情之前，lease 上的 owner 必须等于当前 IPC `ctx`。`fillHistory` 在配对未完成或未连接时走已有的失败回执。`requestDetail` 只在断线的 `else` 不再用本地 sessionId；已连接且配对中的详情门只许活流 S5 动。居民 `write` 成功后的 `accepted` 不在本稿。在途绑定不在本稿切片。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `await` 绑定完成后无条件 `add` 本代已绑定；断线只 `clear`，不取消在途 | `sessionViewHost.ts` `ensureEngineSession` 约 568–588 行；`onEngineConnectionChanged` 约 495–500 行 |
| 重开只再投 `connectionUp`，不再 Resume | 同文件 `fireStreamReopen` 约 1507–1517 行 |
| 已签收：`bindGeneration` 等于现有 `connectionGeneration`；代次对不上不提交；在途断连必须 Resume | [live-stream-bytes-decode](../live-stream-bytes-decode.md) S5 |
| 文本 / 工具 / 占位 / unknown 展开 `turnIdFields`；思考 body 不展开 | `sessionStreamDemux.ts` `mapByPriority` 约 380、421、461、483、430–438 行 |
| 条目只抄 body 上已有的 `turnId`，不从 id 推断 | `stream-event-to-view-patch.ts` `reasoningItemFromBody` 约 715–718 行；`sessionView/types.ts` `TimelineItemView.turnId` 约 180–181 行 |
| 投影把条目上的 `turnId` 抄到思考行；审查行用它找该回合最后一条 | `conversationSessionView.ts` `timelineItemToEntry` 约 345、359–365 行；`conversationReviewEntry.ts` `entryTurnIdsFromSnapshot` 约 50–56 行 |
| `fromSeq` 缺省或 `<= 0` 时 demux 丢掉整段替换 | `sessionStreamDemux.ts` `demuxRangeReplaced` 约 546–552 行 |
| 解码把缺省 `from_seq` 写成 0 | `grpcSessionAttachWire.ts` `decodeEnvelopeRangeReplaced` 约 937 行 |
| Actor 只接受正整数 `fromSeq` | `range-replaced-apply.ts` `isValidFromSeq` 约 136–142 行 |
| 领取 lease 时 owner 来自 `ctx`；其余调用不核对 | `universeAgentSessionViewChannel.ts` `call` 约 52–75 行；`universeAgentSessionViewService.ts` 约 55–76 行 |
| lease 记下 owner；按 owner 批量释放已存在 | `sessionViewHost.ts` `acquireLease` 约 312–322 行；`releaseLeasesOwnedBy` 约 365–368 行 |
| leaseId 形如 `attempt:N` | `sessionViewHostPorts.ts` `createSessionViewIdPort` 约 57–64 行 |
| 渲染端服务只是主进程通道注册，参数里没有 owner | `electron-browser/universeAgentSessionViewService.ts` 约 9 行 |
| Web 无引擎：`web-empty:`，`whenEngineSessionReady` 拒绝 | `browser/universeAgentSessionViewService.ts` 约 12–16、26–31 行 |
| D382 关上 `requestResync` / `acknowledge`，写明未改 `requestDetail` / `fillHistory` | [deferred-gaps](../../progress/deferred-gaps.md) D382 |
| 配对中不新 Create/Resume；已绑定 leftover 的详情仍可读 | [live-stream-bytes-decode](../live-stream-bytes-decode.md) S5 |
| `fillHistory` 不看 `pairingPending` / 连接 | `sessionViewHost.ts` `fillHistory` 约 1636–1668 行 |
| 断线详情用本地 `binding.sessionId` | 同文件 `requestDetail` 约 451–467 行 |
| 居民 `write` 同步返回即 `accepted`；流 `error` / `remote` 只 `chatStreamDown` | 同文件 `writeChat` 约 1600–1608 行；`openResidentChat` 约 1305–1316 行 |
| 一次性 `chat()` 要等调用结束才标接受 | 同文件 `writeChat` 约 1619–1628 行 |
| `accepted` 应用清理，不收回乐观发送；`failed` 且清理块还在时，普通输入不发失败效果 | `local-fact.ts` 约 127–128 行；`session-actor-local-fact.ts` `onHostWriteReceipt` 约 439–464 行 |
| 权限应答的居民 `write` 成功会拆掉 pending | `sessionViewHostWriteReceipt.test.ts` `resident write success folds removePendingAction for perm-live` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 思考块抄 turnId；IPC 核对 owner；补洞拒绝；断线详情不再用本地 id** | 见 §3。在途绑定只引用活流 S5；居民 `write` 回执只引用活流 S6 | **选定** |
| B 再写一条 `bindGeneration`：代次对不上不 `add`，断线丢掉在途 | 与活流 S5 同文 | **拒绝。** 交叉引用，不另起切片 |
| C 思考键改回 `text`，或在 decoder 里新造回合字段 | 活流 S2 已占 thinking 键；信封已有 `turn_id` | **拒绝** |
| D `fromSeq === 0` 当成从起点替换并下发 | 与 `isValidFromSeq` 冲突；Actor 不在本稿 | **拒绝。** BH-03-3 驳回 |
| E 渲染端参数增加 owner，由窗口自己声明 | 调用方可以伪造成对方窗口 | **拒绝。** owner 只来自已有的 IPC `ctx` |
| F 配对中连已绑定的 `requestDetail` 也拒绝 | 活流 S5 写明已绑定 leftover 的详情仍可读 | **拒绝** |
| G 居民 `write` 成功后不投 `accepted`，流结束再标 `failed` | 与活流 S6 同一成功分支；成功写入必须 `accepted` | **拒绝。** BH-03-6 交叉引用，不另起切片 |
| H 为了让普通输入画出失败行而改 `onHostWriteReceipt` | session-actor 是另一路 04 | **拒绝** |

## 3. 选定设计（A）

在途绑定的函数不变量以 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S5 为准：`bindGeneration` 就是现有 `this.connectionGeneration`；`await` 之后代次变了不写入 `engineBoundForGeneration`；断线必须还能 Resume。本稿不改这段，也不改 decoder / thinking 键。

1. **S1 思考块带上信封已有的回合号。** 不变量在 `mapByPriority` 的思考分支：与文本分支相同，展开调用方已经传入的 `turnId`（来自 `turnIdFields`，只读信封上的 `turn_id` / `turnId`）。没有可接纳的回合号时 body 与今日一样不带该键。不改 `decodeBlock`，不改 `reasoningItemFromBody`（它已经抄 body 上的 `turnId`）。不新增字段名。

2. **S2 转发前核对 lease owner。** 不变量在 `UniverseAgentSessionViewChannel.call`：`acquireLease` 仍只用 `ctx` 当 owner，不读渲染端参数。`releaseLease`、`post`、`requestResync`、`acknowledge`、`requestDetail` 把同一个 `ctx` 交给 service，再交给 host。host 上若该 lease 的 `owner` 已设置且与传入的 owner 不同：`releaseLease` 不拆除订阅；`post` 返回已有的 `not_authenticated`；`requestResync` 与 `acknowledge` 保持今日的静默返回；`requestDetail` 返回已有的 `{ ok: false, reason: 'failed' }`。`owner` 未设置时（进程内直接 `acquireLease(sessionId)`、不经过通道）行为与今日相同，避免单测路径被新参数卡死。不把 owner 加进 `IUniverseAgentSessionView` 的渲染端参数。`electron-browser` 的通道注册不改。`listen` 的 `onDynamicDidApplyFrame` 不在本切片。

3. **S3 补洞与断线详情不再装成活连接。** 不变量在 `fillHistory`：`pairingPending` 或 `!isEngineConnected()` 时走今日已有的 `fail(...)`（`historyResult`，`code: 'transport_failed'`），不调用 `ensureEngineSession`，不调用 `getHistory`。这条不经过 `requestDetail`，与活流 S5 不抢函数。
   `requestDetail` **只改断线 `else`**（今日约 457–458 行，用 `binding.sessionId` 调 `fetchToolDetail`）：该臂直接返回 `{ ok: false, reason: 'failed' }`，不调用 `fetchToolDetail`。已连接分支、包括 `pairingPending` 时是否新开 Create/Resume、已绑定 id 的详情是否仍可读，整段只许 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S5 动。本稿禁止重写 `requestDetail` 的已连接臂。不改 `engineBoundForGeneration`，不引入第二套代次计数。
   居民 `writeChat` 成功后的 `mark('accepted')`（约 1602–1605 行）以活流 S6 为准，本稿不改。BH-03-6 不另起切片。

## 4. 不做

- 不实施。不改产品源码。
- 不重做 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 的 `bindGeneration`、decoder、thinking 键、活 L2 mutation、Chat 臂、Create recover。
- 不把 `fromSeq === 0` 改成从起点替换（BH-03-3 驳回）。不改 `range-replaced-apply.ts`。
- 不改 `universeAgentChannel.ts`（只建固定 TLS 通道）。不改 `sessionStreamClose.ts` 的 `closeLocal`。不改 Web 的 `web-empty:` 合同。
- 不改 `listen` / `onDynamicDidApplyFrame` 的 lease 过滤。
- 不改 session-actor 与 mailbox。不改居民 `writeChat` 的成功 `accepted`（活流 S6）。不把普通输入的失败 chrome 改到 `onHostWriteReceipt`。
- 不重开 GitHub Actions。

## 5. 验证

本地、只加断言。门禁见 [health-gates](../../progress/health-gates.md)：`scripts/test.sh` 点名下面已有的测试文件。不建议重开 workflow。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| 在途绑定（不实施，只防再写一套） | `src/vs/platform/universeAgent/test/node/sessionViewHostEngineBind.test.ts` | 断言口径以 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S5 为准：在途断连之后下一次连上仍 Resume。本稿不加第二份测 |
| S1 | `src/vs/platform/universeAgent/test/node/sessionStreamDemux.test.ts` `thinking block maps to reasoning` | 信封带 `turn_id: 't1'` 且块落成 `reasoning` 时，body 含 `turnId === 't1'`。没有 `turn_id` 时 body 仍没有 `turnId`。不改 thinking 键断言 |
| S2 | `src/vs/platform/universeAgent/test/node/universeAgentSessionViewChannel.test.ts` `acquireLease uses IPC ctx as owner` | 窗口 A 领取的 lease，窗口 B 的 `ctx` 调用 `releaseLease` 不拆除；`post` 得到 `not_authenticated`；`requestDetail` 为 `ok: false`。同一 `ctx` 的释放、提交仍成功。不带 owner 的进程内 `releaseLease` 仍能拆掉自己领取的 lease |
| S3 | `src/vs/platform/universeAgent/test/node/sessionViewHostHistoryFill.test.ts`；`sessionViewHostEngineBind.test.ts` 里已有的 `requestDetail` 断线/失败用例 | `isEngineConnected()===true` 且 `pairingPending` 时 `fillHistory` 回 `transport_failed`，且 `getHistory` 次数为 0。未连接时 `requestDetail` 不调用 `fetchToolDetail`。已连接且 `pairingPending` 时本稿不加断言，口径以活流 S5 为准。已连接、非配对、已绑定 id 的详情仍返回 host 的结果 |
| 居民回执（不实施） | `src/vs/platform/universeAgent/test/node/sessionViewHostWriteReceipt.test.ts` `resident write success folds removePendingAction for perm-live` | 断言口径以活流 S6 为准：居民 `write` 成功仍 `accepted`。本稿不加「成功后不投 accepted」的测 |
