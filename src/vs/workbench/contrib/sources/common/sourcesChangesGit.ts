/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ISourcesChangeEntry } from './sourcesChangesModel.js';

export const SOURCES_GIT_STAGE_COMMAND = 'git.stage';
export const SOURCES_GIT_UNSTAGE_COMMAND = 'git.unstage';
export const SOURCES_GIT_COMMIT_COMMAND = 'git.commit';

/** Git SCM resource group ids that accept stage (extensions/git). */
const STAGEABLE_GROUP_IDS = new Set(['merge', 'workingTree', 'untracked']);

/** Git SCM resource group id for staged index resources. */
const UNSTAGEABLE_GROUP_IDS = new Set(['index']);

export function isSourcesChangeStageable(groupId: string): boolean {
	return STAGEABLE_GROUP_IDS.has(groupId);
}

export function isSourcesChangeUnstageable(groupId: string): boolean {
	return UNSTAGEABLE_GROUP_IDS.has(groupId);
}

export function collectStageTargetUris(entries: readonly ISourcesChangeEntry[]): URI[] {
	return entries.filter(entry => isSourcesChangeStageable(entry.groupId)).map(entry => entry.resource);
}

export function collectUnstageTargetUris(entries: readonly ISourcesChangeEntry[]): URI[] {
	return entries.filter(entry => isSourcesChangeUnstageable(entry.groupId)).map(entry => entry.resource);
}
