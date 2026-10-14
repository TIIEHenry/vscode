/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight semantic search promise.
 * A rejection clears `promise` only while it still points at that attempt.
 * Success stays cached until the caller clears it via `clearIfCurrent`.
 * The returned promise still rejects; this does not start another attempt.
 */
export function acquirePendingSemanticSearch<T>(
	slot: { promise: Promise<T> | undefined },
	start: (clearIfCurrent: () => void) => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	let attempt: Promise<T> | undefined;
	const clearIfCurrent = () => {
		if (attempt !== undefined && slot.promise === attempt) {
			slot.promise = undefined;
		}
	};

	attempt = start(clearIfCurrent);
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next call starts again.
	attempt.catch(() => {
		clearIfCurrent();
	});
	return attempt;
}
