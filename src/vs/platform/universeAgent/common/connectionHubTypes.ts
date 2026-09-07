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

export type ConnectionProbeResult =
	| { readonly ok: true; readonly path: ConnectionPath; readonly authority: string; readonly latencyMs: number }
	| { readonly ok: false; readonly code: ConnectionFailureCode; readonly reason: string };

/**
 * Probe/Test when formal dial needs pairing. Not a transport failure —
 * Connect owns SAS / recoverTrust. Conversation copy is A's job.
 */
export const PAIRING_REQUIRED_USE_CONNECT_REASON = 'pairing required: use Connect to complete pairing';

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
		/**
		 * Formal handshake still waiting for Engine grant after SAS confirm.
		 * `pairingPending` without a new `sasCode` — not `pairing_required`.
		 */
		readonly grantPending?: boolean;
		/**
		 * S4 unexpected session_token → recoverTrust (Desktop ADR-031).
		 * When true: no sasCode; confirm via identity + leaf fingerprint dialog.
		 */
		readonly recoverTrust?: boolean;
		/** Observed leaf SHA-256 hex; required when {@link recoverTrust} is true. */
		readonly leafSha256Hex?: string;
	}
	| {
		readonly ok: false;
		readonly code: ConnectionFailureCode;
		readonly reason: string;
	};
