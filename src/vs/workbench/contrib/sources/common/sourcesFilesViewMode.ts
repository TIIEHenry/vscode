/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const SOURCES_FILES_VIEW_MODE_SETTING = 'sources.files.viewMode';

export type SourcesFilesViewMode = 'tree' | 'list';

export function readSourcesFilesViewMode(value: unknown): SourcesFilesViewMode {
	return value === 'list' ? 'list' : 'tree';
}
