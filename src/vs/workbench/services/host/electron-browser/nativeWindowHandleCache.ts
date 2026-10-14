/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful native window handle read.
 * A rejection deletes that entry only while it still points at that attempt,
 * so the next read starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareNativeWindowHandle<T>(
	cache: Map<number, Promise<T>>,
	windowId: number,
	load: () => Promise<T>,
): Promise<T> {
	const existing = cache.get(windowId);
	if (existing) {
		return existing;
	}

	const attempt = load();
	cache.set(windowId, attempt);
	// Not assigned. Callers still observe this rejection; the next read starts again.
	void attempt.catch(() => {
		if (cache.get(windowId) === attempt) {
			cache.delete(windowId);
		}
	});
	return attempt;
}
