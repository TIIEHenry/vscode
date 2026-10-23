/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CONVERSATION_TIMELINE_STICK_COOLDOWN_MS, ConversationTimelineFollowController } from '../../browser/conversationTimelineFollow.js';

suite('ConversationTimelineFollowController', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('own write within 1px does not clear following; a farther scroll unlocks', () => {
		const controller = new ConversationTimelineFollowController();
		assert.strictEqual(controller.following, true);
		assert.strictEqual(controller.scrollLock, true);

		controller.recordWrite(100);
		// Not at the bottom. Ignored because it matches the recorded write.
		controller.handleScroll(100, 100, 500);
		assert.strictEqual(controller.following, true);

		// 1px tolerance still counts as the controller's own write.
		controller.handleScroll(101, 100, 500);
		assert.strictEqual(controller.following, true);

		controller.handleScroll(90, 100, 500);
		assert.strictEqual(controller.following, false);
		assert.strictEqual(controller.scrollLock, false);
	});

	test('after unlock, a scroll that lands on the bottom restores following', () => {
		const controller = new ConversationTimelineFollowController();
		controller.recordWrite(100);
		controller.handleScroll(90, 100, 500);
		assert.strictEqual(controller.following, false);

		// scrollTop + clientHeight >= scrollHeight - 2, and not within 1px of the last write.
		controller.handleScroll(400, 100, 500);
		assert.strictEqual(controller.following, true);
	});

	test('after unlock, scrolling back to a prior stick scrollTop restores following', () => {
		const controller = new ConversationTimelineFollowController();
		controller.recordWrite(400);
		controller.handleScroll(400, 100, 500);
		assert.strictEqual(controller.following, true);

		controller.handleScroll(90, 100, 500);
		assert.strictEqual(controller.following, false);

		controller.handleScroll(400, 100, 500);
		assert.strictEqual(controller.following, true);
	});

	test('a hold suppresses frame and resize stick until it is disposed', () => {
		const controller = new ConversationTimelineFollowController();
		assert.strictEqual(controller.following, true);
		assert.strictEqual(controller.held, false);

		const hold = controller.acquireHold();
		assert.strictEqual(controller.held, true);
		assert.strictEqual(controller.shouldStickOnFrame(true), false);
		assert.strictEqual(controller.shouldStickOnResize(), false);

		hold.dispose();
		assert.strictEqual(controller.held, false);
		assert.strictEqual(controller.shouldStickOnFrame(true), true);
	});

	test('frame stick requires both at-bottom snapshot and follow lock', () => {
		const controller = new ConversationTimelineFollowController();
		assert.strictEqual(controller.shouldStickOnFrame(true), true);

		controller.setScrollLock(false);
		assert.strictEqual(controller.shouldStickOnFrame(true), false, 'unlocked at bottom must not stick on frame');

		controller.setScrollLock(true);
		assert.strictEqual(controller.shouldStickOnFrame(false), false, 'off bottom must not stick even if follow lock is still true');
	});

	test('opening a non-tail root unpins; a tail root leaves following alone', () => {
		const controller = new ConversationTimelineFollowController();
		assert.strictEqual(controller.following, true);

		const unpinned = controller.onUserToggle(false);
		assert.deepStrictEqual(unpinned, { unpin: true });
		assert.strictEqual(controller.following, false);

		const stillUnpinned = controller.onUserToggle(false);
		assert.deepStrictEqual(stillUnpinned, { unpin: false });
		assert.strictEqual(controller.following, false);

		const tail = new ConversationTimelineFollowController();
		const pinned = tail.onUserToggle(true);
		assert.deepStrictEqual(pinned, { unpin: false });
		assert.strictEqual(tail.following, true);
	});

	test('onSendAccepted locks following and asks the host to stick', () => {
		const controller = new ConversationTimelineFollowController();
		controller.setScrollLock(false);
		assert.strictEqual(controller.following, false);

		assert.strictEqual(controller.onSendAccepted(), true);
		assert.strictEqual(controller.following, true);
		assert.strictEqual(controller.scrollLock, true);
	});

	test('reveal off the bottom unlocks; reveal at the bottom leaves following true', () => {
		const controller = new ConversationTimelineFollowController();
		controller.onReveal(false);
		assert.strictEqual(controller.following, false);

		const atBottom = new ConversationTimelineFollowController();
		assert.strictEqual(atBottom.following, true);
		atBottom.onReveal(true);
		assert.strictEqual(atBottom.following, true);
	});

	test('shouldStickOnResize reads following at call time', () => {
		const controller = new ConversationTimelineFollowController();
		controller.setScrollLock(false);
		assert.strictEqual(controller.shouldStickOnResize(), false);

		controller.setScrollLock(true);
		assert.strictEqual(controller.shouldStickOnResize(), true);
	});

	test('user scroll off the bottom unlocks following and suppresses stick for 150ms', () => {
		const controller = new ConversationTimelineFollowController();
		const now = 10_000;
		assert.strictEqual(CONVERSATION_TIMELINE_STICK_COOLDOWN_MS, 150);

		controller.handleScroll(90, 100, 500, now);
		assert.strictEqual(controller.following, false);
		assert.strictEqual(controller.shouldStickOnFrame(true, now), false);
		assert.strictEqual(controller.shouldStickOnFrame(true, now + 149), false);
		// Follow stays unlocked, so the cooldown ending does not resume stick.
		assert.strictEqual(controller.shouldStickOnFrame(true, now + 150), false);
		assert.strictEqual(controller.shouldStickOnResize(now), false);
		assert.strictEqual(controller.shouldStickOnResize(now + 149), false);
		assert.strictEqual(controller.shouldStickOnResize(now + 150), false);
	});

	test('own write within 1px does not arm the stick cooldown', () => {
		const controller = new ConversationTimelineFollowController();
		const now = 20_000;

		controller.recordWrite(100);
		// Off the bottom, but within 1px of the recorded write.
		controller.handleScroll(101, 100, 500, now);
		assert.strictEqual(controller.following, true);
		assert.strictEqual(controller.shouldStickOnFrame(true, now), true);
		assert.strictEqual(controller.shouldStickOnFrame(true, now + 149), true);
		assert.strictEqual(controller.shouldStickOnResize(now), true);
	});

	test('user scroll on the bottom keeps following and suppresses stick for 150ms', () => {
		const controller = new ConversationTimelineFollowController();
		const now = 30_000;

		// scrollTop + clientHeight >= scrollHeight - 2.
		controller.handleScroll(400, 100, 500, now);
		assert.strictEqual(controller.following, true);
		assert.strictEqual(controller.shouldStickOnFrame(true, now), false);
		assert.strictEqual(controller.shouldStickOnFrame(true, now + 149), false);
		assert.strictEqual(controller.shouldStickOnFrame(true, now + 150), true);
		assert.strictEqual(controller.shouldStickOnResize(now), false);
		assert.strictEqual(controller.shouldStickOnResize(now + 149), false);
		assert.strictEqual(controller.shouldStickOnResize(now + 150), true);
	});

	test('onSendAccepted clears an armed stick cooldown', () => {
		const controller = new ConversationTimelineFollowController();
		const now = 40_000;

		controller.handleScroll(90, 100, 500, now);
		assert.strictEqual(controller.following, false);
		assert.strictEqual(controller.shouldStickOnFrame(true, now), false);

		assert.strictEqual(controller.onSendAccepted(), true);
		assert.strictEqual(controller.following, true);
		assert.strictEqual(controller.shouldStickOnFrame(true, now), true);
		assert.strictEqual(controller.shouldStickOnResize(now), true);
	});

	test('setScrollLock(true) clears an armed stick cooldown', () => {
		const controller = new ConversationTimelineFollowController();
		const now = 50_000;

		controller.handleScroll(90, 100, 500, now);
		assert.strictEqual(controller.shouldStickOnFrame(true, now), false);
		assert.strictEqual(controller.shouldStickOnResize(now), false);

		controller.setScrollLock(true);
		assert.strictEqual(controller.following, true);
		assert.strictEqual(controller.shouldStickOnFrame(true, now), true);
		assert.strictEqual(controller.shouldStickOnResize(now), true);
	});
});
