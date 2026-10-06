/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getConversationChatResource } from '../common/conversationChatInput.js';
import {
	CONVERSATION_REFS_MARKER,
	isLegalConversationRefResource,
	splitConversationRefs,
} from './conversationUserRefs.js';

suite('ConversationUserRefs (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('malformed percent encoding in a ref line invalidates the trailer without throwing', () => {
		const body = 'hello';
		const badRef = 'conversation-chat:/session/%ZZ/chat/c1';
		const text = `${body}\n\n${CONVERSATION_REFS_MARKER}\n${badRef}`;

		assert.strictEqual(isLegalConversationRefResource(badRef), false);
		const split = splitConversationRefs(text);
		assert.strictEqual(split.trailer, false);
		assert.strictEqual(split.body, text);
		assert.deepStrictEqual([...split.refs], []);
	});

	test('a legal ref line still parses as a trailer', () => {
		const line = getConversationChatResource('s1', 'c1').toString();
		const body = 'See the other chat';
		const text = `${body}\n\n${CONVERSATION_REFS_MARKER}\n${line}`;

		assert.strictEqual(isLegalConversationRefResource(line), true);
		const split = splitConversationRefs(text);
		assert.strictEqual(split.trailer, true);
		assert.strictEqual(split.body, body);
		assert.deepStrictEqual([...split.refs], [line]);
	});
});
