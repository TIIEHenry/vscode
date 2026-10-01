---
title: "方案 r01：base"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。五条均 hold：解压路径须落在目标内，尾点 rename 不得误删源，存储打开、关闭恢复和迁移须在写入确认前保留原数据。"
---

# 方案 r01：base

核查对照发现稿：hold 5，drop 0，weaken 0。只改下列行为。

## r01-1

- 问题类：ZIP 解压能在目标目录外创建目录或写入前缀兄弟路径。
- 不变量：`path.join` 规范化之后，目录条目和文件条目的最终路径都必须落在目标目录之内（目标本身或目标加分隔符的子孙）。目标为 `/tmp/out`（末尾无分隔符）时，`../../outside/` 不得变成 `/outside/`，`foo/../../out-evil/pwned.txt` 不得因为 `/tmp/out-evil` 以前缀命中 `startsWith` 而写到目标外。越界条目拒绝，不 `mkdir`、不 `createWriteStream`。
- 要动的符号或文件：`src/vs/base/node/zip.ts` 的 `extractEntry`（约第 75–81 行）和 `extractZip` 里目录条目分支（约第 150–153 行）。抽一个本地判断，两处共用。判断使用已有的 `isEqualOrParent`（`src/vs/base/common/extpath.ts`）：子路径在前，目标目录在后；两边都先走 `path.normalize`。不要再用 `startsWith(targetPath)`。
- 明确不改什么：不改 `zip()`、`validateZip`、`modeFromEntry`、`overwrite`。不改 yazl。合法条目（目标内的 `foo/bar.txt`、以 `/` 结尾且仍在目标内的目录）照常解压。
- 本地验证：`scripts/test.sh --run src/vs/base/test/node/zip/zip.test.ts`。现有 `extract should handle directories`、`validateZip enforces entry and expanded-size limits` 保持通过。不要用 `extract` 验收 `..` 条目：`openZip` 只传 `{ lazyEntries: true }`，yauzl 默认 `decodeStrings: true`，`validateFileName` 在 `entry` 事件之前拒绝路径分段含 `..` 的名字，这些压缩包今天调用 `extract` 就会拒绝，锁不住 `startsWith`。验收改为直接调用抽出来的判断（名字尚未经过 yauzl）：目标 `/tmp/out` 无末尾分隔符时，`foo/../../out-evil/pwned.txt` 与 `../../outside/` 被拒绝，调用方不 `mkdir`、不 `createWriteStream`；`foo/bar.txt` 与目标内以 `/` 结尾的目录通过。含 `..` 分段的名字穿不过 `validateFileName`，到不了这两处；判断仍接在 `extractEntry` 和目录分支上。本条是防御性收紧。

## r01-2

- 问题类：源路径以 `.` 结尾时，`rename` 的任意失败都会拷贝进已有目录再删源。
- 不变量：`rename` 的 catch 里，只有跨设备（`source.toLowerCase() !== target.toLowerCase()` 且 `error.code === 'EXDEV'`：忽略大小写之后仍不是同一条路径），或源的最后一分量确实是无法按原名移动的尾点名时，才 `copy` 然后 `rimraf`。`basename` 为 `.` 或 `..`（含 `/tmp/foo/..` 这种 `endsWith('.')`）一律原样抛出，不 `copy`、不 `rimraf`。目标已是目录（`ENOTEMPTY`、`EEXIST`、`EISDIR`、`ENOTDIR`，或 `EPERM` 且目标是目录）时原样抛出，不把源合并进目标。尾点名若错误码是上述目录类，或是 `EBUSY` / `EACCES`，也原样抛出，不 `copy`（重试仍只属于 `renameWithRetry`，本函数不改它）。`copy` 抛错时不得执行 `rimraf`。新增断言只覆盖必须抛出的目录合并，不覆盖「应当 copy」的正向支。
- 要动的符号或文件：`src/vs/base/node/pfs.ts` 的 `rename`（约第 519 行）。`&&` / `||` 拆开写，禁止 `endsWith('.')` 单独成立。尾点名用已导入的 `basename`。目标是否为目录沿用同文件的 `SymlinkSupport.stat`。`rimraf` 仍只在 `copy` 成功之后调用。
- 明确不改什么：不改 `rimraf` 对根路径和盘符的拒绝（`isRootOrDriveLetter`）。不改 `EXDEV` 的跨设备 `copy` 后 `rimraf`。不改 `renameWithRetry` 对 `EACCES` / `EPERM` / `EBUSY` 的重试。不改 `doCopyDirectory` 的合并语义。
- 本地验证：`scripts/test.sh --run src/vs/base/test/node/pfs/pfs.test.ts`。现有 `copy, rename and delete`、`rename without retry` 保持通过。在能保留尾点目录名的平台（Linux）新增断言：源目录名以 `.` 结尾，目标是已有非空目录，`Promises.rename` 抛出原来的错误；源目录仍在，源的内容没有被并入目标目录。不要用真实的 `..` 去触发 `rimraf`。

