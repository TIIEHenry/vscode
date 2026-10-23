---
title: "方案 r14：copilot-extension"
type: plan
status: draft
phase: N/A
updated: 2026-10-23
summary: "hold 5，drop 0，weaken 0。r14-2 元数据覆盖、r14-5 日志队列已落；云端删除、事件缓冲、会话映射回写仍开。"
---

hold 5，drop 0，weaken 0。

> **落地记录（2026-10-23，部分）：** 本方案仍 `draft`。r14-2 / r14-5 已落；r14-1 / r14-3 / r14-4 仍开。已落子项只改到各自点名的位置，未动其余子项，也不把整份方案升 `implemented`。

## r14-1（hold，高）
### 问题类
云端删除失败后仍删掉本地会话和任务映射。
### 不变量
有云端映射且这次要删云端时，先调用 `CloudSessionApiClient.deleteSession` 并使用它的返回值。只有 `'deleted'` 或 `'not_found'` 才删除本地 SQLite 会话（调用方确实要求删本地时）和 `_cloudSessions` 里的 `cloudTaskId`。返回 `'error'` 时本地会话和映射都留着。没有云端映射时，本地删除保持现状，映射删除仍是空操作。
### 要动的符号或文件
- `RemoteSessionExporter._deleteSessionsFromCloud`：`extensions/copilot/src/extension/chronicle/vscode-node/remoteSessionExporter.ts` 第 656–693 行。本地删除在第 667–672 行，`deleteSession` 的返回值在第 678–682 行被丢掉，第 686 行无条件 `_cloudSessions.delete`。
- `RemoteSessionExporter._deleteCloudSessions`：同文件第 466 行起，执行循环在第 589–616 行。`deleteLocal` 时第 591–598 行先删本地；第 603–608 行虽统计 `cloudErrors`，第 612 行仍无条件删映射。
- 两处都改成：有映射时先看返回值，成功才删映射；需要删本地时也放到成功之后。
### 明确不改
不改 `deleteSession`（`cloudSessionApiClient.ts` 第 286–300 行）的返回约定。不改 `CloudSessionIdStore.delete` 的「键存在才落盘」。不改命令面板的范围选择和确认文案。
### 本地验证
`extensions/copilot/src/extension/chronicle/vscode-node/test/remoteSessionExporter.spec.ts` 没有删除用例。应新增断言：`deleteSession` 解析为 `'error'` 时，`_deleteSessionsFromCloud` 不调用 `_sessionStore.deleteSession`，且 `_cloudSessions` 仍能取出原来的 `cloudTaskId`；解析为 `'deleted'` 或 `'not_found'` 时本地会话和映射都去掉。`_deleteCloudSessions` 在 `deleteLocal === true` 且结果为 `'error'` 时同样保留本地会话和映射，并仍计入 `cloudErrors`。

## r14-2（hold，高）
### 问题类
元数据读失败或 JSON 不合法时被当成文件不存在并覆盖原文件。
### 不变量
`vscode.metadata.json` 能读到字节但 `JSON.parse` 失败，或读取本身失败且不是「文件不存在」时，不要用空对象盖掉原文件，也不要因此写 `{ origin: 'other' }`。只有确认文件不存在时，才允许现有的创建存根路径。

