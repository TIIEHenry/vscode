/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareStorageInitialization } from '../../common/storage.js';

suite('shareStorageInitialization', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected storage initialization is not reused; the next call initializes again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('storage initialization failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('storage');
		};

		const first = shareStorageInitialization(slot, load);
		const second = shareStorageInitialization(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected initialization must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareStorageInitialization(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'storage');
		assert.strictEqual(starts, 2, 'the next call must load again');
		await shareStorageInitialization(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled initialization stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareStorageInitialization(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('storage-replacement');
		slot.promise = replacement;

		const error = new Error('late storage initialization failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareStorageInitialization(slot, () => {
			starts++;
			return Promise.resolve('storage-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
