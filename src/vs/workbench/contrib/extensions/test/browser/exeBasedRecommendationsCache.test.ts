/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareImportantExeBasedRecommendations } from '../../browser/exeBasedRecommendations.js';

suite('shareImportantExeBasedRecommendations', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected important executable recommendation fetch is not reused; the next read fetches again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('important executable recommendation fetch failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('recommendations');
		};

		const first = shareImportantExeBasedRecommendations(slot, load);
		const second = shareImportantExeBasedRecommendations(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected fetch must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareImportantExeBasedRecommendations(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'recommendations');
		assert.strictEqual(starts, 2, 'the next read must fetch again');
		await shareImportantExeBasedRecommendations(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled fetch stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareImportantExeBasedRecommendations(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('recommendations-replacement');
		slot.promise = replacement;

		const error = new Error('late important executable recommendation failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareImportantExeBasedRecommendations(slot, () => {
			starts++;
			return Promise.resolve('recommendations-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
