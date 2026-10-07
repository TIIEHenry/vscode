---
title: "方案 r01：base"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 1，weaken 1。关闭恢复、刷盘等待和 sourcePath 前缀要改；覆盖解压降为低；OAuth 根回退经只读审查改回 drop（MCP 规范要求按路径、根的顺序回退）。"
---

hold 3，drop 1，weaken 1。只读审查后改稿，见文末「审查」。

## r01-1

- 问题类：Windows 上关闭恢复先删主库再改名，失败时连已写好的 `.recovery-temp` 一起删掉。
- 不变量：`doUpdateItems` 成功且临时连接句柄已关闭之后，才把临时库换到 `this.path`。换上去之前不得 `unlink(this.path)`。主库已存在时，先把它改到旁路名，再把临时库改到 `this.path`，只有这一步成功后才删旁路。任一步失败：主路径上的字节与替换开始前一致（原来没有文件就仍然没有），已关闭句柄的临时库留在 `.recovery-temp`。`unlink` 的 `ENOENT` 不得落到删除临时库的分支。句柄尚未关闭就失败时，可以删未完成的临时库。这段换库顺序不分平台：POSIX 上同样先改旁路再改名，不保留 `isWindows` 分支，Linux 单测才走得到同一段代码。第二步失败后把旁路改回主路径；改回也失败时只记日志，旁路和临时库都不删。
- 要动的符号或文件：`SQLiteStorageDatabase.recoverDatabaseOnClose`（`src/vs/base/parts/storage/node/storage.ts` 第 249–283 行）。替换发生在第 273–276 行（`isWindows` 时 `fs.promises.unlink(this.path)`，随后 `Promises.rename(tempPath, this.path, false)`），失败删临时库在第 277–281 行的 `deleteTemp()`。旁路名用类内私有后缀，不得与 `.backup`、`.corrupt`、`.recovery-temp` 相同。
- 明确不改什么：不改非错误且非内存时的 `backup()`（第 203–208 行）。不改没有 `recovery` 时只 reject（第 219–220 行）。不改 `connect` 的 `SQLITE_BUSY` 重试，以及失败后只改名 `.corrupt` 和 `.backup` 的顺序（第 329–366 行）；下次打开仍然不读 `.recovery-temp`。不改替换成功后按 `recoveryItems.size > 0 || !backupExistedBeforeClose` 调用的 `backup()`（第 285–291 行）。不改 `Promises.rename` 自身的 `EXDEV` 与尾点名分支。
- 怎样本地验证：`scripts/test.sh --run src/vs/base/parts/storage/test/node/storage.integrationTest.ts`。现有 `corrupt DB recovers` 保持通过。应新增的断言意图：临时库已写入并关闭句柄后，把主库换到主路径的那一步拒绝时，主库字节与替换前一致，`.recovery-temp` 仍能读出 `recovery()` 写入的项。今天 Linux 上的 `close()` 不进入第 273 行的 `unlink`，所以把第 273–276 行换成可注入失败的私有换库步骤，且按上面不分平台执行；断言注入「临时库改到主路径」失败后，主库字节不变、旁路已改回、`.recovery-temp` 仍在。主路径本来不存在时，不得因为 `ENOENT` 删掉临时库。

## r01-2（drop）

- 反证：根回退按 origin 比对是上游有意定下的合同，今天的行为与 MCP 授权规范一致。[MCP 2025-11-25 Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)「Protected Resource Metadata Discovery Requirements」写明：端点 `https://example.com/public/mcp` 的元数据可以放在路径版 well-known，也可以放在根 `https://example.com/.well-known/oauth-protected-resource`；响应头没有 `resource_metadata` 时，客户端 MUST 依次请求这两个 URI。根文档描述的是插入 well-known 的那个资源，即 origin（RFC 9728 §3.3），所以 `resource` 等于 origin 是合规结果。同一 origin 的根文档由该 origin 的运营方发布，不是「别人的」授权服务器。
- HEAD 锚点：根回退在 `src/vs/base/common/oauth.ts` 第 1274–1277 行，`fetchPrm(rootUrl, targetResourceUrlObj.origin)`。上游 `a1b2b6293a5`（Fix PRM fetching strategy，#282961）连同测试一起引入这一比对：`oauth.test.ts` 第 1430–1490 行两条 `should accept root URL in PRM resource when using root discovery fallback` 的注释写明 root discovery 的 `resource` 必须等于根 URL；第 1493–1529 行把完整路径 `resource` 锁成拒绝。
- 不做：原稿要求有路径的目标根回退一律失败，并改写上述五条测试的预期。照做会让只在根发布元数据的合规 MCP 服务器无法登录，违背规范的 MUST。发现稿的方向（根回退改按完整目标比对）同样会推翻第 1430–1490 行的合同，也不采纳。

