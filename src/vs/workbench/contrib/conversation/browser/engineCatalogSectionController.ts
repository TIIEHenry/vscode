/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { writeStatus } from './connectionPreferencesPane.js';
import { type IConversationPairingHoldSource, keepLeftoverCatalogForPairingHold } from './conversationSessionStatus.js';

/**
 * Paint a pending link notice onto the section's status node. The caller owns
 * the message (produced by `engineWriteNotSentCopy` and friends) and the node
 * (`writeStatus` or `catalogWriteStatus`); a disposed view or an empty notice
 * paints nothing.
 */
export function paintEngineLinkNotice(disposed: boolean, node: HTMLElement, message: string | undefined): void {
	if (disposed || !message) {
		return;
	}
	node.style.display = '';
	writeStatus(node, message, 'neutral');
}

/**
 * Disconnected-refresh skeleton shared by the Engine catalog sections. It is a
 * plain object the section constructs, not a base class and not a service: the
 * only shared decision is keep-or-clear. Each section still paints its own
 * leftover rows, status and closed write chrome inside `paintKept`, and its own
 * teardown inside `clear`.
 */
export class EngineCatalogSectionController {

	constructor(private readonly connection: IConversationPairingHoldSource) { }

	/**
	 * Pairing hold over a catalog that was already live keeps the rows and lets
	 * the section paint them read-only. A true disconnect, or a catalog that was
	 * never live, clears. Returns `false` so boolean `refresh` implementations
	 * can return the result directly.
	 */
	applyDisconnectedRefresh(hadLiveCatalog: boolean, paintKept: () => void, clear: () => void): false {
		if (keepLeftoverCatalogForPairingHold(hadLiveCatalog, this.connection)) {
			paintKept();
		} else {
			clear();
		}
		return false;
	}
}
