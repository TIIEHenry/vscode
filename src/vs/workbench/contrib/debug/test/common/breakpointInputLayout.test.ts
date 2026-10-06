/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { computeBreakpointInputWidth } from '../../common/breakpointInputLayout.js';

suite('breakpointInputLayout', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('no mode container uses legacy width', () => {
		assert.strictEqual(computeBreakpointInputWidth(500, undefined), 387);
	});

	test('mode container width is subtracted when space allows', () => {
		assert.strictEqual(computeBreakpointInputWidth(500, 300), 87);
	});

	test('mode container clamps to zero when too narrow', () => {
		assert.strictEqual(computeBreakpointInputWidth(400, 300), 0);
	});

	test('mode container width zero still subtracts fixed offset', () => {
		assert.strictEqual(computeBreakpointInputWidth(500, 0), 387);
	});
});
