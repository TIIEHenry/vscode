/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { ExplorerFlatListEmpty } from '../common/explorerFlatListEmpty.js';

export function explorerFlatListEmptyText(reason: ExplorerFlatListEmpty | undefined): string | undefined {
	switch (reason) {
		case 'emptyFolder':
			return nls.localize('explorerFlatListEmptyFolder', "This folder is empty.");
		case 'noMatching':
			return nls.localize('explorerFlatListNoMatching', "No matching files.");
		default:
			return undefined;
	}
}

/** `display: ''` lets the stylesheet flex the message. No reason hides it and shows the tree. */
export function applyExplorerFlatListEmpty(message: HTMLElement, tree: HTMLElement, reason: ExplorerFlatListEmpty | undefined): void {
	const text = explorerFlatListEmptyText(reason);
	if (!text) {
		message.textContent = '';
		message.style.display = 'none';
		tree.style.display = '';
		return;
	}
	message.textContent = text;
	message.style.display = '';
	tree.style.display = 'none';
}
