/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful NLS configuration resolution.
 * A rejection deletes that entry only while it still points at that attempt,
 * so the next lookup resolves again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareNlsConfiguration<T>(
	cache: Map<string, Promise<T>>,
	key: string,
	resolve: () => Promise<T>,
): Promise<T> {
	const existing = cache.get(key);
	if (existing) {
		return existing;
	}

	const attempt = resolve();
	cache.set(key, attempt);
	// Not assigned. Callers still observe this rejection; the next lookup resolves again.
	void attempt.catch(() => {
		if (cache.get(key) === attempt) {
			cache.delete(key);
		}
	});
	return attempt;
}
