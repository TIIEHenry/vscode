/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Sessions Changes must not run changeset writes while pairing is pending.
 * `isConversationPairingHold` also requires phase `connected`. Pairing start
 * publishes `connecting` with `pairingPending`, so that predicate stays false
 * for the wait the user actually sees. `pairingPending` alone is the hold.
 */
export function isChangesWritePairingHold(ua: { getConnectionSnapshot(): { readonly pairingPending?: boolean } } | undefined): boolean {
	if (!ua) {
		return false;
	}
	return ua.getConnectionSnapshot().pairingPending === true;
}

/** True when invokeOperation must not confirm or call invokeChangesetOperation. */
export function changesetInvokeBlock(input: { readonly pairingHold: boolean; readonly hasConnection: boolean }): boolean {
	return input.pairingHold || !input.hasConnection;
}
