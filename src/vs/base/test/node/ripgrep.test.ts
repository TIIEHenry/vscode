/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';
import { shareRgDiskPath } from '../../node/ripgrep.js';

suite('shareRgDiskPath', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected lookup is not reused; the next lookup calls load again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('ripgrep path failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('/usr/bin/rg');
		};

		const first = shareRgDiskPath(slot, load);
		const second = shareRgDiskPath(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected lookup must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareRgDiskPath(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, '/usr/bin/rg');
		assert.strictEqual(starts, 2, 'the next lookup must call load again');
		await shareRgDiskPath(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled lookup stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareRgDiskPath(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('/usr/bin/rg-replacement');
		slot.promise = replacement;

		const error = new Error('late ripgrep path failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareRgDiskPath(slot, () => {
			starts++;
			return Promise.resolve('/usr/bin/rg-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
