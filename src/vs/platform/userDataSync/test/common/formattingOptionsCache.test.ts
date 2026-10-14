/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareFormattingOptions } from '../../common/formattingOptionsCache.js';

suite('shareFormattingOptions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected formatting-options read is not reused; the next read resolves again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('formatting options failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('options');
		};

		const first = shareFormattingOptions(slot, load);
		const second = shareFormattingOptions(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareFormattingOptions(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'options');
		assert.strictEqual(starts, 2, 'the next read must resolve again');
		await shareFormattingOptions(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareFormattingOptions(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('options-replacement');
		slot.promise = replacement;

		const error = new Error('late formatting options failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareFormattingOptions(slot, () => {
			starts++;
			return Promise.resolve('options-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
