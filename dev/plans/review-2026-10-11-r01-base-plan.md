---
title: "方案 r01：base"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "2026-10-11 Sonnet 第 1 路审查后改稿。hold 3，drop 0，weaken 2。语句失败改为拒绝事务 Promise，不要求对已入队的 END 做 ROLLBACK。压缩错误已会关连接，只清卡住的队列标志。"
---

hold 3，drop 0，weaken 2。2026-10-11 Sonnet 第 1 路只读审查后改过 r01-4、r01-5。

## r01-1（hold，高）

### 问题类
主库缺失且已通过 `quick_check` 的恢复库改名失败时，本次打开空的 `:memory:`，关闭时用本会话缓存覆盖恢复库里的同名键。

### 不变量
改名失败后，已校验恢复库里的原有键保持原值。本会话因读不到旧值而写入的同名键不得在关闭时写回那份恢复库。

### 要动的符号或文件
`src/vs/base/parts/storage/node/storage.ts`：

- `restoreRecoveryDatabaseIfMissing`：临时库失败分支在第 315–322 行；`.recovery-replace` 的同样分支在第 331–338 行。两条都在候选文件仍在、主路径仍不在时返回 `preserveCandidateFallback: true`，并且不再继续 `.backup`。
- `connect` 第 462–466 行：该标志为真时 `doConnect(SQLiteStorageDatabase.IN_MEMORY_PATH)`。
- `doClose` 第 200–221 行：`this.path` 仍是文件路径，不会在第 200 行提前返回；内存连接跳过 `backup()`，有 recovery 回调时进入 `recoverDatabaseOnClose`。
- `recoverDatabaseOnClose` 第 413–414 行：对仍在磁盘上的恢复库 `doConnect` 后 `doUpdateItems`。
- `doUpdateItems` 第 127 行：`ON CONFLICT (key) DO UPDATE SET value = excluded.value WHERE value != excluded.value`。

`src/vs/base/parts/storage/common/storage.ts`：缓存初值为空 `Map`（第 125 行）；`init` 从 `getItems()` 装入（第 215 行）；`close` 把 `this.cache` 交给 recovery（第 358 行）。空内存库的 `getItems()` 得到空表，缓存只含本会话 `set` 过的键。

改法：`preserveCandidateFallback` 为真时，只读载入刚才校验过的那份恢复库的键，再写到新的主库文件。不要用空 `:memory:` 充当这次打开，也不要直接把连接打开在候选文件上。直接打开候选文件时，关闭路径的 `backup()` 会去拷贝当时还不存在的 `this.path`。关闭路径不得再把空缓存 `INSERT` 进原恢复库。

两条分支的后果不一样，测试要分开。只有 temp 分支会让 `recoverDatabaseOnClose` 打开仍在的恢复库并 `INSERT … ON CONFLICT DO UPDATE`。replace 分支在 temp 不存在或已损坏时，关闭会新建或删掉 temp 再换入主路径，主库只剩本会话的键，旧的 `.recovery-replace` 被留在旁边。

### 明确不改
主库文件已经存在时的早退（第 306–308 行）。校验通过且改名成功时，直接把恢复库换到主路径。没有合格恢复库时，现有的 `.backup` 复制和其后的打开失败回退保持原样。

### 本地验证
`src/vs/base/parts/storage/test/node/storage.integrationTest.ts` 里的 `startup recovery from valid .recovery-temp when main db is missing` 只覆盖改名成功。应新增：主库不在，`.recovery-temp` 通过 `quick_check` 且含键 `K=old`，把它改名到主路径的调用抛错且该文件仍在。打开后 `getItems()` 必须读到 `K=old`。会话再把 `K` 写成别的值并关闭后，恢复库里的 `K` 仍是 `old`。

## r01-2（weaken，降为低）

### 问题类
只有 `fs.promises.rename` 已经抛出 `EEXIST` 一类错误时，换入第一跳才会失败并留下 `.recovery-temp`；旁路普通文件已经存在，并不会让这次换入失败。

### 不变量
关闭换入时，已写好并关闭的 `.recovery-temp` 要能换到主路径。残留的 `.recovery-replace` 普通文件不得成为第一跳失败的原因。

### 要动的符号或文件
`src/vs/base/parts/storage/node/storage.ts` 的 `swapRecoveryDatabaseIntoPlace`（第 358–387 行）。第一跳在第 362–364 行，没有先删掉已有旁路。成功后的 `unlink` 失败在第 380–385 行被忽略。第一跳若抛错，异常在第 366 行的 `try` 之外冒出；此时 `recoverDatabaseOnClose` 第 417 行已把 `tempWrittenAndClosed` 设为真，第 420–426 行不会删除 `.recovery-temp`。

