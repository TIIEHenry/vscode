/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful extension-host activation.
 * A rejection deletes that entry only while it still points at that attempt,
 * so the next activation starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareExtensionHostActivation(
	cache: Map<string, Promise<void>>,
	activationEvent: string,
	load: () => Promise<void>,
): Promise<void> {
	const existing = cache.get(activationEvent);
	if (existing) {
		return existing;
	}

	const attempt = load();
	cache.set(activationEvent, attempt);
	// Not assigned. Callers still observe this rejection; the next activation starts again.
	void attempt.catch(() => {
		if (cache.get(activationEvent) === attempt) {
			cache.delete(activationEvent);
		}
	});
	return attempt;
}
