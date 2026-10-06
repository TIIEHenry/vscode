/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isConversationTimelineScrolledToBottom } from './conversationTimelineScroll.js';

suite('conversationTimelineScroll (browser colocated)', () => {

	test('isScrolledToBottom uses 2px tolerance at the real max scrollTop', () => {
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 302), true);
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 303), false);
	});

	test('isScrolledToBottom rejects stale scrollTop after content shrinks below the viewport', () => {
		// scrollHeight dropped while scrollTop stayed high; only the sum check would wrongly lock follow.
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 400, 200), false);
		assert.strictEqual(isConversationTimelineScrolledToBottom(0, 400, 200), true);
	});
});
