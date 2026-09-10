/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { isAbsolute } from '../../../../base/common/path.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import type {
	UniverseAgentGitChangeEntry,
	UniverseAgentReadGitChangesRequest,
	UniverseAgentReadGitChangesResult,
	UniverseAgentReadGitFileDiffRequest,
	UniverseAgentReadGitFileDiffResult,
	UniverseAgentReadGitSummaryRequest,
	UniverseAgentReadGitSummaryResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ISourcesChangeEntry } from './sourcesChangesModel.js';
import { hasSourcesGitSessionId } from './sourcesChangesGitWrite.js';

/** Sources Changes / Review list → ReadGitChanges. Empty sessionId does not call the hook. */
export function canSendSourcesGitChanges(connected: boolean, hasHook: boolean, sessionId: string): boolean {
	return connected && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Sources Changes / Review list → ReadGitSummary. Empty sessionId does not call the hook. */
export function canSendSourcesGitSummary(connected: boolean, hasHook: boolean, sessionId: string): boolean {
	return connected && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Sources row open → ReadGitFileDiff. Empty sessionId does not call the hook. */
export function canSendSourcesGitFileDiff(connected: boolean, hasHook: boolean, sessionId: string): boolean {
	return connected && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Same `sessionId` as write (`sourcesGitStagePathsRequest`). */
export function sourcesGitChangesRequest(sessionId: string): UniverseAgentReadGitChangesRequest {
	return {
		sessionId,
	};
}

/** Same `sessionId` as write (`sourcesGitStagePathsRequest`). */
export function sourcesGitSummaryRequest(sessionId: string): UniverseAgentReadGitSummaryRequest {
	return {
		sessionId,
	};
}

/**
 * Same `sessionId` as write.
 * Pass through empty `path` / `indexState` as-is (no default / no trim).
 */
export function sourcesGitFileDiffRequest(
	sessionId: string,
	path: string,
	indexState: string,
): UniverseAgentReadGitFileDiffRequest {
	return {
		sessionId,
		path,
		indexState,
	};
}

/** Git-sourced row needs an engine diff only when local SCM / quickDiff cannot supply one. */
export function needsSourcesGitFileDiff(
	entry: ISourcesChangeEntry,
	hasLocalOriginal: boolean,
): boolean {
	return entry.gitPath !== undefined && !entry.scmResource && !hasLocalOriginal;
}

export function sourcesGitChangeGroupId(indexState: string, kind: string): string {
	const state = indexState.toUpperCase();
	const kindUpper = kind.toUpperCase();
	if (state === '') {
		return '';
	}
	if (state === 'INDEX' || state === 'STAGED') {
		return 'index';
	}
	if (state === 'UNMERGED' || state === 'MERGE' || state === 'CONFLICT') {
		return 'merge';
	}
	if (state === 'UNTRACKED' || kindUpper === 'UNTRACKED') {
		return 'untracked';
	}
	if (state === 'WORKTREE' || state === 'UNSTAGED' || state === 'STAGED_AND_WORKTREE' || state === 'WORKINGTREE') {
		return 'workingTree';
	}
	return indexState;
}

export function sourcesGitChangeDescription(groupId: string): string {
	switch (groupId) {
		case 'index':
			return localize('sourcesChangesGitRead.staged', "Staged Changes");
		case 'workingTree':
			return localize('sourcesChangesGitRead.unstaged', "Unstaged Changes");
		case 'untracked':
			return localize('sourcesChangesGitRead.untracked', "Untracked Changes");
		case 'merge':
			return localize('sourcesChangesGitRead.merge', "Merge Changes");
		case '':
			return '';
		default:
			return groupId;
	}
}

export function sourcesGitChangeResource(path: string, rootUri: URI | undefined): URI {
	if (path !== '' && isAbsolute(path)) {
		return URI.file(path);
	}
	if (rootUri) {
		return URI.joinPath(rootUri, path);
	}
	return URI.file(path);
}

export function collectSourcesGitChangeEntries(
	entries: readonly UniverseAgentGitChangeEntry[],
	rootUri: URI | undefined,
): ISourcesChangeEntry[] {
	const projected: ISourcesChangeEntry[] = entries.map(entry => {
		const groupId = sourcesGitChangeGroupId(entry.indexState, entry.kind);
		const resource = sourcesGitChangeResource(entry.path, rootUri);
		return {
			resource,
			name: entry.path === '' ? '' : (basename(resource) || entry.path),
			description: sourcesGitChangeDescription(groupId),
			groupId,
			gitPath: entry.path,
			indexState: entry.indexState,
		};
	});

	projected.sort((a, b) => {
		const groupCompare = compareFileNamesDefault(a.description, b.description);
		if (groupCompare !== 0) {
			return groupCompare;
		}
		return compareFileNamesDefault(a.resource.fsPath, b.resource.fsPath);
	});

	return projected;
}

/**
 * Reconstruct changed hunks only. Omitted file body is not invented.
 * Empty `unifiedDiff` stays empty on both sides.
 */
export function parseSourcesGitUnifiedDiff(unifiedDiff: string): { original: string; modified: string } {
	if (unifiedDiff === '') {
		return { original: '', modified: '' };
	}

	const original: string[] = [];
	const modified: string[] = [];
	let inHunk = false;

	for (const line of unifiedDiff.split('\n')) {
		if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
			continue;
		}
		if (line.startsWith('@@')) {
			inHunk = true;
			continue;
		}
		if (!inHunk) {
			continue;
		}
		if (line.startsWith('+')) {
			modified.push(line.slice(1));
			continue;
		}
		if (line.startsWith('-')) {
			original.push(line.slice(1));
			continue;
		}
		if (line.startsWith('\\')) {
			continue;
		}
		const text = line.startsWith(' ') ? line.slice(1) : line;
		original.push(text);
		modified.push(text);
	}

	return {
		original: original.join('\n'),
		modified: modified.join('\n'),
	};
}

export async function tryReadSourcesGitChanges(
	connected: boolean,
	hook: ((request: UniverseAgentReadGitChangesRequest) => Promise<UniverseAgentReadGitChangesResult>) | undefined,
	sessionId: string,
): Promise<UniverseAgentReadGitChangesResult | undefined> {
	if (!canSendSourcesGitChanges(connected, typeof hook === 'function', sessionId) || !hook) {
		return undefined;
	}
	return hook(sourcesGitChangesRequest(sessionId));
}

export async function tryReadSourcesGitSummary(
	connected: boolean,
	hook: ((request: UniverseAgentReadGitSummaryRequest) => Promise<UniverseAgentReadGitSummaryResult>) | undefined,
	sessionId: string,
): Promise<UniverseAgentReadGitSummaryResult | undefined> {
	if (!canSendSourcesGitSummary(connected, typeof hook === 'function', sessionId) || !hook) {
		return undefined;
	}
	return hook(sourcesGitSummaryRequest(sessionId));
}

export async function tryReadSourcesGitFileDiff(
	connected: boolean,
	hook: ((request: UniverseAgentReadGitFileDiffRequest) => Promise<UniverseAgentReadGitFileDiffResult>) | undefined,
	sessionId: string,
	path: string,
	indexState: string,
): Promise<UniverseAgentReadGitFileDiffResult | undefined> {
	if (!canSendSourcesGitFileDiff(connected, typeof hook === 'function', sessionId) || !hook) {
		return undefined;
	}
	return hook(sourcesGitFileDiffRequest(sessionId, path, indexState));
}

/** Honest git-read failure text for Changes / Review status lines. */
export function sourcesGitReadFailureMessage(error: unknown): string {
	return localize('sourcesChangesGitRead.failed', "Unable to read git changes: {0}", getErrorMessage(error));
}

/** Honest open-diff failure text; same status surface as git-read, not a silent catch. */
export function sourcesGitDiffOpenFailureMessage(error: unknown): string {
	return localize('sourcesChangesGitRead.diffOpenFailed', "Unable to open diff: {0}", getErrorMessage(error));
}

/** Supported ReadGitFileDiff with empty `unifiedDiff` is not a new file and must not open. */
export function sourcesGitEmptyFileDiffMessage(): string {
	return localize('sourcesChangesGitRead.emptyFileDiff', "Git file diff is empty.");
}

/**
 * SCM leftover is local-only when the engine list is unavailable
 * (no session / disconnected / `supported: false`). Not authoritative.
 */
export function sourcesGitLocalOnlyMessage(): string {
	return localize('sourcesChangesGitRead.localOnly', "Showing local source control changes only.");
}

export async function tryLoadSourcesGitChangeEntries(
	connected: boolean,
	readChanges: ((request: UniverseAgentReadGitChangesRequest) => Promise<UniverseAgentReadGitChangesResult>) | undefined,
	readSummary: ((request: UniverseAgentReadGitSummaryRequest) => Promise<UniverseAgentReadGitSummaryResult>) | undefined,
	rootUri: URI | undefined,
	sessionId: string,
): Promise<{ entries: ISourcesChangeEntry[]; summary: UniverseAgentReadGitSummaryResult | undefined } | undefined> {
	const changes = await tryReadSourcesGitChanges(connected, readChanges, sessionId);
	if (!changes || !changes.supported) {
		return undefined;
	}

	// Summary throw is the same failure class as Changes throw: callers paint
	// sourcesGitReadFailureMessage and must not keep engine entries as "no summary".
	const summary = await tryReadSourcesGitSummary(connected, readSummary, sessionId);

	return {
		entries: collectSourcesGitChangeEntries(changes.entries, rootUri),
		summary,
	};
}
