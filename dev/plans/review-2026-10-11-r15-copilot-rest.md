---
title: "审查 r15：copilot-rest"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "3 条；仓库远程地址读失败时，内容排除会把文件记成允许。"
---

## r15-1 高

- 症状：仓库还没被 Git 扩展打开时，子模块或链接工作树里的文件套不上该仓库的内容排除规则，并且「允许」会被记住。
- 位置：`extensions/copilot/src/platform/git/vscode-node/gitServiceImpl.ts` 第 242–253 行
- 引用：

```242:253:extensions/copilot/src/platform/git/vscode-node/gitServiceImpl.ts
			const buffer = await vscode.workspace.fs.readFile(URI.file(path.join(repositoryRoot.fsPath, '.git', 'config')));

			const remotes = {
				rootUri: repositoryRoot,
				remoteFetchUrls: parseGitRemotes(buffer.toString()).map(remote => remote.fetchUrl)
			};

			this.logService.trace(`[GitServiceImpl][getRepositoryFetchUrls] Remotes (.git/config): ${JSON.stringify(remotes)}`);
			return remotes;
		} catch (error) {
			this.logService.error(`[GitServiceImpl][getRepositoryFetchUrls] Failed to read remotes from .git/config: ${error.message}`);
			return undefined;
```

`getRepository(uri)` 没有命中时才走到这里。子模块和链接工作树的 `.git` 是指向 gitdir 的文件，不是目录，`…/.git/config` 读不到，函数返回 `undefined`。

- 为什么是问题：`RemoteContentExclusion.isIgnored` 把 `undefined` 当成「这个文件不属于任何仓库」，只去拉 `non-git-file` 的规则。Git 服务一旦初始化完，`repoSettled` 为真，否定裁决会写进 `_ignoreGlobResultCache`。同一文件在规则过期前不再重新解析远程地址，仓库级 `paths` / 内容规则因此不会生效。空远程列表走的是另一条路：不写入仓库缓存，下次继续问 Git。读配置失败没有走那条路。

```199:205:extensions/copilot/src/platform/ignore/node/remoteContentExclusion.ts
		const repoSettled = resolvedRepo ? resolvedRepo.fetchUrls.length > 0 : this._gitService.isInitialized;

		// No repository is associated with this file, so we set it to the 'virtual' non-git file repo / key
		// This way when we go to lookup rules for this file it will pull the non git file rules
		const repoMetadata: RepoMetadata = resolvedRepo ?? { repoRootPath: '', fetchUrls: [NON_GIT_FILE_KEY] };
```

```277:286:extensions/copilot/src/platform/ignore/node/remoteContentExclusion.ts
		if (rulesLoaded && repoSettled && !hasProvidedContents) {
			this._ignoreGlobResultCache.set(file, { verdict: false, generation });
			// Only meaningful when regex rules forced us to read (and hash) the file.
			if (regexCacheKey) {
				this._ignoreRegexResultCache.set(regexCacheKey, { verdict: false, generation });
			}
		}
		return false;
```

- 方向：`.git` 是文件时先解析 gitdir 再读 config；远程地址解析失败时不要把「允许」写入裁决缓存。

## r15-2 中

- 症状：同一轮先写入用户消息、再补上助手回复后，全文搜索只剩助手回复，用户消息搜不到。
- 位置：`extensions/copilot/src/platform/chronicle/node/sessionStore.ts` 第 322–345 行
- 引用：

```322:345:extensions/copilot/src/platform/chronicle/node/sessionStore.ts
		db.prepare(
			`INSERT INTO turns (session_id, turn_index, user_message, assistant_response, timestamp)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(session_id, turn_index) DO UPDATE SET
				user_message = COALESCE(excluded.user_message, user_message),
				assistant_response = COALESCE(excluded.assistant_response, assistant_response)`,
		).run(
			turn.session_id,
			turn.turn_index,
			turn.user_message ?? null,
			turn.assistant_response ?? null,
			turn.timestamp ?? new Date().toISOString(),
		);

		// Index searchable content
		const content = [turn.user_message, turn.assistant_response].filter(Boolean).join('\n');
		if (content) {
			const turnId = `${turn.session_id}:turn:${turn.turn_index}`;
			// Remove old FTS entry if exists, then insert new one
			db.prepare('DELETE FROM search_index WHERE source_id = ?').run(turnId);
			db.prepare(
				'INSERT INTO search_index (content, session_id, source_type, source_id) VALUES (?, ?, ?, ?)',
			).run(content, turn.session_id, 'turn', turnId);
```

- 为什么是问题：冲突更新用 `COALESCE` 保留未传入的那一列，`turns` 里两次写入会合成完整一轮。搜索索引却只用这次传入的字段，先删掉旧的 `source_id` 再插入残缺正文。先写入 `user_message: 'Hello'`、再写入 `assistant_response: 'Hi!'` 时，表里两列都在，索引里只剩 `Hi!`。
- 方向：重建索引前读回合并后的 `user_message` 和 `assistant_response`。

## r15-3 中

- 症状：历史工具参数若是合法的 JSON 数组或字面量，重放给 Messages API 时会原样放进 `tool_use.input`，请求失败。
- 位置：`extensions/copilot/src/platform/endpoint/node/messagesApi.ts` 第 344–356 行
- 引用：

```344:356:extensions/copilot/src/platform/endpoint/node/messagesApi.ts
						const rawArguments = toolCall.function.arguments;
						let parsedInput: Record<string, unknown>;
						try {
							parsedInput = JSON.parse(rawArguments);
						} catch {
							parsedInput = { [TOOL_USE_UNPARSED_ARGUMENTS_FIELD]: rawArguments };
						}
						content.push({
							type: 'tool_use',
							id: mapToolCallId(toolCall.id),
							name: toolCall.function.name,
							input: parsedInput,
						});
```

- 为什么是问题：只有 `JSON.parse` 抛错才把原文放进 `unparsedArguments`。`[]`、`null`、`42` 都能解析成功，但不是普通对象，仍被标成 `Record` 送出去。Messages API 的 `tool_use.input` 只接受对象，这种历史消息会让整次请求失败。
- 方向：解析结果不是普通对象时，与非法 JSON 一样放进 `unparsedArguments`。
