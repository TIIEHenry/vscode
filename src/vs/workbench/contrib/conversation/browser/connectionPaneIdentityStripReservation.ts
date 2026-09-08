/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isHTMLElement } from '../../../../base/browser/dom.js';
import { conversationIdentityStripClass } from './conversationIdentityStrip.js';

/** Written on the Connection modal host so CSS/layout can reserve the identity strip. */
export const connectionPaneIdentityReservedTopVar = '--ua-conversation-identity-reserved-top';

/** Marks the modal host that has applied D28 layout reservation. */
export const connectionPaneIdentityReservationHostClass = 'connection-pane-identity-reservation';

export interface IBoxEdges {
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

/** Inclusive-edge-adjacent boxes do not count as overlapping. */
export function boxesOverlap(a: IBoxEdges, b: IBoxEdges): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function isUsableIdentityStrip(element: HTMLElement): boolean {
	if (element.hidden || element.hasAttribute('hidden')) {
		return false;
	}
	const style = element.ownerDocument.defaultView?.getComputedStyle(element);
	if (style && (style.display === 'none' || style.visibility === 'hidden')) {
		return false;
	}
	return true;
}

export function findConversationIdentityStrip(root: ParentNode): HTMLElement | undefined {
	// eslint-disable-next-line no-restricted-syntax -- the identity strip lives in another part
	const strip = root.querySelector(`.part.conversation .${conversationIdentityStripClass}`);
	if (!isHTMLElement(strip) || !isUsableIdentityStrip(strip)) {
		return undefined;
	}
	return strip;
}

export function findConnectionPaneOverlayHost(pane: HTMLElement): HTMLElement | undefined {
	const host = pane.closest('.monaco-modal-editor-block');
	return isHTMLElement(host) ? host : undefined;
}

/**
 * D28: reserve the conversation identity strip above the Connection modal.
 * Layout offset (not z-index) — the modal host starts at the strip's bottom edge.
 */
export function applyConnectionPaneIdentityStripReservation(pane: HTMLElement, root: ParentNode = pane.ownerDocument): void {
	const host = findConnectionPaneOverlayHost(pane);
	if (!host) {
		return;
	}
	host.classList.add(connectionPaneIdentityReservationHostClass);
	const strip = findConversationIdentityStrip(root);
	const reservedPx = strip ? Math.max(0, Math.ceil(strip.getBoundingClientRect().bottom)) : 0;
	const reserved = `${reservedPx}px`;
	host.style.setProperty(connectionPaneIdentityReservedTopVar, reserved);
	host.style.top = reserved;
	host.style.height = `calc(100% - ${reserved})`;
}
