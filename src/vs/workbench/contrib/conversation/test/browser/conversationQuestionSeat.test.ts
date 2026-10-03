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
		assert.ok(seat.element.textContent?.includes('Database'));
		assert.ok(seat.element.textContent?.includes('Region'));
		assert.strictEqual(groups[0].getAttribute('aria-label'), 'Database');
		assert.strictEqual(groups[1].getAttribute('aria-label'), 'Region');
		assert.ok(!groups[0].textContent?.includes('Database'));
		assert.ok(!groups[1].textContent?.includes('Region'));
		assert.deepStrictEqual(
			[...seat.element.querySelectorAll('.conversation-lens-question-stem')].map(el => el.textContent),
			['Database', 'Region'],
		);
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

	test('arrowing a required radio counts when the other group is confirmed', () => {
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
		const groups = [...seat.element.querySelectorAll('[role="radiogroup"]')] as HTMLElement[];
		const db = [...groups[0].querySelectorAll('[role="radio"]')] as HTMLElement[];
		const region = [...groups[1].querySelectorAll('[role="radio"]')] as HTMLElement[];
		const arrowRight = (radio: HTMLElement): void => {
			radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true, cancelable: true }));
		};

		arrowRight(db[0]);
		arrowRight(region[0]);
		assert.deepStrictEqual(responded, []);
		assert.strictEqual(db[1].getAttribute('aria-checked'), 'true');
		assert.strictEqual(region[1].getAttribute('aria-checked'), 'true');

		region[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
		assert.strictEqual(responded.length, 1);
		assert.deepStrictEqual([...labelsOf(responded[0], 'db')], ['sqlite']);
		assert.deepStrictEqual([...labelsOf(responded[0], 'region')], ['eu']);

		db[0].click();
		region[0].click();
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

	test('non-retryable respond failure does not ask for input or offer Submit', () => {
		const responded: string[] = [];
		const reason = "Can't answer — this response can't be sent again.";
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['alpha', 'beta'] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			respondFailure: { retryable: false, error: 'gone' },
			onRespond: requestId => responded.push(requestId),
		}));
		assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-honest-status')?.textContent, reason);
		assert.strictEqual(seat.element.getAttribute('aria-label'), `Question, ${reason}, Pick one`);
		assert.strictEqual(seat.element.querySelector('[role="radio"]'), null);
		assert.strictEqual(seat.element.querySelector('.monaco-button'), null);
		assert.ok(seat.element.textContent?.includes("Couldn't send this response: gone"));
		assert.ok(!seat.element.textContent?.includes('Input needed'));
		assert.ok(!seat.element.textContent?.includes("Can't answer — submitting isn't available."));
		assert.deepStrictEqual(responded, []);
	});

	test('retryable respond failure still submits the chosen radio', () => {
		const responded: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['alpha'] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			respondFailure: { retryable: true, error: 'ipc closed' },
			onRespond: requestId => responded.push(requestId),
		}));
		assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-honest-status')?.textContent, 'Input needed');
		assert.ok(seat.element.textContent?.includes("Couldn't send this response: ipc closed"));
		const radio = seat.element.querySelector('[role="radio"]') as HTMLElement;
		radio.click();
		assert.deepStrictEqual(responded, ['req-1']);
	});

	test('two required radios paint each question stem in the seat text, not only on the aria-label', () => {
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Ask',
			status: 'pending',
			questionItems: [
				{ id: 'db', title: 'Which?', options: ['A', 'B'] },
				{ id: 'region', title: 'Where?', options: ['us', 'eu'] },
			],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: () => { },
		}));
		const text = seat.element.textContent ?? '';
		assert.strictEqual(occurrences(text, 'Which?'), 1);
		assert.strictEqual(occurrences(text, 'Where?'), 1);
		const groups = [...seat.element.querySelectorAll('[role="radiogroup"]')] as HTMLElement[];
		assert.strictEqual(groups.length, 2);
		assert.strictEqual(groups[0].getAttribute('aria-label'), 'Which?');
		assert.strictEqual(groups[1].getAttribute('aria-label'), 'Where?');
		assert.ok(!groups[0].textContent?.includes('Which?'));
		assert.ok(!groups[1].textContent?.includes('Where?'));
		assert.strictEqual(groups[0].previousElementSibling?.textContent, 'Which?');
		assert.strictEqual(groups[1].previousElementSibling?.textContent, 'Where?');
		const withoutAria = stripAriaLabels(seat.element);
		assert.ok(withoutAria.includes('Which?'));
		assert.ok(withoutAria.includes('Where?'));
		assert.strictEqual(occurrences(withoutAria, 'Which?'), 1);
		assert.strictEqual(occurrences(withoutAria, 'Where?'), 1);
	});

	test('a single question already used as the seat body is not painted again', () => {
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Which?',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Which?', options: ['A', 'B'] }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: () => { },
		}));
		const text = seat.element.textContent ?? '';
		assert.strictEqual(occurrences(text, 'Which?'), 1);
		assert.strictEqual(seat.element.querySelector('.conversation-lens-question-stem'), null);
		const group = seat.element.querySelector('[role="radiogroup"]') as HTMLElement;
		assert.strictEqual(group.getAttribute('aria-label'), 'Which?');
		assert.ok(!group.textContent?.includes('Which?'));
		assert.strictEqual(occurrences(stripAriaLabels(seat.element), 'Which?'), 1);
	});

	test('answered and non-retryable option previews keep each question stem once', () => {
		const questionItems = [
			{ id: 'db', title: 'Which?', options: ['A', 'B'] },
			{ id: 'region', title: 'Where?', options: ['us', 'eu'] },
			{ id: 'same', title: 'Ask', options: ['x'] },
			{ id: 'blank', title: '   ', options: ['y'] },
			{ id: 'empty', title: 'Gone?', options: [] },
		];
		const seats = [
			store.add(new ConversationQuestionSeat({
				message: 'Ask',
				status: 'allowed',
				questionItems,
				payload: 'A · us',
			})),
			store.add(new ConversationQuestionSeat({
				message: 'Ask',
				status: 'pending',
				questionItems,
				answerKeysValid: true,
				questionRequestId: 'req-1',
				payload: 'A · us',
				respondFailure: { retryable: false, error: 'gone' },
				onRespond: () => { },
			})),
		];
		for (const seat of seats) {
			const text = seat.element.textContent ?? '';
			assert.strictEqual(seat.element.querySelector('.conversation-lens-turn-body--honest')?.textContent, 'Ask');
			assert.strictEqual(occurrences(text, 'Which?'), 1);
			assert.strictEqual(occurrences(text, 'Where?'), 1);
			assert.strictEqual(occurrences(text, 'Ask'), 1);
			assert.ok(!text.includes('Gone?'));
			const stems = [...seat.element.querySelectorAll('.conversation-lens-question-stem')];
			assert.deepStrictEqual(stems.map(stem => stem.textContent), ['Which?', 'Where?']);
			const preview = seat.element.querySelector('ul.conversation-lens-question-options');
			assert.ok(preview);
			assert.strictEqual(stems[1].nextElementSibling, preview);
			assert.strictEqual(seat.element.querySelector('[role="radiogroup"]'), null);
			assert.strictEqual(seat.element.querySelector('.monaco-button'), null);
			assert.ok(!text.includes('Submit'));
		}
	});
});

function occurrences(text: string, needle: string): number {
	return text.split(needle).length - 1;
}

function stripAriaLabels(root: HTMLElement): string {
	const clone = root.cloneNode(true) as HTMLElement;
	clone.removeAttribute('aria-label');
	for (const el of clone.querySelectorAll('[aria-label]')) {
		el.removeAttribute('aria-label');
	}
	return clone.textContent ?? '';
}
