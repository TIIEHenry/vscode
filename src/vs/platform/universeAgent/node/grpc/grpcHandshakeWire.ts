/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentConnectResult } from '../../common/universeAgentTypes.js';
import type {
	UniverseAgentAuthNonceRequest,
	UniverseAgentAuthNonceResult,
	UniverseAgentDeviceAuthConnectRequest,
} from './grpcTransport.js';
import {
	allLengthDelimited,
	encodeBytesField,
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * ConnectRequest min/max/major/minor — wire ints, not Device Grant
 * `DEVICE_GRANT_AUTH_PROTOCOL_VERSION` ("1"). Matches Desktop connect-protocol.json.
 */
export const CONNECT_WIRE_PROTOCOL = {
	minProtocol: 2,
	maxProtocol: 2,
	protocolMajor: 2,
	protocolMinor: 0,
} as const;

const ENGINE_CERT_FINGERPRINT_HEX = /^[0-9a-f]{64}$/;

export function encodeAuthNonceRequest(request: UniverseAgentAuthNonceRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.clientIdentityId),
		encodeBytesField(2, request.clientPublicKey),
	]);
}

export function decodeAuthNonceResponse(bytes: Uint8Array): UniverseAgentAuthNonceResult {
	const fields = readProtoFields(bytes);
	const expires = lastVarint(fields, 2);
	return {
		authNonce: Uint8Array.from(lastBytes(fields, 1) ?? new Uint8Array(0)),
		expiresAtMs: expires === undefined ? undefined : Number(expires),
		engineIdentityId: lastString(fields, 3) ?? '',
		engineCertFingerprint: decodeEngineCertFingerprint(lastBytes(fields, 4)),
	};
}

export function encodeDeviceAuth(request: UniverseAgentDeviceAuthConnectRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.clientIdentityId),
		encodeBytesField(2, request.clientPublicKey),
		encodeBytesField(3, request.authNonce),
		encodeBytesField(4, request.signature),
	]);
}

export function encodeDeviceAuthConnectRequest(request: UniverseAgentDeviceAuthConnectRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, CONNECT_WIRE_PROTOCOL.minProtocol),
		encodeInt32Field(2, CONNECT_WIRE_PROTOCOL.maxProtocol),
		encodeInt32Field(9, CONNECT_WIRE_PROTOCOL.protocolMajor),
		encodeInt32Field(10, CONNECT_WIRE_PROTOCOL.protocolMinor),
		encodeMessageField(12, encodeDeviceAuth(request)),
	]);
}

export function decodeConnectResponse(bytes: Uint8Array): UniverseAgentConnectResult {
	const fields = readProtoFields(bytes);
	const capabilities = decodeServerCapabilities(lastBytes(fields, 3));
	const pairingNonce = lastBytes(fields, 7);
	const sessionToken = lastString(fields, 6);
	const sasCode = lastString(fields, 8);
	return {
		sessionToken: sessionToken || undefined,
		workDir: lastString(fields, 5) || undefined,
		pairingNonce: pairingNonce && pairingNonce.length > 0
			? Buffer.from(pairingNonce).toString('base64')
			: undefined,
		sasCode: sasCode || undefined,
		methods: capabilities.methods,
		events: capabilities.events,
	};
}

function decodeServerCapabilities(bytes: Uint8Array | undefined): { methods: string[]; events: string[] } {
	if (!bytes || bytes.length === 0) {
		return { methods: [], events: [] };
	}
	const fields = readProtoFields(bytes);
	return {
		methods: allLengthDelimited(fields, 1).map(value => Buffer.from(value).toString('utf8')),
		events: allLengthDelimited(fields, 2).map(value => Buffer.from(value).toString('utf8')),
	};
}

function decodeEngineCertFingerprint(bytes: Uint8Array | undefined): string {
	if (!bytes || bytes.length === 0) {
		return '';
	}
	const asText = Buffer.from(bytes).toString('utf8');
	if (ENGINE_CERT_FINGERPRINT_HEX.test(asText)) {
		return asText;
	}
	if (bytes.length === 32) {
		return Buffer.from(bytes).toString('hex');
	}
	return asText;
}
