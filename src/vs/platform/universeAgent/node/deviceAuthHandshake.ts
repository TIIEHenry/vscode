/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
	type DeviceAuthTranscriptInput,
} from './deviceGrant/device-grant-crypto.js';
import { ENGINE_CERT_FINGERPRINT_PATTERN } from './deviceGrant/tls-pin.js';
import type {
	IUniverseAgentGrpcTransport,
	UniverseAgentAuthNonceResult,
	UniverseAgentConnectResult,
	UniverseAgentDeviceAuthConnectRequest,
} from './grpc/grpcTransport.js';

const FINGERPRINT_HEX_LEN = 64;

export type DeviceGrantIdentity = {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
	readonly engineIdentityId: string;
	/** Locally observed leaf fingerprint (SEC-3) — lowercase hex, never AuthNonce self-report alone. */
	readonly observedLeafSha256Hex: string;
};

export type DeviceAuthHandshakeFailureCode =
	| 'fingerprint_mismatch'
	| 'fingerprint_malformed'
	| 'identity_mismatch'
	| 'signer_unavailable'
	| 'transport_failed';

export type DeviceAuthHandshakeResult =
	| { readonly kind: 'authenticated'; readonly result: UniverseAgentConnectResult }
	| { readonly kind: 'pairing_pending'; readonly result: UniverseAgentConnectResult }
	| {
		readonly kind: 'failed';
		readonly code: DeviceAuthHandshakeFailureCode;
		readonly reason: string;
	};

function isEngineCertFingerprintHex(value: string): boolean {
	return ENGINE_CERT_FINGERPRINT_PATTERN.test(value);
}

function validateAuthNonceFingerprint(
	nonce: UniverseAgentAuthNonceResult,
	observedLeafSha256Hex: string,
): DeviceAuthHandshakeResult | undefined {
	if (!isEngineCertFingerprintHex(nonce.engineCertFingerprint)) {
		return {
			kind: 'failed',
			code: 'fingerprint_malformed',
			reason: 'engine_cert_fingerprint malformed on AuthNonceResponse (SEC-3)',
		};
	}
	if (nonce.engineCertFingerprint !== observedLeafSha256Hex) {
		return {
			kind: 'failed',
			code: 'fingerprint_mismatch',
			reason: 'engine_cert_fingerprint mismatch vs local TLS observation (SEC-3)',
		};
	}
	return undefined;
}

export async function runDeviceAuthHandshake(
	transport: IUniverseAgentGrpcTransport,
	identity: DeviceGrantIdentity,
	sign: (input: DeviceAuthTranscriptInput) => Uint8Array,
	options: {
		readonly pairingPhase?: 'provisional' | 'formal';
		readonly protocolVersion?: string;
	} = {},
): Promise<DeviceAuthHandshakeResult> {
	if (!isEngineCertFingerprintHex(identity.observedLeafSha256Hex)) {
		return {
			kind: 'failed',
			code: 'fingerprint_malformed',
			reason: 'observed leaf fingerprint invalid (SEC-3)',
		};
	}

	let nonce: UniverseAgentAuthNonceResult;
	try {
		nonce = await transport.getAuthNonce({
			clientIdentityId: identity.clientIdentityId,
			clientPublicKey: identity.clientPublicKey,
		});
	} catch (err) {
		return {
			kind: 'failed',
			code: 'transport_failed',
			reason: `GetAuthNonce failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	const fingerprintError = validateAuthNonceFingerprint(nonce, identity.observedLeafSha256Hex);
	if (fingerprintError) {
		return fingerprintError;
	}

	if (nonce.engineIdentityId !== identity.engineIdentityId) {
		return {
			kind: 'failed',
			code: 'identity_mismatch',
			reason: 'engine_identity_id mismatch vs pinned trust record (ADR-261)',
		};
	}

	if (nonce.authNonce.byteLength === 0) {
		return {
			kind: 'failed',
			code: 'transport_failed',
			reason: 'auth_nonce material absent or empty (ADR-014)',
		};
	}

	const protocolVersion = options.protocolVersion ?? DEVICE_GRANT_AUTH_PROTOCOL_VERSION;
	let signature: Uint8Array;
	try {
		signature = sign({
			engineIdentityId: nonce.engineIdentityId,
			engineCertFingerprint: identity.observedLeafSha256Hex,
			authNonce: nonce.authNonce,
			clientIdentityId: identity.clientIdentityId,
			protocolVersion,
		});
	} catch (err) {
		return {
			kind: 'failed',
			code: 'signer_unavailable',
			reason: `DeviceAuth sign failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	const connectRequest: UniverseAgentDeviceAuthConnectRequest = {
		clientIdentityId: identity.clientIdentityId,
		clientPublicKey: identity.clientPublicKey,
		authNonce: nonce.authNonce,
		signature,
		protocolVersion,
		pairingPhase: options.pairingPhase,
	};

	let connectResult: UniverseAgentConnectResult;
	try {
		connectResult = await transport.connectWithDeviceAuth(connectRequest);
	} catch (err) {
		return {
			kind: 'failed',
			code: 'transport_failed',
			reason: `Connect device_auth failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	if (connectResult.sessionToken && connectResult.pairingNonce) {
		return {
			kind: 'failed',
			code: 'transport_failed',
			reason: 'Connect returned both session_token and pairing_nonce',
		};
	}

	if (connectResult.sessionToken) {
		return { kind: 'authenticated', result: connectResult };
	}
	if (connectResult.pairingNonce) {
		return { kind: 'pairing_pending', result: connectResult };
	}

	return {
		kind: 'failed',
		code: 'transport_failed',
		reason: 'Connect device_auth returned neither session_token nor pairing_nonce',
	};
}

/** SEC-3 cross-check helper exported for pairing orchestrator S2–S4. */
export function assertObservedFingerprintMatchesNonce(
	nonce: UniverseAgentAuthNonceResult,
	candidateSha256Hex: string,
): { readonly ok: true } | { readonly ok: false; readonly code: 'fingerprint_mismatch' | 'fingerprint_malformed'; readonly reason: string } {
	if (!isEngineCertFingerprintHex(nonce.engineCertFingerprint)) {
		return {
			ok: false,
			code: 'fingerprint_malformed',
			reason: 'engine_cert_fingerprint malformed on AuthNonceResponse (SEC-3)',
		};
	}
	if (nonce.engineCertFingerprint.length !== FINGERPRINT_HEX_LEN || candidateSha256Hex.length !== FINGERPRINT_HEX_LEN) {
		return {
			ok: false,
			code: 'fingerprint_mismatch',
			reason: 'fingerprint length mismatch',
		};
	}
	if (nonce.engineCertFingerprint !== candidateSha256Hex) {
		return {
			ok: false,
			code: 'fingerprint_mismatch',
			reason: 'AuthNonce fingerprint != candidateSha256 (SEC-3 fail-closed)',
		};
	}
	return { ok: true };
}
