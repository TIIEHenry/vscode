/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';
import {
	countReviewProgress,
	filterReviewEntries,
	markReviewedAfterSuccessfulOpen,
} from '../../common/sourcesReviewListModel.js';
import { buildSourcesReviewProgressKey, ISourcesReviewProgressKey } from '../../common/sourcesReviewProgress.js';

suite('Sources - review list model', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

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
