/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { computeTreeSitterEditNewEndPosition } from '../../../../../common/model/tokens/treeSitter/treeSitterTree.js';

suite('tree-sitter edit newEndPosition', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('inserts one BMP character on the same line', () => {
		assert.deepStrictEqual(
			computeTreeSitterEditNewEndPosition(1, 1, 'a'),
			{ row: 0, column: 1 }
		);
	});

	test('same-line delete leaves position at start', () => {
		assert.deepStrictEqual(
			computeTreeSitterEditNewEndPosition(1, 5, ''),
			{ row: 0, column: 4 }
		);
	});

	test('replaces two characters with one on the same line', () => {
		assert.deepStrictEqual(
			computeTreeSitterEditNewEndPosition(1, 1, 'x'),
			{ row: 0, column: 1 }
		);
	});

	test('same line after start column, BMP replaced by surrogate pair uses UTF-16 length', () => {
		const startColumn = 5;
		const text = '\uD83D\uDE00';
		assert.strictEqual(text.length, 2);
		assert.deepStrictEqual(
			computeTreeSitterEditNewEndPosition(1, startColumn, text),
			{ row: 0, column: (startColumn - 1) + text.length }
		);
	});

	test('multiline text ending with surrogate pair on last line', () => {
		const text = 'hello\n\uD83D\uDE00';
		assert.deepStrictEqual(
			computeTreeSitterEditNewEndPosition(1, 1, text),
			{ row: 1, column: 2 }
		);
	});
});
