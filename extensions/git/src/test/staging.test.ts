/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { Range, Selection, TextDocument, TextLine } from 'vscode';
import { toLineRanges } from '../staging';

function createMockTextDocument(lineCount: number): TextDocument {
	const lines: TextLine[] = [];
	for (let i = 0; i < lineCount; i++) {
		const range = new Range(i, 0, i, 10);
		lines.push({
			lineNumber: i,
			text: '0123456789',
			range,
			rangeIncludingLineBreak: new Range(i, 0, i, 11),
			firstNonWhitespaceCharacterIndex: 0,
			isEmptyOrWhitespace: false,
		});
	}

	return {
		lineCount,
		lineAt: (line: number) => lines[line],
	} as TextDocument;
}

suite('toLineRanges', () => {
	const document = createMockTextDocument(20);

	test('excludes the end line when selection ends at column 0 on a later line', () => {
		const ranges = toLineRanges([new Selection(5, 0, 8, 0)], document);
		assert.strictEqual(ranges.length, 1);
		assert.strictEqual(ranges[0].start.line, 5);
		assert.strictEqual(ranges[0].end.line, 7);
	});

	test('expands to the full line when end column is greater than zero on the same line', () => {
		const ranges = toLineRanges([new Selection(5, 0, 5, 4)], document);
		assert.strictEqual(ranges.length, 1);
		assert.strictEqual(ranges[0].start.line, 5);
		assert.strictEqual(ranges[0].end.line, 5);
	});

	test('expands to the full line when start and end are both at column 0 on the same line', () => {
		const ranges = toLineRanges([new Selection(5, 0, 5, 0)], document);
		assert.strictEqual(ranges.length, 1);
		assert.strictEqual(ranges[0].start.line, 5);
		assert.strictEqual(ranges[0].end.line, 5);
	});
});
