/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareWorkspaceStatsPromise } from '../../node/workspaceStatsCache.js';

suite('shareWorkspaceStatsPromise', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected workspace stats scan is not reused; the next scan starts again', async () => {
		const cache = new Map<string, Promise<string>>();
		const key = '/workspace::node_modules:.git::bounded';
		const error = new Error('workspace stats scan failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('stats');
		};

		const first = shareWorkspaceStatsPromise(cache, key, load);
		const second = shareWorkspaceStatsPromise(cache, key, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected scan must not call load again inside the same call');
		assert.strictEqual(cache.has(key), false);

		const third = shareWorkspaceStatsPromise(cache, key, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next scan must start again');
		await third;
		await shareWorkspaceStatsPromise(cache, key, load);
		assert.strictEqual(starts, 2, 'a fulfilled scan stays cached');
	});

	test('a rejection does not clear a replacement already stored for that key', async () => {
		const cache = new Map<string, Promise<string>>();
		const key = '/workspace::node_modules:.git::bounded';
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareWorkspaceStatsPromise(cache, key, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		cache.set(key, replacement);

		const error = new Error('late workspace stats scan failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get(key), replacement);

		let starts = 0;
		const second = shareWorkspaceStatsPromise(cache, key, () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
