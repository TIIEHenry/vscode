/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareIndexedDBFiletree } from '../../browser/indexedDBFileSystemProvider.js';

suite('shareIndexedDBFiletree', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected IndexedDB file tree read is not reused; the next read loads again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('indexedDB file tree read failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('filetree');
		};

		const first = shareIndexedDBFiletree(slot, load);
		const second = shareIndexedDBFiletree(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareIndexedDBFiletree(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'filetree');
		assert.strictEqual(starts, 2, 'the next read must load again');
		await shareIndexedDBFiletree(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareIndexedDBFiletree(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('filetree-replacement');
		slot.promise = replacement;

		const error = new Error('late indexedDB file tree failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareIndexedDBFiletree(slot, () => {
			starts++;
			return Promise.resolve('filetree-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
