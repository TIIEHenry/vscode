/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { combineSideBySideEditorSizeConstraints, SideBySideEditorPaneSizeConstraints } from '../../common/editor/sideBySideEditorSizeConstraints.js';

function pane(w1: number, h1: number, W1: number, H1: number): SideBySideEditorPaneSizeConstraints {
	return { minimumWidth: w1, minimumHeight: h1, maximumWidth: W1, maximumHeight: H1 };
}

suite('sideBySideEditorSizeConstraints', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const primary = pane(100, 200, 800, 600);
	const secondary = pane(120, 180, 900, 500);

	test('horizontal combines split axis by sum and cross axis by max/min', () => {
		const result = combineSideBySideEditorSizeConstraints('horizontal', primary, secondary);

		assert.strictEqual(result.minimumWidth, 220);
		assert.strictEqual(result.maximumWidth, 1700);
		assert.strictEqual(result.minimumHeight, 200);
		assert.strictEqual(result.maximumHeight, 500);
	});

	test('vertical combines split axis by sum and cross axis by max/min', () => {
		const result = combineSideBySideEditorSizeConstraints('vertical', primary, secondary);

		assert.strictEqual(result.minimumWidth, 120);
		assert.strictEqual(result.maximumWidth, 800);
		assert.strictEqual(result.minimumHeight, 380);
		assert.strictEqual(result.maximumHeight, 1100);
	});

	test('horizontal cross-axis maximum stays finite when one pane maximum is Infinity', () => {
		const infiniteHeightPrimary = pane(100, 200, 800, Number.POSITIVE_INFINITY);
		const result = combineSideBySideEditorSizeConstraints('horizontal', infiniteHeightPrimary, secondary);

		assert.strictEqual(result.maximumHeight, 500);
		assert.strictEqual(result.maximumWidth, 1700);
		assert.strictEqual(result.minimumHeight, 200);
		assert.strictEqual(result.minimumWidth, 220);
	});

	test('vertical cross-axis maximum stays finite when one pane maximum is Infinity', () => {
		const infiniteWidthSecondary = pane(120, 180, Number.POSITIVE_INFINITY, 500);
		const result = combineSideBySideEditorSizeConstraints('vertical', primary, infiniteWidthSecondary);

		assert.strictEqual(result.maximumWidth, 800);
		assert.strictEqual(result.maximumHeight, 1100);
		assert.strictEqual(result.minimumWidth, 120);
		assert.strictEqual(result.minimumHeight, 380);
	});
});
