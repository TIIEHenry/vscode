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
import { GitHubFileSystemProvider } from '../../browser/githubFileSystemProvider.js';

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

	function treeBody(truncated: boolean) {
		return {
			sha: 'rootsha',
			url: 'https://api.github.com/repos/acme/widgets/git/trees/main',
			truncated,
			tree: [{
				path: 'src/app.ts',
				mode: '100644',
				type: 'blob',
				sha: 'blobsha',
				size: 5,
				url: 'https://api.github.com/repos/acme/widgets/git/blobs/blobsha',
			}],
		};
	}

	function createProvider(truncated: boolean): { provider: GitHubFileSystemProvider; treeFetchCount: () => number } {
		let treeFetches = 0;
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
					return jsonResponse(treeBody(truncated));
				}
				if (url.includes('/git/blobs/blobsha')) {
					return jsonResponse({ content: 'aGVsbG8=', encoding: 'base64' });
				}
				throw new Error(`unexpected url ${url}`);
			},
		} as unknown as IRequestService);
		return {
			provider: store.add(instantiationService.createInstance(GitHubFileSystemProvider)),
			treeFetchCount: () => treeFetches,
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

	test('truncated tree is remembered and listings are unavailable', async () => {
		const { provider, treeFetchCount } = createProvider(true);

		await assertUnavailableTruncated(provider.readdir(root));
		await assertUnavailableTruncated(provider.readdir(child('src')));
		await assertUnavailableTruncated(provider.stat(root));
		await assertUnavailableTruncated(provider.stat(child('src')));
		await assertUnavailableTruncated(provider.stat(child('missing.ts')));
		await assertUnavailableTruncated(provider.readFile(child('missing.ts')));

		const stat = await provider.stat(child('src/app.ts'));
		assert.strictEqual(stat.type, FileType.File);
		assert.strictEqual(stat.size, 5);

		const bytes = await provider.readFile(child('src/app.ts'));
		assert.strictEqual(new TextDecoder().decode(bytes), 'hello');
		assert.strictEqual(treeFetchCount(), 1);
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

		assert.strictEqual(treeFetchCount(), 1);
	});
});
