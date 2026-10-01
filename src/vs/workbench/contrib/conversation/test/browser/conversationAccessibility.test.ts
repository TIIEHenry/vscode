/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getConversationConfirmationSeatAriaLabel, getConversationTurnAccessibleText, getConversationTurnAriaLabel } from '../../browser/conversationAccessibility.js';
import { CONVERSATION_REFS_MARKER } from '../../browser/conversationUserRefs.js';
import { getConversationChatResource } from '../../common/conversationChatInput.js';

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

		const undecided = getConversationConfirmationSeatAriaLabel('undecided', 'Run the tool?');
		assert.ok(undecided.includes('Permission'));
		assert.ok(undecided.includes('Run the tool?'));
		assert.ok(!undecided.includes('Allowed'));
		assert.ok(!undecided.includes('Skipped'));
		assert.ok(!undecided.includes('Allow'));
		assert.ok(!undecided.includes('Skip'));
	});

	test('getConversationTurnAriaLabel covers every honest kind including system', () => {
		const user = getConversationTurnAriaLabel({ id: 'u1', kind: 'user', text: 'Hello lens' });
		assert.ok(user.includes('You'));
		assert.ok(user.includes('Hello lens'));
		assert.ok(!user.toLowerCase().includes('sending'));

		const sending = getConversationTurnAriaLabel({ id: 'send:op-1', kind: 'user', text: 'Hello lens', pending: true });
		assert.ok(sending.includes('You'));
		assert.ok(sending.includes('sending'));
		assert.ok(sending.includes('Hello lens'));
		assert.ok(!/\bsent\b/i.test(sending));

		const system = getConversationTurnAriaLabel({ id: 's1', kind: 'system', text: 'Connected' });
		assert.ok(system.includes('System'));
		assert.ok(system.includes('Connected'));

		const context = getConversationTurnAriaLabel({ id: 't1', kind: 'system', text: 'tool body', readOnlyText: 'context' });
		assert.ok(context.includes('Context'));
		assert.ok(context.includes('tool body'));
		assert.ok(!context.includes('System'));
		assert.ok(!context.includes('Agent'));

		const neutral = getConversationTurnAriaLabel({ id: 'n0', kind: 'system', text: 'plain', readOnlyText: 'neutral' });
		assert.ok(neutral.includes('Text'));
		assert.ok(neutral.includes('plain'));
		assert.ok(!neutral.includes('System'));
		assert.ok(!neutral.includes('You'));
		assert.ok(!neutral.includes('Agent'));
		assert.ok(!neutral.includes('CONTEXT'));

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

	test('question row and Accessible View use the blocked reason unless the question can be submitted', () => {
		const blocked = getConversationTurnAriaLabel({
			id: 'q-keys',
			kind: 'question',
			text: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'a', title: 'A', options: ['a', 'a'] }],
			answerKeysValid: false,
			questionRequestId: 'req-1',
		});
		assert.strictEqual(blocked, "Question, Can't answer — these choices can't be submitted., Pick one");

		const empty = getConversationTurnAriaLabel({
			id: 'q-empty',
			kind: 'question',
			text: 'Pick one',
			status: 'pending',
		});
		assert.strictEqual(empty, "Question, Can't answer — there are no choices., Pick one");

		const notReady = getConversationTurnAriaLabel({
			id: 'q-req',
			kind: 'question',
			text: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'a', title: 'A', options: ['alpha'] }],
			answerKeysValid: true,
		});
		assert.strictEqual(notReady, "Question, Can't answer — this question isn't ready to submit., Pick one");

		const ready = getConversationTurnAriaLabel({
			id: 'q-ready',
			kind: 'question',
			text: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'a', title: 'A', options: ['alpha'] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
		});
		assert.strictEqual(ready, 'Question, Input needed, Pick one');

		const answered = getConversationTurnAriaLabel({
			id: 'q-done',
			kind: 'question',
			text: 'Already picked',
			status: 'allowed',
			answerKeysValid: false,
		});
		assert.strictEqual(answered, 'Question, Answered, Already picked');

		const view = getConversationTurnAccessibleText({
			id: 'q-keys',
			kind: 'question',
			text: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'a', title: 'A', options: ['a', 'a'] }],
			answerKeysValid: false,
			questionRequestId: 'req-1',
		});
		assert.strictEqual(view, blocked);
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

	test('Accessible View omits a user refs trailer and keeps the assistant body', () => {
		const line = getConversationChatResource('s1', 'default').toString();
		const body = 'See the other chat';
		const text = `${body}\n\n${CONVERSATION_REFS_MARKER}\n${line}`;

		const user = getConversationTurnAccessibleText({ id: 'u-refs', kind: 'user', text });
		assert.ok(user.includes(body));
		assert.ok(!user.includes(CONVERSATION_REFS_MARKER));
		assert.ok(!user.includes(line));

		const assistant = getConversationTurnAccessibleText({ id: 'a-refs', kind: 'assistant', text });
		assert.ok(assistant.includes(text));
		assert.ok(assistant.includes(CONVERSATION_REFS_MARKER));
		assert.ok(assistant.includes(line));
	});
});
