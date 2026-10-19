/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful favicon fetch.
 * A rejection deletes that entry only while it still points at that attempt,
 * so the next fetch starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareFaviconRequest(
	cache: Map<string, Promise<string>>,
	url: string,
	load: () => Promise<string>,
): Promise<string> {
	const existing = cache.get(url);
	if (existing) {
		return existing;
	}

	const attempt = load();
	cache.set(url, attempt);
	// Not assigned. Callers still observe this rejection; the next fetch starts again.
	void attempt.catch(() => {
		if (cache.get(url) === attempt) {
			cache.delete(url);
		}
	});
	return attempt;
}
