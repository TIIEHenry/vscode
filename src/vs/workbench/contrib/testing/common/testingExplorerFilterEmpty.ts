/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type TestingExplorerFilterEmpty = 'noMatching';

export interface TestingExplorerFilterEmptyInput {
	/** True while at least one provider is still discovering tests. */
	readonly providersBusy: boolean;
	/** True when no root has children. The workspace or current-file welcome owns that case. */
	readonly collectionEmpty: boolean;
	/** Raw filter box text, including `@failed`, `@doc`, tags, and globs. */
	readonly filterText: string;
	/** Rows the tree is actually showing, including error rows. */
	readonly visibleCount: number;
}

/**
 * A miss is a settled, non-empty collection whose trimmed filter text leaves
 * zero visible rows. Discovery, an empty collection, a blank filter, and any
 * visible row stay silent. Exclusions with a blank filter are not this sentence.
 */
export function testingExplorerFilterEmptyReason(input: TestingExplorerFilterEmptyInput): TestingExplorerFilterEmpty | undefined {
	if (input.providersBusy || input.collectionEmpty || input.visibleCount > 0) {
		return undefined;
	}
	if (input.filterText.trim().length === 0) {
		return undefined;
	}
	return 'noMatching';
}
