/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareChatEditingDiff } from '../../browser/chatEditing/shareChatEditingDiff.js';

suite('shareChatEditingDiff', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected chat editing diff is not reused; the next call computes again', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		const error = new Error('chat editing diff failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const compute = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('diff');
		};

		const first = shareChatEditingDiff(slot, compute);
		const second = shareChatEditingDiff(slot, compute);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected diff must not call compute again inside the same call');
		assert.strictEqual(slot.promise, null);

		const third = shareChatEditingDiff(slot, compute);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next call must compute again');
		await third;
		await shareChatEditingDiff(slot, compute);
		assert.strictEqual(starts, 2, 'a fulfilled diff stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareChatEditingDiff(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		slot.promise = replacement;

		const error = new Error('late chat editing diff failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareChatEditingDiff(slot, () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
