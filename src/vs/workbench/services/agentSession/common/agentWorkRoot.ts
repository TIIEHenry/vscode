/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { isEqual, normalizePath, removeTrailingPathSeparator } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';

/**
 * Resolved directory for one session.
 * `workDir` is the session stamp, or the connection stamp when the session omitted it.
 * `localRoot` follows SCM-root precedence, then a single matching file folder.
 */
export interface IAgentWorkRoot {
	readonly sessionId: string;
	readonly engineIdentityId: string | undefined;
	readonly workDir: string | undefined;
	readonly source: 'session' | 'connection' | 'none';
	readonly access: 'local' | 'engine' | 'none';
	readonly localRoot: URI | undefined;
	readonly projectKey: string | undefined;
}

/** Backslash to slash, trim, drop a trailing slash. A slash-only path stays `/`. */
export function normalizeAgentWorkDirKey(workDir: string | undefined): string {
	if (!workDir?.trim()) {
		return '';
	}
	let normalized = workDir.trim().replace(/\\/g, '/').replace(/\/+$/, '');
	if (/^[A-Za-z]:/.test(normalized)) {
		normalized = normalized[0].toLowerCase() + normalized.slice(1);
	}
	return normalized || '/';
}

/** Trailing slash is the same directory. `normalizePath` alone keeps it. */
export function normalizeAgentWorkDirUri(uri: URI): URI {
	return removeTrailingPathSeparator(normalizePath(uri));
}

/**
 * One selected root, or none.
 * `workDir` must normalize equal to exactly one SCM root (or, with no SCM root, one workspace folder).
 * Several candidates and a blank `workDir` stay unrooted — the first root is not a guess.
 * Folder fallback runs only when no repository root is set.
 */
export function resolveAgentLocalRoot(input: {
	readonly workDir: string | undefined;
	readonly repositoryRoots: readonly URI[];
	readonly workspaceFolders: readonly URI[];
}): URI | undefined {
	const repositoryRoots = input.repositoryRoots.filter((uri): uri is URI => !!uri);
	const folders = input.workspaceFolders.filter((uri): uri is URI => !!uri);
	const candidates = repositoryRoots.length > 0 ? repositoryRoots : folders;
	const workDir = input.workDir?.trim();
	if (workDir) {
		const wanted = normalizeAgentWorkDirUri(URI.file(workDir));
		const matches = candidates.filter(candidate => isEqual(wanted, normalizeAgentWorkDirUri(candidate)));
		return matches.length === 1 ? matches[0] : undefined;
	}
	return candidates.length === 1 ? candidates[0] : undefined;
}

/** True when `workDir` is exactly one `file:` root. A subdirectory is not that root. */
export function agentWorkDirIsFileRoot(workDir: string, roots: readonly URI[]): boolean {
	const trimmed = workDir.trim();
	if (!trimmed) {
		return false;
	}
	const wanted = normalizeAgentWorkDirUri(URI.file(trimmed));
	return roots.some(root => root.scheme === Schemas.file && isEqual(wanted, normalizeAgentWorkDirUri(root)));
}

export function resolveAgentWorkRoot(input: {
	readonly sessionId: string;
	readonly sessionWorkDir: string | undefined;
	readonly connectionWorkDir: string | undefined;
	readonly engineIdentityId: string | undefined;
	readonly repositoryRoots: readonly URI[];
	readonly workspaceFolders: readonly URI[];
}): IAgentWorkRoot {
	const sessionWorkDir = input.sessionWorkDir?.trim();
	const connectionWorkDir = input.connectionWorkDir?.trim();
	let workDir: string | undefined;
	let source: IAgentWorkRoot['source'];
	if (sessionWorkDir) {
		workDir = sessionWorkDir;
		source = 'session';
	} else if (connectionWorkDir) {
		workDir = connectionWorkDir;
		source = 'connection';
	} else {
		workDir = undefined;
		source = 'none';
	}
	const localRoot = resolveAgentLocalRoot({
		workDir,
		repositoryRoots: input.repositoryRoots,
		workspaceFolders: input.workspaceFolders,
	});
	const access: IAgentWorkRoot['access'] = localRoot ? 'local' : workDir ? 'engine' : 'none';
	const engineIdentityId = input.engineIdentityId?.trim() || undefined;
	const normalized = normalizeAgentWorkDirKey(workDir);
	const projectKey = engineIdentityId && normalized ? `${engineIdentityId}\n${normalized}` : undefined;
	return {
		sessionId: input.sessionId,
		engineIdentityId,
		workDir,
		source,
		access,
		localRoot,
		projectKey,
	};
}

/** Identity of an active-root event. Unchanged values must not be re-fired. */
export function agentWorkRootDedupeKey(root: IAgentWorkRoot): string {
	return [
		root.sessionId,
		root.engineIdentityId ?? '',
		normalizeAgentWorkDirKey(root.workDir),
		root.access,
		root.localRoot?.toString() ?? '',
	].join('|');
}
