/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { shareWebSocketUpstreamConnect } from '../../node/agentHostChannel.js';

suite('shareWebSocketUpstreamConnect', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('concurrent connects share one in-flight promise and call doConnect once', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		let starts = 0;
		let resolveFirst: (() => void) | undefined;
		const doConnect = () => {
			starts++;
			return new Promise<void>(resolve => {
				resolveFirst = resolve;
			});
		};

		const first = shareWebSocketUpstreamConnect(slot, doConnect);
		const second = shareWebSocketUpstreamConnect(slot, doConnect);
		assert.strictEqual(first, second);
		assert.strictEqual(slot.promise, first);
		assert.strictEqual(starts, 1);

		resolveFirst!();
		await first;
		await second;
		assert.strictEqual(slot.promise, first);
	});

	test('surfaces a rejection without retrying, then the next connect calls doConnect again', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		const error = new Error('upstream connect failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const doConnect = () => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		};

		const first = shareWebSocketUpstreamConnect(slot, doConnect);
		const second = shareWebSocketUpstreamConnect(slot, doConnect);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected connect must not call doConnect again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		await shareWebSocketUpstreamConnect(slot, doConnect);
		assert.strictEqual(starts, 2, 'the next connect must call doConnect again');
		await shareWebSocketUpstreamConnect(slot, doConnect);
		assert.strictEqual(starts, 2, 'a fulfilled connect stays cached');
	});

	test('does not call doConnect again after the first connect succeeds', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		let starts = 0;
		const doConnect = () => {
			starts++;
			return Promise.resolve();
		};

		const first = shareWebSocketUpstreamConnect(slot, doConnect);
		const second = shareWebSocketUpstreamConnect(slot, doConnect);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);
		await first;
		await second;
		await shareWebSocketUpstreamConnect(slot, doConnect);
		assert.strictEqual(starts, 1);
		assert.strictEqual(slot.promise, first);
	});

	test('a rejection clears the slot only while it still points at that attempt', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareWebSocketUpstreamConnect(slot, () => {
			starts++;
			return new Promise<void>((_resolve, reject) => {
				rejectFirst = reject;
			});
		});
		const replacement = Promise.resolve();
		slot.promise = replacement;

		const error = new Error('late upstream connect failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);

		assert.strictEqual(slot.promise, replacement);
		const second = shareWebSocketUpstreamConnect(slot, () => {
			starts++;
			return Promise.resolve();
		});
		assert.strictEqual(second, replacement);
		await second;
		assert.strictEqual(starts, 1);

		const cleared: { promise: Promise<void> | undefined } = { promise: undefined };
		let rejectCleared: ((reason: unknown) => void) | undefined;
		const dropped = shareWebSocketUpstreamConnect(cleared, () => new Promise<void>((_resolve, reject) => {
			rejectCleared = reject;
		}));
		cleared.promise = undefined;
		const droppedError = new Error('cleared while connecting');
		rejectCleared!(droppedError);
		await assert.rejects(dropped, (reason: unknown) => reason === droppedError);
		assert.strictEqual(cleared.promise, undefined);
	});
});
