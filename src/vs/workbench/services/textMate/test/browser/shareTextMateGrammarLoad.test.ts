/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareTextMateGrammarLoad } from '../../browser/backgroundTokenization/worker/textMateTokenizationWorker.worker.js';

function loadGrammar<T>(current: { value: Promise<T> | undefined }, load: () => Promise<T>): Promise<T> {
	return shareTextMateGrammarLoad(
		() => current.value,
		next => { current.value = next; },
		load,
	);
}

suite('shareTextMateGrammarLoad', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected grammar load is not reused; the next load loads again', async () => {
		const current: { value: Promise<string> | undefined } = { value: undefined };
		const error = new Error('grammar load failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('grammar');
		};

		const first = loadGrammar(current, load);
		const second = loadGrammar(current, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected load must not call load again inside the same call');
		assert.strictEqual(current.value, undefined);

		const third = loadGrammar(current, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'grammar');
		assert.strictEqual(starts, 2, 'the next load must load again');
		await loadGrammar(current, load);
		assert.strictEqual(starts, 2, 'a fulfilled load stays cached');
	});

	test('a rejection does not clear a replacement already stored for that grammar', async () => {
		const current: { value: Promise<string> | undefined } = { value: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = loadGrammar(current, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('grammar-replacement');
		current.value = replacement;

		const error = new Error('late grammar load failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(current.value, replacement);

		let starts = 0;
		const second = loadGrammar(current, () => {
			starts++;
			return Promise.resolve('grammar-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
