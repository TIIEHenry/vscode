/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareFaviconRequest } from '../../electron-main/faviconRequestCache.js';

suite('shareFaviconRequest', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected favicon fetch is not reused; the next fetch starts again', async () => {
		const cache = new Map<string, Promise<string>>();
		const url = 'https://example.test/favicon.ico';
		const error = new Error('favicon fetch failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('data:image/png;base64,abc');
		};

		const first = shareFaviconRequest(cache, url, load);
		const second = shareFaviconRequest(cache, url, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected fetch must not call load again inside the same call');
		assert.strictEqual(cache.has(url), false);

		const third = shareFaviconRequest(cache, url, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'data:image/png;base64,abc');
		assert.strictEqual(starts, 2, 'the next fetch must start again');
		await shareFaviconRequest(cache, url, load);
		assert.strictEqual(starts, 2, 'a fulfilled fetch stays cached');
	});

	test('a rejection does not clear a replacement already stored for that url', async () => {
		const cache = new Map<string, Promise<string>>();
		const url = 'https://example.test/favicon.ico';
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareFaviconRequest(cache, url, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('data:image/png;base64,replacement');
		cache.set(url, replacement);

		const error = new Error('late favicon fetch failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get(url), replacement);

		let starts = 0;
		const second = shareFaviconRequest(cache, url, () => {
			starts++;
			return Promise.resolve('data:image/png;base64,again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
