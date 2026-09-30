/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import assert from 'assert';
import { test } from 'node:test';
import { getNodeUnitTestProcessExitCode } from './nodeUnitTestExitCode.js';

test('exit 0 when no mocha failures and no unhandled rejection', () => {
	assert.strictEqual(getNodeUnitTestProcessExitCode(0, false), 0);
});

test('exit 1 when mocha failures even without unhandled rejection', () => {
	assert.strictEqual(getNodeUnitTestProcessExitCode(1, false), 1);
	assert.strictEqual(getNodeUnitTestProcessExitCode(3, false), 1);
});

test('exit 1 when unhandled rejection even with zero mocha failures', () => {
	assert.strictEqual(getNodeUnitTestProcessExitCode(0, true), 1);
});

test('exit 1 when both mocha failures and unhandled rejection', () => {
	assert.strictEqual(getNodeUnitTestProcessExitCode(2, true), 1);
});