会话已在 `_cache` 里（批量文件保留了 `workspaceFolder`、`worktreeProperties`）时，现码会用缓存重写损坏文件并自愈。不要在 `updateSessionMetadata` 里对所有解析失败直接返回，否则 `setSessionArchived`、`storeWorktreeInfo` 会被静默丢掉，损坏文件永远修不好。「文件不存在」要能对上 `FileSystemError`，测试里的 `MockFileSystemService` 抛的是 `new Error('ENOENT')`，判别方式写进稿再实施。`getSessionMetadata` 在 `sessionId in this._cache` 时不会读单会话文件，发现稿说的「worktree 路径和检查点一起没了」只覆盖被批量文件裁掉或不在缓存里的会话。
### 要动的符号或文件
- `readSessionMetadataFile`：`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts` 第 472–493 行。第 487–490 行的 `catch` 把读失败和解析失败都写成空缓存并返回 `undefined`。
- `getSessionMetadata`：同文件第 445–469 行。第 463–466 行在读结果为空时调用 `updateSessionMetadata(sessionId, { origin: 'other' })`。这里要能区分「文件不存在」和「读坏了」。
- `updateSessionMetadata`：同文件第 495–557 行。第 512–527 行把解析失败也当成 `diskFileExisted = false`；目录还在时不会提前返回；第 533–534 行用空缓存合并；第 551–552 行 `writeFile` 盖掉原文件。解析失败时在这里直接返回，不要 `writeFile`。
- 成功写入改为先写临时文件再替换，避免半截 JSON 下次再走同一条覆盖路径。
### 明确不改
不改 `getWorktreeProperties`（第 247–250 行）的调用形式。文件确实不存在时仍创建带 `origin: 'other'` 的存根。不改 `getRequestDetails` / `writeRequestDetails` 和 `vscode.requests.metadata.json`（每条请求自己的 `checkpointRef` 在这个文件里）。被盖掉的检查点字段是同一份 `vscode.metadata.json` 里 `worktreeProperties` 的 V2 字段 `firstCheckpointRef`、`baseCheckpointRef`、`lastCheckpointRef`。
### 本地验证
`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/test/chatSessionMetadataStoreImpl.spec.ts` 里已有 `should write empty metadata file when per-session file read fails` 和 `should cache empty metadata and not retry when per-session file is missing`，缺文件时仍应写存根、空结果仍应缓存。应新增断言：会话目录存在且 `vscode.metadata.json` 是非法 JSON（其中含 `worktreeProperties.worktreePath` 与 `lastCheckpointRef`）时，`getWorktreeProperties` 之后该文件字节不变。

## r14-3（hold，高）
### 问题类
瞬时上传失败时，已经从缓冲区取出的事件不会放回。
### 不变量
`submitSessionEvents` 返回 `{ ok: false, reason: 'error' }` 时，把该 slot 的 `entries` 放回 `_eventBuffer`，并沿用现有的 `hadTransientError` / `flushFailed` 安全间隔重试。已经成功的 slot 不放回。限流仍只放回限流条目；策略拒绝仍丢弃并禁用会话；抛异常的外层 `catch` 仍整批 `unshift`。
### 要动的符号或文件
- `RemoteSessionExporter._flushBatch`：`extensions/copilot/src/extension/chronicle/vscode-node/remoteSessionExporter.ts`。第 1292 行 `splice` 取出批次；第 1382–1384 行 `else` 只把 `hadTransientError` 设为 true；第 1387–1389 行只把 `requeueOnRateLimit` 放回。在这个 `else` 里把 `slot.entries` 放回缓冲（与第 1374–1380 行的限流放回同一套队列，或在循环后一次 `unshift`）。
### 明确不改
不改 `submitSessionEvents`（`cloudSessionApiClient.ts` 第 202–209 行）和 `_fetch`（第 137–143 行）的返回形状。不改第 1365–1373 行的 `policy_blocked`，不改第 1374–1389 行的限流放回，不改第 1453–1456 行抛异常时的整批放回。不改 `reindexCloudSessions` 对已有映射会话的跳过（`sessionReindexer.ts` 第 388–391 行）。
### 本地验证
`extensions/copilot/src/extension/chronicle/node/test/cloudSessionApiClient.spec.ts` 的 `maps other 4xx/5xx to error` 继续锁住返回值。`extensions/copilot/src/extension/chronicle/vscode-node/test/remoteSessionExporter.spec.ts` 目前只有 `_flushBatch` 提前返回的用例。应新增断言：某 slot 的 `submitSessionEvents` 返回 `{ ok: false, reason: 'error' }` 后，这些 `entries` 回到 `_eventBuffer`；同一批里已成功的 slot 不重复入队；返回 `rate_limited` 时仍只放回限流条目。

