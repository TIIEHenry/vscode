/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { collectSourcesChangeEntries, ISourcesChangeRepositoryLike } from '../../common/sourcesChangesModel.js';
import { collectSourcesReviewEntries } from '../../common/sourcesReviewModel.js';

suite('Sources - Review list projection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createRepo(groups: { label: string; resources: URI[] }[]): ISourcesChangeRepositoryLike {
		return {
			provider: {
				groups: groups.map(group => ({
					label: group.label,
					resources: group.resources.map(sourceUri => ({ sourceUri })),
				})),
			},
		};
	}

	test('collectSourcesReviewEntries returns empty for no repositories', () => {
		const entries = collectSourcesReviewEntries([]);
		assert.deepStrictEqual(entries, []);
	});

	test('collectSourcesReviewEntries delegates to collectSourcesChangeEntries', () => {
		const staged = toResource.call(this, '/project/src/a.ts');
		const unstaged = toResource.call(this, '/project/readme.md');
		const repos = [
			createRepo([
				{ label: 'Unstaged Changes', resources: [unstaged] },
				{ label: 'Staged Changes', resources: [staged] },
			]),
		];

		const reviewEntries = collectSourcesReviewEntries(repos);
		const changeEntries = collectSourcesChangeEntries(repos);

		assert.deepStrictEqual(reviewEntries, changeEntries);
		assert.strictEqual(reviewEntries.length, 2);
		assert.strictEqual(reviewEntries[0].name, 'a.ts');
		assert.strictEqual(reviewEntries[0].description, 'Staged Changes');
		assert.strictEqual(reviewEntries[1].name, 'readme.md');
		assert.strictEqual(reviewEntries[1].description, 'Unstaged Changes');
	});
});
