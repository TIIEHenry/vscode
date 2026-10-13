/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IMarketplaceHeadersSlot<T> {
	promise: Promise<T> | undefined;
}

/**
 * Share one in-flight marketplace header read.
 * A rejection is dropped only while the slot still points at that attempt, so
 * the next caller resolves again. A fulfilled promise stays cached.
 */
export function loadMarketplaceHeaders<T>(slot: IMarketplaceHeadersSlot<T>, resolve: () => Promise<T>): Promise<T> {
	if (!slot.promise) {
		const attempt = resolve();
		slot.promise = attempt;
		// Drop only this attempt. A later call must resolve again; an in-flight or fulfilled promise stays shared.
		attempt.catch(() => {
			if (slot.promise === attempt) {
				slot.promise = undefined;
			}
		});
	}

	return slot.promise;
}
