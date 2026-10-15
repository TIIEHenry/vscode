/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareTreeSitterImport } from '../../browser/treeSitterLibraryService.js';

suite('shareTreeSitterImport', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected tree-sitter import is not reused; the next import calls load again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('tree-sitter import failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('tree-sitter');
		};

		const first = shareTreeSitterImport(slot, load);
		const second = shareTreeSitterImport(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected import must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareTreeSitterImport(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'tree-sitter');
		assert.strictEqual(starts, 2, 'the next import must call load again');
		await shareTreeSitterImport(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled import stays cached');
	});

	test('a rejection does not clear a replacement already stored for that import', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareTreeSitterImport(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('tree-sitter-replacement');
		slot.promise = replacement;

		const error = new Error('late tree-sitter import failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareTreeSitterImport(slot, () => {
			starts++;
			return Promise.resolve('tree-sitter-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
