/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getConversationTurnRoleLabel, getConversationTurnSummary } from '../../browser/conversationTrajectoryList.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { CONVERSATION_REFS_MARKER } from '../../browser/conversationUserRefs.js';
import { getConversationChatResource } from '../../common/conversationChatInput.js';

suite('ConversationTrajectoryList', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getConversationTurnRoleLabel maps stub turn kinds', () => {
		assert.strictEqual(getConversationTurnRoleLabel('user'), 'You');
		assert.strictEqual(getConversationTurnRoleLabel('assistant'), 'Agent');
		assert.strictEqual(getConversationTurnRoleLabel('confirmation'), 'Permission');
		assert.strictEqual(getConversationTurnRoleLabel('thinking'), 'Thinking');
		assert.strictEqual(getConversationTurnRoleLabel('tool'), 'Tool');
	});

	test('getConversationTurnSummary truncates long text and handles empty summaries', () => {
		const longText = 'x'.repeat(140);
		const longTurn: ConversationStubTurn = { id: 't-1', kind: 'user', text: longText };
		const emptyTurn: ConversationStubTurn = { id: 't-2', kind: 'assistant', text: '   ' };

		assert.strictEqual(getConversationTurnSummary(longTurn).length, 120);
		assert.ok(getConversationTurnSummary(longTurn).endsWith('…'));
		assert.strictEqual(getConversationTurnSummary(emptyTurn), '(empty)');
		assert.strictEqual(getConversationTurnSummary({ id: 't-3', kind: 'tool', text: 'Read README' }), 'Read README');
	});

	test('getConversationTurnSummary omits a user refs trailer and keeps the assistant body', () => {
		const line = getConversationChatResource('s1', 'default').toString();
		const body = 'See the other chat';
		const text = `${body}\n\n${CONVERSATION_REFS_MARKER}\n${line}`;

		const user = getConversationTurnSummary({ id: 'u-refs', kind: 'user', text });
		assert.strictEqual(user, body);
		assert.ok(!user.includes(CONVERSATION_REFS_MARKER));
		assert.ok(!user.includes(line));

		const assistant = getConversationTurnSummary({ id: 'a-refs', kind: 'assistant', text });
		assert.strictEqual(assistant, text);
		assert.ok(assistant.includes(CONVERSATION_REFS_MARKER));
		assert.ok(assistant.includes(line));
	});
});
