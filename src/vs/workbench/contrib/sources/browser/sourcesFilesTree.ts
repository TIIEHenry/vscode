/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectTreeElementCollapseState, IObjectTreeElement } from '../../../../base/browser/ui/tree/tree.js';
import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { ISourcesFileEntry } from '../common/sourcesFilesModel.js';

/** View node. Folders exist only so the flat search projection can be drawn as a tree. */
export interface ISourcesFilesTreeNode {
	readonly kind: 'file' | 'folder';
	readonly id: string;
	readonly name: string;
	/** Present on file rows. Opening a folder does nothing. */
	readonly file?: ISourcesFileEntry;
}

interface IMutableFolder {
	readonly kind: 'folder';
	readonly id: string;
	readonly name: string;
	readonly children: Map<string, IMutableFolder | ISourcesFilesTreeNode>;
}

/**
 * Group an already-collected file projection by its relative path.
 * This does not walk the disk: parent rows are the path segments already on each entry.
 */
export function buildSourcesFileTree(
	entries: readonly ISourcesFileEntry[],
	collapsed: boolean | ObjectTreeElementCollapseState,
): IObjectTreeElement<ISourcesFilesTreeNode>[] {
	const roots = new Map<string, IMutableFolder | ISourcesFilesTreeNode>();
	for (const entry of entries) {
		insertSourcesFile(roots, entry, sourcesFileFolderSegments(entry), '');
	}
	return toSourcesFileTreeElements(roots, collapsed);
}

function sourcesFileFolderSegments(entry: ISourcesFileEntry): readonly string[] {
	const parts = entry.description.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').split('/').filter(part => part.length > 0 && part !== '.');
	if (parts.length <= 1) {
		return [];
	}
	return parts.slice(0, -1);
}

function insertSourcesFile(bucket: Map<string, IMutableFolder | ISourcesFilesTreeNode>, entry: ISourcesFileEntry, folders: readonly string[], parentId: string): void {
	if (folders.length === 0) {
		const file: ISourcesFilesTreeNode = {
			kind: 'file',
			id: entry.resource.toString(),
			name: entry.name,
			file: entry,
		};
		bucket.set(file.id, file);
		return;
	}
	const [head, ...rest] = folders;
	const id = parentId ? `${parentId}/${head}` : `folder:${head}`;
	const existing = bucket.get(id);
	const folder: IMutableFolder = existing && isMutableFolder(existing)
		? existing
		: { kind: 'folder', id, name: head, children: new Map() };
	if (folder !== existing) {
		bucket.set(id, folder);
	}
	insertSourcesFile(folder.children, entry, rest, id);
}

function isMutableFolder(node: IMutableFolder | ISourcesFilesTreeNode): node is IMutableFolder {
	return node.kind === 'folder' && 'children' in node;
}

function toSourcesFileTreeElements(bucket: Map<string, IMutableFolder | ISourcesFilesTreeNode>, collapsed: boolean | ObjectTreeElementCollapseState): IObjectTreeElement<ISourcesFilesTreeNode>[] {
	const nodes = [...bucket.values()];
	nodes.sort((a, b) => {
		if (a.kind !== b.kind) {
			return a.kind === 'folder' ? -1 : 1;
		}
		return compareFileNamesDefault(a.name, b.name);
	});
	return nodes.map(node => {
		if ('children' in node) {
			return {
				element: { kind: 'folder' as const, id: node.id, name: node.name },
				children: toSourcesFileTreeElements(node.children, collapsed),
				collapsible: true,
				collapsed,
			};
		}
		return { element: node };
	});
}
