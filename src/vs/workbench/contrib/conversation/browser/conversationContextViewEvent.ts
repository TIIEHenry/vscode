/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
