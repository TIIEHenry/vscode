/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldRegisterChatEditorResolver } from '../../browser/chat.shared.contribution.js';

suite('ChatResolverContribution (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('registers chat editor resolver only in Agents Window', () => {
		assert.strictEqual(shouldRegisterChatEditorResolver(false), false);
		assert.strictEqual(shouldRegisterChatEditorResolver(true), true);
	});
});
