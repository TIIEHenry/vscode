/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';

/** Workspace storage. Not a settings key. */
export const SOURCES_FILES_LIST_MODE_STORAGE_KEY = 'sources.files.listMode';

/**
 * Sources title bar keeps the three tabs at their intrinsic width from this
 * part width up. Below it the tabs grow to fill the bar, so the filter stays
 * in the panel.
 */
export const SOURCES_FILTER_BAR_MIN_WIDTH = 600;

export function sourcesFilterFitsOnBar(partWidth: number): boolean {
	return partWidth >= SOURCES_FILTER_BAR_MIN_WIDTH;
}

/**
 * Directory a Files list shows for a breadcrumb or folder pick.
 * A pick inside a workspace folder is that directory. A pick above the
 * workspace snaps to the folder it contains. Anything else snaps to the
 * first workspace folder.
 */
export function sourcesListDirectoryTarget(picked: URI | undefined, folders: readonly URI[], isEqualOrParent: (resource: URI, parent: URI) => boolean): URI | undefined {
	if (folders.length === 0) {
		return undefined;
	}
	if (!picked) {
		return folders[0];
	}
	if (folders.some(folder => isEqualOrParent(picked, folder))) {
		return picked;
	}
	const contained = folders.filter(folder => isEqualOrParent(folder, picked));
	if (contained.length === 1) {
		return contained[0];
	}
	return folders[0];
}