## r01-3（weaken，高 → 低）

- 问题类：`overwrite` 解压先递归删掉目标，解压失败或取消后原内容回不来。
- 反证：本仓唯一传 `overwrite: true` 的生产调用是 `extractUserExtension`（`src/vs/platform/extensionManagement/node/extensionManagementService.ts` 第 622、649 行），目标是刚生成的 `.${generateUuid()}` 临时目录，里面没有可丢的原内容。缺陷只在 `extract` 的接口语义上成立，按接口加固处理。
- 不变量：`options.overwrite` 为真时，先把压缩包解到目标旁的临时目录，全部成功后再换成 `targetPath`。成功前不得 `Promises.rm(targetPath)`。换上去的顺序与 r01-1 相同：目标已存在则先改到旁路，临时目录改到 `targetPath` 成功后才删旁路；第二步失败则把旁路改回目标。解压失败、取消，或临时目录还没换上时，只删临时目录，目标上原有的文件或目录保持不动。目标本来不存在时，成功后临时目录成为 `targetPath`。
- 要动的符号或文件：`extract`（`src/vs/base/node/zip.ts` 第 330–339 行）。第 336 行 `Promises.rm(targetPath)` 是 `pfs.ts` 里默认 `RimRafMode.UNLINK` 的 `rimraf`，即 `fs.promises.rm(..., { recursive: true, force: true })`，并在 `extractZip` 之前完成。`overwrite` 为假时的原地 `extractZip` 调用保留。
- 明确不改什么：不改 `sourcePath` 正则（r01-5）。不改 `isZipEntryWithinTarget`、`zip()`、`validateZip`。不改 `Promises.rm` / `rimraf` 的默认递归语义。不改 `overwrite` 未设置时的解压目标。
- 怎样本地验证：`scripts/test.sh --run src/vs/base/test/node/zip/zip.test.ts`。现有 `extract should handle directories`、`isZipEntryWithinTarget keeps extracted paths inside the target directory` 保持通过。应新增的断言意图：目标目录里有一个标记文件；`overwrite: true` 且解压在条目阶段失败或 token 已取消时，标记文件仍在；同一次成功的 `overwrite: true` 之后，目标上是压缩包的内容，标记文件不在。

## r01-4

- 问题类：落盘失败后 `whenFlushed()` 仍成功，失败的那一批已从 pending 拿走，没有新编辑时不会再写。
- 不变量：`pendingInserts` / `pendingDeletes` 先换成空集合，使等待期间的新编辑进新集合；这份快照只在 `updateItems` 成功后丢弃。`updateItems` 拒绝时，把快照合并回当前 pending：同一键若已有更新的插入或删除，保留更新的；只在失败快照里的键放回去。拒绝时当前已注册的 `whenFlushed` 等待者全部 reject，不得在 `finally` 里 `pop()?.()`。`!hasPending` 时 resolve 等待者只发生在 `updateItems` 成功之后。失败分支不再调用 `flushPending`。
- 要动的符号或文件：`Storage.flushPending`（`src/vs/base/parts/storage/common/storage.ts` 第 364–385 行，清空在第 372–374 行，`finally` 在第 378–384 行）和 `whenFlushed`（第 406–411 行）。等待者现在只存 resolve，要同时能 reject。
- 下游：`whenFlushed()` 的生产调用方只有两处，都要先接住拒绝并记日志，保持今天 resolve 的行为。第一处是 `AbstractStorageService.flush` 的 `WillSaveStateReason.NONE` 分支（`src/vs/platform/storage/common/storage.ts` 第 628–633 行），`Promises.settled` 会在全部结束后重抛第一个错误。它有 8 处生产调用（`rg 'storageService\.flush\(\)'`）：`src/vs/workbench/browser/workbench.ts` 第 261 行、`src/vs/sessions/browser/workbench.ts` 第 728 行、`sharedProcessMain.ts` 第 294 行不等待结果，拒绝会变成未处理的 rejection；`extensionBisect.ts`、`workspaceStateSync.ts`、`userDataProfileStorageService.ts` 会等待，流程会中断。第二处是 `BrowserStorageService.clear`（`src/vs/workbench/services/storage/browser/storageService.ts` 第 266 行），不接住会跳过其后的清库。
- 明确不改什么：不改 `set` / `delete` 先写 `cache`。不改 `doClose` 先 `doFlush(0)`、忽略 flush 错误、再 `database.close(() => this.cache)`（第 340–357 行）。不改上面 8 个 `storageService.flush()` 调用方。不改 `flush` 在 `Closed` 或 `pendingClose` 时的早退。不改 `InMemoryStorageDatabase.updateItems`。不改 `ThrottledDelayer`。sqlite 事务失败仍由 `handleSQLiteError` 标 `isErroneous`。
- 怎样本地验证：`scripts/test.sh --run src/vs/base/parts/storage/test/node/storage.integrationTest.ts`。现有 `basics`、`explicit flush`、`close flushes data` 保持通过。应新增的断言意图：用 `updateItems` 第一次拒绝、第二次成功的 `IStorageDatabase` 包一个 `Storage`；`set` 之后 `whenFlushed()` 拒绝，`get` 仍是刚写入的值；没有新的 `set`/`delete` 时再次 `flush(0)` 会再次调用 `updateItems` 并带上同一键；第二次成功后 `whenFlushed()` 成功。`AbstractStorageService.flush()` 在同样的第一次拒绝下仍然 resolve。

