---
title: "审查 r01：base"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；恢复库改名失败后改走空内存库，关闭时同名键会覆盖磁盘上的原值。"
---

## r01-1 高

- 症状：主库文件不在、旁边的恢复库已经通过 `quick_check` 时，只要把它改名到主路径失败，本次打开的是空的 `:memory:` 库。会话里按“没有旧值”写回的键，会在关闭时覆盖恢复库里的同名原值。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 315–322、462–466、208–221、413–414 行
- 引用：

```315:322:src/vs/base/parts/storage/node/storage.ts
				} catch (error) {
					this.logger.error(`[storage ${this.name}] open(): Unable to restore recovery temp database due to ${error}`);
					if (await Promises.exists(path)) {
						return { preserveCandidateFallback: false, restoredFromBackup: false };
					}
					if (await Promises.exists(tempPath)) {
						return { preserveCandidateFallback: true, restoredFromBackup: false };
					}
				}
```

```462:466:src/vs/base/parts/storage/node/storage.ts
		if (retryOnBusy && path !== SQLiteStorageDatabase.IN_MEMORY_PATH) {
			const recoveryResult = await this.restoreRecoveryDatabaseIfMissing(path);
			if (recoveryResult.preserveCandidateFallback) {
				return this.doConnect(SQLiteStorageDatabase.IN_MEMORY_PATH);
			}
```

```208:221:src/vs/base/parts/storage/node/storage.ts
				if (!connection.isErroneous && !connection.isInMemory) {
					return this.backup().then(resolve, error => {
						this.logger.error(`[storage ${this.name}] backup(): ${error}`);

						return resolve(); // ignore failing backup
					});
				}
				if (typeof recovery === 'function') {
					return this.recoverDatabaseOnClose(recovery).then(resolve, reject);
				}
```

```413:414:src/vs/base/parts/storage/node/storage.ts
			recoveryConnection = await this.doConnect(tempPath);
			await this.doUpdateItems(recoveryConnection, { insert: recoveryItems });
```

- 为什么是问题：`preserveCandidateFallback` 为真时直接 `doConnect(':memory:')`，不读取刚刚校验过的 `.recovery-temp` / `.recovery-replace`，也不再尝试 `.backup`。内存连接在 `doClose` 里走 `recoverDatabaseOnClose`，用本次缓存 `INSERT` 进仍在磁盘上的恢复库。插入语句是 `ON CONFLICT (key) DO UPDATE`（同文件第 127 行）。缓存来自空内存库，只含本会话写过的键，同名键会盖掉恢复库里的原值。
- 方向：改名失败时改为打开这份已校验的恢复库，或只读载入后再写到新文件，不要用空内存库充当它。

## r01-2 高

- 症状：关闭时换入恢复库，若 `.recovery-replace` 已经存在，把主库挪到这个旁路会失败。主库文件还在，下次启动看到主库存在就跳过旁边已经写好的恢复库。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 358–385、306–308 行；`src/vs/base/node/pfs.ts` 第 528–529 行
- 引用：

```358:385:src/vs/base/parts/storage/node/storage.ts
	private async swapRecoveryDatabaseIntoPlace(tempPath: string): Promise<void> {
		const mainExisted = await Promises.exists(this.path);
		const bypassPath = this.toRecoveryReplaceBypassPath(this.path);

		if (mainExisted) {
			await Promises.rename(this.path, bypassPath, false /* no retry */);
		}
		// ...
		if (mainExisted) {
			try {
				await fs.promises.unlink(bypassPath);
			} catch {
				// ignore
			}
		}
	}
```

```306:308:src/vs/base/parts/storage/node/storage.ts
			if (await Promises.exists(path)) {
				return { preserveCandidateFallback: false, restoredFromBackup: false };
			}
```

```528:529:src/vs/base/node/pfs.ts
		if (errorCode === 'ENOTEMPTY' || errorCode === 'EEXIST' || errorCode === 'EISDIR' || errorCode === 'ENOTDIR') {
			throw error;
		}
```

- 为什么是问题：换入成功后的 `unlink(bypassPath)` 失败被忽略，旁路文件会留下来。下次 `rename(主库, .recovery-replace)` 在目标已存在时，`Promises.rename` 对 `EEXIST`（以及落到文件上的 `EPERM`，同文件第 532–544 行最终仍抛出）不会覆盖。换入抛错后，`tempWrittenAndClosed` 为真，已写好的 `.recovery-temp` 不会删（第 424–426 行）。下次打开主库文件仍在，`restoreRecoveryDatabaseIfMissing` 立刻返回，恢复库里的新状态不会装上。
- 方向：换入前先删掉已有的 `.recovery-replace`；主库还在时，若旁边有已校验的恢复库，不要直接跳过。

## r01-3 高

- 症状：覆盖解压时，目标目录已经挪到 `.extract-replace` 之后，若临时目录改名失败且搬回也失败，原目录不再位于目标路径。调用方只删除临时目录。
- 位置：`src/vs/base/node/zip.ts` 第 87–107、436–438 行
- 引用：

```87:107:src/vs/base/node/zip.ts
	if (targetExisted) {
		await Promises.rename(targetPath, bypassPath, false /* no retry */);
	}

	try {
		await Promises.rename(tempPath, targetPath, false /* no retry */);
	} catch (error) {
		if (targetExisted) {
			try {
				await Promises.rename(bypassPath, targetPath, false /* no retry */);
			} catch {
				// ignore — same as recovery swap restore failure
			}
		}

		throw error;
	}
```

