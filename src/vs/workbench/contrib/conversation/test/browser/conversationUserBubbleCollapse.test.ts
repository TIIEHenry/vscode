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
} from '../../browser/conversationUserBubbleCollapse.js';

suite('ConversationUserBubbleCollapse', () => {

	function lines(count: number): string {
		return Array.from({ length: count }, (_, index) => `Line ${index + 1}`).join('\n');
	}

	test('countTextLines counts newline-separated lines', () => {
		assert.strictEqual(countTextLines(''), 0);
		assert.strictEqual(countTextLines('one'), 1);
		assert.strictEqual(countTextLines('one\ntwo'), 2);
		assert.strictEqual(countTextLines(lines(6)), 6);
		assert.strictEqual(countTextLines(lines(7)), 7);
	});

	test('shouldCollapseUserBubble is false at threshold and true above', () => {
		assert.strictEqual(shouldCollapseUserBubble(lines(USER_BUBBLE_COLLAPSE_LINE_THRESHOLD)), false);
		assert.strictEqual(shouldCollapseUserBubble(lines(USER_BUBBLE_COLLAPSE_LINE_THRESHOLD + 1)), true);
	});

	test('shouldScrollExpandedUserBubble applies only above expanded scroll threshold', () => {
		assert.strictEqual(shouldScrollExpandedUserBubble(lines(USER_BUBBLE_EXPANDED_SCROLL_LINE_THRESHOLD)), false);
		assert.strictEqual(shouldScrollExpandedUserBubble(lines(USER_BUBBLE_EXPANDED_SCROLL_LINE_THRESHOLD + 1)), true);
	});
});
