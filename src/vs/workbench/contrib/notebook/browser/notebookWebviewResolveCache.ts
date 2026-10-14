/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one notebook output webview resolve. In-flight callers reuse the same promise.
 * A rejection clears `promise` only while it still points at that attempt,
 * so the next call starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareNotebookWebviewResolve<T>(slot: { promise: Promise<T> | null }, start: () => Promise<T>): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = start();
	slot.promise = attempt;
	// Drop only this rejected attempt. In-flight callers share it; a fulfilled webview stays cached.
	attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = null;
		}
	});
	return attempt;
}