## r14-4（hold，高）
### 问题类
`cloudSessions.json` 一次读失败后被当成空映射，下次变更会写回盖掉原文件。
### 不变量
文件不存在时，空映射可以标记为已加载，之后的 `set` 可以创建文件。文件存在但读取失败或 `JSON.parse` 失败时，不把 `_loaded` 设为 true，也不允许 `set` / `delete` / `clear` / `mergeFromCloud` 用当前 Map 调用 `_persist`。成功写入改为临时文件再替换。
### 要动的符号或文件
- `CloudSessionIdStore.load`：`extensions/copilot/src/extension/chronicle/node/cloudSessionIdStore.ts` 第 39–55 行。第 43 行在读之前就把 `_loaded` 设为 true，第 52–54 行的 `catch` 吞掉瞬时错误和解析失败。
- `_persist`：第 145–160 行，第 156 行对同一路径直接 `writeFile`。改为临时文件写入成功后再替换。
- `set`、`delete`、`clear`、`mergeFromCloud` 与 `_schedulePersist`（第 73–88、96–127、134–143 行）：未成功加载时不得安排这次回写。
### 明确不改
不改合法 JSON 的字段校验（缺 `cloudSessionId` 或 `cloudTaskId` 的条目仍然跳过）。不改 `mergeFromCloud` 的合并规则。文件不存在时的「空映射可写」保持现状。
### 本地验证
`extensions/copilot/src/extension/chronicle/node/test/cloudSessionIdStore.spec.ts` 的 `handles corrupted JSON file gracefully` 仍应得到空 Map；`load is idempotent` 与 `persists data and survives reload` 保持通过。应新增断言：损坏 JSON 加载后文件字节不变，随后 `set` 也不把该文件写成只含新条目的对象；读文件被拒绝时 `_loaded` 仍为未加载，下一次 `load` 会再读，且这次失败本身不写文件。

## r14-5（hold，中）
### 问题类
日志在追加成功前就清空内存队列，失败后的再写是空操作。
### 不变量
`appendFile` / `appendFileSync` 成功之后才从 `_newEntries` 去掉这批。失败时这批仍按原顺序留在队列里。持锁期间新进来的条目留在这批之后。

异步写在途、队列还非空时，`flushSync` 会在 `safeFileWriteUtils.ts` 约第 117 行抛 `BugIndicatingError('Locked!')`（`workspaceRecorder.ts` 与 `logContextRecorder.ts` 的 `_forceFlush` 会走到这里）。不要一边写「不给 `flushSync` 补 `_lock`」，一边说 `flushSync` 会重写这批。实施时要么锁被占用就跳过并留下队列，要么让 `flushSync` 能看见这批而不抛锁错误。
### 要动的符号或文件
- `FlushableSafeJSONLFile._getTextAndClear`、`flushAsync`、`flushSync`：`extensions/copilot/src/extension/workspaceRecorder/vscode-node/safeFileWriteUtils.ts` 第 93–122 行。现在两处 flush 都先清空再追加；`flushAsync` 的 `finally` 只释放 `_lock`。
- 调用方不用改恢复逻辑：`WorkspaceRecorderImpl._scheduleFlush`（`workspaceRecorder.ts` 第 287–295 行）和 `LogContextRecorderImpl._scheduleFlush`（`inlineEdits/vscode-node/components/logContextRecorder.ts` 第 177–185 行）仍直接 flush。
### 明确不改
不改 10 秒延迟，不改 `FlushableJSONFile` 的临时文件替换，不改 `workspaceRecorder.ts` 第 265 行 `setContent` 所记录的文档正文，不给 `flushSync` 补 `_lock`。
### 本地验证
仓库里没有 `FlushableSafeJSONLFile` 的测试。应新增断言：`appendFile` 拒绝后，同一条 JSON 仍在队列里，再次 `flushAsync` 会把它写入且只写一次；`appendFileSync` 抛错后 `flushSync` 再调用仍能写回该条。追加期间新 `appendEntry` 的内容排在失败批次之后。
