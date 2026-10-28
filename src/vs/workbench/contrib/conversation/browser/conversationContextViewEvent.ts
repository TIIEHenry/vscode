/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addStandardDisposableListener, getWindow } from '../../../../base/browser/dom.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

/**
 * `ContextView` registers its listeners through `addStandardDisposableListener`, so a `click`
 * reaches `IContextViewDelegate.onDOMEvent` as a `StandardMouseEvent` (and `keydown` as a
 * `StandardKeyboardEvent`). Those wrappers carry `target` and `browserEvent` but no `type`, so
 * `e.type === 'click'` is never true for them and an outside click never dismissed the popup.
 */
function getRawEvent(e: Event): Event {
	const wrapped = (e as Event & { readonly browserEvent?: Event }).browserEvent;
	return wrapped ?? e;
}

/** True when the event handed to `onDOMEvent` is a click, wrapped or raw. */
export function isContextViewClick(e: Event): boolean {
	return getRawEvent(e).type === 'click';
}

/** Target of a context view DOM event, wrapped or raw. */
export function getContextViewEventTarget(e: Event): HTMLElement | null {
	return (e.target ?? getRawEvent(e).target) as HTMLElement | null;
}

/** Composer popups return to their actual owner only for an Escape dismissal. */
export function registerComposerPopupEscape(
	container: HTMLElement,
	owner: HTMLElement,
	host: { readonly dockTextarea: HTMLTextAreaElement; getBoundSessionId(): string },
	close: () => void,
): IDisposable {
	const sessionId = host.getBoundSessionId();
	const usable = (element: HTMLElement) => {
		if (!element.isConnected || element.getClientRects().length === 0 || element.matches(':disabled, [aria-disabled="true"]')) {
			return false;
		}
		const visibility = getWindow(element).getComputedStyle(element).visibility;
		return visibility !== 'hidden' && visibility !== 'collapse';
	};
	return addStandardDisposableListener(container.ownerDocument, 'keydown', event => {
		if (event.keyCode !== KeyCode.Escape) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		close();
		if (host.getBoundSessionId() === sessionId) {
			const target = usable(owner) ? owner : host.dockTextarea;
			if (usable(target)) {
				target.focus();
			}
		}
	}, true);
}
