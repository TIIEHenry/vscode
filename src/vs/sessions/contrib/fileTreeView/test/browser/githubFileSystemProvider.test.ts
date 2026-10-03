/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { bufferToStream, VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { IRequestContext, IRequestOptions } from '../../../../../base/parts/request/common/request.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileSystemProviderErrorCode, FileType, toFileSystemProviderErrorCode } from '../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { IAuthenticationService } from '../../../../../workbench/services/authentication/common/authentication.js';
import { GITHUB_REMOTE_FILE_SCHEME } from '../../../../services/sessions/common/session.js';
import { getGitHubRemoteFileDisplayName, GitHubFileSystemProvider } from '../../browser/githubFileSystemProvider.js';

suite('GitHubFileSystemProvider', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const root = URI.from({ scheme: GITHUB_REMOTE_FILE_SCHEME, authority: 'github', path: '/acme/widgets/main' });

	function child(path: string): URI {
		return URI.from({ scheme: GITHUB_REMOTE_FILE_SCHEME, authority: 'github', path: `/acme/widgets/main/${path}` });
	}

	function jsonResponse(data: unknown, statusCode = 200): IRequestContext {
		return {
			res: { statusCode, headers: {} },
			stream: bufferToStream(VSBuffer.fromString(JSON.stringify(data))),
		};
	}

	type GitHubTreeFixtureEntry = {
		path: string;
		mode: string;
		type: 'blob' | 'tree' | 'commit';
		sha: string;
		size?: number;
		url: string;
	};

	const appTsEntry: GitHubTreeFixtureEntry = {
		path: 'src/app.ts',
		mode: '100644',
		type: 'blob',
		sha: 'blobsha',
		size: 5,
		url: 'https://api.github.com/repos/acme/widgets/git/blobs/blobsha',
	};

	function treeBody(truncated: boolean, tree: readonly GitHubTreeFixtureEntry[] = [appTsEntry], sha = 'rootsha') {
		return {
			sha,
			url: 'https://api.github.com/repos/acme/widgets/git/trees/main',
			truncated,
			tree,
		};
	}

	function createProvider(truncated: boolean, tree?: readonly GitHubTreeFixtureEntry[], blobs?: Readonly<Record<string, string>>, trees?: (url: string) => { sha: string; truncated: boolean; tree: readonly GitHubTreeFixtureEntry[] }): { provider: GitHubFileSystemProvider; treeFetchCount: () => number; treeUrls: () => readonly string[] } {
		let treeFetches = 0;
		const treeUrls: string[] = [];
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IAuthenticationService, {
			getSessions: async () => [{ accessToken: 'token' }],
		} as unknown as IAuthenticationService);
		instantiationService.stub(IRequestService, {
			request: async (options: IRequestOptions) => {
				const url = options.url ?? '';
				if (url.includes('/git/trees/')) {
					treeFetches++;
					treeUrls.push(url);
					if (trees) {
						const body = trees(url);
						return jsonResponse(treeBody(body.truncated, body.tree, body.sha));
					}
					return jsonResponse(treeBody(truncated, tree));
				}
				const blobSha = url.match(/\/git\/blobs\/([^/?]+)/)?.[1];
				if (blobSha === 'blobsha') {
					return jsonResponse({ content: 'aGVsbG8=', encoding: 'base64' });
				}
				if (blobSha && blobs && Object.prototype.hasOwnProperty.call(blobs, blobSha)) {
					return jsonResponse({ content: blobs[blobSha], encoding: 'base64' });
				}
				throw new Error(`unexpected url ${url}`);
			},
		} as unknown as IRequestService);
		return {
			provider: store.add(instantiationService.createInstance(GitHubFileSystemProvider)),
			treeFetchCount: () => treeFetches,
			treeUrls: () => treeUrls,
		};
	}

	async function assertUnavailableTruncated(promise: Promise<unknown>): Promise<void> {
		let thrown: unknown;
		try {
			await promise;
		} catch (err) {
			thrown = err;
		}
		if (!(thrown instanceof Error)) {
			assert.fail('expected truncated tree to be unavailable');
		}
		assert.strictEqual(toFileSystemProviderErrorCode(thrown), FileSystemProviderErrorCode.Unavailable);
		assert.match(thrown.message, /truncated/);
	}

	async function assertFileNotFound(promise: Promise<unknown>): Promise<void> {
		let thrown: unknown;
		try {
			await promise;
		} catch (err) {
			thrown = err;
		}
		if (!(thrown instanceof Error)) {
			assert.fail('expected FileNotFound');
		}
		assert.strictEqual(toFileSystemProviderErrorCode(thrown), FileSystemProviderErrorCode.FileNotFound);
		assert.strictEqual(thrown.message, 'File not found');
	}

	async function assertUnreadable(promise: Promise<unknown>, message: string): Promise<void> {
		let thrown: unknown;
		try {
			await promise;
		} catch (err) {
			thrown = err;
		}
		if (!(thrown instanceof Error)) {
			assert.fail(`expected ${message}`);
		}
		assert.strictEqual(toFileSystemProviderErrorCode(thrown), FileSystemProviderErrorCode.Unknown);
		assert.strictEqual(thrown.message, message);
	}

	test('truncated tree is remembered and listings are unavailable', async () => {
		const { provider, treeFetchCount } = createProvider(true);

		await assertUnavailableTruncated(provider.readdir(root));
		await assertUnavailableTruncated(provider.readdir(child('src')));
		await assertUnavailableTruncated(provider.readdir(child('missing')));
		await assertUnavailableTruncated(provider.stat(root));
		await assertUnavailableTruncated(provider.stat(child('src')));
		await assertUnavailableTruncated(provider.stat(child('missing.ts')));
		await assertUnavailableTruncated(provider.readFile(child('missing.ts')));

		const stat = await provider.stat(child('src/app.ts'));
		assert.strictEqual(stat.type, FileType.File);
		assert.strictEqual(stat.size, 5);

		const bytes = await provider.readFile(child('src/app.ts'));
		assert.strictEqual(new TextDecoder().decode(bytes), 'hello');
		// Recursive discovery, then one non-recursive directory page. Both stay cached.
		assert.strictEqual(treeFetchCount(), 2);
	});

	test('truncated recursive tree is listed one directory at a time', async () => {
		const srcDir: GitHubTreeFixtureEntry = {
			path: 'src',
			mode: '040000',
			type: 'tree',
			sha: 'srcsha',
			url: 'https://api.github.com/repos/acme/widgets/git/trees/srcsha',
		};
		const readme: GitHubTreeFixtureEntry = {
			path: 'README.md',
			mode: '100644',
			type: 'blob',
			sha: 'readmesha',
			size: 3,
			url: 'https://api.github.com/repos/acme/widgets/git/blobs/readmesha',
		};
		const other: GitHubTreeFixtureEntry = {
			path: 'other.ts',
			mode: '100644',
			type: 'blob',
			sha: 'othersha',
			size: 4,
			url: 'https://api.github.com/repos/acme/widgets/git/blobs/othersha',
		};
		const { provider, treeFetchCount, treeUrls } = createProvider(true, [appTsEntry], {
			readmesha: 'aGkh',
			othersha: 'bm90ZQ==',
		}, url => {
			if (url.includes('recursive=1')) {
				// Partial recursive page omits README.md and src/other.ts.
				return { sha: 'rootsha', truncated: true, tree: [appTsEntry] };
			}
			if (url.includes('/git/trees/srcsha')) {
				return {
					sha: 'srcsha',
					truncated: false,
					tree: [
						{ path: 'app.ts', mode: '100644', type: 'blob', sha: 'blobsha', size: 5, url: appTsEntry.url },
						other,
					],
				};
			}
			return { sha: 'rootsha', truncated: false, tree: [srcDir, readme] };
		});

		assert.strictEqual(new TextDecoder().decode(await provider.readFile(child('src/other.ts'))), 'note');
		assert.deepStrictEqual(await provider.readdir(root), [
			['src', FileType.Directory],
			['README.md', FileType.File],
		]);
		assert.deepStrictEqual(await provider.readdir(child('src')), [
			['app.ts', FileType.File],
			['other.ts', FileType.File],
		]);
		assert.strictEqual(new TextDecoder().decode(await provider.readFile(child('README.md'))), 'hi!');
		assert.strictEqual(new TextDecoder().decode(await provider.readFile(child('src/app.ts'))), 'hello');

		const rootStat = await provider.stat(root);
		assert.strictEqual(rootStat.type, FileType.Directory);
		await assertFileNotFound(provider.stat(child('missing.ts')));
		await assertFileNotFound(provider.readdir(child('missing')));
		await assertFileNotFound(provider.readdir(child('src/nope')));
		await assertFileNotFound(provider.readdir(child('src/app.ts')));

		const urls = treeUrls();
		assert.ok(urls.some(url => url.includes('/git/trees/main?recursive=1')));
		assert.ok(urls.some(url => url.includes('/git/trees/rootsha') && !url.includes('recursive=1')));
		assert.ok(urls.some(url => url.includes('/git/trees/srcsha')));
		const fetches = treeFetchCount();
		await provider.readdir(root);
		await provider.readdir(child('src'));
		assert.strictEqual(treeFetchCount(), fetches);
	});

	test('complete tree is listed and cached', async () => {
		const { provider, treeFetchCount } = createProvider(false);

		assert.deepStrictEqual(await provider.readdir(root), [['src', FileType.Directory]]);
		assert.deepStrictEqual(await provider.readdir(child('src')), [['app.ts', FileType.File]]);

		const stat = await provider.stat(child('src/app.ts'));
		assert.strictEqual(stat.type, FileType.File);
		assert.strictEqual(stat.size, 5);

		let missing: unknown;
		try {
			await provider.stat(child('missing.ts'));
		} catch (err) {
			missing = err;
		}
		if (!(missing instanceof Error)) {
			assert.fail('expected missing file');
		}
		assert.strictEqual(toFileSystemProviderErrorCode(missing), FileSystemProviderErrorCode.FileNotFound);

		await assertFileNotFound(provider.readdir(child('missing')));
		await assertFileNotFound(provider.readdir(child('src/nope')));
		await assertFileNotFound(provider.readdir(child('src/app.ts')));
		await assertFileNotFound(provider.readFile(child('missing.ts')));

		assert.strictEqual(treeFetchCount(), 1);
	});

	test('empty root lists as empty and unknown directories are missing', async () => {
		const { provider, treeFetchCount } = createProvider(false, []);

		assert.deepStrictEqual(await provider.readdir(root), []);
		const rootStat = await provider.stat(root);
		assert.strictEqual(rootStat.type, FileType.Directory);

		await assertFileNotFound(provider.readdir(child('src')));
		await assertFileNotFound(provider.readFile(child('missing.ts')));
		assert.strictEqual(treeFetchCount(), 1);
	});

	test('known empty directory lists as empty', async () => {
		const { provider } = createProvider(false, [{
			path: 'empty',
			mode: '040000',
			type: 'tree',
			sha: 'emptysha',
			url: 'https://api.github.com/repos/acme/widgets/git/trees/emptysha',
		}]);

		assert.deepStrictEqual(await provider.readdir(root), [['empty', FileType.Directory]]);
		assert.deepStrictEqual(await provider.readdir(child('empty')), []);
		await assertFileNotFound(provider.readdir(child('empty/nope')));
	});

	test('submodule and symlink are listed but not read as blobs', async () => {
		const { provider, treeFetchCount } = createProvider(false, [
			appTsEntry,
			{
				path: 'vendor/lib',
				mode: '160000',
				type: 'commit',
				sha: 'commitsha',
				url: 'https://api.github.com/repos/acme/other/git/commits/commitsha',
			},
			{
				path: 'docs/alias',
				mode: '120000',
				type: 'blob',
				sha: 'linksha',
				size: 11,
				url: 'https://api.github.com/repos/acme/widgets/git/blobs/linksha',
			},
		]);

		assert.deepStrictEqual(await provider.readdir(root), [
			['src', FileType.Directory],
			['vendor', FileType.Directory],
			['docs', FileType.Directory],
		]);
		assert.deepStrictEqual(await provider.readdir(child('vendor')), [['lib', FileType.Unknown]]);
		assert.deepStrictEqual(await provider.readdir(child('docs')), [['alias', FileType.SymbolicLink]]);

		const submodule = await provider.stat(child('vendor/lib'));
		assert.strictEqual(submodule.type, FileType.Unknown);
		assert.strictEqual(submodule.size, 0);

		const link = await provider.stat(child('docs/alias'));
		assert.strictEqual(link.type, FileType.SymbolicLink);
		assert.strictEqual(link.size, 11);

		await assertFileNotFound(provider.readdir(child('vendor/lib')));
		await assertFileNotFound(provider.readdir(child('docs/alias')));
		await assertUnreadable(provider.readFile(child('vendor/lib')), 'Submodule is not file content');
		await assertUnreadable(provider.readFile(child('docs/alias')), 'Symbolic link is not a blob');

		const bytes = await provider.readFile(child('src/app.ts'));
		assert.strictEqual(new TextDecoder().decode(bytes), 'hello');
		assert.strictEqual(treeFetchCount(), 1);
	});

	test('truncated tree still rejects listings when it contains a submodule and symlink', async () => {
		const { provider, treeFetchCount } = createProvider(true, [
			appTsEntry,
			{
				path: 'vendor/lib',
				mode: '160000',
				type: 'commit',
				sha: 'commitsha',
				url: 'https://api.github.com/repos/acme/other/git/commits/commitsha',
			},
			{
				path: 'docs/alias',
				mode: '120000',
				type: 'blob',
				sha: 'linksha',
				size: 11,
				url: 'https://api.github.com/repos/acme/widgets/git/blobs/linksha',
			},
		]);

		await assertUnavailableTruncated(provider.readdir(root));
		await assertUnavailableTruncated(provider.readdir(child('vendor')));
		await assertUnavailableTruncated(provider.readdir(child('vendor/lib')));
		await assertUnavailableTruncated(provider.stat(child('missing.ts')));
		await assertUnavailableTruncated(provider.readFile(child('missing.ts')));

		const submodule = await provider.stat(child('vendor/lib'));
		assert.strictEqual(submodule.type, FileType.Unknown);
		const link = await provider.stat(child('docs/alias'));
		assert.strictEqual(link.type, FileType.SymbolicLink);

		await assertUnreadable(provider.readFile(child('vendor/lib')), 'Submodule is not file content');
		await assertUnreadable(provider.readFile(child('docs/alias')), 'Symbolic link is not a blob');

		const bytes = await provider.readFile(child('src/app.ts'));
		assert.strictEqual(new TextDecoder().decode(bytes), 'hello');
		assert.strictEqual(treeFetchCount(), 2);
	});

	test('literal percent in a file name is not another path', async () => {
		const { provider, treeFetchCount } = createProvider(false, [
			{
				path: 'a%2Fb.txt',
				mode: '100644',
				type: 'blob',
				sha: 'percentsha',
				size: 7,
				url: 'https://api.github.com/repos/acme/widgets/git/blobs/percentsha',
			},
			{
				path: 'a/b.txt',
				mode: '100644',
				type: 'blob',
				sha: 'nestedsha',
				size: 6,
				url: 'https://api.github.com/repos/acme/widgets/git/blobs/nestedsha',
			},
			{
				path: '100%',
				mode: '040000',
				type: 'tree',
				sha: 'percentdir',
				url: 'https://api.github.com/repos/acme/widgets/git/trees/percentdir',
			},
			{
				path: '100%/note.ts',
				mode: '100644',
				type: 'blob',
				sha: 'notesha',
				size: 4,
				url: 'https://api.github.com/repos/acme/widgets/git/blobs/notesha',
			},
		], {
			percentsha: 'bGl0ZXJhbA==',
			nestedsha: 'bmVzdGVk',
			notesha: 'bm90ZQ==',
		});

		assert.deepStrictEqual(await provider.readdir(root), [
			['a%2Fb.txt', FileType.File],
			['a', FileType.Directory],
			['100%', FileType.Directory],
		]);
		assert.deepStrictEqual(await provider.readdir(child('a')), [['b.txt', FileType.File]]);
		assert.deepStrictEqual(await provider.readdir(child('100%')), [['note.ts', FileType.File]]);

		const literal = await provider.stat(child('a%2Fb.txt'));
		assert.strictEqual(literal.type, FileType.File);
		assert.strictEqual(literal.size, 7);
		const nested = await provider.stat(child('a/b.txt'));
		assert.strictEqual(nested.size, 6);

		assert.strictEqual(new TextDecoder().decode(await provider.readFile(child('a%2Fb.txt'))), 'literal');
		assert.strictEqual(new TextDecoder().decode(await provider.readFile(child('a/b.txt'))), 'nested');
		assert.strictEqual(new TextDecoder().decode(await provider.readFile(child('100%/note.ts'))), 'note');
		assert.strictEqual(treeFetchCount(), 1);
	});

	test('encoded slash in the ref stays one segment', async () => {
		const slashRef = URI.from({ scheme: GITHUB_REMOTE_FILE_SCHEME, authority: 'github', path: '/acme/widgets/feature%2Ffoo' });
		const { provider, treeUrls } = createProvider(false, []);

		assert.deepStrictEqual(await provider.readdir(slashRef), []);
		assert.strictEqual(treeUrls().length, 1);
		assert.ok(treeUrls()[0].includes('/git/trees/feature%2Ffoo?recursive=1'));
		assert.ok(!treeUrls()[0].includes('%252F'));

		assert.strictEqual(getGitHubRemoteFileDisplayName(slashRef), 'widgets (feature/foo)');
		assert.strictEqual(
			getGitHubRemoteFileDisplayName(URI.from({ scheme: GITHUB_REMOTE_FILE_SCHEME, authority: 'github', path: '/acme/widgets/100%' })),
			'widgets (100%)',
		);
	});
});
