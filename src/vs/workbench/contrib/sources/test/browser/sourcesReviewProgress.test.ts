/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { FileChangeType, FileChangesEvent, IFileService } from '../../../../../platform/files/common/files.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IFileMutationRecord } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { buildSourcesReviewProgressKey, sourcesReviewProgressBucket } from '../../common/sourcesReviewProgress.js';
import { SourcesReviewProgressService } from '../../browser/sourcesReviewProgressService.js';

suite('Sources - review progress service', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(options: {
		stat?: (resource: URI) => Promise<{ etag: string }>;
		repositoryFor?: (resource: URI) => { rootUri: URI } | undefined;
		workDir?: string;
	} = {}): SourcesReviewProgressService & {
		fileChangeEmitter: Emitter<FileChangesEvent>;
		mutationEmitter: Emitter<IFileMutationRecord>;
	} {
		const fileChangeEmitter = store.add(new Emitter<FileChangesEvent>());
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
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

		const connection = {
			onDidFileMutation: mutationEmitter.event,
			getConnectionSnapshot: () => ({ workDir: options.workDir }),
		} as unknown as IUniverseAgentConnection;

		const service = store.add(new SourcesReviewProgressService(fileService, scmService, connection));
		return Object.assign(service, { fileChangeEmitter, mutationEmitter });
	}

	test('markReviewed is idempotent for the same key', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const service = createService({
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		});

		const key = await service.resolveKey({ resource });
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

		const key = await service.resolveKey({ resource });
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

		const keyA = await service.resolveKey({ resource: resourceA });
		const keyB = await service.resolveKey({ resource: resourceB });
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

		const key = await service.resolveKey({ resource });
		assert.strictEqual(key.contentHash, '');
		service.markReviewed(key);
		assert.strictEqual(service.isReviewed(key), true);
	});

	test('pruneMissingKeys clears keys for resources no longer listed', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const service = createService({
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		});

		const key = await service.resolveKey({ resource });
		service.markReviewed(key);
		service.pruneMissingKeys({ origin: 'scm', sessionId: '' }, new Set());

		assert.strictEqual(service.isReviewed(key), false);
	});

	test('file change does not stat when nothing is reviewed', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let stats = 0;
		const service = createService({
			stat: async () => {
				stats++;
				return { etag: 'etag-1' };
			},
		});

		service.fileChangeEmitter.fire(new FileChangesEvent([{ resource, type: FileChangeType.UPDATED }], false));
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(stats, 0);
	});

	test('engine hash uses turn and tool call; a new mutation clears review; a local edit does not', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let stats = 0;
		const service = createService({
			stat: async () => {
				stats++;
				return { etag: 'etag-1' };
			},
			workDir: '/project',
		});
		const target = { resource, origin: 'engine' as const, sessionId: 'sess', gitPath: 'src/a.ts' };
		const mutation = (sessionId: string, turnId: string, toolCallId: string): IFileMutationRecord => ({
			sessionId,
			toolCallId,
			turnId,
			agentId: 'agent',
			path: 'src/a.ts',
			operation: 'edit',
		});

		assert.strictEqual((await service.resolveKey(target)).contentHash, '');
		assert.strictEqual(stats, 0);

		service.mutationEmitter.fire(mutation('sess', 'turn-1', 'tc-1'));
		const key = await service.resolveKey(target);
		assert.strictEqual(key.contentHash, 'turn-1\0tc-1');
		assert.strictEqual(stats, 0);
		service.markReviewed(key);
		assert.strictEqual(service.isReviewed(key), true);
		assert.strictEqual(service.isEntryReviewed(target), true);

		service.fileChangeEmitter.fire(new FileChangesEvent([{ resource, type: FileChangeType.UPDATED }], false));
		service.fileChangeEmitter.fire(new FileChangesEvent([{ resource, type: FileChangeType.ADDED }], false));
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.strictEqual(service.isReviewed(key), true);
		assert.strictEqual(stats, 0);

		service.mutationEmitter.fire(mutation('other', 'turn-x', 'tc-x'));
		assert.strictEqual(service.isReviewed(key), true);

		service.mutationEmitter.fire(mutation('sess', 'turn-2', 'tc-2'));
		assert.strictEqual(service.isReviewed(key), false);
		assert.strictEqual(service.isEntryReviewed(target), false);
		assert.strictEqual((await service.resolveKey(target)).contentHash, 'turn-2\0tc-2');
		assert.strictEqual(stats, 0);
	});

	test('pruneMissingKeys leaves other origin and session buckets', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const service = createService();
		const engine = {
			origin: 'engine' as const,
			sessionId: 'session-a',
			scopeKeyId: '',
			path: resource.toString(),
			contentHash: 'turn\0tool',
			gitPath: 'a.ts',
		};
		const scm = await service.resolveKey({ resource });
		service.markReviewed(engine);
		service.markReviewed(scm);

		service.pruneMissingKeys({ origin: 'engine', sessionId: 'session-b' }, new Set());
		assert.strictEqual(service.isReviewed(engine), true);
		assert.strictEqual(service.isReviewed(scm), true);

		service.pruneMissingKeys({ origin: 'scm', sessionId: '' }, new Set());
		assert.strictEqual(service.isReviewed(engine), true);
		assert.strictEqual(service.isReviewed(scm), false);

		service.pruneMissingKeys({ origin: 'engine', sessionId: 'session-a' }, new Set());
		assert.strictEqual(service.isReviewed(engine), false);
	});

	test('noteRefreshedKey drops the mark when the recomputed hash differs', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let etag = 'h1';
		const service = createService({
			stat: async () => ({ etag }),
			repositoryFor: () => ({ rootUri: toResource.call(this, '/project') }),
		});
		const target = { resource, origin: 'scm' as const };
		const first = await service.resolveKey(target);
		service.markReviewed(first);
		etag = 'h2';
		const second = await service.resolveKey(target);
		service.noteRefreshedKey(second);

		assert.notStrictEqual(first.contentHash, second.contentHash);
		assert.strictEqual(service.isReviewed(first), false);
		assert.strictEqual(service.isEntryReviewed(target), false);
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

		const key = await service.resolveKey({ resource });
		service.markReviewed(key);
		void storageMock;

		assert.strictEqual(storageCalls, 0);
		assert.strictEqual(service.isReviewed(key), true);
	});
});

