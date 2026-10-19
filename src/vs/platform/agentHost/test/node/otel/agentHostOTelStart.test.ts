/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IAgentHostOTelStartSlot, shareAgentHostOTelStart } from '../../../node/otel/agentHostOTelService.js';

suite('shareAgentHostOTelStart', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a failed start is not reused; the next start begins again and a success stays cached', async () => {
		const slot: IAgentHostOTelStartSlot = { promise: undefined };
		const error = new Error('otel start failed');
		let starts = 0;
		let failures = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const start = () => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		};
		const onFailure = (err: unknown) => {
			failures++;
			assert.strictEqual(err, error);
		};

		const first = shareAgentHostOTelStart(slot, start, onFailure);
		const second = shareAgentHostOTelStart(slot, start, onFailure);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);
		assert.strictEqual(slot.promise, first);

		rejectFirst!(error);
		await first;
		await second;
		assert.strictEqual(failures, 1);
		assert.strictEqual(starts, 1, 'a rejected start must not call start again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareAgentHostOTelStart(slot, start, () => { failures++; });
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next start must begin again');
		await third;
		const fourth = shareAgentHostOTelStart(slot, start, () => { failures++; });
		assert.strictEqual(fourth, third);
		await fourth;
		assert.strictEqual(starts, 2, 'a fulfilled start stays cached');
		assert.strictEqual(failures, 1);
		assert.strictEqual(slot.promise, third);
	});

	test('a synchronous start failure still frees the slot for the next call', async () => {
		const slot: IAgentHostOTelStartSlot = { promise: undefined };
		const error = new Error('sync otel start failed');
		let starts = 0;
		let seen: unknown;
		const start = () => {
			starts++;
			if (starts === 1) {
				throw error;
			}
			return Promise.resolve();
		};

		const first = shareAgentHostOTelStart(slot, start, err => { seen = err; });
		assert.strictEqual(seen, error);
		assert.strictEqual(slot.promise, undefined);
		await first;

		const second = shareAgentHostOTelStart(slot, start, () => { throw new Error('should not fail'); });
		await second;
		assert.strictEqual(starts, 2);
		assert.strictEqual(slot.promise, second);
	});

	test('a failure does not clear a replacement already stored for that slot', async () => {
		const slot: IAgentHostOTelStartSlot = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		let failures = 0;
		const first = shareAgentHostOTelStart(slot, () => new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		}), () => { failures++; });
		const replacement = Promise.resolve();
		slot.promise = replacement;

		rejectFirst!(new Error('late otel start failure'));
		await first;
		assert.strictEqual(failures, 1);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareAgentHostOTelStart(slot, () => {
			starts++;
			return Promise.resolve();
		}, () => { failures++; });
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
		assert.strictEqual(failures, 1);
	});
});
