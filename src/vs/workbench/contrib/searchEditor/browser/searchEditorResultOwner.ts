/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ISearchComplete } from '../../../services/search/common/search.js';

export const enum AttachedSearchDecision {
	/** The input no longer holds the operation; another completion already handled it. */
	Handled,
	/** The pane's search model holds results of a different search. */
	NotOwned,
	/** The pane's search model holds the results of this operation. */
	Owned,
}

/**
 * Records which search operation produced the results held by a search editor pane's search model.
 * Call `searchStarting` right before `SearchModelImpl.search`, and `searchStarted` in the same
 * synchronous step that receives the operation, so a search that throws leaves no owner behind.
 */
export class SearchResultOwner {

	private owner: Promise<ISearchComplete> | undefined;

	searchStarting(): void {
		this.owner = undefined;
	}

	searchStarted(operation: Promise<ISearchComplete>): void {
		this.owner = operation;
	}

	owns(operation: Promise<ISearchComplete> | undefined): boolean {
		return operation !== undefined && operation === this.owner;
	}

	decideAttached(attached: Promise<ISearchComplete> | undefined): AttachedSearchDecision {
		if (!attached) {
			return AttachedSearchDecision.Handled;
		}
		return this.owns(attached) ? AttachedSearchDecision.Owned : AttachedSearchDecision.NotOwned;
	}
}
