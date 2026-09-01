/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { matchesExplorerInlineFilter } from '../../common/explorerInlineFilter.js';

suite('Files - explorer inline filter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('matchesExplorerInlineFilter matches all when query is empty or whitespace', function () {
		assert.strictEqual(matchesExplorerInlineFilter('index.ts', ''), true);
		assert.strictEqual(matchesExplorerInlineFilter('index.ts', '   '), true);
		assert.strictEqual(matchesExplorerInlineFilter('index.ts', '\t'), true);
	});

	test('matchesExplorerInlineFilter matches name case-insensitively', function () {
		assert.strictEqual(matchesExplorerInlineFilter('index.ts', 'index'), true);
		assert.strictEqual(matchesExplorerInlineFilter('index.ts', 'INDEX'), true);
		assert.strictEqual(matchesExplorerInlineFilter('README.md', 'readme'), true);
		assert.strictEqual(matchesExplorerInlineFilter('util.ts', 'missing'), false);
	});

	test('matchesExplorerInlineFilter uses substring matching', function () {
		assert.strictEqual(matchesExplorerInlineFilter('app.component.ts', 'component'), true);
		assert.strictEqual(matchesExplorerInlineFilter('app.component.ts', '.ts'), true);
	});
});
