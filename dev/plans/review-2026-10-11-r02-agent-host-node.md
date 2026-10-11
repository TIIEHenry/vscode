---
title: "审查 r02：agent-host-node"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "3 条；归档会话时 git status 失败会被当成工作区干净，随后强制删除 worktree，未提交改动丢失。"
---

## r02-1 高
- 症状：归档 worktree 会话时，若 `git status` 超时或失败，未提交改动不会先被提交，工作区会被 `git worktree remove --force` 删掉。
- 位置：`src/vs/platform/agentHost/node/shared/worktreeIsolation.ts` 第 894–906 行
- 引用：

```894:906:src/vs/platform/agentHost/node/shared/worktreeIsolation.ts
		// Commit any uncommitted changes before archiving the session
		const hasUncommittedChanges = await this._gitService.hasUncommittedChanges(worktreePath).catch(() => true);
		if (hasUncommittedChanges) {
			try {
				await this._gitService.commitAll(worktreePath, localize('worktreeIsolation.commitMessage', 'Saving uncommitted changes before archiving session'));
			} catch (error) {
				this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to commit uncommitted changes in '${worktreePath.fsPath}': ${errorMessage(error)}`);
				return;
			}
		}

		try {
			await this._gitService.removeWorktree(repositoryRoot, worktreePath, { force: true });
```

```367:369:src/vs/platform/agentHost/node/agentHostGitService.ts
	async hasUncommittedChanges(workingDirectory: URI): Promise<boolean> {
		const output = await this._runGitStatus(workingDirectory, ['--porcelain']);
		return !!output && output.trim().length > 0;
```

```1089:1093:src/vs/platform/agentHost/node/agentHostGitService.ts
					if (options?.throwOnError) {
						reject(new Error(formatGitError(args, timeoutMs, didTimeOut, error, stderr), { cause: error }));
						return;
					}
					resolve(undefined);
```

- 为什么是问题：`_runGitStatus` 没有 `throwOnError`。`git status` 非 0（默认约 5 秒超时、锁、或其它失败）时 `_runGit` 解析为 `undefined`。`hasUncommittedChanges` 把 `undefined` 和空输出都当成 false，调用方的 `.catch(() => true)` 不会执行。后面的 `removeWorktree(..., { force: true })` 会删掉仍有未提交内容的工作区。提交失败才会 return 并留下目录；探测失败不会。归档入口是 `agentSideEffects.ts` 里 `SessionIsArchivedChanged` 对 `cleanupWorktreeOnArchive` 的调用。
- 方向：status 失败时中止删除并留下 worktree。

## r02-2 中
- 症状：删除会话只删掉会话 URI 那一个数据目录，附加聊天自己的库还在，里面可以有文件编辑的前后内容。
- 位置：`src/vs/platform/agentHost/node/sessionDataService.ts` 第 95–140 行
- 引用：

```95:101:src/vs/platform/agentHost/node/sessionDataService.ts
	private _dataKey(uri: URI): string {
		const id = AgentSession.id(uri);
		return uri.authority ? `${uri.authority}-${id}` : id;
	}

	openDatabase(session: URI): IReference<ISessionDatabase> {
		return this._databases.acquire(this._sanitizedSessionKey(session));
```

```113:140:src/vs/platform/agentHost/node/sessionDataService.ts
	async deleteSessionData(session: URI, workingDirectories?: readonly string[]): Promise<void> {
		const dir = this.getSessionDataDir(session);
		// ...
		try {
			if (await this._fileService.exists(dir)) {
				await this._fileService.del(dir, { recursive: true });
```

```41:43:src/vs/platform/agentHost/node/agentChatContext.ts
	return {
		resource: isDefaultChatUri(chatKey) ? sessionUri : toUri(chat),
		configurationResource: sessionUri,
```

```3926:3926:src/vs/platform/agentHost/node/agentService.ts
		await this._sessionDataService.deleteSessionData(session, workingDirectories);
```

- 为什么是问题：非默认聊天的持久化范围是聊天通道 URI。这种 URI 带 authority，`_dataKey` 会把库放到 `{chatId}-{sessionId}`，和会话目录并列，而不是放在会话目录里面。`deleteSessionData` 只删 `getSessionDataDir(session)` 这一棵。`disposeSession` 只对会话 URI 调一次；`disposeChat` 也不删聊天目录。附加聊天库里的 `file_edits` 快照会留在 `agentSessionData` 下。
- 方向：删除会话时按每个聊天的存储键把对应数据目录一起删掉。

## r02-3 中
- 症状：`git read-tree HEAD` 只要失败，就会改用空树继续做出检查点或分支 diff，变更列表会把仓库里未改动的文件显示成删除。
- 位置：`src/vs/platform/agentHost/node/agentHostGitService.ts` 第 760–770 行
- 引用：

```760:770:src/vs/platform/agentHost/node/agentHostGitService.ts
		try {
			// Seed the temp index from HEAD; for empty repos seed from the empty tree.
			const seeded = await this._runGit(repositoryRoot, ['read-tree', 'HEAD'], { env });
			if (seeded === undefined) {
				await this._runGit(repositoryRoot, ['read-tree', EMPTY_TREE_OBJECT], { env });
			}
			if (!(await this._stageChangedPaths(repositoryRoot, tempDir, changedPaths, env))) {
				return undefined;
			}
			const tree = (await this._runGit(repositoryRoot, ['write-tree'], { env }))?.trim();
			return tree || undefined;
```

```549:558:src/vs/platform/agentHost/node/agentHostGitService.ts
		try {
			const seeded = await this._runGit(repositoryRoot, ['read-tree', 'HEAD'], { env });
			if (seeded === undefined) {
				// Empty repo (no HEAD yet) - `read-tree` of the empty tree always succeeds.
				await this._runGit(repositoryRoot, ['read-tree', EMPTY_TREE_OBJECT], { env });
			}
			if (!(await this._stageChangedPaths(repositoryRoot, tempDir, changedPaths, env))) {
				return undefined;
			}
			return await this._runGit(repositoryRoot, ['diff', '--cached', '--raw', '--numstat', '--diff-filter=ADMR', '-z', mergeBaseCommit, '--'], { env });
```

- 为什么是问题：`_runGit` 在未设置 `throwOnError` 时，超时、锁或其它非 0 都返回 `undefined`，和「仓库还没有 HEAD」是同一种结果。空树 `read-tree` 的结果也不检查。随后只把 status 里的变更路径放进索引。`write-tree` 仍可能成功，检查点 ref 会指向这棵几乎空的树；`_runWithTempIndex` 则把同样的索引直接做成 `git diff --cached`。相对真实 HEAD，未改动文件都会变成删除。
- 方向：先确认仓库确实没有 HEAD 再退回空树；其它 `read-tree` 失败应放弃这次检查点或 diff。
