/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareExtensionRecommendationsActivation } from '../../browser/extensionRecommendationsActivation.js';

suite('shareExtensionRecommendationsActivation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected activation is not reused; the next activation starts again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('extension recommendations activation failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('activated');
		};

		const first = shareExtensionRecommendationsActivation(slot, load);
		const second = shareExtensionRecommendationsActivation(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected activation must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareExtensionRecommendationsActivation(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next activation must start again');
		await third;
		await shareExtensionRecommendationsActivation(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled activation stays cached');
	});

	test('a rejection does not clear a replacement already stored for that slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareExtensionRecommendationsActivation(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		slot.promise = replacement;

		const error = new Error('late extension recommendations activation failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareExtensionRecommendationsActivation(slot, () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
