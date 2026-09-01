/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildAgentHierarchyBreadcrumb } from '../../common/conversationAgentHierarchy.js';
import { IConversationSessionChatEntry } from '../../common/conversationSessionChat.js';

suite('Conversation agent hierarchy (S3b)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const sessionKey = 'session-a';

	test('builds breadcrumb chain along origin.chat parent links', () => {
		const catalog: IConversationSessionChatEntry[] = [
			{ sessionKey, chatId: 'default', title: 'Root', originKind: 'user' },
			{ sessionKey, chatId: 'sub-1', title: 'Parent agent', originKind: 'tool', parentChatId: 'default' },
			{ sessionKey, chatId: 'sub-2', title: 'Child agent', originKind: 'tool', parentChatId: 'sub-1' },
		];

		const items = buildAgentHierarchyBreadcrumb(catalog, 'sub-2');
		assert.deepStrictEqual(items.map(item => item.chatId), ['default', 'sub-1', 'sub-2']);
		assert.strictEqual(items.at(-1)?.isCurrent, true);
		assert.strictEqual(items[0]?.isCurrent, false);
		assert.strictEqual(items[1]?.isCurrent, false);
	});

	test('returns empty breadcrumb for fork tabs', () => {
		const catalog: IConversationSessionChatEntry[] = [
			{ sessionKey, chatId: 'fork-1', title: 'Fork', originKind: 'fork', parentChatId: 'default' },
		];
		assert.deepStrictEqual(buildAgentHierarchyBreadcrumb(catalog, 'fork-1'), []);
	});

	test('honestly omits missing ancestors', () => {
		const catalog: IConversationSessionChatEntry[] = [
			{ sessionKey, chatId: 'sub-2', title: 'Orphan agent', originKind: 'tool', parentChatId: 'missing' },
		];

		const items = buildAgentHierarchyBreadcrumb(catalog, 'sub-2');
		assert.deepStrictEqual(items.map(item => item.chatId), ['default', 'sub-2']);
	});
});
