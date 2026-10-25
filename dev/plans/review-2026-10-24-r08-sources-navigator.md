---
title: "审查 r08：sources-navigator"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；切走会话后仍会提交上一会话，Accept 对不上 hunk 就空返回，预览 diff、检查器和引擎文件会串身份。"
---

## r08-1 高
- 症状：活动会话已经换成新 id 后，Changes 仍显示上一会话的引擎行，Commit 按那些行的旧 `sessionId` 调用 `WriteGitCommit`。引擎返回接受后，失败状态被清掉，界面像是已经提交。同一列表的 Stage 在会话不一致时直接拒绝。
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts` 第 1226–1332 行
- 引用：
```1226:1332:src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts
	/** Snapshot or leftover-row session. Never the active session. */
	private commitSessionId(snapshot: ISourcesChangesSnapshot): string {
		for (const entry of snapshot.entries) {
			if (entry.sessionId) {
				return entry.sessionId;
			}
		}
		if (snapshot.state.kind !== 'scm') {
			return snapshot.state.sessionId;
		}
		return '';
	}

	private async runLocalCommit(repo: ISCMRepository | undefined, repository: ISCMRepository | undefined): Promise<void> {
		if (this._store.isDisposed || this.activeRepository !== repository) {
			return;
		}
		if (!repo) {
			this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			return;
		}

		const acceptCommand = repo.provider.acceptInputCommand;
		if (acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id)) {
			try {
				await this.commandService.executeCommand(acceptCommand.id, ...(acceptCommand.arguments ?? []));
				this.setWriteStatusMessage(undefined);
			} catch (error) {
				this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
			}
			return;
		}

		if (this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND)) {
			try {
				await this.commandService.executeCommand(SOURCES_GIT_COMMIT_COMMAND);
				this.setWriteStatusMessage(undefined);
			} catch (error) {
				this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
			}
			return;
		}

		this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
	}

	private async runEngineCommit(sessionId: string, message: string, repository: ISCMRepository | undefined): Promise<void> {
		const writeHook = this.uaConnection.writeGitCommit;
		try {
			const written = await tryWriteSourcesGitCommit(
				this.uaConnection.isEngineConnected(),
				writeHook ? request => writeHook.call(this.uaConnection, request) : undefined,
				sessionId,
				message,
				this.isSourcesGitWritePairingHold(),
				this.isSourcesGitWriteListFailed(),
				this.getEngineSessionReady(),
			);
			if (this._store.isDisposed || this.activeRepository !== repository) {
				return;
			}
			if (isSourcesGitWriteAccepted(written)) {
				this.setWriteStatusMessage(undefined);
				this.scheduleRefresh();
				return;
			}
			if (!written || isSourcesGitWriteUnsupported(written)) {
				this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
				return;
			}
			const detail = sourcesGitWriteFailureDetail(written) || sourcesGitCommitNotAcceptedMessage();
			this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", detail));
		} catch (error) {
			if (this._store.isDisposed || this.activeRepository !== repository) {
				return;
			}
			this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
		}
	}

	private async runCommit(): Promise<void> {
		if (this.isSourcesGitWriteClosed()) {
			return;
		}
		const message = this.commitInput.value;
		if (!message.trim()) {
			return;
		}

		const snapshot = this.changesModel.getSnapshot();
		if (snapshot.state.kind === 'scm') {
			const staged = uniqueSourcesStagedRepository(this.scmService.repositories);
			if (!staged || this.activeRepository !== staged) {
				return;
			}
			staged.input.setValue(message, false);
			staged.provider.inputBoxTextModel.setValue(message);
			await this.runLocalCommit(staged, staged);
			return;
		}

		const repo = this.activeRepository;
		if (!repo && !this.canWriteCommit()) {
			this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			return;
		}
		await this.runEngineCommit(this.commitSessionId(snapshot), message, this.activeRepository);
	}
