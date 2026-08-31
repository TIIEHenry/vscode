/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';

/**
 * Ref-counted suppression of auto-scrolling to the bottom. Holds compose, so
 * unrelated features can suppress concurrently without clobbering each other;
 * auto-scroll resumes only once the last hold is released.
 *
 * Algorithm copied from contrib/chat chatListWidget (not imported — INV-NO-COPILOT).
 */
export class ConversationAutoScrollHolds {

	private _count = 0;

	get isHeld(): boolean {
		return this._count > 0;
	}

	acquire(): IDisposable {
		this._count++;
		let released = false;
		return toDisposable(() => {
			if (!released) {
				released = true;
				this._count--;
			}
		});
	}
}

/**
 * Whether a scroll region is scrolled to the bottom (2px tolerance).
 */
export function isConversationTimelineScrolledToBottom(scrollTop: number, renderHeight: number, scrollHeight: number): boolean {
	return scrollTop + renderHeight >= scrollHeight - 2;
}

/**
 * Computes scroll-down affordance vs at-bottom padding state.
 *
 * `showButton` reflects actual scroll position; `atBottom` honours scroll lock for
 * streaming padding — see chatListWidget regression #326952 (behaviour mirrored, not imported).
 */
export function computeConversationScrollDownState(isScrolledToBottom: boolean, scrollLock: boolean): { showButton: boolean; atBottom: boolean } {
	return {
		showButton: !isScrolledToBottom,
		atBottom: isScrolledToBottom || scrollLock,
	};
}
