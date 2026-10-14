/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareSecretStorageInit } from '../../common/secrets.js';

suite('shareSecretStorageInit', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected secret storage init is not reused; the next read initializes again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('encryption unavailable');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const create = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('storage');
		};

		const first = shareSecretStorageInit(slot, create);
		const second = shareSecretStorageInit(slot, create);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected init must not call create again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareSecretStorageInit(slot, create);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'storage');
		assert.strictEqual(starts, 2, 'the next read must initialize again');
		await shareSecretStorageInit(slot, create);
		assert.strictEqual(starts, 2, 'a fulfilled init stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareSecretStorageInit(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('storage-replacement');
		slot.promise = replacement;

		const error = new Error('late init failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareSecretStorageInit(slot, () => {
			starts++;
			return Promise.resolve('storage-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
