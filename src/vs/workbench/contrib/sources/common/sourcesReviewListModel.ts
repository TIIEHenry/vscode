/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { filterSourcesEntries } from './sourcesFilterModel.js';
import { ISourcesReviewEntry } from './sourcesReviewModel.js';
import { buildSourcesReviewProgressKey, ISourcesReviewProgressKey } from './sourcesReviewProgress.js';

export function filterReviewEntries(
	entries: readonly ISourcesReviewEntry[],
	textQuery: string,
	pathFilter: readonly URI[] | undefined,
	unreviewedOnly: boolean,
	isReviewed: (entry: ISourcesReviewEntry) => boolean,
): ISourcesReviewEntry[] {
	let result = filterSourcesEntries(entries, textQuery);

	if (pathFilter && pathFilter.length > 0) {
		const pathSet = new Set(pathFilter.map(path => path.toString()));
		result = result.filter(entry => pathSet.has(entry.resource.toString()));
	}

	if (unreviewedOnly) {
		result = result.filter(entry => !isReviewed(entry));
	}

	return result;
}

export function countReviewProgress(
	entries: readonly ISourcesReviewEntry[],
	isReviewed: (entry: ISourcesReviewEntry) => boolean,
): { reviewed: number; total: number } {
	const total = entries.length;
	const reviewed = entries.filter(entry => isReviewed(entry)).length;
	return { reviewed, total };
}

export function collectActiveReviewProgressKeys(
	entryKeys: ReadonlyMap<string, ISourcesReviewProgressKey>,
): Set<string> {
	return new Set([...entryKeys.values()].map(buildSourcesReviewProgressKey));
}

export async function markReviewedAfterSuccessfulOpen(
	open: () => Promise<void>,
	resolveKey: (resource: URI) => Promise<ISourcesReviewProgressKey>,
	markReviewed: (key: ISourcesReviewProgressKey) => void,
	resource: URI,
): Promise<void> {
	await open();
	const key = await resolveKey(resource);
	markReviewed(key);
}
