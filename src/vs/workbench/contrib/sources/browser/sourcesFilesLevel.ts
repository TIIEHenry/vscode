/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { basename, relativePath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { ISourcesFileEntry } from '../common/sourcesFilesModel.js';
import { ISourcesFilesTreeNode } from './sourcesFilesTree.js';

/** One child of the directory the current Preview tab is showing. */
export interface ISourcesLevelChild {
	readonly resource: URI;
	readonly name: string;
	readonly isDirectory: boolean;
}

/**
 * Immediate children of one directory. Folder rows stay leaves: the list follows
 * the current tab, so a folder click must not walk further or open an editor.
 */
export function buildSourcesWorkspaceLevel(children: readonly ISourcesLevelChild[], describe: (resource: URI) => string): ISourcesFilesTreeNode[] {
	return sortSourcesLevel(children.map(child => {
		if (child.isDirectory) {
			return { kind: 'folder' as const, id: `dir:${child.resource.toString()}`, name: child.name };
		}
		const file: ISourcesFileEntry = {
			resource: child.resource,
			name: child.name,
			description: describe(child.resource),
		};
		return { kind: 'file' as const, id: child.resource.toString(), name: child.name, file };
	}));
}

/** Same parent, one level, from the already-collected engine projection. */
export function buildSourcesEngineLevel(entries: readonly ISourcesFileEntry[], parentKey: string): ISourcesFilesTreeNode[] {
	const folders = new Map<string, ISourcesFilesTreeNode>();
	const files = new Map<string, ISourcesFilesTreeNode>();
	const parentParts = parentKey.length === 0 ? [] : parentKey.split('/');
	for (const entry of entries) {
		const parts = sourcesLevelParts(entry.description);
		if (parentParts.length > 0 && parts.slice(0, parentParts.length).join('/') !== parentKey) {
			continue;
		}
		const rest = parts.slice(parentParts.length);
		if (rest.length === 0) {
			continue;
		}
		if (rest.length === 1) {
			files.set(entry.resource.toString(), {
				kind: 'file',
				id: entry.resource.toString(),
				name: entry.name,
				file: entry,
			});
			continue;
		}
		const name = rest[0];
		const id = `folder:${parentKey ? `${parentKey}/` : ''}${name}`;
		if (!folders.has(id)) {
			folders.set(id, { kind: 'folder', id, name });
		}
	}
	return sortSourcesLevel([...folders.values(), ...files.values()]);
}

export function sourcesEngineParentKey(description: string): string {
	const parts = sourcesLevelParts(description);
	if (parts.length <= 1) {
		return '';
	}
	return parts.slice(0, -1).join('/');
}

export function sourcesDirectoryLabel(directory: URI, folders: readonly URI[]): string {
	for (const folder of folders) {
		const rel = relativePath(folder, directory);
		if (rel === undefined || rel === '..' || rel.startsWith('../')) {
			continue;
		}
		if (rel === '') {
			return basename(folder) || directory.path;
		}
		return rel;
	}
	return basename(directory) || directory.path.replace(/\\/g, '/').replace(/\/+$/g, '') || directory.toString();
}

export function filterSourcesLevelNodes(nodes: readonly ISourcesFilesTreeNode[], query: string): ISourcesFilesTreeNode[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) {
		return [...nodes];
	}
	return nodes.filter(node => {
		if (node.name.toLowerCase().includes(trimmed)) {
			return true;
		}
		const file = node.file;
		if (!file) {
			return false;
		}
		return file.description.toLowerCase().includes(trimmed)
			|| file.resource.fsPath.toLowerCase().includes(trimmed);
	});
}

export function sourcesFileDescription(resource: URI, folders: readonly URI[]): string {
	for (const folder of folders) {
		const rel = relativePath(folder, resource);
		if (rel && rel !== '..' && !rel.startsWith('../')) {
			return rel;
		}
	}
	return basename(resource);
}

function sourcesLevelParts(description: string): string[] {
	return description.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').split('/').filter(part => part.length > 0 && part !== '.');
}

function sortSourcesLevel(nodes: ISourcesFilesTreeNode[]): ISourcesFilesTreeNode[] {
	return nodes.sort((a, b) => {
		if (a.kind !== b.kind) {
			return a.kind === 'folder' ? -1 : 1;
		}
		return compareFileNamesDefault(a.name, b.name);
	});
}
