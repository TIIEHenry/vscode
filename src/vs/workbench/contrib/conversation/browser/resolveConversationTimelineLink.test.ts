/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getConversationChatResource } from '../common/conversationChatInput.js';
import { resolveConversationTimelineLink } from './resolveConversationTimelineLink.js';

suite('resolveConversationTimelineLink (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('shared chatId in another session catalog row must not validate this session link', () => {
		const href = getConversationChatResource('sess-a', 'tool-a').toString();
		const roster = [
			{ id: 'sess-a', title: 'Session A' },
			{ id: 'sess-b', title: 'Session B' },
		];
		const catalog = [
			{ sessionKey: 'sess-b', chatId: 'tool-a', title: 'Tool from B', originKind: 'tool' as const },
		];

		const resolved = resolveConversationTimelineLink(href, roster, catalog);
		assert.strictEqual(resolved.kind, 'miss');
	});
});
