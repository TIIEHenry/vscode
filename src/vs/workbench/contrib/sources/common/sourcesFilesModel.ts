/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { compareFileNamesDefault } from '../../../../base/common/comparers.js';
import { IExpression } from '../../../../base/common/glob.js';
import { basename, relativePath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileQuery, ISearchComplete, QueryType } from '../../../services/search/common/search.js';

export interface ISourcesFileEntry {
	readonly resource: URI;
	readonly name: string;
	readonly description: string;
}

export interface ISourcesFileSearch {
	fileSearch(query: IFileQuery, token?: CancellationToken): Promise<ISearchComplete>;
}

export interface ISourcesFilesCollectOutcome {
	readonly entries: readonly ISourcesFileEntry[];
	readonly limitHit: boolean;
	readonly truncated: boolean;
	readonly failedFolders: readonly URI[];
	readonly firstFolderFailure: unknown | undefined;
}

export function resolveSourcesFilesCollectResult(
	lastGood: readonly ISourcesFileEntry[],
	collected: readonly ISourcesFileEntry[] | undefined,
	error: unknown | undefined,
): { readonly entries: readonly ISourcesFileEntry[]; readonly failed: boolean } {
	if (error !== undefined) {
		return { entries: lastGood, failed: true };
	}
	return { entries: collected ?? [], failed: false };
}

/** One folder, one query. Ignore flags live on the folder query, not the file query. */
export function buildSourcesFileFolderQuery(folder: URI, excludePattern: IExpression | undefined, maxResults: number): IFileQuery {
	return {
		type: QueryType.File,
		folderQueries: [{
			folder,
			disregardIgnoreFiles: false,
			disregardParentIgnoreFiles: false,
		}],
		excludePattern,
		maxResults,
	};
}

/**
 * Search each workspace folder on its own. `fileSearch` rejects the whole promise
 * when any folder query fails, so one shared query would drop folders that succeeded.
 * Every folder rejected throws. Some folders rejected returns fulfilled entries and `failedFolders`.
 * A cancelled token is the caller's stale round, not a success.
 */
export async function collectSourcesFileEntries(
	folders: readonly URI[],
	excludePattern: IExpression | undefined,
	maxResults: number,
	search: ISourcesFileSearch,
	tokens: readonly CancellationToken[],
): Promise<ISourcesFilesCollectOutcome> {
	if (folders.length === 0) {
		return { entries: [], limitHit: false, truncated: false, failedFolders: [], firstFolderFailure: undefined };
	}

	const settled = await Promise.allSettled(folders.map((folder, index) => {
		const token = tokens[index] ?? CancellationToken.None;
		return search.fileSearch(buildSourcesFileFolderQuery(folder, excludePattern, maxResults), token);
	}));

	const failures: unknown[] = [];
	const failedFolders: URI[] = [];
	const entries: ISourcesFileEntry[] = [];
	let limitHit = false;
	for (let index = 0; index < settled.length; index++) {
		const result = settled[index];
		if (result.status === 'rejected') {
			failures.push(result.reason);
			failedFolders.push(folders[index]);
			continue;
		}
		if (result.value.limitHit) {
			limitHit = true;
		}
		const folder = folders[index];
		for (const match of result.value.results) {
			entries.push({
				resource: match.resource,
				name: basename(match.resource),
				description: relativePath(folder, match.resource) ?? basename(match.resource),
			});
		}
	}

	if (failures.length === folders.length) {
		const first = failures[0];
		throw first instanceof Error ? first : new Error(String(first));
	}

	entries.sort((a, b) => compareFileNamesDefault(a.description, b.description) || compareFileNamesDefault(a.name, b.name));
	let truncated = limitHit;
	if (entries.length > maxResults) {
		entries.length = maxResults;
		truncated = true;
	}
	return {
		entries,
		limitHit,
		truncated,
		failedFolders,
		firstFolderFailure: failedFolders.length > 0 ? failures[0] : undefined,
	};
}
