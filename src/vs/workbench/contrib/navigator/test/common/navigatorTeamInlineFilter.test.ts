/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { matchesNavigatorTeamInlineFilter } from '../../common/navigatorTeamInlineFilter.js';

suite('Navigator - team inline filter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('matchesNavigatorTeamInlineFilter matches all when query is empty or whitespace', function () {
		assert.strictEqual(matchesNavigatorTeamInlineFilter('Alice Member', ''), true);
		assert.strictEqual(matchesNavigatorTeamInlineFilter('Alice Member', '   '), true);
		assert.strictEqual(matchesNavigatorTeamInlineFilter('Alice Member', '\t'), true);
	});

	test('matchesNavigatorTeamInlineFilter matches label case-insensitively', function () {
		assert.strictEqual(matchesNavigatorTeamInlineFilter('Demo Task', 'demo'), true);
		assert.strictEqual(matchesNavigatorTeamInlineFilter('Demo Task', 'DEMO'), true);
		assert.strictEqual(matchesNavigatorTeamInlineFilter('Alpha', 'missing'), false);
	});

	test('matchesNavigatorTeamInlineFilter uses substring matching', function () {
		assert.strictEqual(matchesNavigatorTeamInlineFilter('my-demo-task', 'demo'), true);
		assert.strictEqual(matchesNavigatorTeamInlineFilter('Task Runner Beta', 'runner'), true);
	});
});
