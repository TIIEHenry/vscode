/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { relativePath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ISourcesChangeEntry, sourcesChangeEntryIdentity } from './sourcesChangesModel.js';

export const SOURCES_CHANGE_FILE_ROW_HEIGHT = 22;
export const SOURCES_CHANGE_GROUP_HEADER_HEIGHT = 22;

export interface ISourcesChangeStatusMark {
	readonly letter: string;
	readonly tooltip: string;
	/** CSS color expression, usually a git decoration variable. */
	readonly color: string;
	readonly strikethrough: boolean;
	/** False when the letter is only the group fallback. */
	readonly confident: boolean;
}

export interface ISourcesChangeStatusInput {
	readonly groupId: string;
	readonly indexState?: string;
	readonly kind?: string;
	readonly strikeThrough?: boolean;
	readonly tooltip?: string;
	readonly iconPath?: string;
}

/** Parent directory shown beside the file name. Never the SCM group label. */
export function sourcesChangeParentDirectory(gitPath: string | undefined, resource: URI, root: URI | undefined): string {
	if (gitPath) {
		return parentDirectory(gitPath);
	}
	if (root) {
		const relative = relativePath(root, resource);
		if (relative) {
			return parentDirectory(relative);
		}
	}
	return '';
}

export function sourcesChangeGroupStartIdentities(entries: readonly ISourcesChangeEntry[]): Set<string> {
	const starts = new Set<string>();
	let previous: string | undefined;
	for (const entry of entries) {
		if (entry.groupId !== previous) {
			starts.add(sourcesChangeEntryIdentity(entry));
			previous = entry.groupId;
		}
	}
	return starts;
}

export function sourcesChangeGroupCounts(entries: readonly { groupId: string }[]): ReadonlyMap<string, number> {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		counts.set(entry.groupId, (counts.get(entry.groupId) ?? 0) + 1);
	}
	return counts;
}

export function sourcesChangeStatusMark(input: ISourcesChangeStatusInput): ISourcesChangeStatusMark {
	const staged = isStaged(input.groupId, input.indexState);
	const fromKind = letterFromKind(input.kind);
	const fromIcon = letterFromIcon(input.iconPath);
	const fromTooltip = letterFromTooltip(input.tooltip);
	const letter = fromKind ?? fromIcon ?? fromTooltip ?? letterFromGroup(input.groupId, !!input.strikeThrough);
	const confident = fromKind !== undefined || fromIcon !== undefined || fromTooltip !== undefined;
	const strikethrough = !!input.strikeThrough || letter === 'D';
	const tooltip = input.tooltip?.trim() || defaultTooltip(letter, staged);
	return {
		letter,
		tooltip,
		color: gitDecorationColor(colorId(letter, staged)),
		strikethrough,
		confident,
	};
}

function parentDirectory(path: string): string {
	const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
	if (slash <= 0) {
		return '';
	}
	return path.slice(0, slash);
}

function isStaged(groupId: string, indexState: string | undefined): boolean {
	const state = (indexState ?? '').toUpperCase();
	return groupId === 'index' || state === 'INDEX' || state === 'STAGED';
}

function letterFromKind(kind: string | undefined): string | undefined {
	switch ((kind ?? '').toUpperCase()) {
		case 'UNTRACKED':
			return 'U';
		case 'ADDED':
		case 'NEW':
		case 'INTENT_TO_ADD':
			return 'A';
		case 'DELETED':
		case 'REMOVED':
			return 'D';
		case 'RENAMED':
			return 'R';
		case 'COPIED':
			return 'C';
		case 'IGNORED':
			return 'I';
		case 'TYPE_CHANGED':
		case 'TYPECHANGE':
			return 'T';
		case 'CONFLICT':
		case 'UNMERGED':
		case 'BOTH_MODIFIED':
		case 'BOTH_ADDED':
		case 'BOTH_DELETED':
			return '!';
		case 'MODIFIED':
			return 'M';
		default:
			return undefined;
	}
}

