/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

/**
 * @param {number} mochaFailures Mocha-reported failure count
 * @param {boolean} hadUnhandledRejection Whether any unhandled promise rejection occurred
 * @returns {0 | 1}
 */
export function getNodeUnitTestProcessExitCode(mochaFailures, hadUnhandledRejection) {
	return (mochaFailures > 0 || hadUnhandledRejection) ? 1 : 0;
}
