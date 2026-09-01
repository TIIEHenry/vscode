/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldShowCopilotQuotaChrome } from '../../common/copilotQuotaChrome.js';

suite('copilotQuotaChrome (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('shouldShowCopilotQuotaChrome is false in default Code window', () => {
		assert.strictEqual(shouldShowCopilotQuotaChrome(false), false);
	});

	test('shouldShowCopilotQuotaChrome is true in Agents Window', () => {
		assert.strictEqual(shouldShowCopilotQuotaChrome(true), true);
	});
});