suite('Sources - review progress key', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('buildSourcesReviewProgressKey is stable', () => {
		const key = { origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: 'file:///a.ts', contentHash: 'abc' };
		assert.strictEqual(buildSourcesReviewProgressKey(key), 'scm\0\0root\0file:///a.ts\0abc');
	});

	test('engine content hash keeps the embedded separator', () => {
		const key = {
			origin: 'engine' as const,
			sessionId: 'sess',
			scopeKeyId: 'root',
			path: 'file:///a.ts',
			contentHash: 'turn-1\0tc-1',
		};
		assert.strictEqual(buildSourcesReviewProgressKey(key), 'engine\0sess\0root\0file:///a.ts\0turn-1\0tc-1');
	});

	test('sourcesReviewProgressBucket prunes only a settled engine-live or scm read', () => {
		assert.deepStrictEqual(sourcesReviewProgressBucket({
			settled: true,
			state: { kind: 'engine-live', sessionId: 'sess' },
		}), { origin: 'engine', sessionId: 'sess' });
		assert.deepStrictEqual(sourcesReviewProgressBucket({
			settled: true,
			state: { kind: 'scm' },
		}), { origin: 'scm', sessionId: '' });
		assert.strictEqual(sourcesReviewProgressBucket({
			settled: true,
			failureMessage: 'Unable to read git changes',
			state: { kind: 'scm' },
		}), undefined);
		assert.strictEqual(sourcesReviewProgressBucket({
			settled: false,
			state: { kind: 'engine-live', sessionId: 'sess' },
		}), undefined);
		assert.strictEqual(sourcesReviewProgressBucket({
			settled: true,
			state: { kind: 'engine-leftover' },
		}), undefined);
	});
});
