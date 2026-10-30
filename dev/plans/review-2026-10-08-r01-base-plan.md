---
title: "方案 r01：base"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 3，drop 0，weaken 0。恢复改名失败时停住，备份名留到打开成功之后，打不开的旁路直接判无效。不升 implemented，不升 PRD。"
---
# 方案 r01：base

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 3，drop 0，weaken 0。

r01-1 与 r01-2 都改 `restoreRecoveryDatabaseIfMissing`，并和 `connect` 对齐：先判断主路径和仍在的候选，再决定是否把 `.backup` 放到主路径。r01-3 只改 `validateRecoveryCandidate`。

## r01-1（hold，高）

### 问题类

校验过的 `.recovery-temp` 或 `.recovery-replace` 改名失败后，仍会换上更旧的 `.backup`，或让后面新建空库，把还在旁边的恢复库挡住。

### 不变量

`restoreRecoveryDatabaseIfMissing` 在把校验过的候选 `Promises.rename` 到主路径失败之后：

- 主路径此时已经存在：立刻返回，不再把 `.recovery-replace` 或 `.backup` 换上去。
- 主路径仍不存在，且该候选文件还在：不把 `.backup` 放到主路径；随后的 `connect` 也不对这个主路径调用会建库的 `doConnect`。这次可以用内存库，主路径保持不存在，下次启动仍读该候选。
- 主路径仍不存在，且该候选已经不在：继续下一个候选，然后再试 `.backup`。`validateRecoveryCandidate` 返回 false 的旁路走这条，不把「还在但没通过校验」当成改名失败。

### 要动的符号或文件

`src/vs/base/parts/storage/node/storage.ts` 的 `SQLiteStorageDatabase.restoreRecoveryDatabaseIfMissing`：`.recovery-temp` 与 `.recovery-replace` 两处 `Promises.rename(..., path, false)` 的 `catch` 在记日志之后先看主路径和该候选是否还在，再按上面三条返回或继续。

`connect`：恢复函数返回后，主路径仍不存在且校验过的候选还在时，跳过 `doConnect(path)`。没有任何恢复候选时，首次打开仍由 `doConnect` 建库。

### 明确不改

`swapRecoveryDatabaseIntoPlace`、`recoverDatabaseOnClose`、`backup`。`doConnect` 在没有恢复候选时的默认打开模式。`Promises.rename`。主路径一开始就存在时的早退。校验失败后继续下一个候选或 `.backup` 的顺序（`startup recovery from valid .recovery-replace when temp is corrupt`、`startup recovery preserves corrupt sidecars and restores from backup`）。

### 本地验证

套件 `Storage Library`（`src/vs/base/parts/storage/test/node/storage.integrationTest.ts`）。用与 `basics (close recovery keeps temp when main path is missing and replace throws ENOENT)` 相同的方式替换 `fs.promises.rename`（`Promises.rename` 调用它）。

新增断言：

- 主路径不在，`.recovery-temp` 是可打开的库，`.backup` 是另一份库。temp 换到主路径的 `rename` 先用原始 `rename` 完成换名，再抛 `ENOENT`。打开后读到 temp 里的键，`.backup` 字节与打开前相同。
- 同上，但 `rename` 抛 `EACCES` 且不移动 temp。`getItems` 结束；主路径不存在；temp 里的键还在；`.backup` 字节不变。去掉替换后再构造一次，读到 temp 的键，主路径出现，temp 路径消失。

第一条与本文件现有写法一样，在 Windows 上 `test.skip`（本文件注明 Windows 的 rename 不替换已存在文件）。第二条各平台都跑。

保持通过：`startup recovery from valid .recovery-temp when main db is missing`、`startup recovery from valid .recovery-replace when temp is corrupt`、`startup recovery does not overwrite existing main db`、`startup recovery preserves corrupt sidecars and restores from backup`。

```bash
scripts/test.sh --runGlob src/vs/base/parts/storage/test/node/storage.integrationTest.ts --grep "startup recovery|recovery temp"
```

## r01-2（hold，高）

### 问题类

主库不在、只能靠 `.backup` 时，备份在打开成功前就被改名拿走；这次打开失败后，唯一副本变成 `.corrupt`，下次不再当备份读。

### 不变量

`.backup` 上的字节在 `doConnect(主路径)` 成功返回之前，仍以 `.backup` 这个名字存在。打开失败时字节回到 `.backup`，主路径不存在，本次连接是内存库。下次启动仍从 `.backup` 再试。打开成功之后才去掉 `.backup`，或留到现有 `close` → `backup()` 覆盖。

