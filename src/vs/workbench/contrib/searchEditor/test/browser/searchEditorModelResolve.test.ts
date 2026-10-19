/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareSearchEditorModelResolve } from '../../browser/searchEditorModel.js';

suite('shareSearchEditorModelResolve', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected search editor resolve is not reused; the next resolve starts again', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		const error = new Error('search editor resolve failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		};

		const first = shareSearchEditorModelResolve(slot, load);
		const second = shareSearchEditorModelResolve(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected resolve must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareSearchEditorModelResolve(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next resolve must start again');
		await third;
		await shareSearchEditorModelResolve(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled resolve stays cached');
	});

	test('a rejection does not clear a replacement already stored for that slot', async () => {
		const slot: { promise: Promise<void> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareSearchEditorModelResolve(slot, () => new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve();
		slot.promise = replacement;

		const error = new Error('late search editor resolve failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareSearchEditorModelResolve(slot, () => {
			starts++;
			return Promise.resolve();
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
