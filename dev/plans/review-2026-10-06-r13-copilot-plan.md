---
title: "方案 r13：copilot"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 0，weaken 2。"
---

hold 3，drop 0，weaken 2。

# 方案

五条都对过引用位置。r13-1、r13-2、r13-5 按读到的行号 hold。r13-3、r13-4 只部分成立，降为低。没有 drop。不占决策记录编号。

## r13-1

- 问题类：组织内容排除规则带 `g` 或 `y` 时，按仓库缓存的同一个 `RegExp` 在 `test` 里推进 `lastIndex`，下一次匹配从中间开始，本应排除的文件会被放行。
- 不变量：`isIgnored` 对 `ifAnyMatch` 和 `ifNoneMatch` 的每一次 `test` 都从下标 0 开始。`stringToRegex` 仍按服务端标志编译：`g` 在 `lastIndex === 0` 时可以在正文任意位置命中；`y` 在 `lastIndex === 0` 时只命中下标 0。判定缓存的键是规则范围加内容哈希（第 249–250 行），同一哈希第二次调用直接返回缓存，不再 `test`。因此锁住 `lastIndex` 的是两份不同正文：标记都只出现在开头，哈希不同，第二次才会真的 `test`。错误的放行一旦写入 `_ignoreRegexResultCache`，同代规则下会一直放行。`ifAnyMatch` 命中仍返回排除，`ifNoneMatch` 一个都没命中仍返回排除。
- 要动的符号或文件：`extensions/copilot/src/platform/ignore/node/remoteContentExclusion.ts` 第 259 行 `ifAnyMatch.some` 和第 264 行 `ifNoneMatch.some`。在 `pattern.test` 之前执行 `pattern.lastIndex = 0`。清零盖住已经放在 `_contentExclusionCache` 里的对象，不必等 `toRegexes`（第 557–561 行）重编。
- 明确不改什么：`stringToRegex`（第 634–645 行）的标志解析。去掉 `y` 会让 `/CONFIDENTIAL/y` 在前 1024 字节（第 223 行）的任意位置命中，那是另一条规则。`_ignoreRegexResultCache` 的键和 generation 判断（第 248–255、261、276–277 行）。glob 匹配、读文件失败则排除（第 243–245 行）、负判定的备忘条件（第 271–278 行）。`ifNoneMatch` 的布尔含义。
- 怎样本地验证：`extensions/copilot/src/platform/ignore/node/test/remoteContentExclusion.spec.ts` 已有 `excludes a file whose contents match ifAnyMatch` 和 `excludes a file that lacks a required ifNoneMatch marker`，这两条必须仍通过。在同一 `content based rules` 里新增断言。`ifAnyMatch` 为 `/CONFIDENTIAL/g`，以及另一次为 `/CONFIDENTIAL/y`：两个文件正文不同，标记都只在开头各出现一次（例如 `CONFIDENTIAL\nA` 与 `CONFIDENTIAL\nB`），两次 `isIgnored` 都为真。同一文件、同一正文再调用一次仍为真（走判定缓存）。正文 `xxCONFIDENTIAL`：`/CONFIDENTIAL/y` 时 `isIgnored` 为假，`/CONFIDENTIAL/g` 时为真。`ifNoneMatch` 为 `/PUBLIC/g`：两个正文不同、标记都只在开头的文件，`isIgnored` 都为假。同一正文连续两次不能当作 `lastIndex` 的证明：第 252–255 行缓存命中后不会再 `test`。命令在 `extensions/copilot`：`npm run test:unit -- src/platform/ignore/node/test/remoteContentExclusion.spec.ts`。

## r13-2

