/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService } from '../../../log/common/log.js';
import { getResolvedShellEnv, IShellEnvAttemptSlot, loadShellEnvAttempt } from '../../node/shellEnv.js';

suite('loadShellEnvAttempt', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createSlot(): IShellEnvAttemptSlot<{ id: string }> {
		return { promise: undefined };
	}

	test('resolves again after the cached promise rejects', async () => {
		const slot = createSlot();
		const error = new Error('shell env failed');
		let calls = 0;
		const resolve = () => {
			calls++;
			if (calls === 1) {
				return Promise.reject(error);
			}
			return Promise.resolve({ id: 'ok' });
		};

		const first = loadShellEnvAttempt(slot, resolve);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(calls, 1);
		assert.strictEqual(slot.promise, undefined);

		const second = loadShellEnvAttempt(slot, resolve);
		assert.notStrictEqual(second, first);
		assert.deepStrictEqual(await second, { id: 'ok' });
		assert.strictEqual(calls, 2);
		assert.strictEqual(loadShellEnvAttempt(slot, resolve), second);
		assert.strictEqual(calls, 2);
	});

	test('shares one resolution while it is in flight', async () => {
		const slot = createSlot();
		let resolveResult!: (value: { id: string }) => void;
		let calls = 0;
		const resolve = () => {
			calls++;
			return new Promise<{ id: string }>(resolveResultInner => { resolveResult = resolveResultInner; });
		};

		const first = loadShellEnvAttempt(slot, resolve);
		const second = loadShellEnvAttempt(slot, resolve);
		assert.strictEqual(calls, 1);
		assert.strictEqual(second, first);

		resolveResult({ id: 'ok' });
		assert.deepStrictEqual(await first, { id: 'ok' });
		assert.deepStrictEqual(await second, { id: 'ok' });
		assert.strictEqual(loadShellEnvAttempt(slot, resolve), first);
		assert.strictEqual(calls, 1);
	});

	test('does not resolve again after success', async () => {
		const slot = createSlot();
		let calls = 0;
		const resolve = () => {
			calls++;
			return Promise.resolve({ id: 'ok' });
		};

		const first = loadShellEnvAttempt(slot, resolve);
		assert.deepStrictEqual(await first, { id: 'ok' });
		const second = loadShellEnvAttempt(slot, resolve);
		assert.strictEqual(second, first);
		assert.deepStrictEqual(await second, { id: 'ok' });
		assert.strictEqual(calls, 1);
	});

	test('a rejection drops the slot only while it still points at that attempt', async () => {
		const slot = createSlot();
		let rejectAttempt!: (error: Error) => void;
		let calls = 0;
		const first = loadShellEnvAttempt(slot, () => {
			calls++;
			return new Promise<{ id: string }>((_resolve, reject) => { rejectAttempt = reject; });
		});
		const replacement = Promise.resolve({ id: 'newer' });
		slot.promise = replacement;

		const error = new Error('late failure');
		rejectAttempt(error);
		await assert.rejects(first, (reason: unknown) => reason === error);

		assert.strictEqual(slot.promise, replacement);
		const second = loadShellEnvAttempt(slot, () => {
			calls++;
			return Promise.resolve({ id: 'other' });
		});
		assert.strictEqual(second, replacement);
		assert.deepStrictEqual(await second, { id: 'newer' });
		assert.strictEqual(calls, 1);
	});

	test('force-disable-user-env returns an empty environment without spawning', async () => {
		const env = await getResolvedShellEnv(undefined!, new NullLogService(), { _: [], 'force-disable-user-env': true }, process.env);
		assert.deepStrictEqual(env, {});
	});
});
