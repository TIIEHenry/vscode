/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { canFocusWalkthroughSideGroup, shouldExecuteWalkthroughStepCommand } from '../../browser/gettingStarted.js';

suite('GettingStarted - toSide focus and execution guards', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('canFocusWalkthroughSideGroup', () => {
		test('width 951 without constrained classes returns true', () => {
			assert.strictEqual(canFocusWalkthroughSideGroup(951, false, false), true);
		});

		test('width 800 without constrained classes returns true', () => {
			assert.strictEqual(canFocusWalkthroughSideGroup(800, false, false), true);
		});

		test('width 701 without constrained classes returns true', () => {
			assert.strictEqual(canFocusWalkthroughSideGroup(701, false, false), true);
		});

		test('width 700 returns false', () => {
			assert.strictEqual(canFocusWalkthroughSideGroup(700, false, false), false);
		});

		test('width undefined returns false', () => {
			assert.strictEqual(canFocusWalkthroughSideGroup(undefined, false, false), false);
		});

		test('widthConstrained returns false', () => {
			assert.strictEqual(canFocusWalkthroughSideGroup(1000, true, false), false);
		});

		test('widthSemiConstrained returns false', () => {
			assert.strictEqual(canFocusWalkthroughSideGroup(1000, false, true), false);
		});
	});

	suite('shouldExecuteWalkthroughStepCommand', () => {
		test('toSide false executes command regardless of sideGroupFocused', () => {
			assert.strictEqual(shouldExecuteWalkthroughStepCommand(false, false), true);
			assert.strictEqual(shouldExecuteWalkthroughStepCommand(false, true), true);
		});

		test('toSide true and sideGroupFocused true executes command', () => {
			assert.strictEqual(shouldExecuteWalkthroughStepCommand(true, true), true);
		});

		test('toSide true and sideGroupFocused false does not execute command', () => {
			assert.strictEqual(shouldExecuteWalkthroughStepCommand(true, false), false);
		});
	});
});
