/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { TextEditorChange, TextEditorChangeKind } from 'vscode';
import { mapModifiedLineNumberToOriginalLineNumber } from '../blame';

function addition(modifiedStart: number, modifiedEndExclusive: number): TextEditorChange {
	return {
		kind: TextEditorChangeKind.Addition,
		original: { startLineNumber: modifiedStart, endLineNumberExclusive: modifiedStart },
		modified: { startLineNumber: modifiedStart, endLineNumberExclusive: modifiedEndExclusive }
	};
}

function deletion(modifiedStart: number, originalLength: number): TextEditorChange {
	return {
		kind: TextEditorChangeKind.Deletion,
		original: { startLineNumber: modifiedStart, endLineNumberExclusive: modifiedStart + originalLength },
		modified: { startLineNumber: modifiedStart, endLineNumberExclusive: modifiedStart }
	};
}

suite('mapModifiedLineNumberToOriginalLineNumber', () => {
	test('maps through insertion then deletion at a later modified line', () => {
		const changes: TextEditorChange[] = [
			addition(1, 11),
			deletion(15, 3)
		];

		assert.strictEqual(mapModifiedLineNumberToOriginalLineNumber(20, changes), 13);
	});

	test('maps through insertion only when no later deletion applies', () => {
		const changes: TextEditorChange[] = [
			addition(1, 11)
		];

		assert.strictEqual(mapModifiedLineNumberToOriginalLineNumber(20, changes), 10);
	});

	test('does not apply a later insertion when the cursor is before its modified start', () => {
		const changes: TextEditorChange[] = [
			deletion(10, 5),
			addition(14, 18)
		];

		assert.strictEqual(mapModifiedLineNumberToOriginalLineNumber(12, changes), 17);
	});
});
