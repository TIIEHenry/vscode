/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareExtensionPathIndex, shareExtensionRealPath } from '../../common/extHostExtensionPathIndex.js';

suite('shareExtensionPathIndex', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected extension path index is not reused; the next read starts again', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		const error = new Error('extension path index failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('index');
		};

		const first = shareExtensionPathIndex(slot, load);
		const second = shareExtensionPathIndex(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call load again inside the same call');
		assert.strictEqual(slot.promise, null);

		const third = shareExtensionPathIndex(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'index');
		assert.strictEqual(starts, 2, 'the next read must start again');
		await shareExtensionPathIndex(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareExtensionPathIndex(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('index-replacement');
		slot.promise = replacement;

		const error = new Error('late extension path index failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareExtensionPathIndex(slot, () => {
			starts++;
			return Promise.resolve('index-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});

suite('shareExtensionRealPath', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected extension realpath is not reused; the next read starts again', async () => {
		const cache = new Map<string, Promise<string>>();
		const fsPath = '/ext/foo';
		const error = new Error('extension realpath failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('/real/foo');
		};

		const first = shareExtensionRealPath(cache, fsPath, load);
		const second = shareExtensionRealPath(cache, fsPath, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call load again inside the same call');
		assert.strictEqual(cache.has(fsPath), false);

		const third = shareExtensionRealPath(cache, fsPath, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, '/real/foo');
		assert.strictEqual(starts, 2, 'the next read must start again');
		await shareExtensionRealPath(cache, fsPath, load);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored for that path', async () => {
		const cache = new Map<string, Promise<string>>();
		const fsPath = '/ext/foo';
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareExtensionRealPath(cache, fsPath, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('/real/replacement');
		cache.set(fsPath, replacement);

		const error = new Error('late extension realpath failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get(fsPath), replacement);

		let starts = 0;
		const second = shareExtensionRealPath(cache, fsPath, () => {
			starts++;
			return Promise.resolve('/real/again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
