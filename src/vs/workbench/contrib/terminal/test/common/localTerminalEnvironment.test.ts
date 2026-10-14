/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareLocalTerminalEnvironment } from '../../common/localTerminalEnvironment.js';

suite('shareLocalTerminalEnvironment', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected local terminal environment read is not reused; the next read resolves again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('local terminal environment failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('env');
		};

		const first = shareLocalTerminalEnvironment(slot, load);
		const second = shareLocalTerminalEnvironment(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareLocalTerminalEnvironment(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'env');
		assert.strictEqual(starts, 2, 'the next read must resolve again');
		await shareLocalTerminalEnvironment(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareLocalTerminalEnvironment(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('env-replacement');
		slot.promise = replacement;

		const error = new Error('late local terminal environment failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareLocalTerminalEnvironment(slot, () => {
			starts++;
			return Promise.resolve('env-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
