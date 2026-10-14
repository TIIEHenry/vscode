/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareKatexLoad } from '../../browser/markedKatexSupport.js';

suite('shareKatexLoad', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected KaTeX load is not reused; the next load calls load again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('katex failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('katex');
		};

		const first = shareKatexLoad(slot, load);
		const second = shareKatexLoad(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected load must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareKatexLoad(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'katex');
		assert.strictEqual(starts, 2, 'the next load must call load again');
		await shareKatexLoad(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled load stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareKatexLoad(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('katex-replacement');
		slot.promise = replacement;

		const error = new Error('late katex failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareKatexLoad(slot, () => {
			starts++;
			return Promise.resolve('katex-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
