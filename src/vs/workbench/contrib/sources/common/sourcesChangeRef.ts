/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IQuickDiffService, QuickDiff } from '../../scm/common/quickDiff.js';
import { ISCMResource, ISCMService } from '../../scm/common/scm.js';
import { ISourcesChangeEntry } from './sourcesChangesModel.js';

export interface ISourcesChangeRef {
	readonly modified: URI;
	readonly original: URI | undefined;
	readonly groupId: string;
	readonly scmResource?: ISCMResource;
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