```436:438:src/vs/base/node/zip.ts
			} catch (error) {
				await Promises.rm(tempPath).catch(() => { /* ignore */ });
				throw error;
			}
```

- 为什么是问题：第一跳 `rename` 成功后，目标路径上的原目录已经在 `.extract-replace`。第二跳失败时，搬回失败被吃掉，仍然抛出第二跳的错误。外层 `catch` 只 `rm` 临时目录，不会把旁路目录搬回目标路径。对调用方来说，原来的目录内容不在目标路径上。
- 方向：搬回失败时不要吞掉；保留旁路路径并在失败信息里带上，或在外层继续尝试搬回。

## r01-4 中

- 症状：存储事务里单条语句失败后，`updateItems` 仍可能以成功结束。等待刷盘的调用方得到 resolve，失败的插入/删除不会回到待写队列。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 635–672 行；`src/vs/base/parts/storage/common/storage.ts` 第 393–408 行
- 引用：

```635:672:src/vs/base/parts/storage/node/storage.ts
	private transaction(connection: IDatabaseConnection, transactions: () => void): Promise<void> {
		return new Promise((resolve, reject) => {
			connection.db.serialize(() => {
				connection.db.run('BEGIN TRANSACTION');

				transactions();

				connection.db.run('END TRANSACTION', error => {
					if (error) {
						this.handleSQLiteError(connection, `[storage ${this.name}] transaction(): ${error}`);

						return reject(error);
					}

					return resolve();
				});
			});
		});
	}

	private prepare(connection: IDatabaseConnection, sql: string, runCallback: (stmt: Statement) => void, errorDetails: () => string): void {
		const stmt = connection.db.prepare(sql);
		const statementErrorListener = (error: Error) => {
			this.handleSQLiteError(connection, `[storage ${this.name}] prepare(): ${error} (${sql}). Details: ${errorDetails()}`);
		};
		stmt.on('error', statementErrorListener);
		runCallback(stmt);
		stmt.finalize(error => {
			if (error) {
				statementErrorListener(error);
			}
			stmt.removeListener('error', statementErrorListener);
		});
	}
```

```393:408:src/vs/base/parts/storage/common/storage.ts
		this.pendingDeletes = new Set<string>();
		this.pendingInserts = new Map<string, string>();
		const promise: Promise<void> = (async () => {
			try {
				await this.database.updateItems(updateRequest);
				for (const callback of callbacks) {
					callback.resolve();
				}
			} catch (error) {
				this.mergePendingAfterFailedFlush(failedInserts, failedDeletes);
```

- 为什么是问题：语句的 `error` 只把连接标成 `isErroneous` 并写日志，不让事务 Promise reject。事务是否成功只看 `END TRANSACTION` 自己的回调。`flushPending` 只在 `updateItems` 抛错时把这批键并回待写队列。语句已失败但 `END` 仍成功时，`whenFlushed` 会 resolve，这批修改不会再写，直到进程按错误连接走关闭恢复。中途退出时磁盘上没有这批键。
- 方向：语句失败时回滚事务并 reject，让 `flushPending` 走现有的失败合并。

## r01-5 中

- 症状：WebSocket 压缩写队列或读队列一旦在处理中抛错，或 deflate/inflate 的 flush 不再回调，后续帧只入队，不再写出或上交。
- 位置：`src/vs/base/parts/ipc/node/ipc.net.ts` 第 518–534、543–547、556–563 行
- 引用：

```518:534:src/vs/base/parts/ipc/node/ipc.net.ts
	private async _processWriteQueue(): Promise<void> {
		if (this._isProcessingWriteQueue) {
			return;
		}
		this._isProcessingWriteQueue = true;
		while (this._writeQueue.length > 0) {
			const { data, options } = this._writeQueue.shift()!;
			if (this._zlibDeflateStream && options.compressed) {
				const compressedData = await this._deflateMessage(this._zlibDeflateStream, data);
				this._writeFn(compressedData, options);
			} else {
				this._writeFn(data, { ...options, compressed: false });
			}
		}
		this._isProcessingWriteQueue = false;
		this._onDidFinishProcessingWriteQueue.fire();
	}
```

```543:547:src/vs/base/parts/ipc/node/ipc.net.ts
	private _deflateMessage(zlibDeflateStream: ZlibDeflateStream, buffer: VSBuffer): Promise<VSBuffer> {
		return new Promise<VSBuffer>((resolve, reject) => {
			zlibDeflateStream.write(buffer);
			zlibDeflateStream.flush(data => resolve(data));
		});
	}
```

- 为什么是问题：帧在 `await` 之前就已经 `shift` 出队。`_deflateMessage` 的 `reject` 没有使用；zlib 的 `error` 只转到 `_onError`（第 694–696 行），flush 回调不来时这个 Promise 不结束。`_processWriteQueue` 没有 `finally`，抛错或一直停在 `await` 时 `_isProcessingWriteQueue` 保持 true。之后 `writeMessage` 入队后再进入 `_processWriteQueue` 会直接 return。读队列 `_processReadQueue`（第 556–563 行）是同一结构。连接看起来还在，后续 IPC 帧不再转发。
- 方向：处理函数用 `finally` 清掉进行中标志；压缩失败时 reject 对应 Promise，并在出错后停止接受或显式失败这条连接。
