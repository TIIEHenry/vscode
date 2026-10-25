/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IGitExtensionService } from '../../../platform/git/common/gitExtensionService';
import { IGitService, RepoContext } from '../../../platform/git/common/gitService';
import { Repository } from '../../../platform/git/vscode/git';
import { ILogService } from '../../../platform/log/common/logService';
import { getGithubRepoIdFromFetchUrl, GithubRepoId } from '../../../platform/git/common/gitService';

const DEFAULT_REPOSITORY_ID = '___vscode_repository_default___';

export interface GitRepoInfo {
	repository: Repository;
	/** The GitHub identity of `repository`, from its own remote. */
	repoId: GithubRepoId | undefined;
	remoteName: string;
	baseRef: string;
}

export class CopilotCloudGitOperationsManager {
	constructor(
		private readonly logService: ILogService,
		private readonly gitService: IGitService,
		private readonly gitExtensionService: IGitExtensionService
	) { }

	async repoInfo(): Promise<GitRepoInfo> {
		return this.repoInfoFor(undefined);
	}

	/**
	 * Resolves the repository this delegation targets. `selectedRepository` is
	 * either `DEFAULT_REPOSITORY_ID` (the active repository) or `org/repo`.
	 */
	async repoInfoFor(selectedRepository: string | undefined): Promise<GitRepoInfo> {
		// TODO: support selecting remote
		// await this.promptAndUpdatePreferredGitHubRemote(true);
		const wantsSelected = selectedRepository !== undefined && selectedRepository !== DEFAULT_REPOSITORY_ID;
		const [selectedOrg, selectedRepo] = wantsSelected ? selectedRepository.split('/') : [];
		const target = wantsSelected ? `${selectedOrg}/${selectedRepo}` : undefined;

		let currentRepository: RepoContext | undefined;
		let repoId: GithubRepoId | undefined;
		if (wantsSelected) {
			// A selected repository is a promise to the user: only use the local
			// checkout whose remote is that repository, never the active one.
			currentRepository = this.gitService.repositories.find(repository =>
				this._repositoryMatches(repository.remoteFetchUrls, new GithubRepoId(selectedOrg, selectedRepo))
			);
			repoId = currentRepository
				? this._repoIdFromRepository(currentRepository)
				: new GithubRepoId(selectedOrg, selectedRepo);
		} else {
			currentRepository = this.gitService.activeRepository.get();
			repoId = currentRepository ? this._repoIdFromRepository(currentRepository) : undefined;
		}

		if (!currentRepository) {
			throw new Error(target
				? vscode.l10n.t('Unable to access {0}. Please check your permissions and try again.', `\`${target}\``)
				: vscode.l10n.t('No active repository found. Open a GitHub repository to continue with cloud agent.'));
		}

		const git = this.gitExtensionService.getExtensionApi();
		const repo = git?.getRepository(currentRepository.rootUri);
		// Checks if user has permission to access the repository
		if (!repo) {
			throw new Error(
				vscode.l10n.t(
					'Unable to access {0}. Please check your permissions and try again.',
					`\`${target ?? (repoId ? `${repoId.org}/${repoId.repo}` : '')}\``
				)
			);
		}
		return {
			repository: repo,
			repoId: repoId ?? this._repoIdFromRepository(currentRepository),
			remoteName: repo.state.HEAD?.upstream?.remote ?? currentRepository.upstreamRemote ?? repo.state.remotes?.[0]?.name ?? 'origin',
			baseRef: currentRepository.headBranchName ?? 'main'
		};
	}

	private _repoIdFromRepository(repository: RepoContext): GithubRepoId | undefined {
		for (const url of repository.remoteFetchUrls ?? []) {
			const id = url ? getGithubRepoIdFromFetchUrl(url) : undefined;
			if (id) {
				return id;
			}
		}
		return undefined;
	}

	private _repositoryMatches(remoteFetchUrls: readonly (string | undefined)[] | undefined, repoId: GithubRepoId): boolean {
		return (remoteFetchUrls ?? []).some(url => {
			const id = url ? getGithubRepoIdFromFetchUrl(url) : undefined;
			return !!id && id.org.toLowerCase() === repoId.org.toLowerCase() && id.repo.toLowerCase() === repoId.repo.toLowerCase();
		});
	}

	/**
	 * Pushes the current ref to the remote
	 * @returns The name of the pushed branch
	 */
	async pushBaseRefToRemote(selectedRepository?: string): Promise<string> {
		try {
			const { repository, remoteName, baseRef } = await this.repoInfoFor(selectedRepository);
			const expectedRemoteBranch = `${remoteName}/${baseRef}`;
			this.logService.warn(`Base branch '${expectedRemoteBranch}' not found on remote. Pushing...`);
			await repository.push(remoteName, baseRef, true);
			return baseRef;
		} catch (error) {
			this.logService.error(`Failed to push base ref to remote: ${error instanceof Error ? error.message : String(error)}`);
			throw new Error(vscode.l10n.t('Failed to push base branch to remote. Please push the branch manually and try again.'));
		}
	}

