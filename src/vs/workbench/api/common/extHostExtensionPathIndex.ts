/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful extension path index.
 * A rejection clears the slot only while it still points at that attempt,
 * so the next read starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareExtensionPathIndex<T>(
	slot: { promise: Promise<T> | null },
	load: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = load();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next read starts again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = null;
		}
	});
	return attempt;
}

/**
 * Shares one in-flight or successful extension realpath.
 * A rejection deletes that entry only while it still points at that attempt,
 * so the next read starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareExtensionRealPath<T>(
	cache: Map<string, Promise<T>>,
	fsPath: string,
	load: () => Promise<T>,
): Promise<T> {
	const existing = cache.get(fsPath);
	if (existing) {
		return existing;
	}

	const attempt = load();
	cache.set(fsPath, attempt);
	// Not assigned. Callers still observe this rejection; the next read starts again.
	void attempt.catch(() => {
		if (cache.get(fsPath) === attempt) {
			cache.delete(fsPath);
		}
	});
	return attempt;
}