## r01-5

- 问题类：`sourcePath` 被当成正则前缀，会解出前缀外的条目，目录项被剥成空串时还会去写目标路径本身。
- 不变量：`sourcePath` 按字面路径匹配，`.` 等正则元字符没有通配含义，并且只在路径边界上剥。边界是条目名结尾或 `/`（压缩包内用 `/`，不用 `path.sep`）。`foo.bar/` 不匹配 `fooXbar/`。`extension` 不匹配 `extension-extra/a.txt`，匹配 `extension/a.txt` 且剥完得到 `a.txt`，结果不得以 `/` 开头。`sourcePath` 已带尾部 `/` 时，模式就是这段字面量，不要再要求第二个 `/`。剥完为空的条目跳过：不 `createWriteStream(targetPath)`，也不把 `path.join(targetPath, '')` 当成要写的文件。其余条目仍走 `isZipEntryWithinTarget`。预期的可见变化：唯一的生产调用 `extractUserExtension` 传 `sourcePath: 'extension'`（`extensionManagementService.ts` 第 649 行），今天 VSIX 根上的 `extension.vsixmanifest` 会被剥成 `.vsixmanifest` 写进每个已装扩展目录；改完后不再写出。全仓 `rg -i vsixmanifest` 没有读取已装目录里这个文件的代码。
- 要动的符号或文件：`extract` 第 331 行 `new RegExp(options.sourcePath ? \`^${options.sourcePath}\` : '')`，以及 `extractZip` 第 155 行 `entry.fileName.replace(options.sourcePathRegex, '')`（`src/vs/base/node/zip.ts`）。空串发生在替换之后、第 157 行目录判断之前：`/\/$/.test('')` 为假，于是进入第 171 行的 `extractEntry`；`path.join(target, '')` 等于目标本身，`isZipEntryWithinTarget` 挡不住。
- 明确不改什么：不改未传 `sourcePath` 时匹配全部条目（空正则替换后名字不变）。不改 `isZipEntryWithinTarget` 的越界判断。不改 `overwrite` 的删除时机（r01-3）。不改 `zip()`、`validateZip`。
- 怎样本地验证：`scripts/test.sh --run src/vs/base/test/node/zip/zip.test.ts`。现有 `extract should handle directories`、`isZipEntryWithinTarget keeps extracted paths inside the target directory` 保持通过。应新增的断言意图：用 `zip()` 写入这些条目再 `extract`：`sourcePath` 为 `foo.bar/` 时不写出 `fooXbar/a.txt`；`sourcePath` 为 `extension` 时不写出 `extension-extra/a.txt` 和根上 `extension.vsixmanifest` 剥出的 `.vsixmanifest`，会把 `extension/a.txt` 写到目标下的 `a.txt`；`sourcePath` 为 `extension/` 且条目就是 `extension/` 时，目标路径本身不是被写出来的文件。

## 审查

2026-10-06 只读审查后改稿。本轮子代理不可用（套餐只允许 Auto），由另一会话直接对照 HEAD 审查，非本方案作者。Critical：r01-2 改回 drop，原稿让有路径的目标根回退一律失败，违背 MCP 2025-11-25 授权规范的回退 MUST，并推翻上游 `a1b2b6293a5` 锁定的测试。Important：r01-1 换库顺序不分平台，单测打新的换库步骤；r01-3 降为低，唯一生产调用的目标是新建临时目录；r01-4 写明 `whenFlushed()` 两个生产调用方接住拒绝；r01-5 写明 `extension.vsixmanifest` 不再解成 `.vsixmanifest`。Minor：r01-5 越界仍被 `isZipEntryWithinTarget` 挡住，严重度可再议，未改。均已写入正文。
