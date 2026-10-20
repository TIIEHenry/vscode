/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shares one in-flight or successful remote agent connection.
 * A rejection clears the slot only while it still points at that attempt,
 * so the next call connects again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareRemoteAgentConnection<T>(
	slot: { promise: Promise<T> | null },
	connect: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = connect();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next call connects again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = null;
		}
	});
	return attempt;
}
