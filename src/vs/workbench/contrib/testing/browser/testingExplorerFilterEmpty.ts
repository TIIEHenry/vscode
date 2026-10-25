/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { TestingExplorerFilterEmpty } from '../common/testingExplorerFilterEmpty.js';

export function testingExplorerFilterEmptyText(reason: TestingExplorerFilterEmpty | undefined): string | undefined {
	switch (reason) {
		case 'noMatching':
			return nls.localize('testingExplorerFilterNoMatching', "No matching tests.");
		default:
			return undefined;
	}
}

/** No reason clears the sentence and hides the overlay. The tree stays in place. */
export function applyTestingExplorerFilterEmpty(message: HTMLElement, reason: TestingExplorerFilterEmpty | undefined): void {
	const text = testingExplorerFilterEmptyText(reason);
	if (!text) {
		message.textContent = '';
		message.style.display = 'none';
		return;
	}
	message.textContent = text;
	message.style.display = '';
}
