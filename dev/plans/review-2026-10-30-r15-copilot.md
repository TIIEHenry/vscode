---
title: "十六路审查 r15：copilot 扩展发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽查 extensions/copilot 的会话元数据落盘、录制刷盘、工作树变更、建文件和内容排除，证实 5 条。"
---
# 十六路审查 r15：copilot 扩展发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围只覆盖 `extensions/copilot` 的生产 TypeScript。下面每条都来自这次读到的实现。

### r15-1

- 严重度：高
- 症状：删掉一个 CLI 会话，或批量索引读盘失败时，`~/.copilot` 下的会话批量索引会被写成空对象或过期快照，文件夹到会话、worktree 的对应关系在下次启动后对不上。
- 代码：

```213:222:extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts
	async deleteSessionMetadata(sessionId: string): Promise<void> {
		await this._ready;
		// ...
		if (sessionId in this._cache) {
			delete this._cache[sessionId];
			this._updateFolderIndex(sessionId, undefined);
			const data = await this.getGlobalStorageData().catch(() => ({} as Record<string, ChatSessionMetadataFile>));
			delete data[sessionId];
			await this.writeToGlobalStorage(data);
		}
```

```644:673:extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts
	private async updateGlobalStorageImpl() {
		try {
			await this._bulkSequencer.queue(BULK_SEQUENCER_KEY, async () => {
				const data: Record<string, ChatSessionMetadataFile> = { ...this._cache };
				try {
					const storageData = await this.getGlobalStorageData();
					// last-modified-wins merge
				} catch {
					//
				}
				await this.writeToGlobalStorage(data);
			});
```

- 为什么是问题：`deleteSessionMetadata` 不进 `_bulkSequencer`。读盘一旦抛错（文件被写到一半、JSON 损坏）就被当成 `{}`，再整文件覆盖，其它会话的批量索引全部消失。读成功时也会和正在排队的 `updateGlobalStorageImpl` 交叉：删除方写下自己读到的旧快照，后写入的会话从索引里掉出去。启动时 `_cache` 只从这份批量文件来，`getSessionIdsForFolder` / `getWorktreeSessions` 只看由此建的内存索引。
- 方向：删除和刷盘共用同一把队列；读失败就保留原文件，不要用空对象覆盖。

### r15-2

- 严重度：高
- 症状：工作区录制的 `state.json` 会丢掉刷盘期间新登记的文档，进程若停在「删掉原文件、尚未改名」之间，这份状态文件直接没了。
- 代码：

```45:60:extensions/copilot/src/extension/workspaceRecorder/vscode-node/safeFileWriteUtils.ts
	async flushAsync(): Promise<void> {
		if (!this._dirty) { return; }
		const jsonStr = JSON.stringify(this._value, null, 4);
		const tempFilePath = this.filePath + '.new';
		await writeFile(tempFilePath, jsonStr, { encoding: 'utf8' });
		if (this._exists) {
			await unlink(this.filePath);
		}
		await rename(tempFilePath, this.filePath);
		this._exists = true;
		this._dirty = false;
	}
```

```273:295:extensions/copilot/src/extension/workspaceRecorder/vscode-node/workspaceRecorder.ts
		if (shouldWrite) {
			s.setValue({ ...s.value, documents: { ...curState.documents, [relativePath]: info } });
			this._scheduleFlush();
		}
		// ...
	private _scheduleFlush() {
		this._writeQueue.clearPending();
		this._writeQueue.schedule(async () => {
			await timeout(10 * 1000);
			const state = this._state;
			await state.flushAsync();
```

- 为什么是问题：`flushAsync` 在第一次 `await` 之前就拍下 `_value`。等待写盘时 `setValue` 会把 `_dirty` 再设为 true，结束时又无条件写成 false。`clearPending` 停不掉已经在跑的那次刷盘，排在后面的下一次看到 `dirty === false` 就直接返回，新的 document id 不会落盘；退出时 `_forceFlush` 同样因 dirty 为 false 而跳过。另外先 `unlink` 再 `rename`，中间崩溃后 `loadOrCreate` 只读原路径，不读 `.new`。
- 方向：写完后若期间又有 `setValue` 就保持 dirty，并用同目录原子替换，不要先删原文件。

### r15-3

- 严重度：中
- 症状：工作树变更列表会少文件，界面上的增删行数对不齐实际 diff。
- 代码：

```633:651:extensions/copilot/src/extension/chatSessions/vscode-node/chatSessionWorktreeServiceImpl.ts
		for (const change of [...worktreeRepository.changes.indexChanges, ...worktreeRepository.changes.workingTree]) {
			try {
				const fileStats = await this.gitService.diffIndexWithHEADShortStats(change.uri);
				changes.push({
					filePath: change.uri.fsPath,
					// ...
					statistics: {
						additions: fileStats?.insertions ?? 0,
						deletions: fileStats?.deletions ?? 0
					}
				} satisfies ChatSessionWorktreeFile);
			} catch (error) { }
		}
		return changes;
```

