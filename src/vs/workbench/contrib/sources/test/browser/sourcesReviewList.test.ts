/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { SourcesReviewList } from '../../browser/sourcesReviewList.js';
import { sourcesGitReadFailureMessage } from '../../common/sourcesChangesGitRead.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { ISourcesReviewAttributionService } from '../../common/sourcesReviewAttribution.js';
import {
	countReviewProgress,
	filterReviewEntries,
	markReviewedAfterSuccessfulOpen,
	reviewListEmptyReason,
} from '../../common/sourcesReviewListModel.js';
import { buildSourcesReviewProgressKey, ISourcesReviewProgressKey, ISourcesReviewProgressService } from '../../common/sourcesReviewProgress.js';

suite('Sources - review list model', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createThrowingGitConnection(): IUniverseAgentConnection {
		return {
			isEngineConnected: () => true,
			onDidChangeConnection: Event.None,
			readGitChanges: async () => {
				throw new Error('boom');
			},
		} as unknown as IUniverseAgentConnection;
	}

	function createEmptyScmService(): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function stubSourcesGitListServices() {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createThrowingGitConnection());
		instantiationService.stub(ISCMService, createEmptyScmService());
		instantiationService.stub(IQuickDiffService, {
			getQuickDiffs: async () => [],
		} as unknown as IQuickDiffService);
		instantiationService.stub(ISourcesDiffPanelService, {
			onDidChangeRef: Event.None,
			getCurrentRef: () => undefined,
			show: async () => { },
			clear: () => { },
		} as unknown as ISourcesDiffPanelService);
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: async () => undefined,
		} as unknown as ICommandService);
		instantiationService.stub(ISourcesReviewProgressService, {
			onDidChange: Event.None,
			isReviewed: () => false,
			markReviewed: () => { },
			markUnreviewed: () => { },
			markAllReviewed: () => { },
			resolveKey: async (resource: URI) => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: '' }),
			pruneMissingKeys: () => { },
		} as unknown as ISourcesReviewProgressService);
		instantiationService.stub(ISourcesReviewAttributionService, {
			onDidChange: Event.None,
			isAttributionEnabled: () => false,
			getWorkDirMismatchNote: () => undefined,
			getAttributionHeaderSuffix: () => undefined,
			resolveRevealItemId: () => undefined,
			buildChipMapForEntries: () => new Map(),
		} as unknown as ISourcesReviewAttributionService);
		return instantiationService;
	}

	async function waitForStatusText(host: HTMLElement, selector: string): Promise<string> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const text = host.querySelector(selector)?.textContent ?? '';
			if (text) {
				return text;
			}
			await timeout(20);
		}
		throw new Error(`status ${selector} stayed empty`);
	}

	function entry(resource: URI): ISourcesChangeEntry {
		return {
			resource,
			name: resource.path.split('/').pop() ?? '',
			description: 'Changes',
			groupId: 'workingTree',
		};
	}

	test('filterReviewEntries applies text, path-set, and unreviewed toggle with AND semantics', function () {
		const a = entry(toResource.call(this, '/project/a.ts'));
		const b = entry(toResource.call(this, '/project/b.ts'));
		const c = entry(toResource.call(this, '/project/c.ts'));
		const reviewed = new Set([a.resource.toString()]);

		const pathFiltered = filterReviewEntries(
			[a, b, c],
			'',
			[a.resource, c.resource],
			false,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(pathFiltered.map(e => e.name), ['a.ts', 'c.ts']);

		const unreviewedOnly = filterReviewEntries(
			[a, b, c],
			'',
			undefined,
			true,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(unreviewedOnly.map(e => e.name), ['b.ts', 'c.ts']);

		const textAndPath = filterReviewEntries(
			[a, b, c],
			'b',
			[b.resource],
			false,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(textAndPath.map(e => e.name), ['b.ts']);
	});

	test('reviewListEmptyReason distinguishes unreviewed-done, path miss, and text miss', function () {
		const a = entry(toResource.call(this, '/project/a.ts'));
		const b = entry(toResource.call(this, '/project/b.ts'));
		const reviewed = new Set([a.resource.toString(), b.resource.toString()]);
		const isReviewed = (e: ISourcesChangeEntry) => reviewed.has(e.resource.toString());

		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', undefined, true, isReviewed),
			'unreviewedDone',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', [toResource.call(this, '/project/other.ts')], false, () => false),
			'pathNoIntersection',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], 'zzz', undefined, false, () => false),
			'textFilterEmpty',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', undefined, false, () => false),
			undefined,
		);
	});

	test('countReviewProgress reports reviewed and total', function () {
		const entries = [
			entry(toResource.call(this, '/project/a.ts')),
			entry(toResource.call(this, '/project/b.ts')),
		];
		const reviewed = new Set([entries[0].resource.toString()]);
		const counts = countReviewProgress(entries, e => reviewed.has(e.resource.toString()));
		assert.deepStrictEqual(counts, { reviewed: 1, total: 2 });
	});

	test('markReviewedAfterSuccessfulOpen marks only after open resolves', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const marked: ISourcesReviewProgressKey[] = [];
		let shouldFail = false;

		await markReviewedAfterSuccessfulOpen(
			async () => {
				if (shouldFail) {
					throw new Error('open failed');
				}
			},
			async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		);

		assert.strictEqual(marked.length, 1);

		shouldFail = true;
		await assert.rejects(() => markReviewedAfterSuccessfulOpen(
			async () => { throw new Error('open failed'); },
			async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		));
		assert.strictEqual(marked.length, 1);
	});

	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

	test('Review list surfaces git read failure on a status line instead of a silent catch', () => {
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		assert.ok(review.includes('sourcesGitReadFailureMessage'));
		assert.ok(review.includes('setStatusMessage'));
		assert.ok(review.includes('sources-review-status'));
		assert.ok(!review.includes('} catch {\n\t\t\tif (seq !== this.refreshSeq)'));
	});

	test('Review list status DOM shows git-read throw', async function () {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = stubSourcesGitListServices();
		store.add(instantiationService.createInstance(SourcesReviewList, host));

		const status = await waitForStatusText(host, '.sources-review-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(status.includes('Unable to read git changes:'));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows git-read throw', async function () {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = stubSourcesGitListServices();
		store.add(instantiationService.createInstance(SourcesChangesList, host));

		const status = await waitForStatusText(host, '.sources-changes-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(status.includes('Unable to read git changes:'));
		assert.ok(status.includes('boom'));
	});

	test('Review list surfaces open-diff failure on the same status line and does not mark reviewed', () => {
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const openStart = review.indexOf('this._register(this.list.onDidOpen');
		const openEnd = review.indexOf('this._register(this.list.onContextMenu', openStart);
		assert.ok(openStart >= 0 && openEnd > openStart);
		const openHandler = review.slice(openStart, openEnd);
		assert.ok(openHandler.includes('markReviewedAfterSuccessfulOpen'));
		assert.ok(openHandler.includes('} catch (error)'));
		assert.ok(openHandler.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(openHandler.includes('setStatusMessage'));
		assert.ok(!openHandler.includes('} catch {'));
	});

	test('Changes list does not reference review progress service', () => {
		const changesListPath = path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts');
		const source = fs.readFileSync(changesListPath, 'utf8');
		assert.ok(!source.includes('ISourcesReviewProgressService'));
		assert.ok(!source.includes('sourcesReviewProgress'));
	});

	test('review progress keys remain distinct per content hash', () => {
		const base = { scopeKeyId: 'root', path: 'file:///a.ts' };
		const keyA = buildSourcesReviewProgressKey({ ...base, contentHash: '1' });
		const keyB = buildSourcesReviewProgressKey({ ...base, contentHash: '2' });
		assert.notStrictEqual(keyA, keyB);
	});
});
