/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { IGitExtensionService } from '../../../../platform/git/common/gitExtensionService';
import { IGitService, RepoContext } from '../../../../platform/git/common/gitService';
import { API, Repository } from '../../../../platform/git/vscode/git';
import { TestLogService } from '../../../../platform/testing/common/testLogService';
import { mock } from '../../../../util/common/test/simpleMock';
import { URI } from '../../../../util/vs/base/common/uri';
import { CopilotCloudGitOperationsManager } from '../copilotCloudGitOperationsManager';

interface TestRepo {
	readonly context: RepoContext;
	readonly repository: Repository;
	readonly commits: string[];
	readonly pushes: string[];
}

function createRepo(org: string, repo: string, branch: string): TestRepo {
	const rootUri = URI.file(`/workspace/${repo}`);
	const remoteUrl = `https://github.com/${org}/${repo}.git`;
	const commits: string[] = [];
	const pushes: string[] = [];
	const state = {
		HEAD: { name: branch, commit: 'abc', upstream: { remote: 'origin' } },
		remotes: [{ name: 'origin', fetchUrl: remoteUrl }],
		workingTreeChanges: [],
		indexChanges: [],
		onDidChange: () => ({ dispose() { } }),
	};
	const repository = {
		rootUri,
		state,
		commit: vi.fn(async (message: string) => {
			commits.push(message);
			state.HEAD.name = state.HEAD.name === branch ? 'copilot/test' : state.HEAD.name;
		}),
		push: vi.fn(async (remote: string, ref: string) => { pushes.push(`${remote}/${ref}`); }),
		createBranch: vi.fn(async (name: string) => { state.HEAD.name = name; }),
		checkout: vi.fn(async (name: string) => { state.HEAD.name = name; }),
		getRefs: vi.fn(async () => []),
	} as unknown as Repository;
	const context: RepoContext = {
		rootUri,
		kind: 'repository',
		isUsingVirtualFileSystem: false,
		headIncomingChanges: 0,
		headOutgoingChanges: 0,
		headBranchName: branch,
		headCommitHash: 'abc',
		upstreamBranchName: branch,
		upstreamRemote: 'origin',
		isRebasing: false,
		remoteFetchUrls: [remoteUrl],
		remotes: ['origin'],
		worktrees: [],
		changes: undefined,
		headBranchNameObs: undefined!,
		headCommitHashObs: undefined!,
		upstreamBranchNameObs: undefined!,
		upstreamRemoteObs: undefined!,
		isRebasingObs: undefined!,
		isIgnored: async () => false,
	};
	return { context, repository, commits, pushes };
}

function createManager(repos: TestRepo[], active: TestRepo | undefined, failGetRepositoryFor?: string) {
	const gitService = new class extends mock<IGitService>() {
		override readonly repositories = repos.map(r => r.context);
		override readonly activeRepository = { get: () => active?.context } as IGitService['activeRepository'];
		override readonly initialize = async () => { };
	}();
	const gitExtensionService = new class extends mock<IGitExtensionService>() {
		override getExtensionApi(): API | undefined {
			return {
				getRepository: (uri: vscode.Uri) => {
					const repo = repos.find(r => r.context.rootUri.toString() === uri.toString());
					if (!repo || failGetRepositoryFor === repo.context.rootUri.toString()) {
						return null;
					}
					return repo.repository;
				},
			} as unknown as API;
		}
	}();
	return new CopilotCloudGitOperationsManager(new TestLogService(), gitService, gitExtensionService);
}

describe('CopilotCloudGitOperationsManager', () => {
	it('commits and pushes the active repository when it is not the first repository', async () => {
		const first = createRepo('microsoft', 'vscode', 'main');
		const active = createRepo('microsoft', 'typescript', 'feature/active');
		const manager = createManager([first, active], active);

		const branch = await manager.commitAndPushChanges();

		expect({
			repoId: (await manager.repoInfo()).repoId?.toString(),
			activeCommits: active.commits.length,
			firstCommits: first.commits.length,
			pushedTo: active.pushes.map(p => p.split('/')[0]),
			branch,
		}).toEqual({
			repoId: 'microsoft/typescript',
			activeCommits: 1,
			firstCommits: 0,
			pushedTo: ['origin'],
			branch: expect.stringMatching(/^copilot\//),
		});
	});

	it('commits and pushes the selected repository without touching the active one', async () => {
		const first = createRepo('microsoft', 'vscode', 'main');
		const selected = createRepo('microsoft', 'typescript', 'feature/selected');
		const manager = createManager([first, selected], first);

		await manager.commitAndPushChanges('microsoft/typescript');

		expect({
			firstCommits: first.commits.length,
			selectedCommits: selected.commits.length,
			selectedPushes: selected.pushes.length,
		}).toEqual({ firstCommits: 0, selectedCommits: 1, selectedPushes: 1 });
	});

	it('reports the requested repository when its local checkout cannot be accessed', async () => {
		const first = createRepo('microsoft', 'vscode', 'main');
		const selected = createRepo('microsoft', 'typescript', 'main');
		const manager = createManager([first, selected], first, selected.context.rootUri.toString());

		await expect(manager.commitAndPushChanges('microsoft/typescript')).rejects.toThrow('microsoft/typescript');
		expect(first.commits).toEqual([]);
	});
});
