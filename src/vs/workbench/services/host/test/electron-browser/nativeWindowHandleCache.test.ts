/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareNativeWindowHandle } from '../../electron-browser/nativeWindowHandleCache.js';

suite('shareNativeWindowHandle', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected native window handle is not reused; the next read starts again', async () => {
		const cache = new Map<number, Promise<string>>();
		const windowId = 7;
		const error = new Error('native window handle failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('handle');
		};

		const first = shareNativeWindowHandle(cache, windowId, load);
		const second = shareNativeWindowHandle(cache, windowId, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected read must not call load again inside the same call');
		assert.strictEqual(cache.has(windowId), false);

		const third = shareNativeWindowHandle(cache, windowId, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'handle');
		assert.strictEqual(starts, 2, 'the next read must start again');
		await shareNativeWindowHandle(cache, windowId, load);
		assert.strictEqual(starts, 2, 'a fulfilled read stays cached');
	});

	test('a rejection does not clear a replacement already stored for that window', async () => {
		const cache = new Map<number, Promise<string>>();
		const windowId = 7;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareNativeWindowHandle(cache, windowId, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('handle-replacement');
		cache.set(windowId, replacement);

		const error = new Error('late native window handle failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get(windowId), replacement);

		let starts = 0;
		const second = shareNativeWindowHandle(cache, windowId, () => {
			starts++;
			return Promise.resolve('handle-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