- 问题类：本地文件流里，二进制判断用的是尚未推入当前 chunk 的 `chunks`；首块已超过 1024 字节时样本是空缓冲，短于 1024 字节的文件则整段不做判断，非黑名单扩展名的二进制会进工作区索引。
- 不变量：`readLocalTextFileUsingReadStream` 在判定时，样本包含已经到达的字节，含触发判定的那一块。累计达到 1024 字节时做一次 `isBinaryFileSync`；流在达到 1024 之前结束时，对已读到的缓冲再做一次。判定为二进制则 resolve `'binary'`，并且只 resolve 一次，之后的 `end` 不得再交回这块缓冲。已经查过并且不是二进制时，`end` 仍 resolve `Buffer.concat(chunks)`，与现在第 1016 行一样。`isbinaryfile` 5.0.4 对 0 字节返回 false（`extensions/copilot/node_modules/isbinaryfile/lib/index.js` 第 141–142 行），空样本不能当成“已检查且不是二进制”。`readTextFile` 看到 `'binary'` 仍返回 `undefined`，`FsFileRepresentation.getText` 仍得到 `''`。
- 要动的符号或文件：`extensions/copilot/src/platform/workspaceChunkSearch/node/workspaceFileIndex.ts` 的 `readLocalTextFileUsingReadStream`（第 990–1018 行）。在 `data` 回调里先 `chunks.push`，再在 `totalBytesRead >= 1024` 且尚未检查时用 `Buffer.concat(chunks)` 调用 `isBinaryFileSync`；是二进制就 `stream.close()` 并 resolve `'binary'`。`end`：若还没检查且拼好的缓冲是二进制，resolve `'binary'`；否则 resolve 拼好的缓冲。用一个已完成标志挡住第二次 resolve。把该函数改为 `export`，供下面的测试直接调用；`readTextFile` 第 964 行的调用方式不变。
- 明确不改什么：`EXCLUDE_EXTENSIONS` 与 `shouldAlwaysIgnoreFile`（第 42–239 行）。非 `file` scheme 或 `stat` 失败时走第 976–978 行、对整段 `fileSystem.readFile` 结果做 `isBinaryFile` 的那条路径。`isMinifiedText`、`maxIndexableFileSize`、`getText` 里的 `TextDecoder`（第 336–337 行）。
- 怎样本地验证：没有覆盖这条读路径的 spec。新增 `*.spec.ts`，放在已有规格目录 `extensions/copilot/src/platform/workspaceChunkSearch/test/node/`（同目录有 `isMinified.spec.ts`）。`vite.config.ts` 的 `test.include` 含 `**/*.spec.ts`。直接调用导出的 `readLocalTextFileUsingReadStream`，不要拼 `WorkspaceFileIndex`：`tryRead`（第 577–589 行）还要 `IFileSystemService.stat` 与 `IInstantiationService`，而这条流只认磁盘上的 `fsPath`。临时文件用非 `EXCLUDE_EXTENSIONS` 的扩展名（例如 `.txt`）：含 NUL 且长度 ≥ 1024、含 NUL 且长度 < 1024、一段可打印字符且长度 ≥ 1024。两个二进制断言结果为 `'binary'`。长纯文本断言结果是 `Buffer` 且内容等于写入的字节；短于 1024 的纯文本只能走到「还没检查」的 `end`，锁不住「已经查过且不是二进制」这条。`getText` 对 `'binary'` 得到 `''` 是第 332–333 行已有行为，不在这个新测试里再造索引。命令在 `extensions/copilot`：`npm run test:unit -- src/platform/workspaceChunkSearch/test/node/<新文件>.spec.ts`。

## r13-3

