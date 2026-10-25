/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { isConversationInboxQueueItemActivationKey } from './conversationInboxKeyboard.js';

suite('Conversation Inbox keyboard', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('queue rows activate only from Enter or Space', () => {
		assert.strictEqual(isConversationInboxQueueItemActivationKey('Enter'), true);
		assert.strictEqual(isConversationInboxQueueItemActivationKey(' '), true);
		assert.strictEqual(isConversationInboxQueueItemActivationKey('Spacebar'), false);
		assert.strictEqual(isConversationInboxQueueItemActivationKey('Tab'), false);
		assert.strictEqual(isConversationInboxQueueItemActivationKey('Escape'), false);
	});
});
