/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareRemoteAgentConnection } from '../../common/shareRemoteAgentConnection.js';

suite('shareRemoteAgentConnection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected remote agent connection is not reused; the next call connects again', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		const error = new Error('remote agent connection failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const connect = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('connection');
		};

		const first = shareRemoteAgentConnection(slot, connect);
		const second = shareRemoteAgentConnection(slot, connect);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected connection must not call connect again inside the same call');
		assert.strictEqual(slot.promise, null);

		const third = shareRemoteAgentConnection(slot, connect);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next call must connect again');
		await third;
		await shareRemoteAgentConnection(slot, connect);
		assert.strictEqual(starts, 2, 'a fulfilled connection stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareRemoteAgentConnection(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		slot.promise = replacement;

		const error = new Error('late remote agent connection failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareRemoteAgentConnection(slot, () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