- 问题类：`EmbeddingsCache.updateCache` 在 `writeFile` 成功之前就把缓存版本写入 memento，写失败只打日志。
- 降级：中 → 低。发现稿说写失败后下次 `getCache` 会把旧文件当成当前版本。反证：`updateCache` 仅有的调用是 `RemoteEmbeddingsCache.getCache` 第 327–329 行和 `RemoteEmbeddingsExtensionCache.getCache` 第 450–451 行，都先 `clearCache()`。`clearCache` 第 151 行删除 `${cacheKey}.json`。删除成功再写失败时，磁盘上没有旧文件，`getCache` 第 133–134 行在 `readJSON` 抛错后返回 `undefined`，不会交回上一份正文。`cacheVersion` 是构造参数里的稳定字符串（第 67 行），不是每次写入的代际。仍成立的部分：第 104 行先 `update(cacheVersionKey, cacheVersion)`，第 108–111 行吞掉 `writeFile` 的错误。`clearCache` 第 152–155 行会吞掉非 `ENOENT` 的删除错误，文件可以留下。此时版本键已经是当前值，`getCache` 第 119–125 行会 `readJSON` 并返回旧正文。`RemoteEmbeddingsCache.getCache` 第 328 行还在 `updateCache` 之前写下 `remoteCacheVersionKey`；第 318–319 行在本地缓存非空且该键已是最新时直接返回，不再拉取。
- 不变量：`writeFile` 抛错时 `updateCache` 拒绝，并且不把 `cacheVersionKey` 更新成当前版本。`RemoteEmbeddingsCache.getCache` 只在这次 `updateCache` 兑现之后才写 `remoteCacheVersionKey`。因此写失败时该键保持调用前的值；文件还在、`cacheVersionKey` 已经等于当前 `cacheVersion` 时，下一次 `getCache` 仍看到远程版本键不是最新，不得走第 318–319 行把旧 JSON 当最新缓存返回。`clearCache` 已删掉文件且随后 `writeFile` 失败时，本地 `getCache` 仍返回 `undefined`。`updateCache` 在没有 `cacheStorageUri`、`value === undefined` 或文件系统不可写时的提前返回（第 87–93 行）保持兑现、不写版本键。
- 要动的符号或文件：`EmbeddingsCache.updateCache`（`extensions/copilot/src/platform/embeddings/common/embeddingsIndex.ts` 第 103–112 行）：先 `writeFile`，成功后再 `cacheVersionMementoStorage.update(this.cacheVersionKey, this.cacheVersion)`。`catch` 里保留失败日志，然后把该错误重新抛出。现在的 `updateCache` 失败也兑现（第 108–111 行），只把第 328 行挪到 `await updateCache` 后面盖不住：`await` 仍会成功，`remoteCacheVersionKey` 还是会被写成最新。`RemoteEmbeddingsCache.getCache` 第 328 行对 `remoteCacheVersionKey` 的 `update` 移到 `updateCache` 兑现之后。`RemoteEmbeddingsExtensionCache.getCache` 第 451 行不用包一层 `catch`：`updateCache` 拒绝时整个 `getCache` 拒绝，不要落到第 454 行返回尚未落盘的结果。
- 明确不改什么：`clearCache` 的删除与它对 `cacheKey`（不是 `cacheVersionKey`）的清理（第 143–156 行）。远程拉取失败时回退到已有本地缓存（第 322–324 行）。`LocalEmbeddingsCache.getCache` 在缓存为 `undefined` 时抛错（第 204–208 行）。`nClosestValues`。`extensions/copilot/src/platform/test/node/testWorkbenchService.ts` 里另一套缓存的同类顺序。
- 怎样本地验证：没有 `embeddingsIndex` 的 spec。`EmbeddingsCache` 未导出。新增 `*.spec.ts`，驱动 `RemoteEmbeddingsCache.getCache`。构造函数需要 `IFetcherService` 和 `IInstantiationService`（第 235–236 行）；`EmbeddingsCache` 再要 `IFileSystemService` 和 `IVSCodeExtensionContext` 的 memento。桩 `fetch`：`callSite` 为 `embeddings-remote-cache-latest` 时返回一份新的 latest 文本，`embeddings-remote-cache` 时返回新的 JSON 正文。预先写入旧 JSON。`cacheVersionKey` 已经等于当前 `cacheVersion`，`remoteCacheVersionKey` 还是旧 latest。`delete` 抛一个 `code` 不是 `ENOENT` 的错误（`clearCache` 会吞掉，文件留下），`writeFile` 抛错。第一次 `getCache` 拒绝，`remoteCacheVersionKey` 仍是旧 latest。同样的桩再调用一次：仍然拒绝，结果不是那份旧 JSON。若实现提前写了远程版本键，第二次会在第 318–319 行直接返回旧 JSON，这条断言会失败。另一断言：`delete` 成功删掉文件且 `writeFile` 抛错时，`getCache` 拒绝，本地再读为 `undefined`。命令在 `extensions/copilot`：`npm run test:unit -- src/platform/embeddings/test/node/<新文件>.spec.ts`。

## r13-4

