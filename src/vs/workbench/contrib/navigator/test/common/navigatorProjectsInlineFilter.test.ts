/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { filterNavigatorProjectsTreeNodes, matchesNavigatorProjectsInlineFilter } from '../../common/navigatorProjectsInlineFilter.js';

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

	test('parent label hit with no child hit keeps an empty child list', function () {
		const nodes = [{
			label: 'Projects root',
			children: [
				{ label: 'one' },
				{ label: 'two' },
			],
		}];
		const filtered = filterNavigatorProjectsTreeNodes(nodes, 'root');
		assert.strictEqual(filtered.length, 1);
		assert.notStrictEqual(filtered[0]?.children, nodes[0]?.children);
		assert.deepStrictEqual(filtered[0]?.children, []);
	});

	test('parent and one child hit keeps only that child', function () {
		const nodes = [{
			label: 'Alpha root',
			children: [
				{ label: 'Alpha child', description: '/tmp/alpha' },
				{ label: 'Beta sibling' },
			],
		}];
		const filtered = filterNavigatorProjectsTreeNodes(nodes, 'Alpha');
		assert.strictEqual(filtered.length, 1);
		assert.deepStrictEqual(filtered[0]?.children?.map(child => child.label), ['Alpha child']);
	});

	test('filterTreeNodes matches the full workdir description, including a middle segment', function () {
		const nodes = [{
			label: 'Work',
			description: '/home/user/my-projects',
			children: [
				{ label: 'session-a', description: '/tmp/elsewhere' },
			],
		}];
		const byMiddle = filterNavigatorProjectsTreeNodes(nodes, 'user');
		assert.strictEqual(byMiddle.length, 1);
		assert.strictEqual(byMiddle[0]?.label, 'Work');
		assert.deepStrictEqual(byMiddle[0]?.children, []);

		const byTail = filterNavigatorProjectsTreeNodes(nodes, 'my-projects');
		assert.strictEqual(byTail.length, 1);
		assert.strictEqual(byTail[0]?.label, 'Work');
	});
});
