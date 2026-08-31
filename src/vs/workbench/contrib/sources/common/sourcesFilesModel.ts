/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { relativePath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { ExplorerItem } from '../../files/common/explorerModel.js';
import { SortOrder } from '../../files/common/files.js';

export interface ISourcesFileEntry {
	readonly resource: URI;
	readonly name: string;
	readonly description: string;
}

export async function collectSourcesFileEntries(roots: readonly ExplorerItem[], sortOrder: SortOrder): Promise<ISourcesFileEntry[]> {
	const entries: ISourcesFileEntry[] = [];

	for (const root of roots) {
		await collectFromItem(root, sortOrder, entries);
	}

	entries.sort((a, b) => compareFileNamesDefault(a.description, b.description));
	return entries;
}

async function collectFromItem(item: ExplorerItem, sortOrder: SortOrder, entries: ISourcesFileEntry[]): Promise<void> {
	if (item.isExcluded) {
		return;
	}

	if (!item.isDirectory) {
		const rootUri = item.root.resource;
		entries.push({
			resource: item.resource,
			name: item.name,
			description: relativePath(rootUri, item.resource) ?? item.name,
		});

		if (item.nestedChildren) {
			for (const nested of item.nestedChildren) {
				await collectFromItem(nested, sortOrder, entries);
			}
		}
		return;
	}

	let children: ExplorerItem[];
	if (item._isDirectoryResolved) {
		children = [...item.children.values()];
	} else {
		try {
			children = await item.fetchChildren(sortOrder);
		} catch {
			return;
		}
	}

	for (const child of children) {
		await collectFromItem(child, sortOrder, entries);
	}
}
