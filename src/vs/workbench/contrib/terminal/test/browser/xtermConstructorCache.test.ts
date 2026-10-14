/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareXtermConstructor } from '../../browser/xtermConstructorCache.js';

suite('shareXtermConstructor', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected load is not reused; the next load calls load again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('xterm load failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('xterm');
		};

		const first = shareXtermConstructor(slot, load);
		const second = shareXtermConstructor(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected load must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareXtermConstructor(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'xterm');
		assert.strictEqual(starts, 2, 'the next load must call load again');
		await shareXtermConstructor(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled load stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareXtermConstructor(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		slot.promise = replacement;

		const error = new Error('late xterm load failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareXtermConstructor(slot, () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
