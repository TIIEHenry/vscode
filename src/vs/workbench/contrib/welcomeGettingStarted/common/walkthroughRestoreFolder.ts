/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { UNKNOWN_EMPTY_WINDOW_WORKSPACE } from '../../../../platform/workspace/common/workspace.js';

export function walkthroughRestoreFolderMatches(restoreFolder: string, folders: readonly { uri: URI }[]): boolean {
	if (restoreFolder === UNKNOWN_EMPTY_WINDOW_WORKSPACE.id) {
		return true;
	}
	if (folders.length === 0) {
		return false;
	}
	return restoreFolder === folders[0].uri.toString();
}