这次若是「主路径原先不在、刚从 `.backup` 复制出来」的成功打开，才可以删除那份 `.backup`。主路径原先就在的成功打开保留 `.backup`。

### 要动的符号或文件

`restoreRecoveryDatabaseIfMissing` 里 `Promises.rename(this.toBackupPath(path), path, false)`：打开前用 `Promises.copy` 把备份放到主路径（与 `backup()` 相同，`preserveSymlinks: false`），`.backup` 留在原地。复制发生在 r01-1「候选还在则停」之后，且当时主路径不存在。

`connect` 的失败分支因此仍能走到「把 `.backup` 换回主路径再打开；第二次失败则把主路径改回 `.backup`」（现有改回在 `toBackupPath` 的那次 `rename`）。`.backup` 在第一次失败时还在，失败结束时主路径不存在。

### 明确不改

主路径上已有文件时的失败处理：主路径改名为 `.corrupt`，再试 `.backup`，打不开再改回 `.backup`。对应 `basics (corrupt DB falls back to empty DB)`、`basics (corrupt DB restores from previous backup)`、`basics (corrupt DB falls back to empty DB if backup is corrupt)`。`restoreRecoveryDatabaseIfMissing` 不读 `.corrupt`。`FAILED_OPEN_ARCHIVE_SUFFIX` 保持 `.corrupt`。

### 本地验证

同套件 `Storage Library`。新增断言时不要把 recovery 回调传给 `close`，避免 `recoverDatabaseOnClose` 另写一份库；关闭可以拒绝，与 `basics (corrupt DB falls back to empty DB if backup is corrupt)` 相同。

新增断言：

- 主路径不在，没有 recovery 旁路，`.backup` 是无法打开的非空字节。`getItems` 结束，`checkIntegrity(false)` 含 `in-memory`，`.backup` 字节与打开前相同，主路径不存在。再构造一次，仍是内存库，`.backup` 字节仍相同，主路径仍不存在。
- 主路径不在且 `.backup` 可打开时，仍读到备份里的键。

保持通过：上述三条 `basics (corrupt DB …)`，以及 `startup recovery preserves corrupt sidecars and restores from backup`。

```bash
scripts/test.sh --runGlob src/vs/base/parts/storage/test/node/storage.integrationTest.ts --grep "corrupt DB|startup recovery"
```

## r01-3（hold，中）

### 问题类

恢复旁路存在但 sqlite 打不开时，校验对尚未打开的句柄调用 `close`，Promise 不结束，存储打开停住。

### 不变量

打开回调收到错误时，`validateRecoveryCandidate` 以 `false` 结束，并且不调用 `db.close`。`error` 监听只在打开已经成功时才 `close`。`quick_check` 失败时句柄已经打开，仍先 `close` 再返回 `false`。返回 `false` 之后，恢复继续下一个候选或 `.backup`；没有可用备份时按现有首次打开建库。`connect` 对 `restoreRecoveryDatabaseIfMissing` 的 await 会结束。

### 要动的符号或文件

`validateRecoveryCandidate` 的 `finish`、`Database` 打开回调，以及 `db.on("error")`。打开失败调用 `finish(false)`，不把 `db` 交给 `finish`。这与 `doConnect` 里 `SQLITE_CANTOPEN` 不 `close` 同一原因：`@vscode/sqlite3` 在 `open == false` 时把 `close` 排进队列，打开失败不会跑 `Process()`，回调不会来。

### 明确不改

`doConnect` 的打开和 `SQLITE_CANTOPEN` 分支。`exists` 为假或 `stat.size === 0` 时直接返回 `false`。能打开但 `quick_check` 不是 `ok` 的损坏文件仍返回 `false` 并关闭已打开的句柄（`startup recovery preserves corrupt sidecars and restores from backup`）。不新增恢复后缀，不把 `.corrupt` 纳入候选。

### 本地验证

同套件。新增断言：

- 主路径不在，`.recovery-temp` 是非空目录（`stat.size !== 0`，能通过现在的空文件检查），旁边有可打开的 `.backup`。`getItems` 在有限时间内结束并读到备份里的键，该目录仍在。
- 没有 `.backup` 时，同样在有限时间内结束并得到可用库（新建空库），不等待挂住的 `close`。
- 进程读不了的旁路文件同样在有限时间内得到 `false` 并继续。已经不存在的路径仍由 `exists` 返回 `false`。

保持通过：`startup recovery preserves corrupt sidecars and restores from backup`。

```bash
scripts/test.sh --runGlob src/vs/base/parts/storage/test/node/storage.integrationTest.ts --grep "startup recovery|recovery candidate"
```
