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
});
