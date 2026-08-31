/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getConversationTurnRoleLabel, getConversationTurnSummary } from '../../browser/conversationTrajectoryList.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('ConversationTrajectoryList', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getConversationTurnRoleLabel maps stub turn kinds', () => {
		assert.strictEqual(getConversationTurnRoleLabel('user'), 'You');
		assert.strictEqual(getConversationTurnRoleLabel('assistant'), 'Agent');
		assert.strictEqual(getConversationTurnRoleLabel('confirmation'), 'Confirmation');
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
});
