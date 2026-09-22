/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { IQuickDiffService, QuickDiff } from '../../scm/common/quickDiff.js';
import { ISCMResource, ISCMService } from '../../scm/common/scm.js';
import { ISourcesChangeEntry } from './sourcesChangesModel.js';

export interface ISourcesChangeRef {
	readonly modified: URI;
	readonly original: URI | undefined;
	readonly groupId: string;
	readonly scmResource?: ISCMResource;
	/** Fetched `ReadGitFileDiff` body for Accept. Empty stays a hard reject — do not invent from editor sides. */
	readonly unifiedDiff?: string;
}

const applyHunksPatchByHost = new WeakMap<object, string>();

/** Remember a fetched unifiedDiff on a host (ConversationDiffReviewInput). Empty / whitespace stays rejected. */
export function attachSourcesGitApplyHunksPatch(host: object, unifiedDiff: string): void {
	if (unifiedDiff.trim() === '') {
		return;
	}
	applyHunksPatchByHost.set(host, unifiedDiff);
}

/** Accept patches from a carried unifiedDiff only. Empty / whitespace → no payload. Hosts without the field still use the WeakMap. */
export function sourcesGitApplyHunksPatches(source?: object): readonly string[] {
	if (!source) {
		return [];
	}
	const unifiedDiff = (source as { readonly unifiedDiff?: string }).unifiedDiff ?? applyHunksPatchByHost.get(source);
	if (unifiedDiff === undefined || unifiedDiff.trim() === '') {
		return [];
	}
	return [unifiedDiff];
}

export function pickQuickDiffOriginalResource(quickDiffs: readonly QuickDiff[]): URI | undefined {
	if (quickDiffs.length === 0) {
		return undefined;
	}

	const gitDiff = quickDiffs.find(diff => diff.id === 'git');
	return (gitDiff ?? quickDiffs[0]).originalResource;
}

export async function resolveSourcesChangeRef(
	entry: ISourcesChangeEntry,
	quickDiffService: IQuickDiffService,
): Promise<ISourcesChangeRef> {
	const quickDiffs = await quickDiffService.getQuickDiffs(entry.resource);
	const original = pickQuickDiffOriginalResource(quickDiffs);

	return {
		modified: entry.resource,
		original,
		groupId: entry.groupId,
		scmResource: entry.scmResource,
	};
}

/** Real filesystem path for local git writes. Empty when the URI is not a file (do not invent). */
export function sourcesDiffLocalWritePath(ref: { modified: URI; scmResource?: ISCMResource }): string {
	if (ref.scmResource) {
		return ref.scmResource.sourceUri.fsPath;
	}
	if (ref.modified.scheme === Schemas.file) {
		return ref.modified.fsPath;
	}
	return '';
}

export function findScmResourceForUri(scmService: ISCMService, uri: URI): { resource: ISCMResource; groupId: string } | undefined {
	for (const repo of scmService.repositories) {
		for (const group of repo.provider.groups) {
			for (const resource of group.resources) {
				if (resource.sourceUri.toString() === uri.toString()) {
					return { resource, groupId: group.id };
				}
			}
		}
	}
	return undefined;
}
