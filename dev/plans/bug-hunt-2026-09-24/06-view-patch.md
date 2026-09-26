---
title: "Create 错绑已有方案；数字角色与飞行中的树刷新、错轮次清流式覆盖仍要收"
type: plan
status: accepted
phase: M7
updated: 2026-09-25
summary: "数字 role 的压缩事实仍改 compactedAttribution。2026-09-25：错轮次与缺 id 不清流式正文、缺角色改中性行、数字角色映射归活流方案的 host。本稿仍不改 sessionViewHost / overlayDeltaJoin。"
---

# Create 错绑已有方案；数字角色与飞行中的树刷新、错轮次清流式覆盖仍要收

> **本稿是方案，不是实施。**
> **冲突域：** 只动 `compactedAttribution.ts` 的 `normalizeRole`，以及 `agentTreeCoordinator.ts` 的 `pullNow`。
> **禁止改** [live-stream-bytes-decode](../live-stream-bytes-decode.md) 已占的 `sessionViewHost.ts`、`overlayDeltaJoin.ts`、`sessionCreateRecover.ts`、`fileMutationJoin.ts`。不改 `stream-event-to-view-patch`、`history-result-to-view-patch`、`stream-hello-gap`、`common/sessionView`、`conversationViewFrame`。
> **2026-09-24 审查：** S1 的 host baseline 与 S3 的 join clear 从切片里拿掉，只交叉引用。S1 的 host 断言不再挂在压缩事实测试上。
> **不发明**协议字段。角色数字 `1` / `2` / `3` / `4` 与 `TurnCompletedChange.turn_id` 都是 HEAD 或已签收方案里已有的，不是新号。

## 核查

对照 [扫描文](../../progress/bug-hunt-2026-09-24/06-view-patch.md) 与 HEAD。

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-06-1 | 成立 | `recoverSessionAfterAlreadyExists` 约 120–121 行先按 `title` 精确匹配，否则取第一个有 `sessionId` 的行。`bindEngineSession` 约 611、620–624 行把 `title` 和 `clientSessionId` 都设成同一个本地 id。与 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S4 同一条，本稿不另起切片。 |
| BH-06-2 | 驳回 | `emitRecord` 约 285–287 行同键直接 return、不改 `diffStats`，行为还在。用户可见的「审查列表停在过期增删行数」不成立：`diffStats` 在 workbench 只有类型声明（`sourcesReviewAttribution.ts` 约 21 行），chip 按 `turnId` 去重（`buildAttributionChips` 约 193–198 行），不画增删行数。 |
| BH-06-3 | 成立 | `decodeMessageEnvelope` 约 957–959 行把 `role` 写成 `Number`。`normalizeRole` 约 221 行、`normalizeAttributionRole` 约 1748 行非字符串即 `undefined`。baseline 约 867 行 `hint?.role ?? 'assistant'`。文本行投影约 349 行把非 `user` / `system` 画成 `assistant`。 |
| BH-06-4 | 成立 | `pullNow` 约 83–84 行已有 `inFlight` 时返回旧 Promise，不调用这次的 `onBound`，`finally` 约 87–88 行清掉飞行标记后也不再拉。`scheduleRefresh` 约 71–73 行防抖到期只再进 `pullNow`。 |
| BH-06-5 | 成立 | `applyLifecycle` 约 154–170 行只要 `turn_completed` 不是 `undefined` / `null` 就 `clearState` 并发 `overlayActiveTurnClear`，不读 turn id。同一会话一个 `OverlayDeltaJoin`（`ensureSessionSidecar` 约 634 行，实例化约 642 行）。 |
| BH-06-6 | 驳回 | `questionAskChildKey` 约 229–232 行缺省 `q_${index}`、已有 id trim 后当 childKey，函数还在。用户可见的「一问消失」不成立：`timelineItemFromQuestionAsk` 约 391 行只取多行结果的 `[0]`；生产 `onQuestionAsked` 约 495 行只用这一行。子题展示走 `summary.items`，`projectQuestionAskItems` 不把 `q_i` 写进 `items[].id`。`upsertById` 碰不到两行同 id。 |

## Problem class

