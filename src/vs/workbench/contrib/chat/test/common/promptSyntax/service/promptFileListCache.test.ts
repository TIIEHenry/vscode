/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { sharePromptFileList } from '../../../../common/promptSyntax/service/promptsServiceImpl.js';

suite('sharePromptFileList', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected list is not reused; the next list calls the locator again', async () => {
		const slot: { promise: Promise<readonly string[]> | undefined } = { promise: undefined };
		const error = new Error('prompt files failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const list = () => {
			starts++;
			if (starts === 1) {
				return new Promise<readonly string[]>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve(['agent.md']);
		};

		const first = sharePromptFileList(slot, list);
		const second = sharePromptFileList(slot, list);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected list must not call the locator again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = sharePromptFileList(slot, list);
		assert.notStrictEqual(third, first);
		assert.deepStrictEqual(await third, ['agent.md']);
		assert.strictEqual(starts, 2, 'the next list must call the locator again');
		await sharePromptFileList(slot, list);
		assert.strictEqual(starts, 2, 'a fulfilled list stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<readonly string[]> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = sharePromptFileList(slot, () => new Promise<readonly string[]>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve(['replacement.md']);
		slot.promise = replacement;

		const error = new Error('late prompt list failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = sharePromptFileList(slot, () => {
			starts++;
			return Promise.resolve(['again.md']);
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
