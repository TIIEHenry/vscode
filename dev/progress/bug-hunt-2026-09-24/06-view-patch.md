---
title: 潜在缺陷：视图补丁
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: 视图补丁链上有串会话恢复、diff 被去重吃掉、角色数字被当成助手，以及树刷新与流式覆盖被吞掉。
---

# 潜在缺陷：视图补丁

## 结论

扫描范围内有 6 条用户可见缺陷：Create 冲突恢复会绑到别的会话，文件变更的后续 diff 发不出去，信封角色枚举进不了归属，Agent 树在飞行中的刷新被合并掉，任意 turn 完成会清掉当前流式覆盖，提问展示 id 会撞车。与 `dev/progress/deferred-gaps.md` 无同条。

## 发现

### BH-06-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/sessionCreateRecover.ts` `recoverSessionAfterAlreadyExists` 约 120–133 行；调用点 `src/vs/platform/universeAgent/node/sessionViewHost.ts` `bindEngineSession` 约 610–626 行
- 行为：`ALREADY_EXISTS` 且 List 非空时，先按 `title` 精确匹配，否则取列表里第一个有 `sessionId` 的会话并 Resume。已传入的 `clientSessionId` 只在 List 失败或空列表时才用。
- 为何是缺陷：宿主绑定把 `title` 和 `clientSessionId` 都设成同一个本地 id。引擎会话标题通常不是这个 id，标题匹配落空后会 Resume 列表第一项。时间线、diff、Agent 树都挂到另一个会话上。
- 触发：Create 因 client session id 已存在而失败，List 返回至少一条标题不等于该 id 的会话。
- 已知：无
- 修复方向：List 非空时优先 Resume 已持有的 `clientSessionId`，标题和「第一行」只作没有该 id 时的后备。

### BH-06-2

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/fileMutationJoin.ts` `emitRecord` 约 271–290 行；`onToolRuntimeSnapshot` 约 144–173 行
- 行为：去重键是 `toolCallId + path + operation + turnId`。键已存在则直接 return，不更新 `diffStats`，也不再 `onRecord`。
- 为何是缺陷：同一工具对同一路径的后续快照（补上或改写 diff 统计）被丢掉。审查列表停在第一次快照，可能是没有 diff 或过期的增删行数。
- 触发：绑定已建立后，同一 tool call、路径、操作再次出现 `file_mutation_payload`，且 `diffStats` 有变化。
- 已知：无
- 修复方向：同键再次到达时替换记录并再次通知，至少在 `diffStats` 变化时更新。

### BH-06-3

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/compactedAttribution.ts` `normalizeRole` 约 220–235 行；相邻 `src/vs/platform/universeAgent/node/sessionViewHost.ts` `normalizeAttributionRole` 约 1747–1762 行，`onFrameEnqueued` 基线约 862–867 行。解码在 `src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts` `decodeMessageEnvelope` 约 957–959 行把 `role` 写成数字
- 行为：归属只接受字符串 `user` / `assistant` / `system` / `tool`。数字枚举得到 `undefined`。基线帧对没有 hint 的行使用角色 `assistant`。
- 为何是缺陷：用户消息、工具消息在时间线上被画成助手。压缩行的 `compacted` 归属同样拿不到角色。这是错归属，不是缺字段的静默省略。
- 触发：历史或活流基线里的信封带 proto 数字 `role`，且没有其它字符串角色 hint。
- 已知：无
- 修复方向：按引擎角色枚举把数字映到四态；没有合法角色时不要默认成 `assistant`。

### BH-06-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/agentTreeCoordinator.ts` `pullNow` 约 79–90 行；`scheduleRefresh` 约 64–76 行。相邻 `sessionViewHost.ts` `scheduleAgentTreeRefresh` 约 654–673 行在子代理、turn、分支事件上调用它
- 行为：已有 `inFlight` 时直接返回旧 Promise，新的 `onBound` 不会被调用，飞行结束后也不会再拉一次。
- 为何是缺陷：触发刷新的事件发生在请求已经发出之后时，导航树仍是旧快照，直到下一次独立刷新。成员出现或消失会晚一拍或一直停在旧树。
- 触发：`pullNow` 未完成时又有 `shouldRefreshAgentTree` 为真的流事件，防抖到期后再次 `pullNow`。
- 已知：无
- 修复方向：飞行中的刷新只记一个 dirty 位，当前请求结束后若 dirty 再拉一次并调用最新的 `onBound`。

