/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { awaitCachedFlight } from '../../browser/userDataSyncViews.js';

suite('awaitCachedFlight', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('an in-flight read is shared; a rejection is not reused; a fulfillment stays cached', async () => {
		let slot: Promise<string> | undefined;
		const read = () => slot;
		const write = (promise: Promise<string> | undefined) => { slot = promise; };
		const error = new Error('machines failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const create = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('machines');
		};

		const first = awaitCachedFlight(read, write, create);
		const second = awaitCachedFlight(read, write, create);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call create again inside the same call');
		assert.strictEqual(slot, undefined);

		const third = awaitCachedFlight(read, write, create);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next read must start again');
		assert.strictEqual(await third, 'machines');
		await awaitCachedFlight(read, write, create);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored for that slot', async () => {
		let slot: Promise<string> | undefined;
		const read = () => slot;
		const write = (promise: Promise<string> | undefined) => { slot = promise; };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = awaitCachedFlight(read, write, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		slot = replacement;

		const error = new Error('late machines failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot, replacement);

		let starts = 0;
		const second = awaitCachedFlight(read, write, () => {
			starts++;
			return Promise.resolve('created');
		});
		assert.strictEqual(await second, 'replacement');
		assert.strictEqual(starts, 0);
	});
});
