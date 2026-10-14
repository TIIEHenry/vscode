/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareLocalProcessExtensionHostStart } from '../../electron-browser/localProcessExtensionHostStart.js';

suite('shareLocalProcessExtensionHostStart', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected local process extension host start is not reused; the next read starts again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('local process extension host start failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('protocol');
		};

		const first = shareLocalProcessExtensionHostStart(slot, load);
		const second = shareLocalProcessExtensionHostStart(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareLocalProcessExtensionHostStart(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'protocol');
		assert.strictEqual(starts, 2, 'the next read must start again');
		await shareLocalProcessExtensionHostStart(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareLocalProcessExtensionHostStart(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('protocol-replacement');
		slot.promise = replacement;

		const error = new Error('late local process extension host start failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareLocalProcessExtensionHostStart(slot, () => {
			starts++;
			return Promise.resolve('protocol-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
