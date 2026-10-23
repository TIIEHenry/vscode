/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { ConversationAutoScrollHolds, isConversationTimelineScrolledToBottom } from './conversationTimelineScroll.js';

/** After a user scroll, programmatic stick stays off for this long. */
export const CONVERSATION_TIMELINE_STICK_COOLDOWN_MS = 150;

/**
 * Scroll-follow lock for the conversation timeline.
 *
 * Pure state plus a write ledger. The host reads layout and calls in; this
 * class never touches the DOM. Programmatic writes are recorded so the native
 * scroll event they cause does not clear the lock or arm the stick cooldown.
 * Any other scroll uses the HEAD rule: off the bottom unlocks, within 2px of
 * the bottom locks again (D4), and suppresses stick for
 * {@link CONVERSATION_TIMELINE_STICK_COOLDOWN_MS}. Send and scroll-to-bottom
 * clear that suppression.
 */
export class ConversationTimelineFollowController {

	private _following = true;
	private readonly _holds: ConversationAutoScrollHolds;
	/** Most recent programmatic `scrollTop`. Only this value is compared. */
	private _lastWrittenScrollTop: number | undefined;
	/** Stick is suppressed while `now` is strictly below this epoch ms. */
	private _suppressStickUntil: number | undefined;

	constructor(holds?: ConversationAutoScrollHolds) {
		this._holds = holds ?? new ConversationAutoScrollHolds();
	}

	/** Scroll lock. Initial value is true. */
	get following(): boolean {
		return this._following;
	}

	/** Alias of {@link following}. */
	get scrollLock(): boolean {
		return this._following;
	}

	/** `true` clears the stick cooldown (scroll-to-bottom). `false` does not arm one. */
	setScrollLock(locked: boolean): void {
		this._following = locked;
		if (locked) {
			this._suppressStickUntil = undefined;
		}
	}

	/** Host is about to set scrollTop to this value. */
	recordWrite(scrollTop: number): void {
		this._lastWrittenScrollTop = scrollTop;
	}

	/**
	 * Native scroll event. If scrollTop is within 1px of the last recordWrite value, ignore (own write).
	 * The recorded value stays until a farther scroll, so a second event 1px away is still our write.
	 * That path does not unlock and does not arm the stick cooldown.
	 * Otherwise clear the record, arm the cooldown, then if atBottom (use isConversationTimelineScrolledToBottom(scrollTop, clientHeight, scrollHeight)) then following = true (D4).
	 * Otherwise following = false.
	 */
	handleScroll(scrollTop: number, clientHeight: number, scrollHeight: number, now = Date.now()): void {
		if (this._lastWrittenScrollTop !== undefined && Math.abs(scrollTop - this._lastWrittenScrollTop) <= 1) {
			return;
		}
		this._lastWrittenScrollTop = undefined;
		this._suppressStickUntil = now + CONVERSATION_TIMELINE_STICK_COOLDOWN_MS;
		this._following = isConversationTimelineScrolledToBottom(scrollTop, clientHeight, scrollHeight);
	}

	/** Frame-end stick: cooldown elapsed && !holds.held && lastKnownAtBottom && following. Does not read layout. */
	shouldStickOnFrame(lastKnownAtBottom: boolean, now = Date.now()): boolean {
		return !this._isStickSuppressed(now) && !this._holds.isHeld && lastKnownAtBottom && this._following;
	}

	/** ResizeObserver: evaluated at call time: cooldown elapsed && following && !holds.held. */
	shouldStickOnResize(now = Date.now()): boolean {
		return !this._isStickSuppressed(now) && this._following && !this._holds.isHeld;
	}

	/** D13. Sets following = true, clears the stick cooldown, and returns true so the host also sticks. */
	onSendAccepted(): boolean {
		this._following = true;
		this._suppressStickUntil = undefined;
		return true;
	}

	/** After reveal/focusRecord, if the landed position is not at the bottom, following = false. */
	onReveal(atBottom: boolean): void {
		if (!atBottom) {
			this._following = false;
		}
	}

	/**
	 * D12. If isTailRoot, leave following unchanged and return { unpin: false }.
	 * If not tail and following was true, set following = false and return { unpin: true } (host compensates scroll to the header).
	 * If not following, return { unpin: false }.
	 */
	onUserToggle(isTailRoot: boolean): { readonly unpin: boolean } {
		if (isTailRoot || !this._following) {
			return { unpin: false };
		}
		this._following = false;
		return { unpin: true };
	}

	/** Delegates to {@link ConversationAutoScrollHolds}. */
	acquireHold(): IDisposable {
		return this._holds.acquire();
	}

	get held(): boolean {
		return this._holds.isHeld;
	}

	private _isStickSuppressed(now: number): boolean {
		return this._suppressStickUntil !== undefined && now < this._suppressStickUntil;
	}
}
