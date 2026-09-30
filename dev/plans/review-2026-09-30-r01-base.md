---
title: "审查 r01：base"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "base 中解压可写出目标目录外，失败的重命名会删源，存储打开、关闭恢复和迁移会在写入确认前丢掉原数据。"
---

# 发现

## r01-1 高
- 症状：解压 ZIP 时，目录条目可以在目标目录之外创建目录；文件条目在目标路径不以分隔符结尾时，可以写到名称以前缀重合的兄弟目录。
- 位置：`src/vs/base/node/zip.ts` 第 75–81 行、第 150–153 行
- 引用：
```
75|function extractEntry(stream: Readable, fileName: string, mode: number, targetPath: string, options: IOptions, token: CancellationToken): Promise<void> {
76|	const dirName = path.dirname(fileName);
77|	const targetDirName = path.join(targetPath, dirName);
78|	if (!targetDirName.startsWith(targetPath)) {
79|		return Promise.reject(new Error(nls.localize('invalid file', "Error extracting {0}. Invalid file.", fileName)));
80|	}
81|	const targetFileName = path.join(targetPath, fileName);
```
```
150|			// directory file names end with '/'
151|			if (/\/$/.test(fileName)) {
152|				const targetFileName = path.join(targetPath, fileName);
153|				last = createCancelablePromise(token => promises.mkdir(targetFileName, { recursive: true }).then(() => readNextEntry(token)).then(undefined, e));
```
- 为什么是问题：目录条目只做 `path.join` 后 `mkdir`，没有越界判断。条目名为 `../../outside/`、目标为 `/tmp/out` 时，实际创建 `/outside/`。文件条目只检查目录名的 `startsWith(targetPath)`。目标为 `/tmp/out`（末尾没有分隔符）、条目名为 `foo/../../out-evil/pwned.txt` 时，目录变成 `/tmp/out-evil`，该字符串以前缀命中检查，文件被写到 `/tmp/out-evil/pwned.txt`。
- 方向：规范化后的最终路径必须落在目标目录内，目录条目和文件条目用同一条判断。

## r01-2 高
- 症状：源路径以 `.` 结尾时，`rename` 因任意错误失败都会先拷贝再删除源；目标已是非空目录时，源目录被合并进目标后删除。
- 位置：`src/vs/base/node/pfs.ts` 第 511–524 行
- 引用：
```
511|		// In two cases we fallback to classic copy and delete:
512|		//
513|		// 1.) The EXDEV error indicates that source and target are on different devices
514|		// In this case, fallback to using a copy() operation as there is no way to
515|		// rename() between different devices.
516|		//
517|		// 2.) The user tries to rename a file/folder that ends with a dot. This is not
518|		// really possible to move then, at least on UNC devices.
519|		if (source.toLowerCase() !== target.toLowerCase() && error.code === 'EXDEV' || source.endsWith('.')) {
520|			await copy(source, target, { preserveSymlinks: false /* copying to another device */ });
521|			await rimraf(source, RimRafMode.MOVE);
522|		} else {
523|			throw error;
524|		}
```
- 为什么是问题：`&&` 优先于 `||`，所以只要 `source.endsWith('.')` 为真，错误码不必是 `EXDEV`。源为 `/data/backup.`、目标 `/data/backup2` 已是非空目录时，`rename` 会以 `ENOTEMPTY`、`EEXIST` 或 `EPERM` 失败；这里仍执行拷贝，再 `rimraf` 源。拷贝是往已有目录里合并，源路径随后消失。`.` 和 `..` 同样满足 `endsWith('.')`，而 `rimraf`（第 49–50 行）只拒绝根路径或盘符，不拒绝 `..`。
- 方向：只有跨设备或确实无法表示尾点名时才拷贝，并且拷贝成功后再删源；其余错误原样抛出。

