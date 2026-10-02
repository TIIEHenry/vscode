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
		assert.strictEqual(
			seat.element.querySelector('.conversation-lens-question-required-missing')?.textContent,
			"Can't submit — a required choice is empty.",
		);
		assert.strictEqual(seat.element.querySelector('.conversation-lens-question-required-missing')?.getAttribute('role'), 'alert');
	});

	test('moving to a non-empty choice clears the empty-choice alert and submits', () => {
		const responded: ConversationQuestionRespondAnswers[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['   ', 'beta'], allowCustom: true }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: (_requestId, answers) => responded.push(answers),
		}));
		const radios = [...seat.element.querySelectorAll('[role="radio"]')] as HTMLElement[];
		const submit = seat.element.querySelector('.conversation-lens-question-actions .monaco-button') as HTMLElement;
		submit.click();
		assert.ok(seat.element.querySelector('.conversation-lens-question-required-missing'));
		radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true, cancelable: true }));
		assert.strictEqual(seat.element.querySelector('.conversation-lens-question-required-missing'), null);
		submit.click();
		assert.strictEqual(responded.length, 1);
		assert.deepStrictEqual([...labelsOf(responded[0], 'q1')], ['beta']);
	});

	test('clicking a blank required radio explains why it did not submit', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['   '] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: requestId => responded.push(requestId),
		}));
		assert.strictEqual(seat.element.querySelector('.monaco-button'), null);
		const radio = seat.element.querySelector('[role="radio"]') as HTMLElement;
		radio.click();
		assert.deepStrictEqual(responded, []);
		assert.strictEqual(
			seat.element.querySelector('.conversation-lens-question-required-missing')?.textContent,
			"Can't submit — a required choice is empty.",
		);
	});

	test('enter in the custom field explains an empty required choice', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['   '], allowCustom: true }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: requestId => responded.push(requestId),
		}));
		const input = seat.element.querySelector('.conversation-lens-question-custom') as HTMLInputElement;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		assert.deepStrictEqual(responded, []);
		assert.strictEqual(
			seat.element.querySelector('.conversation-lens-question-required-missing')?.textContent,
			"Can't submit — a required choice is empty.",
		);
	});

	test('writes held does not explain an empty required choice', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['   '] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			writesEnabled: false,
			onRespond: requestId => responded.push(requestId),
		}));
		const radio = seat.element.querySelector('[role="radio"]') as HTMLElement;
		radio.click();
		assert.deepStrictEqual(responded, []);
		assert.strictEqual(seat.element.querySelector('.conversation-lens-question-required-missing'), null);
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

	test('two required radios do not submit the other group first option', () => {
		const responded: ConversationQuestionRespondAnswers[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick both',
			status: 'pending',
			questionItems: [
				{ id: 'db', title: 'Database', options: ['pg', 'sqlite'] },
				{ id: 'region', title: 'Region', options: ['us', 'eu'] },
			],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: (_requestId, answers) => responded.push(answers),
		}));
		assert.strictEqual(seat.element.querySelector('.monaco-button'), null);
		const groups = [...seat.element.querySelectorAll('[role="radiogroup"]')] as HTMLElement[];
		assert.strictEqual(groups.length, 2);
		const db = [...groups[0].querySelectorAll('[role="radio"]')] as HTMLElement[];
		const region = [...groups[1].querySelectorAll('[role="radio"]')] as HTMLElement[];
		assert.ok(db.every(radio => radio.getAttribute('aria-checked') !== 'true'));
		assert.ok(region.every(radio => radio.getAttribute('aria-checked') !== 'true'));

		db[1].click();
		assert.deepStrictEqual(responded, []);
		assert.strictEqual(db[1].getAttribute('aria-checked'), 'true');
		assert.ok(region.every(radio => radio.getAttribute('aria-checked') !== 'true'));

		region[0].click();
		assert.strictEqual(responded.length, 1);
		assert.deepStrictEqual([...labelsOf(responded[0], 'db')], ['sqlite']);
		assert.deepStrictEqual([...labelsOf(responded[0], 'region')], ['us']);
		assert.strictEqual(seat.element.getAttribute('aria-busy'), 'true');

		region[1].click();
		db[0].click();
		assert.strictEqual(responded.length, 1);
	});

	test('clicking the same radio twice posts one answer', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['alpha', 'beta'] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: requestId => responded.push(requestId),
		}));
		const radios = [...seat.element.querySelectorAll('[role="radio"]')] as HTMLElement[];
		radios[0].click();
		radios[0].click();
		radios[1].click();
		assert.deepStrictEqual(responded, ['req-1']);
		assert.strictEqual(seat.element.getAttribute('aria-busy'), 'true');
		assert.strictEqual(radios[0].getAttribute('aria-disabled'), 'true');
		assert.strictEqual(radios[0].getAttribute('aria-checked'), 'true');
		assert.strictEqual(radios[1].getAttribute('aria-checked'), 'false');
	});

	test('a second Submit does not post again', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick any',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['a', 'b'], multiSelect: true }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: requestId => responded.push(requestId),
		}));
		const boxes = [...seat.element.querySelectorAll('[role="checkbox"]')] as HTMLElement[];
		boxes[0].click();
		const submit = seat.element.querySelector('.conversation-lens-question-actions .monaco-button') as HTMLElement;
		submit.click();
		submit.click();
		boxes[1].click();
		assert.deepStrictEqual(responded, ['req-1']);
		assert.strictEqual(submit.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(boxes[0].getAttribute('aria-checked'), 'true');
		assert.strictEqual(boxes[1].getAttribute('aria-checked'), 'false');
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
