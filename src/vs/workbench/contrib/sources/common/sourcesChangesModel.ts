/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ISCMResource } from '../../scm/common/scm.js';

export type SourcesChangesOrigin = 'engine' | 'scm';

export interface ISourcesChangeEntry {
	readonly resource: URI;
	readonly name: string;
	readonly description: string;
	readonly groupId: string;
	readonly scmResource?: ISCMResource;
	/** Engine GitChangeEntry path when the row came from ReadGitChanges. */
	readonly gitPath?: string;
	/** Engine `index_state` as-is when the row came from ReadGitChanges. */
	readonly indexState?: string;
	/** Engine GitChangeEntry `kind` when the row came from ReadGitChanges. */
	readonly kind?: string;
	/** Which read produced the row. SCM rows have no sessionId. */
	readonly origin?: SourcesChangesOrigin;
	/** Session that produced an engine row. Leftover rows keep this id. */
	readonly sessionId?: string;
}

export interface ISourcesChangeResourceLike {
	readonly sourceUri: URI;
}

export interface ISourcesChangeGroupLike {
	readonly id: string;
	readonly label: string;
	readonly resources: readonly ISourcesChangeResourceLike[];
}

export interface ISourcesChangeRepositoryLike {
	readonly provider: {
		readonly groups: readonly ISourcesChangeGroupLike[];
	};
}

function isISCMResource(resource: ISourcesChangeResourceLike): resource is ISCMResource {
	return typeof (resource as ISCMResource).resourceGroup !== 'undefined';
}

export function collectSourcesChangeEntries(repos: Iterable<ISourcesChangeRepositoryLike>): ISourcesChangeEntry[] {
	const entries: ISourcesChangeEntry[] = [];

	for (const repo of repos) {
		for (const group of repo.provider.groups) {
			for (const resource of group.resources) {
				entries.push({
					resource: resource.sourceUri,
					name: basename(resource.sourceUri),
					description: group.label,
					groupId: group.id,
					scmResource: isISCMResource(resource) ? resource : undefined,
				});
			}
		}
	}

	entries.sort((a, b) => {
		const groupCompare = compareFileNamesDefault(a.description, b.description);
		if (groupCompare !== 0) {
			return groupCompare;
		}
		return compareFileNamesDefault(a.resource.fsPath, b.resource.fsPath);
	});

	return entries;
}

export function sourcesChangeEntryIdentity(entry: ISourcesChangeEntry): string {
	return `${entry.resource.toString()}\0${entry.groupId}\0${entry.gitPath ?? ''}\0${entry.indexState ?? ''}`;
}

export type SourcesChangesReadState =
	| { kind: 'scm' }
	| { kind: 'engine-live'; sessionId: string }
	| { kind: 'engine-leftover'; sessionId: string; reason: 'pairing-hold' | 'no-hook' | 'read-failed' };

export interface ISourcesChangesSnapshot {
	readonly generation: number;
	readonly settled: boolean;
	readonly state: SourcesChangesReadState;
	readonly entries: readonly ISourcesChangeEntry[];
	readonly failureMessage?: string;
}

export const ISourcesChangesModel = createDecorator<ISourcesChangesModel>('sourcesChangesModel');

export interface ISourcesChangesModel {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	getSnapshot(): ISourcesChangesSnapshot;
	isWriteClosed(): boolean;
	isFileDiffOpenSkipped(): boolean;
	refresh(): Promise<void>;
	/** Debounced re-read shared by Changes and Review. */
	scheduleRefresh(): void;
	/** Run a pending debounced re-read immediately. */
	flushScheduledRefresh(): void;
}

export function initialSourcesChangesSnapshot(): ISourcesChangesSnapshot {
	return {
		generation: 0,
		settled: false,
		state: { kind: 'scm' },
		entries: [],
	};
}

export function isSourcesChangesReadFailed(state: SourcesChangesReadState): boolean {
	return state.kind === 'engine-leftover' && state.reason === 'read-failed';
}

/** FileDiff open skip: read-failed, or pairing-hold leftover. scm + failureMessage stays open. */
export function isSourcesFileDiffOpenSkipped(state: SourcesChangesReadState): boolean {
	return state.kind === 'engine-leftover' && (state.reason === 'read-failed' || state.reason === 'pairing-hold');
}

export function sourcesChangesEngineRowCount(snapshot: ISourcesChangesSnapshot): number {
	return snapshot.state.kind === 'scm' ? 0 : snapshot.entries.length;
}

export function stampSourcesEngineEntries(entries: readonly ISourcesChangeEntry[], sessionId: string): ISourcesChangeEntry[] {
	return entries.map(entry => ({ ...entry, origin: 'engine' as const, sessionId }));
}

export function stampSourcesScmEntries(entries: readonly ISourcesChangeEntry[]): ISourcesChangeEntry[] {
	return entries.map(entry => ({
		resource: entry.resource,
		name: entry.name,
		description: entry.description,
		groupId: entry.groupId,
		scmResource: entry.scmResource,
		gitPath: entry.gitPath,
		indexState: entry.indexState,
		kind: entry.kind,
		origin: 'scm' as const,
	}));
}

/**
 * Write session: an entry's own sessionId wins (leftover rows keep the session
 * that produced them). Otherwise the engine snapshot's session, then the active id.
 */
export function sourcesChangesWriteSessionId(
	snapshot: ISourcesChangesSnapshot,
	entries: readonly { sessionId?: string }[] | undefined,
	activeSessionId: string,
): string {
	if (entries) {
		for (const entry of entries) {
			if (entry.sessionId) {
				return entry.sessionId;
			}
		}
	}
	if (snapshot.state.kind !== 'scm' && snapshot.state.sessionId) {
		return snapshot.state.sessionId;
	}
	return activeSessionId;
}
