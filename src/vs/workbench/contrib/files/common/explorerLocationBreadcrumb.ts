/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as paths from '../../../../base/common/path.js';
import { isWindows } from '../../../../base/common/platform.js';
import { Schemas } from '../../../../base/common/network.js';
import { originalFSPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';

export const EXPLORER_LOCATION_ROOT_ID = 'root';

export interface IExplorerLocationBreadcrumbItem {
	readonly id: string;
	readonly label: string;
}

export function getExplorerLocationBreadcrumbItems(folderUri: URI | undefined, rootLabel: string): IExplorerLocationBreadcrumbItem[] {
	if (!folderUri) {
		return [];
	}

	const segments = getFolderPathSegments(folderUri);
	const items: IExplorerLocationBreadcrumbItem[] = [{ id: EXPLORER_LOCATION_ROOT_ID, label: rootLabel }];

	for (let i = 0; i < segments.length; i++) {
		items.push({
			id: buildSegmentUri(folderUri, segments, i).toString(),
			label: segments[i],
		});
	}

	return items;
}

function getFolderPathSegments(uri: URI): string[] {
	const fsPath = originalFSPath(uri);
	if (!fsPath) {
		return [];
	}

	const normalized = paths.normalize(fsPath).replace(/[\\/]+$/, '');
	if (!normalized || normalized === '.' || normalized === '/') {
		return [];
	}

	return normalized.split(/[\\/]/).filter(segment => segment.length > 0);
}

function buildSegmentUri(folderUri: URI, segments: readonly string[], index: number): URI {
	const prefixSegments = segments.slice(0, index + 1);

	if (folderUri.scheme === Schemas.file) {
		if (isWindows && prefixSegments[0]?.match(/^[a-zA-Z]:$/)) {
			return URI.file(paths.join(...prefixSegments));
		}
		return URI.file('/' + prefixSegments.join('/'));
	}

	return folderUri.with({ path: '/' + prefixSegments.join('/') });
}