- **症状：** 历史或活流信封的角色是数字 `1` 时，用户文本被画成助手；压缩行 sidecar 也没有角色。数字 `4` 映成 `tool` 之后，文本行投影仍把非 `user` / `system` 画成助手，那一笔不在本稿收。Agent 树在上一次拉取还没回来时又遇到子代理 / turn / 分支事件，导航树停在旧快照。另一轮的 `turn_completed` 带了不同 turn id 时，会把仍在增长的流式正文清掉。字节路径今日没有这个 id，清覆盖的行为先不变。
- **类标签：** **数字角色进不了 sidecar** + **飞行中的树拉取丢掉下一次** + **完成事件不认 turn**。
- **复发机制：** 归属只测字符串 `user` / `assistant`；树测在上一次 `flush` 之后才推事件（`sessionViewHostNavigator.test.ts` `sub_agent_completed schedules additional tree fetch`）；`overlayDeltaJoin.test.ts` 的 `turn_completed clears overlay` 把带 `turn_id: 't1'` 的完成也锁成无条件 clear。

Create 撞 `ALREADY_EXISTS` 绑到名册第一行仍在，归类与切片都在 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S4，不重复写进本类。

## 0. 一句话结论

数字 `role` 用 `titleFromRole` 已有的 `1` / `2` / `3` / `4` 映到 `user` / `assistant` / `system` / `tool`，使用户文本行的 sidecar 成为 `user`。normalize 得不到角色时 baseline 不写 `assistant`；时间线缺省仍画成助手，中性行不在本稿。树协调器在飞行中只记一个 dirty，当前请求结束后再拉一次并调用最新的 `onBound`。`turn_completed` 对象上的 turn id 缺省或等于当前 turn 才清除流式覆盖，其它 turn 忽略。Create 恢复不在本稿切片。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| List 非空时 title 优先，否则第一个有 `sessionId` 的行；`clientSessionId` 只在 List 失败或空列表时 Resume | `sessionCreateRecover.ts` `recoverSessionAfterAlreadyExists` 约 120–133 行；`resumeClientSessionIfKnown` 约 136–149 行 |
| 宿主 Create 的 title 与 client id 都是本地 id | `sessionViewHost.ts` `bindEngineSession` 约 611、620–624 行 |
| 该恢复已选定：按 `clientSessionId` 找行，否则 Resume 该 id，再失败 throw；禁止 title 与名册第一行 | [live-stream-bytes-decode](../live-stream-bytes-decode.md) S4、文首 2026-09-22 核对 |
| 同键 `toolCallId:path:operation:turnId` 已发出则不再 `onRecord` | `fileMutationJoin.ts` `emitRecord` 约 284–287 行 |
| 审查 chip 不读 `diffStats` | `sourcesReviewAttribution.ts` `buildAttributionChips` 约 193–214 行 |
| 解码把信封 `role` 写成数字 | `grpcSessionAttachWire.ts` `decodeMessageEnvelope` 约 957–959 行 |
| 两处归属函数只接受字符串四态 | `compactedAttribution.ts` `normalizeRole` 约 220–235 行；`sessionViewHost.ts` `normalizeAttributionRole` 约 1747–1762 行 |
| 标题函数已经认数字 `1` You、`2` Agent、`3` System、`4` Tool，以及去掉 `MESSAGE_ROLE_` 前缀的字符串 | `sessionStreamDemux.ts` `titleFromRole` 约 147–164 行 |
| baseline 没有 hint 角色就写 `assistant` | `sessionViewHost.ts` `onFrameEnqueued` 约 862–867 行 |
| 文本行：`user` / `system` 以外（含缺省、含 `tool`）画成 `assistant`。函数注释写缺省应中性，代码未做 | `conversationSessionView.ts` `timelineItemToEntry` 约 348–349 行；`attributionFromHint` 约 1716–1718 行总会写入 `role` |
| 缺 attribution 的文本行应为中性，不猜 title | [conversation-stream-timeline](../conversation-stream-timeline.md) §3.3 |
| 压缩补丁行缺角色时用 `tool` 或 `system`，不是 `assistant` | `sessionViewHost.ts` `onFrameEnqueued` 约 883–887 行 |
| 已有 `inFlight` 则返回旧 Promise | `agentTreeCoordinator.ts` `pullNow` 约 79–90 行 |
| 流事件走防抖 `scheduleRefresh`；流打开走立即 `pullNow` | `sessionViewHost.ts` `scheduleAgentTreeRefresh` 约 654–673 行；`handleHostStreamPayload` 约 679–680 行 |
| 任意 `turn_completed`（含空对象）清除并出 `overlayActiveTurnClear` | `overlayDeltaJoin.ts` `applyLifecycle` 约 153–170 行 |
| 字节路径把完成臂解成 `turn_completed: {}`，不留内层 `turn_id` | `grpcSessionAttachWire.ts` `decodeTurnLifecycleEvent` 约 793–800 行 |
| 已签收方案要求把 `TurnCompletedChange.turn_id=1` 解进嵌套对象；S1 的文件列含 `overlayDeltaJoin.ts` | [live-stream-bytes-decode](../live-stream-bytes-decode.md) S1 表 |
| 提问多行函数无生产调用方；Actor 只用第一行 | `question-ask.ts` `timelineItemsFromQuestionAsk`；`session-actor-local-fact.ts` `onQuestionAsked` 约 495 行 |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 数字四态只进 compactedAttribution.normalizeRole；树 dirty 再拉** | 见 §3。Create、host baseline、join clear 只引用已签收方案 | **选定** |
| B 再写一条 Create：List 非空优先 Resume `clientSessionId` | 与活流 S4 同文 | **拒绝。** 交叉引用，不另起切片 |
| C 同键替换 `diffStats` 并再次 `onRecord` | BH-06-2 驳回；chip 不显示行数 | **拒绝** |
| D 给 `role` 发明第五态或新字段名 | 四态与数字已在 `titleFromRole` | **拒绝** |
| E 缺角色仍默认 `assistant`，只映数字 | sidecar 仍把「没有角色」写成助手 | **拒绝** |
| F 在本稿改 `timelineItemToEntry` 做中性行 | 中性行已是 [conversation-stream-timeline](../conversation-stream-timeline.md) §3.3 | **拒绝。** 不另起投影切片 |
| G 飞行中合并掉后续 `onBound`，维持返回旧 Promise | 成员变化停在旧树 | **拒绝** |
| H 在本稿改 `applyLifecycle`，错 turn 不清 | 活流 S1 的文件列含 `overlayDeltaJoin.ts` | **拒绝在本稿改。** 2026-09-25 裁定归活流 S1：别的 turn 不清；缺 `turn_id` 也不清。解码补上 `turn_id` 必须与 join 同一提交 |
| I 展示回退键避开已有子题 id | BH-06-6 驳回 | **拒绝** |

