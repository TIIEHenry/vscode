/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { shareNlsConfiguration } from '../../node/nlsConfigurationCache.js';

suite('shareNlsConfiguration', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected nls configuration is not reused; the next lookup resolves again', async () => {
		const cache = new Map<string, Promise<string>>();
		const key = 'en||/user-data';
		const error = new Error('nls configuration failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const resolve = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('nls');
		};

		const first = shareNlsConfiguration(cache, key, resolve);
		const second = shareNlsConfiguration(cache, key, resolve);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected resolution must not call resolve again inside the same call');
		assert.strictEqual(cache.has(key), false);

		const third = shareNlsConfiguration(cache, key, resolve);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next lookup must resolve again');
		await third;
		await shareNlsConfiguration(cache, key, resolve);
		assert.strictEqual(starts, 2, 'a fulfilled resolution stays cached');
	});

	test('a rejection does not clear a replacement already stored for that key', async () => {
		const cache = new Map<string, Promise<string>>();
		const key = 'en||/user-data';
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareNlsConfiguration(cache, key, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		cache.set(key, replacement);

		const error = new Error('late nls configuration failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get(key), replacement);

		let starts = 0;
		const second = shareNlsConfiguration(cache, key, () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
