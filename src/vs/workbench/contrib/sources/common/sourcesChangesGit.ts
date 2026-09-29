/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { ISCMRepository } from '../../scm/common/scm.js';
import { ISourcesChangeEntry } from './sourcesChangesModel.js';

export const SOURCES_GIT_STAGE_COMMAND = 'git.stage';
export const SOURCES_GIT_UNSTAGE_COMMAND = 'git.unstage';
export const SOURCES_GIT_COMMIT_COMMAND = 'git.commit';
export const SOURCES_GIT_CLEAN_COMMAND = 'git.clean';

/** Git SCM resource group ids that accept stage (extensions/git). */
const STAGEABLE_GROUP_IDS = new Set(['merge', 'workingTree', 'untracked']);

/** Git SCM resource group id for staged index resources. */
const UNSTAGEABLE_GROUP_IDS = new Set(['index']);

/** Git SCM resource groups that `git.clean` will discard. */
const REVERTIBLE_GROUP_IDS = new Set(['workingTree', 'untracked']);

export function isSourcesChangeStageable(groupId: string): boolean {
	return STAGEABLE_GROUP_IDS.has(groupId);
}

export function isSourcesChangeUnstageable(groupId: string): boolean {
	return UNSTAGEABLE_GROUP_IDS.has(groupId);
}

export function isSourcesChangeRevertible(groupId: string): boolean {
	return REVERTIBLE_GROUP_IDS.has(groupId);
}

export function collectStageTargetUris(entries: readonly ISourcesChangeEntry[]): URI[] {
	return entries.filter(entry => isSourcesChangeStageable(entry.groupId)).map(entry => entry.resource);
}

export function collectUnstageTargetUris(entries: readonly ISourcesChangeEntry[]): URI[] {
	return entries.filter(entry => isSourcesChangeUnstageable(entry.groupId)).map(entry => entry.resource);
}

export function sourcesRepositoryRootUris(repositories: Iterable<{ readonly provider?: { readonly rootUri?: URI } }>): URI[] {
	const roots: URI[] = [];
	for (const repo of repositories) {
		const root = repo.provider?.rootUri;
		if (root) {
			roots.push(root);
		}
	}
	return roots;
}

/** Staged means an `index` group that still has resources. */
export function sourcesRepositoryHasStagedChanges(repo: ISCMRepository): boolean {
	for (const group of repo.provider.groups) {
		if (isSourcesChangeUnstageable(group.id) && group.resources.length > 0) {
			return true;
		}
	}
	return false;
}

/** The only repository that already has staged changes. Zero or two or more returns undefined. */
export function uniqueSourcesStagedRepository(repositories: Iterable<ISCMRepository>): ISCMRepository | undefined {
	let found: ISCMRepository | undefined;
	for (const repo of repositories) {
		if (!sourcesRepositoryHasStagedChanges(repo)) {
			continue;
		}
		if (found) {
			return undefined;
		}
		found = repo;
	}
	return found;
}

/** Provider label, else name, else root basename. Empty when none of those exist. */
export function sourcesRepositoryCommitName(repo: ISCMRepository): string {
	const label = repo.provider.label?.trim();
	if (label) {
		return label;
	}
	const name = repo.provider.name?.trim();
	if (name) {
		return name;
	}
	const root = repo.provider.rootUri;
	if (!root) {
		return '';
	}
	return basename(root) || '';
}
