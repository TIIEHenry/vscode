/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { LiveAgentTreeNodeView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { catalogChatIdFromAgentId, collectLiveAgentTreeCatalogEntries } from '../../common/conversationLiveAgentCatalog.js';

suite('conversationLiveAgentCatalog', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function node(agentId: string, name: string, children: LiveAgentTreeNodeView[] = []): LiveAgentTreeNodeView {
		return {
			agentId,
			name,
			type: 'AGENT_TYPE_SUB',
			status: 'AGENT_STATUS_IDLE',
			model: 'm',
			turnCount: 0,
			createdAt: 0,
			children,
		};
	}

	test('root agent id maps to default chat id', () => {
		assert.strictEqual(catalogChatIdFromAgentId('root'), 'default');
		assert.strictEqual(catalogChatIdFromAgentId('research'), 'research');
	});

	test('collects non-root children with default parent', () => {
		const tree = node('root', 'Root', [
			node('research', 'Research'),
			node('writer', 'Writer'),
		]);
		assert.deepStrictEqual(collectLiveAgentTreeCatalogEntries(tree), [
			{ chatId: 'research', title: 'Research', parentChatId: 'default' },
			{ chatId: 'writer', title: 'Writer', parentChatId: 'default' },
		]);
	});

	test('nested children keep parent agent id', () => {
		const tree = node('root', 'Root', [
			node('research', 'Research', [node('web', 'Web search')]),
		]);
		assert.deepStrictEqual(collectLiveAgentTreeCatalogEntries(tree), [
			{ chatId: 'research', title: 'Research', parentChatId: 'default' },
			{ chatId: 'web', title: 'Web search', parentChatId: 'research' },
		]);
	});
});
