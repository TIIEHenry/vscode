/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { matchesNavigatorAgentsInlineFilter } from '../../common/navigatorAgentsInlineFilter.js';

suite('Navigator - agents inline filter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('matchesNavigatorAgentsInlineFilter matches all when query is empty or whitespace', function () {
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('Alpha Agent', ''), true);
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('Alpha Agent', '   '), true);
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('Alpha Agent', '\t'), true);
	});

	test('matchesNavigatorAgentsInlineFilter matches label case-insensitively', function () {
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('Demo Agent', 'demo'), true);
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('Demo Agent', 'DEMO'), true);
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('Alpha', 'missing'), false);
	});

	test('matchesNavigatorAgentsInlineFilter uses substring matching', function () {
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('my-demo-agent', 'demo'), true);
		assert.strictEqual(matchesNavigatorAgentsInlineFilter('Tool Runner Beta', 'runner'), true);
	});
});
