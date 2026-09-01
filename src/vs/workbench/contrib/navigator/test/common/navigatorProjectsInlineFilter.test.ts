/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { matchesNavigatorProjectsInlineFilter } from '../../common/navigatorProjectsInlineFilter.js';

suite('Navigator - projects inline filter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('matchesNavigatorProjectsInlineFilter matches all when query is empty or whitespace', function () {
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('demo', undefined, ''), true);
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('demo', '/projects', '   '), true);
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('demo', '/projects', '\t'), true);
	});

	test('matchesNavigatorProjectsInlineFilter matches name case-insensitively', function () {
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('DemoProject', undefined, 'demo'), true);
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('DemoProject', undefined, 'DEMO'), true);
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('alpha', undefined, 'missing'), false);
	});

	test('matchesNavigatorProjectsInlineFilter matches description case-insensitively', function () {
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('alpha', '/home/user/my-projects', 'my-projects'), true);
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('alpha', '/home/user/my-projects', 'MY-PROJECTS'), true);
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('alpha', '/home/user/my-projects', 'other'), false);
	});

	test('matchesNavigatorProjectsInlineFilter uses substring matching', function () {
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('my-demo-app', undefined, 'demo'), true);
		assert.strictEqual(matchesNavigatorProjectsInlineFilter('alpha', '/home/user/my-projects', 'user'), true);
	});
});
