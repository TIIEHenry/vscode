---
title: "审查 r01：base"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "3 条；最重的是主库缺失时，恢复改名失败会用旧备份或新空库挡住仍在的恢复库，打开失败还会把仅存备份改成下次不会读的 .corrupt。"
---

## r01-1 高
- 症状：主库文件不在时，已经通过检查的 `.recovery-temp` 或 `.recovery-replace` 只要改名失败，就会继续把更旧的 `.backup` 换上，或让后面新建一个空库，把仍留在旁边的较新恢复库挡住。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 304–328 行
- 引用：`await Promises.rename(tempPath, path, false /* no retry */);` 失败后只打日志，接着对 `.recovery-replace` 和 `.backup` 做同样的 `Promises.rename(..., path, false)`
- 为什么是问题：`exists(path)` 为假之后还有多次 `await`。另一路打开可能已经把 temp 换成主库，这一路的 `rename` 得到 `ENOENT` 后并不停。`fs.promises.rename` 会替换已存在的目标文件，于是 `.backup` 盖住刚恢复的主库。若备份也不存在，函数返回时主路径仍空着，`connect` 里的 `doConnect` 会按「文件不存在就建库」把空库建出来。主路径一旦存在，下次进这个函数第 299 行就返回，旁边的 `.recovery-temp` 不再被读。
- 方向：校验过的候选改名失败时先再看主路径是否已经在；在就停，不要把更旧的备份覆盖上去，也不要让随后的打开新建空库。

## r01-2 高
- 症状：主库缺失、只能靠 `.backup` 恢复时，备份会先被挪到主路径；这次打开若失败，这份仅存的库会被改成 `.corrupt`，下次启动不会再把它当备份读回来。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 323–325 行
- 引用：`await Promises.rename(this.toBackupPath(path), path, false /* no retry */);`
- 为什么是问题：挪走发生在 `doConnect` 成功之前，`.backup` 这个名字已经没了。打开失败后第 470 行把主路径改名为 `.corrupt`，第 476 行再去找 `.backup` 会失败，第 478 行直接改用内存库。把文件改回 `.backup` 的第 487 行只有在第 476 行成功之后才会走到。`restoreRecoveryDatabaseIfMissing` 不看 `.corrupt`。下次主库和 `.backup` 都不在，只能新建空库。
- 方向：确认主路径上的库能打开之后再去掉 `.backup`；打开失败时把文件留在 `.backup`。

## r01-3 中
- 症状：恢复旁路文件存在但打不开时，存储打开会停在校验里，既不会改用备份，也不会建一个能用的库。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 261–276 行、第 288–290 行
- 引用：`if (err) { finish(false, db); return; }`，而 `finish` 在有 `db` 时执行 `db.close(() => resolve(result));`
- 为什么是问题：同文件 `doConnect` 第 518 行对 `SQLITE_CANTOPEN` 不调用 `close`，因为句柄没有打开时关闭回调不会来。这里打开失败仍把 `db` 交给 `finish`，`error` 事件同样如此。`close` 被排进队列后 `Process()` 不会跑，Promise 不结束。`connect` 停在第 439 行的 `await this.restoreRecoveryDatabaseIfMissing(path)`。目录、已删除路径或无读权限的旁路都会走这条打开失败；大小不为 0 的目录也能通过前面的 `stat.size === 0` 检查。
- 方向：打开失败时直接把候选当成无效并结束 Promise，不要对尚未打开的句柄调用 `close`。