## 3. 选定设计（A）

Create 恢复的函数不变量以 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S4 为准：先在 List 里找 `sessionId === clientSessionId`；找不到再 `resumeClientSessionIfKnown`；再失败才 throw。非空 List 没有匹配行时仍然 Resume 这个 client id，只是不 Resume 名册第一行，也不再按 title 匹配。本稿不改 `sessionCreateRecover.ts` 的实施切片。

1. **S1 数字角色进压缩事实。** 不变量只在 `compactedAttribution.ts` 的 `normalizeRole`：字符串仍只认 `user` / `assistant` / `system` / `tool`。数字只认 `titleFromRole` 已有的 `1` → `user`、`2` → `assistant`、`3` → `system`、`4` → `tool`。其它数字与非字符串仍是 `undefined`。不新增枚举名，不改 `decodeMessageEnvelope`。
   `sessionViewHost.ts` 的 `normalizeAttributionRole` 与 `onFrameEnqueued` 的 `?? 'assistant'`（约 867 行）不在本稿。那份文件整份属于活流方案，也与 [03-session-view-host](03-session-view-host.md) 的冲突域重叠。2026-09-25 裁定：文本行无法归一化时不写 `assistant`，投影画中性只读行。数字 `1`/`2`/`3`/`4` 的映射归活流方案里的 `normalizeAttributionRole`，复用本稿 `normalizeRole`。投影不设角色缺省。
   文本行中性投影只交叉引用 [conversation-stream-timeline](../conversation-stream-timeline.md) §3.3。本稿不改 `conversationSessionView.ts`。

