/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type ExplorerFlatListEmpty = 'emptyFolder' | 'noMatching';

export interface ExplorerFlatListEmptyInput {
	/** Sidebar tree stays silent. Only the one-level list writes a sentence. */
	readonly flat: boolean;
	readonly query: string;
	/** False while the current directory's children are still being read. */
	readonly directoryResolved: boolean;
	/** Unfiltered children of that directory. */
	readonly childCount: number;
	/** Rows the tree is actually showing. */
	readonly visibleCount: number;
}

/**
 * List mode only. An unresolved directory says nothing, so a read in flight
 * is not reported as empty or as a missed filter. A resolved directory with
 * no children is empty even when a query is typed. A filter miss needs a
 * non-blank query and zero visible rows while children still exist.
 */
export function explorerFlatListEmptyReason(input: ExplorerFlatListEmptyInput): ExplorerFlatListEmpty | undefined {
	if (!input.flat || !input.directoryResolved || input.visibleCount > 0) {
		return undefined;
	}
	if (input.childCount === 0) {
		return 'emptyFolder';
	}
	if (input.query.trim().length > 0) {
		return 'noMatching';
	}
	return undefined;
}
