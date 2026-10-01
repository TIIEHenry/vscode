/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConversationQuestionRespondAnswers } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationQuestionSeat } from '../../browser/conversationQuestionSeat.js';

suite('ConversationQuestionSeat selections', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function labelsOf(answers: ConversationQuestionRespondAnswers, id: string): readonly string[] {
		return answers[id]?.selectedLabels ?? [];
	}

	test('radio arrows keep aria-checked and selectedLabels on the same option', () => {
		const responded: ConversationQuestionRespondAnswers[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['alpha', 'beta'], allowCustom: true }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: (_requestId, answers) => responded.push(answers),
		}));
		const radios = [...seat.element.querySelectorAll('[role="radio"]')] as HTMLElement[];
		assert.strictEqual(radios.length, 2);
		assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-honest-status')?.textContent, 'Input needed');
		assert.strictEqual(seat.element.getAttribute('aria-label'), 'Question, Input needed, Pick one');
		assert.strictEqual(radios[0].getAttribute('aria-checked'), 'true');
		assert.strictEqual(radios[1].getAttribute('aria-checked'), 'false');

		radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true, cancelable: true }));

		assert.strictEqual(radios[0].getAttribute('aria-checked'), 'false');
		assert.strictEqual(radios[1].getAttribute('aria-checked'), 'true');
		const submit = seat.element.querySelector('.conversation-lens-question-actions .monaco-button') as HTMLElement;
		assert.ok(submit);
		submit.click();
		assert.strictEqual(responded.length, 1);
		assert.deepStrictEqual([...labelsOf(responded[0], 'q1')], ['beta']);
	});

	test('required radio with a blank label does not respond', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['   '], allowCustom: true }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: requestId => responded.push(requestId),
		}));
		const radio = seat.element.querySelector('[role="radio"]') as HTMLElement;
		assert.strictEqual(radio.getAttribute('aria-checked'), 'true');
		const submit = seat.element.querySelector('.conversation-lens-question-actions .monaco-button') as HTMLElement;
		assert.ok(submit);
		submit.click();
		assert.deepStrictEqual(responded, []);
	});

	test('multi-select arrows do not write selections', () => {
		const responded: ConversationQuestionRespondAnswers[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick any',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['a', 'b'], multiSelect: true, allowCustom: true }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: (_requestId, answers) => responded.push(answers),
		}));
		const boxes = [...seat.element.querySelectorAll('[role="checkbox"]')] as HTMLElement[];
		boxes[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true, cancelable: true }));
		const submit = seat.element.querySelector('.conversation-lens-question-actions .monaco-button') as HTMLElement;
		submit.click();
		assert.strictEqual(responded.length, 1);
		assert.deepStrictEqual([...labelsOf(responded[0], 'q1')], []);
	});

	test('invalid answer keys and no payload show an honest empty state', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['a', 'a'] }],
			answerKeysValid: false,
			questionRequestId: 'req-1',
			onRespond: requestId => responded.push(requestId),
		}));
		const note = seat.element.querySelector('.conversation-lens-question-unanswerable');
		const reason = "Can't answer — these choices can't be submitted.";
		assert.strictEqual(note?.textContent, reason);
		assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-body--honest')?.textContent, 'Pick one');
		assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-honest-status')?.textContent, reason);
		assert.strictEqual(seat.element.getAttribute('aria-label'), `Question, ${reason}, Pick one`);
		assert.strictEqual(seat.element.querySelector('[role="radio"]'), null);
		assert.strictEqual(seat.element.querySelector('[role="checkbox"]'), null);
		assert.strictEqual(seat.element.querySelector('.monaco-button'), null);
		assert.deepStrictEqual(responded, []);
	});

	test('answered question without a payload does not add an unanswerable note', () => {
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Already picked',
			status: 'allowed',
			answerKeysValid: false,
		}));
		assert.strictEqual(seat.element.querySelector('.conversation-lens-question-unanswerable'), null);
		assert.ok(seat.element.textContent?.includes('Already picked'));
		assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-honest-status')?.textContent, 'Answered');
		assert.strictEqual(seat.element.getAttribute('aria-label'), 'Question, Answered, Already picked');
	});

	test('blocked seat with a payload preview still names the blocked reason', () => {
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [],
			payload: 'left · right',
			onRespond: () => { },
		}));
		const reason = "Can't answer — there are no choices.";
		assert.strictEqual(seat.element.querySelector('.conversation-lens-question-unanswerable'), null);
		assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-honest-status')?.textContent, reason);
		assert.strictEqual(seat.element.getAttribute('aria-label'), `Question, ${reason}, Pick one`);
		assert.ok(seat.element.textContent?.includes('left'));
		assert.ok(!seat.element.textContent?.includes('Input needed'));
	});
});