## r01-3 高
- 症状：数据库打开失败后，原文件被直接删除；备份改名失败被忽略，并在原路径建出一个空库当作打开成功。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 295–310 行
- 引用：
```
295|			// Otherwise, best we can do is to recover from a backup if that exists, as such we
296|			// move the DB to a different filename and try to load from backup. If that fails,
297|			// a new empty DB is being created automatically.
298|			//
299|			// The final fallback is to use an in-memory DB which should only happen if the target
300|			// folder is really not writeable for us.
301|			//
302|			try {
303|				await fs.promises.unlink(path);
304|				try {
305|					await Promises.rename(this.toBackupPath(path), path, false /* no retry */);
306|				} catch {
307|					// ignore
308|				}
309|
310|				return await this.doConnect(path);
```
- 为什么是问题：注释写的是把打不开的库改名留档，代码却 `unlink`。错误只要不是可重试的 `SQLITE_BUSY`（或忙重试一次后仍失败）就会走进这里，包括短暂的 IO 或权限错误。备份 `rename` 抛错（备份不存在、文件忙、跨设备）被空 `catch` 吃掉，接着 `doConnect` 在原路径新建空库并正常返回，内存库兜底不会发生。此时连接没有被标成错误，下一次正常关闭会走第 200–205 行的 `backup()`，用 `Promises.copy`（第 244–247 行）把这个新库覆盖仍留在磁盘上的 `.backup`。
- 方向：先把原库改名留档，备份恢复失败就不要在原路径创建空库，也不要在随后的关闭时覆盖 `.backup`。

## r01-4 高
- 症状：会话中出现过 SQLite 错误后，关闭时先删除库文件，再尝试按内存缓存重建；重建失败时原文件已经不在，且这次关闭不会更新备份。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 200–235 行
- 引用：
```
200|				if (!connection.isErroneous && !connection.isInMemory) {
201|					return this.backup().then(resolve, error => {
202|						this.logger.error(`[storage ${this.name}] backup(): ${error}`);
203|
204|						return resolve(); // ignore failing backup
205|					});
206|				}
207|
208|				// Recovery: if we detected errors while using the DB or we are using
209|				// an inmemory DB (as a fallback to not being able to open the DB initially)
210|				// and we have a recovery function provided, we recreate the DB with this
211|				// data to recover all known data without loss if possible.
212|				if (typeof recovery === 'function') {
213|
214|					// Delete the existing DB. If the path does not exist or fails to
215|					// be deleted, we do not try to recover anymore because we assume
216|					// that the path is no longer writeable for us.
217|					return fs.promises.unlink(this.path).then(() => {
218|
219|						// Re-open the DB fresh
220|						return this.doConnect(this.path).then(recoveryConnection => {
221|							const closeRecoveryConnection = () => {
222|								return this.doClose(recoveryConnection, undefined /* do not attempt to recover again */);
223|							};
224|
225|							// Store items
226|							return this.doUpdateItems(recoveryConnection, { insert: recovery() }).then(() => closeRecoveryConnection(), error => {
227|
228|								// In case of an error updating items, still ensure to close the connection
229|								// to prevent SQLITE_BUSY errors when the connection is reestablished
230|								closeRecoveryConnection();
231|
232|								return Promise.reject(error);
233|							});
234|						});
235|					}).then(resolve, reject);
```
- 为什么是问题：任一语句错误都会把连接标成 `isErroneous`，关闭时因此跳过备份，并先 `unlink` 仍可能含有此前已提交数据的文件。`doConnect` 会先建出带空表的新文件；若随后 `doUpdateItems` 失败（例如磁盘满，这往往也是当初出错的原因），新文件留在原路径。下次打开这个新文件会成功，不会再去读 `.backup`。
- 方向：先把缓存写到临时库并确认成功，再替换原文件；失败时保留原文件和已有备份。

## r01-5 高
- 症状：迁移读取命中回退库时，回退库里的键在主库写入完成之前就被删掉；主库已关闭时删除仍会发生，主库却不会写入。
- 位置：`src/vs/base/parts/storage/common/storage.ts` 第 471–478 行
- 引用：
```
471|			this.migratedKeys.add(key);
472|			const value = this.fallbackStorage?.items.get(key);
473|			if (!isUndefined(value)) {
474|				this.set(key, value).catch(onUnexpectedError).catch(onUnexpectedError);
475|				if (!this.isFallbackStorageReadonly) {
476|					this.fallbackStorage?.delete(key);
477|				}
478|				this.persistMigratedKeys();
```
- 为什么是问题：`set` 的 Promise 只挂了错误日志，同一轮就调用回退库的 `delete`。两边各自延迟刷盘。主库 `updateItems` 失败或进程在主库刷盘前退出，而回退库的删除已经落盘时，这个键两边都没有。主库若已进入 `Closed`（`doClose` 第 343 行先改状态），`set` 在第 266–267 行直接 return，不写入；回退库的 `delete` 不受这个状态影响，仍会删掉唯一副本。
- 方向：等主库这次写入成功后再删回退库；主库已关闭时不要改回退库。
