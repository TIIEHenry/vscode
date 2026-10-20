/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful debug-visualizer activation.
 * A rejection deletes that entry only while it still points at that attempt,
 * so the next lookup activates again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareDebugVisualizerActivation(
	cache: Map<string, Promise<void>>,
	id: string,
	activate: () => Promise<void>,
): Promise<void> {
	const existing = cache.get(id);
	if (existing) {
		return existing;
	}

	const attempt = activate();
	cache.set(id, attempt);
	// Not assigned. Callers still observe this rejection; the next lookup activates again.
	void attempt.catch(() => {
		if (cache.get(id) === attempt) {
			cache.delete(id);
		}
	});
	return attempt;
}