## r01-3

- 问题类：数据库打开失败时先删原文件，备份恢复失败仍在原路径建成空库并在关闭时覆盖 `.backup`。
- 不变量：打开失败且不是可重试的 `SQLITE_BUSY` 时，先把原文件改名留档，不 `unlink`。只有 `Promises.rename(toBackupPath(path), path)` 成功后才 `doConnect(path)`。备份改名抛错时不在原路径 `doConnect`（避免新建空库并当成成功连接返回），改为现有的内存库兜底。损坏的 `.backup` 仍能改名成功，不能把改名成功当成库可打开：随后 `doConnect(path)` 失败时，把已改到原路径的那份文件改回 `.backup`，原路径不留新文件，再进内存库。留档名用类内私有后缀，不得与 `toBackupPath` 的 `.backup` 相同，也不得与 r01-4 的临时库后缀相同。相同则恢复时 `doConnect` 会改掉留档再删掉它。这次失败不得留下「非错误、非内存」的磁盘连接，因此随后 `close` 不得走 `backup()` 用 `Promises.copy` 覆盖 `.backup`。留档和 `.backup` 的字节保持打开前的内容。内存兜底若再进入 `doClose` 的恢复分支，不得在恢复写入确认前删除留档，也不得用空缓存覆盖 `.backup`（与 r01-4：空 `recovery()` 不得覆盖已有 `.backup`）。
- 要动的符号或文件：`src/vs/base/parts/storage/node/storage.ts` 的 `SQLiteStorageDatabase.connect`（约第 302–310 行）及其调用的 `doConnect`、`toBackupPath`、`backup`。旁路文件名留在这个类的私有路径上，不新增导出。
- 明确不改什么：不改 `SQLITE_BUSY` 等待 `BUSY_OPEN_TIMEOUT` 后只重试一次。不改目录不可写时的内存库兜底。不改备份改名成功后的恢复（现有 `basics (corrupt DB restores from previous backup)`）。不改健康连接的 `backup()`。`Promises.rename` 对 `EXDEV` 会在内部 `copy` 后 `rimraf` 备份源，空 `catch` 收不到跨设备错误；不要把跨设备当成这个空 `catch` 的触发条件。空 `catch` 实际吞掉的是改名抛出的错误（备份不存在、文件忙）。
- 本地验证：`scripts/test.sh --run src/vs/base/parts/storage/test/node/storage.integrationTest.ts`。`basics (corrupt DB restores from previous backup)` 保持通过。改写 `basics (corrupt DB falls back to empty DB)` 和 `basics (corrupt DB falls back to empty DB if backup is corrupt)`：二者今天把「原路径上的空库且 `recoveryCalled === false`」锁成成功。新断言比较打开前写入的两段损坏字节：一份在留档，一份仍在 `.backup`。无可用备份时不在原路径留下会被 `close` 当成健康库的空库。这两条不要再走 `testDBBasics` 的空 `recovery`（空 `Map` 且 `recoveryCalled === false`）。空 `recovery` 单独断言已有 `.backup` 字节不变。非空 `recovery` 的关闭恢复仍允许在替换成功后重建 `.backup`（见 r01-4）。

## r01-4