### BH-06-5

- 严重度：medium
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/overlayDeltaJoin.ts` `applyLifecycle` 约 153–170 行。相邻 `grpcSessionAttachWire.ts` 约 429–432 行写明只看 `turn_completed` 是否出现
- 行为：`turn_completed` 只要存在（含空对象）就 `clearState` 并发出 `overlayActiveTurnClear`，不读完成事件里的 turn id，也不和当前 `this.turnId` 比较。
- 为何是缺陷：另一轮或子轮次的完成会清掉仍在增长的流式正文和思考文本。用户看到正在输出的气泡突然消失。
- 触发：同一 `OverlayDeltaJoin` 上先有 turn A 的 delta，随后 payload 里是 turn B 的 `turn_lifecycle.turn_completed`。
- 已知：无
- 修复方向：仅当完成事件的 turn id 缺省或等于当前 turn 时才清除；其它 turn 忽略。

### BH-06-6

- 严重度：low
- 置信度：中
- 位置：`src/vs/platform/universeAgent/common/sessionView/question-ask.ts` `questionAskChildKey` 约 225–232 行；`timelineItemsFromQuestionAsk` 约 359–371 行
- 行为：缺省子问题 id 用 `q_${index}`。已有 id 先 trim 再当作 childKey。行 id 是 `questionId:childKey`。后写的同 id 行在 `apply.ts` `upsertById` 里覆盖先写的行。
- 为何是缺陷：一张提问卡里，空白子题的展示键会和另一子题的真实 id `q_1`（或 trim 后相同的 id）合成同一时间线行，其中一问从界面消失。
- 触发：同一 `questionId` 下，某个子题 id 为 `q_N`，另一个下标为 N 的子题没有 id。
- 已知：无
- 修复方向：展示用的回退键不要占用已出现的子题 id；撞车时保留两行并用不同的行 id。

## 看过但未立条

- `stream-hello-gap.ts` `planGapFromStreamHello`：会话版本不一致或本地 seq 超前时返回不带填历史窗口的 `bootstrapResync`。`session-actor-stream-fold.ts` 对这两种 reason 只计数后返回。这是写明的 fail-closed，不另造回填窗口。
- `history-result-to-view-patch.ts`：历史补丁丢掉 `upsertPendingAction`，避免把已结束的许可或客户端工具重新变成可响应。有意。
- `stream-event-to-view-patch.ts` `toolCallMetadataMap`：进程级 Map，键不含 session。相邻宿主读的是补丁项上的 `metadata`，没有人读这个 Map，当前没有串会话投影。
- `sessionStreamDemux.ts` `mapToolCall` 约 378 行把尚未有结果的 tool call 标成 `completed`。文件不在本次清单；`toolItemFromBody` 在缺省 status 时也会默认 `completed`，但这条 demux 总是自带 status，默认分支不是活路径。
- `apply.ts` `applyViewFrame`：坏 body 仍推进 cursor。未找到会发出这种帧的生产路径。
- `overlayDeltaJoin.ts` `resetFromSnapshot`：见到快照只重置内部缓冲并发出空数组。注释写明快照路径归 demux。有意。

## 未读完

- 按约定未读 `session-actor.ts`、`mailbox.ts`，以及 `sessions` / `base` / `editor` / `extensions`。
- `sessionViewHost.ts` 只读了绑定、归属 hint、历史填洞和帧入队，没有通读写路径和租约生命周期。
- `sessionStreamDemux.ts`、`grpcSessionAttachWire.ts` 只读了角色、tool 状态、turn 生命周期相关段。
- 上述文件的测试只抽读了 `sessionCreateRecover.test.ts` 的 List 匹配用例，没有跑测试。
