/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, suite, test } from 'vitest';
import * as vscode from 'vscode';
import { Event } from '../../../../util/vs/base/common/event';
import { DisposableStore } from '../../../../util/vs/base/common/lifecycle';
import { URI } from '../../../../util/vs/base/common/uri';
import { IInstantiationService } from '../../../../util/vs/platform/instantiation/common/instantiation';
import { IGitExtensionService } from '../../common/gitExtensionService';
import { createPlatformServices } from '../../../test/node/services';
import { GitServiceImpl } from '../gitServiceImpl';
import { API, Repository } from '../../vscode/git';

const FETCH_URL = 'https://example.com/owner/repo.git';
const DECOY_URL = 'https://example.com/decoy/not-this.git';
const OPEN_REPOSITORY_URL = 'https://github.com/open/repo.git';

class StubGitExtensionService implements IGitExtensionService {
	declare readonly _serviceBrand: undefined;

	constructor(private readonly api: API | undefined) { }

	onDidChange = Event.None;
	extensionAvailable = !!this.api;

	getExtensionApi(): API | undefined {
		return this.api;
	}
}

function createGitApi(options: {
	getRepository: (uri: URI) => Repository | null;
	getRepositoryRoot?: (uri: URI) => Promise<URI | null>;
}): API {
	return {
		state: 'initialized',
		onDidChangeState: Event.None,
		onDidPublish: Event.None,
		git: {} as API['git'],
		repositories: [],
		recentRepositories: [],
		onDidOpenRepository: Event.None,
		onDidCloseRepository: Event.None,
		getRepository: (uri: URI) => options.getRepository(uri),
		getRepositoryRoot: (uri: URI) => options.getRepositoryRoot?.(uri) ?? Promise.resolve(null),
	} as API;
}

function remoteConfig(url: string): string {
	return `[remote "origin"]\n\turl = ${url}\n`;
}

function writeText(root: string, relativePath: string, contents: string): void {
	const fullPath = join(root, relativePath);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, contents, 'utf8');
}

