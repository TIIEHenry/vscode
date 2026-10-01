/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { alternateEditorOpenSlot, planEditorOpen, readEditorOpenSlot } from '../../common/editorOpenSlot.js';

suite('Editor open slot', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('reads the two modes and falls back otherwise', () => {
		assert.strictEqual(readEditorOpenSlot('newTab', 'replace'), 'newTab');
		assert.strictEqual(readEditorOpenSlot('replace', 'newTab'), 'replace');
		assert.strictEqual(readEditorOpenSlot(undefined, 'newTab'), 'newTab');
		assert.strictEqual(readEditorOpenSlot('side', 'replace'), 'replace');
	});

	test('replace reuses the active tab only when the file is not already open', () => {
		assert.strictEqual(planEditorOpen('newTab', true, false), 'open');
		assert.strictEqual(planEditorOpen('replace', false, false), 'open');
		assert.strictEqual(planEditorOpen('replace', true, true), 'open');
		assert.strictEqual(planEditorOpen('replace', true, false), 'replace');
		assert.strictEqual(alternateEditorOpenSlot('newTab'), 'replace');
		assert.strictEqual(alternateEditorOpenSlot('replace'), 'newTab');
	});
});