2. **S2 飞行中的树刷新记一个 dirty。** 不变量在 `AgentTreeCoordinator.pullNow`：没有 `inFlight` 时与今日相同，开始一次 `doFetch` 并调用这次传入的 `onBound`。已有 `inFlight` 时不开始第二次传输，把 dirty 记上，并记住**最后一次**传入的 `onBound`。当前请求结束（`doFetch` 已调用或未调用它自己的 `onBound` 都算结束）后，若 dirty 为真，清掉 dirty 再拉一次，这次调用最后记下的 `onBound`。dirty 在一次飞行里只保留一位，不排队多次。`agentTreeUnsupported` 时仍直接返回，不记 dirty。`scheduleRefresh` 的 250ms 防抖不改。不改 `scheduleAgentTreeRefresh` 的调用条件。

3. **BH-06-5 不另起切片。** `applyLifecycle` 任意完成都 clear。占 `overlayDeltaJoin.ts` 的依据是 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S1 表的文件列。本稿不改该文件。2026-09-25：别的 turn 的完成不清当前流式正文；没有 `turn_id` 的完成也不清。`decodeTurnLifecycleEvent` 把 `turn_id` 解进 `turn_completed` 与 join 判断同一提交，归 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S1。

## 4. 不做

- 不实施。不改产品源码。
- 不重做 [live-stream-bytes-decode](../live-stream-bytes-decode.md) 的 decoder、thinking 键、活 L2 mutation、Chat 臂、`bindGeneration`。
- 不改 `fileMutationJoin.ts`（BH-06-2 驳回，且该文件属活流）。不改 `sessionCreateRecover.ts`（BH-06-1 只交叉引用）。不改 `sessionViewHost.ts` 与 `overlayDeltaJoin.ts`。不改 `question-ask.ts` 的 childKey（BH-06-6 驳回）。
- 不改 `stream-event-to-view-patch` / `history-result-to-view-patch` / `stream-hello-gap` 的已有 fail-closed（扫描「看过但未立条」）。
- 不把文本行缺省角色改成中性投影；那是 [conversation-stream-timeline](../conversation-stream-timeline.md) §3.3。
- 不手改 `node/sessionCore/**` 的 vendored Actor。`onQuestionAsked` 只作为驳回依据。
- 不重开 GitHub Actions。

## 5. 验证

本地、只加断言，不重开 workflow。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| Create（不实施，只防再写一套） | `src/vs/platform/universeAgent/test/node/sessionCreateRecover.test.ts` | 断言口径以 [live-stream-bytes-decode](../live-stream-bytes-decode.md) S4 为准：非空 List 无匹配 id 不 Resume 第一行。本稿不加第二份测 |
| S1 | `src/vs/platform/universeAgent/test/node/grpcSessionAttachWire.test.ts` 里 `projectCompactFactsFromBranchReasonEnvelope` | 数字 `role: 1` 得到 `role: 'user'`；`role: 4` 得到 `tool`；`role: 0` 或对象没有 `role` 时事实里没有 `role: 'assistant'`。不加 host baseline 断言 |
| S2 | `src/vs/platform/universeAgent/test/node/sessionViewHostNavigator.test.ts` `sub_agent_completed schedules additional tree fetch`（上一次已 flush） | `pullNow` 的 fetch 尚未 resolve 时再 `pullNow` 或 `scheduleRefresh` 到期：飞行中的 fetch 次数不增加；resolve 之后恰好再 fetch 一次，且 `onBound` 是第二次传入的回调。`UNIMPLEMENTED` 之后不再拉 |
| BH-06-5（不实施） | `src/vs/platform/universeAgent/test/node/overlayDeltaJoin.test.ts` `turn_completed clears overlay` | 口径以活流 S1 为准。本稿不加「其它 turn 不清」的断言 |

门禁按改动面跑现有 `scripts/test.sh` 或对应的 `src/vs/platform/universeAgent/test/node` 用例。不建议重开 GitHub Actions。
