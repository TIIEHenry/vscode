/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../utils.js';
import { shareWebWorkerModuleLoad } from '../../../common/worker/webWorker.js';

function loadModule(current: { value: Promise<void> | undefined }, initialize: () => Promise<void>): Promise<void> {
	return shareWebWorkerModuleLoad(
		() => current.value,
		next => { current.value = next; },
		initialize,
	);
}

suite('shareWebWorkerModuleLoad', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected module initialize is not reused; the next call initializes again', async () => {
		const current: { value: Promise<void> | undefined } = { value: undefined };
		const error = new Error('worker module initialize failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const initialize = () => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		};

		const first = loadModule(current, initialize);
		const second = loadModule(current, initialize);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected initialize must not call initialize again inside the same call');
		assert.strictEqual(current.value, undefined);

		const third = loadModule(current, initialize);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next call must initialize again');
		await third;
		await loadModule(current, initialize);
		assert.strictEqual(starts, 2, 'a fulfilled initialize stays cached');
	});

	test('a rejection does not clear a replacement already stored for that initialize', async () => {
		const current: { value: Promise<void> | undefined } = { value: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = loadModule(current, () => new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve();
		current.value = replacement;

		const error = new Error('late worker module initialize failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(current.value, replacement);

		let starts = 0;
		const second = loadModule(current, () => {
			starts++;
			return Promise.resolve();
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
