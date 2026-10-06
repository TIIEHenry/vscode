/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import {
	countTextLines,
	shouldCollapseUserBubble,
	shouldScrollExpandedUserBubble,
	USER_BUBBLE_COLLAPSE_LINE_THRESHOLD,
	USER_BUBBLE_EXPANDED_SCROLL_LINE_THRESHOLD,
} from './conversationUserBubbleCollapse.js';

suite('ConversationUserBubbleCollapse (browser)', () => {

	function lines(count: number): string {
		return Array.from({ length: count }, (_, index) => `Line ${index + 1}`).join('\n');
	}

	test('shouldCollapseUserBubble ignores a trailing newline after the last content line', () => {
		const sixLines = lines(USER_BUBBLE_COLLAPSE_LINE_THRESHOLD);
		assert.strictEqual(shouldCollapseUserBubble(sixLines), false);
		assert.strictEqual(shouldCollapseUserBubble(`${sixLines}\n`), false);
		assert.strictEqual(shouldCollapseUserBubble(`${sixLines}\r\n`), false);
		assert.strictEqual(shouldCollapseUserBubble(lines(USER_BUBBLE_COLLAPSE_LINE_THRESHOLD + 1)), true);
	});

	test('shouldScrollExpandedUserBubble ignores trailing newline at scroll threshold', () => {
		const atThreshold = lines(USER_BUBBLE_EXPANDED_SCROLL_LINE_THRESHOLD);
		assert.strictEqual(shouldScrollExpandedUserBubble(atThreshold), false);
		assert.strictEqual(shouldScrollExpandedUserBubble(`${atThreshold}\n`), false);
		assert.strictEqual(shouldScrollExpandedUserBubble(lines(USER_BUBBLE_EXPANDED_SCROLL_LINE_THRESHOLD + 1)), true);
	});

	test('countTextLines splits CRLF like conversation refs parsing', () => {
		assert.strictEqual(countTextLines('one\r\ntwo'), 2);
	});
});
