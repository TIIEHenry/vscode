/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getConversationConfirmationSeatAriaLabel, getConversationTurnAriaLabel } from '../../browser/conversationAccessibility.js';

suite('ConversationAccessibility', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('getConversationConfirmationSeatAriaLabel includes status and message', () => {
		const pending = getConversationConfirmationSeatAriaLabel('pending', 'Write README.md?');
		assert.ok(pending.includes('confirmation pending'));
		assert.ok(pending.includes('Input needed'));
		assert.ok(pending.includes('Write README.md?'));

		const allowed = getConversationConfirmationSeatAriaLabel('allowed', 'Deploy?');
		assert.ok(allowed.includes('Allowed'));
		assert.ok(allowed.includes('Deploy?'));
	});

	test('getConversationTurnAriaLabel includes role and summary', () => {
		const user = getConversationTurnAriaLabel({ id: 'u1', kind: 'user', text: 'Hello lens' });
		assert.ok(user.includes('You'));
		assert.ok(user.includes('Hello lens'));

		const confirmation = getConversationTurnAriaLabel({
			id: 'c1',
			kind: 'confirmation',
			text: 'Run tests?',
			status: 'pending',
		});
		assert.ok(confirmation.includes('confirmation pending'));
		assert.ok(confirmation.includes('Run tests?'));
	});
});
