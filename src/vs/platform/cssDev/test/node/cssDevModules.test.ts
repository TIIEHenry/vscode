/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareCssModules } from '../../node/cssDevService.js';

suite('shareCssModules', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected computation is not reused; the next read calls load again', async () => {
		const slot: { promise: Promise<string[]> | undefined } = { promise: undefined };
		const error = new Error('css modules failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string[]>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve(['vs/workbench/workbench.css']);
		};

		const first = shareCssModules(slot, load);
		const second = shareCssModules(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected computation must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareCssModules(slot, load);
		assert.notStrictEqual(third, first);
		assert.deepStrictEqual(await third, ['vs/workbench/workbench.css']);
		assert.strictEqual(starts, 2, 'the next read must call load again');
		await shareCssModules(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled computation stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string[]> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareCssModules(slot, () => new Promise<string[]>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve(['vs/editor/editor.css']);
		slot.promise = replacement;

		const error = new Error('late css modules failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareCssModules(slot, () => {
			starts++;
			return Promise.resolve(['vs/workbench/workbench.css']);
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