- 为什么是问题：单个文件的 `diffIndexWithHEADShortStats` 抛错时，这个文件既不进入 `changes`，也没有日志。调用方拿到的是一份看似完整的列表。
- 方向：失败的文件仍保留在列表里并带上错误，不要静默跳过。

### r15-4

- 严重度：中
- 症状：对已经存在、但打不开成文本文档的路径调用建文件，工具不会拒绝，而是发出从文件头插入，或整本 notebook 重写。
- 代码：

```86:127:extensions/copilot/src/extension/tools/node/createFileTool.tsx
		const fileExists = await this.fileExists(uri);
		// ...
		try {
			if (hasSupportedNotebooks) {
				doc = await this.workspaceService.openNotebookDocumentAndSnapshot(uri, ...);
			} else {
				doc = await this.workspaceService.openTextDocumentAndSnapshot(uri);
			}
		} catch (e) {
			// ignored
		}

		if (fileExists && !!doc?.getText()) {
			// throw: file already exists
		}
		// ...
		if (hasSupportedNotebooks) {
			await processFullRewriteNewNotebook(uri, content, ...);
		} else {
			// ...
			this._promptContext.stream.textEdit(uri, TextEdit.insert(new ExtPosition(0, 0), content));
		}
```

- 为什么是问题：「文件已存在」这条拒绝依赖打开成功并且 `getText()` 非空。打开抛错（例如二进制文件）时 `doc` 仍是空的，存在性判断被跳过，已有内容会接到插入或 notebook 重写后面。
- 方向：`stat` 已确认文件存在时直接拒绝，不要因为打开失败就改走创建。

### r15-5

- 严重度：中
- 症状：一个仓库的内容排除 glob 会挡住另一个仓库里同名路径，模型读不到本不该被排除的文件。
- 代码：

```216:221:extensions/copilot/src/platform/ignore/node/remoteContentExclusion.ts
		for (const glob of this._compiledGlobs) {
			if (glob.match(fileName) || glob.match(file.path)) {
				this._logService.debug(`File ${file.path} is ignored by content exclusion rule ${glob.pattern}`);
				this._ignoreGlobResultCache.set(file, { verdict: true, generation });
				return true;
			}
		}
```

```540:548:extensions/copilot/src/platform/ignore/node/remoteContentExclusion.ts
	private rebuildCompiledRules(): void {
		const globs: Minimatch[] = [];
		for (const { patterns, ifAnyMatch, ifNoneMatch, fetchedAt } of this._contentExclusionCache.values()) {
			for (const pattern of patterns) {
				try {
					globs.push(new Minimatch(pattern, MINIMATCH_OPTIONS));
				} catch (err) {
```

- 为什么是问题：`_compiledGlobs` 把缓存里每个仓库的 path 规则合成一份，匹配时也不看文件属于哪个 remote。同文件里的 regex 规则是按 `fetchUrl` 分开的，glob 没有。`MINIMATCH_OPTIONS` 还开了 `matchBase`，短模式会命中任意目录下的同名文件。
- 方向：glob 只和该文件所属仓库（以及明确的组织级规则）匹配。

## 实际打开过的文件

- `extensions/copilot/src/extension/chatSessions/copilotcli/node/permissionHelpers.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/node/copilotcliSession.ts`
- `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts`
- `extensions/copilot/src/extension/chatSessions/vscode-node/chatSessionWorktreeServiceImpl.ts`
- `extensions/copilot/src/extension/workspaceRecorder/vscode-node/safeFileWriteUtils.ts`
- `extensions/copilot/src/extension/workspaceRecorder/vscode-node/workspaceRecorder.ts`
- `extensions/copilot/src/extension/tools/node/createFileTool.tsx`
- `extensions/copilot/src/extension/tools/node/applyPatchTool.tsx`
- `extensions/copilot/src/extension/tools/node/memoryTool.tsx`
- `extensions/copilot/src/extension/tools/node/vscodeCmdTool.tsx`
- `extensions/copilot/src/extension/tools/node/readFileTool.tsx`
- `extensions/copilot/src/extension/prompts/node/panel/toolCalling.tsx`
- `extensions/copilot/src/extension/intents/node/toolCallingLoop.ts`
- `extensions/copilot/src/platform/ignore/node/remoteContentExclusion.ts`
- `extensions/copilot/src/platform/authentication/common/copilotTokenStore.ts`
- `extensions/copilot/src/platform/authentication/vscode-node/copilotTokenManager.ts`
- `extensions/copilot/src/extension/chronicle/vscode-node/remoteSessionExporter.ts`
- `extensions/copilot/src/extension/tools/node/sessionStoreSqlTool.ts`
- `extensions/copilot/src/util/common/async.ts`
- `extensions/copilot/src/extension/prompts/node/codeMapper/codeMapper.ts`
