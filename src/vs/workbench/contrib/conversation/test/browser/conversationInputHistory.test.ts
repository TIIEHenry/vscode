/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import {
	buildSessionUserInputHistory,
	createInputHistoryBrowseState,
	exitInputHistoryBrowse,
	navigateInputHistoryBrowse,
} from '../../browser/conversationInputHistory.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('ConversationInputHistory', () => {

	test('buildSessionUserInputHistory keeps user turns newest-first and ignores other kinds', () => {
		const turns: ConversationStubTurn[] = [
			{ id: '1', kind: 'user', text: 'first' },
			{ id: '2', kind: 'assistant', text: 'reply', stubEcho: true },
			{ id: '3', kind: 'thinking', text: 'hmm' },
			{ id: '4', kind: 'user', text: 'second' },
			{ id: '5', kind: 'confirmation', text: 'ok?', status: 'pending' },
			{ id: '6', kind: 'tool', text: 'grep' },
		];
		assert.deepStrictEqual([...buildSessionUserInputHistory(turns)], ['second', 'first']);
	});

	test('navigateInputHistoryBrowse walks older then newer and restores saved draft', () => {
		const history = ['second', 'first'];
		let state = createInputHistoryBrowseState();

		let result = navigateInputHistoryBrowse(history, state, 'older', '');
		assert.strictEqual(result.handled, true);
		assert.strictEqual(result.textareaValue, 'second');
		state = result.state;

		result = navigateInputHistoryBrowse(history, state, 'older', result.textareaValue!);
		assert.strictEqual(result.handled, true);
		assert.strictEqual(result.textareaValue, 'first');
		state = result.state;

		result = navigateInputHistoryBrowse(history, state, 'newer', result.textareaValue!);
		assert.strictEqual(result.handled, true);
		assert.strictEqual(result.textareaValue, 'second');
		state = result.state;

		result = navigateInputHistoryBrowse(history, state, 'newer', result.textareaValue!);
		assert.strictEqual(result.handled, true);
		assert.strictEqual(result.textareaValue, '');
		assert.strictEqual(result.state.browseIndex, -1);
	});

	test('navigateInputHistoryBrowse ignores ArrowUp when composer is not trim-empty', () => {
		const history = ['only'];
		const state = createInputHistoryBrowseState();
		const result = navigateInputHistoryBrowse(history, state, 'older', 'typing');
		assert.strictEqual(result.handled, false);
		assert.strictEqual(result.textareaValue, undefined);
	});

	test('exitInputHistoryBrowse restores whitespace draft snapshot', () => {
		let state = createInputHistoryBrowseState();
		const enter = navigateInputHistoryBrowse(['sent'], state, 'older', '  ');
		state = enter.state;
		const exit = exitInputHistoryBrowse(state);
		assert.strictEqual(exit.handled, true);
		assert.strictEqual(exit.textareaValue, '  ');
		assert.strictEqual(exit.state.browseIndex, -1);
	});
});
