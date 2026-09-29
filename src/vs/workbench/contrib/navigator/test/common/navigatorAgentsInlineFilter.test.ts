/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { filterNavigatorAgentsHierarchyNodes, matchesNavigatorAgentsInlineFilter } from '../../common/navigatorAgentsInlineFilter.js';

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

	test('parent label hit with no child hit keeps an empty child list', function () {
		type AgentFilterNode = { readonly label: string; readonly children?: readonly AgentFilterNode[] };
		const nodes: readonly AgentFilterNode[] = [{
			label: 'Alpha parent',
			children: [
				{ label: 'one' },
				{ label: 'two' },
			],
		}];
		const filtered = filterNavigatorAgentsHierarchyNodes(nodes, 'parent');
		assert.strictEqual(filtered.length, 1);
		assert.notStrictEqual(filtered[0]?.children, nodes[0]?.children);
		assert.deepStrictEqual(filtered[0]?.children, []);
	});

	test('parent and one child hit keeps only that child', function () {
		type AgentFilterNode = { readonly label: string; readonly children?: readonly AgentFilterNode[] };
		const nodes: readonly AgentFilterNode[] = [{
			label: 'Alpha parent',
			children: [
				{ label: 'Alpha child' },
				{ label: 'Beta sibling' },
			],
		}];
		const filtered = filterNavigatorAgentsHierarchyNodes(nodes, 'Alpha');
		assert.strictEqual(filtered.length, 1);
		assert.deepStrictEqual(filtered[0]?.children?.map(child => child.label), ['Alpha child']);
	});
});
