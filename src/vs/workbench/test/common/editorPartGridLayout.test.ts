/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { computeEditorPartGridLayout } from '../../common/editorPartGridLayout.js';

suite('editorPartGridLayout', () => {

	const contentTop = 10;
	const contentHeight = 400;

	test('header and inset reserve vertical space without stacking', () => {
		assert.deepStrictEqual(
			computeEditorPartGridLayout(contentTop, contentHeight, 0, 28),
			{ top: 38, height: 372 },
		);
		assert.deepStrictEqual(
			computeEditorPartGridLayout(contentTop, contentHeight, 28, 0),
			{ top: 38, height: 372 },
		);
		assert.deepStrictEqual(
			computeEditorPartGridLayout(contentTop, contentHeight, 28, 28),
			{ top: 38, height: 372 },
		);
		assert.deepStrictEqual(
			computeEditorPartGridLayout(contentTop, contentHeight, 0, 0),
			{ top: 10, height: 400 },
		);
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
