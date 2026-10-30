---
title: "审查 r15：copilot"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；云端提交打到活动仓库，未知路径的写权限会自动通过，补丁工具会串会话，基线分支被换成默认分支，取消后笔记本补丁仍写入。"
---
# 审查 r15：copilot

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r15-1 高
- 症状：多根工作区里，用户确认提交后，活动仓库的全部改动被提交并推送，云端会话却建在仓库列表的第一个或用户另选的仓库上。
- 位置：`extensions/copilot/src/extension/chatSessions/vscode-node/copilotCloudGitOperationsManager.ts` 第 26–53 行
- 引用：
```26:53:extensions/copilot/src/extension/chatSessions/vscode-node/copilotCloudGitOperationsManager.ts
	async repoInfo(): Promise<GitRepoInfo> {
		// TODO: support selecting remote
		// await this.promptAndUpdatePreferredGitHubRemote(true);
		const repoIds = await getRepoId(this.gitService);
		if (!repoIds || repoIds.length === 0) {
			throw new Error(vscode.l10n.t('Repository information is not available. Open a GitHub repository to continue with cloud agent.'));
		}
		const repoId = repoIds[0];
		const currentRepository = this.gitService.activeRepository.get();
		if (!currentRepository) {
			throw new Error(vscode.l10n.t('No active repository found. Open a GitHub repository to continue with cloud agent.'));
		}
		const git = this.gitExtensionService.getExtensionApi();
		const repo = git?.getRepository(currentRepository?.rootUri);
		// Checks if user has permission to access the repository
		if (!repo) {
			throw new Error(
				vscode.l10n.t(
					'Unable to access {0}. Please check your permissions and try again.',
					`\`${repoId.org}/${repoId.repo}\``
				)
			);
		}
		return {
			repository: repo,
			remoteName: repo.state.HEAD?.upstream?.remote ?? currentRepository.upstreamRemote ?? repo.state.remotes?.[0]?.name ?? 'origin',
			baseRef: currentRepository.headBranchName ?? 'main'
		};
	}
```
- 为什么是问题：`commitAndPushChanges`（第 99–108 行）只调用 `repoInfo()`，在活动仓库上 `createBranch` 后 `commit(..., { all: true })` 并推送，再切回原分支。`delegate`（`copilotCloudSessionsProvider.ts` 第 1665–1696 行）创建会话时用的是 `getRepoId` 的第一个仓库，或 `sessionRepositoryMap` 里选中的 `org/repo`。两边不是同一个仓库时，未提交改动会离开当前工作区，云端任务却在另一个仓库上找这次推送的 `head_ref`。拿不到 Git 扩展对象时，报错文案写的是 `repoIds[0]`，不是实际访问的活动仓库。
- 方向：提交、推送和云端会话必须使用同一个由本次会话选定的仓库。

## r15-2 高
- 症状：CLI 写权限请求既没有文件名也没有可解析的工具路径时，即使用户确认工具会拒绝，写入仍被批准一次。
- 位置：`extensions/copilot/src/extension/chatSessions/copilotcli/node/permissionHelpers.ts` 第 174–181 行
- 引用：
```174:181:extensions/copilot/src/extension/chatSessions/copilotcli/node/permissionHelpers.ts
	const toolParams = await getFileEditConfirmationToolParams(instantiationService, permissionRequest, toolCall, workspaceFolderForFile);
	if (!toolParams) {
		// No confirmation needed (e.g. no file to edit) — auto-approve.
		if (editFile) {
			await trackEditIfNeeded(editTracker, toolCall, editFile, stream, logService);
		}
		return { kind: 'approve-once' };
	}
```
- 为什么是问题：`getFileEditConfirmationToolParams` 在 `getFileBeingEdited` 得不到 URI 时直接返回空（第 374–376 行）。上面把「不需要确认」和「不知道要写哪里」走成同一条批准路径。`permissionHelpers.spec.ts` 第 511–521 行把「no fileName, no toolCall」锁成 `approve-once`，而且该用例的确认工具返回的是拒绝。SDK 仍会按这次 `write` 请求继续写。
- 方向：解析不出目标文件时改为拒绝或弹出确认，不要批准。

## r15-3 高
- 症状：两个会话同时打补丁时，后一次请求会换掉前一次的允许列表和输出流，补丁写进另一个会话。
- 位置：`extensions/copilot/src/extension/tools/node/applyPatchTool.tsx` 第 682–684 行
- 引用：
```682:684:extensions/copilot/src/extension/tools/node/applyPatchTool.tsx
	async resolveInput(input: IApplyPatchToolParams, promptContext: IBuildPromptContext): Promise<IApplyPatchToolParams> {
		this._promptContext = promptContext;
		return input;
	}
