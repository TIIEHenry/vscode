/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Renderer-safe failure codes for Hub / resolver connect (connection-hub-client §3.3). */
export type ConnectionFailureCode =
	| 'trust_missing'
	| 'private_network_denied'
	| 'pairing_required'
	| 'sas_mismatch'
	| 'grant_pending'
	| 'grant_revoked'
	| 'pin_mismatch'
	| 'hub_session_required'
	| 'hub_password_change_required'
	| 'hub_auth_expired'
	| 'hub_unreachable'
	| 'hub_device_not_in_directory'
	| 'hub_device_revoked'
	| 'engine_not_serving'
	| 'hub_ticket_failed'
	| 'hub_rate_limited'
	| 'transport_failed'
	| 'unsupported_environment';

export type ConnectionPath = 'direct' | 'hubRelay' | 'loopback';

export type ConnectionPhase =
	| { readonly kind: 'disconnected' }
	| { readonly kind: 'connecting'; readonly reason: 'initial' | 'transport_lost' }
	| { readonly kind: 'connected'; readonly path: ConnectionPath }
	| { readonly kind: 'failed'; readonly code: ConnectionFailureCode; readonly reason: string }
	| { readonly kind: 'closed' };

export type UniverseAgentConnectProfileResult =
	| {
		readonly ok: true;
		readonly path: ConnectionPath;
		readonly sessionToken?: string;
		readonly workDir?: string;
		readonly pairingPending: boolean;
		/** From handshake GetAuthNonce / Connect — not Hub directory. */
		readonly sasCode?: string;
		readonly engineIdentityId?: string;
	}
	| {
		readonly ok: false;
		readonly code: ConnectionFailureCode;
		readonly reason: string;
	};
