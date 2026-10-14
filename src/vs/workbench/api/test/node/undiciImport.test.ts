/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareUndiciImport } from '../../node/extHostMcpNode.js';

suite('shareUndiciImport', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected undici import is not reused; the next read imports again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('undici import failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('undici');
		};

		const first = shareUndiciImport(slot, load);
		const second = shareUndiciImport(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected import must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareUndiciImport(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'undici');
		assert.strictEqual(starts, 2, 'the next read must import again');
		await shareUndiciImport(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled import stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareUndiciImport(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('undici-replacement');
		slot.promise = replacement;

		const error = new Error('late undici import failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareUndiciImport(slot, () => {
			starts++;
			return Promise.resolve('undici-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