- 问题类：`GitServiceImpl.rebase` 在仓库没打开或变基抛错时仍正常结束。
- 降级：中 → 低。第 318–326 行是 `await repository?.rebase(branch)`，外层 `catch` 只调用 `logService.error`，不向外抛。`extensions/git/src/git.ts` 第 2504–2518 行的 `rebase` 在冲突等失败时 `throw err`。反证：`IGitService`（`extensions/copilot/src/platform/git/common/gitService.ts` 第 44–88 行）没有 `rebase`。仓库里没有对 `GitServiceImpl.rebase` 的调用，因此不存在调用方接着提交、从而落在未变基分支上的路径。方法本身仍把缺仓库和变基失败都变成成功的 Promise。
- 不变量：`repository` 缺失，或 `repository.rebase` 拒绝时，`GitServiceImpl.rebase` 拒绝，调用方能用 `await` 的拒绝区分失败。缺仓库时抛出的错误说明这个 `uri` 没有打开的仓库。变基失败时把 `repository.rebase` 的拒绝原因向外传递。失败仍然写一条 `logService.error`。
- 要动的符号或文件：`GitServiceImpl.rebase`（`extensions/copilot/src/platform/git/vscode-node/gitServiceImpl.ts` 第 318–326 行）。去掉 `repository?.rebase` 的可选调用：没有 `repository` 就抛错。`catch` 在记日志之后把错误再抛出。日志用 `error instanceof Error ? error.message : String(error)`。第 324 行的 `error.message` 只在抛出值是 `null` 或 `undefined` 时会再抛出 `TypeError`；字符串的 `.message` 是 `undefined`，不会另抛。`instanceof` 是为了 `null` / `undefined`。
- 明确不改什么：不把 `rebase` 加进 `IGitService`，也不新增调用方。`commit`（第 302–309 行）、`applyPatch`（第 312–316 行）、`isBranchProtected`、`generateRandomBranchName` 的错误处理。`extensions/git` 的 `Repository.rebase`。`mockGitService.rebase`。
- 怎样本地验证：`extensions/copilot/src/platform/git/test/node/gitService.spec.ts` 有 `parseRemoteUrl`、`GithubRepoId`、`toGithubWebUrl`、`getAdoRepoIdFromFetchUrl` 等 suite，没有 rebase 用例。没有可沿用的测试名。新增 `*.spec.ts`。`GitServiceImpl` 的构造函数只接收 `IGitExtensionService` 和 `ILogService`（第 51–54 行）。桩的 `getExtensionApi()` 若返回空，还要有 `onDidChange`，否则走第 65 行。若返回 API，桩上要有 `repositories: []`、`onDidOpenRepository`、`onDidCloseRepository`、`onDidChangeState`，否则第 81–91 行在构造时就会碰到这些字段。一种桩让 `getRepository` 返回 `undefined`，断言 `rebase` 拒绝。另一种让 `repository.rebase` 拒绝，断言向外的是同一个错误。命令在 `extensions/copilot`：`npm run test:unit -- src/platform/git/test/node/<新文件>.spec.ts`。

## r13-5

- 问题类：`indexWorkspaceArtifact` 在内容为空白时直接返回，`search_index` 里同一 `source_id` 的旧行还在，全文搜索仍能命中已清空的工件。
- 不变量：`content.trim()` 为空（空串或只有空白）时，删除 `source_id` 为 `${sessionId}:workspace:${filePath}` 的 `search_index` 行，并且不插入新行。非空内容仍是先按该 `source_id` 删除再插入，`search` 能命中新正文，命不中旧正文。注释里“后续写入替换同一文件的索引项”（第 442 行）对空白写入同样成立。
- 要动的符号或文件：`SessionStore.indexWorkspaceArtifact`（`extensions/copilot/src/platform/chronicle/node/sessionStore.ts` 第 444–454 行）。先 `ensureDb`、算出 `sourceId`、执行已有的 `DELETE FROM search_index WHERE source_id = ?`，再在 `content.trim()` 为空时返回；非空才 `INSERT`。
- 明确不改什么：`insertTurn` 在拼接内容为空时跳过索引更新（第 337–345 行）。`insertCheckpoint` 对空段落 `continue`（第 391–392 行）。`deleteSession` 按 `session_id` 删除索引（第 464 行）。`search` 的 SQL（第 480–488 行）。
- 怎样本地验证：`extensions/copilot/src/platform/chronicle/node/test/sessionStore.spec.ts` 已有 `indexWorkspaceArtifact stores and searches content` 和 `indexWorkspaceArtifact replaces previous content for same path`，这两条必须仍通过。在同一文件新增断言：先索引一段含独特词的正文，再对同一 `sessionId` 和路径调用 `indexWorkspaceArtifact`，内容依次为 `''` 和 `'   '`。两次之后 `search` 该独特词的结果长度为 0。替换用例仍只命中新正文。命令在 `extensions/copilot`：`npm run test:unit -- src/platform/chronicle/node/test/sessionStore.spec.ts`。

## 审查

2026-10-06 只读审查后改稿。Critical：r13-3 的 `updateCache` 在写失败时必须拒绝，否则把 `remoteCacheVersionKey` 挪到 `await` 后面仍然会写成最新。Important：r13-3 的断言改成「文件留下、版本键已是当前值、写失败，第二次 `getCache` 不得返回旧 JSON」，并写上 `IFetcherService`。r13-1 只在 `test` 前把 `lastIndex` 置 0，不去掉 `y`。r13-2 的 `end` 在已经查过且不是二进制时仍 resolve 缓冲，纯文本样本长度 ≥ 1024。Minor：新测试目录改到 `workspaceChunkSearch/test/node/`；`gitService.spec.ts` 的范围改成现有 suite 名；`error.message` 只在 `null` / `undefined` 时再抛。均已写入正文。
