/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * When moving untracked files to trash, returns paths to pass to `git clean -f`
 * after the user confirms permanent deletion. Returns `undefined` when `clean`
 * must not be invoked (all trash deletes succeeded, or the user declined).
 */
export function getUntrackedCleanPathsAfterTrash(
	trashFailedPaths: readonly string[],
	userConfirmedPermanentDelete: boolean
): readonly string[] | undefined {
	if (trashFailedPaths.length === 0) {
		return undefined;
	}
	if (!userConfirmedPermanentDelete) {
		return undefined;
	}
	return trashFailedPaths;
}

/** Paths to clean when discard-to-trash is disabled (no recycle bin attempt). */
export function getUntrackedCleanPathsWhenTrashDisabled(allResources: readonly string[]): readonly string[] {
	return allResources;
}
