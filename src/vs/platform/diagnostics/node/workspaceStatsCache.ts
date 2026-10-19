/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful workspace-stats scan.
 * A rejection deletes that entry only while it still points at that attempt,
 * so the next scan starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareWorkspaceStatsPromise<T>(
	cache: Map<string, Promise<T>>,
	key: string,
	load: () => Promise<T>,
): Promise<T> {
	const existing = cache.get(key);
	if (existing) {
		return existing;
	}

	const attempt = load();
	cache.set(key, attempt);
	// Not assigned. Callers still observe this rejection; the next scan starts again.
	void attempt.catch(() => {
		if (cache.get(key) === attempt) {
			cache.delete(key);
		}
	});
	return attempt;
}
