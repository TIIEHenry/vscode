/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldTriggerAgentHostChatSetup } from '../../browser/agentSdkSetupService.js';

suite('AgentSdkSetupService (INV-NO-COPILOT)', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('shouldTriggerAgentHostChatSetup skips Copilot setup in the default Code window', () => {
		assert.strictEqual(shouldTriggerAgentHostChatSetup(false), false);
	});

	test('shouldTriggerAgentHostChatSetup allows Copilot setup in the Agents Window', () => {
		assert.strictEqual(shouldTriggerAgentHostChatSetup(true), true);
	});
});