改法：把主库 `rename` 到 `.recovery-replace` 之前，先删掉已存在的旁路文件。删除失败则让这次换入失败，不要在第一跳之前吞掉。不要改 `Promises.rename` 的全局错误处理。

反证：`src/vs/base/node/pfs.ts` 第 508 行先调用 `fs.promises.rename`。在 POSIX 上把普通文件改到另一个已存在的普通文件上会成功，目标内容变为源内容，源路径消失。第 528–529 行只在该调用已经抛出 `EEXIST`、`ENOTEMPTY`、`EISDIR` 或 `ENOTDIR` 时原样抛出。目标是文件时，第 532–544 行的 `EPERM` 分支不抛出，只有 `!stat.isFile()` 才抛；普通路径若仍要失败，是第 557 行再抛出。这只说明 POSIX 上「旁路已存在就必然换入失败」不成立。`storage.integrationTest.ts` 第 983 行注明 Windows 的 rename 不覆盖已存在文件，这条没有在 Windows 上跑过，不能写成 Windows 上也已证伪。

### 明确不改
`restoreRecoveryDatabaseIfMissing` 第 306–308 行：主库已在就返回，不装旁边的恢复库。`startup recovery does not overwrite existing main db` 钉的是这条。不要把「主库还在也去装已校验恢复库」加进启动路径。`pfs.ts` 里 `EEXIST` 直接抛出的分支保持不动。

### 本地验证
在 `src/vs/base/parts/storage/test/node/storage.integrationTest.ts` 新增：主库与 `.recovery-replace` 同时是普通文件时，关闭恢复仍把已写好的 `.recovery-temp` 换到主路径，并清掉旁路。`startup recovery does not overwrite existing main db` 继续通过。

## r01-3（hold，高）

### 问题类
覆盖解压把目标目录挪到 `.extract-replace` 之后，临时目录改名失败且搬回也失败时，原目录不在目标路径上，调用方只删除临时目录。

### 不变量
换入失败结束后，调用前的目标目录内容仍在目标路径上，或者失败信息带着仍存放这些内容的旁路路径，且该旁路目录没有被删掉。

### 要动的符号或文件
`src/vs/base/node/zip.ts`：

- `swapExtractedDirectoryIntoPlace` 第 87–107 行：第一跳成功后目标已在旁路；第二跳失败时，搬回失败被吃掉，仍抛出第二跳的错误。
- `extract` 的覆盖分支第 436–438 行：`catch` 只 `Promises.rm(tempPath)`。

改法：搬回失败时不要吞掉。`bypassPath` 和 `targetExisted` 是 `swapExtractedDirectoryIntoPlace` 的局部变量，`extract` 外层 `catch`（第 436–438 行）看不到。搬回重试留在 `swapExtractedDirectoryIntoPlace` 内部；向外只抛带 `bypassPath` 的错误，供调用方记录。搬回仍失败时保留旁路目录。外层继续只删除临时目录。

### 明确不改
第二跳成功后删除旁路的成功路径。拒绝恶意条目或取消时，目标目录保持原内容的现有行为。

### 本地验证
`src/vs/base/test/node/zip/zip.test.ts` 的 `extract overwrite keeps existing content until success` 没有覆盖「两跳都失败」。应新增：目标目录已挪到 `.extract-replace` 后，临时目录改名到目标路径失败，且旁路搬回目标路径也失败。断言原内容仍能在目标路径或错误信息里的旁路路径找到，临时目录被删除，旁路目录在搬回失败时仍在。

## r01-4（hold，中）

### 问题类
事务里单条语句失败只把连接标成错误，`updateItems` 仍可能 resolve；`whenFlushed` 随之 resolve，这批键不会回到待写队列。

### 不变量
语句失败时，这一批 `updateItems` 必须 reject。`flushPending` 必须走到现有的失败合并，等待刷盘的回调必须 reject。不要求把已经排进 `serialize` 的 `END TRANSACTION` 换成 `ROLLBACK`。

### 要动的符号或文件
`src/vs/base/parts/storage/node/storage.ts`：

