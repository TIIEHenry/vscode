/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getConversationConfirmationSeatAriaLabel, getConversationTurnAccessibleText, getConversationTurnAriaLabel } from '../../browser/conversationAccessibility.js';

suite('ConversationAccessibility', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('getConversationConfirmationSeatAriaLabel includes status and message', () => {
		const pending = getConversationConfirmationSeatAriaLabel('pending', 'Write README.md?');
		assert.ok(pending.includes('Permission'));
		assert.ok(pending.includes('pending'));
		assert.ok(pending.includes('Input needed'));
		assert.ok(pending.includes('Write README.md?'));

		const allowed = getConversationConfirmationSeatAriaLabel('allowed', 'Deploy?');
		assert.ok(allowed.includes('Allowed'));
		assert.ok(allowed.includes('Deploy?'));
	});

	test('getConversationTurnAriaLabel covers every honest kind including system', () => {
		const user = getConversationTurnAriaLabel({ id: 'u1', kind: 'user', text: 'Hello lens' });
		assert.ok(user.includes('You'));
		assert.ok(user.includes('Hello lens'));

		const system = getConversationTurnAriaLabel({ id: 's1', kind: 'system', text: 'Connected' });
		assert.ok(system.includes('System'));
		assert.ok(system.includes('Connected'));

		const error = getConversationTurnAriaLabel({ id: 'e1', kind: 'error', text: 'boom', retryable: true });
		assert.ok(error.includes('Error'));
		assert.ok(error.includes('retryable'));
		assert.ok(error.includes('boom'));

		const unknown = getConversationTurnAriaLabel({ id: 'n1', kind: 'unknown', text: 'raw', typeName: 'FooBar' });
		assert.ok(unknown.includes('Unknown'));
		assert.ok(unknown.includes('FooBar'));

		const confirmation = getConversationTurnAriaLabel({
			id: 'c1',
			kind: 'confirmation',
			text: 'Run tests?',
			status: 'pending',
		});
		assert.ok(confirmation.includes('Permission'));
		assert.ok(confirmation.includes('Run tests?'));
	});

	test('streaming aria-label changes only with the streaming flag, not token text', () => {
		const enter = getConversationTurnAriaLabel({ id: 'a1', kind: 'assistant', text: 'Hel', streaming: true });
		const moreTokens = getConversationTurnAriaLabel({ id: 'a1', kind: 'assistant', text: 'Hello world from a long stream', streaming: true });
		assert.strictEqual(enter, moreTokens);
		assert.ok(enter.includes('in progress'));
		assert.ok(!enter.includes('Hello world'));

		const leave = getConversationTurnAriaLabel({ id: 'a1', kind: 'assistant', text: 'Hello world from a long stream' });
		assert.notStrictEqual(leave, enter);
		assert.ok(!leave.includes('in progress'));
		assert.ok(leave.includes('Hello world from a long stream'));
	});

	test('Accessible View text includes the full body while the row name stays short', () => {
		const turn = { id: 'a1', kind: 'assistant' as const, text: 'Hello world from a long stream', streaming: true };
		assert.ok(!getConversationTurnAriaLabel(turn).includes('Hello world'));
		assert.ok(getConversationTurnAccessibleText(turn).includes('Hello world from a long stream'));
	});
});
