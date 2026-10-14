/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareWorkspaceTasksPromise } from '../../browser/workspaceTasksPromiseCache.js';

suite('shareWorkspaceTasksPromise', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('concurrent calls share one in-flight promise', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		let resolveFirst: ((value: string) => void) | undefined;
		const compute = () => {
			starts++;
			return new Promise<string>(resolve => {
				resolveFirst = resolve;
			});
		};

		const first = shareWorkspaceTasksPromise(slot, compute);
		const second = shareWorkspaceTasksPromise(slot, compute);
		assert.strictEqual(first, second);
		assert.strictEqual(slot.promise, first);
		assert.strictEqual(starts, 1);

		resolveFirst!('tasks');
		assert.strictEqual(await first, 'tasks');
		assert.strictEqual(await second, 'tasks');
		assert.strictEqual(slot.promise, first);
	});

	test('surfaces a rejection without retrying, then computes again on the next call', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('workspace tasks failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const compute = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('tasks');
		};

		const first = shareWorkspaceTasksPromise(slot, compute);
		const second = shareWorkspaceTasksPromise(slot, compute);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected computation must not start again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		assert.strictEqual(await shareWorkspaceTasksPromise(slot, compute), 'tasks');
		assert.strictEqual(starts, 2, 'the next call must compute again');
		assert.strictEqual(await shareWorkspaceTasksPromise(slot, compute), 'tasks');
		assert.strictEqual(starts, 2, 'a fulfilled task map stays cached');
	});

	test('returns the same success on the next call', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		const compute = () => {
			starts++;
			return Promise.resolve('tasks');
		};

		const first = shareWorkspaceTasksPromise(slot, compute);
		const second = shareWorkspaceTasksPromise(slot, compute);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);
		assert.strictEqual(await first, 'tasks');
		assert.strictEqual(await second, 'tasks');
		assert.strictEqual(await shareWorkspaceTasksPromise(slot, compute), 'tasks');
		assert.strictEqual(starts, 1);
		assert.strictEqual(slot.promise, first);
	});

	test('a rejection clears the slot only while it still points at that attempt', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareWorkspaceTasksPromise(slot, () => {
			starts++;
			return new Promise<string>((_resolve, reject) => {
				rejectFirst = reject;
			});
		});
		const replacement = Promise.resolve('newer');
		slot.promise = replacement;

		const error = new Error('late workspace tasks failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);

		assert.strictEqual(slot.promise, replacement);
		const second = shareWorkspaceTasksPromise(slot, () => {
			starts++;
			return Promise.resolve('other');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(await second, 'newer');
		assert.strictEqual(starts, 1);

		const cleared: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectCleared: ((reason: unknown) => void) | undefined;
		const dropped = shareWorkspaceTasksPromise(cleared, () => new Promise<string>((_resolve, reject) => {
			rejectCleared = reject;
		}));
		cleared.promise = undefined;
		const droppedError = new Error('cleared while computing');
		rejectCleared!(droppedError);
		await assert.rejects(dropped, (reason: unknown) => reason === droppedError);
		assert.strictEqual(cleared.promise, undefined);
	});

	test('reuse false replaces a cached success with a new computation', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		const first = shareWorkspaceTasksPromise(slot, () => {
			starts++;
			return Promise.resolve('first');
		});
		assert.strictEqual(await first, 'first');

		const second = shareWorkspaceTasksPromise(slot, () => {
			starts++;
			return Promise.resolve('second');
		}, false);
		assert.notStrictEqual(second, first);
		assert.strictEqual(await second, 'second');
		assert.strictEqual(starts, 2);
		assert.strictEqual(slot.promise, second);
		assert.strictEqual(shareWorkspaceTasksPromise(slot, () => {
			starts++;
			return Promise.resolve('third');
		}), second);
		assert.strictEqual(starts, 2);
	});
});