- `transaction` 第 635–653 行：`serialize` 里同步排好 `BEGIN`、各条语句和 `END TRANSACTION`。语句的 `error` 是异步到的，此时 `END` 已经入队，换不成 `ROLLBACK`。
- `prepare` 第 655–672 行：语句 `error` 和 `finalize` 的错误只调用 `handleSQLiteError`（第 543–547 行），不拒绝事务 Promise。

`src/vs/base/parts/storage/common/storage.ts` 的 `flushPending` 从第 383 行起：只有 `updateItems` 抛错才 `mergePendingAfterFailedFlush`。

改法：在 `transaction` 里用一个语句失败标志。`prepare` 的 `error` / `finalize` 错误除了 `handleSQLiteError`，还置上这个标志。`END TRANSACTION` 的回调里，只要标志为真就 `reject`，即使 `END` 本身没有 `error`。`flushPending` 继续用现有的 `catch`。这只保证调用方重试，不保证已入队的 `END` 会回滚已成功的语句。`ItemTable` 使用 `ON CONFLICT REPLACE`，自然插入很难失败；测试要注入语句 `error`，不要依赖一条会冲突的普通插入。

### 明确不改
`mergePendingAfterFailedFlush` 的合并规则。`updateItems` 整体抛错时已经会拒绝 `whenFlushed` 的路径。不改 `serialize` 的排队方式，也不新增一条赶在 `END` 之前的 `ROLLBACK`。

### 本地验证
`src/vs/base/parts/storage/test/node/storage.integrationTest.ts` 的 `flush failure rejects whenFlushed and retries pending` 只覆盖 `updateItems` 自己 reject。应新增：事务进行中让某条语句发出 `error`（注入，而不是靠普通插入冲突）。`updateItems` reject，`whenFlushed` reject，该键重新进入 `pendingInserts` 或 `pendingDeletes`。

## r01-5（weaken，降为低）

### 问题类
压缩写队列或读队列在 `await` 上停住时，进行中标志保持为真。`dispose` 和 `drain` 会一直等结束事件。zlib 出错本身已经把连接标成失败。

### 不变量
队列处理一旦抛错或压缩 Promise 被拒绝，进行中标志必须清掉，`onDidFinishProcessingWriteQueue` / `onDidFinishProcessingReadQueue` 必须发出。不要再要求「让连接显式失败」：`WebSocketNodeSocket` 第 344–352 行已经把 `_flowManager.onError` 当成致命错误，打出 `onUnexpectedError` 并 `_onClose.fire({ hadError: true })`。

### 要动的符号或文件
`src/vs/base/parts/ipc/node/ipc.net.ts`：

- `_processWriteQueue` 第 518–534 行：帧在 `await` 之前 `shift`；没有 `finally`。停在 `await` 时 `_isProcessingWriteQueue` 保持 `true`。`dispose` 第 365–370 行和 `drain` 第 450–452 行会一直等 `onDidFinishProcessingWriteQueue`。
- `_deflateMessage` 第 543–547 行：`reject` 没有使用，`flush` 只 `resolve`。
- `_processReadQueue` 与 `_inflateFrame` 是同一结构。读队列卡住时，`socket.onClose` 第 357–361 行也不会发出。
- `ZlibDeflateStream` 第 694–696 行、`ZlibInflateStream` 第 623–626 行：zlib 的 `error` 只转到 `_onError`，不结束正在等的 flush Promise。flush 回调是否一定不再来，稿里没有证据，不写进不变量。

改法：两个处理函数用 `finally` 清掉进行中标志并发出结束事件。zlib 出错时 `reject` 当前的 deflate/inflate Promise，让 `await` 结束从而跑到 `finally`。不要在压缩流已经出错后只清标志再继续写。不要重复做第 344–352 行已经做的关连接。

### 明确不改
未压缩帧的写路径和读路径在压缩流正常时的行为。第 344–352 行的致命错误关闭。`WebSocketNodeSocket` 里已有的单帧压缩消息测试所覆盖的成功路径。

### 本地验证
`src/vs/base/parts/ipc/test/node/ipc.net.test.ts` 的 `A single-frame compressed text message` 只覆盖成功解压。应新增：deflate 或 inflate 发出 `error`，或处理函数在 `shift` 之后抛错时，对应的进行中标志回到 `false`，等待中的压缩 Promise reject，`drain` 或 `dispose` 不再停在结束事件上。

反证：发现稿说连接看起来还在、后续帧不再转发。第 344–352 行已经在 zlib `error` 上关闭连接。剩下的是标志卡住对 `dispose`、`drain` 和 socket `onClose` 的等待。