```
- 为什么是问题：`ToolsContribution` 把 `ToolsService` 里的同一个 `ApplyPatchTool` 实例注册给 `vscode.lm.registerTool`。`invoke` 在 `await` 构建补丁之后才读 `this._promptContext.allowedEditUris`（第 274 行）和 `this._promptContext.stream`（第 290 行）。确认对话框挂起或另一个聊天同时调用时，`resolveInput` 会覆盖该字段。`lastProcessed`（第 75、215–221、723 行）也只按补丁文本缓存，同文本的另一次请求会拿走按另一份文件内容愈合的结果。
- 方向：把本次请求的上下文和补丁缓存绑在这一次调用上，不要放在工具单例字段里。

## r15-4 中
- 症状：用户没有另选仓库时，已经按当前分支算好的云端基线会被换成该仓库的默认分支。
- 位置：`extensions/copilot/src/extension/chatSessions/vscode-node/copilotCloudSessionsProvider.ts` 第 1669–1682 行
- 引用：
```1669:1682:extensions/copilot/src/extension/chatSessions/vscode-node/copilotCloudSessionsProvider.ts
		const [selectedRepoOwner, selectedRepoName] = (selectedRepository && selectedRepository !== DEFAULT_REPOSITORY_ID) ? selectedRepository.split('/') : [];
		if (!base_ref || repoOwner !== selectedRepoOwner || repoName !== selectedRepoName) {
			if (selectedRepoOwner && selectedRepoName) {
				repoOwner = selectedRepoOwner;
				repoName = selectedRepoName;
			} else {
				if (!repoId) {
					throw new Error(vscode.l10n.t('Open a GitHub repository to use the cloud agent.'));
				}
				repoOwner = repoId.org;
				repoName = repoId.repo;
			}
			const { default_branch } = await this._githubRepositoryService.getRepositoryInfo(repoOwner, repoName);
			base_ref = default_branch;
		}
```
- 为什么是问题：新建会话把仓库选项写成 `DEFAULT_REPOSITORY_ID`（第 1546–1548 行）。这个哨兵不会拆出 owner/repo，于是 `repoOwner !== selectedRepoOwner` 恒为真，`checkBaseBranchPresentOnRemote` 返回的当前分支被丢掉，`base_ref` 改成 GitHub 默认分支。用户刚选择推送当前分支后，云端任务仍从默认分支起。
- 方向：只有选中的仓库和计算 `base_ref` 的仓库不是同一个时才改基线；默认哨兵应视为「当前仓库」。

## r15-5 中
- 症状：用户取消笔记本补丁后，改写仍继续，并把编辑提交到响应流。
- 位置：`extensions/copilot/src/extension/tools/node/applyPatchTool.tsx` 第 168–176 行
- 引用：
```168:176:extensions/copilot/src/extension/tools/node/applyPatchTool.tsx
		await processFullRewriteNotebook(altDoc.document, newContent, {
			notebookEdit(_, notebookEdits) {
				edits.push(...(Array.isArray(notebookEdits) ? notebookEdits : [notebookEdits]));
			},
			textEdit(target, textEdits) {
				textEdits = Array.isArray(textEdits) ? textEdits : [textEdits];
				edits.push([target, textEdits]);
			},
		}, this.alternativeNotebookEditGenerator, telemetryOptions, CancellationToken.None);
```
- 为什么是问题：`invoke` 收到的取消令牌没有传给 `processFullRewriteNotebook`。该函数会在 `token.isCancellationRequested` 时停（`alternativeContentEditGenerator.ts` 第 181 行），`CancellationToken.None` 让它停不下来。返回后第 400–410 行把这些编辑 `notebookEdit` / `textEdit` 推进流，中间不再看 `invoke` 的令牌。
- 方向：把本次 `invoke` 的取消令牌传到笔记本改写，并在写入响应流前再检查一次。
