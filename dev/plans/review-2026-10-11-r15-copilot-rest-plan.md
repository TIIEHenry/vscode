---
title: "方案 r15：copilot-rest"
type: plan
status: draft
phase: N/A
updated: 2026-10-23
summary: "hold 2，drop 0，weaken 1。r15-1 gitfile / commondir 解析已落；回合索引与非对象 tool input 仍开。"
---
# 方案 r15：copilot-rest

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 2，drop 0，weaken 1。

> **落地记录（2026-10-23，部分）：** 本方案仍 `draft`。r15-1 已落；r15-2 / r15-3 仍开。已落子项只改到各自点名的位置，未动其余子项，也不把整份方案升 `implemented`。

## r15-1（weaken，降为中）

### 问题类
未打开仓库时，`getRepositoryFetchUrls` 把 `仓库根/.git/config` 读失败当成「没有仓库」。

反证：父仓库已在 `_repoRootCache` 时，子模块文件不会走到这条失败路径。`isIgnored` 先调用 `findCachedRepoMetadataForFile`（`remoteContentExclusion.ts` 第 187–191 行、第 600–618 行），子模块路径以前缀命中父仓库后直接用父仓库的 `fetchUrls`，不再调用 `getRepositoryFetchUrls`。另外，否定裁决写入后并不总是撑到规则过期：`memoisedVerdict`（第 297–304 行）在 `isRegexContextExclusionsEnabled` 为真时对 `verdict: false` 返回 `undefined`，会重新解析；`onDidOpenRepository`（第 132–140 行）在打开的仓库有可用远程地址时调用 `invalidateVerdicts()`。测试 `applies a repository rule to files evaluated before that repository opened` 锁的是后一条。

仍成立的部分：`GitServiceImpl.getRepositoryFetchUrls` 在 `getRepository` 未命中时仍读 `path.join(repositoryRoot.fsPath, '.git', 'config')`（`gitServiceImpl.ts` 第 242 行），失败则 `return undefined`（第 251–253 行），没有解析 gitfile。`getRepositoryInfo` 对 `undefined` 返回 `undefined`（第 576–578 行）。`isIgnored` 把这当成 `NON_GIT_FILE_KEY`（第 201–205 行）；`isInitialized` 为真且没有正则规则时，否定裁决写入 `_ignoreGlobResultCache`（第 279–285 行）并被 `memoisedVerdict` 复用。空远程列表不走这条路：`cacheRepoMetadata` 在 `fetchUrls.length === 0` 时直接返回（第 336–338 行），`repoSettled` 为假，不写否定裁决。路径不落在已缓存仓库根之下的链接工作树，以及父仓库尚未缓存的子模块，仍会命中上述失败路径。Git 扩展自己的 `getRepositoryDotGit` 是从 `commonDotGitPath ?? dotGitPath` 读 `config`（`extensions/git/src/git.ts` 第 583 行），工作树的远程地址在 common dir，不在工作树 gitdir。

### 不变量
已打开仓库仍只用 `repository.state.remotes`。`getRepositoryRoot` 得不到根、非 file URI、没有 Git API 时仍返回 `undefined`，真正无仓库的文件仍可记住「允许」。真实的空远程列表仍不进 `_repoRootCache`，下次继续问 Git。`findCachedRepoMetadataForFile` 的祖先前缀匹配不动。

### 要动的符号或文件
`GitServiceImpl.getRepositoryFetchUrls`（`extensions/copilot/src/platform/git/vscode-node/gitServiceImpl.ts`，当前第 197–254 行）。

`.git` 是文件时，读出 `gitdir:`，相对仓库根解析；若该 gitdir 里有 `commondir`，从 common dir 读 `config`，否则从 gitdir 读 `config`。解析出远程地址后仍返回 `{ rootUri: repositoryRoot, remoteFetchUrls }`。

已经得到 `repositoryRoot` 但 config 仍读不到时，不要 `return undefined`。改为返回 `{ rootUri: repositoryRoot, remoteFetchUrls: [] }`，让现有的「无可用远程」路径生效：`repoSettled` 为假，不把「允许」写入裁决缓存，下次再问 Git。

### 明确不改
不改 `RemoteContentExclusion.isIgnored` 对真正 `undefined` 的 non-git 处理，不改 `memoisedVerdict`，不改 `onDidOpenRepository` 的 `invalidateVerdicts`，不改 `findCachedRepoMetadataForFile`。

