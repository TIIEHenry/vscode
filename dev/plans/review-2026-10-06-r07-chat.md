---
title: "审查 r07：chat"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "外部编辑快照会错配或被当成空文件，排队消息失败时会被丢掉，外部会话未发送的附件也不会写入索引。"
---

## r07-1 高
- 症状：一次外部编辑涉及多个文件且调用方传入 `contentFor` 时，结束后读到的「改后内容」可能套到另一个文件上，diff 和后续接受会改错文件。
- 位置：`src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingSession.ts` 第 808–816 行
- 引用：`for (const [resource] of operation.snapshots) { if (idx < contentFor.length && contentFor[idx]) { contentForMap.set(resource, contentFor[idx]); } idx++; }`
- 为什么是问题：`contentFor` 与 `resources` 按下标对齐，但 `snapshots.set` 发生在按资源并行的锁队列里，而且排在 `readFile` / `_getOrCreateModifiedFileEntry` 的 await 之后（约第 720–759 行）。`stopExternalEdits` 再用 `snapshots` 的遍历下标去对 `contentFor`。谁先读完谁先插入，遍历顺序就不再是原来的文件顺序，A 的改后内容会记到 B 上。
- 方向：按开始时的 `resources` 下标保存每个文件对应的 `contentFor`，不要用 snapshot 插入顺序回对。

## r07-2 高
- 症状：外部编辑读不到调用方给的改前/改后文件时，撤销基线或计算出的 diff 会变成空文件，撤销或后台接受会把原内容清掉。
- 位置：`src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingSession.ts` 第 727–753 行
- 引用：`catch { initialContent = ''; }`，随后 `entry.initialContent = initialContent; await entry.resetEditTrackerToInitialContent();`
- 为什么是问题：读失败和「文件本来就是空的」被写成同一条路径。`resetEditTrackerToInitialContent` 会把这份空字符串设成撤销基线。`stopExternalEdits` 第 855–856 行同样把读失败写成 `afterSnapshot = ''`，再交给 `computeEditsFromSnapshots`，得到的是整文件删除。
- 方向：读失败就中止这次外部编辑并保留磁盘上的现有内容，不要用空字符串顶替。

## r07-3 高
- 症状：排队或连续 steering 消息已经从队列取出后，如果合并文本解析失败，这些消息不会回到队列，输入区里也没有原文。
- 位置：`src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts` 第 2033–2105 行
- 引用：`const steeringRequests = model.dequeueAllSteeringRequests();` … `catch (err) { … deferred.complete({ kind: 'rejected', reason }); return; }`
- 为什么是问题：出队在 `try` 之前。解析抛错时只把对应 deferred 标成 rejected，没有把已取出的请求重新放回 `pending`。用户看到的是队列里的消息消失。
- 方向：解析失败时按原顺序把这批请求放回队列，再拒绝 deferred。

## r07-4 高
- 症状：改一条尚未发出的排队消息时，如果它再次入队后最终没有真正发出，原文既不在队列里，内联编辑器里的文本也被拆掉。
- 位置：`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts` 第 3477–3502 行
- 引用：`this._completeDeferredRequestEditAfterAcceptedSend(deferredRequestEdit); deferredRequestEdit = undefined;` 然后 `if (!sent) { abortDeferredEditSend(...); return; }`
- 为什么是问题：编辑开始时第 3290 行已经 `removePendingRequest`。这里在 `acceptAndAwaitSentRequest` 仍可能等到「入队后被拒绝」之前，就调用了 `finishedEditing(true)`（非底部输入模式会 `dispose` 内联编辑器），并清掉用于恢复的 `deferredRequestEdit`。随后 `!sent` 时 `abortDeferredEditSend` 无捕获可还，排队消息回不来。
- 方向：等 deferred 确认已经发出之后再结束编辑；未发出则用捕获把原排队消息放回去。

## r07-5 高
- 症状：外部会话里还没发送的附件，在会话处置或重载后从输入框消失，正文和模式仍可能还在。
- 位置：`src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts` 第 876–891 行
- 引用：`const inputState = rawInputState ? { ...rawInputState, attachments: [] } : undefined;`
- 为什么是问题：外部会话只把这份元数据写入索引（`writeSessionMetadataOnly`）。`hasDraftInput` 会因为还有附件而选择持久化，但写进去的 `inputState.attachments` 恒为空。`loadRemoteSession` 用 `storedInputState` 恢复草稿时，附件没有第二份存储可以补回来。
- 方向：外部会话草稿的附件与正文分开落盘，恢复时再挂回去，不要在索引元数据里直接清空。
