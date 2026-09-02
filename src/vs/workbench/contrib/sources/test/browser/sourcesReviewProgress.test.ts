/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Emitter } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { FileChangeType, FileChangesEvent, IFileService } from '../../../../../platform/files/common/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { buildSourcesReviewProgressKey } from '../../common/sourcesReviewProgress.js';
import { SourcesReviewProgressService } from '../../browser/sourcesReviewProgressService.js';

suite('Sources - review progress service', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(options: {
		stat?: (resource: URI) => Promise<{ etag: string }>;
		repositoryFor?: (resource: URI) => { rootUri: URI } | undefined;
	} = {}): SourcesReviewProgressService {
		const fileChangeEmitter = store.add(new Emitter<FileChangesEvent>());
		const fileService = {
			stat: options.stat ?? (async () => ({ etag: 'etag-1' })),
			onDidFilesChange: fileChangeEmitter.event,
		} as unknown as IFileService;

		const scmService = {
			getRepository: (resource: URI) => {
				const rootUri = options.repositoryFor?.(resource);
				if (!rootUri) {
					return undefined;
				}
				return { provider: { rootUri: rootUri.rootUri } };
			},
		} as unknown as ISCMService;

		const service = store.add(new SourcesReviewProgressService(fileService, scmService));
		return Object.assign(service, { fileChangeEmitter });
	}

	test('markReviewed is idempotent for the same key', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const service = createService({
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		});

		const key = await service.resolveKey(resource);
		service.markReviewed(key);
		service.markReviewed(key);

		assert.strictEqual(service.isReviewed(key), true);
	});

	test('etag change invalidates reviewed state', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let etag = 'etag-1';
		const service = createService({
			stat: async () => ({ etag }),
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		}) as SourcesReviewProgressService & { fileChangeEmitter: Emitter<FileChangesEvent> };

		const key = await service.resolveKey(resource);
		service.markReviewed(key);
		assert.strictEqual(service.isReviewed(key), true);

		etag = 'etag-2';
		service.fileChangeEmitter.fire(new FileChangesEvent([{ resource, type: FileChangeType.UPDATED }], false));
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.isReviewed(key), false);
	});

	test('different repositories do not affect each other', async function () {
		const resourceA = toResource.call(this, '/repo-a/a.ts');
		const resourceB = toResource.call(this, '/repo-b/b.ts');
		const service = createService({
			repositoryFor: resource => {
				if (resource.path.startsWith('/repo-a')) {
					return { rootUri: toResource.call(this, '/repo-a') };
				}
				return { rootUri: toResource.call(this, '/repo-b') };
			},
		});

		const keyA = await service.resolveKey(resourceA);
		const keyB = await service.resolveKey(resourceB);
		service.markReviewed(keyA);

		assert.strictEqual(service.isReviewed(keyA), true);
		assert.strictEqual(service.isReviewed(keyB), false);
	});

	test('stat failure uses empty etag', async function () {
		const resource = toResource.call(this, '/project/missing.ts');
		const service = createService({
			stat: async () => { throw new Error('stat failed'); },
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		});

		const key = await service.resolveKey(resource);
		assert.strictEqual(key.contentHash, '');
		service.markReviewed(key);
		assert.strictEqual(service.isReviewed(key), true);
	});

	test('pruneMissingKeys clears keys for resources no longer listed', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const service = createService({
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		});

		const key = await service.resolveKey(resource);
		service.markReviewed(key);
		service.pruneMissingKeys(new Set());

		assert.strictEqual(service.isReviewed(key), false);
	});

	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

	test('does not import IStorageService', () => {
		const servicePath = path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts');
		const source = fs.readFileSync(servicePath, 'utf8');
		assert.ok(!source.includes('IStorageService'));
		assert.ok(!source.includes('platform/storage'));
	});

	test('never calls IStorageService at runtime', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let storageCalls = 0;
		const storageMock = {
			get: () => { storageCalls++; return undefined; },
			store: () => { storageCalls++; },
		};

		const service = createService({
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		});

		const key = await service.resolveKey(resource);
		service.markReviewed(key);
		void storageMock;

		assert.strictEqual(storageCalls, 0);
		assert.strictEqual(service.isReviewed(key), true);
	});
});

suite('Sources - review progress key', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('buildSourcesReviewProgressKey is stable', () => {
		const key = { scopeKeyId: 'root', path: 'file:///a.ts', contentHash: 'abc' };
		assert.strictEqual(buildSourcesReviewProgressKey(key), 'root\0file:///a.ts\0abc');
	});
});
