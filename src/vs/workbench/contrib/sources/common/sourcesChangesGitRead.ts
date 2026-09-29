/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { isAbsolute } from '../../../../base/common/path.js';
import { basename, isEqual, isEqualOrParent, normalizePath, removeTrailingPathSeparator } from '../../../../base/common/resources.js';
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
import { ISourcesChangeEntry, SourcesChangesReadState } from './sourcesChangesModel.js';
import { hasSourcesGitSessionId, isSourcesChangesWriteClosed } from './sourcesChangesGitWrite.js';

/** Changes / Summary stay pairing-only so a failed list can retry. Session-not-ready does not block the read. */
function sourcesGitReadRpcAllowed(connected: boolean, pairingHold: boolean, leftoverListFailed = false): boolean {
	const state: SourcesChangesReadState = leftoverListFailed
		? { kind: 'engine-leftover', sessionId: '', reason: 'read-failed' }
		: { kind: 'scm' };
	return connected && !isSourcesChangesWriteClosed(state, {
		phaseConnected: pairingHold,
		pairingPending: pairingHold,
		engineConnected: connected,
		engineSessionReady: true,
	});
}

/** Sources Changes / Review list → ReadGitChanges. Empty sessionId does not call the hook. */
export function canSendSourcesGitChanges(connected: boolean, hasHook: boolean, sessionId: string, pairingHold = false): boolean {
	return sourcesGitReadRpcAllowed(connected, pairingHold) && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Sources Changes / Review list → ReadGitSummary. Empty sessionId does not call the hook. */
export function canSendSourcesGitSummary(connected: boolean, hasHook: boolean, sessionId: string, pairingHold = false): boolean {
	return sourcesGitReadRpcAllowed(connected, pairingHold) && hasHook && hasSourcesGitSessionId(sessionId);
}

/**
 * Sources row open → ReadGitFileDiff. Empty sessionId does not call the hook.
 * leftoverListFailed also refuses FileDiff when callers pass the flag (D444).
 * Changes/Summary list gates stay pairingHold-only so refresh can retry.
 */
export function canSendSourcesGitFileDiff(connected: boolean, hasHook: boolean, sessionId: string, pairingHold = false, leftoverListFailed = false): boolean {
	return sourcesGitReadRpcAllowed(connected, pairingHold, leftoverListFailed) && hasHook && hasSourcesGitSessionId(sessionId);
}

/**
 * FileDiff leftover / pairing-hold KEEP leftover is not a live open-diff surface
 * (D444 / D446). List onDidOpen and Open Selected share this gate so leftover
 * rows do not fake-preview or mark reviewed after FileDiff is refused.
 */
export function shouldSkipSourcesGitFileDiffOpen(leftoverListFailed: boolean, pairingHoldLeftover: boolean): boolean {
	return leftoverListFailed || pairingHoldLeftover;
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

/** Listed engine row whose path is not a file under a selected root. Not openable. */
export const SOURCES_GIT_UNROOTED_SCHEME = 'sources-git-unrooted';

/**
 * One selected root, or none.
 * `workDir` must normalize equal to exactly one SCM root (or, with no SCM root, one workspace folder).
 * Several candidates and a blank `workDir` stay unrooted — the first root is not a guess.
 * Folder fallback runs only when no repository root is set.
 */
export function resolveSourcesGitResourceRoot(input: {
	readonly workDir: string | undefined;
	readonly repositoryRoots: readonly URI[];
	readonly workspaceFolders: readonly URI[];
}): URI | undefined {
	const repositoryRoots = input.repositoryRoots.filter((uri): uri is URI => !!uri);
	const folders = input.workspaceFolders.filter((uri): uri is URI => !!uri);
	const candidates = repositoryRoots.length > 0 ? repositoryRoots : folders;
	const workDir = input.workDir?.trim();
	if (workDir) {
		const wanted = sourcesGitNormalizedRoot(URI.file(workDir));
		const matches = candidates.filter(candidate => isEqual(wanted, sourcesGitNormalizedRoot(candidate)));
		return matches.length === 1 ? matches[0] : undefined;
	}
	return candidates.length === 1 ? candidates[0] : undefined;
}

/** Trailing slash is the same directory. `normalizePath` alone keeps it. */
function sourcesGitNormalizedRoot(uri: URI): URI {
	return removeTrailingPathSeparator(normalizePath(uri));
}

/**
 * File URI under `rootUri` after normalize.
 * Undefined when there is no root, or `isEqualOrParent` says the candidate left that root.
 * Scheme, query, or fragment mismatch is out of root. Does not invent a substitute path.
 */
export function sourcesGitChangeResource(path: string, rootUri: URI | undefined): URI | undefined {
	if (!rootUri) {
		return undefined;
	}
	const candidate = path !== '' && isAbsolute(path) ? URI.file(path) : URI.joinPath(rootUri, path);
	const normalized = normalizePath(candidate);
	if (!isEqualOrParent(normalized, normalizePath(rootUri))) {
		return undefined;
	}
	return normalized;
}

/** Stable non-file identity for a listed row that must not be opened via `URI.file`. */
export function sourcesGitUnrootedChangeResource(path: string): URI {
	const body = path.replace(/^\/+/, '');
	return URI.from({ scheme: SOURCES_GIT_UNROOTED_SCHEME, path: `/${body}` });
}

export function isSourcesGitUnrootedResource(resource: URI): boolean {
	return resource.scheme === SOURCES_GIT_UNROOTED_SCHEME;
}

/** Honest open failure when the row is listed but not inside the selected root. */
export function sourcesGitChangeOutsideRootMessage(): string {
	return localize('sourcesChangesGitRead.outsideRoot', "This change is not inside a selected repository root.");
}

export function collectSourcesGitChangeEntries(
	entries: readonly UniverseAgentGitChangeEntry[],
	rootUri: URI | undefined,
): ISourcesChangeEntry[] {
	const projected: ISourcesChangeEntry[] = [];
	for (const entry of entries) {
		const groupId = sourcesGitChangeGroupId(entry.indexState, entry.kind);
		// A selected root drops escapes. No root lists the row and does not guess a file URI.
		const resource = rootUri
			? sourcesGitChangeResource(entry.path, rootUri)
			: sourcesGitUnrootedChangeResource(entry.path);
		if (!resource) {
			continue;
		}
		projected.push({
			resource,
			name: entry.path === '' ? '' : (basename(resource) || entry.path),
			description: sourcesGitChangeDescription(groupId),
			groupId,
			gitPath: entry.path,
			indexState: entry.indexState,
			kind: entry.kind,
		});
	}

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
		if (line.startsWith('@@')) {
			inHunk = true;
			continue;
		}
		// Headers and other preamble share this skip. After the first @@, a body
		// line is kept even when its text starts with "+++ " or "--- ".
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
	pairingHold = false,
): Promise<UniverseAgentReadGitChangesResult | undefined> {
	if (!canSendSourcesGitChanges(connected, typeof hook === 'function', sessionId, pairingHold) || !hook) {
		return undefined;
	}
	return hook(sourcesGitChangesRequest(sessionId));
}

export async function tryReadSourcesGitSummary(
	connected: boolean,
	hook: ((request: UniverseAgentReadGitSummaryRequest) => Promise<UniverseAgentReadGitSummaryResult>) | undefined,
	sessionId: string,
	pairingHold = false,
): Promise<UniverseAgentReadGitSummaryResult | undefined> {
	if (!canSendSourcesGitSummary(connected, typeof hook === 'function', sessionId, pairingHold) || !hook) {
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
	pairingHold = false,
	leftoverListFailed = false,
): Promise<UniverseAgentReadGitFileDiffResult | undefined> {
	if (!canSendSourcesGitFileDiff(connected, typeof hook === 'function', sessionId, pairingHold, leftoverListFailed) || !hook) {
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
 * (no session / disconnected / `supported: false` / empty supported entries /
 * first-pull missing hook). Not authoritative.
 * Connected no-hook after a live git-read paint is not this message.
 */
export function sourcesGitLocalOnlyMessage(): string {
	return localize('sourcesChangesGitRead.localOnly', "Showing local source control changes only.");
}

/** Honest status when ReadGitChanges is missing after a live engine paint. */
export function sourcesGitReadUnavailableNoHookMessage(): string {
	return localize('sourcesChangesGitRead.unavailableNoHook', "Engine git changes unavailable on this client.");
}

/**
 * Connected + missing `readGitChanges` after a live git-read paint keeps leftover
 * engine rows. First-pull (leftoverCount 0) still falls through to SCM / local-only.
 * Disconnect and hook-present `supported:false` are not this gate.
 */
export function shouldKeepSourcesGitReadNoHookLeftover(
	connected: boolean,
	hasReadGitChangesHook: boolean,
	leftoverCount: number,
): boolean {
	return connected && !hasReadGitChangesHook && leftoverCount > 0;
}

/**
 * Phase `connected` + pairingPending after a live git-read paint keeps leftover
 * engine rows. `isEngineConnected()` is false during pairing (D277), so git-read
 * is skipped; this gate must win over SCM / local-only. First-pull leftoverCount 0
 * and true disconnect (phase not connected) are not this gate.
 */
export function shouldKeepSourcesGitReadPairingHoldLeftover(
	phaseConnected: boolean,
	pairingPending: boolean,
	leftoverCount: number,
): boolean {
	return phaseConnected && pairingPending && leftoverCount > 0;
}

/** Honest status when git-read leftover is held through pairing (not SCM local-only). */
export function sourcesGitReadPairingHoldMessage(): string {
	return localize('sourcesChangesGitRead.pairingHold', "Engine not connected — pairing in progress.");
}

/**
 * Non-empty engine list is the only authoritative git-read result.
 * Empty `entries` is the same SCM fallback as `supported: false`.
 */
export function hasSourcesGitReadEntries(entries: readonly ISourcesChangeEntry[] | undefined): entries is ISourcesChangeEntry[] {
	return !!entries && entries.length > 0;
}

export async function tryLoadSourcesGitChangeEntries(
	connected: boolean,
	readChanges: ((request: UniverseAgentReadGitChangesRequest) => Promise<UniverseAgentReadGitChangesResult>) | undefined,
	readSummary: ((request: UniverseAgentReadGitSummaryRequest) => Promise<UniverseAgentReadGitSummaryResult>) | undefined,
	rootUri: URI | undefined,
	sessionId: string,
	pairingHold = false,
): Promise<{ entries: ISourcesChangeEntry[]; summary: UniverseAgentReadGitSummaryResult | undefined } | undefined> {
	const changes = await tryReadSourcesGitChanges(connected, readChanges, sessionId, pairingHold);
	if (!changes || !changes.supported || changes.entries.length === 0) {
		return undefined;
	}

	// Summary throw is the same failure class as Changes throw: callers paint
	// sourcesGitReadFailureMessage and must not keep engine entries as "no summary".
	const summary = await tryReadSourcesGitSummary(connected, readSummary, sessionId, pairingHold);

	return {
		entries: collectSourcesGitChangeEntries(changes.entries, rootUri),
		summary,
	};
}
