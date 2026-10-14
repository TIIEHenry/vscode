/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ObservablePromise } from '../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareTreeSitterLanguageLoad } from '../../browser/treeSitterLibraryService.js';

suite('shareTreeSitterLanguageLoad', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected tree-sitter language load is not reused; the next load calls load again', async () => {
		const cache = new Map<string, ObservablePromise<string>>();
		const error = new Error('tree-sitter grammar failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('bash');
		};

		const first = shareTreeSitterLanguageLoad(cache, 'bash', load);
		const second = shareTreeSitterLanguageLoad(cache, 'bash', load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first.promise, (reason: unknown) => reason === error);
		await assert.rejects(second.promise, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected load must not call load again inside the same call');
		assert.strictEqual(cache.size, 0);

		const third = shareTreeSitterLanguageLoad(cache, 'bash', load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third.promise, 'bash');
		assert.strictEqual(starts, 2, 'the next load must call load again');
		await shareTreeSitterLanguageLoad(cache, 'bash', load).promise;
		assert.strictEqual(starts, 2, 'a fulfilled load stays cached');
	});

	test('a rejection does not delete a replacement already stored for that language', async () => {
		const cache = new Map<string, ObservablePromise<string>>();
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareTreeSitterLanguageLoad(cache, 'bash', () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = new ObservablePromise(Promise.resolve('bash-replacement'));
		cache.set('bash', replacement);

		const error = new Error('late tree-sitter failure');
		rejectFirst!(error);
		await assert.rejects(first.promise, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get('bash'), replacement);

		let starts = 0;
		const second = shareTreeSitterLanguageLoad(cache, 'bash', () => {
			starts++;
			return Promise.resolve('bash-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