suite('GitServiceImpl.getRepositoryFetchUrls', () => {
	let disposables: DisposableStore;
	let tempRoot: string;
	let fsReadCount: number;
	let previousWorkspace: unknown;

	beforeEach(() => {
		disposables = new DisposableStore();
		tempRoot = mkdtempSync(join(tmpdir(), 'git-fetch-urls-'));
		fsReadCount = 0;
		previousWorkspace = (vscode as { workspace?: unknown }).workspace;
		(vscode as { workspace: unknown }).workspace = {
			fs: {
				stat: async (resource: { fsPath: string }) => {
					const fileStat = await stat(resource.fsPath);
					return {
						type: fileStat.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
						ctime: fileStat.ctimeMs,
						mtime: fileStat.mtimeMs,
						size: fileStat.size,
					};
				},
				readFile: async (resource: { fsPath: string }) => {
					fsReadCount++;
					return readFile(resource.fsPath);
				},
			},
		};
	});

	afterEach(() => {
		disposables.dispose();
		rmSync(tempRoot, { recursive: true, force: true });
		(vscode as { workspace: unknown }).workspace = previousWorkspace;
	});

	function createService(api: API): GitServiceImpl {
		const services = createPlatformServices(disposables);
		services.define(IGitExtensionService, new StubGitExtensionService(api));
		const accessor = disposables.add(services.createTestingAccessor());
		return disposables.add(accessor.get(IInstantiationService).createInstance(GitServiceImpl));
	}

	function unopenedRoot(repoDir: string): { rootUri: URI; api: API } {
		const rootUri = URI.file(repoDir);
		const api = createGitApi({
			getRepository: () => null,
			getRepositoryRoot: async resource => resource.fsPath === rootUri.fsPath ? rootUri : null,
		});
		return { rootUri, api };
	}

	test('reads fetch urls from a gitdir file when the repository is not open', async () => {
		const repoDir = join(tempRoot, 'repo');
		writeText(tempRoot, 'repo/file.txt', '');
		writeText(tempRoot, 'repo/.git', 'gitdir: ../modules/sub\n');
		writeText(tempRoot, 'modules/sub/config', remoteConfig(FETCH_URL));
		const { rootUri, api } = unopenedRoot(repoDir);

		const result = await createService(api).getRepositoryFetchUrls(URI.file(join(repoDir, 'file.txt')));

		assert.strictEqual(result?.rootUri.toString(), rootUri.toString());
		assert.deepStrictEqual(result?.remoteFetchUrls, [FETCH_URL]);
	});

	test('reads fetch urls from the common dir of a gitdir file when the repository is not open', async () => {
		const repoDir = join(tempRoot, 'wt');
		const gitdir = join(tempRoot, 'repo/.git/worktrees/wt');
		writeText(tempRoot, 'wt/file.txt', '');
		writeText(tempRoot, 'wt/.git', `gitdir: ${gitdir}\n`);
		writeText(tempRoot, 'repo/.git/worktrees/wt/commondir', '../..\n');
		writeText(tempRoot, 'repo/.git/worktrees/wt/config', remoteConfig(DECOY_URL));
		writeText(tempRoot, 'repo/.git/config', remoteConfig(FETCH_URL));
		const { rootUri, api } = unopenedRoot(repoDir);

		const result = await createService(api).getRepositoryFetchUrls(URI.file(join(repoDir, 'file.txt')));

		assert.strictEqual(result?.rootUri.toString(), rootUri.toString());
		assert.deepStrictEqual(result?.remoteFetchUrls, [FETCH_URL]);
	});

	test('reads fetch urls from .git/config when .git is a directory and the repository is not open', async () => {
		const repoDir = join(tempRoot, 'repo');
		writeText(tempRoot, 'repo/file.txt', '');
		writeText(tempRoot, 'repo/.git/config', remoteConfig(FETCH_URL));
		const { rootUri, api } = unopenedRoot(repoDir);

		const result = await createService(api).getRepositoryFetchUrls(URI.file(join(repoDir, 'file.txt')));

		assert.strictEqual(result?.rootUri.toString(), rootUri.toString());
		assert.deepStrictEqual(result?.remoteFetchUrls, [FETCH_URL]);
	});

	test('returns an empty remote list when the repository root is known but config cannot be read', async () => {
		const repoDir = join(tempRoot, 'repo');
		writeText(tempRoot, 'repo/file.txt', '');
		writeText(tempRoot, 'repo/.git', 'gitdir: ../missing\n');
		const { rootUri, api } = unopenedRoot(repoDir);

		const result = await createService(api).getRepositoryFetchUrls(URI.file(join(repoDir, 'file.txt')));

		assert.ok(result);
		assert.strictEqual(result.rootUri.toString(), rootUri.toString());
		assert.deepStrictEqual(result.remoteFetchUrls, []);
	});

	test('returns undefined when no repository root can be resolved', async () => {
		const repoDir = join(tempRoot, 'loose');
		writeText(tempRoot, 'loose/file.txt', '');
		let sawRootLookup = false;
		const api = createGitApi({
			getRepository: () => null,
			getRepositoryRoot: async () => {
				sawRootLookup = true;
				return null;
			},
		});

		const result = await createService(api).getRepositoryFetchUrls(URI.file(join(repoDir, 'file.txt')));

		assert.strictEqual(sawRootLookup, true);
		assert.strictEqual(result, undefined);
	});

	test('uses open repository remotes without reading git config', async () => {
		const repoDir = join(tempRoot, 'repo');
		writeText(tempRoot, 'repo/file.txt', '');
		writeText(tempRoot, 'repo/.git/config', remoteConfig(DECOY_URL));
		const rootUri = URI.file(repoDir);
		const repository = {
			rootUri,
			state: {
				HEAD: { name: 'main', commit: 'abc' },
				remotes: [{ fetchUrl: OPEN_REPOSITORY_URL }],
				onDidChange: Event.None,
			},
		} as unknown as Repository;
		const api = createGitApi({
			getRepository: () => repository,
			getRepositoryRoot: async () => {
				assert.fail('open repositories are answered from repository.state.remotes');
			},
		});

		const result = await createService(api).getRepositoryFetchUrls(URI.file(join(repoDir, 'file.txt')));

		assert.strictEqual(fsReadCount, 0);
		assert.strictEqual(result?.rootUri.toString(), rootUri.toString());
		assert.deepStrictEqual(result?.remoteFetchUrls, [OPEN_REPOSITORY_URL]);
	});
});
