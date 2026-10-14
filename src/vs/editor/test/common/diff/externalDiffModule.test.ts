/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareExternalDiffModule } from '../../../common/diff/externalLinesDiffComputer.js';

suite('shareExternalDiffModule', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected external diff module load is not reused; the next read loads again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('external diff module load failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('diff-module');
		};

		const first = shareExternalDiffModule(slot, load);
		const second = shareExternalDiffModule(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected load must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareExternalDiffModule(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'diff-module');
		assert.strictEqual(starts, 2, 'the next read must load again');
		await shareExternalDiffModule(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled load stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareExternalDiffModule(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('diff-module-replacement');
		slot.promise = replacement;

		const error = new Error('late external diff module failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareExternalDiffModule(slot, () => {
			starts++;
			return Promise.resolve('diff-module-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