- 问题类：连接已标成错误时，关闭先 `unlink` 原库再按缓存重建，重建失败则原文件和这次备份都没了。
- 不变量：`isErroneous` 或内存兜底且调用方传入 `recovery` 时，先把 `recovery()` 写入临时库并 `doUpdateItems` 成功。临时连接只关闭 sqlite 句柄，不进入 `doClose`：`doClose(recoveryConnection, undefined)` 在连接健康且路径不是 `IN_MEMORY_PATH` 时会 `backup()`，拷贝的是替换前的 `this.path`。句柄关闭成功后再把临时库替换到 `this.path`。临时路径用类内私有后缀，不得与 `.backup` 相同，也不得与 r01-3 的留档后缀相同。替换前失败（含 `recovery()` 抛错和句柄关闭失败）则删掉临时库，原文件与已有 `.backup` 保持关闭前的字节，并 reject。不得在写入确认前 `unlink(this.path)`。本分支不调用 `backup()` 去覆盖 `.backup`，除非替换已经成功、新连接是健康磁盘库，且 `recovery()` 非空或关闭前 `.backup` 不存在。`recovery()` 为空时不得 `copy` 到已有 `.backup`。这与 r01-3 是同一次 `close`：内存兜底且调用方传入空 `recovery` 时，不得用空库覆盖已有 `.backup`。
- 要动的符号或文件：`src/vs/base/parts/storage/node/storage.ts` 的 `SQLiteStorageDatabase.doClose` 恢复分支（约第 212–235 行），以及它调用的 `doConnect`、`doUpdateItems`。临时路径用类内私有名，不新增导出。
- 明确不改什么：不改「非错误且非内存」时先 `backup()` 并忽略备份失败（约第 200–205 行）。不改没有 `recovery` 时只 reject、不删文件（约第 239 行）。不改 `this.path === IN_MEMORY_PATH` 的提前返回。不改 `handleSQLiteError` 把 `exec` / `get` / `all` / `transaction` / `prepare` 的失败标成 `isErroneous`。运行期损坏但缓存仍在时，成功恢复后原路径应重新含有缓存内容（现有关闭恢复测试）。
- 本地验证：同一条 `scripts/test.sh --run src/vs/base/parts/storage/test/node/storage.integrationTest.ts`。`basics (DB that becomes corrupt during runtime stores all state from cache on close)` 保持通过。新增断言：`recovery()` 在替换前抛错时，`storage.db` 与 `.backup` 的字节与关闭前一致，原路径不是只含空 `ItemTable` 的新文件。测试只调用公开的 `close(recovery)`；`doUpdateItems` 是私有方法，不能把「注入它失败」写成验收。今天的实现会先 `unlink(this.path)`，这条断言在 HEAD 上失败。再断言替换完成前 `.backup` 字节与关闭前一致；替换成功且 `recovery()` 非空后，原路径含有 `recovery()` 的内容，且 `.backup` 与这份新库一致。

## r01-5

- 问题类：迁移命中回退库时，主库写入尚未成功就删除回退键；主库已关闭时主库不写，回退键仍被删。
- 不变量：`MigratingStorage.get` 只有在主库 `state !== Closed` 且这次 `set` 真正进入待写（不是 `Storage.set` 在 `Closed` 时的直接 return）并成功之后，才调用回退库 `delete`，并 `persistMigratedKeys`。`set` 拒绝或主库已 `Closed` 时，回退键保持原值，该键不得出现在已迁移集合里。只读回退（`isFallbackStorageReadonly`）继续不删。
- 要动的符号或文件：`src/vs/base/parts/storage/common/storage.ts` 的 `MigratingStorage.get`（约第 471–478 行）和 `persistMigratedKeys`。`Storage.set` 在 `Closed` 时的早退（约第 266–267 行）与 `doClose` 先把 `state` 设为 `Closed`（约第 343 行）保持不动。`state` 现为 `private`（约第 123 行），`MigratingStorage` 读不到。把它改成 `protected`，或增加等价只读方法，列入要动符号；早退仍是 `return`。不能 `await this.set` 再 `delete`：`Closed` 时 `set` 的 Promise 仍会完成，回退键会被删掉。`set` 与回退 `delete` 各走自己的 `flushDelayer`（`DEFAULT_FLUSH_DELAY` 100ms），不得再在同一轮里无等待地 `delete`。
- 明确不改什么：不改 `INTERNAL_KEY_PREFIX` 不迁移。不改只读回退。不改「已迁移的键不再从回退复活」这个结果，只改它的提交时机。不改 `Storage.delete` 的 `Closed` 早退。不改默认刷盘延迟。
- 本地验证：新增 `src/vs/base/parts/storage/test/common/migratingStorage.test.ts`（现无 `MigratingStorage` 测试），用可推迟 `updateItems` 的 `IStorageDatabase` 装两个 `Storage`，再 `setFallbackStorage`。`scripts/test.sh --run src/vs/base/parts/storage/test/common/migratingStorage.test.ts`。断言：主库 `updateItems` 未完成时回退键还在；主库成功后回退键删除且主键在主库；主库 `updateItems` 拒绝时回退键仍在且已迁移标记不含该键；主库 `close` 已把状态设为 `Closed` 之后再 `get`，回退键仍在。

## 审查

2026-09-30 只读审查后改稿。Critical：r01-1 的 `extract` 断言会被 yauzl 提前拒绝，改为直接测路径判断；r01-4 的临时连接不进入 `doClose`，避免替换前 `backup()`。Important：损坏备份改名成功但打不开时改回 `.backup`；空 `recovery()` 不得覆盖已有 `.backup`；`Storage.state` 对 `MigratingStorage` 可见。Minor：尾点名碰上 `EBUSY` / `EACCES` 原样抛出；留档和临时库后缀不与 `.backup` 相撞。均已写入正文。

2026-09-30 第二轮。无 Critical。Important：EXDEV 条件改回 `source.toLowerCase() !== target.toLowerCase()`；留档后缀与临时库后缀互相不同；替换前失败改为 `recovery()` 抛错。Minor：含 `..` 的名字穿不过 `validateFileName`；断言改成源的内容没有被并入目标。均已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