	async checkIfRemoteHasRef(repository: Repository, remoteName: string, baseRef: string): Promise<boolean> {
		const remoteBranches =
			(await repository.getBranches({ remote: true }))
				.filter(b => b.remote); // Has an associated remote
		const expectedRemoteBranch = `${remoteName}/${baseRef}`;
		const alternateNames = new Set<string>([
			expectedRemoteBranch,
			`refs/remotes/${expectedRemoteBranch}`,
			baseRef
		]);
		const hasRemoteBranch = remoteBranches.some(branch => {
			if (!branch.name) {
				return false;
			}
			if (branch.remote && branch.remote !== remoteName) {
				return false;
			}
			const candidateName =
				(branch.remote && branch.name.startsWith(branch.remote + '/'))
					? branch.name
					: `${branch.remote}/${branch.name}`;
			return alternateNames.has(candidateName);
		});
		return hasRemoteBranch;
	}

	async commitAndPushChanges(selectedRepository?: string): Promise<string> {
		const { repository, remoteName, baseRef } = await this.repoInfoFor(selectedRepository);
		const asyncBranch = await this.generateRandomBranchName(repository, 'copilot');

		const commitMessage = vscode.l10n.t('Checkpoint from VS Code for cloud agent session');
		try {
			await repository.createBranch(asyncBranch, true);
			await this.performCommit(asyncBranch, repository, commitMessage);
			await repository.push(remoteName, asyncBranch, true);
			await this.switchBackToBaseRef(repository, baseRef, asyncBranch);
			return asyncBranch;
		} catch (error) {
			await this.rollbackToOriginalBranch(repository, baseRef);
			this.logService.error(`Failed to automatically commit and push your changes: ${error instanceof Error ? error.message : String(error)}`);
			throw new Error(vscode.l10n.t('Failed to automatically commit and push your changes. Please commit or stash your changes manually and try again.'));
		}
	}

	private async performCommit(asyncBranch: string, repository: Repository, commitMessage: string): Promise<void> {
		try {
			await repository.commit(commitMessage, { all: true });
			if (repository.state.HEAD?.name !== asyncBranch || repository.state.workingTreeChanges.length > 0 || repository.state.indexChanges.length > 0) {
				throw new Error(vscode.l10n.t('Uncommitted changes still detected.'));
			}
		} catch (error) {
			// TODO: stream.progress('waiting for user to manually commit changes');
			const commitSuccessful = await this.handleInteractiveCommit(repository);
			if (!commitSuccessful) {
				throw new Error(vscode.l10n.t('Failed to commit changes. Please commit or stash your changes manually before using the cloud agent.'));
			}
		}
	}

	private async handleInteractiveCommit(repository: Repository): Promise<boolean> {
		const COMMIT_YOUR_CHANGES = vscode.l10n.t('Commit your changes to continue cloud agent session. Close integrated terminal to cancel.');
		return vscode.window.withProgress({
			title: COMMIT_YOUR_CHANGES,
			cancellable: true,
			location: vscode.ProgressLocation.Notification
		}, async (_, token) => {
			return new Promise<boolean>((resolve) => {
				const startingCommit = repository.state.HEAD?.commit;
				const terminal = vscode.window.createTerminal({
					name: 'GitHub Copilot Cloud Agent',
					cwd: repository.rootUri.fsPath,
					message: `\x1b[1m${COMMIT_YOUR_CHANGES}\x1b[0m`
				});

				terminal.show();

				let disposed = false;
				let timeoutId: TimeoutHandle | undefined = undefined;
				let stateListener: vscode.Disposable | undefined = undefined;
				let disposalListener: vscode.Disposable | undefined = undefined;
				let cancellationListener: vscode.Disposable | undefined = undefined;
				const cleanup = () => {
					if (disposed) {
						return;
					}
					disposed = true;
					clearTimeout(timeoutId);
					stateListener?.dispose();
					disposalListener?.dispose();
					cancellationListener?.dispose();
					terminal.dispose();
				};

				if (token) {
					cancellationListener = token.onCancellationRequested(() => {
						cleanup();
						resolve(false);
					});
				}

				stateListener = repository.state.onDidChange(() => {
					if (repository.state.HEAD?.commit !== startingCommit) {
						cleanup();
						resolve(true);
					}
				});

				timeoutId = setTimeout(() => {
					cleanup();
					resolve(false);
				}, 5 * 60 * 1000);

				disposalListener = vscode.window.onDidCloseTerminal((closedTerminal) => {
					if (closedTerminal === terminal) {
						setTimeout(() => {
							if (!disposed) {
								cleanup();
								resolve(repository.state.HEAD?.commit !== startingCommit);
							}
						}, 1000);
					}
				});
			});
		});
	}

	private async switchBackToBaseRef(repository: Repository, baseRef: string, newRef: string): Promise<void> {
		if (repository.state.HEAD?.name !== baseRef) {
			await repository.checkout(baseRef);
		}
	}

	private async rollbackToOriginalBranch(repository: Repository, baseRef: string): Promise<void> {
		if (repository.state.HEAD?.name !== baseRef) {
			try {
				await repository.checkout(baseRef);
			} catch (error) {
				this.logService.error(`Failed to checkout back to original branch '${baseRef}': ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	private async generateRandomBranchName(repository: Repository, prefix: string): Promise<string> {
		for (let index = 0; index < 5; index++) {
			const randomName = `${prefix}/vscode-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
			try {
				const refs = await repository.getRefs({ pattern: `refs/heads/${randomName}` });
				if (!refs || refs.length === 0) {
					return randomName;
				}
			} catch (error) {
				this.logService.warn(`Failed to check refs for ${randomName}: ${error instanceof Error ? error.message : String(error)}`);
				return randomName;
			}
		}

		return `${prefix}/vscode-${Date.now().toString(36)}`;
	}
}
