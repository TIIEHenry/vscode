/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldShowInlineCompletionLanguageStatus } from '../../browser/inlineCompletionLanguageStatusBarContribution.js';

suite('InlineCompletionLanguageStatusBarContribution - default window Copilot chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('inline completion language status is gated to Agents Window', () => {
		assert.strictEqual(shouldShowInlineCompletionLanguageStatus(false), false, 'default Code window must not show Copilot inline-completion language status');
		assert.strictEqual(shouldShowInlineCompletionLanguageStatus(true), true, 'Agents Window may show Copilot inline-completion language status');
	});
});
