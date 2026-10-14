/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful workspace-tasks attempt.
 * A rejection clears `promise` only while it still points at that attempt,
 * so the next call computes again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 *
 * Pass `reuse` false to replace any cached attempt. The new attempt is stored
 * after `compute` returns. A rejection still clears only that attempt.
 */
export function shareWorkspaceTasksPromise<T>(
	slot: { promise: Promise<T> | undefined },
	compute: () => Promise<T>,
	reuse: boolean = true,
): Promise<T> {
	if (reuse && slot.promise) {
		return slot.promise;
	}

	const attempt = compute();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next call computes again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = undefined;
		}
	});
	return attempt;
}
