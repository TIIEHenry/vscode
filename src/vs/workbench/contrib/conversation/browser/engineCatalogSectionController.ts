/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { writeStatus } from './connectionPreferencesPane.js';

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
