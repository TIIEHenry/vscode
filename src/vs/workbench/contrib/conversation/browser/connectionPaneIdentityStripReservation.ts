/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isHTMLElement } from '../../../../base/browser/dom.js';
import { conversationIdentityStripClass } from './conversationIdentityStrip.js';
import {
	conversationLensPhasePreFirstClass,
	conversationLensPrefirstHeroClass,
} from './conversationLensDockStrings.js';

/** Written on the Connection modal host so CSS/layout can reserve the identity strip. */
export const connectionPaneIdentityReservedTopVar = '--ua-conversation-identity-reserved-top';

/** Marks the modal host that has applied D28 layout reservation. */
export const connectionPaneIdentityReservationHostClass = 'connection-pane-identity-reservation';

/**
 * Maximum reasonable viewport top position (px) for a top-docked conversation identity strip.
 * A docked strip sits immediately below the workbench title bar, optional banner, and session bar.
 */
export const MAX_IDENTITY_STRIP_TOP_PX = 30;

/**
 * Maximum reasonable viewport bottom position (px) to reserve above the modal overlay.
 * Any value beyond this indicates an empty-hero greeting or scrolled/bottom-panel element,
 * which would displace the modal dialog off-screen and slice the backdrop in half.
 */
export const MAX_IDENTITY_STRIP_BOTTOM_PX = 60;

/**
 * Maximum fraction of viewport height that the identity strip may reserve.
 * Modal editors typically occupy ~80% of viewport height; reserving more than 25%
 * would force the modal dialog past the bottom edge of the window.
 */
export const MAX_IDENTITY_STRIP_VIEWPORT_FRACTION = 0.25;

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

export function isUsableIdentityStrip(element: HTMLElement): boolean {
	if (element.hidden || element.hasAttribute('hidden') || element.closest('[hidden]')) {
		return false;
	}
	const style = element.ownerDocument.defaultView?.getComputedStyle(element);
	if (style && (style.display === 'none' || style.visibility === 'hidden')) {
		return false;
	}
	if (typeof element.checkVisibility === 'function' && !element.checkVisibility()) {
		return false;
	}
	if (element.closest(`.${conversationLensPrefirstHeroClass}`) || element.closest(`.${conversationLensPhasePreFirstClass}`)) {
		return false;
	}
	const rect = element.getBoundingClientRect();
	if (rect.height > 0) {
		if (rect.top < 0 || rect.top > MAX_IDENTITY_STRIP_TOP_PX || rect.bottom > MAX_IDENTITY_STRIP_BOTTOM_PX) {
			return false;
		}
		const viewportHeight = element.ownerDocument.defaultView?.innerHeight;
		if (viewportHeight && viewportHeight > 0 && rect.bottom > viewportHeight * MAX_IDENTITY_STRIP_VIEWPORT_FRACTION) {
			return false;
		}
	}
	return true;
}

export function findConversationIdentityStrip(root: ParentNode): HTMLElement | undefined {
	// eslint-disable-next-line no-restricted-syntax -- the identity strip lives in another part
	const candidateStrips = root.querySelectorAll(`.part.conversation .${conversationIdentityStripClass}`);
	for (const candidate of candidateStrips) {
		if (isHTMLElement(candidate) && isUsableIdentityStrip(candidate)) {
			return candidate;
		}
	}
	return undefined;
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
	let reservedPx = strip ? Math.max(0, Math.ceil(strip.getBoundingClientRect().bottom)) : 0;
	if (reservedPx > MAX_IDENTITY_STRIP_BOTTOM_PX) {
		reservedPx = 0;
	}
	const viewportHeight = host.ownerDocument.defaultView?.innerHeight;
	if (viewportHeight && viewportHeight > 0 && reservedPx > viewportHeight * MAX_IDENTITY_STRIP_VIEWPORT_FRACTION) {
		reservedPx = 0;
	}
	const reserved = `${reservedPx}px`;
	host.style.setProperty(connectionPaneIdentityReservedTopVar, reserved);
	host.style.top = reserved;
	host.style.height = reservedPx > 0 ? `calc(100% - ${reserved})` : '100%';
}
