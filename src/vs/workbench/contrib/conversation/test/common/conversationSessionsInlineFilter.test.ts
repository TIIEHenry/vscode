/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { matchesConversationSessionsInlineFilter } from '../../common/conversationSessionsInlineFilter.js';

suite('Conversation - sessions inline filter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('matchesConversationSessionsInlineFilter matches all when query is empty or whitespace', function () {
		assert.strictEqual(matchesConversationSessionsInlineFilter('Untitled', ''), true);
		assert.strictEqual(matchesConversationSessionsInlineFilter('Untitled', '   '), true);
		assert.strictEqual(matchesConversationSessionsInlineFilter('Untitled', '\t'), true);
	});

	test('matchesConversationSessionsInlineFilter matches title case-insensitively', function () {
		assert.strictEqual(matchesConversationSessionsInlineFilter('Demo Session', 'demo'), true);
		assert.strictEqual(matchesConversationSessionsInlineFilter('Demo Session', 'DEMO'), true);
		assert.strictEqual(matchesConversationSessionsInlineFilter('Alpha chat', 'missing'), false);
	});

	test('matchesConversationSessionsInlineFilter uses substring matching', function () {
		assert.strictEqual(matchesConversationSessionsInlineFilter('my-demo-session', 'demo'), true);
		assert.strictEqual(matchesConversationSessionsInlineFilter('New session 3', 'session'), true);
	});
});
