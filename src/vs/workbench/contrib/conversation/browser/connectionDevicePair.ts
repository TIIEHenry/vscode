/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentPendingPairInfo } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Connection Devices → ListPending / PairApprove / PairReject. Empty ids are still sent. */
export function canSendConnectionDevicePairRequest(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Pass through empty `pairingCode` / `displayName` / `role` as-is (no default / no trim). */
export function connectionDevicePairIds(
	inputPairingCode: string | undefined,
	selected: { readonly pairingCode?: string; readonly displayName?: string; readonly role?: string } | undefined,
): { pairingCode: string; displayName: string; role: string } {
	return {
		pairingCode: selected?.pairingCode ?? inputPairingCode ?? '',
		displayName: selected?.displayName ?? '',
		role: selected?.role ?? '',
	};
}

/** Honest pending-row label. Empty displayName / pairingCode / platform stay empty. */
export function formatConnectionPendingPairLabel(pending: UniverseAgentPendingPairInfo): string {
	return `${pending.displayName} — ${pending.pairingCode} — ${pending.platform}`;
}

export const CONNECTION_DEVICE_PENDING_EMPTY_COPY = localize(
	'ua.connectionDevicePendingEmpty',
	"No pending pairing requests",
);

export const CONNECTION_DEVICE_PENDING_HEADING = localize(
	'ua.connectionDevicePendingHeading',
	"Pending pairs",
);

export const CONNECTION_DEVICE_PAIR_REJECT_LABEL = localize(
	'ua.connectionDevicePairReject',
	"Reject",
);
