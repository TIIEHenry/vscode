/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { PendingActionView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import {
	collectPendingAttentionRequestIds,
	findFirstPendingConfirmationTurnId,
	hasNewPendingAttention,
	isConversationSessionInactive,
	scrollToFirstPendingConfirmation,
} from '../../browser/conversationPendingSeat.js';
import type { ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('conversationPendingSeat', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('inactive when session is not active or Conversation part is hidden', () => {
		assert.strictEqual(isConversationSessionInactive('a', 'a', true), false);
		assert.strictEqual(isConversationSessionInactive('a', 'b', true), true);
		assert.strictEqual(isConversationSessionInactive('a', 'a', false), true);
		assert.strictEqual(isConversationSessionInactive('a', 'b', false), true);
	});

	test('collects permission and question pending actions', () => {
		const actions = [
			{ requestId: 'p1', summary: { kind: 'permission', title: 'Allow write', permissionKind: 'write' } },
			{ requestId: 'q1', summary: { kind: 'question', title: 'Which one?' } },
			{ requestId: 'other', summary: { kind: 'text', title: 'no' } },
		] as unknown as PendingActionView[];
		assert.deepStrictEqual(collectPendingAttentionRequestIds(actions), ['p1', 'q1']);
	});

	test('hasNewPendingAttention only when a new request id appears', () => {
		assert.strictEqual(hasNewPendingAttention(new Set(['p1']), ['p1']), false);
		assert.strictEqual(hasNewPendingAttention(new Set(['p1']), ['p1', 'q1']), true);
		assert.strictEqual(hasNewPendingAttention(new Set(), ['q1']), true);
	});

	test('findFirstPendingConfirmationTurnId prefers first pending confirmation or question', () => {
		const turns: ConversationStubTurn[] = [
			{ id: 'u1', kind: 'user', text: 'hi' },
			{ id: 'c1', kind: 'confirmation', text: 'Allow?', status: 'allowed' },
			{ id: 'q1', kind: 'question', text: 'Pick', status: 'pending' },
		];
		assert.strictEqual(findFirstPendingConfirmationTurnId(turns), 'q1');
		assert.strictEqual(findFirstPendingConfirmationTurnId([
			{ id: 'c2', kind: 'confirmation', text: 'Allow?', status: 'pending' },
			...turns,
		]), 'c2');
	});

	test('scroll helper leaves trajectory, unmaximizes, then scrolls the seat', () => {
		const calls: string[] = [];
		const seat = { scrollIntoView: () => calls.push('scroll') } as unknown as HTMLElement;
		scrollToFirstPendingConfirmation({
			lensId: 'trajectory',
			showConversationLens: () => calls.push('show-lens'),
			inputMaximized: true,
			setInputMaximized: maximized => calls.push(`max:${maximized}`),
			findFirstPendingConfirmationTurnId: () => 'c1',
			getConfirmationElement: turnId => {
				calls.push(`el:${turnId}`);
				return seat;
			},
		});
		assert.deepStrictEqual(calls, ['show-lens', 'max:false', 'el:c1', 'scroll']);
	});
});
