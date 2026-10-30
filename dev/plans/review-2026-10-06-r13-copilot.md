---
title: "审查 r13：copilot"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "内容排除正则会漏判，工作区索引会吃进二进制，嵌入缓存、变基和会话搜索也会给出错误结果。"
---
# 审查 r13：copilot

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r13-1 高
- 症状：组织内容排除规则带 `g` 或 `y` 时，本应排除的文件会间歇性放行，内容进入 Copilot 上下文。
- 位置：`extensions/copilot/src/platform/ignore/node/remoteContentExclusion.ts` 第 259–267 行、第 634–645 行
- 引用：`ifAnyMatch.some(pattern => pattern.test(contentsToCheck))`；`return new RegExp(pattern, flags)`
- 为什么是问题：`stringToRegex` 原样保留服务端标志，编译结果放在按仓库缓存的 `RegExp` 上，多次 `isIgnored` 复用同一对象。带 `g`/`y` 时 `test` 会推进 `lastIndex`，下一次从中间开始匹配，命中失败后才把 `lastIndex` 归零。排除判定因此在「排除 / 放行」之间交替，放行的那次会把策略禁止的文件交给模型。
- 方向：匹配前把 `lastIndex` 置 0，或编译时去掉 `g`/`y`。

## r13-2 中
- 症状：扩展名不在黑名单里的二进制文件会被当成文本读进工作区索引。
- 位置：`extensions/copilot/src/platform/workspaceChunkSearch/node/workspaceFileIndex.ts` 第 1001–1015 行
- 引用：`const isBinary = isBinaryFileSync(Buffer.concat(chunks));` 之后才 `chunks.push(chunk)`
- 为什么是问题：二进制判断用的是「当前 chunk 尚未推入」的 `chunks`。首块到达且长度已超过 1024 时，样本是空缓冲，文件字节没有参与判断，该块随后仍被拼进结果。总长度不足 1024 的文件则整段跳过判断。`getText` 再用 `TextDecoder` 把这块缓冲当文本返回，索引和后续检索会带上这段内容。
- 方向：用已包含当前 chunk 的样本做判断，并对短于 1024 字节的文件也做一次检测。

## r13-3 中
- 症状：嵌入缓存文件写失败后，下次仍会把旧文件当成当前版本读出来。
- 位置：`extensions/copilot/src/platform/embeddings/common/embeddingsIndex.ts` 第 103–132 行
- 引用：先 `update(this.cacheVersionKey, this.cacheVersion)`，再 `writeFile`；`getCache` 在版本相等时直接 `readJSON`
- 为什么是问题：版本号在写入成功之前就落盘。`writeFile` 失败只打日志。磁盘上若还留着上一份缓存，`getCache` 看到版本一致就会把它当作本次结果返回，设置、命令或工具的近邻排序用的是过期向量。
- 方向：写入成功后再更新版本号；写入失败时保持旧版本或删掉缓存文件。

## r13-4 中
- 症状：变基没有执行或执行失败时，调用方仍得到成功。
- 位置：`extensions/copilot/src/platform/git/vscode-node/gitServiceImpl.ts` 第 318–326 行
- 引用：`await repository?.rebase(branch);` 外层 `catch` 只 `logService.error`
- 为什么是问题：仓库没打开时可选链直接结束，Promise 照常完成。变基抛错（冲突、脏工作区）也被吃掉，不向外抛。调用方无法区分成功和失败，后续提交或继续操作会落在没有变基的分支上。
- 方向：没有仓库或变基失败时抛出错误，让调用方中止后续步骤。

## r13-5 中
- 症状：工作区工件被清空后，会话全文搜索仍能命中旧内容。
- 位置：`extensions/copilot/src/platform/chronicle/node/sessionStore.ts` 第 444–448 行
- 引用：`if (!content.trim()) { return; }`，其下才 `DELETE FROM search_index`
- 为什么是问题：注释写明后续写入会替换同一文件的索引项。内容变成空白时函数在删除之前返回，`search_index` 里该 `source_id` 的旧文本还在。搜索继续返回已经清空的工件内容。
- 方向：空白内容也要删除对应的 `search_index` 行。
