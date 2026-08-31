/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { collectSourcesChangeEntries, ISourcesChangeEntry, ISourcesChangeRepositoryLike } from './sourcesChangesModel.js';

export type ISourcesReviewEntry = ISourcesChangeEntry;

/** Read-only Review tab projection — same SCM resources as Changes. */
export function collectSourcesReviewEntries(repos: Iterable<ISourcesChangeRepositoryLike>): ISourcesReviewEntry[] {
	return collectSourcesChangeEntries(repos);
}