### 本地验证
现有测试保持：`extensions/copilot/src/platform/ignore/node/test/remoteContentExclusion.spec.ts` 里的 `memoises a verdict for a file that genuinely belongs to no repository`、`does not cache a repository that resolved without a usable remote`、`applies a repository rule to files evaluated before that repository opened`。

应新增断言：`getRepository` 未命中、仓库根的 `.git` 是含 `gitdir:` 的文件、config 实际在解析后的 gitdir 或 common dir 时，`getRepositoryFetchUrls` 返回该 config 里的 fetch URL，而不是 `undefined`。同一函数在已经得到仓库根但 config 读取仍失败时，返回空的 `remoteFetchUrls`，而不是 `undefined`。

## r15-2（hold，中）

### 问题类
`insertTurn` 冲突更新后，全文索引只用本次传入的字段，先删掉旧索引再写入残缺正文。

位置仍是 `extensions/copilot/src/platform/chronicle/node/sessionStore.ts` 第 322–345 行。`turns` 用 `COALESCE` 保留未传入的列；`search`（第 480–489 行）只查 `search_index`。

### 不变量
`turns` 的 `ON CONFLICT` 与 `COALESCE` 合并语义不变。一次调用同时带上 `user_message` 和 `assistant_response` 时，索引仍是这两列用换行拼起来。检查点索引不动。

### 要动的符号或文件
`SessionStore.insertTurn`（同上文件，当前第 316–346 行）。

`INSERT ... ON CONFLICT` 成功后，按 `session_id` 与 `turn_index` 读回合并后的 `user_message` 和 `assistant_response`，用这两列重建 `content`，再按现有的 `source_id`（`${session_id}:turn:${turn_index}`）删除并插入 `search_index`。

### 明确不改
不改 `turns` 的列合并规则，不改 `insertCheckpoint` 的分段索引，不改 `search` 的 SQL。

### 本地验证
`extensions/copilot/src/platform/chronicle/node/test/sessionStore.spec.ts` 的 `insertTurn upserts on conflict`。

在现有两次写入（先 `user_message: 'Hello'`，再 `assistant_response: 'Hi!'`）之后增加断言：`search('Hello')` 与 `search('"Hi"')` 都命中 `session-1`。`search_index` 是默认分词的 FTS5，`search('Hi!')` 会因 `!` 报语法错误，不要用这个查询词，且命中行的 `content` 同时含这两段。

## r15-3（hold，中）

### 问题类
历史工具参数是合法 JSON 但不是普通对象时，仍被放进 `tool_use.input`。

位置仍是 `extensions/copilot/src/platform/endpoint/node/messagesApi.ts` 第 344–356 行。只有 `JSON.parse` 抛错才写入 `TOOL_USE_UNPARSED_ARGUMENTS_FIELD`。本仓 SDK 把 `ToolUseBlockParam.input` 标成 `unknown`（`@anthropic-ai/sdk/resources/messages/messages.d.ts` 第 1373–1375 行），类型层拦不住数组、`null` 和字面量。

### 不变量
非法 JSON 仍放进 `unparsedArguments`。解析结果是普通对象时仍原样作为 `input`。工具调用 id 映射和 `tool_result` 转换不动。

### 要动的符号或文件
`rawMessagesToMessagesAPI` 里组装 `tool_use` 的那段（同上文件，当前第 344–356 行）。

`JSON.parse` 成功后，结果不是普通对象（`null`、数组，或 `typeof` 不是 `'object'`）时，与 `catch` 相同，设为 `{ [TOOL_USE_UNPARSED_ARGUMENTS_FIELD]: rawArguments }`。

### 明确不改
不改 `TOOL_USE_UNPARSED_ARGUMENTS_FIELD` 的字段名，不改请求体其他字段，不改流式响应里对 `tool_use` 的解析。

### 本地验证
`extensions/copilot/src/platform/endpoint/test/node/messagesApi.spec.ts` 的 `preserves unparsed tool arguments in tool_use.input when JSON.parse fails` 与 `parses valid JSON tool arguments into tool_use.input` 保持现有断言。

应新增断言：`arguments` 为 `[]`、`null`、`42`、`"text"`、`true` 时，`tool_use.input` 等于 `{ [TOOL_USE_UNPARSED_ARGUMENTS_FIELD]: 原始字符串 }`；`{}` 与 `{"path":"/tmp/test.txt"}` 仍是解析后的普通对象。
