/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareByokProxyHandle } from '../../node/copilot/copilotSessionLauncher.js';

suite('shareByokProxyHandle', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected BYOK proxy start is not reused; the next start begins again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('BYOK proxy start failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('http://127.0.0.1:1');
		};

		const first = shareByokProxyHandle(slot, load);
		const second = shareByokProxyHandle(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected start must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareByokProxyHandle(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next start must begin again');
		await third;
		await shareByokProxyHandle(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled start stays cached');
	});

	test('a rejection does not clear a replacement already stored for that slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareByokProxyHandle(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('http://127.0.0.1:2');
		slot.promise = replacement;

		const error = new Error('late BYOK proxy start failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareByokProxyHandle(slot, () => {
			starts++;
			return Promise.resolve('http://127.0.0.1:3');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
