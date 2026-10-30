---
title: "审查 r01：base"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "Windows 上存储恢复会删掉库文件；OAuth 根元数据按 origin 放行；覆盖解压先删目录且失败不恢复。"
---
# 审查 r01：base

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r01-1 高
- 症状：关闭时走恢复，Windows 上主库和刚写好的恢复库会一起消失，这次会话写进存储的项丢失。
- 位置：`src/vs/base/parts/storage/node/storage.ts` 第 271–282 行
- 引用：`if (isWindows) { await fs.promises.unlink(this.path); } await Promises.rename(tempPath, this.path, false);` 失败后 `await deleteTemp()`
- 为什么是问题：恢复内容已经写入 `*.recovery-temp` 并关闭连接。Windows 上先删主库再 `rename`（且不重试）。`rename` 失败时主库已经不在；主库本来就不存在时 `unlink` 抛 `ENOENT`，同样进 `catch`。两条路径都会删掉 temp，下次打开只认主路径和 `.backup`，不认 `.recovery-temp`。
- 方向：确认替换成功后再丢旧库；失败时留下 temp，不要在 `unlink` 之后无条件删恢复文件。

## r01-2 高
- 症状：带路径的资源在路径级发现失败后，会接受一份「资源是整个 origin」的受保护资源元数据，从而改用别人的授权服务器。
- 位置：`src/vs/base/common/oauth.ts` 第 1239–1277 行
- 引用：`fetchPrm` 用 `new URL(body.resource)` 对比 `validateUrl`；根回退调用是 `fetchPrm(rootUrl, targetResourceUrlObj.origin)`
- 为什么是问题：路径追加的发现用完整 `targetResource` 比对，根回退却改成 origin。`https://host/tenant/mcp` 会接受 `resource` 为 `https://host/` 的文档（含其中的 `authorization_servers`），并拒绝根文档里资源标识正好是完整目标 URL 的合规结果。客户端会按错误的授权服务器去拿令牌。
- 方向：根回退仍用完整目标资源做 `resource` 比对，不一致就拒绝。

## r01-3 高
- 症状：`overwrite` 解压时目标目录先被删掉，解压失败或取消后原内容回不来。
- 位置：`src/vs/base/node/zip.ts` 第 335–339 行
- 引用：`promise.then(zipfile => Promises.rm(targetPath).then(() => zipfile))`，然后再 `extractZip`
- 为什么是问题：`Promises.rm` 默认是递归删除并等待完成。后面的 `extractZip` 没有把旧树挪走，失败、取消或写到一半都不会恢复。目标上原有的文件已经没了。
- 方向：先解到临时目录，成功后再替换目标；失败则保留原目录。

## r01-4 中
- 症状：落盘失败后 `whenFlushed()` 仍成功，这批插入/删除也不会再写。
- 位置：`src/vs/base/parts/storage/common/storage.ts` 第 370–384 行
- 引用：先把 `pendingInserts` / `pendingDeletes` 换成空集合，再 `updateItems(updateRequest).finally(() => { ... whenFlushedCallbacks.pop()?.(); })`
- 为什么是问题：等待者在 `finally` 里被 resolve，写入拒绝也会放行。失败的那一批已经不在 pending 里，缓存里还有，但下一次 `flush` 在没有新编辑时直接返回。进程若在真正关闭恢复之前退出，这批修改不在库里。
- 方向：写入成功后再清 pending；失败把这批放回，并让 `whenFlushed` 拒绝。

## r01-5 中
- 症状：按 `sourcePath` 解压时会带上路径外的条目，或把条目落到错误的相对路径。
- 位置：`src/vs/base/node/zip.ts` 第 331 行、第 155 行
- 引用：`new RegExp(options.sourcePath ? \`^${options.sourcePath}\` : '')`，随后 `entry.fileName.replace(options.sourcePathRegex, '')`
- 为什么是问题：`sourcePath` 按路径说明传入，却被当成正则，且不要求落在 `/` 边界。`foo.bar/` 会命中 `fooXbar/`，`extension` 会命中 `extension-extra/...`。剥完前缀的名字可能变成另一截相对路径；目录项若被剥成空串，末尾不再是 `/`，会走文件写入，写的是解压目录本身。
- 方向：按字面路径转义，并且只在路径边界上剥前缀。
