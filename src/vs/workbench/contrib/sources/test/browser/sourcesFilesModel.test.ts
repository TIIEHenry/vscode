/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { IFileQuery, ISearchComplete } from '../../../../services/search/common/search.js';
import { buildSourcesFileFolderQuery, collectSourcesFileEntries, resolveSourcesFilesCollectResult } from '../../common/sourcesFilesModel.js';

suite('Sources - Files search', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('each folder is one fileSearch with ignore flags and excludes', async function () {
		const folderA = toResource.call(this, '/project-a');
		const folderB = toResource.call(this, '/project-b');
		const excludePattern = { '**/node_modules': true, '**/dist': true };
		const queries: IFileQuery[] = [];
		const tokens: CancellationToken[] = [];
		const sources = [new CancellationTokenSource(), new CancellationTokenSource()];

		const outcome = await collectSourcesFileEntries(
			[folderA, folderB],
			excludePattern,
			20,
			{
				fileSearch: async (query, token) => {
					queries.push(query);
					tokens.push(token ?? CancellationToken.None);
					const folder = query.folderQueries[0].folder;
					return {
						results: [{ resource: folder.with({ path: `${folder.path}/src/file.ts` }) }],
						messages: [],
						limitHit: false,
					} satisfies ISearchComplete;
				},
			},
			sources.map(source => source.token),
		);

		assert.strictEqual(queries.length, 2);
		assert.strictEqual(queries[0].folderQueries.length, 1);
		assert.strictEqual(queries[0].folderQueries[0].folder.toString(), folderA.toString());
		assert.strictEqual(queries[1].folderQueries[0].folder.toString(), folderB.toString());
		assert.strictEqual(queries[0].folderQueries[0].disregardIgnoreFiles, false);
		assert.strictEqual(queries[0].folderQueries[0].disregardParentIgnoreFiles, false);
		assert.strictEqual(queries[1].folderQueries[0].disregardIgnoreFiles, false);
		assert.strictEqual(queries[1].folderQueries[0].disregardParentIgnoreFiles, false);
		assert.deepStrictEqual(queries[0].excludePattern, excludePattern);
		assert.strictEqual(queries[0].maxResults, 20);
		assert.strictEqual(tokens[0].isCancellationRequested, false);
		assert.strictEqual(outcome.entries.length, 2);
		assert.strictEqual(outcome.truncated, false);
		sources.forEach(source => source.dispose());
	});

	test('one folder reject keeps the other folder', async function () {
		const folderA = toResource.call(this, '/keep');
		const folderB = toResource.call(this, '/drop');
		const kept = folderA.with({ path: `${folderA.path}/a.ts` });
		const outcome = await collectSourcesFileEntries(
			[folderA, folderB],
			undefined,
			10,
			{
				fileSearch: async query => {
					if (query.folderQueries[0].folder.toString() === folderB.toString()) {
						throw new Error('boom');
					}
					return { results: [{ resource: kept }], messages: [], limitHit: false };
				},
			},
			[CancellationToken.None, CancellationToken.None],
		);
		assert.deepStrictEqual(outcome.entries.map(entry => entry.resource.toString()), [kept.toString()]);
		assert.strictEqual(outcome.entries[0].description, 'a.ts');
	});

	test('every folder reject throws so the caller can keep the previous result', async function () {
		await assert.rejects(() => collectSourcesFileEntries(
			[toResource.call(this, '/a'), toResource.call(this, '/b')],
			undefined,
			10,
			{ fileSearch: async () => { throw new Error('boom'); } },
			[CancellationToken.None, CancellationToken.None],
		), /boom/);
	});

	test('limitHit and a merged count above the cap truncate', async function () {
		const folder = toResource.call(this, '/project');
		const limited = await collectSourcesFileEntries(
			[folder],
			undefined,
			1,
			{
				fileSearch: async () => ({
					results: [
						{ resource: folder.with({ path: '/project/b.ts' }) },
						{ resource: folder.with({ path: '/project/a.ts' }) },
					],
					messages: [],
					limitHit: true,
				}),
			},
			[CancellationToken.None],
		);
		assert.strictEqual(limited.entries.length, 1);
		assert.strictEqual(limited.limitHit, true);
		assert.strictEqual(limited.truncated, true);

		const overCap = await collectSourcesFileEntries(
			[folder],
			undefined,
			1,
			{
				fileSearch: async () => ({
					results: [
						{ resource: folder.with({ path: '/project/b.ts' }) },
						{ resource: folder.with({ path: '/project/a.ts' }) },
					],
					messages: [],
					limitHit: false,
				}),
			},
			[CancellationToken.None],
		);
		assert.strictEqual(overCap.entries.length, 1);
		assert.strictEqual(overCap.truncated, true);
		assert.strictEqual(overCap.entries[0].name, 'a.ts');
	});

	test('buildSourcesFileFolderQuery does not put ignore flags on the file query', function () {
		const query = buildSourcesFileFolderQuery(toResource.call(this, '/project'), { '**/.git': true }, 4);
		assert.strictEqual('disregardIgnoreFiles' in query, false);
		assert.strictEqual('disregardParentIgnoreFiles' in query, false);
		assert.strictEqual(query.folderQueries[0].disregardIgnoreFiles, false);
		assert.strictEqual(query.folderQueries[0].disregardParentIgnoreFiles, false);
		assert.deepStrictEqual(query.excludePattern, { '**/.git': true });
	});

	test('resolveSourcesFilesCollectResult keeps last-good entries after throw', function () {
		const leftover = {
			resource: toResource.call(this, '/project/src/leftover.ts'),
			name: 'leftover.ts',
			description: 'src/leftover.ts',
		};
		const failed = resolveSourcesFilesCollectResult([leftover], undefined, new Error('boom'));
		assert.strictEqual(failed.failed, true);
		assert.deepStrictEqual(failed.entries, [leftover]);

		const firstFail = resolveSourcesFilesCollectResult([], undefined, new Error('boom'));
		assert.strictEqual(firstFail.failed, true);
		assert.deepStrictEqual(firstFail.entries, []);

		const ok = resolveSourcesFilesCollectResult([leftover], [], undefined);
		assert.strictEqual(ok.failed, false);
		assert.deepStrictEqual(ok.entries, []);
	});
});
