/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';

export interface ISourcesFilterableEntry {
	readonly resource: URI;
	readonly name: string;
	readonly description: string;
}

export function filterSourcesEntries<T extends ISourcesFilterableEntry>(entries: readonly T[], query: string): T[] {
	const trimmed = query.trim();
	if (!trimmed) {
		return [...entries];
	}

	const lower = trimmed.toLowerCase();
	return entries.filter(entry =>
		entry.name.toLowerCase().includes(lower)
		|| entry.description.toLowerCase().includes(lower)
		|| entry.resource.fsPath.toLowerCase().includes(lower));
}
