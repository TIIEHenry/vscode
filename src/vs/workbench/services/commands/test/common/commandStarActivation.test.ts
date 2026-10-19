/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareCommandStarActivation } from '../../common/commandStarActivation.js';

suite('shareCommandStarActivation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected star activation is not reused; the next activation starts again', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		const error = new Error('star activation failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		};

		const first = shareCommandStarActivation(slot, load);
		const second = shareCommandStarActivation(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected activation must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareCommandStarActivation(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next activation must start again');
		await third;
		await shareCommandStarActivation(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled activation stays cached');
	});

	test('a rejection does not clear a replacement already stored for that slot', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareCommandStarActivation(slot, () => new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve();
		slot.promise = replacement;

		const error = new Error('late star activation failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareCommandStarActivation(slot, () => {
			starts++;
			return Promise.resolve();
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
