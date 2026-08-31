/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';

export interface ISourcesChangeEntry {
	readonly resource: URI;
	readonly name: string;
	readonly description: string;
}

export interface ISourcesChangeResourceLike {
	readonly sourceUri: URI;
}

export interface ISourcesChangeGroupLike {
	readonly label: string;
	readonly resources: readonly ISourcesChangeResourceLike[];
}

export interface ISourcesChangeRepositoryLike {
	readonly provider: {
		readonly groups: readonly ISourcesChangeGroupLike[];
	};
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
