/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	computeConversationScrollDownState,
	ConversationAutoScrollHolds,
	isConversationTimelineScrolledToBottom,
} from '../../browser/conversationTimelineScroll.js';

suite('ConversationTimelineScroll', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isScrolledToBottom uses 2px tolerance', () => {
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 302), true);
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 303), false);
	});

	// Mirrors chatListWidget.test.ts scroll-down / at-bottom decoupling without importing chatListWidget.
	test('scroll-down button is decoupled from the at-bottom padding state', () => {
		assert.deepStrictEqual([
			computeConversationScrollDownState(/*isScrolledToBottom*/ true, /*scrollLock*/ true),
			computeConversationScrollDownState(/*isScrolledToBottom*/ true, /*scrollLock*/ false),
			computeConversationScrollDownState(/*isScrolledToBottom*/ false, /*scrollLock*/ true),
			computeConversationScrollDownState(/*isScrolledToBottom*/ false, /*scrollLock*/ false),
		], [
			{ showButton: false, atBottom: true },
			{ showButton: false, atBottom: true },
			{ showButton: true, atBottom: true },
			{ showButton: true, atBottom: false },
		]);
	});

	test('auto-scroll holds compose and release idempotently', () => {
		const holds = new ConversationAutoScrollHolds();
		assert.strictEqual(holds.isHeld, false);

		const first = holds.acquire();
		assert.strictEqual(holds.isHeld, true);

		const second = holds.acquire();
		assert.strictEqual(holds.isHeld, true);

		first.dispose();
		assert.strictEqual(holds.isHeld, true);

		second.dispose();
		assert.strictEqual(holds.isHeld, false);

		first.dispose();
		assert.strictEqual(holds.isHeld, false);
	});
});