```
- 为什么是问题：`commitSessionId` 取快照里第一条带 `sessionId` 的行，不看当前活动会话。no-hook leftover 不关写门。第 1027–1029 行 Stage 发现行会话和活动会话不同就停，并提示这次没有写入；第 1332 行 Commit 仍把旧 id 送出去。第 1287–1288 行在 `supported && success` 时清掉状态。`sourcesChangesList.test.ts` 第 3068–3116 行把这个行为锁死：活动会话已是 `session-new`，提交请求仍是 `session-old`。
- 方向：Commit 与 Stage 使用同一条会话不一致规则，旧会话的提交不能显示成当前会话已成功。

## r08-2 中
- 症状：引擎 FileDiff 上点 Accept，光标所在的 hunk 经常既不写入，也不出现错误。
- 位置：`src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts` 第 616–618 行
- 引用：
```616:618:src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts
			const patch = read?.supported ? sourcesGitHunkPatchAtCursor(read.unifiedDiff, cursor.line, cursor.side) : undefined;
			if (!patch || !hasSourcesGitApplyHunksPayload(sessionId, [patch])) {
				return;
```
- 为什么是问题：`sourcesGitHunkPatchAtCursor`（`sourcesGitHunkPatch.ts` 第 153–156 行）把 `cursorLine` 当成 `@@` 头里的文件行号。引擎差异模型里的文本来自 `parseSourcesGitUnifiedDiff`（`sourcesChangesGitRead.ts` 第 231–269 行），只拼接 hunk 正文，编辑器行号从 1 重新计。`sourcesChangeEntryOpen.ts` 第 129–141 行把这段文本放进左右模型。光标在第二个 hunk，或第一个 hunk 不是从文件第 1 行开始时，行号对不上，第 617–618 行直接返回。`sourcesDiffPanelView.ts` 第 643–645 行同样处理。
- 方向：Accept 使用与当前差异模型一致的行号，对不上时要留下可见失败。

## r08-3 中
- 症状：同一文件同时有暂存和未暂存时，从预览 diff 移走后再暂存或取消暂存，会作用到索引组。
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts` 第 37–64 行
- 引用：
```37:64:src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts
	if (isDiffEditorInput(editor)) {
		const modified = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
		if (!modified) {
			return undefined;
		}
		const original = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.SECONDARY });
		const match = findFirstScmResourceForUri(scmService, modified);
		return {
			modified,
			original,
			groupId: match?.groupId ?? '',
			scmResource: match?.resource,
		};
	}

	return undefined;
}

/** Preview `DiffEditorInput` does not carry the opened row's groupId. */
function findFirstScmResourceForUri(scmService: ISCMService, uri: { toString(): string }): { resource: ISCMResource; groupId: string } | undefined {
	const key = uri.toString();
	for (const repo of scmService.repositories) {
		for (const group of repo.provider.groups) {
			for (const resource of group.resources) {
				if (resource.sourceUri.toString() === key) {
					return { resource, groupId: group.id };
				}
			}
```
- 为什么是问题：`sourcesChangeRef.ts` 第 107–109 行写明 Git 先注册 index，再注册 workingTree，并且不能用另一个组的 URI 命中替换打开时的组。预览 `DiffEditorInput` 没有 groupId，`findFirstScmResourceForUri` 返回第一组。文件同时在 index 和 workingTree 时，后续 `git.stage` / `git.unstage` 拿到的是索引资源。
- 方向：预览 diff 移动时保留打开时的组，不能改绑到先注册的 index。

## r08-4 中
- 症状：切换会话后，检查器仍显示上一会话某个 agent 的状态、轮次和模型，而且没有“已不在当前树”的提示。
- 位置：`src/vs/workbench/contrib/navigator/browser/agentInspectView.ts` 第 126–136 行
- 引用：
```126:136:src/vs/workbench/contrib/navigator/browser/agentInspectView.ts
	if (sourceIds) {
		switch (target.kind) {
			case 'agent':
				return sourceIds.agents !== undefined && !sourceIds.agents.has(target.node.agentId);
			case 'member':
				return sourceIds.team !== undefined && !sourceIds.team.has(target.info.memberAgentId);
			case 'task':
				return sourceIds.task !== undefined && !sourceIds.task.has(target.task.taskId);
			case 'activity':
				return sourceIds.activity !== undefined && !sourceIds.activity.has(target.item.id);
		}
	}
```
- 为什么是问题：`navigatorAgentsView.ts` 第 499 行把 `e.element.source` 设为检查目标。层次节点上的 `sessionId` 在 `navigatorAgentHierarchy.ts` 第 77–86 行，没有放进这份 source。过期判断只看 `agentId`。新会话的树里只要还有同一个 id（根节点就是），`isInspectTargetStale` 为 false，上一份状态继续当作当前项。活动会话变化时也没有清掉这个目标。
- 方向：检查目标带上会话，会话切换后旧节点不能继续算当前树里的同一项。

## r08-5 中
- 症状：两个会话列出同一引擎路径时，后返回的读取会改写先打开的那份正文，编辑器里分不出是哪一个会话。
- 位置：`src/vs/workbench/contrib/sources/common/sourcesFilesEngineRead.ts` 第 84–114 行
- 引用：
```84:114:src/vs/workbench/contrib/sources/common/sourcesFilesEngineRead.ts
export function sourcesEngineFileResource(enginePath: string): URI {
	const slash = enginePath.replace(/\\/g, '/');
	const path = slash.startsWith('/') ? slash : `/${slash}`;
	return URI.from({ scheme: SOURCES_ENGINE_FILE_SCHEME, path });
}

/**
 * Text editor input for engine bytes. Refuses any resource that is not
 * {@link SOURCES_ENGINE_FILE_SCHEME}, so a missing local file is not opened.
 * Resolution goes through `TextResourceEditorModel`, which is readonly.
 */
export function sourcesEngineReadonlyTextInput(
	resource: URI,
	text: string,
	label: string,
	options: ITextEditorOptions,
): ITextResourceEditorInput | undefined {
	if (resource.scheme !== SOURCES_ENGINE_FILE_SCHEME) {
		return undefined;
	}
	return {
		resource,
		contents: text,
		label,
		options,
	};
}

export function putSourcesEngineFileText(resource: URI, text: string): void {
	engineFileTextByPath.set(resource.path, text);
}
```
- 为什么是问题：资源 URI 和 `engineFileTextByPath` 只按路径。`sourcesFilesList.ts` 第 478–486 行用条目上的 `sessionId` 去 `readFile`，返回后无条件 `putSourcesEngineFileText` 再打开；等待期间换了会话也不会丢掉这次结果。同一路径因此共用一个文档，慢的上一会话读取会盖住当前会话的正文。
- 方向：引擎文件身份带上会话，过期读取不能写进当前文档。
