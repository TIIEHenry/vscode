/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareAITextResultProviderName } from '../../browser/searchTreeModel/searchModel.js';

suite('shareAITextResultProviderName', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected AI name lookup is not reused; the next read looks up again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('AI name lookup failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('ai-name');
		};

		const first = shareAITextResultProviderName(slot, load);
		const second = shareAITextResultProviderName(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected lookup must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareAITextResultProviderName(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'ai-name');
		assert.strictEqual(starts, 2, 'the next read must look up again');
		await shareAITextResultProviderName(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled lookup stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareAITextResultProviderName(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('ai-name-replacement');
		slot.promise = replacement;

		const error = new Error('late AI name failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareAITextResultProviderName(slot, () => {
			starts++;
			return Promise.resolve('ai-name-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
