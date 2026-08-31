/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { filterSourcesEntries, ISourcesFilterableEntry } from '../../common/sourcesFilterModel.js';

suite('Sources - filter model', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function entry(path: string, name: string, description: string): ISourcesFilterableEntry {
		return {
			resource: toResource.call(this, path),
			name,
			description,
		};
	}

	test('filterSourcesEntries returns all entries when query is empty', function () {
		const entries = [
			entry.call(this, '/project/src/index.ts', 'index.ts', 'src/index.ts'),
			entry.call(this, '/project/README.md', 'README.md', 'README.md'),
		];

		assert.deepStrictEqual(filterSourcesEntries(entries, ''), entries);
		assert.deepStrictEqual(filterSourcesEntries(entries, '   '), entries);
	});

	test('filterSourcesEntries matches name, description, and path case-insensitively', function () {
		const entries = [
			entry.call(this, '/project/src/index.ts', 'index.ts', 'src/index.ts'),
			entry.call(this, '/project/README.md', 'README.md', 'README.md'),
			entry.call(this, '/project/lib/util.ts', 'util.ts', 'lib/util.ts'),
		];

		assert.strictEqual(filterSourcesEntries(entries, 'INDEX').length, 1);
		assert.strictEqual(filterSourcesEntries(entries, 'index')[0].name, 'index.ts');

		assert.strictEqual(filterSourcesEntries(entries, 'readme').length, 1);
		assert.strictEqual(filterSourcesEntries(entries, 'readme')[0].name, 'README.md');

		assert.strictEqual(filterSourcesEntries(entries, 'lib/util').length, 1);
		assert.strictEqual(filterSourcesEntries(entries, 'lib/util')[0].name, 'util.ts');

		assert.strictEqual(filterSourcesEntries(entries, 'missing').length, 0);
	});
});
