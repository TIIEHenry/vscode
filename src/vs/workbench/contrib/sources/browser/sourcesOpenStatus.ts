/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Review list and Open Selected share one status generation so a late open
 * cannot overwrite the newer status line. Changes has its own counter.
 */
let reviewOpenStatusGeneration = 0;
let changesOpenStatusGeneration = 0;

export function beginSourcesReviewOpenStatus(): number {
	reviewOpenStatusGeneration += 1;
	return reviewOpenStatusGeneration;
}

export function isCurrentSourcesReviewOpenStatus(generation: number): boolean {
	return generation === reviewOpenStatusGeneration;
}

export function beginSourcesChangesOpenStatus(): number {
	changesOpenStatusGeneration += 1;
	return changesOpenStatusGeneration;
}

export function isCurrentSourcesChangesOpenStatus(generation: number): boolean {
	return generation === changesOpenStatusGeneration;
}

/**
 * `'stale'` is truthy. Only `=== false` writes the open-failure line.
 * Only `=== true` may clear a status. A stale generation writes nothing.
 */
export function settleSourcesOpenStatus(
	generation: number,
	isCurrent: (generation: number) => boolean,
	opened: boolean | 'stale',
	effects: {
		readonly onFalse: () => void;
		readonly onTrue?: () => void;
	},
): void {
	if (!isCurrent(generation)) {
		return;
	}
	if (opened === 'stale') {
		return;
	}
	if (opened === false) {
		effects.onFalse();
		return;
	}
	if (opened === true) {
		effects.onTrue?.();
	}
}
