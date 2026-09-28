/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { CONVERSATION_SEND_FAILED_EFFECT_KIND } from '../../common/conversationViewFrame.js';
import { SEND_FAILED_EFFECT_KIND } from '../../node/sessionCore/session-actor-chat-outbox.js';

suite('conversationViewFrameSendFailed', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('send_failed effect kind matches session-core', () => {
		assert.strictEqual(CONVERSATION_SEND_FAILED_EFFECT_KIND, SEND_FAILED_EFFECT_KIND);
	});
});
