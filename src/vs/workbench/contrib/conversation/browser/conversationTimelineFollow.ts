/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { ConversationAutoScrollHolds, isConversationTimelineScrolledToBottom } from './conversationTimelineScroll.js';

/**
 * Scroll-follow lock for the conversation timeline.
 *
 * Pure state plus a write ledger. The host reads layout and calls in; this
 * class never touches the DOM. Programmatic writes are recorded so the native
 * scroll event they cause does not clear the lock. Any other scroll uses the
 * HEAD rule: off the bottom unlocks, within 2px of the bottom locks again (D4).
 */
export class ConversationTimelineFollowController {

	private _following = true;
	private readonly _holds: ConversationAutoScrollHolds;
	/** Most recent programmatic `scrollTop`. Only this value is compared. */
	private _lastWrittenScrollTop: number | undefined;

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

	setScrollLock(locked: boolean): void {
		this._following = locked;
	}

	/** Host is about to set scrollTop to this value. */
	recordWrite(scrollTop: number): void {
		this._lastWrittenScrollTop = scrollTop;
	}

	/**
	 * Native scroll event. If scrollTop is within 1px of the last recordWrite value, ignore (own write).
	 * Otherwise if atBottom (use isConversationTimelineScrolledToBottom(scrollTop, clientHeight, scrollHeight)) then following = true (D4).
	 * Otherwise following = false.
	 */
	handleScroll(scrollTop: number, clientHeight: number, scrollHeight: number): void {
		if (this._lastWrittenScrollTop !== undefined && Math.abs(scrollTop - this._lastWrittenScrollTop) <= 1) {
			return;
		}
		this._following = isConversationTimelineScrolledToBottom(scrollTop, clientHeight, scrollHeight);
	}

	/** Returns whether a frame-end stick should run: !holds.held && (lastKnownAtBottom || following). Does not read layout. */
	shouldStickOnFrame(lastKnownAtBottom: boolean): boolean {
		return !this._holds.isHeld && (lastKnownAtBottom || this._following);
	}

	/** ResizeObserver: condition is evaluated at call time: following && !holds.held. */
	shouldStickOnResize(): boolean {
		return this._following && !this._holds.isHeld;
	}

	/** D13. Sets following = true. Returns true so the host also sticks. */
	onSendAccepted(): boolean {
		this._following = true;
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
}
