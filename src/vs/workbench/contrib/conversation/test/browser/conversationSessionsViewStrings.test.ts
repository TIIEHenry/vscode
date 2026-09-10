/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationLensSessionBarNewSession } from '../../browser/conversationLensSessionBarStrings.js';
import { conversationSessionsViewEmptyMessage } from '../../browser/conversationSessionsViewStrings.js';

suite('ConversationSessionsView strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty chrome is a user-facing roster empty, not a stub conversation', () => {
		assert.ok(conversationSessionsViewEmptyMessage.includes('No sessions'));
		assert.ok(conversationSessionsViewEmptyMessage.includes(conversationLensSessionBarNewSession));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/stub conversation/i));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/in-memory/i));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/engine session/i));
		assert.ok(!conversationSessionsViewEmptyMessage.toLowerCase().includes('open chat'));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/copilot/i), 'must not mention Copilot');
	});
});