function letterFromIcon(iconPath: string | undefined): string | undefined {
	const path = (iconPath ?? '').toLowerCase();
	if (path === '') {
		return undefined;
	}
	if (path.includes('status-untracked')) {
		return 'U';
	}
	if (path.includes('status-added')) {
		return 'A';
	}
	if (path.includes('status-deleted')) {
		return 'D';
	}
	if (path.includes('status-renamed')) {
		return 'R';
	}
	if (path.includes('status-copied')) {
		return 'C';
	}
	if (path.includes('status-conflict')) {
		return '!';
	}
	if (path.includes('status-ignored')) {
		return 'I';
	}
	if (path.includes('status-type-changed')) {
		return 'T';
	}
	if (path.includes('status-modified')) {
		return 'M';
	}
	return undefined;
}

function letterFromTooltip(tooltip: string | undefined): string | undefined {
	const text = (tooltip ?? '').toLowerCase();
	if (text === '') {
		return undefined;
	}
	if (text.includes('untracked')) {
		return 'U';
	}
	if (text.includes('conflict') || text.includes('both deleted') || text.includes('both added') || text.includes('both modified')) {
		return '!';
	}
	if (text.includes('ignored')) {
		return 'I';
	}
	if (text.includes('type changed')) {
		return 'T';
	}
	if (text.includes('renamed')) {
		return 'R';
	}
	if (text.includes('copied')) {
		return 'C';
	}
	if (text.includes('deleted')) {
		return 'D';
	}
	if (text.includes('added')) {
		return 'A';
	}
	if (text.includes('modified')) {
		return 'M';
	}
	return undefined;
}

function letterFromGroup(groupId: string, strikeThrough: boolean): string {
	switch (groupId) {
		case 'untracked':
			return 'U';
		case 'merge':
			return '!';
		case 'index':
			return strikeThrough ? 'D' : 'M';
		default:
			return strikeThrough ? 'D' : 'M';
	}
}

function colorId(letter: string, staged: boolean): string {
	switch (letter) {
		case 'U':
			return 'gitDecoration.untrackedResourceForeground';
		case 'A':
			return 'gitDecoration.addedResourceForeground';
		case 'D':
			return staged ? 'gitDecoration.stageDeletedResourceForeground' : 'gitDecoration.deletedResourceForeground';
		case 'R':
		case 'C':
			return 'gitDecoration.renamedResourceForeground';
		case '!':
			return 'gitDecoration.conflictingResourceForeground';
		case 'I':
			return 'gitDecoration.ignoredResourceForeground';
		case 'M':
			return staged ? 'gitDecoration.stageModifiedResourceForeground' : 'gitDecoration.modifiedResourceForeground';
		default:
			return 'gitDecoration.modifiedResourceForeground';
	}
}

function gitDecorationColor(id: string): string {
	return `var(--vscode-${id.replace(/\./g, '-')})`;
}

function defaultTooltip(letter: string, staged: boolean): string {
	switch (letter) {
		case 'U':
			return localize('sourcesChangeStatus.untracked', "Untracked");
		case 'A':
			return localize('sourcesChangeStatus.added', "Added");
		case 'D':
			return localize('sourcesChangeStatus.deleted', "Deleted");
		case 'R':
			return localize('sourcesChangeStatus.renamed', "Renamed");
		case 'C':
			return localize('sourcesChangeStatus.copied', "Copied");
		case '!':
			return localize('sourcesChangeStatus.conflict', "Conflict");
		case 'I':
			return localize('sourcesChangeStatus.ignored', "Ignored");
		case 'T':
			return localize('sourcesChangeStatus.typeChanged', "Type Changed");
		default:
			return staged
				? localize('sourcesChangeStatus.staged', "Staged")
				: localize('sourcesChangeStatus.modified', "Modified");
	}
}
